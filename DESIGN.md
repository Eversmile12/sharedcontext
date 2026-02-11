# Sharme - Sovereign, Portable LLM Context

## 1. Goal

LLMs have no durable memory. Every new session starts from zero. Context built across hundreds of conversations is lost, trapped in platform silos, or stored on third-party servers the user does not control.

Sharme is a portable, encrypted, user-sovereign context layer for LLMs. It gives developers a single place to store structured memory, encrypted with keys only they hold, persisted on decentralized storage, and retrievable from any device into any model.

### Objectives

- **Portability.** Context moves across models (Claude, GPT, Llama, Gemini) and platforms (Cursor, Claude Code, ChatGPT, terminal) without modification.
- **Sovereignty.** The user owns their data. No company can read it, lock it, or delete it. No cloud accounts, no subscriptions, no vendor lock-in.
- **Privacy.** All data is encrypted before it leaves the device. Storage backends only ever see opaque ciphertext.
- **Persistence.** Context is stored permanently on Arweave. It survives device loss, platform shutdowns, and account deletions.
- **Low friction.** A developer should go from zero to full context on a new machine in under a minute.
- **Near-zero cost.** Most uploads are free (Turbo subsidizes files under 100 KiB). No recurring fees.

### Non-goals (for now)

- Team/shared memory (future scope).
- Non-technical user UX.
- Real-time collaboration.

---

## 2. Protocol vs Client

Sharme is a **protocol** first, a tool second.

The protocol is:
- Encrypted shards stored permanently on Arweave, tagged with the owner's identity.
- Arweave transaction tags serving as the index (no separate chain needed).
- ECDSA signatures on each shard proving ownership.
- An encryption scheme (AES-256-GCM with Argon2id key derivation) that protects the shard contents.
- A delta/event-sourcing format for the shards themselves.

Any software that knows the wallet address (public, to query Arweave) and the user's passphrase (to decrypt) can reconstruct the full context from scratch. The MCP server, CLI, and API proxy are client implementations. They are convenient, not required.

If the user decides tomorrow to ditch all Sharme tooling and write a Python script that queries Arweave, fetches shards, and decrypts them, that works. The data is on permissionless public infrastructure. No gatekeeper.

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    Developer's Device                  │
│                                                        │
│   ┌────────────┐  ┌────────────┐  ┌───────────────┐  │
│   │ MCP Server │  │ API Proxy  │  │     CLI       │  │
│   │ (Cursor,   │  │ (any LLM   │  │ (manual       │  │
│   │ Claude Code│  │  API client)│  │  inspect/     │  │
│   │ etc.)      │  │             │  │  export)      │  │
│   └─────┬──────┘  └─────┬──────┘  └──────┬────────┘  │
│         │               │                 │            │
│         └───────────────┼─────────────────┘            │
│                         │                              │
│                ┌────────▼─────────┐                    │
│                │  Context Engine   │                   │
│                │                   │                   │
│                │  - Scope filter   │                   │
│                │  - Tag + recency  │                   │
│                │  - Window budget  │                   │
│                │  - Model format   │                   │
│                └────────┬─────────┘                    │
│                         │                              │
│                ┌────────▼─────────┐                    │
│                │  Local Cache      │                   │
│                │  (SQLite)         │                   │
│                └────────┬─────────┘                    │
│                         │ sync                         │
└─────────────────────────┼──────────────────────────────┘
                          │
              ┌───────────▼────────────┐
              │        Arweave          │
              │                         │
              │  Encrypted shards       │
              │  (data + index via      │
              │   transaction tags)     │
              └─────────────────────────┘
```

The local SQLite cache is a hot copy for instant reads. It is not the source of truth. Arweave is the permanent source of truth. Arweave transaction tags serve as the index, allowing any device to find all shards belonging to a wallet. All data is encrypted before it touches the network.

---

## 4. Memory Structure

Memory is split into two layers with different characteristics.

### Layer 1: Structured Memory (facts)

Small, high-value, always loaded. These are distilled facts about the user and their projects.

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "scope": "project:sharme",
  "key": "sharme:storage:backend",
  "value": "Using Arweave for permanent shard storage. Chose over IPFS because of guaranteed permanence, pay-once model, no pinning dependency.",
  "tags": ["storage", "arweave", "architecture", "decision"],
  "confidence": 1.0,
  "source_session": "session-882a-...",
  "created": "2026-02-09T15:30:00Z",
  "last_confirmed": "2026-02-09T15:30:00Z",
  "access_count": 0
}
```

Typical size: tens of kilobytes total. Fits in any model's context window.

Tags describe both the topic and the nature of the fact. There is no separate "category" field. A fact about a decision is tagged with "decision". A preference is tagged with "preference". This keeps the schema flat and simple.

**Example facts:**

