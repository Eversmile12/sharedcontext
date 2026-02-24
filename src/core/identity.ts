import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { randomBytes } from "node:crypto";

export interface Keypair {
  privateKey: Uint8Array; // 32 bytes
  publicKey: Uint8Array; // 33 bytes (compressed)
  address: string; // 0x-prefixed Ethereum-style address
}

/**
 * Generate a random secp256k1 keypair (legacy, used only if no phrase provided).
 */
export function generateKeypair(): Keypair {
  const privateKey = new Uint8Array(randomBytes(32));
  const publicKey = secp256k1.getPublicKey(privateKey, true); // compressed
  const address = addressFromPublicKey(publicKey);
  return { privateKey, publicKey, address };
}

/**
 * Derive a deterministic secp256k1 keypair from a recovery phrase.
 * Uses HKDF-SHA256 with a fixed salt and context string.
 * Same phrase always produces the same keypair and wallet address.
 */
export function deriveKeypairFromPhrase(phrase: string): Keypair {
  const encoder = new TextEncoder();
  const ikm = encoder.encode(phrase);
  const salt = encoder.encode("sharedcontext-identity-v1");
  const info = encoder.encode("secp256k1-private-key");

  // HKDF: extract-then-expand to get 32 bytes for the private key
  const privateKey = hkdf(sha256, ikm, salt, info, 32);
  const publicKey = secp256k1.getPublicKey(privateKey, true);
  const address = addressFromPublicKey(publicKey);
  return { privateKey, publicKey, address };
}

/**
 * Derive an Ethereum-style address from a compressed or uncompressed public key.
 * Process: uncompress -> keccak256 of (x || y) -> take last 20 bytes -> 0x prefix.
 */
export function addressFromPublicKey(pubkey: Uint8Array): string {
  // Get uncompressed point (65 bytes: 0x04 + x + y)
  // Get uncompressed key directly: pass compressed pubkey to getPublicKey won't work,
  // so we convert via the Point constructor
  const pubHex = Buffer.from(pubkey).toString("hex");
  const point = secp256k1.Point.fromHex(pubHex);
  const uncompressed = point.toBytes(false); // 65 bytes
  // Keccak256 of the 64 bytes after the 0x04 prefix
  const hash = keccak_256(uncompressed.slice(1));
  // Last 20 bytes
  const addressBytes = hash.slice(-20);
  return "0x" + Buffer.from(addressBytes).toString("hex");
}

/**
 * Recover the public key from a private key.
 */
export function publicKeyFromPrivate(privateKey: Uint8Array): Uint8Array {
  return secp256k1.getPublicKey(privateKey, true);
}

/**
 * Sign a shard's encrypted blob. Returns a hex-encoded signature (65 bytes: r + s + recovery).
 * We hash the data with SHA-256 ourselves, then sign with prehash: false.
 */
export function signShard(data: Uint8Array, privateKey: Uint8Array): string {
  const hash = sha256(data);
  // format: 'recovered' gives us 65 bytes: 64 compact (r+s) + 1 recovery byte
  const sig = secp256k1.sign(hash, privateKey, { prehash: false, format: "recovered" });
  return "0x" + Buffer.from(sig).toString("hex");
}

/**
 * Verify a shard signature against an expected wallet address.
 * Recovers the signer address from the signature and checks it matches.
 */
export function verifySignature(
  data: Uint8Array,
  signatureHex: string,
  expectedAddress: string
): boolean {
  try {
    const hash = sha256(data);
    const sigBytes = Buffer.from(signatureHex.replace("0x", ""), "hex");
    // Parse the 65-byte recovered signature
    const sig = secp256k1.Signature.fromBytes(new Uint8Array(sigBytes), "recovered");
    const recoveredPoint = sig.recoverPublicKey(hash);
    const recoveredAddress = addressFromPublicKey(recoveredPoint.toBytes(true));
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch {
    return false;
  }
}
