import type { Conversation } from "../types.js";
export interface WatcherCallback {
    (conversation: Conversation): void;
}
export interface ConversationFileRef {
    path: string;
    client: "cursor" | "claude-code";
    project: string;
    fileId: string;
}
/**
 * ConversationWatcher polls known Cursor and Claude Code directories
 * for new or updated conversation files. When changes are detected,
 * it parses only the new content and fires the callback.
 */
export declare class ConversationWatcher {
    private fileStates;
    private callback;
    private timer;
    private intervalMs;
    constructor(callback: WatcherCallback, intervalMs?: number);
    start(): void;
    stop(): void;
    private poll;
    private checkFile;
    /** Public utility for one-shot discovery (used by recall tool fallback). */
    discoverAllConversationFiles(): ConversationFileRef[];
    /** Discover Cursor agent transcript files. */
    private discoverCursorFiles;
    /** Discover Claude Code conversation files. */
    private discoverClaudeCodeFiles;
}
//# sourceMappingURL=watcher.d.ts.map