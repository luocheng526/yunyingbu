import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../src/modules/releases/store-mysql.js", import.meta.url), "utf8");
const sha = "5f1686ccd95c6f78bf39f375504f9c6960464714";
const input = { version: "0.1.1-test", applicant: "罗成", module: "边界数据中心", summary: "固定制品",
  files: ["public/shared/modules/bound.js"], acceptance: "核验已完成", restart: true,
  gitRef: sha, repository: "luocheng526/yunyingbu" };

async function loadStore() {
  const context = vm.createContext({ Date, JSON, Set, Map });
  const dependencies = {
    "../../db/pool.js": { getPool: () => { throw new Error("Tests must inject a pool"); } },
    "./charter.js": { QUEUE_LOG: "queued", requeueFailedItem: () => {}, returnFailedItem: () => {} },
    "./push.js": { hasApplyReceipt: () => false },
    "./order.js": { assignSubmitOrder: rows => rows.map((row, index) => ({ ...row, priority: index + 1 })) },
    "./store-memory.js": { REVIEWER: "罗成" },
    "./board.js": { BOARD_PAGE_SIZE: 20, slimFailedItem: row => row }
  };
  const module = new vm.SourceTextModule(source, { context });
  await module.link(name => {
    const exports = dependencies[name];
    assert.ok(exports, "unexpected dependency: " + name);
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}

// Interpret the actual SQL column/placeholder lists instead of assuming field
// positions, so a missing INSERT/UPDATE binding loses data and fails the test.
function memoryMysql() {
  const rows = new Map(), columns = new Set(["id"]), calls = [];
  const pool = { rows, columns, calls, denyMigration: false, raceColumn: "",
    async query(sql, params = []) {
      sql = sql.replace(/\s+/g, " ").trim(); calls.push(sql);
      if (sql === "SHOW COLUMNS FROM release_tickets") return [[...columns].map(Field => ({ Field }))];
      if (sql.startsWith("ALTER TABLE")) {
        if (pool.denyMigration) throw Object.assign(new Error("migration denied"), { code: "ER_TABLEACCESS_DENIED_ERROR" });
        const column = sql.match(/ADD COLUMN (\w+)/)[1];
        if (column === pool.raceColumn) { columns.add(column); throw Object.assign(new Error("duplicate"), { code: "ER_DUP_FIELDNAME" }); }
        columns.add(column); return [{ affectedRows: 0 }];
      }
      if (sql.startsWith("INSERT INTO release_tickets")) {
        const fields = sql.match(/\(([^)]+)\) VALUES/)[1].split(",").map(s => s.trim());
        assert.equal(fields.length, params.length);
        assert.equal((sql.match(/\?/g) || []).length, params.length);
        for (const field of ["git_ref", "repository"]) if (fields.includes(field)) assert.ok(columns.has(field));
        const row = Object.fromEntries(fields.map((field, i) => [field, params[i]]));
        rows.set(row.id, row); return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("UPDATE release_tickets SET")) {
        const fields = sql.match(/ SET (.+) WHERE id = \?/)[1].split(",").map(s => s.trim().split(" = ")[0]);
        assert.equal(fields.length + 1, params.length);
        const row = rows.get(params.at(-1)); assert.ok(row);
        fields.forEach((field, i) => { row[field] = params[i]; }); return [{ affectedRows: 1 }];
      }
      if (sql.startsWith("SELECT COALESCE(MAX(priority)")) return [[{ max_priority: rows.size }]];
      if (sql.startsWith("SELECT id FROM release_tickets")) return [[...rows.values()].slice(-1).map(row => ({ id: row.id }))];
      if (sql.startsWith("SELECT * FROM release_tickets")) {
        let list = [...rows.values()];
        if (sql.includes("WHERE id = ?")) list = list.filter(row => row.id === params[0]);
        if (sql.includes("status = 'queued'")) list = list.filter(row => row.status === "queued");
        return [list.map(row => ({ ...row }))];
      }
      throw new Error("Unexpected SQL: " + sql);
    }
  };
  return pool;
}

test("Git 提交号和仓库写入数据库，排队和状态变更后回读不丢失", async () => {
  const { createMysqlStore } = await loadStore(), pool = memoryMysql();
  const store = createMysqlStore({ pool, now: () => "2026-11-21T08:00:00Z" });
  const created = await store.create(input);
  assert.equal(created.gitRef, sha);
  assert.equal(pool.rows.get(created.id).git_ref, sha);
  const fresh = createMysqlStore({ pool });
  const read = await fresh.get(created.id);
  assert.equal(read.gitRef, sha); assert.equal(read.repository, input.repository);
  const queue = await fresh.queue(); assert.equal(queue[0].gitRef, sha);
  await fresh.markPublishing(read);
  assert.equal((await store.get(created.id)).gitRef, sha);
  assert.equal((await store.get(created.id)).repository, input.repository);
  assert.equal(pool.calls.filter(sql => sql.startsWith("ALTER TABLE")).length, 2);
});

test("旧表只补缺失列，并发重复加列可恢复，真实迁移错误不会伪装成功", async () => {
  const { createMysqlStore } = await loadStore(), pool = memoryMysql();
  pool.raceColumn = "git_ref";
  const store = createMysqlStore({ pool });
  pool.denyMigration = true;
  await assert.rejects(store.create(input), /migration denied/);
  assert.equal(pool.rows.size, 0);
  pool.denyMigration = false;
  const row = await store.create(input);
  assert.equal((await store.get(row.id)).gitRef, sha);
  const shows = pool.calls.filter(sql => sql === "SHOW COLUMNS FROM release_tickets").length;
  assert.equal(shows, 2);
});

test("旧单无引用时保持为空，不推测或改写旧单来源和文件路径", async () => {
  const { mapTicketRow } = await loadStore();
  const old = mapTicketRow({ id: "rel-old", files: '["public/shared/modules/bound.js"]', status: "queued" });
  assert.equal(old.gitRef, ""); assert.equal(old.repository, "");
  assert.equal(old.files[0], "public/shared/modules/bound.js");
});
