import { randomBytes } from "node:crypto";
import { sha256 } from "@noble/hashes/sha2.js";
import { BIP39_ENGLISH } from "./bip39-words.js";

export const PHRASE_WORD_COUNT = 12;
const ENTROPY_BITS = 128;
const CHECKSUM_BITS = ENTROPY_BITS / 32; // BIP39 checksum rule
const TOTAL_BITS = ENTROPY_BITS + CHECKSUM_BITS; // 132 bits -> 12 words

/**
 * Generate a 12-word recovery phrase from the BIP39 English wordlist.
 * Uses 128-bit entropy + 4-bit checksum (standard BIP39 structure).
 */
export function generatePhrase(): string[] {
  const entropy = randomBytes(ENTROPY_BITS / 8); // 16 bytes
  const entropyBits = bytesToBits(entropy);
  const hashBits = bytesToBits(sha256(entropy));
  const checksum = hashBits.slice(0, CHECKSUM_BITS);
  const bits = entropyBits + checksum;

  const words: string[] = [];
  for (let i = 0; i < PHRASE_WORD_COUNT; i++) {
    const index = parseInt(bits.slice(i * 11, (i + 1) * 11), 2);
    words.push(BIP39_ENGLISH[index]);
  }

  return words;
}

/**
 * Validate that a phrase consists of valid BIP39 English words.
 */
export function validatePhrase(words: string[]): { valid: boolean; error?: string } {
  if (words.length !== PHRASE_WORD_COUNT) {
    return {
      valid: false,
      error: `Expected ${PHRASE_WORD_COUNT} words, got ${words.length}`,
    };
  }

  const indexMap = new Map(BIP39_ENGLISH.map((w, i) => [w, i]));
  const normalized = words.map((w) => w.toLowerCase());
  const indices: number[] = [];
  for (const word of normalized) {
    const index = indexMap.get(word);
    if (typeof index !== "number") {
      return { valid: false, error: `Unknown word: "${word}"` };
    }
    indices.push(index);
  }

  const bits = indices.map((i) => i.toString(2).padStart(11, "0")).join("");
  if (bits.length !== TOTAL_BITS) {
    return { valid: false, error: "Invalid phrase bit length." };
  }

  const entropyBits = bits.slice(0, ENTROPY_BITS);
  const checksumBits = bits.slice(ENTROPY_BITS);
  const entropy = bitsToBytes(entropyBits);
  const expectedChecksum = bytesToBits(sha256(entropy)).slice(0, CHECKSUM_BITS);
  if (checksumBits !== expectedChecksum) {
    return { valid: false, error: "Checksum mismatch. Phrase may contain a typo." };
  }

  return { valid: true };
}

/**
 * Convert a phrase (array of words) to a single string for key derivation.
 * Words are joined with spaces and lowercased.
 */
export function phraseToString(words: string[]): string {
  return words.map((w) => w.toLowerCase()).join(" ");
}

function bytesToBits(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(2).padStart(8, "0"))
    .join("");
}

function bitsToBytes(bits: string): Uint8Array {
  if (bits.length % 8 !== 0) {
    throw new Error("Bit string must be byte-aligned.");
  }
  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }
  return bytes;
}
