"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sha256 = void 0;
const sha256_1 = require("@noble/hashes/sha256");
/**
 * Compute a SHA-256 digest for a given byte array.
 *
 * Uses the native crypto implementation and falls back to noble.
 *
 * @param bytes - A byte array.
 * @returns The SHA-256 hash as a byte array.
 */
async function sha256(bytes) {
    // Use crypto.subtle.digest whenever possible as it is faster.
    if ('crypto' in globalThis &&
        typeof globalThis.crypto === 'object' &&
        // eslint-disable-next-line no-restricted-globals
        globalThis.crypto.subtle?.digest) {
        // eslint-disable-next-line no-restricted-globals
        return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
    }
    return (0, sha256_1.sha256)(bytes);
}
exports.sha256 = sha256;
//# sourceMappingURL=hashing.cjs.map