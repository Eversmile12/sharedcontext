import { existsSync } from "fs";
import { openDatabase, deleteFact, getFact } from "../core/db.js";
import { getDbPath } from "./init.js";

export function deleteCommand(options: { key: string }): void {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) {
    console.error("SingleContext not initialized. Run `singlecontext init` first.");
    process.exit(1);
  }

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
