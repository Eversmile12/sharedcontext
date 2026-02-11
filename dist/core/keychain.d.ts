/**
 * Store the passphrase in the OS keychain.
 * macOS: Keychain Access via `security`
 * Linux: GNOME Keyring via `secret-tool`
 * Windows: Credential Manager via PowerShell
 */
export declare function keychainStore(passphrase: string): void;
/**
 * Read the passphrase from the OS keychain.
 * Returns the passphrase string, or null if not found.
 */
export declare function keychainLoad(): string | null;
/**
 * Delete the passphrase from the OS keychain.
 */
export declare function keychainDelete(): void;
//# sourceMappingURL=keychain.d.ts.map