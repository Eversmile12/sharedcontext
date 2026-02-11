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
export function parseCursorTranscript(text, fileId, project) {
    const messages = [];
    const lines = text.split("\n");
    let currentRole = null;
    let currentContent = [];
    let inToolBlock = false;
    let inUserQuery = false;
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
            inUserQuery = false;
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
        // Strip <user_query> / </user_query> tags
        if (trimmed === "<user_query>") {
            inUserQuery = true;
            continue;
        }
        if (trimmed === "</user_query>") {
            inUserQuery = false;
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
    // Merge consecutive same-role messages (common in Cursor transcripts
    // where assistant has multiple tool-call-interrupted segments)
    const merged = [];
    for (const msg of messages) {
        const last = merged[merged.length - 1];
        if (last && last.role === msg.role) {
            last.content += "\n\n" + msg.content;
        }
        else {
            merged.push({ ...msg });
        }
    }
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
//# sourceMappingURL=cursor.js.map