import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { readFileSync } from "fs";
import {
  openDatabase,
  upsertFact,
  deleteFact,
  getFact,
  getAllFacts,
  getDirtyFacts,
  getPendingDeletes,
  clearDirtyState,
  getMeta,
  setMeta,
  incrementAccessCount,
} from "../core/db.js";
import { recallContext, formatContext } from "../core/engine.js";
import { createChunkedShards, serializeShard, factToUpsertOp } from "../core/shard.js";
import { encrypt } from "../core/crypto.js";
import { pushShard, pushConversationDelta, pullConversations } from "../core/sync.js";
import { TurboBackend } from "../core/backends/turbo.js";
import { getDbPath } from "../cli/init.js";
import { keychainLoad } from "../core/keychain.js";
import { ConversationWatcher, discoverConversationFiles } from "../core/watcher.js";
import { parseCursorTranscript } from "../core/parsers/cursor.js";
import { parseClaudeCodeJSONL } from "../core/parsers/claude-code.js";
import { VERSION } from "../version.js";
import {
  resolveIdentity,
  isIdentityAvailable,
  toErrorMessage,
} from "../cli/util.js";
import type { Fact, ShardOperation, Conversation } from "../types.js";
import type Database from "better-sqlite3";

const SYNC_INTERVAL_MS = 60_000;
const CONVERSATION_QUERY_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "about",
  "awesome",
  "chat",
  "continue",
  "conversation",
  "let",
  "lets",
  "our",
  "the",
  "tool",
  "tools",
  "with",
]);

let db: Database.Database;

