import { openDatabase, deleteFact, getFact } from "../core/db.js";
import { ensureInitialized } from "./util.js";
export function deleteCommand(options) {
    const dbPath = ensureInitialized();
    const db = openDatabase(dbPath);
    const existing = getFact(db, options.key);
    if (!existing) {
        console.log(`No fact found with key: ${options.key}`);
        db.close();
        return;
    }
    deleteFact(db, options.key);
    db.close();
    console.log(`Deleted: ${options.key}`);
}
//# sourceMappingURL=delete.js.map