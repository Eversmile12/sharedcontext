import { v4 as uuidv4 } from "uuid";
import type { Fact, Shard, ShardOperation } from "../types.js";

/**
 * Max encrypted shard size in bytes.
 * Turbo gives free uploads under 100 KiB (102,400 bytes).
 * We cap at 90 KiB to leave a comfortable margin.
 */
export const MAX_SHARD_BYTES = 90 * 1024; // 90 KiB = 92,160 bytes

/** AES-256-GCM adds 12-byte nonce + 16-byte auth tag */
const ENCRYPTION_OVERHEAD = 28;

/**
 * Create a shard from a list of operations.
 */
export function createShard(
  operations: ShardOperation[],
  version: number,
  sessionId: string
): Shard {
  return {
    shard_version: version,
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    operations,
  };
}

/**
 * Split operations into chunks that each produce a shard under maxEncryptedBytes.
 * Returns an array of Shards with consecutive version numbers starting at `startVersion`.
 *
 * If all operations fit in one shard, returns a single-element array.
 */
export function createChunkedShards(
  operations: ShardOperation[],
  startVersion: number,
  sessionId: string,
  maxEncryptedBytes: number = MAX_SHARD_BYTES
): Shard[] {
  if (operations.length === 0) return [];

  const maxJsonBytes = maxEncryptedBytes - ENCRYPTION_OVERHEAD;
  const chunks = chunkOperationsBySize(operations, maxJsonBytes);

  return chunks.map((ops, i) =>
    createShard(ops, startVersion + i, sessionId)
  );
}

/**
 * Group operations so each group's serialized shard JSON stays under maxJsonBytes.
 * Uses actual byte measurement (TextEncoder) for accuracy.
 */
function chunkOperationsBySize(
  operations: ShardOperation[],
  maxJsonBytes: number
): ShardOperation[][] {
  const encoder = new TextEncoder();
  const chunks: ShardOperation[][] = [];
  let currentOps: ShardOperation[] = [];

  // Measure the cost of the shard wrapper without any operations:
  // {"shard_version":N,"timestamp":"...","session_id":"...","operations":[]}
  // This is roughly ~90-120 bytes depending on values. We use a live measurement.
  const wrapperSize = encoder.encode(
    JSON.stringify({
      shard_version: 999999,
      timestamp: new Date().toISOString(),
      session_id: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      operations: [],
    })
  ).byteLength;

  let currentSize = wrapperSize;

  for (const op of operations) {
    const opJson = JSON.stringify(op);
    // +1 for comma separator between operations in the JSON array
    const opSize = encoder.encode(opJson).byteLength + 1;

    // If adding this op would bust the budget AND we already have ops, flush
    if (currentOps.length > 0 && currentSize + opSize > maxJsonBytes) {
      chunks.push(currentOps);
      currentOps = [];
      currentSize = wrapperSize;
    }

    currentOps.push(op);
    currentSize += opSize;
  }

  if (currentOps.length > 0) {
    chunks.push(currentOps);
  }

  return chunks;
}

/**
 * Serialize a shard to bytes (UTF-8 JSON).
 */
export function serializeShard(shard: Shard): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(shard));
}

/**
 * Deserialize bytes back to a shard.
 */
export function deserializeShard(data: Uint8Array): Shard {
  return JSON.parse(new TextDecoder().decode(data));
}

/**
 * Replay an ordered list of shards to produce the current state.
 * Later shards override earlier ones for the same key.
 * Delete operations remove a key entirely.
 */
export function replayShards(shards: Shard[]): Fact[] {
  const state = new Map<string, Fact>();

  for (const shard of shards) {
    for (const op of shard.operations) {
      if (op.op === "delete") {
        state.delete(op.key);
      } else if (op.op === "upsert") {
        const existing = state.get(op.key);
        state.set(op.key, {
          id: op.fact_id ?? existing?.id ?? uuidv4(),
          scope: op.scope ?? "global",
          key: op.key,
          value: op.value ?? "",
          tags: op.tags ?? [],
          confidence: op.confidence ?? 1.0,
          source_session: shard.session_id,
          created: existing?.created ?? shard.timestamp,
          last_confirmed: shard.timestamp,
          access_count: existing?.access_count ?? 0,
        });
      }
    }
  }

  return Array.from(state.values());
}

/**
 * Build a ShardOperation from a Fact (for creating shards from local state).
 */
export function factToUpsertOp(fact: Fact): ShardOperation {
  return {
    op: "upsert",
    fact_id: fact.id,
    key: fact.key,
    value: fact.value,
    tags: fact.tags,
    scope: fact.scope,
    confidence: fact.confidence,
  };
}
