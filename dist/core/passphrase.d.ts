export declare const PHRASE_WORD_COUNT = 12;
/**
 * Generate a 12-word recovery phrase from the BIP39 English wordlist.
 * Uses 128-bit entropy + 4-bit checksum (standard BIP39 structure).
 */
export declare function generatePhrase(): string[];
/**
 * Validate that a phrase consists of valid BIP39 English words.
 */
export declare function validatePhrase(words: string[]): {
    valid: boolean;
    error?: string;
};
/**
 * Convert a phrase (array of words) to a single string for key derivation.
 * Words are joined with spaces and lowercased.
 */
export declare function phraseToString(words: string[]): string;
//# sourceMappingURL=passphrase.d.ts.map