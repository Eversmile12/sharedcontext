import { existsSync } from "fs";
import { openDatabase, getAllFacts } from "../core/db.js";
import { recallContext, formatContext, MODEL_BUDGETS } from "../core/engine.js";
import { getDbPath } from "./init.js";

export function exportCommand(options: {
  scope: string;
  model: string;
}): void {
  const dbPath = getDbPath();
  if (!existsSync(dbPath)) {
    console.error("Sharme not initialized. Run `sharme init` first.");
    process.exit(1);
  }

  const db = openDatabase(dbPath);
  const allFacts = getAllFacts(db);
  db.close();

  // Use a broad topic to get everything in scope, ranked by recency
  const results = recallContext("", options.scope, allFacts, options.model);
  const formatted = formatContext(results);

  if (results.length === 0) {
    console.log("No facts to export for this scope.");
    return;
  }

  const budget = MODEL_BUDGETS[options.model] ?? MODEL_BUDGETS.default;
  const estimatedTokens = results.length * 50;

  console.log(formatted);
  console.error(
    `\n--- ${results.length} facts, ~${estimatedTokens} tokens (budget: ${Math.floor(budget.window * budget.allocation)} tokens for ${options.model}) ---`
  );
}