export async function startMcpServer(): Promise<void> {
  const passphrase = keychainLoad();
  if (!passphrase) {
    process.stderr.write(
      "SharedContext: no passphrase found in system keychain. Run `sharedcontext init` first.\n"
    );
    process.exit(1);
  }
  process.stderr.write("SharedContext: passphrase loaded from system keychain\n");

  const dbPath = getDbPath();
  db = openDatabase(dbPath);

  const cwd = process.cwd();
  const projectName = cwd.split("/").pop() ?? "unknown";
  const defaultScope = `project:${projectName}`;

  const server = new McpServer(
    { name: "sharedcontext", version: VERSION },
    { instructions: "SharedContext is a sovereign, portable LLM context layer. Use store_fact to persist important decisions, preferences and project context. Use recall_context at conversation start or when context is needed. Use recall_conversation to retrieve past conversations from other AI clients." },
  );

  server.tool(
    "store_fact",
    "Store an important fact for long-term memory. Call this when the user expresses a preference, makes a project decision, shares architectural context, or provides information that should be remembered across sessions.",
    {
      key: z
        .string()
        .describe(
          "Unique identifier for the fact, using colons as separators. Examples: 'auth:strategy', 'database:orm', 'coding_style'"
        ),
      value: z
        .string()
        .describe(
          "The fact content. Be concise but complete. Include the reasoning behind decisions."
        ),
      tags: z
        .array(z.string())
        .describe(
          "Tags describing the topic. Examples: ['auth', 'jwt', 'decision'], ['preference', 'code-style']"
        ),
      scope: z
        .string()
        .optional()
        .describe(
          "Scope: 'global' for facts useful everywhere (preferences, general knowledge). Use 'project:<name>' only for facts specific to the current project (tech stack, architecture decisions). Defaults to global."
        ),
    },
    async ({ key, value, tags, scope }) => {
      const factScope = scope ?? "global";
      const fullKey = key.startsWith("global:") || key.startsWith("project:")
        ? key
        : `${factScope}:${key}`;

      const now = new Date().toISOString();
      const fact: Fact = {
        id: uuidv4(),
        scope: factScope,
        key: fullKey,
        value,
        tags,
        confidence: 1.0,
        source_session: null,
        created: now,
        last_confirmed: now,
        access_count: 0,
      };

      upsertFact(db, fact);

      return {
        content: [{ type: "text" as const, text: `Stored: ${fullKey}` }],
      };
    }
  );

  server.tool(
    "recall_context",
    "Recall relevant facts from long-term memory. Call this at the start of a conversation or when you need context about a topic. Returns facts ranked by relevance.",
    {
      topic: z
        .string()
        .describe(
          "What to recall. Use keywords: 'database auth', 'project architecture', 'coding preferences'"
        ),
      scope: z
        .string()
        .optional()
        .describe("Scope to search. Defaults to current project + global."),
    },
    async ({ topic, scope }) => {
      const searchScope = scope ?? defaultScope;
      const allFacts = getAllFacts(db);
      const results = recallContext(topic, searchScope, allFacts);

      for (const fact of results) {
        incrementAccessCount(db, fact.key);
      }

      if (results.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No matching facts in memory." },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: formatContext(results) }],
      };
    }
  );

  server.tool(
    "delete_fact",
    "Delete a fact from memory. Use when information is no longer accurate or relevant.",
    {
      key: z.string().describe("The fact key to delete."),
    },
    async ({ key }) => {
      const existing = getFact(db, key);
      if (!existing) {
        return {
          content: [
            { type: "text" as const, text: `No fact found with key: ${key}` },
          ],
        };
      }

      deleteFact(db, key);
      return {
        content: [{ type: "text" as const, text: `Deleted: ${key}` }],
      };
    }
  );

  server.tool(
    "recall_conversation",
    "Retrieve a previous conversation from another AI client (Cursor, Claude Code). Use this when the user says 'continue the conversation about X' or 'what did we discuss about Y'. SharedContext watches local conversation files and syncs them to Arweave.",
    {
      topic: z
        .string()
        .describe("What the conversation was about. Keywords like 'keyboard layout', 'auth setup', 'database migration'."),
      client: z
        .enum(["cursor", "claude-code", "any"])
        .optional()
        .describe("Which client the conversation was in. Defaults to 'any'."),
      project: z
        .string()
        .optional()
        .describe("Project name to filter by."),
    },
    async ({ topic, client, project }) => {
      const conversations: Conversation[] = [];

      if (isIdentityAvailable()) {
        try {
          const identity = resolveIdentity(passphrase);
          const remote = await pullConversations(identity.walletAddress, identity.encryptionKey);
          conversations.push(...remote);
        } catch {
          // If remote pull fails, continue with local fallback.
        }
      }

      const local = discoverConversationFiles();

      for (const f of local) {
        if (client && client !== "any" && client !== f.client) continue;
        if (project && f.project !== project) continue;
        try {
          const text = readFileSync(f.path, "utf-8");
          if (f.client === "cursor") {
            conversations.push(parseCursorTranscript(text, f.fileId, f.project));
          } else {
            conversations.push(parseClaudeCodeJSONL(text, f.fileId, f.project));
          }
        } catch {
          // Skip unreadable local files.
        }
      }

      if (conversations.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No conversations found." }],
        };
      }

      const topicTokens = tokenizeTopic(topic);
      const scored = conversations.map((conv) => {
        const score = scoreConversation(conv, topicTokens);
        return { conv, score };
      });

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.conv.updatedAt.localeCompare(a.conv.updatedAt);
      });
      const best = scored[0];
      if (best.score <= 0) {
        return {
          content: [{ type: "text" as const, text: `No conversations matching "${topic}" found.` }],
        };
      }

      const CHARS_PER_TOKEN = 4;
      const TOKEN_BUDGET = 128_000 * 0.15;
      const charBudget = TOKEN_BUDGET * CHARS_PER_TOKEN;

      const msgs: typeof best.conv.messages = [];
      let totalChars = 0;
      for (let i = best.conv.messages.length - 1; i >= 0; i--) {
        const msg = best.conv.messages[i];
        const msgChars = msg.content.length + msg.role.length + 10;
        if (totalChars + msgChars > charBudget) break;
        msgs.unshift(msg);
        totalChars += msgChars;
      }

      const formatted = msgs.map((m) =>
        `[${m.role}]: ${m.content}`
      ).join("\n\n");

      const header = `[CONVERSATION from ${best.conv.client}, project: ${best.conv.project}, ${best.conv.messages.length} total messages, showing last ${msgs.length}]`;

      return {
        content: [{ type: "text" as const, text: `${header}\n\n${formatted}` }],
      };
    }
  );

  // Connect transport immediately so MCP clients discover tools without delay.
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // ── Background sync to Arweave ──────────────────────
  let syncTimer: ReturnType<typeof setInterval> | null = null;

  try {
    if (isIdentityAvailable()) {
      const { encryptionKey, identityKey, walletAddress } = resolveIdentity(passphrase);
      const useTestnet = process.env.SHAREDCONTEXT_TESTNET === "true";

      const backend = new TurboBackend({
        privateKeyHex: Buffer.from(identityKey).toString("hex"),
        testnet: useTestnet,
      });

      syncTimer = setInterval(() => {
        syncDirtyFacts(db, encryptionKey, identityKey, walletAddress, backend);
      }, SYNC_INTERVAL_MS);

      const watcher = new ConversationWatcher(async (conversation) => {
        try {
          const stateKey = `conversation_offset:${conversation.client}:${conversation.id}`;
          const lastSyncedRaw = getMeta(db, stateKey);
          const lastSynced = Number.parseInt(lastSyncedRaw ?? "0", 10);
          const txIds = await pushConversationDelta(
            conversation,
            encryptionKey,
            walletAddress,
            identityKey,
            backend,
            Number.isFinite(lastSynced) ? lastSynced : 0
          );
          if (txIds.length === 0) return;
          setMeta(db, stateKey, String(conversation.messages.length));
          process.stderr.write(
            `SharedContext: conversation synced [${conversation.client}/${conversation.project}] ${txIds.length} chunk(s), cursor=${conversation.messages.length}\n`
          );
        } catch (err) {
          process.stderr.write(
            `SharedContext: conversation sync failed: ${toErrorMessage(err)}\n`
          );
        }
      }, 30_000);
      watcher.start();

      process.stderr.write(
        `SharedContext: auto-sync every ${SYNC_INTERVAL_MS / 1000}s → Arweave (${useTestnet ? "testnet" : "mainnet"})\n`
      );
      process.stderr.write(
        "SharedContext: conversation watcher active (Cursor + Claude Code)\n"
      );
    } else {
      process.stderr.write(
        "SharedContext: no identity found, auto-sync disabled. Run `sharedcontext init` first.\n"
      );
    }
  } catch (err) {
    process.stderr.write(
      `SharedContext: auto-sync disabled (${toErrorMessage(err)}). Facts are stored locally only.\n`
    );
  }

  function shutdown() {
    if (syncTimer) clearInterval(syncTimer);
    db.close();
    process.exit(0);
  }
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function syncDirtyFacts(
  db: Database.Database,
  encryptionKey: Uint8Array,
  identityKey: Uint8Array,
  walletAddress: string,
  backend: TurboBackend
): Promise<void> {
  try {
    const dirtyFacts = getDirtyFacts(db);
    const pendingDeletes = getPendingDeletes(db);

    if (dirtyFacts.length === 0 && pendingDeletes.length === 0) return;

    const operations: ShardOperation[] = [
      ...dirtyFacts.map(factToUpsertOp),
      ...pendingDeletes.map((key): ShardOperation => ({ op: "delete", key })),
    ];

    const currentVersion = parseInt(getMeta(db, "current_version") ?? "0", 10);
    const startVersion = currentVersion + 1;

    const shards = createChunkedShards(operations, startVersion, uuidv4());
    let lastVersion = currentVersion;

    for (const shard of shards) {
      const serialized = serializeShard(shard);
      const encrypted = encrypt(serialized, encryptionKey);

      const txId = await pushShard(
        encrypted,
        shard.shard_version,
        "delta",
        walletAddress,
        identityKey,
        backend
      );

      lastVersion = shard.shard_version;
      process.stderr.write(
        `SharedContext: synced v${shard.shard_version} (${operations.length} ops, ${encrypted.length}B) → ${txId}\n`
      );
    }

    clearDirtyState(db);
    setMeta(db, "current_version", String(lastVersion));
    setMeta(db, "last_pushed_version", String(lastVersion));
  } catch (err) {
    process.stderr.write(
      `SharedContext: sync failed, will retry: ${toErrorMessage(err)}\n`
    );
  }
}

