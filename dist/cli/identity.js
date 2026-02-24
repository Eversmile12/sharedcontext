import { openDatabase, getMeta } from "../core/db.js";
import { TurboBackend } from "../core/backends/turbo.js";
import { loadKey, loadIdentityPrivateKey } from "./init.js";
import { prompt, ensureInitialized } from "./util.js";
export async function identityCommand(options = {}) {
    const dbPath = ensureInitialized();
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
    }
    catch {
        // Skip balance on error
    }
}
//# sourceMappingURL=identity.js.map