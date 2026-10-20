import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const MIGRATIONS = new URL("../../../migrations/", import.meta.url);
/** Statements that hand rows back, which D1 returns in `results`. */
const RETURNS_ROWS = /^\s*(SELECT|WITH)\b|\bRETURNING\b/i;

/**
 * An in-memory stand-in for Cloudflare D1 for tests, backed by Node's built-in SQLite with
 * the real migrations applied. It implements the parts of the D1 API the server uses.
 * @returns {D1Database}
 */
export function createTestDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  // D1 always enforces foreign keys.
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql")).sort()) {
    sqlite.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }

  class Statement {
    /** @param {string} sql @param {unknown[]} [values] */
    constructor(sql, values = []) {
      this.sql = sql;
      // Node's SQLite treats `?1` as a named parameter, so numbered parameters (which D1
      // supports) are rewritten as plain `?` with their values repeated in order.
      /** @type {unknown[]} */
      const ordered = [];
      this.sqliteSql = sql.replace(/\?(\d+)/g, (_, index) => {
        ordered.push(values[Number(index) - 1]);
        return "?";
      });
      this.values = /\?\d/.test(sql) ? ordered : values;
    }

    /** @param {...unknown} values */
    bind(...values) {
      for (const value of values) {
        if (value === undefined || typeof value === "boolean") throw new TypeError(`D1 can't bind ${typeof value} values.`);
      }
      return new Statement(this.sql, values);
    }

    /** @param {string} [column] */
    async first(column) {
      const row = sqlite.prepare(this.sqliteSql).get(...(/** @type {any[]} */ (this.values)));
      if (!row) return null;
      return column ? row[column] : { ...row };
    }

    async all() {
      return this.allSync();
    }

    async run() {
      return this.runSync();
    }

    allSync() {
      const results = sqlite.prepare(this.sqliteSql).all(...(/** @type {any[]} */ (this.values))).map((row) => ({ ...row }));
      return { results, success: true, meta: { changes: 0 } };
    }

    runSync() {
      const info = sqlite.prepare(this.sqliteSql).run(...(/** @type {any[]} */ (this.values)));
      return { results: [], success: true, meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
    }
  }

  const database = {
    /** @param {string} sql */
    prepare: (sql) => new Statement(sql),
    /**
     * Like D1, a batch runs in one transaction and rolls back entirely if any statement fails.
     * It runs synchronously so concurrent requests can't interleave inside the transaction.
     * @param {Statement[]} statements
     */
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(RETURNS_ROWS.test(statement.sql) ? statement.allSync() : statement.runSync());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return /** @type {D1Database} */ (/** @type {unknown} */ (database));
}
