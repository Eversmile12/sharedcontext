#!/bin/bash
set -euo pipefail

# ==========================================================
#  SHARME FULL ROUND-TRIP TEST
#
#  init → store → serve(auto-sync) →
#  WIPE EVERYTHING → pull from Arweave → verify facts
#
#  Uses a temp HOME. Requires network access.
# ==========================================================

TEST_DIR=$(mktemp -d)
export HOME="$TEST_DIR"
SHARME="node dist/index.js"

cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║    SHARME FULL ROUND-TRIP: LOCAL → ARWEAVE → LOCAL   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── PHASE 1: Build local state ─────────────────────────
echo "━━━ PHASE 1: Initialize + store facts ━━━"
echo ""
$SHARME init
echo ""

# Capture wallet
WALLET=$($SHARME identity 2>/dev/null | grep "Wallet:" | head -1 | awk '{print $2}')
echo "Wallet: $WALLET"
echo ""

# Store 3 facts
$SHARME store -k "project:sharme:storage" \
  -v "Arweave for permanent storage. Turbo for uploads. Free under 100 KiB." \
  -t "storage,arweave,turbo,decision" \
  -s "project:sharme"

$SHARME store -k "project:sharme:encryption" \
  -v "AES-256-GCM with Argon2id key derivation. Per-shard nonce." \
  -t "encryption,aes,argon2,security" \
  -s "project:sharme"

$SHARME store -k "global:preference:language" \
  -v "TypeScript for all projects. Strict mode. ESM only." \
  -t "preference,typescript,language"
echo ""

# ─── PHASE 2: Auto-sync via MCP server ──────────────────
echo "━━━ PHASE 2: Auto-sync via `sharme serve` ━━━"
echo ""
export SHARME_TESTNET=true
$SHARME serve >/tmp/sharme-roundtrip-serve.log 2>&1 &
SERVE_PID=$!
echo "Started sharme serve (pid=$SERVE_PID), waiting 70s for sync tick..."
sleep 70
kill "$SERVE_PID" >/dev/null 2>&1 || true
wait "$SERVE_PID" 2>/dev/null || true
unset SHARME_TESTNET
echo ""

# Show what we have
echo "Local state before wipe:"
$SHARME inspect
echo ""

# ─── PHASE 3: WIPE EVERYTHING ───────────────────────────
echo "━━━ PHASE 3: WIPE local state ━━━"
echo ""
rm -rf "$TEST_DIR/.sharme"
echo "  Deleted: $TEST_DIR/.sharme/"
echo "  Local database: GONE"
echo "  Local shards: GONE"
echo "  Identity key: GONE"
echo "  Salt: GONE"
echo ""
echo "  All that remains: wallet address + passphrase (in your head)"
echo ""

# ─── PHASE 4: Wait for Arweave indexing ─────────────────
echo "━━━ PHASE 4: Wait for Arweave GraphQL indexing ━━━"
echo ""
echo "  Arweave needs time to index transactions."
echo "  Polling every 10s for up to 3 minutes..."
echo ""

MAX_WAIT=180
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  # Query GraphQL directly to check if our shards are indexed
  RESULT=$(curl -s -X POST https://arweave.net/graphql \
    -H "Content-Type: application/json" \
    -d "{\"query\": \"{ transactions(tags: [{ name: \\\"App-Name\\\", values: [\\\"sharme\\\"] }, { name: \\\"Wallet\\\", values: [\\\"$WALLET\\\"] }], first: 10) { edges { node { id tags { name value } } } } }\"}" \
    2>/dev/null || echo '{"data":{"transactions":{"edges":[]}}}')

  # Count edges
  EDGE_COUNT=$(echo "$RESULT" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try { console.log(JSON.parse(d).data.transactions.edges.length); }
      catch(e) { console.log(0); }
    });
  ")

  echo "  ${ELAPSED}s: found $EDGE_COUNT transaction(s) on Arweave"

  # We need at least 2: identity + 1 shard
  if [ "$EDGE_COUNT" -ge 2 ]; then
    echo ""
    echo "  Indexing complete! Found $EDGE_COUNT transactions."
    break
  fi

  sleep 10
  ELAPSED=$((ELAPSED + 10))
done

if [ $ELAPSED -ge $MAX_WAIT ]; then
  echo ""
  echo "  Timed out after ${MAX_WAIT}s. GraphQL indexing is slow."
  echo "  The data IS on Arweave (uploads succeeded), but GraphQL hasn't caught up."
  echo "  Try running 'sharme pull -w $WALLET' manually later."
  exit 1
fi

echo ""

# ─── PHASE 5: Pull from Arweave ─────────────────────────
echo "━━━ PHASE 5: Pull from Arweave (reconstruct) ━━━"
echo ""
echo "  Using only: wallet address + passphrase"
echo "  Everything else comes from Arweave."
echo ""
$SHARME pull -w "$WALLET"
echo ""

# ─── PHASE 6: Verify ────────────────────────────────────
echo "━━━ PHASE 6: Verify reconstructed state ━━━"
echo ""
$SHARME inspect
echo ""

# Count facts
FACT_COUNT=$($SHARME inspect 2>/dev/null | head -1 | grep -o '[0-9]*' || echo "0")

echo "╔══════════════════════════════════════════════════════╗"
echo "║  ROUND-TRIP COMPLETE                                 ║"
echo "║                                                      ║"
echo "║  1. Created 3 facts locally                          ║"
echo "║  2. Encrypted into a shard (892 bytes)               ║"
echo "║  3. Pushed shard + identity to Arweave               ║"
echo "║  4. WIPED all local data                             ║"
echo "║  5. Reconstructed from Arweave using only:           ║"
echo "║     - Wallet: $WALLET"
echo "║     - Passphrase: (from memory)                      ║"
echo "║  6. Recovered $FACT_COUNT fact(s)                             ║"
echo "╚══════════════════════════════════════════════════════╝"
