import { execFileSync } from "child_process";
import { platform, homedir } from "os";
import { join } from "path";

const SERVICE = "sharedcontext";
const ACCOUNT = "passphrase";

/** Path to the user's login keychain on macOS */
function loginKeychain(): string {
  return join(homedir(), "Library", "Keychains", "login.keychain-db");
}

/**
 * Store the passphrase in the OS keychain.
 * macOS: Keychain Access via `security`
 * Linux: GNOME Keyring via `secret-tool`
 * Windows: Credential Manager via PowerShell
 */
export function keychainStore(passphrase: string): void {
  const os = platform();

  if (os === "darwin") {
    const kc = loginKeychain();
    // Delete existing entry first (add-generic-password fails if it exists)
    try {
      execFileSync(
        "security",
        ["delete-generic-password", "-s", SERVICE, "-a", ACCOUNT, kc],
        { stdio: "ignore" }
      );
    } catch {
      // Fine — didn't exist yet
    }
    execFileSync(
      "security",
      ["add-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w", passphrase, kc],
      { stdio: "ignore" }
    );
  } else if (os === "linux") {
    execFileSync(
      "secret-tool",
      ["store", "--label=SharedContext passphrase", "service", SERVICE, "account", ACCOUNT],
      { stdio: ["pipe", "ignore", "ignore"], input: passphrase }
    );
  } else if (os === "win32") {
    // Read passphrase from stdin to avoid putting it in command args.
    const ps = `
      $pw = [Console]::In.ReadToEnd()
      if ($pw.EndsWith([Environment]::NewLine)) { $pw = $pw.Substring(0, $pw.Length - [Environment]::NewLine.Length) }
      if ($pw.EndsWith("\`n")) { $pw = $pw.Substring(0, $pw.Length - 1) }
      New-StoredCredential -Target "${SERVICE}" -UserName "${ACCOUNT}" -Password $pw -Type Generic -Persist LocalMachine
    `.trim();
    execFileSync(
      "powershell",
      ["-NoProfile", "-Command", ps],
      { stdio: ["pipe", "ignore", "ignore"], input: passphrase }
    );
  } else {
    throw new Error(
      `Unsupported platform: ${os}. In production, prefer a supported OS keychain.`
    );
  }
}

/**
 * Read the passphrase from the OS keychain.
 * Returns the passphrase string, or null if not found.
 */
export function keychainLoad(): string | null {
  const os = platform();

  try {
    if (os === "darwin") {
      const kc = loginKeychain();
      const result = execFileSync(
        "security",
        ["find-generic-password", "-s", SERVICE, "-a", ACCOUNT, "-w", kc],
        { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
      );
      return result.trim();
    } else if (os === "linux") {
      const result = execFileSync(
        "secret-tool",
        ["lookup", "service", SERVICE, "account", ACCOUNT],
        { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
      );
      return result.trim();
    } else if (os === "win32") {
      const ps = `
        $cred = Get-StoredCredential -Target "${SERVICE}"
        if ($null -eq $cred) { exit 1 }
        $cred.GetNetworkCredential().Password
      `.trim();
      const result = execFileSync(
        "powershell",
        ["-NoProfile", "-Command", ps],
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "ignore"],
        }
      );
      return result.trim();
    }
  } catch {
    // Command failed = not found
    return null;
  }

  return null;
}

/**
 * Delete the passphrase from the OS keychain.
 */
export function keychainDelete(): void {
  const os = platform();

  try {
    if (os === "darwin") {
      const kc = loginKeychain();
      execFileSync(
        "security",
        ["delete-generic-password", "-s", SERVICE, "-a", ACCOUNT, kc],
        { stdio: "ignore" }
      );
    } else if (os === "linux") {
      execFileSync(
        "secret-tool",
        ["clear", "service", SERVICE, "account", ACCOUNT],
        { stdio: "ignore" }
      );
    } else if (os === "win32") {
      execFileSync(
        "powershell",
        ["-NoProfile", "-Command", `Remove-StoredCredential -Target '${SERVICE}'`],
        { stdio: "ignore" }
      );
    }
  } catch {
    // Already gone or not found — fine
  }
}
