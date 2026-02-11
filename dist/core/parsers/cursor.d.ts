import type { Conversation } from "../../types.js";
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
export declare function parseCursorTranscript(text: string, fileId: string, project: string): Conversation;
//# sourceMappingURL=cursor.d.ts.map