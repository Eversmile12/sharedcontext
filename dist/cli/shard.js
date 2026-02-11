import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { v4 as uuidv4 } from "uuid";
import { openDatabase, getDirtyFacts, getPendingDeletes, clearDirtyState, getMeta, setMeta, } from "../core/db.js";
import { createChunkedShards, serializeShard, factToUpsertOp } from "../core/shard.js";
import { encrypt } from "../core/crypto.js";
import { pushShard } from "../core/sync.js";
import { publicKeyFromPrivate, addressFromPublicKey } from "../core/identity.js";
import { TurboBackend } from "../core/backends/turbo.js";
import { loadKey, loadIdentityPrivateKey, getDbPath, getShardsDir } from "./init.js";
function prompt(question) {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
export async function shardCommand(options = {}) {
    const dbPath = getDbPath();
    const shardsDir = getShardsDir();
    if (!existsSync(dbPath)) {
        console.error("Sharme not initialized. Run `sharme init` first.");
        process.exit(1);
    }
    const db = openDatabase(dbPath);
    // Collect dirty facts (upserts) and pending deletes
    const dirtyFacts = getDirtyFacts(db);
    const pendingDeletes = getPendingDeletes(db);
    if (dirtyFacts.length === 0 && pendingDeletes.length === 0) {
        console.log("Nothing changed since last shard. No shard created.");
        db.close();
        return;
    }
    // Build operations: upserts for dirty facts, deletes for pending
    const operations = [
        ...dirtyFacts.map(factToUpsertOp),
        ...pendingDeletes.map((key) => ({ op: "delete", key })),
    ];
    const currentVersion = parseInt(getMeta(db, "current_version") ?? "0", 10);
    const startVersion = currentVersion + 1;
    const passphrase = process.env.SHARME_PASSPHRASE ?? await prompt("Passphrase: ");
    const key = loadKey(passphrase);
    // Chunk operations into shards that stay under the free upload limit
    const shards = createChunkedShards(operations, startVersion, uuidv4());
    const upsertCount = dirtyFacts.length;
    const deleteCount = pendingDeletes.length;
    // Prepare push dependencies if needed
    let identityKey;
    let walletAddress;
    let backend;
    if (options.push) {
        identityKey = loadIdentityPrivateKey(key);
        const pubKey = publicKeyFromPrivate(identityKey);
        walletAddress = addressFromPublicKey(pubKey);
        backend = new TurboBackend({
            privateKeyHex: Buffer.from(identityKey).toString("hex"),
            testnet: options.testnet,
        });
    }
    let lastVersion = currentVersion;
    for (const shard of shards) {
        const serialized = serializeShard(shard);
        const encrypted = encrypt(serialized, key);
        const filename = `shard_${String(shard.shard_version).padStart(6, "0")}.enc`;
        const filepath = join(shardsDir, filename);
        writeFileSync(filepath, encrypted);
        console.log(`Shard created: ${filename}`);
        console.log(`  Version:  ${shard.shard_version}`);
        console.log(`  Ops:      ${shard.operations.length} (${upsertCount} upserts, ${deleteCount} deletes total)`);
        console.log(`  Size:     ${encrypted.length} bytes (encrypted)`);
        console.log(`  Path:     ${filepath}`);
        if (options.push && identityKey && walletAddress && backend) {
            console.log("  Uploading to Arweave...");
            const txId = await pushShard(encrypted, shard.shard_version, "delta", walletAddress, identityKey, backend);
            console.log(`  Tx ID:    ${txId}`);
            console.log(`  View:     https://arweave.net/${txId}`);
        }
        lastVersion = shard.shard_version;
    }
    // Clear dirty state and update version
    clearDirtyState(db);
    setMeta(db, "current_version", String(lastVersion));
    if (shards.length > 1) {
        console.log(`\n${shards.length} shards created (operations chunked to stay under free upload limit).`);
    }
    db.close();
}
//# sourceMappingURL=shard.js.map