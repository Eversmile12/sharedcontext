import { gcm } from "@noble/ciphers/aes.js";
import { argon2id } from "@noble/hashes/argon2.js";
import { randomBytes } from "node:crypto";

const NONCE_LENGTH = 12;
const KEY_LENGTH = 32;

// Argon2id parameters (OWASP recommended minimums)
const ARGON2_TIME = 3;
const ARGON2_MEM = 65536; // 64 MB
const ARGON2_PARALLELISM = 1;

/**
 * Derive a 32-byte AES key from a passphrase using Argon2id.
 */
export function deriveKey(passphrase: string, salt: Uint8Array): Uint8Array {
  return argon2id(passphrase, salt, {
    t: ARGON2_TIME,
    m: ARGON2_MEM,
    p: ARGON2_PARALLELISM,
    dkLen: KEY_LENGTH,
  });
}

/**
 * Generate a random 16-byte salt for key derivation.
 */
export function generateSalt(): Uint8Array {
  return randomBytes(16);
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Returns: nonce (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export function encrypt(plaintext: Uint8Array, key: Uint8Array): Uint8Array {
  const nonce = randomBytes(NONCE_LENGTH);
  const cipher = gcm(key, nonce);
  const sealed = cipher.encrypt(plaintext);
  // Prepend nonce to the sealed output (ciphertext + tag)
  const result = new Uint8Array(NONCE_LENGTH + sealed.length);
  result.set(nonce, 0);
  result.set(sealed, NONCE_LENGTH);
  return result;
}

/**
 * Decrypt an AES-256-GCM blob (nonce + ciphertext + tag).
 * Throws if the key is wrong or data is tampered.
 */
export function decrypt(blob: Uint8Array, key: Uint8Array): Uint8Array {
  const nonce = blob.slice(0, NONCE_LENGTH);
  const sealed = blob.slice(NONCE_LENGTH);
  const cipher = gcm(key, nonce);
  return cipher.decrypt(sealed);
}
