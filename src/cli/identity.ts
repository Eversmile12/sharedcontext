import { existsSync } from "fs";
import { createInterface } from "readline";
import { openDatabase, getMeta } from "../core/db.js";
import { publicKeyFromPrivate, addressFromPublicKey } from "../core/identity.js";
import { TurboBackend } from "../core/backends/turbo.js";
import { loadKey, loadIdentityPrivateKey, getDbPath } from "./init.js";

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export interface IdentityCommandOptions {
  testnet?: boolean;
}

/**
 * Show wallet address, balance, and identity info.
 */
export async function identityCommand(options: IdentityCommandOptions = {}): Promise<void> {
  const dbPath = getDbPath();

  if (!existsSync(dbPath)) {
    console.error("SingleContext not initialized. Run `singlecontext init` first.");
    process.exit(1);
  }

  const db = openDatabase(dbPath);
  const walletAddress = getMeta(db, "wallet_address");
  const currentVersion = getMeta(db, "current_version") ?? "0";
  const lastPushed = getMeta(db, "last_pushed_version") ?? "0";
  const identityPushed = getMeta(db, "identity_pushed");
  db.close();

  console.log("SingleContext Identity\n");
  console.log(`  Wallet:          ${walletAddress}`);
  console.log(`  Local version:   ${currentVersion}`);
  console.log(`  Pushed version:  ${lastPushed}`);
  console.log(`  Identity on AR:  ${identityPushed ? "yes (" + identityPushed + ")" : "no"}`);

  // Try to get balance if we can load the key
  try {
    const passphrase = await prompt("\nPassphrase (for balance check, or Enter to skip): ");
    if (passphrase) {
      const key = loadKey(passphrase);
      const identityKey = loadIdentityPrivateKey(key);

      const backend = new TurboBackend({
        privateKeyHex: Buffer.from(identityKey).toString("hex"),
        testnet: options.testnet,
      });

      const balance = await backend.getBalance();
      console.log(`\n  Balance:         ${balance.balance}`);
      console.log(`  Est. uploads:    ~${balance.estimatedUploads}`);
    }
  } catch {
    // Skip balance on error
  }
}
