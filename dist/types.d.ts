export interface Fact {
    id: string;
    scope: string;
    key: string;
    value: string;
    tags: string[];
    confidence: number;
    source_session: string | null;
    created: string;
    last_confirmed: string;
    access_count: number;
}
export interface ShardOperation {
    op: "upsert" | "delete";
    fact_id?: string;
    key: string;
    value?: string;
    tags?: string[];
    scope?: string;
    confidence?: number;
}
export interface Shard {
    shard_version: number;
    timestamp: string;
    session_id: string;
    operations: ShardOperation[];
}
export interface ConversationMessage {
    role: "user" | "assistant" | "tool";
    content: string;
    timestamp?: string;
}
export interface Conversation {
    id: string;
    client: "cursor" | "claude-code";
    project: string;
    messages: ConversationMessage[];
    startedAt: string;
    updatedAt: string;
}
//# sourceMappingURL=types.d.ts.map