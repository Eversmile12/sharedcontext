/**
 * Derive a 32-byte AES key from a passphrase using Argon2id.
 */
export declare function deriveKey(passphrase: string, salt: Uint8Array): Uint8Array;
/**
 * Generate a random 16-byte salt for key derivation.
 */
export declare function generateSalt(): Uint8Array;
/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns: nonce (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export declare function encrypt(plaintext: Uint8Array, key: Uint8Array): Uint8Array;
/**
 * Decrypt an AES-256-GCM blob (nonce + ciphertext + tag).
 * Throws if the key is wrong or data is tampered.
 */
export declare function decrypt(blob: Uint8Array, key: Uint8Array): Uint8Array;
//# sourceMappingURL=crypto.d.ts.map