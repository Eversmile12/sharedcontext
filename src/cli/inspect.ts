import { openDatabase, getAllFacts, getFactsByScope } from "../core/db.js";
import { ensureInitialized } from "./util.js";

export function inspectCommand(options: { scope?: string }): void {
  const dbPath = ensureInitialized();
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
