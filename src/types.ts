export interface Fact {
  id: string;
  scope: string; // "global" | "project:<name>"
  key: string; // unique identifier like "singlecontext:storage:backend"
  value: string;
  tags: string[];
  confidence: number;
  source_session: string | null;
  created: string; // ISO 8601
  last_confirmed: string; // ISO 8601
  access_count: number;
}

export interface ShardOperation {
  op: "upsert" | "delete";
  fact_id?: string;
  key: string;
  // Fields below only present for upsert
  value?: string;
  tags?: string[];
  scope?: string;
  confidence?: number;
}

export interface Shard {
  shard_version: number;
  timestamp: string; // ISO 8601
  session_id: string;
  operations: ShardOperation[];
}

// ── Conversation types ───────────────────────────────────

export interface ConversationMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp?: string; // ISO 8601 if available
}

export interface Conversation {
  id: string; // session/file ID
  client: "cursor" | "claude-code";
  project: string; // folder name
  messages: ConversationMessage[];
  startedAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