function tokenizeTopic(topic: string): string[] {
  const tokens = topic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !CONVERSATION_QUERY_STOPWORDS.has(token));
  if (tokens.length > 0) return tokens;
  return topic.toLowerCase().split(/\s+/).filter((token) => token.length > 0);
}

function scoreConversation(conv: Conversation, topicTokens: string[]): number {
  if (topicTokens.length === 0) return 0;

  const text = conv.messages.map((m) => m.content).join(" ").toLowerCase();
  const tokenSet = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));

  let exactTokenMatches = 0;
  for (const token of topicTokens) {
    if (tokenSet.has(token)) exactTokenMatches += 1;
  }
  if (exactTokenMatches === 0) return 0;

  const projectLower = conv.project.toLowerCase();
  const projectMatch = topicTokens.some((token) => projectLower.includes(token)) ? 1 : 0;
  const recencyBoost = normalizedRecency(conv.updatedAt);

  // Main signal is exact token overlap. Project and recency are small tie-breakers.
  return exactTokenMatches * 2 + projectMatch * 1.5 + recencyBoost * 0.3;
}

function normalizedRecency(updatedAtIso: string): number {
  const updatedMs = Date.parse(updatedAtIso);
  if (!Number.isFinite(updatedMs)) return 0;
  const days = (Date.now() - updatedMs) / (1000 * 60 * 60 * 24);
  if (days <= 0) return 1;
  if (days >= 30) return 0;
  return 1 - days / 30;
}
