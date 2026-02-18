import { existsSync } from "fs";
import { openDatabase, getAllFacts, getFactsByScope } from "../core/db.js";
import { getDbPath } from "./init.js";
export function inspectCommand(options) {
    const dbPath = getDbPath();
    if (!existsSync(dbPath)) {
        console.error("SingleContext not initialized. Run `singlecontext init` first.");
        process.exit(1);
    }
    const db = openDatabase(dbPath);
    const facts = options.scope
        ? getFactsByScope(db, options.scope)
        : getAllFacts(db);
    db.close();
    if (facts.length === 0) {
        console.log("No facts stored.");
        return;
    }
    console.log(`${facts.length} fact(s):\n`);
    for (const fact of facts) {
        console.log(`  ${fact.key}`);
        console.log(`    Scope: ${fact.scope}`);
        console.log(`    Value: ${fact.value}`);
        console.log(`    Tags:  ${fact.tags.join(", ")}`);
        console.log(`    Confirmed: ${fact.last_confirmed}`);
        console.log(`    Accessed: ${fact.access_count} times`);
        console.log();
    }
}
//# sourceMappingURL=inspect.js.map