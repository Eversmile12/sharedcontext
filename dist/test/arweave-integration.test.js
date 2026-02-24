/**
 * Integration test: actually uploads to Arweave via Turbo testnet,
 * then queries and downloads it back.
 *
 * Requires: SHAREDCONTEXT_TEST_PRIVATE_KEY env var (hex, 0x-prefixed secp256k1 key)
 * with Base Sepolia ETH funded on Turbo.
 *
 * Run: SHAREDCONTEXT_TEST_PRIVATE_KEY=0x... node --test dist/test/arweave-integration.test.js
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { signShard, verifySignature, publicKeyFromPrivate, addressFromPublicKey } from "../core/identity.js";
import { encrypt, decrypt, deriveKey, generateSalt } from "../core/crypto.js";
import { createShard, serializeShard, deserializeShard, replayShards } from "../core/shard.js";
import { buildShardTags } from "../core/sync.js";
import { TurboBackend } from "../core/backends/turbo.js";
import { queryShards, downloadShard } from "../core/arweave.js";
const TEST_KEY = process.env.SHAREDCONTEXT_TEST_PRIVATE_KEY;
// Skip the entire suite if no key is provided
const run = TEST_KEY ? describe : describe.skip;
run("arweave integration (testnet)", () => {
    let backend;
    let walletAddress;
    let privateKeyBytes;
    let encryptionKey;
    let uploadedTxId;
    let uploadedEncrypted;
    before(() => {
        privateKeyBytes = Buffer.from(TEST_KEY.replace("0x", ""), "hex");
        const pubKey = publicKeyFromPrivate(privateKeyBytes);
        walletAddress = addressFromPublicKey(pubKey);
        backend = new TurboBackend({
            privateKeyHex: TEST_KEY,
            testnet: true,
        });
        const salt = generateSalt();
        encryptionKey = deriveKey("integration-test", salt);
        console.log(`  Wallet: ${walletAddress}`);
    });
    it("can check balance on testnet", async () => {
        const balance = await backend.getBalance();
        console.log(`  Balance: ${balance.balance}`);
        assert.ok(typeof balance.balance === "string");
        assert.ok(typeof balance.estimatedUploads === "number");
    });
    it("can upload an encrypted shard to Arweave", async () => {
        // Create a real shard
        const ops = [
            {
                op: "upsert",
                key: "integration:test",
                value: "This fact was uploaded to Arweave from a test",
                tags: ["test", "integration"],
                scope: "global",
            },
        ];
        const shard = createShard(ops, 1, "integration-session");
        const serialized = serializeShard(shard);
        // Encrypt
        const encrypted = encrypt(serialized, encryptionKey);
        uploadedEncrypted = encrypted;
        // Sign
        const signature = signShard(encrypted, privateKeyBytes);
        const tags = buildShardTags(walletAddress, 1, "delta", signature);
        // Upload for real
        console.log(`  Uploading ${encrypted.length} bytes...`);
        const result = await backend.upload(encrypted, tags);
        uploadedTxId = result.txId;
        console.log(`  Tx ID: ${uploadedTxId}`);
        assert.ok(uploadedTxId);
        assert.ok(uploadedTxId.length > 10);
    });
    it("can download the shard back from Arweave", async () => {
        assert.ok(uploadedTxId, "No tx ID from previous test");
        // Arweave needs a moment to index the transaction
        console.log("  Waiting 5s for Arweave indexing...");
        await new Promise((r) => setTimeout(r, 5000));
        const downloaded = await downloadShard(uploadedTxId);
        assert.ok(downloaded.length > 0);
        assert.deepEqual(downloaded, uploadedEncrypted);
        console.log(`  Downloaded ${downloaded.length} bytes, matches upload`);
    });
    it("can decrypt and replay the downloaded shard", async () => {
        assert.ok(uploadedTxId, "No tx ID from previous test");
        const downloaded = await downloadShard(uploadedTxId);
        // Verify signature
        // We need to find the signature - re-sign to compare
        const signature = signShard(uploadedEncrypted, privateKeyBytes);
        assert.ok(verifySignature(downloaded, signature, walletAddress));
        // Decrypt
        const decrypted = decrypt(downloaded, encryptionKey);
        const shard = deserializeShard(decrypted);
        assert.equal(shard.shard_version, 1);
        assert.equal(shard.operations.length, 1);
        // Replay
        const facts = replayShards([shard]);
        assert.equal(facts.length, 1);
        assert.equal(facts[0].key, "integration:test");
        assert.equal(facts[0].value, "This fact was uploaded to Arweave from a test");
        console.log("  Full round-trip: create -> encrypt -> upload -> download -> decrypt -> replay OK");
    });
    it("can find shards via GraphQL query", async () => {
        // This might not find the shard immediately if Arweave hasn't indexed it yet
        const shards = await queryShards(walletAddress);
        console.log(`  Found ${shards.length} shard(s) for wallet ${walletAddress}`);
        // We just check it doesn't throw - indexing can be delayed
        assert.ok(Array.isArray(shards));
    });
});
//# sourceMappingURL=arweave-integration.test.js.map