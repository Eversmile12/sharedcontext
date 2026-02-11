#!/usr/bin/env node

import { Command } from "commander";
import { initCommand, initExistingCommand } from "./cli/init.js";
import { storeCommand } from "./cli/store.js";
import { deleteCommand } from "./cli/delete.js";
import { recallCommand } from "./cli/recall.js";
import { inspectCommand } from "./cli/inspect.js";
import { exportCommand } from "./cli/export.js";
import { pullCommand } from "./cli/pull.js";
import { identityCommand } from "./cli/identity.js";
import { startMcpServer } from "./mcp/server.js";

const program = new Command();

program
  .name("sharme")
  .description("Sovereign, portable LLM context layer")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize Sharme with a new 12-word recovery phrase")
  .option("--existing", "Restore from an existing recovery phrase")
  .action(async (options) => {
    if (options.existing) {
      await initExistingCommand();
    } else {
      await initCommand();
    }
  });

program
  .command("store")
  .description("Store a fact in the local cache")
  .requiredOption("-k, --key <key>", "Fact key (e.g. project:sharme:auth)")
  .requiredOption("-v, --value <value>", "Fact value")
  .requiredOption("-t, --tags <tags>", "Comma-separated tags")
  .option("-s, --scope <scope>", "Scope (global or project:<name>)", "global")
  .action((options) => {
    storeCommand(options);
  });

program
  .command("delete")
  .description("Delete a fact by key")
  .requiredOption("-k, --key <key>", "Fact key to delete")
  .action((options) => {
    deleteCommand(options);
  });

program
  .command("recall")
  .description("Recall context matching a topic")
  .requiredOption("-t, --topic <topic>", "Topic to search for")
  .option("-s, --scope <scope>", "Scope filter (defaults to current project + global)")
  .option("-m, --model <model>", "Target model for budget trimming")
  .option("--raw", "Output raw JSON instead of formatted context")
  .action((options) => {
    recallCommand(options);
  });

program
  .command("inspect")
  .description("List all stored facts")
  .option("-s, --scope <scope>", "Filter by scope")
  .action((options) => {
    inspectCommand(options);
  });

program
  .command("export")
  .description("Export context formatted for a specific model")
  .requiredOption("-s, --scope <scope>", "Scope to export")
  .option("-m, --model <model>", "Target model", "default")
  .action((options) => {
    exportCommand(options);
  });

program
  .command("pull")
  .description("Reconstruct context from Arweave on a new device")
  .option("-w, --wallet <address>", "Wallet address (0x...)")
  .action(async (options) => {
    await pullCommand({ wallet: options.wallet });
  });

program
  .command("identity")
  .description("Show wallet address, balance, and sync status")
  .option("--testnet", "Check balance on testnet")
  .action(async (options) => {
    await identityCommand({ testnet: options.testnet });
  });

program
  .command("serve")
  .description("Start the MCP server (used by Cursor and other MCP clients)")
  .action(async () => {
    await startMcpServer();
  });

program.parse();
