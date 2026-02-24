import type { StorageBackend, Tag } from "./storage.js";
import type { Conversation } from "../types.js";
/**
 * Build the Arweave tags for a shard upload.
 */
export declare function buildShardTags(walletAddress: string, version: number, type: "delta" | "snapshot", signature: string): Tag[];
/**
 * Push a single encrypted shard to Arweave.
 * Signs the blob, constructs tags, and uploads.
 */
export declare function pushShard(encryptedBlob: Uint8Array, version: number, type: "delta" | "snapshot", walletAddress: string, privateKey: Uint8Array, backend: StorageBackend): Promise<string>;
/**
 * Upload the identity transaction to Arweave.
 * Contains the salt (in tags) and encrypted private key (as data).
 */
export declare function pushIdentity(salt: Uint8Array, encryptedPrivateKey: Uint8Array, walletAddress: string, identityPrivateKey: Uint8Array, backend: StorageBackend): Promise<string>;
/**
 * Pull shards from Arweave and reconstruct the full state into a local database.
 * Used when setting up a new device.
 */
export declare function pullAndReconstruct(walletAddress: string, passphrase: string, dbPath: string): Promise<{
    factCount: number;
    version: number;
}>;
/**
 * Push only new conversation messages since lastSyncedCount.
 * Uses Offset/Count tags so retrieval can rebuild full sessions.
 */
export declare function pushConversationDelta(conversation: Conversation, encryptionKey: Uint8Array, walletAddress: string, privateKey: Uint8Array, backend: StorageBackend, lastSyncedCount: number): Promise<string[]>;
/**
 * Pull and reconstruct conversations from Arweave conversation chunks.
 * Rebuilds sessions by stitching chunk groups and then ordering by segment offset.
 */
export declare function pullConversations(walletAddress: string, encryptionKey: Uint8Array): Promise<Conversation[]>;
/**
 * Check if local state is behind Arweave.
 * Returns the remote version, or null if no shards exist.
 */
export declare function checkRemoteVersion(walletAddress: string): Promise<number | null>;
//# sourceMappingURL=sync.d.ts.map