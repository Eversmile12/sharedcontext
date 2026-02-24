import { signShard, verifySignature } from "./identity.js";
import { encrypt, decrypt, deriveKey } from "./crypto.js";
import { deserializeShard, replayShards, MAX_SHARD_BYTES } from "./shard.js";
import {
  queryShards,
  queryConversationChunks,
  downloadShard,
  fetchIdentity,
  type ConversationChunkInfo,
} from "./arweave.js";
import { openDatabase, upsertFact, setMeta, clearDirtyState } from "./db.js";
import type { StorageBackend, Tag } from "./storage.js";
import type { ShardInfo } from "./arweave.js";
import type { Fact, Shard, Conversation } from "../types.js";

// Pull-time guardrails:
// - data shards should never exceed 100 KiB (Turbo free-tier limit)
// - identity payload should be tiny; keep a stricter cap
const MAX_PULL_DATA_SHARD_BYTES = 100 * 1024;
const MAX_PULL_IDENTITY_BYTES = 16 * 1024;

/**
 * Build the Arweave tags for a shard upload.
 */
export function buildShardTags(
  walletAddress: string,
  version: number,
  type: "delta" | "snapshot",
  signature: string
): Tag[] {
  return [
    { name: "App-Name", value: "singlecontext" },
    { name: "Wallet", value: walletAddress },
    { name: "Version", value: String(version) },
    { name: "Type", value: type },
    { name: "Timestamp", value: String(Math.floor(Date.now() / 1000)) },
    { name: "Signature", value: signature },
    { name: "Content-Type", value: "application/octet-stream" },
  ];
}

/**
 * Push a single encrypted shard to Arweave.
 * Signs the blob, constructs tags, and uploads.
 */
export async function pushShard(
  encryptedBlob: Uint8Array,
  version: number,
  type: "delta" | "snapshot",
  walletAddress: string,
  privateKey: Uint8Array,
  backend: StorageBackend
): Promise<string> {
  const signature = signShard(encryptedBlob, privateKey);
  const tags = buildShardTags(walletAddress, version, type, signature);
  const result = await backend.upload(encryptedBlob, tags);
  return result.txId;
}

/**
 * Upload the identity transaction to Arweave.
 * Contains the salt (in tags) and encrypted private key (as data).
 */
export async function pushIdentity(
  salt: Uint8Array,
  encryptedPrivateKey: Uint8Array,
  walletAddress: string,
  identityPrivateKey: Uint8Array,
  backend: StorageBackend
): Promise<string> {
  const signature = signShard(encryptedPrivateKey, identityPrivateKey);
  const tags: Tag[] = [
    { name: "App-Name", value: "singlecontext" },
    { name: "Wallet", value: walletAddress },
    { name: "Type", value: "identity" },
    { name: "Salt", value: Buffer.from(salt).toString("hex") },
    { name: "Signature", value: signature },
    { name: "Content-Type", value: "application/octet-stream" },
  ];
  const result = await backend.upload(encryptedPrivateKey, tags);
  return result.txId;
}

/**
 * Pull shards from Arweave and reconstruct the full state into a local database.
 * Used when setting up a new device.
 */
