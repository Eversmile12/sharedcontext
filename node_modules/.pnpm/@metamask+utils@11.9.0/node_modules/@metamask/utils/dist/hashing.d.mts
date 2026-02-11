/**
 * Compute a SHA-256 digest for a given byte array.
 *
 * Uses the native crypto implementation and falls back to noble.
 *
 * @param bytes - A byte array.
 * @returns The SHA-256 hash as a byte array.
 */
export declare function sha256(bytes: Uint8Array): Promise<Uint8Array>;
//# sourceMappingURL=hashing.d.mts.map