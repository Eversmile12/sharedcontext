import { decrypt } from "../core/crypto.js";
import {
  downloadShard,
  queryConversationShare,
  queryTransactionTagsById,
} from "../core/arweave.js";
import {
  hasSharedConversationImport,
  openDatabase,
  saveSharedConversationImport,
} from "../core/db.js";
import { verifySignature } from "../core/identity.js";
import {
  decodeShareToken,
  extractToken,
  type ConversationSharePayload,
} from "./share.js";
import { ensureInitialized } from "./util.js";
import type { Conversation } from "../types.js";

const MAX_SHARE_BYTES = 2 * 1024 * 1024;

export async function syncCommand(urlOrToken: string): Promise<void> {
  const dbPath = ensureInitialized();

  const token = extractToken(urlOrToken);
  const decoded = decodeShareToken(token);
  let txId = decoded.txId;
  let encrypted: Uint8Array | null = null;
  let shareWallet = "";
  let shareSignature = "";
  let resolvedShareId = "";

  if (txId) {
    try {
      const txMeta = await queryTransactionTagsById(txId);
      if (!txMeta) {
        throw new Error(`No transaction metadata found for tx id: ${txId}`);
      }
      const type = txMeta.tags.get("Type") ?? "";
      const tagShareId = txMeta.tags.get("Share-Id") ?? "";
      const wallet = txMeta.tags.get("Wallet") ?? "";
      const signature = txMeta.tags.get("Signature")?.trim() ?? "";
      if (type !== "conversation-share") {
        throw new Error("Transaction is not a conversation share.");
      }
      if (tagShareId !== decoded.shareId) {
        throw new Error("Share token does not match transaction share id.");
      }
      if (!wallet || !signature) {
        throw new Error("Share transaction is missing signer metadata.");
      }
      encrypted = await downloadShard(txId, MAX_SHARE_BYTES);
      shareWallet = wallet;
      shareSignature = signature;
      resolvedShareId = tagShareId;
    } catch {
      // Fall back to Share-Id lookup for eventual consistency or stale tx references.
      encrypted = null;
    }
  }

  if (!encrypted) {
    const shareInfo = await queryConversationShare(decoded.shareId);
    if (!shareInfo) {
      throw new Error(`No share found for id: ${decoded.shareId}`);
    }
    if (!shareInfo.wallet || !shareInfo.signature) {
      throw new Error("Share transaction is missing signer metadata.");
    }
    txId = shareInfo.txId;
    resolvedShareId = shareInfo.shareId;
    shareWallet = shareInfo.wallet;
    shareSignature = shareInfo.signature;
    encrypted = await downloadShard(txId, MAX_SHARE_BYTES);
  }

  const valid = verifySignature(encrypted, shareSignature, shareWallet);
  if (!valid) {
    throw new Error("Share signature verification failed.");
  }

  let payload: ConversationSharePayload;
  try {
    const decrypted = decrypt(encrypted, decoded.key);
    payload = JSON.parse(new TextDecoder().decode(decrypted)) as ConversationSharePayload;
  } catch {
    throw new Error("Could not decrypt shared payload. Token may be invalid.");
  }

  const conversation = validatePayload(payload);
  const db = openDatabase(dbPath);
  const alreadyImported = hasSharedConversationImport(db, resolvedShareId);
  if (alreadyImported) {
    db.close();
    console.log("Share already imported.");
    return;
  }

  saveSharedConversationImport(db, {
    shareId: resolvedShareId,
    txId: txId ?? "unknown",
    conversation,
  });
  db.close();

  console.log("Conversation imported.\n");
  console.log(`  Share ID:     ${resolvedShareId}`);
  console.log(`  Conversation: ${conversation.id} (${conversation.client})`);
  console.log(`  Project:      ${conversation.project}`);
  console.log(`  Messages:     ${conversation.messages.length}`);
}

function validatePayload(payload: ConversationSharePayload): Conversation {
  if (payload.v !== 1 || !payload.conversation) {
    throw new Error("Invalid share payload version.");
  }
  const conversation = payload.conversation;
  if (
    typeof conversation.id !== "string" ||
    (conversation.client !== "cursor" && conversation.client !== "claude-code") ||
    typeof conversation.project !== "string" ||
    !Array.isArray(conversation.messages) ||
    typeof conversation.startedAt !== "string" ||
    typeof conversation.updatedAt !== "string"
  ) {
    throw new Error("Invalid conversation payload.");
  }
  return conversation;
}