| Key | Tags | Scope |
|---|---|---|
| `global:coding_style` | preference, code-style | global |
| `sharme:storage:backend` | storage, arweave, architecture, decision | project:sharme |
| `sharme:auth:strategy` | auth, jwt, api, decision | project:sharme |
| `global:arweave_knowledge` | arweave, domain-knowledge | global |

### Layer 2: Conversation History

Large, selectively loaded. Full session logs used for deep context retrieval.

```json
{
  "session_id": "session-882a-...",
  "project": "sharme",
  "model": "claude-4-opus",
  "platform": "cursor",
  "tags": ["storage", "architecture", "arweave"],
  "summary": "Discussed storage layer options. Decided on Arweave over IPFS for permanence and pay-once model...",
  "started": "2026-02-09T14:00:00Z",
  "ended": "2026-02-09T16:00:00Z",
  "messages": [
    {"role": "user", "content": "...", "timestamp": "..."},
    {"role": "assistant", "content": "...", "timestamp": "..."}
  ]
}
```

Typical size: megabytes to gigabytes over time. Never loaded in full. The context engine selects relevant excerpts based on the current query.

---

## 5. Saving Memory

### How Facts Are Created

Facts are created by the LLM during conversation via the `store_fact` MCP tool.

The MCP server does **not** see the conversation. MCP servers are passive tool providers. They advertise tools, wait to be called, and only see the specific arguments the LLM passes in a tool call. The MCP server has no access to the message stream between the user and the model.

The LLM knows to store facts because of two things:

**1. The tool description.** When the MCP server registers `store_fact`, it provides a description that the model reads:

```json
{
  "name": "store_fact",
  "description": "Store an important fact for long-term memory. Call this when the user expresses a preference, makes a project decision, shares architectural context, or provides information that should be remembered across sessions. Parameters: key (string), value (string), tags (string[]), scope ('global' or 'project:<name>')."
}
```

Models read tool descriptions and use them to decide when to call the tool. A well-written description is often enough for Claude and GPT-class models.

**2. A Cursor rules file (optional but recommended).** For more reliable behavior, the user adds a `.cursor/rules` file to their workspace or global config:

```
You have access to a persistent memory system.
When the user makes a decision, expresses a preference, or shares
important project context, call store_fact to remember it.
When starting a new conversation, call recall_context to check
what you already know about the current topic.
```

This is a one-time setup. It nudges the model to use the tools consistently.

### Example: Full Save Pipeline

**Setup.** You are in Cursor. The Sharme MCP server is running. Your encryption key is in the server's process memory (loaded from OS keychain on startup). Your local SQLite cache has 200 facts from previous sessions.

#### Step 1: Conversation happens, LLM stores facts

You are working on project "sharme" and you type:

> "Let's use Arweave for the storage layer instead of IPFS"

Claude discusses trade-offs with you. You settle on Arweave. Claude recognizes this is a meaningful decision and calls the MCP tool:

```
store_fact(
  key   = "sharme:storage:backend",
  value = "Using Arweave for permanent shard storage. Chose over IPFS
           because of guaranteed permanence, pay-once model, no pinning
           dependency.",
  tags  = ["storage", "arweave", "architecture", "decision"],
  scope = "project:sharme"
)
```

#### Step 2: MCP server receives the tool call

The MCP server receives only this tool call. It does not see the rest of the conversation. It:

1. Generates a UUID for the fact: `f47ac10b-58cc-4372-a567-0e02b2c3d479`
2. Sets metadata: created timestamp, confidence 1.0, access_count 0.
3. Writes the fact to the local SQLite cache immediately.
4. Returns to Claude: "Fact stored: sharme:storage:backend"

Claude tells you "Got it, I'll remember we're using Arweave." The conversation continues. Over the session, 3-5 facts get stored this way.

#### Step 3: Session ends, delta shard is built

You close the chat or enough idle time passes. The MCP server collects everything that changed during this session and builds a delta shard:

```json
{
  "shard_version": 47,
  "timestamp": "2026-02-09T16:00:00Z",
  "session_id": "session-882a-...",
  "operations": [
    {
      "op": "upsert",
      "fact_id": "f47ac10b...",
      "key": "sharme:storage:backend",
      "value": "Using Arweave for permanent shard storage. Chose over IPFS because of guaranteed permanence, pay-once model, no pinning dependency.",
      "tags": ["storage", "arweave", "architecture", "decision"],
      "scope": "project:sharme",
      "confidence": 1.0
    },
    {
      "op": "upsert",
      "fact_id": "a1b2c3d4...",
      "key": "sharme:index:approach",
      "value": "Using Arweave transaction tags as the index. No separate chain needed.",
      "tags": ["arweave", "index", "architecture", "decision"],
      "scope": "project:sharme",
      "confidence": 1.0
    },
    {
      "op": "delete",
      "key": "sharme:storage:ipfs_config"
    }
  ]
}
```

