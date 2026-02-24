import type { Conversation, ConversationMessage } from "../../types.js";

/**
 * Parse a Cursor agent transcript (.txt) into a Conversation.
 *
 * Format:
 *   user:
 *   <user_query>
 *   ...message...
 *   </user_query>
 *
 *   assistant:
 *   [Thinking] ...
 *   ...message...
 *   [Tool call] ToolName
 *     arg: value
 *
 *   [Tool result] ToolName
 *   ...
 *
 * We extract only user and assistant text content.
 * Tool calls, tool results, and thinking blocks are stripped.
 */
export function parseCursorTranscript(
  text: string,
  fileId: string,
  project: string
): Conversation {
  const messages: ConversationMessage[] = [];
  const lines = text.split("\n");

  let currentRole: "user" | "assistant" | null = null;
  let currentContent: string[] = [];
  let inToolBlock = false;

  function flush() {
    if (currentRole && currentContent.length > 0) {
      const content = currentContent.join("\n").trim();
      if (content) {
        messages.push({ role: currentRole, content });
      }
    }
    currentContent = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Role label on its own line
    if (trimmed === "user:") {
      flush();
      currentRole = "user";
      inToolBlock = false;
      continue;
    }

    if (trimmed === "assistant:") {
      flush();
      currentRole = "assistant";
      inToolBlock = false;
      continue;
    }

    // Skip tool call/result blocks entirely
    if (trimmed.startsWith("[Tool call]") || trimmed.startsWith("[Tool result]")) {
      flush();
      inToolBlock = true;
      continue;
    }

    // Tool block arguments (indented lines after [Tool call])
    if (inToolBlock) {
      // Tool blocks end at the next empty line or role label
      if (trimmed === "") {
        inToolBlock = false;
      }
      continue;
    }

    if (trimmed === "<user_query>" || trimmed === "</user_query>") {
      continue;
    }

    // Strip [Thinking] prefix but keep the rest as it's useful context
    if (currentRole === "assistant" && trimmed.startsWith("[Thinking]")) {
      // Skip thinking blocks — they're internal reasoning
      continue;
    }

    // Accumulate content
    if (currentRole) {
      currentContent.push(line);
    }
  }

  flush();

  const merged = mergeConsecutiveMessages(messages);
  const now = new Date().toISOString();
  return {
    id: fileId,
    client: "cursor",
    project,
    messages: merged,
    startedAt: now,
    updatedAt: now,
  };
}

/**
 * Merge consecutive messages with the same role into a single message.
 * Common in both Cursor and Claude Code transcripts where tool calls
 * split assistant responses into multiple segments.
 */
export function mergeConsecutiveMessages(
  messages: ConversationMessage[]
): ConversationMessage[] {
  const merged: ConversationMessage[] = [];
  for (const msg of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === msg.role) {
      last.content += "\n\n" + msg.content;
    } else {
      merged.push({ ...msg });
    }
  }
  return merged;
}
