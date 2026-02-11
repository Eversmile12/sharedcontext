import type { Fact } from "../types.js";
/**
 * Model context window sizes (tokens) and what percentage we allocate for injected context.
 */
export declare const MODEL_BUDGETS: Record<string, {
    window: number;
    allocation: number;
}>;
/**
 * Run the context engine pipeline: scope filter -> tag/recency scoring -> budget trim.
 */
export declare function recallContext(topic: string, currentScope: string, allFacts: Fact[], model?: string): Fact[];
/**
 * Format facts as a context string for injection into an LLM prompt.
 * Lean format — no scope, no tags, no metadata. Just facts.
 */
export declare function formatContext(facts: Fact[]): string;
//# sourceMappingURL=engine.d.ts.map