import { existsSync } from "fs";
import { openDatabase, getAllFacts, incrementAccessCount } from "../core/db.js";
import { recallContext, formatContext } from "../core/engine.js";
import { getDbPath } from "./init.js";
export function recallCommand(options) {
    const dbPath = getDbPath();
    if (!existsSync(dbPath)) {
        console.error("Sharme not initialized. Run `sharme init` first.");
        process.exit(1);
    }
    const db = openDatabase(dbPath);
    const allFacts = getAllFacts(db);
    const currentProject = process.cwd().split("/").pop() ?? "unknown";
    const scope = options.scope ?? `project:${currentProject}`;
    const results = recallContext(options.topic, scope, allFacts, options.model);
    // Increment access counts for returned facts
    for (const fact of results) {
        incrementAccessCount(db, fact.key);
    }
    db.close();
    if (results.length === 0) {
        console.log("No matching facts found.");
        return;
    }
    if (options.raw) {
        console.log(JSON.stringify(results, null, 2));
    }
    else {
        console.log(formatContext(results));
    }
}
//# sourceMappingURL=recall.js.map