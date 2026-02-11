export interface Keypair {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
    address: string;
}
/**
 * Generate a random secp256k1 keypair (legacy, used only if no phrase provided).
 */
export declare function generateKeypair(): Keypair;
/**
 * Derive a deterministic secp256k1 keypair from a recovery phrase.
 * Uses HKDF-SHA256 with a fixed salt and context string.
 * Same phrase always produces the same keypair and wallet address.
 */
export declare function deriveKeypairFromPhrase(phrase: string): Keypair;
/**
 * Derive an Ethereum-style address from a compressed or uncompressed public key.
 * Process: uncompress -> keccak256 of (x || y) -> take last 20 bytes -> 0x prefix.
 */
export declare function addressFromPublicKey(pubkey: Uint8Array): string;
/**
 * Recover the public key from a private key.
 */
export declare function publicKeyFromPrivate(privateKey: Uint8Array): Uint8Array;
/**
 * Sign a shard's encrypted blob. Returns a hex-encoded signature (65 bytes: r + s + recovery).
 * We hash the data with SHA-256 ourselves, then sign with prehash: false.
 */
export declare function signShard(data: Uint8Array, privateKey: Uint8Array): string;
/**
 * Verify a shard signature against an expected wallet address.
 * Recovers the signer address from the signature and checks it matches.
 */
export declare function verifySignature(data: Uint8Array, signatureHex: string, expectedAddress: string): boolean;
//# sourceMappingURL=identity.d.ts.map