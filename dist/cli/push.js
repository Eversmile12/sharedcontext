import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { openDatabase, getMeta } from "../core/db.js";
import { pushShard, pushIdentity } from "../core/sync.js";
import { publicKeyFromPrivate, addressFromPublicKey } from "../core/identity.js";
import { TurboBackend } from "../core/backends/turbo.js";
import { loadKey, loadIdentityPrivateKey, getDbPath, getShardsDir, getSaltPath } from "./init.js";
function prompt(question) {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}
/**
 * Push all local shards to Arweave, plus the identity transaction if not already pushed.
 */
export async function pushCommand(options = {}) {
    const dbPath = getDbPath();
    const shardsDir = getShardsDir();
    const saltPath = getSaltPath();
    if (!existsSync(dbPath)) {
        console.error("Sharme not initialized. Run `sharme init` first.");
        process.exit(1);
    }
    const passphrase = process.env.SHARME_PASSPHRASE ?? await prompt("Passphrase: ");
    const key = loadKey(passphrase);
    const identityKey = loadIdentityPrivateKey(key);
    const pubKey = publicKeyFromPrivate(identityKey);
    const walletAddress = addressFromPublicKey(pubKey);
    const backend = new TurboBackend({
        privateKeyHex: Buffer.from(identityKey).toString("hex"),
        testnet: options.testnet,
    });
    const db = openDatabase(dbPath);
    // Check if identity has been pushed
    const identityPushed = getMeta(db, "identity_pushed");
    if (!identityPushed) {
        console.log("Uploading identity transaction...");
        const salt = new Uint8Array(readFileSync(saltPath));
        const encryptedPrivateKey = new Uint8Array(readFileSync(join(getShardsDir(), "..", "identity.enc")));
        const txId = await pushIdentity(salt, encryptedPrivateKey, walletAddress, identityKey, backend);
        console.log(`  Identity Tx: ${txId}`);
        const { setMeta: setM } = await import("../core/db.js");
        setM(db, "identity_pushed", txId);
    }
    // Push all local shard files
    const files = readdirSync(shardsDir)
        .filter((f) => f.endsWith(".enc"))
        .sort();
    if (files.length === 0) {
        console.log("No local shards to push.");
        db.close();
        return;
    }
    // Check which shards have already been pushed
    const lastPushedVersion = parseInt(getMeta(db, "last_pushed_version") ?? "0", 10);
    const unpushed = files.filter((f) => {
        const versionStr = f.replace("shard_", "").replace(".enc", "");
        return parseInt(versionStr, 10) > lastPushedVersion;
    });
    if (unpushed.length === 0) {
        console.log("All shards already pushed to Arweave.");
        db.close();
        return;
    }
    console.log(`\nPushing ${unpushed.length} shard(s) to Arweave...`);
    console.log(`  Wallet: ${walletAddress}`);
    console.log(`  Mode:   ${options.testnet ? "testnet" : "mainnet"}\n`);
    for (const file of unpushed) {
        const versionStr = file.replace("shard_", "").replace(".enc", "");
        const version = parseInt(versionStr, 10);
        const encrypted = new Uint8Array(readFileSync(join(shardsDir, file)));
        const txId = await pushShard(encrypted, version, "delta", walletAddress, identityKey, backend);
        console.log(`  v${version}: ${txId}`);
        const { setMeta: setM } = await import("../core/db.js");
        setM(db, "last_pushed_version", String(version));
    }
    console.log("\nAll shards pushed.");
    db.close();
}
//# sourceMappingURL=push.js.map