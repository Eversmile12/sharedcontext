import { existsSync } from "fs";
import { createInterface } from "readline";
import { publicKeyFromPrivate, addressFromPublicKey } from "../core/identity.js";
import { loadKey, loadIdentityPrivateKey, getDbPath, getIdentityPath } from "./init.js";

export function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function ensureInitialized(): string {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) {
    console.error("SharedContext not initialized. Run `sharedcontext init` first.");
    process.exit(1);
  }
  return dbPath;
}

export function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export interface ResolvedIdentity {
  encryptionKey: Uint8Array;
  identityKey: Uint8Array;
  walletAddress: string;
}

export function resolveIdentity(passphrase: string): ResolvedIdentity {
  const encryptionKey = loadKey(passphrase);
  const identityKey = loadIdentityPrivateKey(encryptionKey);
  const pubKey = publicKeyFromPrivate(identityKey);
  const walletAddress = addressFromPublicKey(pubKey);
  return { encryptionKey, identityKey, walletAddress };
}

export function isIdentityAvailable(): boolean {
  return existsSync(getIdentityPath());
}
