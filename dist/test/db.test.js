import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { openDatabase, upsertFact, deleteFact, getFact, getAllFacts, getFactsByScope, searchByTags, getDirtyFacts, getPendingDeletes, clearDirtyState, incrementAccessCount, getMeta, setMeta, } from "../core/db.js";
function makeFact(overrides = {}) {
    return {
        id: "test-id-1",
        scope: "global",
        key: "test:key",
        value: "test value",
        tags: ["tag1", "tag2"],
        confidence: 1.0,
        source_session: null,
        created: "2026-01-01T00:00:00.000Z",
        last_confirmed: "2026-01-01T00:00:00.000Z",
        access_count: 0,
        ...overrides,
    };
}
let tmpDir;
let db;
function freshDb() {
    tmpDir = mkdtempSync(join(tmpdir(), "singlecontext-test-"));
    return openDatabase(join(tmpDir, "test.db"));
}
describe("db", () => {
    beforeEach(() => {
        db = freshDb();
    });
    // -- Meta --
    describe("meta", () => {
        it("returns null for missing key", () => {
            assert.equal(getMeta(db, "nonexistent"), null);
        });
        it("set and get", () => {
            setMeta(db, "version", "42");
            assert.equal(getMeta(db, "version"), "42");
        });
        it("overwrites on conflict", () => {
            setMeta(db, "version", "1");
            setMeta(db, "version", "2");
            assert.equal(getMeta(db, "version"), "2");
        });
    });
    // -- Basic CRUD --
    describe("upsert and get", () => {
        it("inserts a new fact", () => {
            const fact = makeFact();
            upsertFact(db, fact);
            const got = getFact(db, "test:key");
            assert.ok(got);
            assert.equal(got.id, "test-id-1");
            assert.equal(got.value, "test value");
            assert.deepEqual(got.tags, ["tag1", "tag2"]);
        });
        it("upsert overwrites existing fact by key", () => {
            upsertFact(db, makeFact({ value: "original" }));
            upsertFact(db, makeFact({ id: "test-id-2", value: "updated" }));
            const got = getFact(db, "test:key");
            assert.ok(got);
            assert.equal(got.value, "updated");
            assert.equal(got.id, "test-id-2");
        });
        it("returns null for missing fact", () => {
            assert.equal(getFact(db, "nope"), null);
        });
    });
    describe("getAllFacts", () => {
        it("returns empty array initially", () => {
            assert.deepEqual(getAllFacts(db), []);
        });
        it("returns all inserted facts ordered by last_confirmed desc", () => {
            upsertFact(db, makeFact({ key: "a", last_confirmed: "2026-01-01T00:00:00Z" }));
            upsertFact(db, makeFact({ key: "b", id: "id-b", last_confirmed: "2026-02-01T00:00:00Z" }));
            const all = getAllFacts(db);
            assert.equal(all.length, 2);
            assert.equal(all[0].key, "b"); // more recent first
            assert.equal(all[1].key, "a");
        });
    });
    describe("deleteFact", () => {
        it("removes the fact", () => {
            upsertFact(db, makeFact());
            deleteFact(db, "test:key");
            assert.equal(getFact(db, "test:key"), null);
        });
        it("is a no-op for nonexistent key (no pending delete)", () => {
            deleteFact(db, "nonexistent");
            assert.deepEqual(getPendingDeletes(db), []);
        });
    });
    // -- Scope filtering --
    describe("getFactsByScope", () => {
        it("returns global + matching scope facts", () => {
            upsertFact(db, makeFact({ key: "g", scope: "global" }));
            upsertFact(db, makeFact({ key: "p", id: "id-p", scope: "project:singlecontext" }));
            upsertFact(db, makeFact({ key: "other", id: "id-o", scope: "project:other" }));
            const results = getFactsByScope(db, "project:singlecontext");
            const keys = results.map((f) => f.key).sort();
            assert.deepEqual(keys, ["g", "p"]);
        });
    });
    // -- Tag search --
    describe("searchByTags", () => {
        it("finds facts with matching tags", () => {
            upsertFact(db, makeFact({ key: "a", tags: ["storage", "arweave"] }));
            upsertFact(db, makeFact({ key: "b", id: "id-b", tags: ["auth", "jwt"] }));
            upsertFact(db, makeFact({ key: "c", id: "id-c", tags: ["storage", "ipfs"] }));
            const results = searchByTags(db, ["storage"]);
            const keys = results.map((f) => f.key).sort();
            assert.deepEqual(keys, ["a", "c"]);
        });
        it("returns empty for no matches", () => {
            upsertFact(db, makeFact({ tags: ["x"] }));
            assert.deepEqual(searchByTags(db, ["y"]), []);
        });
    });
    // -- Access count --
    describe("incrementAccessCount", () => {
        it("increments from 0 to 1", () => {
            upsertFact(db, makeFact({ access_count: 0 }));
            incrementAccessCount(db, "test:key");
            const got = getFact(db, "test:key");
            assert.equal(got.access_count, 1);
        });
        it("increments multiple times", () => {
            upsertFact(db, makeFact({ access_count: 0 }));
            incrementAccessCount(db, "test:key");
            incrementAccessCount(db, "test:key");
            incrementAccessCount(db, "test:key");
            const got = getFact(db, "test:key");
            assert.equal(got.access_count, 3);
        });
    });
    // -- Dirty tracking --
    describe("dirty tracking", () => {
        it("new facts are dirty", () => {
            upsertFact(db, makeFact({ key: "a" }));
            upsertFact(db, makeFact({ key: "b", id: "id-b" }));
            const dirty = getDirtyFacts(db);
            assert.equal(dirty.length, 2);
        });
        it("clearDirtyState marks all facts clean", () => {
            upsertFact(db, makeFact({ key: "a" }));
            upsertFact(db, makeFact({ key: "b", id: "id-b" }));
            clearDirtyState(db);
            assert.deepEqual(getDirtyFacts(db), []);
        });
        it("updating a clean fact makes it dirty again", () => {
            upsertFact(db, makeFact({ key: "a", value: "v1" }));
            clearDirtyState(db);
            assert.deepEqual(getDirtyFacts(db), []);
            // Update the fact
            upsertFact(db, makeFact({ key: "a", value: "v2" }));
            const dirty = getDirtyFacts(db);
            assert.equal(dirty.length, 1);
            assert.equal(dirty[0].value, "v2");
        });
        it("only changed facts are dirty after clear", () => {
            upsertFact(db, makeFact({ key: "a" }));
            upsertFact(db, makeFact({ key: "b", id: "id-b" }));
            clearDirtyState(db);
            // Only update "a"
            upsertFact(db, makeFact({ key: "a", value: "changed" }));
            const dirty = getDirtyFacts(db);
            assert.equal(dirty.length, 1);
            assert.equal(dirty[0].key, "a");
        });
    });
    // -- Pending deletes --
    describe("pending deletes", () => {
        it("deleting a fact records a pending delete", () => {
            upsertFact(db, makeFact({ key: "a" }));
            deleteFact(db, "a");
            const pending = getPendingDeletes(db);
            assert.deepEqual(pending, ["a"]);
        });
        it("clearDirtyState clears pending deletes", () => {
            upsertFact(db, makeFact({ key: "a" }));
            deleteFact(db, "a");
            clearDirtyState(db);
            assert.deepEqual(getPendingDeletes(db), []);
        });
        it("re-inserting a deleted key removes it from pending deletes", () => {
            upsertFact(db, makeFact({ key: "a" }));
            deleteFact(db, "a");
            assert.deepEqual(getPendingDeletes(db), ["a"]);
            // Re-insert same key
            upsertFact(db, makeFact({ key: "a", value: "back" }));
            assert.deepEqual(getPendingDeletes(db), []);
            assert.equal(getFact(db, "a").value, "back");
        });
    });
});
//# sourceMappingURL=db.test.js.map