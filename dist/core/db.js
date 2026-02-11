import Database from "better-sqlite3";
export function openDatabase(dbPath) {
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
    return db;
}
function initSchema(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      tags TEXT NOT NULL,
      confidence REAL DEFAULT 1.0,
      source_session TEXT,
      created TEXT NOT NULL,
      last_confirmed TEXT NOT NULL,
      access_count INTEGER DEFAULT 0,
      dirty INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pending_deletes (
      key TEXT PRIMARY KEY,
      deleted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
    // Migration: add dirty column if missing (for existing databases)
    const cols = db.pragma("table_info(facts)");
    if (!cols.some((c) => c.name === "dirty")) {
        db.exec("ALTER TABLE facts ADD COLUMN dirty INTEGER DEFAULT 1");
    }
}
// -- Meta operations --
export function getMeta(db, key) {
    const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
    return row?.value ?? null;
}
export function setMeta(db, key, value) {
    db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}
// -- Fact operations --
export function upsertFact(db, fact) {
    db.prepare(`INSERT INTO facts (id, scope, key, value, tags, confidence, source_session, created, last_confirmed, access_count, dirty)
     VALUES (@id, @scope, @key, @value, @tags, @confidence, @source_session, @created, @last_confirmed, @access_count, 1)
     ON CONFLICT(key) DO UPDATE SET
       id = excluded.id,
       scope = excluded.scope,
       value = excluded.value,
       tags = excluded.tags,
       confidence = excluded.confidence,
       source_session = excluded.source_session,
       last_confirmed = excluded.last_confirmed,
       access_count = excluded.access_count,
       dirty = 1`).run({
        ...fact,
        tags: JSON.stringify(fact.tags),
    });
    // If this key was pending delete, remove it from pending_deletes
    db.prepare("DELETE FROM pending_deletes WHERE key = ?").run(fact.key);
}
export function deleteFact(db, key) {
    const exists = db.prepare("SELECT 1 FROM facts WHERE key = ?").get(key);
    db.prepare("DELETE FROM facts WHERE key = ?").run(key);
    if (exists) {
        db.prepare("INSERT OR REPLACE INTO pending_deletes (key, deleted_at) VALUES (?, ?)").run(key, new Date().toISOString());
    }
}
export function getFact(db, key) {
    const row = db
        .prepare("SELECT * FROM facts WHERE key = ?")
        .get(key);
    return row ? rowToFact(row) : null;
}
export function getAllFacts(db) {
    const rows = db
        .prepare("SELECT * FROM facts ORDER BY last_confirmed DESC")
        .all();
    return rows.map(rowToFact);
}
export function getFactsByScope(db, scope) {
    const rows = db
        .prepare("SELECT * FROM facts WHERE scope = ? OR scope = 'global' ORDER BY last_confirmed DESC")
        .all(scope);
    return rows.map(rowToFact);
}
export function searchByTags(db, tags) {
    // Pull all facts and filter in JS since tags are stored as JSON
    const all = getAllFacts(db);
    return all.filter((fact) => tags.some((tag) => fact.tags.includes(tag)));
}
export function getDirtyFacts(db) {
    const rows = db
        .prepare("SELECT * FROM facts WHERE dirty = 1")
        .all();
    return rows.map(rowToFact);
}
export function getPendingDeletes(db) {
    const rows = db
        .prepare("SELECT key FROM pending_deletes")
        .all();
    return rows.map((r) => r.key);
}
export function clearDirtyState(db) {
    db.prepare("UPDATE facts SET dirty = 0").run();
    db.prepare("DELETE FROM pending_deletes").run();
}
export function incrementAccessCount(db, key) {
    db.prepare("UPDATE facts SET access_count = access_count + 1 WHERE key = ?").run(key);
}
function rowToFact(row) {
    return {
        id: row.id,
        scope: row.scope,
        key: row.key,
        value: row.value,
        tags: JSON.parse(row.tags),
        confidence: row.confidence,
        source_session: row.source_session || null,
        created: row.created,
        last_confirmed: row.last_confirmed,
        access_count: row.access_count,
    };
}
//# sourceMappingURL=db.js.map