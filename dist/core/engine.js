/**
 * Model context window sizes (tokens) and what percentage we allocate for injected context.
 */
export const MODEL_BUDGETS = {
    "claude-4-opus": { window: 200_000, allocation: 0.15 },
    "claude-4-sonnet": { window: 200_000, allocation: 0.15 },
    "claude-3.5-sonnet": { window: 200_000, allocation: 0.15 },
    "gpt-4o": { window: 128_000, allocation: 0.15 },
    "gpt-4o-mini": { window: 128_000, allocation: 0.15 },
    "llama-3-70b": { window: 128_000, allocation: 0.15 },
    "llama-3-8b": { window: 8_192, allocation: 0.20 },
    default: { window: 128_000, allocation: 0.15 },
};
/** Rough estimate: ~50 tokens per fact on average. */
const TOKENS_PER_FACT = 50;
/**
 * Extract keywords from a topic string for tag matching.
 */
function extractKeywords(topic) {
    return topic
        .toLowerCase()
        .split(/[\s,.:;]+/)
        .filter((w) => w.length > 1);
}
/**
 * Score a fact's relevance based on tag matches, recency, and access frequency.
 */
function scoreFact(fact, keywords) {
    // Tag match score: 10 points per matching tag
    const tagMatches = fact.tags.filter((tag) => keywords.some((kw) => tag.toLowerCase().includes(kw) || kw.includes(tag.toLowerCase()))).length;
    const tagScore = tagMatches * 10;
    // Key match: 5 points if keyword appears in the fact key
    const keyMatchScore = keywords.some((kw) => fact.key.toLowerCase().includes(kw)) ? 5 : 0;
    // Recency: 0-10 points. Full score if confirmed today, decays over 30 days.
    const daysSinceConfirmed = (Date.now() - new Date(fact.last_confirmed).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 10 - daysSinceConfirmed / 3);
    // Frequency: log scale, capped at 5 points
    const frequencyScore = Math.min(5, Math.log2(fact.access_count + 1));
    return tagScore + keyMatchScore + recencyScore + frequencyScore;
}
/**
 * Run the context engine pipeline: scope filter -> tag/recency scoring -> budget trim.
 */
export function recallContext(topic, currentScope, allFacts, model) {
    // Tier 1: Scope filter
    const scopeFiltered = allFacts.filter((f) => f.scope === "global" || f.scope === currentScope);
    // Tier 2: Score and sort
    const keywords = extractKeywords(topic);
    const scored = scopeFiltered.map((fact) => ({
        fact,
        score: scoreFact(fact, keywords),
    }));
    scored.sort((a, b) => b.score - a.score);
    // Tier 3: Budget trim
    const budget = getTokenBudget(model);
    const maxFacts = Math.floor(budget / TOKENS_PER_FACT);
    const trimmed = scored.slice(0, maxFacts);
    return trimmed.map((s) => s.fact);
}
function getTokenBudget(model) {
    const config = model ? (MODEL_BUDGETS[model] ?? MODEL_BUDGETS.default) : MODEL_BUDGETS.default;
    return Math.floor(config.window * config.allocation);
}
/**
 * Strip the scope prefix from a fact key to get a short, readable label.
 * "project:sharedcontext:storage:backend" → "storage backend"
 * "global:coding_style"           → "coding style"
 */
function simplifyKey(key, scope) {
    let simplified = key;
    // Remove scope prefix: "project:sharedcontext:" or "global:"
    if (scope.startsWith("project:")) {
        const prefix = scope.replace("project:", "") + ":";
        if (simplified.startsWith(prefix)) {
            simplified = simplified.slice(prefix.length);
        }
    }
    if (simplified.startsWith("global:")) {
        simplified = simplified.slice("global:".length);
    }
    // Also strip a leading project name if the key was "project:name:rest"
    if (simplified.startsWith("project:")) {
        simplified = simplified.replace(/^project:[^:]+:/, "");
    }
    // Replace remaining colons and underscores with spaces
    return simplified.replace(/[:_]/g, " ").trim();
}
/**
 * Format facts as a context string for injection into an LLM prompt.
 * Lean format — no scope, no tags, no metadata. Just facts.
 */
export function formatContext(facts) {
    if (facts.length === 0)
        return "";
    const lines = facts.map((f) => `- ${simplifyKey(f.key, f.scope)}: ${f.value}`);
    return `[MEMORY]\n${lines.join("\n")}\n[/MEMORY]`;
}
//# sourceMappingURL=engine.js.map