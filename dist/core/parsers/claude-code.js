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
export function parseClaudeCodeJSONL(text, fileId, project) {
    const messages = [];
    const lines = text.split("\n").filter((l) => l.trim());
    let firstTimestamp = null;
    let lastTimestamp = null;
    for (const line of lines) {
        let obj;
        try {
            obj = JSON.parse(line);
        }
        catch {
            continue; // skip malformed lines
        }
        const type = obj.type;
        const timestamp = obj.timestamp ?? null;
        if (timestamp) {
            if (!firstTimestamp)
                firstTimestamp = timestamp;
            lastTimestamp = timestamp;
        }
        if (type === "user") {
            const content = extractUserContent(obj);
            if (content) {
                messages.push({ role: "user", content, timestamp: timestamp ?? undefined });
            }
        }
        else if (type === "assistant") {
            const content = extractAssistantContent(obj);
            if (content) {
                messages.push({ role: "assistant", content, timestamp: timestamp ?? undefined });
            }
        }
        // Skip file-history-snapshot, system, etc.
    }
    // Merge consecutive same-role messages
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
        client: "claude-code",
        project,
        messages: merged,
        startedAt: firstTimestamp ?? now,
        updatedAt: lastTimestamp ?? now,
    };
}
function extractUserContent(obj) {
    const message = obj.message;
    if (!message)
        return null;
    const content = message.content;
    if (typeof content === "string") {
        return content.trim() || null;
    }
    if (Array.isArray(content)) {
        const texts = [];
        for (const block of content) {
            if (typeof block === "object" && block !== null) {
                const b = block;
                // Skip tool_result blocks — they're automated responses
                if (b.type === "tool_result")
                    continue;
                if (b.type === "text" && typeof b.text === "string") {
                    texts.push(b.text);
                }
            }
        }
        const joined = texts.join("\n").trim();
        return joined || null;
    }
    return null;
}
function extractAssistantContent(obj) {
    const message = obj.message;
    if (!message)
        return null;
    const content = message.content;
    if (!Array.isArray(content))
        return null;
    const texts = [];
    for (const block of content) {
        if (typeof block === "object" && block !== null) {
            const b = block;
            // Only extract text blocks — skip tool_use
            if (b.type === "text" && typeof b.text === "string") {
                texts.push(b.text);
            }
        }
    }
    const joined = texts.join("\n").trim();
    return joined || null;
}
//# sourceMappingURL=claude-code.js.map