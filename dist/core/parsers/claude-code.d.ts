import type { Conversation } from "../../types.js";
/**
 * Parse a Claude Code session JSONL file into a Conversation.
 *
 * Format: one JSON object per line.
 *   type: "user"      → message.content is string or content block array
 *   type: "assistant"  → message.content is content block array (text, tool_use)
 *   type: "file-history-snapshot" → skip
 *
 * Each line also has: sessionId, cwd, timestamp, uuid
 *
 * We extract only text content from user and assistant messages.
 * Tool use blocks and tool results are skipped.
 */
export declare function parseClaudeCodeJSONL(text: string, fileId: string, project: string): Conversation;
//# sourceMappingURL=claude-code.d.ts.map