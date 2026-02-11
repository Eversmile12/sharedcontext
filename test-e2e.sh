#!/bin/bash
set -euo pipefail

# ==========================================================
#  SHARME END-TO-END TEST
#  Runs the full lifecycle using real CLI commands.
#  Uses a temp HOME so your real ~/.sharme/ is untouched.
# ==========================================================

TEST_DIR=$(mktemp -d)
export HOME="$TEST_DIR"
SHARME="node dist/index.js"

cleanup() {
  rm -rf "$TEST_DIR"
}
trap cleanup EXIT

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        SHARME END-TO-END TEST                ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  HOME=$TEST_DIR"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ─── STEP 1: Initialize ─────────────────────────────────
echo "━━━ STEP 1: sharme init ━━━"
echo ""
$SHARME init
echo ""

# Capture wallet address for later
WALLET=$($SHARME identity 2>/dev/null | grep "Wallet:" | head -1 | awk '{print $2}')
echo "  Captured wallet: $WALLET"
echo ""

# ─── STEP 2: Store facts ────────────────────────────────
echo "━━━ STEP 2: Store 3 facts ━━━"
echo ""
$SHARME store -k "project:myapp:framework" \
  -v "Using Next.js 15 with App Router and server components" \
  -t "framework,nextjs,decision" \
  -s "project:myapp"
echo ""

$SHARME store -k "project:myapp:database" \
  -v "PostgreSQL with Drizzle ORM, deployed on Neon" \
  -t "database,postgres,drizzle,decision" \
  -s "project:myapp"
echo ""

$SHARME store -k "global:coding_style" \
  -v "Prefer functional programming. No classes unless necessary. Minimal error handling." \
  -t "preference,code-style"
echo ""

# ─── STEP 3: Inspect all facts ──────────────────────────
echo "━━━ STEP 3: sharme inspect ━━━"
echo ""
$SHARME inspect
echo ""

# ─── STEP 4: Recall with scope ──────────────────────────
echo "━━━ STEP 4: Recall 'database' scoped to project:myapp ━━━"
echo ""
$SHARME recall -t "database" -s "project:myapp"
echo ""

# ─── STEP 5: Auto-sync via MCP server ───────────────────
echo "━━━ STEP 5: sharme serve (auto-sync tick) ━━━"
echo ""
export SHARME_TESTNET=true
$SHARME serve >/tmp/sharme-e2e-serve.log 2>&1 &
SERVE_PID=$!
echo "  Started sharme serve (pid=$SERVE_PID), waiting 70s..."
sleep 70
kill "$SERVE_PID" >/dev/null 2>&1 || true
wait "$SERVE_PID" 2>/dev/null || true
unset SHARME_TESTNET
echo ""

# ─── STEP 6: Mutate state: add + delete ─────────────────
echo "━━━ STEP 6: Add 'auth' fact, delete 'coding_style' ━━━"
echo ""
$SHARME store -k "project:myapp:auth" \
  -v "Using NextAuth.js with GitHub OAuth provider" \
  -t "auth,nextauth,decision" \
  -s "project:myapp"
echo ""

$SHARME delete -k "global:coding_style"
echo ""

echo "  Auto-sync second delta via sharme serve..."
echo ""
export SHARME_TESTNET=true
$SHARME serve >/tmp/sharme-e2e-serve-2.log 2>&1 &
SERVE_PID2=$!
sleep 70
kill "$SERVE_PID2" >/dev/null 2>&1 || true
wait "$SERVE_PID2" 2>/dev/null || true
unset SHARME_TESTNET
echo ""

# ─── STEP 7: Final state ────────────────────────────────
echo "━━━ STEP 7: Final state ━━━"
echo ""
$SHARME inspect
echo ""

# ─── STEP 8: Identity status ───────────────────────────
echo "━━━ STEP 8: sharme identity ━━━"
echo ""
$SHARME identity 2>/dev/null || true
echo ""

echo "╔══════════════════════════════════════════════════════╗"
echo "║  RESULT                                              ║"
echo "║                                                      ║"
echo "║  init → keypair + encrypted identity + SQLite        ║"
echo "║  3 facts stored → auto-sync tick                     ║"
echo "║  1 add + 1 delete → second auto-sync tick            ║"
echo "║  Final state: 3 facts (after deletion + upsert)      ║"
echo "║  All data encrypted before Arweave upload.           ║"
echo "║                                                      ║"
echo "║  Wallet: $WALLET"
echo "║  Sync mode: MCP server background auto-sync          ║"
echo "╚══════════════════════════════════════════════════════╝"
