import { readdirSync, statSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { parseCursorTranscript } from "./parsers/cursor.js";
import { parseClaudeCodeJSONL } from "./parsers/claude-code.js";
/**
 * ConversationWatcher polls known Cursor and Claude Code directories
 * for new or updated conversation files. When changes are detected,
 * it parses only the new content and fires the callback.
 */
export class ConversationWatcher {
    fileStates = new Map();
    callback;
    timer = null;
    intervalMs;
    constructor(callback, intervalMs = 30_000) {
        this.callback = callback;
        this.intervalMs = intervalMs;
    }
    start() {
        // Run immediately on start
        this.poll();
        this.timer = setInterval(() => this.poll(), this.intervalMs);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    poll() {
        const cursorFiles = this.discoverCursorFiles();
        const claudeFiles = this.discoverClaudeCodeFiles();
        for (const file of [...cursorFiles, ...claudeFiles]) {
            this.checkFile(file);
        }
    }
    checkFile(file) {
        try {
            const stat = statSync(file.path);
            const existing = this.fileStates.get(file.path);
            if (existing && stat.size === existing.lastSize && stat.mtimeMs === existing.lastModified) {
                return; // No change
            }
            // Read full file content (for first read or updated files)
            // For conversations, we always re-parse the full file since
            // partial parsing of these formats is fragile
            const content = readFileSync(file.path, "utf-8");
            let conversation;
            if (file.client === "cursor") {
                conversation = parseCursorTranscript(content, file.fileId, file.project);
            }
            else {
                conversation = parseClaudeCodeJSONL(content, file.fileId, file.project);
            }
            // Only fire callback if there are actual messages
            if (conversation.messages.length > 0) {
                // Update state tracking
                this.fileStates.set(file.path, {
                    path: file.path,
                    lastSize: stat.size,
                    lastModified: stat.mtimeMs,
                });
                this.callback(conversation);
            }
        }
        catch {
            // File disappeared or unreadable — skip silently
        }
    }
    /** Public utility for one-shot discovery (used by recall tool fallback). */
    discoverAllConversationFiles() {
        return [...this.discoverCursorFiles(), ...this.discoverClaudeCodeFiles()];
    }
    /** Discover Cursor agent transcript files. */
    discoverCursorFiles() {
        const results = [];
        const cursorDir = join(homedir(), ".cursor", "projects");
        if (!existsSync(cursorDir))
            return results;
        try {
            for (const projectDir of readdirSync(cursorDir)) {
                const transcriptsDir = join(cursorDir, projectDir, "agent-transcripts");
                if (!existsSync(transcriptsDir))
                    continue;
                // Extract project name from the directory name (e.g., "Users-vitto-Projects-sharme" → "sharme")
                const project = projectDir.split("-").pop() ?? projectDir;
                for (const file of readdirSync(transcriptsDir)) {
                    if (!file.endsWith(".txt"))
                        continue;
                    results.push({
                        path: join(transcriptsDir, file),
                        client: "cursor",
                        project,
                        fileId: file.replace(".txt", ""),
                    });
                }
            }
        }
        catch {
            // Directory access error — skip
        }
        return results;
    }
    /** Discover Claude Code conversation files. */
    discoverClaudeCodeFiles() {
        const results = [];
        const claudeDir = join(homedir(), ".claude", "projects");
        if (!existsSync(claudeDir))
            return results;
        try {
            for (const projectDir of readdirSync(claudeDir)) {
                const fullProjectDir = join(claudeDir, projectDir);
                const stat = statSync(fullProjectDir);
                if (!stat.isDirectory())
                    continue;
                // Extract project name (e.g., "-Users-vitto-Projects-keyboard-builder" → "keyboard-builder")
                const project = projectDir.split("-").pop() ?? projectDir;
                for (const file of readdirSync(fullProjectDir)) {
                    if (!file.endsWith(".jsonl"))
                        continue;
                    // Skip empty files
                    const filePath = join(fullProjectDir, file);
                    const fileStat = statSync(filePath);
                    if (fileStat.size === 0)
                        continue;
                    results.push({
                        path: filePath,
                        client: "claude-code",
                        project,
                        fileId: file.replace(".jsonl", ""),
                    });
                }
            }
        }
        catch {
            // Directory access error — skip
        }
        return results;
    }
}
//# sourceMappingURL=watcher.js.map