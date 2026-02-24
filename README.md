<p align="center">
  <strong>SharedContext</strong>
</p>

<p align="center">
  Sovereign, encrypted, portable memory for AI agents.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ai-sharedcontext"><img src="https://img.shields.io/npm/v/ai-sharedcontext?style=flat-square&color=blue" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/ai-sharedcontext"><img src="https://img.shields.io/npm/dm/ai-sharedcontext?style=flat-square" alt="npm downloads"></a>
  <a href="https://github.com/Eversmile12/sharme/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/ai-sharedcontext?style=flat-square" alt="license"></a>
</p>

---

## What Is It

SharedContext is a local-first memory layer for LLM agents. It gives Cursor, Claude Code, and Codex persistent memory that **you own**, synced to [Arweave](https://arweave.org) so it follows you across sessions and machines.

Your AI assistant forgets everything the moment a session ends. Project decisions, coding preferences, architectural context — all gone. You re-explain the same things every day.

SharedContext fixes that. It runs as an [MCP](https://modelcontextprotocol.io/) server that your AI client connects to. Agents store and recall facts through MCP tools. A background watcher syncs your conversation history. Everything is encrypted client-side and uploaded to Arweave. Restore it all on a new machine with a 12-word recovery phrase.

## Why Shared Context

Your AI memory is fragmented:

- **Cursor** stores transcripts in `~/.cursor/projects/`
- **Claude Code** stores sessions in `~/.claude/projects/`
- **Codex** has its own isolated context

None of them talk to each other. None of them persist structured knowledge. None of them let you move to a new machine and pick up where you left off.

SharedContext collapses all of that into one encrypted, portable layer that every client reads from and writes to. One memory. One identity. One place to look.

## What It Does

| Capability | Description |
|---|---|
| **Fact memory** | Agents store and recall structured facts (preferences, decisions, architecture) across sessions |
| **Conversation recall** | Retrieve past conversations from any client — "continue the discussion about auth" |
| **Encrypted sync** | All data is encrypted locally with AES-256-GCM before leaving your machine |
| **Arweave persistence** | Encrypted blobs are uploaded to Arweave for permanent, censorship-resistant storage |
| **Cross-machine restore** | 12-word recovery phrase reconstructs your entire context on any machine |
| **Conversation sharing** | Share a specific conversation via encrypted link — recipient imports with one command |
| **Auto-setup** | Detects installed AI clients and configures MCP automatically on `init` |

## What It Is Now

SharedContext is **early** (`v0.1.x`). It works, it's tested, but it's not battle-hardened yet.

**Supported clients:** Cursor, Claude Desktop, Claude CLI, Codex

**Current limitations:**
- Ranking is heuristic/keyword-based, not semantic vector search
- Single-user only — no collaborative memory
- Not a hosted service — you run everything locally

## How It Works

### Identity

A 12-word recovery phrase deterministically derives a `secp256k1` keypair. The phrase + a random salt derive an AES encryption key via `Argon2id`. The private key is stored encrypted at `~/.sharedcontext/identity.enc`. The phrase is stored in the OS keychain for background MCP access.

### Local Storage

SQLite is the runtime store. Three tables:

- `facts` — structured memory (key/value with tags, scope, confidence)
- `pending_deletes` — tombstones queued for remote sync
- `meta` — version cursors, offsets, sync state

All reads are local. Fast and offline-capable.

### Fact Sync

1. New or updated facts are written to SQLite with `dirty=1`
2. Background loop collects dirty facts + pending deletes
3. Changes are converted into shard operations (`upsert` / `delete`)
4. Operations are chunked to keep payload size bounded
5. Each shard is encrypted (AES-256-GCM) and signed (secp256k1)
6. Encrypted blob is uploaded to Arweave with index tags
7. On success, dirty flags are cleared and version cursors advance

### Conversation Sync

1. Watcher polls `~/.cursor/projects/` and `~/.claude/projects/` for changes
2. Each file uses a saved offset from SQLite meta
3. Only new messages since last offset are extracted
4. Segments are encrypted, chunked, signed, and uploaded
5. Offset advances after successful upload

Delta-only uploads keep network writes small.

### Restore

1. User provides recovery phrase via `init --existing`
2. Identity is re-derived and Arweave is queried by wallet address
3. Encrypted identity material is fetched and validated
4. Shard history is downloaded, signatures verified, then decrypted
5. Valid shards are replayed by version into a fresh SQLite database
6. Local identity files are persisted for normal operation

Malformed, unsigned, or bad-signature payloads are skipped.

## Quick Start

### Install

```bash
npm install -g ai-sharedcontext
```

### Initialize

```bash
sharedcontext init
```

This generates a 12-word recovery phrase, derives your identity, creates `~/.sharedcontext/`, and auto-configures any detected AI clients (Cursor, Claude, Codex).

**Write down the recovery phrase.** It's the only way to restore your context.

### Use It

Once initialized, your AI client connects to SharedContext automatically via MCP. No extra steps.

**Storing facts** — the agent calls `store_fact` when you express preferences or make decisions:

```
You: "We're using Drizzle ORM with PostgreSQL for this project"

→ Agent stores:  key=project:database:orm  value="Drizzle ORM with PostgreSQL"  tags=["database","orm","drizzle"]
```

**Recalling context** — the agent calls `recall_context` to retrieve relevant facts:

```
You: "What database setup are we using?"

→ Agent recalls: project:database:orm → "Drizzle ORM with PostgreSQL"
```

**Recalling conversations** — the agent calls `recall_conversation` to find past sessions:

```
You: "Continue the conversation about the auth refactor"

→ Agent retrieves the most relevant conversation matching "auth refactor"
```

### Restore on Another Machine

```bash
sharedcontext init --existing
```

Enter your 12-word phrase. SharedContext queries Arweave, downloads your encrypted shards, verifies signatures, decrypts, and rebuilds local state.

### Manual Client Setup

If auto-setup didn't configure your client, run one of:

```bash
sharedcontext setup --cursor
sharedcontext setup --claude
sharedcontext setup --claude-cli
sharedcontext setup --codex
```

Then restart the client app.

## Share Context Flow

Share a conversation with someone (or with yourself on another machine):

```bash
# 1. List your conversations
sharedcontext list conversations

# 2. Share one by ID
sharedcontext share <conversationId>
# → outputs: sharedcontext://share/<token>

# 3. Import on the other end
sharedcontext sync sharedcontext://share/<token>
```

The conversation is encrypted with a random key embedded in the token. Only someone with the full URL can decrypt it. The encrypted blob lives on Arweave — the link works forever.

## Security Model

| Layer | Implementation |
|---|---|
| **Encryption** | AES-256-GCM — all data encrypted client-side before upload |
| **Key derivation** | Argon2id — passphrase + salt → 256-bit key |
| **Signatures** | secp256k1 — every shard is signed, verified on pull |
| **Key storage** | Passphrase in OS keychain, private key encrypted at rest |
| **Pull integrity** | Signature verification before decrypt — bad shards are rejected |
| **Share isolation** | Each share uses a unique random 256-bit key, separate from identity |

**What this means:** Arweave stores opaque encrypted blobs. Without your recovery phrase (or a share token for shared conversations), the data is unreadable. There is no server, no account, no API key. You are the only keyholder.

## Command Reference

| Command | Description |
|---|---|
| `sharedcontext init` | Generate recovery phrase, derive identity, create local storage, auto-configure clients |
| `sharedcontext init --existing` | Restore from a 12-word recovery phrase |
| `sharedcontext serve` | Start the MCP server over stdio (used by AI clients; also useful for debugging) |
| `sharedcontext setup --cursor\|--claude\|--claude-cli\|--codex` | Write MCP config for a specific client |
| `sharedcontext identity` | Show wallet address, balance, and sync status |
| `sharedcontext list conversations` | List discovered conversations (local + remote) |
| `sharedcontext list context` | List stored context facts |
| `sharedcontext share <id>` | Create an encrypted share URL for a conversation |
| `sharedcontext sync <url>` | Import a shared conversation |
| `sharedcontext inspect` | List all stored facts |
| `sharedcontext delete --key <key>` | Delete a fact |

Shorthand: `sc` is an alias for `sharedcontext`.

## Architecture

```
src/
├── cli/          # Command workflows (init, setup, share, sync, etc.)
├── core/         # Crypto, identity, storage, sync engine, parsers, watcher
│   ├── backends/ # Arweave upload backend (Turbo)
│   └── parsers/  # Cursor transcript + Claude Code JSONL parsers
├── mcp/          # MCP server with tool definitions (store_fact, recall_context, etc.)
└── test/         # Unit and integration tests
```

## Contributing

```bash
git clone https://github.com/Eversmile12/sharme.git
cd sharme
npm install
npm run build
npm test
```

PRs welcome. Keep changes focused and tests passing.

## License

MIT
