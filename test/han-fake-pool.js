/** Test double for mysql2/promise. Production uses getPool() → MySQL. */

export function createHanFakePool() {
  const tables = {
    han_tasks: [],
    han_selection: [],
    han_products: [],
    han_paid: [],
  };
  let nextId = 1;
  let briefRow = null;

  function clone(row) {
    return { ...row };
  }

  return {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, " ").trim();

      if (/^CREATE TABLE/i.test(normalized)) {
        return [{}, undefined];
      }

      if (/^SELECT text FROM han_brief WHERE id = 1$/i.test(normalized)) {
        return [briefRow ? [{ ...briefRow }] : [], undefined];
      }

      if (/^INSERT INTO han_brief \(id, text\) VALUES \(1, \?\) ON DUPLICATE KEY UPDATE text = VALUES\(text\)$/i.test(normalized)) {
        briefRow = { text: String(params[0] ?? "") };
        return [{}, undefined];
      }

      const list = normalized.match(/^SELECT .+ FROM (han_\w+) ORDER BY id ASC$/i);
      if (list) {
        const name = list[1];
        return [(tables[name] || []).map(clone), undefined];
      }

      const one = normalized.match(/^SELECT .+ FROM (han_\w+) WHERE id = \?$/i);
      if (one) {
        const name = one[1];
        const id = Number(params[0]);
        return [(tables[name] || []).filter((row) => row.id === id).map(clone), undefined];
      }

      const insert = normalized.match(/^INSERT INTO (han_\w+) \((.+)\) VALUES \((.+)\)$/i);
      if (insert) {
        const name = insert[1];
        const cols = insert[2].split(",").map((c) => c.trim());
        const row = { id: nextId++, created_at: new Date() };
        cols.forEach((col, i) => {
          row[col] = params[i];
        });
        tables[name].push(row);
        return [{ insertId: row.id }, undefined];
      }

      throw new Error("unexpected sql: " + normalized);
    },
  };
}
