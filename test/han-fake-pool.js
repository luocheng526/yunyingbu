/** Test double for mysql2/promise. Production uses getPool() → MySQL. */

export function createHanFakePool() {
  const tables = {
    han_tasks: [],
    han_selection: [],
    han_products: [],
    han_paid: [],
    han_training: [],
    han_team_shops: [],
    han_shop_rules: [],
    han_shop_plans: [],
    han_picks: [],
  };
  let nextId = 1;
  let briefRow = null;

  function clone(row) {
    return { ...row };
  }

  function toDay(value) {
    if (!value) {
      return "";
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    return String(value).slice(0, 10);
  }

  return {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, " ").trim();

      if (/^CREATE TABLE/i.test(normalized) || /^ALTER TABLE/i.test(normalized)) {
        return [{}, undefined];
      }

      if (/^DELETE FROM han_tasks WHERE title LIKE/i.test(normalized)) {
        return [{ affectedRows: 0 }, undefined];
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

      const byShop = normalized.match(
        /^SELECT .+ FROM (han_shop_rules|han_shop_plans) WHERE team_name = \? AND store_name = \?$/i,
      );
      if (byShop) {
        const name = byShop[1];
        const team = String(params[0] ?? "");
        const shop = String(params[1] ?? "");
        return [
          (tables[name] || [])
            .filter((row) => String(row.team_name || "") === team && String(row.store_name || "") === shop)
            .map(clone),
          undefined,
        ];
      }

      if (/^DELETE FROM han_shop_rules WHERE team_name = \? AND store_name = \?$/i.test(normalized)) {
        const team = String(params[0] ?? "");
        const shop = String(params[1] ?? "");
        const before = tables.han_shop_rules.length;
        tables.han_shop_rules = tables.han_shop_rules.filter(
          (row) => !(String(row.team_name || "") === team && String(row.store_name || "") === shop),
        );
        return [{ affectedRows: before - tables.han_shop_rules.length }, undefined];
      }

      const one = normalized.match(/^SELECT .+ FROM (han_\w+) WHERE id = \?$/i);
      if (one) {
        const name = one[1];
        const id = Number(params[0]);
        return [(tables[name] || []).filter((row) => row.id === id).map(clone), undefined];
      }

      const count = normalized.match(
        /^SELECT COUNT\(\*\) AS n(?:, COALESCE\(SUM\(amount\), 0\) AS amount)? FROM (han_\w+) WHERE store_name = \? AND (.+)$/i,
      );
      if (count) {
        const name = count[1];
        const shop = params[0];
        const start = String(params[1]);
        const until = String(params[2]);
        const rows = (tables[name] || []).filter((row) => {
          if (String(row.store_name || "") !== String(shop)) {
            return false;
          }
          let day = "";
          if (name === "han_paid") {
            day = String(row.spent_on || "").slice(0, 10) || toDay(row.created_at);
          } else if (name === "han_training") {
            day = String(row.scheduled_on || "").slice(0, 10) || toDay(row.created_at);
          } else {
            day = toDay(row.created_at);
          }
          return day >= start && day < until;
        });
        const amount = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        return [[{ n: rows.length, amount }], undefined];
      }

      const update = normalized.match(/^UPDATE (han_\w+) SET (.+) WHERE id = \?$/i);
      if (update) {
        const name = update[1];
        const cols = update[2].split(",").map((part) => part.trim().split(" = ")[0]);
        const id = Number(params[params.length - 1]);
        const row = (tables[name] || []).find((item) => item.id === id);
        if (!row) {
          return [{ affectedRows: 0 }, undefined];
        }
        cols.forEach((col, i) => {
          row[col] = params[i];
        });
        return [{ affectedRows: 1 }, undefined];
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