export async function pullAndReconstruct(
  walletAddress: string,
  passphrase: string,
  dbPath: string
): Promise<{ factCount: number; version: number }> {
  // Step 1: Fetch identity to get salt
  const identity = await fetchIdentity(walletAddress, MAX_PULL_IDENTITY_BYTES);
  if (!identity) {
    throw new Error(
      "No identity found on Arweave for this wallet. " +
        "Make sure you ran `singlecontext init` on another device and pushed the identity."
    );
  }

  // Step 2: Derive key from passphrase + salt
  const key = deriveKey(passphrase, identity.salt);

  // Step 3: Verify we can decrypt the private key (validates passphrase)
  try {
    decrypt(identity.encryptedPrivateKey, key);
  } catch {
    throw new Error("Wrong passphrase. Decryption failed.");
  }

  // Step 4: Query all shards
  const allShards = await queryShards(walletAddress);
  const dataShards = allShards.filter(
    (s) => s.type === "delta" || s.type === "snapshot"
  );

  if (dataShards.length === 0) {
    // No shards yet, just set up empty db
    const db = openDatabase(dbPath);
    setMeta(db, "current_version", "0");
    setMeta(db, "wallet_address", walletAddress);
    db.close();
    return { factCount: 0, version: 0 };
  }

  // Step 5: Find the latest snapshot (if any) and only fetch shards after it
  const latestSnapshot = findLatestSnapshot(dataShards);
  const shardsToFetch = latestSnapshot
    ? dataShards.filter((s) => s.version >= latestSnapshot.version)
    : dataShards;

  // Step 6: Download and process shards
  const decryptedShards: Shard[] = [];
  for (const shardInfo of shardsToFetch) {
    try {
      const encrypted = await downloadShard(
        shardInfo.txId,
        MAX_PULL_DATA_SHARD_BYTES
      );

      // Signature is mandatory for all data shards.
      if (!shardInfo.signature) {
        console.warn(
          `Skipping shard v${shardInfo.version}: missing signature.`
        );
        continue;
      }
      if (!verifySignature(encrypted, shardInfo.signature, walletAddress)) {
        console.warn(
          `Skipping shard v${shardInfo.version}: signature verification failed.`
        );
        continue;
      }

      // Only decrypt verified shards.
      const decrypted = decrypt(encrypted, key);
      const shard = deserializeShard(decrypted);
      decryptedShards.push(shard);
    } catch (err) {
      console.warn(
        `Skipping shard v${shardInfo.version}: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }
  }

  if (decryptedShards.length === 0) {
    throw new Error(
      "No valid shards could be recovered from Arweave (all candidates were invalid or unreadable)."
    );
  }

  // Step 7: Sort by version and replay
  decryptedShards.sort((a, b) => a.shard_version - b.shard_version);
  const facts = replayShards(decryptedShards);

  // Step 8: Populate local SQLite
  const db = openDatabase(dbPath);
  for (const fact of facts) {
    upsertFact(db, fact);
  }

  const maxVersion = Math.max(...dataShards.map((s) => s.version));
  setMeta(db, "current_version", String(maxVersion));
  setMeta(db, "wallet_address", walletAddress);

  // All facts just loaded from Arweave are clean (already persisted remotely)
  clearDirtyState(db);
  db.close();

  return { factCount: facts.length, version: maxVersion };
}

/**
 * Push only new conversation messages since lastSyncedCount.
 * Uses Offset/Count tags so retrieval can rebuild full sessions.
 */
export async function pushConversationDelta(
  conversation: Conversation,
  encryptionKey: Uint8Array,
  walletAddress: string,
  privateKey: Uint8Array,
  backend: StorageBackend,
  lastSyncedCount: number
): Promise<string[]> {
  const safeOffset = Math.max(0, Math.min(lastSyncedCount, conversation.messages.length));
  const deltaMessages = conversation.messages.slice(safeOffset);
  if (deltaMessages.length === 0) return [];

  const payload = {
    id: conversation.id,
    client: conversation.client,
    project: conversation.project,
    startedAt: conversation.startedAt,
    updatedAt: conversation.updatedAt,
    offset: safeOffset,
    count: deltaMessages.length,
    messages: deltaMessages,
  };

  const serialized = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = encrypt(serialized, encryptionKey);

  // Split into chunks if needed (90 KiB max per chunk)
  const maxBytes = MAX_SHARD_BYTES;
  const chunks: Uint8Array[] = [];

  if (encrypted.length <= maxBytes) {
    chunks.push(encrypted);
  } else {
    for (let offset = 0; offset < encrypted.length; offset += maxBytes) {
      chunks.push(encrypted.slice(offset, offset + maxBytes));
    }
  }

  const txIds: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const signature = signShard(chunk, privateKey);
    const tags: Tag[] = [
      { name: "App-Name", value: "singlecontext" },
      { name: "Wallet", value: walletAddress },
      { name: "Type", value: "conversation" },
      { name: "Client", value: conversation.client },
      { name: "Project", value: conversation.project },
      { name: "Session", value: conversation.id },
      { name: "Offset", value: String(safeOffset) },
      { name: "Count", value: String(deltaMessages.length) },
      { name: "Chunk", value: `${i + 1}/${chunks.length}` },
      { name: "Timestamp", value: String(Math.floor(Date.now() / 1000)) },
      { name: "Signature", value: signature },
      { name: "Content-Type", value: "application/octet-stream" },
    ];
    const result = await backend.upload(chunk, tags);
    txIds.push(result.txId);
  }

  return txIds;
}

/**
 * Pull and reconstruct conversations from Arweave conversation chunks.
 * Rebuilds sessions by stitching chunk groups and then ordering by segment offset.
 */
export async function pullConversations(
  walletAddress: string,
  encryptionKey: Uint8Array
): Promise<Conversation[]> {
  const infos = await queryConversationChunks(walletAddress);
  if (infos.length === 0) return [];

  const grouped = groupConversationChunkInfos(infos);
  const segmentPayloads: Array<{
    session: string;
    client: "cursor" | "claude-code";
    project: string;
    offset: number;
    timestamp: string;
    messages: Array<{ role: "user" | "assistant" | "tool"; content: string; timestamp?: string }>;
    startedAt: string;
    updatedAt: string;
  }> = [];

  for (const group of grouped.values()) {
    try {
      const sortedChunks = [...group].sort((a, b) => a.chunkIndex - b.chunkIndex);
      if (sortedChunks.length === 0) continue;

      // Validate chunk sequence completeness.
      const expectedTotal = sortedChunks[0].chunkTotal;
      if (sortedChunks.length !== expectedTotal) continue;
      let completeSequence = true;
      for (let i = 0; i < sortedChunks.length; i++) {
        if (sortedChunks[i].chunkIndex !== i + 1) {
          completeSequence = false;
          break;
        }
      }
      if (!completeSequence) continue;

      const buffers: Uint8Array[] = [];
      let totalLen = 0;
      for (const chunk of sortedChunks) {
        const encrypted = await downloadShard(chunk.txId, MAX_PULL_DATA_SHARD_BYTES);
        if (!chunk.signature || !verifySignature(encrypted, chunk.signature, walletAddress)) {
          throw new Error("conversation chunk signature verification failed");
        }
        buffers.push(encrypted);
        totalLen += encrypted.length;
      }

      const joined = new Uint8Array(totalLen);
      let writeOffset = 0;
      for (const part of buffers) {
        joined.set(part, writeOffset);
        writeOffset += part.length;
      }

      const decrypted = decrypt(joined, encryptionKey);
      const parsed = JSON.parse(new TextDecoder().decode(decrypted)) as Record<string, unknown>;
      const session = typeof parsed.id === "string" ? parsed.id : null;
      const client =
        parsed.client === "cursor" || parsed.client === "claude-code"
          ? parsed.client
          : null;
      const project = typeof parsed.project === "string" ? parsed.project : null;
      const startedAt =
        typeof parsed.startedAt === "string" ? parsed.startedAt : null;
      const updatedAt =
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : null;
      const offset =
        typeof parsed.offset === "number" && Number.isFinite(parsed.offset)
          ? parsed.offset
          : null;
      const messages = Array.isArray(parsed.messages)
        ? (parsed.messages as Conversation["messages"])
        : null;

      // Strict future-only schema validation.
      if (
        !session ||
        !client ||
        !project ||
        !startedAt ||
        !updatedAt ||
        offset === null ||
        !messages
      ) {
        continue;
      }

      segmentPayloads.push({
        session,
        client,
        project,
        offset: Math.max(0, offset),
        timestamp: sortedChunks[0].timestamp,
        messages,
        startedAt,
        updatedAt,
      });
    } catch {
      // Skip malformed/unreadable conversation groups.
      continue;
    }
  }

  if (segmentPayloads.length === 0) return [];

  const sessions = new Map<string, Conversation>();
  const perSessionOffsets = new Map<string, Set<number>>();

  segmentPayloads.sort((a, b) => {
    if (a.session !== b.session) return a.session.localeCompare(b.session);
    if (a.offset !== b.offset) return a.offset - b.offset;
    return a.timestamp.localeCompare(b.timestamp);
  });

  for (const seg of segmentPayloads) {
    const existingOffsets = perSessionOffsets.get(seg.session) ?? new Set<number>();
    // If we already have this exact offset, keep the first one (stable by timestamp sort).
    if (existingOffsets.has(seg.offset)) continue;
    existingOffsets.add(seg.offset);
    perSessionOffsets.set(seg.session, existingOffsets);

    const existing = sessions.get(seg.session);
    if (!existing) {
      sessions.set(seg.session, {
        id: seg.session,
        client: seg.client,
        project: seg.project,
        messages: [...seg.messages],
        startedAt: seg.startedAt,
        updatedAt: seg.updatedAt,
      });
      continue;
    }

    existing.messages.push(...seg.messages);
    if (seg.startedAt < existing.startedAt) existing.startedAt = seg.startedAt;
    if (seg.updatedAt > existing.updatedAt) existing.updatedAt = seg.updatedAt;
  }

  return Array.from(sessions.values()).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}

function groupConversationChunkInfos(
  infos: ConversationChunkInfo[]
): Map<string, ConversationChunkInfo[]> {
  const groups = new Map<string, ConversationChunkInfo[]>();
  for (const info of infos) {
    const key = `${info.session}:${info.offset}:${info.timestamp}`;
    const arr = groups.get(key);
    if (arr) arr.push(info);
    else groups.set(key, [info]);
  }
  return groups;
}

function findLatestSnapshot(shards: ShardInfo[]): ShardInfo | null {
  const snapshots = shards.filter((s) => s.type === "snapshot");
  if (snapshots.length === 0) return null;
  return snapshots.reduce((a, b) => (a.version > b.version ? a : b));
}

/**
 * Check if local state is behind Arweave.
 * Returns the remote version, or null if no shards exist.
 */
export async function checkRemoteVersion(
  walletAddress: string
): Promise<number | null> {
  const shards = await queryShards(walletAddress);
  const dataShards = shards.filter(
    (s) => s.type === "delta" || s.type === "snapshot"
  );
  if (dataShards.length === 0) return null;
  return Math.max(...dataShards.map((s) => s.version));
}
