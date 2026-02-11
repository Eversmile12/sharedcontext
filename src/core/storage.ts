/**
 * Tag for Arweave transactions.
 */
export interface Tag {
  name: string;
  value: string;
}

/**
 * Result from an upload operation.
 */
export interface UploadResult {
  txId: string;
}

/**
 * Balance info from the storage backend.
 */
export interface BalanceInfo {
  /** Human-readable balance string */
  balance: string;
  /** Estimated number of shard uploads remaining */
  estimatedUploads: number;
}

/**
 * Pluggable storage backend interface.
 * Handles uploads only. Reads go through Arweave directly (free, no auth).
 */
export interface StorageBackend {
  /** Upload encrypted data with tags. Returns the transaction ID. */
  upload(data: Uint8Array, tags: Tag[]): Promise<UploadResult>;
  /** Get current balance and estimated remaining uploads. */
  getBalance(): Promise<BalanceInfo>;
}