This is roughly 500 bytes of JSON. Only the changes from this session. Nothing else.

#### Step 4: Encrypt the shard

The MCP server encrypts the delta:

1. Serialize the shard to bytes (JSON, UTF-8).
2. Generate a random 12-byte nonce (IV) for this shard.
3. Encrypt with AES-256-GCM using the derived key (in memory) and the nonce.
4. Output: `nonce (12 bytes) + ciphertext + auth tag (16 bytes)`.
5. Total encrypted blob: roughly 550 bytes.

This blob is opaque. Without the key, it is indistinguishable from random noise. At ~550 bytes, it is well under the 100 KiB free upload limit on Turbo.

#### Step 5: Sign for ownership proof

The MCP server signs the shard so anyone can verify it belongs to this wallet:

1. Hash the encrypted blob: `shard_hash = SHA-256(encrypted_blob)`.
2. Sign the hash with the user's Ethereum private key: `signature = eth_sign(shard_hash)`.
3. The signature will be included as an Arweave transaction tag.

This proves the shard was uploaded by the owner of wallet `0xABC123...` without needing any on-chain transaction.

#### Step 6: Upload to Arweave

The MCP server uploads the encrypted blob to Arweave via Turbo (ArDrive's bundling service that handles Arweave transactions and accepts ETH, credit cards, and other payment methods):

```
Arweave transaction:
  data: [550 bytes of encrypted shard]
  tags:
    App-Name:    "sharme"
    Wallet:      "0xABC123..."           (owner identity)
    Version:     "47"
    Type:        "delta"                 (or "snapshot" for compaction)
    Timestamp:   "1707494400"
    Signature:   "0x7f3a..."            (ECDSA signature proving ownership)
```

The transaction is submitted through Turbo to the Arweave network. It gets a permanent transaction ID: `ar_tx_K7xJ9mN2pQ...`

Cost: **free.** Turbo subsidizes uploads under 100 KiB on mainnet. A typical delta shard is ~550 bytes. The data is now stored permanently. 200+ years. Nobody can delete it. Nobody can read it without the passphrase.

The tags serve as the index. To find all shards for this wallet, any device can query Arweave for transactions matching `App-Name: "sharme"` and `Wallet: "0xABC123..."`.

#### Summary of the save pipeline

```
You talk to Claude
       |
Claude calls store_fact() via MCP (during conversation)
       |
MCP server writes fact to local SQLite (instant, ~1ms)
       |
Session ends
       |
MCP server packages changes into a delta shard (~500 bytes JSON)
       |
Encrypts with AES-256-GCM (~550 bytes encrypted blob)
       |
Signs shard hash with Ethereum wallet (ownership proof)
       |
Uploads to Arweave via Turbo with identity tags (free under 100 KiB, permanent)
       |
Done. Fact exists in two places:
  1. Local SQLite cache (for fast reads)
  2. Arweave (permanent, encrypted, source of truth)
```

### Event Sourcing Model

Memory is not stored as a single mutable blob. It is an append-only log of encrypted shards. Each shard is a delta containing only what changed in that session. Old shards are never modified or re-uploaded. Only new deltas are written.

**Shard size cap:** Every shard is capped at 90 KiB encrypted (well under Turbo's 100 KiB free upload threshold). If a session's changes or a compaction snapshot exceeds this, the operations are automatically split into multiple shards with consecutive version numbers. This guarantees that every upload is free.

This means:

- **Zero upload cost.** Every shard stays under 100 KiB. Turbo subsidizes these uploads permanently on mainnet.
- **No redundant uploads.** Only changes are uploaded, not the full state every time.
- **Built-in version history.** The shard log IS the history. Replay to any point in time.
- **Append-only aligns with Arweave.** Arweave is immutable and permanent by design. The event sourcing model works with this property instead of against it.

### Arweave Tags as Index

There is no separate blockchain or smart contract for the index. Arweave transaction tags serve this purpose.

Every shard uploaded to Arweave carries tags identifying the owner, version, and type. To find all shards for a given wallet, query Arweave's GraphQL gateway:

```graphql
query {
  transactions(
    tags: [
      { name: "App-Name", values: ["sharme"] },
      { name: "Wallet", values: ["0xABC123..."] }
    ],
    sort: HEIGHT_ASC
  ) {
    edges {
      node {
        id
        tags { name value }
      }
    }
  }
}
```

This returns every shard for that wallet, ordered by block height. Free to query. No gas costs. The index is a natural byproduct of the shard uploads themselves.

Ownership of each shard is verified locally by recovering the signer address from the `Signature` tag and checking it matches the `Wallet` tag.

### Compaction

Over time, the shard log grows. Hundreds of shards slow down reconstruction on new devices. Periodic compaction solves this:

1. Replay all shards in order to build the current state.
2. Split the full state into chunked snapshot shards (each under 90 KiB encrypted).
3. Upload each chunk to Arweave with tag `Type: "snapshot"` and consecutive version numbers.

After compaction:
- New device sync fetches only the latest snapshot chunk(s) + any shards written after them.
- Old shards remain on Arweave (already paid for, permanent) and serve as version history.
- Each snapshot chunk stays under the free upload limit.

Compaction can be triggered manually or automatically (e.g., every 100 shards).

At typical fact sizes (~500 bytes encrypted), a single 90 KiB shard holds ~150 facts. A user with 300 facts compacts into 2 shards. A user with 1,000 facts compacts into ~7 shards. All free.

### Cost Estimates

| Item | Size | Arweave Cost | Frequency |
|---|---|---|---|
| Daily delta shards (5 sessions) | ~500 bytes each | **Free** (under 100 KiB) | Daily |
| Monthly compaction snapshot | 1-3 shards, ~90 KiB each | **Free** (each under 100 KiB) | Monthly |
| Yearly total | Hundreds of shards | **Free** | Ongoing |

**Turbo subsidizes all uploads under 100 KiB on mainnet.** Since every Sharme shard is capped at 90 KiB, typical individual use costs exactly $0. This applies to both delta shards and compaction snapshots.

The only scenario requiring payment is if a single fact's value is so large that one operation alone exceeds 90 KiB — which would be an abuse case, not normal usage.

### Funding Arweave Storage

For typical usage, **no funding is needed.** Turbo subsidizes all uploads under 100 KiB on mainnet, and every Sharme shard is capped at 90 KiB.

If a user somehow needs to upload larger items, Arweave transactions are paid through Turbo (ArDrive's bundling service). Users do not need to buy AR tokens directly. Turbo accepts ETH, SOL, credit cards, and other payment methods.

For the research prototype, Turbo testnet (Base Sepolia) is used for integration testing.

---

## 6. Retrieving Memory

### Scenario A: Same device, next day

You open Cursor. Cursor spawns the Sharme MCP server as a background subprocess (configured in `.cursor/mcp.json`). The MCP server reads the encryption key from the OS keychain silently. No passphrase prompt.

1. Opens the local SQLite cache. It has 203 facts from previous sessions.
2. Background sync: queries Arweave for the latest shard version for this wallet, compares to the local version. If the same, nothing to do. If remote is ahead (you used another device), it pulls the new shards, decrypts them, and applies the deltas.
3. MCP server is ready. This took under 1 second.

You start chatting. You say:

> "What's the architecture of the sharme project?"

Claude's system prompt (from `.cursor/rules`) tells it to check context, so it calls:

```
recall_context(topic = "sharme architecture")
```

The MCP server runs the context engine against the local SQLite cache:

**Tier 1 - Scope filter:**
```
Current working directory: /Users/dev/Projects/sharme
Filter: scope == "global" OR scope == "project:sharme"
203 facts -> 34 facts
```

**Tier 2 - Tag matching and scoring:**
```
Query keywords extracted: ["sharme", "architecture"]

Scoring each fact:

  "sharme:storage:backend" (tags: storage, arweave, architecture, decision)
     tag match: "architecture" hits         = 10 points
     recency: confirmed yesterday           =  8 points
     access_count: 2                        =  2 points
     TOTAL: 20 points

  "sharme:index:approach" (tags: arweave, index, architecture, decision)
     tag match: "architecture" hits         = 10 points
     recency: confirmed yesterday           =  8 points
     access_count: 1                        =  1 point
     TOTAL: 19 points

  "sharme:auth:strategy" (tags: auth, jwt, api, decision)
     tag match: none                        =  0 points
     recency: confirmed last week           =  4 points
     access_count: 8                        =  4 points
     TOTAL: 8 points

  ... (scores all 34 facts, sorts by score descending)
```

**Budget check:**
```
Model: claude-4-opus (200K window, 15% allocation = 30K tokens)
34 facts at ~50 tokens each = ~1,700 tokens
Everything fits. No need to cut anything.
```

The MCP server returns the 34 facts, ranked by relevance, to Claude.

**Zero network calls.** All reads hit the local SQLite cache. Took roughly 5 milliseconds. Claude now has your full project context and responds as if it remembers everything.

### Scenario B: Brand new device

You buy a new laptop. Clean machine. Nothing on it.

#### Step 1: Install

```
$ npm i -g @sharme/context
```

#### Step 2: Initialize with existing identity

```
$ sharme init --existing
> Ethereum wallet address (your identity): 0xABC123...
> Passphrase: ********
> Store passphrase in system keychain? (y/n): y
```

The `--existing` flag tells Sharme to recover context from the network, not create a fresh identity.

The passphrase is stored in the OS keychain (macOS Keychain, Windows Credential Manager, or Linux libsecret) so the MCP server can start silently in the future without prompting.

#### Step 3: Sharme finds your data on Arweave

Sharme queries Arweave's GraphQL gateway:

```graphql
query {
  transactions(
    tags: [
      { name: "App-Name", values: ["sharme"] },
      { name: "Wallet", values: ["0xABC123..."] }
    ],
    sort: HEIGHT_ASC
  ) {
    edges {
      node {
        id
        tags { name value }
      }
    }
  }
}
```

Returns every shard ever uploaded for this wallet:

```
Results:
  ar_tx_001 (version 1, type: delta)
  ar_tx_002 (version 2, type: delta)
  ...
  ar_tx_044 (version 44, type: delta)
  ar_tx_045 (version 45, type: snapshot)
  ar_tx_046 (version 46, type: delta)
  ar_tx_047 (version 47, type: delta)
```

Sharme sees the snapshot at version 45. It only needs to fetch 3 things: the snapshot + 2 deltas after it. Not all 47.

**Cost:** Free. Arweave reads cost nothing.

#### Step 4: Fetch shards from Arweave

Fetch the 3 required shards in parallel:

```
GET https://arweave.net/ar_tx_045  ->  12KB (encrypted snapshot)
GET https://arweave.net/ar_tx_046  ->  400 bytes (encrypted delta)
GET https://arweave.net/ar_tx_047  ->  450 bytes (encrypted delta)

Total download: ~13KB
Time: 1-3 seconds
```

#### Step 5: Verify ownership

For each shard, Sharme checks the `Signature` tag:

1. Hash the shard data: `shard_hash = SHA-256(encrypted_blob)`.
2. Recover the signer address from the signature: `recovered = ecrecover(shard_hash, signature)`.
3. Check `recovered == "0xABC123..."` (the wallet in the tag).
4. If mismatch, reject the shard (someone uploaded a fake one tagged with your wallet).

No blockchain needed. Standard ECDSA signature verification, done locally.

#### Step 6: Decrypt each shard

For each encrypted blob:

1. Read first 12 bytes: nonce.
2. Read last 16 bytes: auth tag.
3. Middle bytes: ciphertext.
4. Decrypt with AES-256-GCM using the derived key + nonce.
5. Verify auth tag (tamper detection).
6. Parse the resulting JSON.

If the passphrase is wrong, decryption fails (auth tag mismatch). The user gets a clear error: "Wrong passphrase." Not garbage data.

#### Step 7: Replay shards to build current state

```
Start with empty state: {}

Apply snapshot (version 45):
  Bulk insert 195 facts.
  State: { 195 facts }

Apply delta (version 46):
  upsert "sharme:encryption:algorithm" -> "AES-256-GCM"
  upsert "sharme:encryption:kdf" -> "Argon2id"
  State: { 197 facts }

Apply delta (version 47):
  upsert "sharme:storage:backend" -> "Using Arweave..."
  upsert "sharme:index:approach" -> "Arweave tags as index..."
  delete "sharme:storage:ipfs_config"
  State: { 199 facts }

Final state: 199 active facts.
```

Later shards always override earlier ones for the same key. The shard log order is the single source of truth.

#### Step 8: Populate local SQLite cache

Write all 199 facts to local SQLite. Set local version to 47. The cache is now identical to the other device.

#### Step 9: Ready

```
> Synced from Arweave: 199 facts across 3 projects.
> Passphrase stored in system keychain.
> Run: sharme serve
```

Add the MCP server to Cursor's config:

```json
{
  "mcpServers": {
    "sharme": {
      "command": "sharme",
      "args": ["serve"]
    }
  }
}
```

Open Cursor. The MCP server starts silently (reads the key from the OS keychain, no prompt). You start working as if you never changed devices.

#### Timing breakdown

| Step | Time |
|---|---|
| npm install | ~10 seconds |
| Type wallet + passphrase | ~10 seconds |
| Query Arweave for shards | ~1 second |
| Fetch 3 shards (parallel) | ~2 seconds |
| Verify signatures | ~10 milliseconds |
| Decrypt + replay | ~50 milliseconds |
| Write to SQLite | ~20 milliseconds |
| **Total** | **~24 seconds** |

---

## 7. Context Injection

Three methods for getting context into an LLM, depending on how the LLM is being used.

All three methods require a local process on the user's device. The decryption must happen locally. There is no way around this. The passphrase and derived key never leave the machine.

### Method 1: MCP Server

For MCP-compatible clients (Cursor, Claude Code, and others supporting the protocol).

MCP servers communicate over **stdio** (stdin/stdout), not HTTP. When Cursor sees the MCP config, it spawns `sharme serve` as a child process and talks to it through pipes. No port, no URL, no network endpoint. The MCP server is a local subprocess of Cursor.

```
Cursor spawns: sharme serve
       ^ stdin/stdout pipes (local, no network)
       v
Sharme MCP server (holds key, has cache)
```

The MCP server reads the encryption key from the OS keychain on startup. No interactive passphrase prompt (Cursor runs MCP servers as background processes where interactive input is not possible).

The MCP server decrypts locally and passes plaintext facts to Cursor through tool call responses. Cursor includes them in the API call to the LLM provider. The provider sees the facts in the conversation context but never sees the key or the encrypted blobs.

The MCP server acts as a **trust boundary**. It holds the key, does the crypto, and exposes only plaintext facts through tool calls. The LLM never touches the passphrase, private key, encrypted blobs, or Arweave transactions.

**MCP tools exposed:**

| Tool | Description |
|---|---|
| `recall_context(topic)` | Returns relevant facts matching the topic |
| `get_project_context(name)` | Returns all facts scoped to a project |
| `search_history(query)` | Searches conversation history for relevant sessions |
| `store_fact(key, value, tags, scope)` | Stores a new fact |
| `build_full_context()` | Returns the full structured memory for current scope |

### Method 2: API Proxy

For any tool that makes LLM API calls (custom scripts, other editors, programmatic use).

A local proxy intercepts API calls and injects context:

```
Your code calls:  POST localhost:9999/v1/messages
                         |
Sharme proxy (local):    |
  1. Reads the user's message
  2. Queries the context engine for relevant facts
  3. Prepends context to the system prompt
  4. Forwards to the real API (api.anthropic.com, api.openai.com, etc.)
  5. Captures the response
  6. Returns the response to the application
```

The application does not need to know about Sharme. It just talks to a different endpoint.

Alternatively, use Sharme as a library directly:

```python
from sharme import ContextEngine

engine = ContextEngine(passphrase="****")
context = engine.build_context(project="sharme", model="claude-4-opus")

response = anthropic.messages.create(
    system=context + your_system_prompt,
    messages=[...]
)
```

### Method 3: CLI (manual)

For web UIs (claude.ai, chatgpt.com) or one-off use.

```bash
# Export formatted context for a specific model, copy to clipboard
$ sharme context export --project sharme --model gpt-4o --clipboard
> Context copied to clipboard (23 facts, 1,847 tokens)

# Paste into the web UI as your first message
```

This is manual and has friction. A browser extension could automate the injection for web UIs, but that is out of scope for the research prototype.

### Which method for which platform

| Platform | Method | Experience |
|---|---|---|
| Cursor | MCP server | Automatic, seamless |
| Claude Code | MCP server | Automatic, seamless |
| Custom scripts / apps | Library or API proxy | Clean, programmatic |
| claude.ai (browser) | CLI export + paste | Manual, some friction |
| chatgpt.com (browser) | CLI export + paste | Manual, some friction |
| Any future MCP client | MCP server | Automatic, seamless |

---

## 8. Context Engine

The context engine decides what to load and how to format it for each model. It uses a three-tier filtering approach with no external dependencies in the default path.

### Tier 1: Scope Filter

Every fact has a scope (global or project-specific). The engine knows the current project from the working directory, git remote, or explicit user input.

```
Input:  1000 total facts
Filter: scope == "global" OR scope == "project:sharme"
Output: ~150 facts
```

This is a string match. Zero cost. No model calls. Eliminates roughly 80% of irrelevant context immediately.

### Tier 2: Tag Matching + Recency Scoring

Remaining facts are scored by relevance to the current query:

```
score = (tag_match_count * 10)
      + recency_bonus(last_confirmed)
      + frequency_bonus(access_count)
```

- **Tag matching.** Keywords from the user's message are matched against fact tags. "Fix the auth bug" matches facts tagged with "auth" and "bug".
- **Recency bonus.** Facts confirmed recently score higher. A fact from yesterday outranks one from 3 months ago.
- **Frequency bonus.** Facts accessed often are likely important.

This is keyword matching and arithmetic on local data. No model calls. Milliseconds.

### Tier 3: LLM Re-ranking (fallback)

Only triggered when Tier 2 returns significantly more facts than the context window budget allows (e.g., 80 facts competing for 20 slots).

```
Prompt to LLM:
  "Given these 80 facts and the user's current query,
   select the 20 most relevant. Return their IDs."
```

This costs one extra LLM call and is expected to be rare during normal use. For a single developer's context (hundreds to low thousands of facts), Tier 1 and Tier 2 are almost always sufficient.

### Context Window Budgeting

Each model has a known context window. The engine allocates 15-20% of that window for injected context, reserving the rest for the actual conversation.

```
Model budgets:
  claude-4-opus:  200,000 tokens -> 30,000 tokens for context
  gpt-4o:         128,000 tokens -> 19,200 tokens for context
  llama-3-8b:       8,192 tokens ->  1,600 tokens for context
```

Facts are loaded in relevance order until the budget is filled:

```
budget = model_window * allocation_percentage
loaded = []
for fact in facts_sorted_by_score:
    if total_tokens(loaded) + tokens(fact) > budget:
        break
    loaded.append(fact)
```

Small models get only the highest-signal facts. Large models get the full picture. Same data, different views.

---

## 9. Security Model

### Encryption

- **Algorithm.** AES-256-GCM (authenticated encryption).
- **Key derivation.** User passphrase processed through Argon2id (memory-hard, resistant to brute force and GPU attacks).
- **Encryption boundary.** All data is encrypted on the user's device before touching any network. Arweave only ever sees ciphertext.
- **Per-shard encryption.** Each shard is encrypted independently with a fresh nonce. Compromising one shard's plaintext reveals only that delta, not the full history.

### Key Management

The user's passphrase is the root of trust. The key lifecycle:

1. During `sharme init`, the user enters a passphrase.
2. Argon2id derives the AES-256 key from the passphrase.
3. The derived key is stored in the OS keychain (macOS Keychain, Windows Credential Manager, Linux libsecret).
4. When the MCP server starts (spawned by Cursor), it reads the key from the keychain silently.
5. The key exists in process memory while the MCP server is running.
6. When the process stops, the in-memory key is gone. The keychain retains it for next startup.

The OS keychain is protected by the user's system login (password, biometrics, or both). On macOS, the user may see a "sharme wants to access keychain" prompt on first use.

Cross-platform keychain support:

| OS | Credential Store | Protection |
|---|---|---|
| macOS | Keychain Access | Login password, TouchID |
| Windows | Credential Manager | Login password, Windows Hello |
| Linux | libsecret (GNOME Keyring / KWallet) | Login password |

There is no key escrow. No recovery service. If the passphrase is lost and the keychain is cleared, the data is unrecoverable. This is by design.

The LLM never sees the passphrase or the derived key. The MCP server is the trust boundary between encrypted storage and plaintext context.

### Storage Security

- **Arweave.** Sees only encrypted blobs and metadata tags (wallet address, version number, type). The tags reveal that a wallet uploaded a shard at a certain time, but nothing about the contents.
- **Local cache.** Encrypted at rest on disk. Decrypted only in memory during active use.

### Ownership Proof

Each shard is signed with the user's Ethereum private key before upload. The signature is stored as an Arweave transaction tag. Anyone can verify a shard belongs to a specific wallet by recovering the signer address from the signature. No on-chain transaction needed.

### Threat Model

| Threat | Mitigation |
|---|---|
| Arweave node operator reads data | Data is encrypted. Operator sees ciphertext only. |
| Someone uploads fake shards with your wallet tag | Signature verification rejects them (ECDSA recovery). |
| Device stolen | Local cache encrypted at rest. Keychain protected by OS login. |
| Passphrase brute force | Argon2id makes each guess computationally expensive. |
| Single shard compromised | Only that delta is exposed, not the full state. Event sourcing limits blast radius. |
| Arweave network failure | Local cache is a full copy. User can re-upload to a different backend. |
| LLM provider sees context | By design. Plaintext facts are sent to the LLM as part of the conversation. Encryption protects storage, not the model's processing. For full privacy during processing, use a local model. |

---

## 10. Storage Backend

### Why Arweave

| Property | Arweave | IPFS | Centralized (S3, Git) |
|---|---|---|---|
| Permanence | Guaranteed (endowment model) | Only if actively pinned | Depends on provider |
| Ongoing cost | None (pay once) | Monthly pinning fees | Monthly storage fees |
| Company dependency | None after upload | Pinning service required | Full dependency |
| Append-only friendly | Native | Neutral | Not designed for this |
| Data loss risk | Near zero | Real (garbage collection) | Provider can shut down |
| Built-in indexing | Yes (transaction tags + GraphQL) | No (need external index) | No |

Arweave serves as both the data store and the index. Transaction tags allow querying by owner, version, and type. This eliminates the need for a separate chain or smart contract for the index.

### Turbo (Bundling Service)

Direct Arweave transactions require AR tokens and are slower (wait for block confirmation). Turbo (by ArDrive) is a bundling service that:

- **Free uploads under 100 KiB** on mainnet (covers all Sharme shards).
- Accepts payment in ETH, SOL, credit cards, and other methods for larger uploads.
- Bundles multiple transactions for cheaper storage.
- Provides instant upload confirmation (data is guaranteed to reach Arweave).
- Handles the Arweave transaction mechanics transparently.
- Supports Ethereum signers via `@ardrive/turbo-sdk`.

Users interact with Turbo through Sharme. They never need to manage AR tokens directly.

### Pluggable Backend

The storage layer is behind an abstraction. Encryption happens before data reaches the backend. Backends can be swapped or combined without changing anything above the storage layer.

```
trait ContextBackend:
    write(shard_id, encrypted_blob, tags) -> transaction_id
    read(transaction_id) -> encrypted_blob
    query(wallet) -> [transaction_id]
```

Future backends could include IPFS, Filecoin, or simple HTTP storage for users who want alternatives.

---

## 11. Project Scope (Research Prototype)

### Phase 1: Core

- [x] Local SQLite cache (memory storage, dirty tracking for delta shards)
- [x] Shard creation (delta extraction from session changes)
- [x] Byte-based shard chunking (all shards capped at 90 KiB, under Turbo free tier)
- [x] Encryption (AES-256-GCM, Argon2id key derivation)
- [x] Arweave upload/download via Turbo (testnet for development, free tier on mainnet)
- [x] Arweave GraphQL queries for shard discovery
- [x] ECDSA shard signing and verification (secp256k1 identity)
- [x] Shard replay and state reconstruction
- [x] CLI: init, shard, push, pull, identity

### Phase 2: Integration

- [x] MCP server with context tools (store_fact, recall_context, delete_fact) over stdio
- [x] OS keychain integration (macOS, Windows, Linux)
- [x] Context engine (scope filter, tag matching, window budgeting, lean LLM format)
- [x] Cursor MCP config + rules file template

### Phase 3: Conversation Sync

Cross-client conversation portability. A background daemon watches local conversation files written by developer tools, shards and uploads them to Arweave, and enables retrieval from any client.

- [ ] Canonical conversation format (normalize Cursor and Claude Code transcripts into a common schema)
- [ ] File watchers for known client paths:
  - `~/.cursor/projects/*/agent-transcripts/*.txt` (Cursor, plain text)
  - `~/.claude/projects/*/*.jsonl` (Claude Code, structured JSONL)
- [ ] Delta tracking per file (byte offset tracking, only shard new content)
- [ ] Arweave tags for conversation metadata (project, client, session, timestamp, chunk index) — searchable without decrypting payload
- [ ] `recall_conversation` MCP tool — query by project/client/date, download, decrypt, truncate to context budget, inject
- [ ] `sharme import` CLI — manual import of exported conversation transcripts from any source
- [ ] Context budget truncation — if reconstructed conversation exceeds model window, return only the latest N messages that fit
- [ ] Conversation compaction — summarize old conversations into fact-sized digests for long-term retention

### Phase 4: Maturity

- [ ] Compaction (snapshot generation for facts)
- [ ] Envelope encryption (per-shard DEK wrapped by master KEK, enables key rotation without re-uploading data)
- [ ] Key rotation (rotate master key, old shards still accessible via key chain)
- [ ] History search and time travel
- [ ] API proxy for universal LLM compatibility
- [ ] Web-based funding page
- [ ] Multiple encryption keys (per-scope keys for selective sharing)
- [ ] Browser extension for web UI injection

---

## 12. Open Questions

- **Conflict resolution.** When the same fact is updated from two devices before syncing, which version wins? Last-write-wins by timestamp is simple but can lose data.
- **History storage.** Full conversation transcripts go to Arweave (encrypted, sharded). They are large but enable cross-client conversation portability. For retrieval, only the latest messages within the context budget are injected. Old conversations can be compacted into fact-sized summaries for long-term retention.
- **Identity.** Is the Ethereum wallet the user's only identity? Should there be support for multiple identities or pseudonymous use?
- **store_fact reliability.** How consistently do different models call store_fact when instructed via tool descriptions and rules files? What is the miss rate for important facts?
- **Arweave gateway reliability.** If a gateway misses a transaction or goes down, the index is temporarily incomplete. Is querying multiple gateways sufficient, or is a fallback mechanism needed?
- **Turbo dependency.** Turbo simplifies payments and uploads (and provides the free tier), but introduces a dependency on ArDrive's service. If Turbo goes down, uploads fail until an alternative is used. The `StorageBackend` interface allows swapping to direct Arweave transactions as a fallback.
- **Free tier durability.** Turbo's sub-100 KiB free uploads are a business decision, not a protocol guarantee. If ArDrive removes this subsidy, Sharme still works but users would need to fund a Turbo balance. The shard cap mechanism still provides value by keeping per-upload costs minimal.
- **Conversation file format stability.** Cursor and Claude Code store transcripts in undocumented local file formats. These can change without notice on any update. Parsers must be treated as fragile adapters that may need patching after client updates.
- **Conversation volume.** A single Claude Code session can be 1-2 MB. Heavy usage could produce 10-20 MB/day of raw transcripts. At 90 KiB/shard, that's ~150+ shards/day. All free individually, but the permanent storage footprint grows fast. Conversation compaction (summarization) is the long-term mitigation.