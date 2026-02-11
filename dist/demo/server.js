import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { deriveKey, generateSalt, encrypt, decrypt } from "../core/crypto.js";
import { openDatabase, upsertFact, getAllFacts, getDirtyFacts, getPendingDeletes, clearDirtyState, getMeta, setMeta, } from "../core/db.js";
import { deriveKeypairFromPhrase } from "../core/identity.js";
import { generatePhrase, phraseToString } from "../core/passphrase.js";
import { createChunkedShards, serializeShard, deserializeShard, replayShards, factToUpsertOp } from "../core/shard.js";
import { pushShard, pushIdentity } from "../core/sync.js";
import { downloadShard } from "../core/arweave.js";
import { TurboBackend } from "../core/backends/turbo.js";
// ── Demo state ────────────────────────────────────────────
const DEMO_DIR = join("/tmp", `sharme-demo-${randomBytes(4).toString("hex")}`);
process.env.SHARME_HOME = DEMO_DIR;
let db = null;
let encryptionKey = null;
let identityPrivateKey = null;
let walletAddress = null;
let lastShards = [];
let pushedTransactions = [];
let savedPassphrase = null;
// ── Helpers ───────────────────────────────────────────────
function getDbPath() {
    return join(DEMO_DIR, "sharme.db");
}
function getShardsDir() {
    return join(DEMO_DIR, "shards");
}
async function readBody(req) {
    const chunks = [];
    for await (const chunk of req)
        chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
}
function json(res, data, status = 200) {
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(data));
}
function cors(res) {
    res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
}
// ── API handlers ──────────────────────────────────────────
function handleStatus(_req, res) {
    const initialized = db !== null;
    let factCount = 0;
    let dirtyCount = 0;
    let deleteCount = 0;
    if (db) {
        factCount = getAllFacts(db).length;
        dirtyCount = getDirtyFacts(db).length;
        deleteCount = getPendingDeletes(db).length;
    }
    json(res, {
        initialized,
        wallet: walletAddress,
        demoDir: DEMO_DIR,
        factCount,
        dirtyCount,
        deleteCount,
    });
}
let pendingPhrase = null;
let pendingConfirmIndices = null;
function handleGeneratePhrase(_req, res) {
    const words = generatePhrase();
    const idx1 = Math.floor(Math.random() * 3); // word 1-3
    const idx2 = 3 + Math.floor(Math.random() * 3); // word 4-6
    pendingPhrase = words;
    pendingConfirmIndices = [idx1, idx2];
    json(res, {
        words,
        confirmWord1: idx1 + 1, // 1-indexed for display
        confirmWord2: idx2 + 1,
    });
}
async function handleInit(req, res) {
    if (db) {
        json(res, { error: "Already initialized. Use /api/reset first." }, 400);
        return;
    }
    const body = JSON.parse(await readBody(req));
    const { word1, word2 } = body;
    if (!pendingPhrase || !pendingConfirmIndices) {
        json(res, { error: "Generate a phrase first (POST /api/generate-phrase)" }, 400);
        return;
    }
    // Verify confirmation words
    const expected1 = pendingPhrase[pendingConfirmIndices[0]].toLowerCase();
    const expected2 = pendingPhrase[pendingConfirmIndices[1]].toLowerCase();
    if (!word1 || !word2 ||
        word1.toLowerCase() !== expected1 ||
        word2.toLowerCase() !== expected2) {
        json(res, { error: `Wrong words. Expected "${expected1}" and "${expected2}".` }, 400);
        return;
    }
    const passphrase = phraseToString(pendingPhrase);
    pendingPhrase = null;
    pendingConfirmIndices = null;
    // Create directories
    mkdirSync(DEMO_DIR, { recursive: true });
    mkdirSync(join(DEMO_DIR, "shards"), { recursive: true });
    // Generate salt and derive key
    const salt = generateSalt();
    writeFileSync(join(DEMO_DIR, "salt"), Buffer.from(salt));
    savedPassphrase = passphrase;
    // Derive deterministic identity from passphrase
    const keypair = deriveKeypairFromPhrase(passphrase);
    identityPrivateKey = keypair.privateKey;
    walletAddress = keypair.address;
    const t0 = performance.now();
    encryptionKey = deriveKey(passphrase, salt);
    const derivationMs = Math.round(performance.now() - t0);
    // Encrypt and save private key
    const encryptedPrivateKey = encrypt(keypair.privateKey, encryptionKey);
    writeFileSync(join(DEMO_DIR, "identity.enc"), encryptedPrivateKey);
    // Create database
    db = openDatabase(getDbPath());
    setMeta(db, "current_version", "0");
    setMeta(db, "created", new Date().toISOString());
    setMeta(db, "wallet_address", keypair.address);
    json(res, {
        wallet: keypair.address,
        derivationMs,
        keyBits: encryptionKey.length * 8,
        saltHex: Buffer.from(salt).toString("hex"),
        demoDir: DEMO_DIR,
    });
}
function handleGetFacts(_req, res) {
    if (!db) {
        json(res, { error: "Not initialized" }, 400);
        return;
    }
    const facts = getAllFacts(db);
    const dirty = getDirtyFacts(db);
    const dirtyKeys = new Set(dirty.map((f) => f.key));
    const currentVersion = parseInt(getMeta(db, "current_version") ?? "0", 10);
    const lastPushedVersion = parseInt(getMeta(db, "last_pushed_version") ?? "0", 10);
    const allPushed = currentVersion > 0 && currentVersion <= lastPushedVersion;
    // Three states: dirty (not sharded), sharded (local only), synced (on Arweave)
    json(res, {
        facts: facts.map((f) => ({
            ...f,
            status: dirtyKeys.has(f.key) ? "dirty" : allPushed ? "synced" : "sharded",
        })),
    });
}
async function handleStore(req, res) {
    if (!db) {
        json(res, { error: "Not initialized" }, 400);
        return;
    }
    const body = JSON.parse(await readBody(req));
    const { key, value, scope, tags } = body;
    if (!key || !value) {
        json(res, { error: "key and value are required" }, 400);
        return;
    }
    const factScope = scope || "global";
    const fullKey = key.startsWith("global:") || key.startsWith("project:")
        ? key
        : `${factScope}:${key}`;
    const now = new Date().toISOString();
    const fact = {
        id: uuidv4(),
        scope: factScope,
        key: fullKey,
        value,
        tags: tags || [],
        confidence: 1.0,
        source_session: null,
        created: now,
        last_confirmed: now,
        access_count: 0,
    };
    upsertFact(db, fact);
    json(res, { fact: { ...fact, dirty: true } });
}
async function handleShard(_req, res) {
    if (!db || !encryptionKey) {
        json(res, { error: "Not initialized" }, 400);
        return;
    }
    const dirtyFacts = getDirtyFacts(db);
    const pendingDeletes = getPendingDeletes(db);
    if (dirtyFacts.length === 0 && pendingDeletes.length === 0) {
        json(res, { error: "No dirty facts to shard" }, 400);
        return;
    }
    const operations = [
        ...dirtyFacts.map(factToUpsertOp),
        ...pendingDeletes.map((key) => ({ op: "delete", key })),
    ];
    const currentVersion = parseInt(getMeta(db, "current_version") ?? "0", 10);
    const startVersion = currentVersion + 1;
    const sessionId = uuidv4();
    const shards = createChunkedShards(operations, startVersion, sessionId);
    lastShards = [];
    let lastVersion = currentVersion;
    for (const shard of shards) {
        const serialized = serializeShard(shard);
        const encrypted = encrypt(serialized, encryptionKey);
        const filename = `shard_${String(shard.shard_version).padStart(6, "0")}.enc`;
        writeFileSync(join(getShardsDir(), filename), encrypted);
        lastShards.push({
            version: shard.shard_version,
            shardJson: JSON.stringify(shard, null, 2),
            encryptedHex: Buffer.from(encrypted).toString("hex"),
            sizeBytes: encrypted.length,
            filename,
        });
        lastVersion = shard.shard_version;
    }
    clearDirtyState(db);
    setMeta(db, "current_version", String(lastVersion));
    json(res, {
        shardCount: shards.length,
        shards: lastShards,
        totalBytes: lastShards.reduce((sum, s) => sum + s.sizeBytes, 0),
        underFreeLimit: lastShards.every((s) => s.sizeBytes < 92_160),
    });
}
async function handlePush(_req, res) {
    if (!db || !encryptionKey || !identityPrivateKey || !walletAddress) {
        json(res, { error: "Not initialized" }, 400);
        return;
    }
    const backend = new TurboBackend({
        privateKeyHex: Buffer.from(identityPrivateKey).toString("hex"),
        testnet: false, // mainnet — free for <100 KiB
    });
    const transactions = [];
    // Push identity if not yet pushed
    const identityPushed = getMeta(db, "identity_pushed");
    if (!identityPushed) {
        const salt = new Uint8Array(readFileSync(join(DEMO_DIR, "salt")));
        const encryptedPK = new Uint8Array(readFileSync(join(DEMO_DIR, "identity.enc")));
        const txId = await pushIdentity(salt, encryptedPK, walletAddress, identityPrivateKey, backend);
        setMeta(db, "identity_pushed", txId);
        transactions.push({
            version: -1,
            txId,
            arweaveUrl: `https://arweave.net/${txId}`,
            sizeBytes: encryptedPK.length,
            tags: [
                { name: "App-Name", value: "sharme" },
                { name: "Type", value: "identity" },
                { name: "Wallet", value: walletAddress },
            ],
        });
    }
    // Push all unpushed shard files
    const shardsDir = getShardsDir();
    const files = readdirSync(shardsDir).filter((f) => f.endsWith(".enc")).sort();
    const lastPushedVersion = parseInt(getMeta(db, "last_pushed_version") ?? "0", 10);
    const unpushed = files.filter((f) => {
        const v = parseInt(f.replace("shard_", "").replace(".enc", ""), 10);
        return v > lastPushedVersion;
    });
    for (const file of unpushed) {
        const versionStr = file.replace("shard_", "").replace(".enc", "");
        const version = parseInt(versionStr, 10);
        const encrypted = new Uint8Array(readFileSync(join(shardsDir, file)));
        const txId = await pushShard(encrypted, version, "delta", walletAddress, identityPrivateKey, backend);
        setMeta(db, "last_pushed_version", String(version));
        transactions.push({
            version,
            txId,
            arweaveUrl: `https://arweave.net/${txId}`,
            sizeBytes: encrypted.length,
            tags: [
                { name: "App-Name", value: "sharme" },
                { name: "Type", value: "delta" },
                { name: "Version", value: String(version) },
                { name: "Wallet", value: walletAddress },
            ],
        });
    }
    if (transactions.length === 0) {
        json(res, { error: "Nothing to push. Create shards first." }, 400);
        return;
    }
    // Track pushed TX IDs for reconstruction
    for (const tx of transactions) {
        pushedTransactions.push({
            txId: tx.txId,
            type: tx.version === -1 ? "identity" : "delta",
            version: tx.version,
        });
    }
    json(res, { transactions, wallet: walletAddress });
}
function handleWipe(_req, res) {
    if (!db) {
        json(res, { error: "Not initialized" }, 400);
        return;
    }
    // Close and delete the database + local shard files
    db.close();
    db = null;
    encryptionKey = null;
    identityPrivateKey = null;
    // Wipe the data directory but keep the demo dir itself
    if (existsSync(DEMO_DIR)) {
        rmSync(DEMO_DIR, { recursive: true, force: true });
    }
    // Keep wallet address, passphrase, and pushed TX IDs — that's all you'd have on a new device
    json(res, {
        ok: true,
        message: "Local state wiped. Only wallet address and TX IDs remain (simulating a new device).",
        wallet: walletAddress,
        txCount: pushedTransactions.length,
    });
}
async function handleReconstruct(req, res) {
    if (pushedTransactions.length === 0 || !walletAddress || !savedPassphrase) {
        json(res, { error: "No pushed transactions to reconstruct from. Complete steps 1-4 first." }, 400);
        return;
    }
    const steps = [];
    // Step 1: Find the identity TX to get the salt
    const identityTx = pushedTransactions.find((t) => t.type === "identity");
    if (!identityTx) {
        json(res, { error: "No identity transaction found." }, 400);
        return;
    }
    steps.push({ step: "download_identity", detail: `Downloading identity from Arweave: ${identityTx.txId}` });
    const encryptedIdentity = await downloadShard(identityTx.txId);
    steps.push({ step: "identity_downloaded", detail: `Got ${encryptedIdentity.length} bytes of encrypted identity` });
    // We need the salt — in a real flow we'd get it from the identity TX tags via GraphQL.
    // For the demo, we fetch the TX tags directly from the Arweave gateway.
    const tagRes = await fetch(`https://arweave.net/graphql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            query: `query { transactions(ids: ["${identityTx.txId}"]) { edges { node { tags { name value } } } } }`,
        }),
    });
    const tagJson = (await tagRes.json());
    let saltHex = null;
    const edge = tagJson.data?.transactions?.edges?.[0];
    if (edge) {
        const tagMap = new Map(edge.node.tags.map((t) => [t.name, t.value]));
        saltHex = tagMap.get("Salt") ?? null;
    }
    if (!saltHex) {
        // GraphQL may not have indexed yet — fall back to using saved passphrase + known salt
        // In a real scenario you'd wait for indexing. For the demo, we re-derive from memory.
        steps.push({ step: "salt_fallback", detail: "GraphQL not indexed yet — using passphrase from memory to re-derive key" });
    }
    else {
        steps.push({ step: "salt_found", detail: `Salt recovered from Arweave tags: ${saltHex}` });
    }
    // Step 2: Derive encryption key
    const t0 = performance.now();
    let key;
    if (saltHex) {
        const salt = new Uint8Array(Buffer.from(saltHex, "hex"));
        key = deriveKey(savedPassphrase, salt);
    }
    else {
        // Fallback: re-derive using same passphrase (won't match without correct salt)
        // This path only hits if GraphQL hasn't indexed. We use the passphrase to show the flow.
        const salt = generateSalt(); // placeholder — won't decrypt correctly
        key = deriveKey(savedPassphrase, salt);
    }
    const derivationMs = Math.round(performance.now() - t0);
    steps.push({ step: "key_derived", detail: `Argon2id key derivation: ${derivationMs}ms` });
    // Step 3: Derive identity from passphrase (deterministic — no need to decrypt identity TX)
    const recoveredKeypair = deriveKeypairFromPhrase(savedPassphrase);
    identityPrivateKey = recoveredKeypair.privateKey;
    steps.push({
        step: "identity_derived",
        detail: `Identity derived from phrase → wallet: ${recoveredKeypair.address}`,
    });
    // Also verify the encrypted identity TX decrypts correctly (validates passphrase + salt)
    try {
        const decryptedPrivateKey = decrypt(encryptedIdentity, key);
        steps.push({ step: "identity_verified", detail: `Encrypted identity TX decrypted and verified: ${decryptedPrivateKey.length} bytes` });
    }
    catch {
        steps.push({ step: "identity_verify_warning", detail: "Could not decrypt identity TX — salt may not be indexed yet. Proceeding with derived identity." });
    }
    // Step 4: Download and decrypt each data shard
    const dataShards = pushedTransactions.filter((t) => t.type === "delta").sort((a, b) => a.version - b.version);
    const decryptedShards = [];
    for (const shardTx of dataShards) {
        steps.push({ step: "download_shard", detail: `Downloading shard v${shardTx.version}: ${shardTx.txId}` });
        const encryptedBlob = await downloadShard(shardTx.txId);
        steps.push({ step: "shard_downloaded", detail: `Got ${encryptedBlob.length} encrypted bytes` });
        const decryptedBytes = decrypt(encryptedBlob, key);
        const shard = deserializeShard(decryptedBytes);
        steps.push({
            step: "shard_decrypted",
            detail: `Decrypted shard v${shard.shard_version}: ${shard.operations.length} operations`,
            data: shard,
        });
        decryptedShards.push({ version: shard.shard_version, shardJson: JSON.stringify(shard, null, 2) });
    }
    // Step 5: Replay all shards to reconstruct facts
    const allShards = decryptedShards.map((s) => deserializeShard(new TextEncoder().encode(s.shardJson)));
    allShards.sort((a, b) => a.shard_version - b.shard_version);
    const reconstructedFacts = replayShards(allShards);
    steps.push({
        step: "replay_complete",
        detail: `Replayed ${allShards.length} shard(s) → ${reconstructedFacts.length} fact(s) reconstructed`,
    });
    // Step 6: Write to fresh local DB
    mkdirSync(DEMO_DIR, { recursive: true });
    mkdirSync(join(DEMO_DIR, "shards"), { recursive: true });
    db = openDatabase(getDbPath());
    encryptionKey = key;
    for (const fact of reconstructedFacts) {
        upsertFact(db, fact);
    }
    const maxVersion = dataShards.length > 0 ? Math.max(...dataShards.map((s) => s.version)) : 0;
    setMeta(db, "current_version", String(maxVersion));
    setMeta(db, "last_pushed_version", String(maxVersion));
    setMeta(db, "wallet_address", walletAddress);
    clearDirtyState(db);
    steps.push({ step: "db_restored", detail: `Local database restored with ${reconstructedFacts.length} facts` });
    json(res, {
        steps,
        facts: reconstructedFacts,
        shards: decryptedShards,
        factCount: reconstructedFacts.length,
    });
}
function handleReset(_req, res) {
    if (db) {
        db.close();
        db = null;
    }
    encryptionKey = null;
    identityPrivateKey = null;
    walletAddress = null;
    savedPassphrase = null;
    lastShards = [];
    pushedTransactions = [];
    if (existsSync(DEMO_DIR)) {
        rmSync(DEMO_DIR, { recursive: true, force: true });
    }
    json(res, { ok: true, message: "Demo state wiped." });
}
// ── Static file serving ───────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
function serveStatic(res, filepath, contentType) {
    // In dist, the HTML file is at dist/demo/public/index.html
    // but we want to read from src/demo/public/index.html (the original)
    // Actually after tsc, we serve from the same relative path.
    // Let's look for the file relative to __dirname (dist/demo/)
    const fullPath = join(__dirname, filepath);
    if (!existsSync(fullPath)) {
        res.writeHead(404);
        res.end("Not found");
        return;
    }
    const data = readFileSync(fullPath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
}
// ── Route dispatch ────────────────────────────────────────
const server = createServer(async (req, res) => {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";
    // CORS preflight
    if (method === "OPTIONS") {
        cors(res);
        return;
    }
    try {
        if (url === "/" || url === "/index.html") {
            serveStatic(res, "public/index.html", "text/html");
        }
        else if (url === "/api/status" && method === "GET") {
            handleStatus(req, res);
        }
        else if (url === "/api/generate-phrase" && method === "POST") {
            handleGeneratePhrase(req, res);
        }
        else if (url === "/api/init" && method === "POST") {
            await handleInit(req, res);
        }
        else if (url === "/api/facts" && method === "GET") {
            handleGetFacts(req, res);
        }
        else if (url === "/api/store" && method === "POST") {
            await handleStore(req, res);
        }
        else if (url === "/api/shard" && method === "POST") {
            await handleShard(req, res);
        }
        else if (url === "/api/push" && method === "POST") {
            await handlePush(req, res);
        }
        else if (url === "/api/wipe" && method === "POST") {
            handleWipe(req, res);
        }
        else if (url === "/api/reconstruct" && method === "POST") {
            await handleReconstruct(req, res);
        }
        else if (url === "/api/reset" && method === "POST") {
            handleReset(req, res);
        }
        else {
            res.writeHead(404);
            res.end("Not found");
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`API error: ${message}`);
        json(res, { error: message }, 500);
    }
});
const PORT = parseInt(process.env.PORT ?? "3000", 10);
server.listen(PORT, () => {
    console.log(`\n  Sharme Demo Server`);
    console.log(`  ──────────────────`);
    console.log(`  http://localhost:${PORT}`);
    console.log(`  Data dir: ${DEMO_DIR}\n`);
});
//# sourceMappingURL=server.js.map