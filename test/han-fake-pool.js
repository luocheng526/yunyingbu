/** Test double for mysql2/promise. Production uses getPool() → MySQL. */

export function createHanFakePool() {
  const tasks = [];
  let nextId = 1;
  let briefRow = null;

  return {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, " ").trim();

      if (/^CREATE TABLE/i.test(normalized)) {
        return [{}, undefined];
      }

      if (/^SELECT id, title, status, owner, created_at FROM han_tasks ORDER BY id ASC$/i.test(normalized)) {
        return [tasks.map((t) => ({ ...t })), undefined];
      }

      if (/^INSERT INTO han_tasks \(title, status, owner\) VALUES \(\?, \?, \?\)$/i.test(normalized)) {
        const [title, status, owner] = params;
        const row = {
          id: nextId++,
          title,
          status,
          owner,
          created_at: new Date(),
        };
        tasks.push(row);
        return [{ insertId: row.id }, undefined];
      }

      if (/^SELECT id, title, status, owner, created_at FROM han_tasks WHERE id = \?$/i.test(normalized)) {
        const id = Number(params[0]);
        return [tasks.filter((t) => t.id === id).map((t) => ({ ...t })), undefined];
      }

      if (/^SELECT text FROM han_brief WHERE id = 1$/i.test(normalized)) {
        return [briefRow ? [{ ...briefRow }] : [], undefined];
      }

      if (/^INSERT INTO han_brief \(id, text\) VALUES \(1, \?\) ON DUPLICATE KEY UPDATE text = VALUES\(text\)$/i.test(normalized)) {
        briefRow = { text: String(params[0] ?? "") };
        return [{}, undefined];
      }

      throw new Error("unexpected sql: " + normalized);
    },
  };
}
