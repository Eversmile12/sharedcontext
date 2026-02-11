import { existsSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import { openDatabase, upsertFact } from "../core/db.js";
import { getDbPath } from "./init.js";
export function storeCommand(options) {
    const dbPath = getDbPath();
    if (!existsSync(dbPath)) {
        console.error("Sharme not initialized. Run `sharme init` first.");
        process.exit(1);
    }
    const db = openDatabase(dbPath);
    const now = new Date().toISOString();
    const tags = options.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const fullKey = options.key.startsWith("global:") || options.key.startsWith("project:")
        ? options.key
        : `${options.scope}:${options.key}`;
    const fact = {
        id: uuidv4(),
        scope: options.scope,
        key: fullKey,
        value: options.value,
        tags,
        confidence: 1.0,
        source_session: null,
        created: now,
        last_confirmed: now,
        access_count: 0,
    };
    upsertFact(db, fact);
    db.close();
    console.log(`Stored: ${fact.key}`);
    console.log(`  Scope: ${fact.scope}`);
    console.log(`  Tags:  ${tags.join(", ")}`);
    console.log(`  Value: ${fact.value}`);
}
//# sourceMappingURL=store.js.map