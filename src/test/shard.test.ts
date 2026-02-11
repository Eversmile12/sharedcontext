import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createShard,
  createChunkedShards,
  serializeShard,
  deserializeShard,
  replayShards,
  factToUpsertOp,
  MAX_SHARD_BYTES,
} from "../core/shard.js";
import { encrypt } from "../core/crypto.js";
import type { Fact, Shard, ShardOperation } from "../types.js";

function makeFact(overrides: Partial<Fact> = {}): Fact {
  return {
    id: "fact-1",
    scope: "global",
    key: "test:key",
    value: "test value",
    tags: ["a", "b"],
    confidence: 1.0,
    source_session: null,
    created: "2026-01-01T00:00:00.000Z",
    last_confirmed: "2026-01-01T00:00:00.000Z",
    access_count: 5,
    ...overrides,
  };
}

describe("shard", () => {
  describe("createShard", () => {
    it("builds a shard with correct fields", () => {
      const ops: ShardOperation[] = [
        { op: "upsert", key: "k1", value: "v1", tags: ["t1"] },
      ];
      const shard = createShard(ops, 1, "session-abc");
      assert.equal(shard.shard_version, 1);
      assert.equal(shard.session_id, "session-abc");
      assert.equal(shard.operations.length, 1);
      assert.ok(shard.timestamp); // ISO string
    });
  });

  describe("serialize / deserialize", () => {
    it("round-trips a shard", () => {
      const ops: ShardOperation[] = [
        { op: "upsert", key: "k1", value: "v1", tags: ["t"], scope: "global" },
        { op: "delete", key: "k2" },
      ];
      const shard = createShard(ops, 3, "sess-1");
      const bytes = serializeShard(shard);
      const restored = deserializeShard(bytes);

      assert.equal(restored.shard_version, 3);
      assert.equal(restored.session_id, "sess-1");
      assert.equal(restored.operations.length, 2);
      assert.equal(restored.operations[0].op, "upsert");
      assert.equal(restored.operations[0].value, "v1");
      assert.equal(restored.operations[1].op, "delete");
      assert.equal(restored.operations[1].key, "k2");
    });
  });

  describe("factToUpsertOp", () => {
    it("converts a fact to an upsert operation", () => {
      const fact = makeFact({ key: "my:key", value: "val", tags: ["x"], scope: "project:p" });
      const op = factToUpsertOp(fact);
      assert.equal(op.op, "upsert");
      assert.equal(op.key, "my:key");
      assert.equal(op.value, "val");
      assert.deepEqual(op.tags, ["x"]);
      assert.equal(op.scope, "project:p");
      assert.equal(op.fact_id, fact.id);
    });
  });

  describe("replayShards", () => {
    it("replays a single upsert", () => {
      const shard: Shard = {
        shard_version: 1,
        timestamp: "2026-01-01T00:00:00Z",
        session_id: "s1",
        operations: [
          { op: "upsert", key: "k1", value: "v1", tags: ["t1"], scope: "global", confidence: 0.9 },
        ],
      };
      const facts = replayShards([shard]);
      assert.equal(facts.length, 1);
      assert.equal(facts[0].key, "k1");
      assert.equal(facts[0].value, "v1");
      assert.equal(facts[0].confidence, 0.9);
      assert.equal(facts[0].scope, "global");
    });

    it("later upsert overwrites earlier for same key", () => {
      const shard1: Shard = {
        shard_version: 1,
        timestamp: "2026-01-01T00:00:00Z",
        session_id: "s1",
        operations: [{ op: "upsert", key: "k1", value: "original" }],
      };
      const shard2: Shard = {
        shard_version: 2,
        timestamp: "2026-01-02T00:00:00Z",
        session_id: "s2",
        operations: [{ op: "upsert", key: "k1", value: "updated" }],
      };
      const facts = replayShards([shard1, shard2]);
      assert.equal(facts.length, 1);
      assert.equal(facts[0].value, "updated");
      assert.equal(facts[0].source_session, "s2");
    });

    it("preserves created timestamp from first upsert", () => {
      const shard1: Shard = {
        shard_version: 1,
        timestamp: "2026-01-01T00:00:00Z",
        session_id: "s1",
        operations: [{ op: "upsert", key: "k1", value: "v1" }],
      };
      const shard2: Shard = {
        shard_version: 2,
        timestamp: "2026-02-01T00:00:00Z",
        session_id: "s2",
        operations: [{ op: "upsert", key: "k1", value: "v2" }],
      };
      const facts = replayShards([shard1, shard2]);
      assert.equal(facts[0].created, "2026-01-01T00:00:00Z");
      assert.equal(facts[0].last_confirmed, "2026-02-01T00:00:00Z");
    });

    it("delete removes a key", () => {
      const shard: Shard = {
        shard_version: 1,
        timestamp: "2026-01-01T00:00:00Z",
        session_id: "s1",
        operations: [
          { op: "upsert", key: "k1", value: "v1" },
          { op: "upsert", key: "k2", value: "v2" },
          { op: "delete", key: "k1" },
        ],
      };
      const facts = replayShards([shard]);
      assert.equal(facts.length, 1);
      assert.equal(facts[0].key, "k2");
    });

    it("delete then re-upsert brings key back", () => {
      const shard1: Shard = {
        shard_version: 1,
        timestamp: "2026-01-01T00:00:00Z",
        session_id: "s1",
        operations: [{ op: "upsert", key: "k1", value: "v1" }],
      };
      const shard2: Shard = {
        shard_version: 2,
        timestamp: "2026-01-02T00:00:00Z",
        session_id: "s2",
        operations: [{ op: "delete", key: "k1" }],
      };
      const shard3: Shard = {
        shard_version: 3,
        timestamp: "2026-01-03T00:00:00Z",
        session_id: "s3",
        operations: [{ op: "upsert", key: "k1", value: "resurrected" }],
      };
      const facts = replayShards([shard1, shard2, shard3]);
      assert.equal(facts.length, 1);
      assert.equal(facts[0].value, "resurrected");
      // created should be fresh since original was deleted
      assert.equal(facts[0].created, "2026-01-03T00:00:00Z");
    });

    it("empty shards produce empty result", () => {
      const facts = replayShards([]);
      assert.deepEqual(facts, []);
    });

    it("multiple keys across multiple shards", () => {
      const shard1: Shard = {
        shard_version: 1,
        timestamp: "2026-01-01T00:00:00Z",
        session_id: "s1",
        operations: [
          { op: "upsert", key: "a", value: "1" },
          { op: "upsert", key: "b", value: "2" },
          { op: "upsert", key: "c", value: "3" },
        ],
      };
      const shard2: Shard = {
        shard_version: 2,
        timestamp: "2026-01-02T00:00:00Z",
        session_id: "s2",
        operations: [
          { op: "delete", key: "b" },
          { op: "upsert", key: "d", value: "4" },
          { op: "upsert", key: "a", value: "1-updated" },
        ],
      };
      const facts = replayShards([shard1, shard2]);
      const byKey = Object.fromEntries(facts.map((f) => [f.key, f.value]));
      assert.deepEqual(byKey, { a: "1-updated", c: "3", d: "4" });
    });
  });

  describe("createChunkedShards", () => {
    it("returns a single shard when operations are small", () => {
      const ops: ShardOperation[] = [
        { op: "upsert", key: "k1", value: "small", tags: ["t"] },
        { op: "upsert", key: "k2", value: "also small", tags: ["t"] },
      ];
      const shards = createChunkedShards(ops, 1, "session-1");
      assert.equal(shards.length, 1);
      assert.equal(shards[0].shard_version, 1);
      assert.equal(shards[0].operations.length, 2);
    });

    it("returns empty array for no operations", () => {
      const shards = createChunkedShards([], 1, "session-1");
      assert.equal(shards.length, 0);
    });

    it("splits into multiple shards when operations exceed maxBytes", () => {
      // Create operations with large values to force chunking
      // Use a tiny limit to make splitting easy to test
      const ops: ShardOperation[] = [];
      for (let i = 0; i < 10; i++) {
        ops.push({
          op: "upsert",
          key: `key:${i}`,
          value: "x".repeat(200),
          tags: ["test"],
          scope: "global",
        });
      }

      // Force a very small limit: 500 bytes encrypted = ~472 bytes JSON
      // Each operation is ~250 bytes, so we should get multiple chunks
      const shards = createChunkedShards(ops, 1, "session-1", 500);
      assert.ok(shards.length > 1, `expected multiple shards, got ${shards.length}`);

      // Versions should be consecutive starting at 1
      for (let i = 0; i < shards.length; i++) {
        assert.equal(shards[i].shard_version, 1 + i);
      }

      // All operations should be present across all shards
      const totalOps = shards.reduce((sum, s) => sum + s.operations.length, 0);
      assert.equal(totalOps, 10);

      // Session ID should be the same across all chunks
      for (const s of shards) {
        assert.equal(s.session_id, "session-1");
      }
    });

    it("each chunk serializes under the byte limit", () => {
      const ops: ShardOperation[] = [];
      for (let i = 0; i < 20; i++) {
        ops.push({
          op: "upsert",
          key: `fact:${i}`,
          value: "a".repeat(300),
          tags: ["bulk", "test"],
          scope: "global",
        });
      }

      const limit = 1000; // 1 KB limit
      const shards = createChunkedShards(ops, 1, "session-1", limit);

      for (const shard of shards) {
        const serialized = serializeShard(shard);
        // Serialized JSON + 28 bytes encryption overhead should be under the limit
        assert.ok(
          serialized.byteLength + 28 <= limit,
          `chunk v${shard.shard_version} is ${serialized.byteLength + 28} bytes, limit is ${limit}`
        );
      }
    });

    it("chunked shards replay to the same result as a single shard", () => {
      const ops: ShardOperation[] = [];
      for (let i = 0; i < 15; i++) {
        ops.push({
          op: "upsert",
          key: `key:${i}`,
          value: `value-${i}`,
          tags: ["test"],
          scope: "global",
          confidence: 0.9,
        });
      }
      // Add some deletes
      ops.push({ op: "delete", key: "key:3" });
      ops.push({ op: "delete", key: "key:7" });

      // Single shard (no limit)
      const single = createChunkedShards(ops, 1, "sess-1", 1_000_000);
      assert.equal(single.length, 1);
      const singleResult = replayShards(single);

      // Chunked (tiny limit)
      const chunked = createChunkedShards(ops, 1, "sess-1", 500);
      assert.ok(chunked.length > 1);
      const chunkedResult = replayShards(chunked);

      // Same keys and values
      const singleMap = new Map(singleResult.map((f) => [f.key, f.value]));
      const chunkedMap = new Map(chunkedResult.map((f) => [f.key, f.value]));
      assert.deepEqual(singleMap, chunkedMap);
    });

    it("uses MAX_SHARD_BYTES as default limit", () => {
      // Just verify the constant is sensible
      assert.ok(MAX_SHARD_BYTES > 0);
      assert.ok(MAX_SHARD_BYTES < 100 * 1024, "must be under 100 KiB free tier");
      assert.equal(MAX_SHARD_BYTES, 90 * 1024);
    });

    it("handles a single operation that is large", () => {
      const ops: ShardOperation[] = [
        {
          op: "upsert",
          key: "big",
          value: "x".repeat(5000),
          tags: ["huge"],
          scope: "global",
        },
      ];
      // Even with a tiny limit, a single op must go in a shard
      const shards = createChunkedShards(ops, 1, "s1", 100);
      assert.equal(shards.length, 1);
      assert.equal(shards[0].operations.length, 1);
    });
  });
});
