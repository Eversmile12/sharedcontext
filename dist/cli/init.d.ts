/**
 * Initialize a new SharedContext instance.
 * Generates a 12-word recovery phrase and derives everything from it.
 */
export declare function initCommand(): Promise<void>;
/**
 * Restore SharedContext from an existing recovery phrase.
 * Derives the wallet, queries Arweave for shards, and reconstructs local state.
 */
export declare function initExistingCommand(): Promise<void>;
/**
 * Load the encryption key from salt + passphrase.
 */
export declare function loadKey(passphrase: string): Uint8Array;
/**
 * Load the identity private key (decrypts identity.enc with the derived key).
 */
export declare function loadIdentityPrivateKey(key: Uint8Array): Uint8Array;
export declare function getSharedContextDir(): string;
export declare function getDbPath(): string;
export declare function getIdentityPath(): string;
//# sourceMappingURL=init.d.ts.map