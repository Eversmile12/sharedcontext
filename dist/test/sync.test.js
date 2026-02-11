import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildShardTags } from "../core/sync.js";
import { signShard, verifySignature, generateKeypair } from "../core/identity.js";
import { encrypt, decrypt, deriveKey, generateSalt } from "../core/crypto.js";
import { createShard, serializeShard, deserializeShard, replayShards } from "../core/shard.js";
describe("sync", () => {
    describe("buildShardTags", () => {
        it("builds correct tag set", () => {
            const tags = buildShardTags("0xABC", 42, "delta", "0xSIG");
            const tagMap = new Map(tags.map((t) => [t.name, t.value]));
            assert.equal(tagMap.get("App-Name"), "sharme");
            assert.equal(tagMap.get("Wallet"), "0xABC");
            assert.equal(tagMap.get("Version"), "42");
            assert.equal(tagMap.get("Type"), "delta");
            assert.equal(tagMap.get("Signature"), "0xSIG");
            assert.equal(tagMap.get("Content-Type"), "application/octet-stream");
            assert.ok(tagMap.has("Timestamp"));
        });
        it("snapshot type works", () => {
            const tags = buildShardTags("0x123", 1, "snapshot", "0xS");
            const tagMap = new Map(tags.map((t) => [t.name, t.value]));
            assert.equal(tagMap.get("Type"), "snapshot");
        });
    });
    describe("end-to-end: encrypt -> sign -> verify -> decrypt -> replay", () => {
        it("round-trips a shard", () => {
            const kp = generateKeypair();
            const salt = generateSalt();
            const key = deriveKey("test-passphrase", salt);
            // 1. Create a shard
            const ops = [
                { op: "upsert", key: "test:key", value: "hello arweave", tags: ["test"], scope: "global" },
            ];
            const shard = createShard(ops, 1, "session-1");
            const serialized = serializeShard(shard);
            // 2. Encrypt
            const encrypted = encrypt(serialized, key);
            // 3. Sign
            const signature = signShard(encrypted, kp.privateKey);
            // 4. Build tags and verify
            const tags = buildShardTags(kp.address, 1, "delta", signature);
            const sigTag = tags.find((t) => t.name === "Signature").value;
            const walletTag = tags.find((t) => t.name === "Wallet").value;
            assert.ok(verifySignature(encrypted, sigTag, walletTag));
            // 5. Decrypt
            const decrypted = decrypt(encrypted, key);
            // 6. Deserialize and replay
            const recoveredShard = deserializeShard(decrypted);
            const facts = replayShards([recoveredShard]);
            assert.equal(facts.length, 1);
            assert.equal(facts[0].key, "test:key");
            assert.equal(facts[0].value, "hello arweave");
        });
        it("multiple shards replay correctly after round-trip", () => {
            const kp = generateKeypair();
            const salt = generateSalt();
            const key = deriveKey("test-pass", salt);
            // Shard 1: create two facts
            const shard1 = createShard([
                { op: "upsert", key: "a", value: "1", tags: [], scope: "global" },
                { op: "upsert", key: "b", value: "2", tags: [], scope: "global" },
            ], 1, "s1");
            const enc1 = encrypt(serializeShard(shard1), key);
            const sig1 = signShard(enc1, kp.privateKey);
            const tags1 = buildShardTags(kp.address, 1, "delta", sig1);
            assert.ok(verifySignature(enc1, tags1.find((t) => t.name === "Signature").value, kp.address));
            // Shard 2: update a, delete b, add c
            const shard2 = createShard([
                { op: "upsert", key: "a", value: "1-updated", tags: [], scope: "global" },
                { op: "delete", key: "b" },
                { op: "upsert", key: "c", value: "3", tags: [], scope: "global" },
            ], 2, "s2");
            const enc2 = encrypt(serializeShard(shard2), key);
            const sig2 = signShard(enc2, kp.privateKey);
            const tags2 = buildShardTags(kp.address, 2, "delta", sig2);
            assert.ok(verifySignature(enc2, tags2.find((t) => t.name === "Signature").value, kp.address));
            const shards = [deserializeShard(decrypt(enc1, key)), deserializeShard(decrypt(enc2, key))];
            shards.sort((a, b) => a.shard_version - b.shard_version);
            const facts = replayShards(shards);
            const byKey = Object.fromEntries(facts.map((f) => [f.key, f.value]));
            assert.deepEqual(byKey, { a: "1-updated", c: "3" });
        });
        it("rejects tampered shard via signature", () => {
            const kp = generateKeypair();
            const salt = generateSalt();
            const key = deriveKey("pass", salt);
            const shard = createShard([{ op: "upsert", key: "x", value: "y" }], 1, "s1");
            const encrypted = encrypt(serializeShard(shard), key);
            const signature = signShard(encrypted, kp.privateKey);
            const tags = buildShardTags(kp.address, 1, "delta", signature);
            // Tamper with data after signing
            const tampered = new Uint8Array(encrypted);
            tampered[20] ^= 0xff;
            const sigTag = tags.find((t) => t.name === "Signature").value;
            const walletTag = tags.find((t) => t.name === "Wallet").value;
            // Signature verification should fail
            assert.ok(!verifySignature(tampered, sigTag, walletTag));
        });
    });
});
//# sourceMappingURL=sync.test.js.map