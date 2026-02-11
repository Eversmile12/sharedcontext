import type { Fact, Shard, ShardOperation } from "../types.js";
/**
 * Max encrypted shard size in bytes.
 * Turbo gives free uploads under 100 KiB (102,400 bytes).
 * We cap at 90 KiB to leave a comfortable margin.
 */
export declare const MAX_SHARD_BYTES: number;
/**
 * Create a shard from a list of operations.
 */
export declare function createShard(operations: ShardOperation[], version: number, sessionId: string): Shard;
/**
 * Split operations into chunks that each produce a shard under maxEncryptedBytes.
 * Returns an array of Shards with consecutive version numbers starting at `startVersion`.
 *
 * If all operations fit in one shard, returns a single-element array.
 */
export declare function createChunkedShards(operations: ShardOperation[], startVersion: number, sessionId: string, maxEncryptedBytes?: number): Shard[];
/**
 * Serialize a shard to bytes (UTF-8 JSON).
 */
export declare function serializeShard(shard: Shard): Uint8Array;
/**
 * Deserialize bytes back to a shard.
 */
export declare function deserializeShard(data: Uint8Array): Shard;
/**
 * Replay an ordered list of shards to produce the current state.
 * Later shards override earlier ones for the same key.
 * Delete operations remove a key entirely.
 */
export declare function replayShards(shards: Shard[]): Fact[];
/**
 * Build a ShardOperation from a Fact (for creating shards from local state).
 */
export declare function factToUpsertOp(fact: Fact): ShardOperation;
//# sourceMappingURL=shard.d.ts.map