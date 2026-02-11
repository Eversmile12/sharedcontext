import { existsSync, writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { createInterface } from "readline";
import { pullAndReconstruct } from "../core/sync.js";
import { fetchIdentity } from "../core/arweave.js";

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export interface PullCommandOptions {
  wallet?: string;
}

/**
 * Pull context from Arweave and reconstruct locally.
 * Used on a new device to restore all facts.
 */
export async function pullCommand(options: PullCommandOptions = {}): Promise<void> {
  const sharmeDir = join(homedir(), ".sharme");
  const dbPath = join(sharmeDir, "sharme.db");
  const saltPath = join(sharmeDir, "salt");
  const identityPath = join(sharmeDir, "identity.enc");

  if (existsSync(dbPath)) {
    console.error("Sharme is already initialized at ~/.sharme/");
    console.error("To pull fresh, delete ~/.sharme/ first.");
    process.exit(1);
  }

  // Get wallet address
  const walletAddress =
    options.wallet ?? (await prompt("Wallet address (0x...): "));

  if (!walletAddress.startsWith("0x")) {
    console.error("Invalid wallet address. Must start with 0x.");
    process.exit(1);
  }

  // Get passphrase
  const passphrase = await prompt("Passphrase: ");

  if (!passphrase) {
    console.error("Passphrase cannot be empty.");
    process.exit(1);
  }

  // Create directories
  mkdirSync(sharmeDir, { recursive: true });
  mkdirSync(join(sharmeDir, "shards"), { recursive: true });

  console.log("\nQuerying Arweave for your context...");

  try {
    const result = await pullAndReconstruct(walletAddress, passphrase, dbPath);
    const identity = await fetchIdentity(walletAddress);
    if (!identity) {
      throw new Error("Identity transaction not found on Arweave.");
    }
    writeFileSync(saltPath, Buffer.from(identity.salt));
    writeFileSync(identityPath, identity.encryptedPrivateKey);

    console.log(`\nSynced from Arweave:`);
    console.log(`  Facts:   ${result.factCount}`);
    console.log(`  Version: ${result.version}`);
    console.log(`  Path:    ${dbPath}`);
    console.log(`\nYou're ready. Add the MCP server to your editor config.`);
  } catch (err) {
    // Clean up on failure
    const { rmSync } = await import("fs");
    rmSync(sharmeDir, { recursive: true, force: true });
    throw err;
  }
}
