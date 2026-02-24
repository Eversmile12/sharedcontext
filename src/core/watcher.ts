import { readdirSync, statSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { parseCursorTranscript, parseCursorJSONL } from "./parsers/cursor.js";
import { parseClaudeCodeJSONL } from "./parsers/claude-code.js";
import type { Conversation } from "../types.js";

interface FileState {
  path: string;
  lastSize: number;
  lastModified: number;
}

export interface WatcherCallback {
  (conversation: Conversation): void;
}

export interface ConversationFileRef {
  path: string;
  client: "cursor" | "claude-code";
  format: "txt" | "jsonl";
  project: string;
  fileId: string;
}

/**
 * Discover all conversation files across Cursor and Claude Code directories.
 */
export function discoverConversationFiles(): ConversationFileRef[] {
  return [...discoverCursorFiles(), ...discoverClaudeCodeFiles()];
}

function discoverCursorFiles(): ConversationFileRef[] {
  const results: ConversationFileRef[] = [];
  const cursorDir = join(homedir(), ".cursor", "projects");

  if (!existsSync(cursorDir)) return results;

  try {
    for (const projectDir of readdirSync(cursorDir)) {
      const transcriptsDir = join(cursorDir, projectDir, "agent-transcripts");
      if (!existsSync(transcriptsDir)) continue;

      const project = projectDir.split("-").pop() ?? projectDir;

      for (const entry of readdirSync(transcriptsDir)) {
        const entryPath = join(transcriptsDir, entry);

        if (entry.endsWith(".txt")) {
          results.push({
            path: entryPath,
            client: "cursor",
            format: "txt",
            project,
            fileId: entry.replace(".txt", ""),
          });
          continue;
        }

        // New format: directory containing <uuid>.jsonl
        try {
          if (!statSync(entryPath).isDirectory()) continue;
        } catch {
          continue;
        }
        const jsonlPath = join(entryPath, `${entry}.jsonl`);
        if (existsSync(jsonlPath)) {
          results.push({
            path: jsonlPath,
            client: "cursor",
            format: "jsonl",
            project,
            fileId: entry,
          });
        }
      }
    }
  } catch {
    // Directory access error — skip
  }

  return results;
}

function discoverClaudeCodeFiles(): ConversationFileRef[] {
  const results: ConversationFileRef[] = [];
  const claudeDir = join(homedir(), ".claude", "projects");

  if (!existsSync(claudeDir)) return results;

  try {
    for (const projectDir of readdirSync(claudeDir)) {
      const fullProjectDir = join(claudeDir, projectDir);
      const stat = statSync(fullProjectDir);
      if (!stat.isDirectory()) continue;

      const project = projectDir.split("-").pop() ?? projectDir;

      for (const file of readdirSync(fullProjectDir)) {
        if (!file.endsWith(".jsonl")) continue;
        const filePath = join(fullProjectDir, file);
        const fileStat = statSync(filePath);
        if (fileStat.size === 0) continue;

        results.push({
          path: filePath,
          client: "claude-code",
          format: "jsonl",
          project,
          fileId: file.replace(".jsonl", ""),
        });
      }
    }
  } catch {
    // Directory access error — skip
  }

  return results;
}

/**
 * ConversationWatcher polls known Cursor and Claude Code directories
 * for new or updated conversation files. When changes are detected,
 * it parses only the new content and fires the callback.
 */
export class ConversationWatcher {
  private fileStates = new Map<string, FileState>();
  private callback: WatcherCallback;
  private timer: ReturnType<typeof setInterval> | null = null;
  private intervalMs: number;

  constructor(callback: WatcherCallback, intervalMs = 30_000) {
    this.callback = callback;
    this.intervalMs = intervalMs;
  }

  start(): void {
    this.poll();
    this.timer = setInterval(() => this.poll(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private poll(): void {
    for (const file of discoverConversationFiles()) {
      this.checkFile(file);
    }
  }

  private checkFile(file: ConversationFileRef): void {
    try {
      const stat = statSync(file.path);
      const existing = this.fileStates.get(file.path);

      if (existing && stat.size === existing.lastSize && stat.mtimeMs === existing.lastModified) {
        return;
      }

      const content = readFileSync(file.path, "utf-8");

      let conversation: Conversation;
      if (file.client === "claude-code") {
        conversation = parseClaudeCodeJSONL(content, file.fileId, file.project);
      } else if (file.format === "jsonl") {
        conversation = parseCursorJSONL(content, file.fileId, file.project);
      } else {
        conversation = parseCursorTranscript(content, file.fileId, file.project);
      }

      if (conversation.messages.length > 0) {
        this.fileStates.set(file.path, {
          path: file.path,
          lastSize: stat.size,
          lastModified: stat.mtimeMs,
        });

        this.callback(conversation);
      }
    } catch {
      // File disappeared or unreadable — skip silently
    }
  }
}
