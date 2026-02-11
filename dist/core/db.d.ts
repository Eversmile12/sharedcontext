import Database from "better-sqlite3";
import type { Fact } from "../types.js";
export declare function openDatabase(dbPath: string): Database.Database;
export declare function getMeta(db: Database.Database, key: string): string | null;
export declare function setMeta(db: Database.Database, key: string, value: string): void;
export declare function upsertFact(db: Database.Database, fact: Fact): void;
export declare function deleteFact(db: Database.Database, key: string): void;
export declare function getFact(db: Database.Database, key: string): Fact | null;
export declare function getAllFacts(db: Database.Database): Fact[];
export declare function getFactsByScope(db: Database.Database, scope: string): Fact[];
export declare function searchByTags(db: Database.Database, tags: string[]): Fact[];
export declare function getDirtyFacts(db: Database.Database): Fact[];
export declare function getPendingDeletes(db: Database.Database): string[];
export declare function clearDirtyState(db: Database.Database): void;
export declare function incrementAccessCount(db: Database.Database, key: string): void;
//# sourceMappingURL=db.d.ts.map