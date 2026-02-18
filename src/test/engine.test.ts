import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recallContext, formatContext, MODEL_BUDGETS } from "../core/engine.js";
import type { Fact } from "../types.js";

function makeFact(overrides: Partial<Fact> = {}): Fact {
  return {
    id: "id-1",
    scope: "global",
    key: "test:key",
    value: "test value",
    tags: [],
    confidence: 1.0,
    source_session: null,
    created: new Date().toISOString(),
    last_confirmed: new Date().toISOString(),
    access_count: 0,
    ...overrides,
  };
}

describe("engine", () => {
  describe("scope filtering", () => {
    const facts = [
      makeFact({ key: "global-fact", scope: "global" }),
      makeFact({ key: "singlecontext-fact", id: "id-s", scope: "project:singlecontext" }),
      makeFact({ key: "other-fact", id: "id-o", scope: "project:other" }),
    ];

    it("includes global facts for any scope", () => {
      const result = recallContext("anything", "project:singlecontext", facts);
      const keys = result.map((f) => f.key);
      assert.ok(keys.includes("global-fact"));
    });

    it("includes matching scope facts", () => {
      const result = recallContext("anything", "project:singlecontext", facts);
      const keys = result.map((f) => f.key);
      assert.ok(keys.includes("singlecontext-fact"));
    });

    it("excludes non-matching scope facts", () => {
      const result = recallContext("anything", "project:singlecontext", facts);
      const keys = result.map((f) => f.key);
      assert.ok(!keys.includes("other-fact"));
    });
  });

  describe("tag scoring", () => {
    it("facts with matching tags rank higher", () => {
      const facts = [
        makeFact({ key: "irrelevant", id: "id-1", tags: ["cooking", "food"] }),
        makeFact({ key: "relevant", id: "id-2", tags: ["storage", "arweave"] }),
      ];
      const result = recallContext("storage backend", "global", facts);
      assert.equal(result[0].key, "relevant");
    });

    it("more tag matches = higher rank", () => {
      const facts = [
        makeFact({ key: "one-match", id: "id-1", tags: ["storage"] }),
        makeFact({ key: "two-matches", id: "id-2", tags: ["storage", "arweave"] }),
      ];
      const result = recallContext("storage arweave", "global", facts);
      assert.equal(result[0].key, "two-matches");
    });
  });

  describe("key matching", () => {
    it("facts with keyword in key score higher", () => {
      const facts = [
        makeFact({ key: "user:name", id: "id-1", tags: [] }),
        makeFact({ key: "storage:backend", id: "id-2", tags: [] }),
      ];
      const result = recallContext("storage", "global", facts);
      assert.equal(result[0].key, "storage:backend");
    });
  });

  describe("recency scoring", () => {
    it("recently confirmed facts rank higher than old ones (all else equal)", () => {
      const now = new Date();
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const facts = [
        makeFact({ key: "old", id: "id-old", tags: ["db"], last_confirmed: monthAgo.toISOString() }),
        makeFact({ key: "new", id: "id-new", tags: ["db"], last_confirmed: now.toISOString() }),
      ];
      const result = recallContext("db", "global", facts);
      assert.equal(result[0].key, "new");
    });
  });

  describe("budget trimming", () => {
    it("limits facts to fit model budget", () => {
      // llama-3-8b has window 8192, allocation 0.20 = 1638 tokens
      // At 50 tokens/fact, that's ~32 facts max
      const facts = Array.from({ length: 100 }, (_, i) =>
        makeFact({ key: `fact:${i}`, id: `id-${i}`, tags: ["match"] })
      );
      const result = recallContext("match", "global", facts, "llama-3-8b");
      assert.ok(result.length <= 33); // 8192 * 0.20 / 50 = 32.768
      assert.ok(result.length > 0);
    });

    it("large model can fit more facts", () => {
      const facts = Array.from({ length: 1000 }, (_, i) =>
        makeFact({ key: `fact:${i}`, id: `id-${i}`, tags: ["match"] })
      );
      const small = recallContext("match", "global", facts, "llama-3-8b");
      const large = recallContext("match", "global", facts, "claude-4-opus");
      assert.ok(large.length > small.length);
    });

    it("unknown model falls back to default budget", () => {
      const facts = Array.from({ length: 1000 }, (_, i) =>
        makeFact({ key: `fact:${i}`, id: `id-${i}`, tags: ["match"] })
      );
      const result = recallContext("match", "global", facts, "some-future-model");
      const defaultBudget = MODEL_BUDGETS.default;
      const maxFacts = Math.floor((defaultBudget.window * defaultBudget.allocation) / 50);
      assert.ok(result.length <= maxFacts + 1); // +1 for rounding tolerance
    });
  });

  describe("formatContext", () => {
    it("outputs lean format without scope or tags", () => {
      const facts = [
        makeFact({ key: "project:singlecontext:storage:backend", value: "Arweave", scope: "project:singlecontext", tags: ["storage"] }),
      ];
      const output = formatContext(facts);
      assert.ok(output.includes("[MEMORY]"));
      assert.ok(output.includes("[/MEMORY]"));
      assert.ok(output.includes("storage backend: Arweave"));
      // Should NOT contain internal metadata
      assert.ok(!output.includes("[project:singlecontext]"));
      assert.ok(!output.includes("(tags:"));
    });

    it("strips global prefix from keys", () => {
      const facts = [
        makeFact({ key: "global:coding_style", value: "Functional", scope: "global" }),
      ];
      const output = formatContext(facts);
      assert.ok(output.includes("coding style: Functional"));
      assert.ok(!output.includes("global:"));
    });

    it("returns empty string for no facts", () => {
      assert.equal(formatContext([]), "");
    });

    it("includes all facts", () => {
      const facts = [
        makeFact({ key: "global:a", value: "1" }),
        makeFact({ key: "global:b", id: "id-b", value: "2" }),
        makeFact({ key: "global:c", id: "id-c", value: "3" }),
      ];
      const output = formatContext(facts);
      assert.ok(output.includes("- a: 1"));
      assert.ok(output.includes("- b: 2"));
      assert.ok(output.includes("- c: 3"));
    });
  });
});
