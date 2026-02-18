import { execSync } from "child_process";
import { platform, homedir } from "os";
import { join } from "path";
const SERVICE = "singlecontext";
const ACCOUNT = "passphrase";
/** Path to the user's login keychain on macOS */
function loginKeychain() {
    return join(homedir(), "Library", "Keychains", "login.keychain-db");
}
/**
 * Store the passphrase in the OS keychain.
 * macOS: Keychain Access via `security`
 * Linux: GNOME Keyring via `secret-tool`
 * Windows: Credential Manager via PowerShell
 */
export function keychainStore(passphrase) {
    const os = platform();
    if (os === "darwin") {
        const kc = loginKeychain();
        // Delete existing entry first (add-generic-password fails if it exists)
        try {
            execSync(`security delete-generic-password -s "${SERVICE}" -a "${ACCOUNT}" "${kc}" 2>/dev/null`, { stdio: "ignore" });
        }
        catch {
            // Fine — didn't exist yet
        }
        execSync(`security add-generic-password -s "${SERVICE}" -a "${ACCOUNT}" -w "${escapeShell(passphrase)}" "${kc}"`, { stdio: "ignore" });
    }
    else if (os === "linux") {
        execSync(`echo -n "${escapeShell(passphrase)}" | secret-tool store --label="SingleContext passphrase" service "${SERVICE}" account "${ACCOUNT}"`, { stdio: "ignore" });
    }
    else if (os === "win32") {
        // PowerShell: store as a generic credential
        const ps = `
      $cred = New-Object System.Management.Automation.PSCredential("${ACCOUNT}", (ConvertTo-SecureString "${escapeShell(passphrase)}" -AsPlainText -Force));
      New-StoredCredential -Target "${SERVICE}" -UserName "${ACCOUNT}" -Password "${escapeShell(passphrase)}" -Type Generic -Persist LocalMachine
    `.trim();
        execSync(`powershell -Command "${ps}"`, { stdio: "ignore" });
    }
    else {
        throw new Error(`Unsupported platform: ${os}. In production, prefer a supported OS keychain.`);
    }
}
/**
 * Read the passphrase from the OS keychain.
 * Returns the passphrase string, or null if not found.
 */
export function keychainLoad() {
    const os = platform();
    try {
        if (os === "darwin") {
            const kc = loginKeychain();
            const result = execSync(`security find-generic-password -s "${SERVICE}" -a "${ACCOUNT}" -w "${kc}"`, { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] });
            return result.trim();
        }
        else if (os === "linux") {
            const result = execSync(`secret-tool lookup service "${SERVICE}" account "${ACCOUNT}"`, { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] });
            return result.trim();
        }
        else if (os === "win32") {
            const ps = `(Get-StoredCredential -Target "${SERVICE}").GetNetworkCredential().Password`;
            const result = execSync(`powershell -Command "${ps}"`, {
                encoding: "utf-8",
                stdio: ["pipe", "pipe", "ignore"],
            });
            return result.trim();
        }
    }
    catch {
        // Command failed = not found
        return null;
    }
    return null;
}
/**
 * Delete the passphrase from the OS keychain.
 */
export function keychainDelete() {
    const os = platform();
    try {
        if (os === "darwin") {
            const kc = loginKeychain();
            execSync(`security delete-generic-password -s "${SERVICE}" -a "${ACCOUNT}" "${kc}"`, { stdio: "ignore" });
        }
        else if (os === "linux") {
            execSync(`secret-tool clear service "${SERVICE}" account "${ACCOUNT}"`, { stdio: "ignore" });
        }
        else if (os === "win32") {
            execSync(`powershell -Command "Remove-StoredCredential -Target '${SERVICE}'"`, { stdio: "ignore" });
        }
    }
    catch {
        // Already gone or not found — fine
    }
}
/**
 * Escape a string for safe shell interpolation.
 */
function escapeShell(s) {
    // Replace backslashes first, then double quotes, then backticks and dollar signs
    return s
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/`/g, "\\`")
        .replace(/\$/g, "\\$");
}
//# sourceMappingURL=keychain.js.map