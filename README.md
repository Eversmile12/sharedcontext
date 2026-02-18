# SingleContext

SingleContext is a sovereign, portable context layer for LLM workflows.
It stores project memory locally, syncs encrypted deltas to Arweave, and exposes memory tools through MCP so agents can recall useful facts across sessions and machines.


## What SingleContext Does

- Stores facts in local SQLite for fast reads.
- Tracks local changes as append-only shard operations.
- Encrypts and signs shard payloads locally.
- Uploads encrypted blobs to Arweave.
- Restores full state on a new machine from a 12-word recovery phrase.
- Runs an MCP server (`singlecontext serve`) for tools like fact store/recall and conversation recall.
- Syncs Cursor and Claude Code transcript deltas to keep conversational history portable.

## Hard-Cut Rename (Breaking Change)

This repository uses a hard-cut migration strategy.
Everything is renamed to `singlecontext`, including internals:

- CLI command: `singlecontext` (alias: `sc`)
- Package name: `singlecontext`
- Local home: `~/.singlecontext`
- DB path: `~/.singlecontext/singlecontext.db`
- Keychain service name: `singlecontext`
- Arweave app tag: `App-Name=singlecontext`
- Scope/key conventions now use `singlecontext` naming
- Environment variable: `SINGLECONTEXT_HOME`

## Quick Start

### 1) Initialize identity and storage

```bash
singlecontext init
```

This creates:

- `~/.singlecontext/singlecontext.db`
- `~/.singlecontext/salt`
- `~/.singlecontext/identity.enc`
- `~/.singlecontext/shards/`

### 2) Start MCP server + auto-sync loops

```bash
singlecontext serve
```

### 3) Restore on another machine

```bash
singlecontext init --existing
```

Enter your 12-word phrase to reconstruct local state from Arweave.

## Command Reference

- `singlecontext init` - initialize with a new phrase
- `singlecontext init --existing` - restore from an existing phrase
- `singlecontext serve` - run MCP server over stdio
- `singlecontext setup --cursor|--claude|--claude-cli|--codex` - install MCP config
- `singlecontext identity` - show wallet and sync status
- `singlecontext list conversations` - list discovered conversations
- `singlecontext list context` - list stored facts
- `singlecontext share <conversationId>` - create a share token/url
- `singlecontext sync <urlOrToken>` - import a shared conversation
- `singlecontext inspect` - list facts
- `singlecontext delete --key <key>` - delete a fact

## How It Works

## 1) Identity

- User gets or restores a 12-word phrase.
- Phrase deterministically derives a secp256k1 identity.
- Phrase + salt derives an AES key via Argon2id.
- Private key is stored locally as encrypted `identity.enc`.
- Phrase is stored in OS keychain for background MCP usage.

## 2) Local Storage

SingleContext uses SQLite as the primary runtime cache:

- `facts`: normalized memory facts
- `pending_deletes`: tombstones for delete sync
- `meta`: versioning, offsets, and sync metadata

Reads are local-first for speed and reliability.

## 3) Structured Fact Sync

1. New/updated fact is written to SQLite (`dirty=1`).
2. Auto-sync loop reads dirty facts + pending deletes.
3. Changes are converted into shard operations (`upsert`/`delete`).
4. Operations are chunked to keep payload size bounded.
5. Each shard is encrypted (`AES-256-GCM`) and signed.
6. Encrypted blob is uploaded with index tags (wallet, type, version, signature).
7. On success, local dirty flags and version metadata are advanced.

## 4) Conversation Sync

1. Watcher scans local transcript sources (Cursor/Claude Code).
2. Each session uses a saved offset cursor from SQLite meta.
3. Only new messages since last offset are transformed into segments.
4. Segments are encrypted, chunked, signed, and uploaded.
5. Offset is advanced after successful upload.

This keeps network write volume low and avoids full re-uploads.

## 5) Restore Flow

1. User provides recovery phrase (`init --existing`).
2. Tool derives identity and fetches encrypted identity material.
3. Phrase+salt key decrypts identity payload (validation step).
4. Tool queries and downloads shard history by wallet/index tags.
5. Signatures are verified before decryption.
6. Valid shards are replayed by version into SQLite state.
7. Local artifacts are persisted for normal operation.

Malformed, unsigned, or invalid-signature payloads are skipped.

## Security Model

- Encryption: `AES-256-GCM`
- KDF: `Argon2id`
- Signatures: `secp256k1`
- Pull integrity checks: signature verification before decrypt/replay
- Key material handling: passphrase in OS keychain, encrypted identity at rest

## Architecture Overview

- `src/core/` - crypto, identity derivation, storage, sync, ranking
- `src/cli/` - command workflows
- `src/mcp/server.ts` - MCP stdio server and tool wiring
- `src/test/` - unit and integration tests

## What This Is Not

- Not a hosted cloud memory service.
- Not collaborative multi-user memory.
- Not semantic-vector retrieval (current ranking is heuristic/tag and keyword based).

The focus is deterministic ownership and portability first.

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
