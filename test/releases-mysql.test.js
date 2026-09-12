import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isMysqlConfigured, mysqlConfigFromEnv } from "../src/db/pool.js";
import { createStore } from "../src/modules/releases/store.js";
import { createMysqlStore, mapTicketRow } from "../src/modules/releases/store-mysql.js";

test("mysql env helper never returns the password", () => {
  const cfg = mysqlConfigFromEnv({
    MYSQL_HOST: "rm-internal.mysql.rds.aliyuncs.com",
    MYSQL_PORT: "3306",
    MYSQL_USER: "mengkai",
    MYSQL_PASSWORD: "should-not-appear",
    MYSQL_DATABASE: "mengkai"
  });
  assert.equal(cfg.host, "rm-internal.mysql.rds.aliyuncs.com");
  assert.equal(cfg.database, "mengkai");
  assert.equal("password" in cfg, false);
  assert.equal(isMysqlConfigured({ MYSQL_HOST: "", MYSQL_USER: "a", MYSQL_DATABASE: "b" }), false);
});

test("mapTicketRow maps SQL columns to ticket fields", () => {
  const item = mapTicketRow({
    id: "rel-9",
    version: "1.2.3",
    applicant: "Ada",
    source: "Ada",
    module: "版本发布中心",
    summary: "mysql",
    files: ["src/db/pool.js"],
    acceptance: "刷新队列还在",
    restart: 1,
    status: "queued",
    demo: 0,
    priority: 3,
    submitted_at: new Date("2026-09-07T00:00:00.000Z"),
    reviewer: null,
    reviewed_at: null,
    reject_reason: null,
    publish_started_at: null,
    publish_finished_at: null,
    log: "ok"
  });
  assert.equal(item.id, "rel-9");
  assert.equal(item.restart, true);
  assert.equal(item.demo, false);
  assert.equal(item.rejectReason, null);
  assert.equal(item.submittedAt, "2026-09-07T00:00:00.000Z");
  assert.deepEqual(item.files, ["src/db/pool.js"]);
  assert.equal(item.snapshotDir, "");
  assert.equal(item.rolledBack, false);
  const withSnap = mapTicketRow({
    ...{
      id: "rel-9",
      version: "1.2.3",
      applicant: "Ada",
      source: "Ada",
      module: "版本发布中心",
      summary: "mysql",
      files: [],
      restart: 0,
      status: "success",
      demo: 0,
      priority: 1,
      submitted_at: new Date("2026-09-07T00:00:00.000Z")
    },
    snapshot_dir: "/var/lib/mengkai/snapshots/rel-9",
    rolled_back: 1
  });
  assert.equal(withSnap.snapshotDir, "/var/lib/mengkai/snapshots/rel-9");
  assert.equal(withSnap.rolledBack, true);
});

function createFakePool() {
  const tickets = [];
  return {
    async query(sql, params = []) {
      const text = String(sql).replace(/\s+/g, " ").trim();
      if (text.startsWith("SELECT * FROM release_tickets WHERE status = 'queued'")) {
        const rows = tickets
          .filter((row) => row.status === "queued")
          .sort((a, b) => String(a.submitted_at).localeCompare(String(b.submitted_at)) || String(a.id).localeCompare(String(b.id)));
        return [rows];
      }
      if (text.startsWith("SELECT * FROM release_tickets WHERE id = ?")) {
        return [tickets.filter((row) => row.id === params[0])];
      }
      if (text.startsWith("SELECT * FROM release_tickets ORDER BY submitted_at")) {
        return [tickets.slice()];
      }
      if (text.startsWith("SELECT COALESCE(MAX(priority)")) {
        const max = tickets.filter((row) => row.status === "queued").reduce((n, row) => Math.max(n, row.priority), 0);
        return [[{ max_priority: max }]];
      }
      if (text.startsWith("SELECT id FROM release_tickets WHERE id LIKE")) {
        const last = tickets
          .filter((row) => String(row.id).startsWith("rel-"))
          .sort((a, b) => Number(String(b.id).slice(4)) - Number(String(a.id).slice(4)))[0];
        return [last ? [last] : []];
      }
      if (text.startsWith("INSERT INTO release_tickets")) {
        const row = {
          id: params[0],
          version: params[1],
          applicant: params[2],
          source: params[3],
          module: params[4],
          summary: params[5],
          files: params[6],
          acceptance: params[7],
          restart: params[8],
          status: params[9],
          priority: params[10],
          demo: params[11],
          submitted_at: params[12],
          reviewer: params[13],
          reviewed_at: params[14],
          reject_reason: params[15],
          publish_started_at: params[16],
          publish_finished_at: params[17],
          log: params[18]
        };
        tickets.push(row);
        return [{ affectedRows: 1 }];
      }
      if (text.includes("FROM release_tickets WHERE status = 'failed'")) {
        const failed = tickets.filter((row) => row.status === "failed");
        if (text.startsWith("SELECT COUNT(*)")) {
          return [[{ n: failed.length }]];
        }
        return [failed];
      }
      if (text.startsWith("UPDATE release_tickets SET")) {
        const id = params[params.length - 1];
        const row = tickets.find((item) => item.id === id);
        Object.assign(row, {
          version: params[0],
          applicant: params[1],
          source: params[2],
          module: params[3],
          summary: params[4],
          files: params[5],
          acceptance: params[6],
          restart: params[7],
          status: params[8],
          priority: params[9],
          demo: params[10],
          submitted_at: params[11],
          reviewer: params[12],
          reviewed_at: params[13],
          reject_reason: params[14],
          publish_started_at: params[15],
          publish_finished_at: params[16],
          log: params[17]
        });
        return [{ affectedRows: 1 }];
      }
      throw new Error(`unexpected sql: ${text}`);
    }
  };
}

test("mysql store keeps queue order by submit time after a second create", async () => {
  const store = createMysqlStore({
    pool: createFakePool(),
    now: () => "2026-09-07T01:00:00.000Z"
  });
  const first = await store.create({
    version: "1.0.0",
    applicant: "A",
    source: "A",
    module: "版本发布中心",
    summary: "one",
    files: ["src/db/pool.js"],
    acceptance: "queue",
    restart: true
  });
  const second = await store.create({
    version: "1.0.1",
    applicant: "B",
    source: "B",
    module: "版本发布中心",
    summary: "two",
    files: ["src/modules/releases/store.js"],
    acceptance: "queue",
    restart: false
  });
  const queue = await store.queue();
  assert.deepEqual(
    queue.map((item) => item.id),
    [first.id, second.id]
  );
  assert.equal(queue[0].priority, 1);
  assert.equal(queue[1].priority, 2);
  await store.reject(second.id, "先放一放");
  const after = await store.queue();
  assert.equal(after.length, 1);
  assert.equal(after[0].id, first.id);
  const again = await store.list();
  assert.equal(again.find((item) => item.id === second.id).status, "rejected");
});

test("createStore without MYSQL_* stays on memory for local tests", async () => {
  const store = createStore({ memory: true });
  const queue = await store.queue();
  assert.ok(queue.some((item) => item.demo));
});

test("memory store with persistPath skips demo seed and reloads tickets", async () => {
  const persistPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rel-tickets-")), "tickets.json");
  const first = createStore({ memory: true, persistPath });
  const created = await first.create({
    version: "1.0.0",
    applicant: "版本发布中心",
    source: "版本发布中心",
    module: "版本发布中心",
    summary: "persist",
    files: ["src/server.js"],
    acceptance: "reload",
    restart: false
  });
  const second = createStore({ memory: true, persistPath });
  const queue = await second.queue();
  assert.equal(queue.some((item) => item.demo), false);
  assert.equal(queue[0].id, created.id);
  assert.equal(queue[0].version, "1.0.0");
});

test("persist store recovers stale publishing lock after restart", async () => {
  const persistPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rel-lock-")), "tickets.json");
  fs.writeFileSync(
    persistPath,
    JSON.stringify({
      seq: 16,
      lock: { id: "rel-16", version: "stuck", startedAt: "2026-09-07T09:07:01.672Z" },
      items: [
        {
          id: "rel-16",
          version: "stuck",
          applicant: "首页",
          source: "首页",
          module: "首页",
          summary: "卡住",
          files: ["public/index.html"],
          acceptance: "刷新不再显示发布中",
          restart: true,
          status: "publishing",
          demo: false,
          priority: 1,
          submittedAt: "2026-09-07T09:00:00.000Z",
          log: "已抢到全局发布锁"
        }
      ]
    })
  );
  const store = createStore({ memory: true, persistPath });
  const lock = await store.getLock();
  assert.equal(lock.locked, false);
  const item = await store.get("rel-16");
  assert.equal(item.status, "failed");
  assert.match(item.log, /不能当作成功/);
  assert.match(item.log, /新单据重试/);
});

test("persist store keeps publishing failed when snapshot exists without apply receipt", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rel-lock-snap-"));
  const persistPath = path.join(dir, "tickets.json");
  const snapDir = path.join(dir, "snapshots", "rel-16");
  fs.mkdirSync(snapDir, { recursive: true });
  fs.writeFileSync(path.join(snapDir, "manifest.json"), "{\"ok\":true}\n");
  fs.writeFileSync(
    persistPath,
    JSON.stringify({
      seq: 16,
      lock: { id: "rel-16", version: "stuck", startedAt: "2026-09-07T09:07:01.672Z" },
      items: [
        {
          id: "rel-16",
          version: "stuck",
          applicant: "首页",
          source: "首页",
          module: "首页",
          summary: "有快照",
          files: ["public/index.html"],
          acceptance: "有快照按已拷贝",
          restart: true,
          status: "publishing",
          demo: false,
          priority: 1,
          submittedAt: "2026-09-07T09:00:00.000Z",
          log: "已抢到全局发布锁"
        }
      ]
    })
  );
  const store = createStore({ memory: true, persistPath });
  const item = await store.get("rel-16");
  assert.equal(item.status, "failed");
  assert.match(item.log, /不能当作成功/);
});

test("persist store recovers publishing lock as success when apply receipt exists", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rel-lock-receipt-"));
  const persistPath = path.join(dir, "tickets.json");
  const snapDir = path.join(dir, "snapshots", "rel-16");
  fs.mkdirSync(snapDir, { recursive: true });
  fs.writeFileSync(path.join(snapDir, "apply-receipt.json"), "{\"ok\":true}\n");
  fs.writeFileSync(
    persistPath,
    JSON.stringify({
      seq: 16,
      lock: { id: "rel-16", version: "stuck", startedAt: "2026-09-07T09:07:01.672Z" },
      items: [
        {
          id: "rel-16",
          version: "stuck",
          applicant: "首页",
          source: "首页",
          module: "首页",
          summary: "有回执",
          files: ["public/index.html"],
          acceptance: "有回执按已拷贝",
          restart: true,
          status: "publishing",
          demo: false,
          priority: 1,
          submittedAt: "2026-09-07T09:00:00.000Z",
          log: "已抢到全局发布锁"
        }
      ]
    })
  );
  const store = createStore({ memory: true, persistPath });
  const item = await store.get("rel-16");
  assert.equal(item.status, "success");
  assert.match(item.log, /落地回执/);
  assert.equal(item.snapshotDir, snapDir);
});

test("persist store leftover lock on an already-success ticket only clears the lock", async () => {
  const persistPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "rel-lock-ok-")), "tickets.json");
  fs.writeFileSync(
    persistPath,
    JSON.stringify({
      seq: 33,
      lock: { id: "rel-33", version: "landed", startedAt: "2026-09-07T10:59:47.212Z" },
      items: [
        {
          id: "rel-33",
          version: "landed",
          applicant: "首页",
          source: "首页",
          module: "首页",
          summary: "已落盘",
          files: ["public/index.html"],
          acceptance: "成功保持成功",
          restart: true,
          status: "success",
          demo: false,
          priority: 1,
          submittedAt: "2026-09-07T10:51:00.000Z",
          log: "成功状态已先落盘，随后重启线上进程。"
        }
      ]
    })
  );
  const store = createStore({ memory: true, persistPath });
  const lock = await store.getLock();
  assert.equal(lock.locked, false);
  const item = await store.get("rel-33");
  assert.equal(item.status, "success");
  assert.match(item.log, /成功状态已先落盘/);
});

test("mysql store pages failed tickets and persists return in log", async () => {
  const store = createMysqlStore({
    pool: createFakePool(),
    now: () => "2026-09-12T00:00:00.000Z"
  });
  const created = await store.create({
    version: "0.1.1-fail",
    applicant: "甄选商学院对话框",
    source: "甄选商学院对话框",
    module: "版本发布中心",
    summary: "失败列表",
    files: ["public/releases.css"],
    acceptance: "失败页",
    restart: false
  });
  await store.markFailed(created, "语法检查失败");
  const page = await store.failedPage(1, 20);
  assert.equal(page.total, 1);
  assert.equal(page.items[0].id, created.id);
  assert.equal(page.items[0].status, "failed");
  assert.equal(page.items[0].returned, false);
  const sent = await store.returnFailed(created.id);
  assert.equal(sent.already, false);
  assert.equal(sent.dialog, "甄选商学院对话框");
  assert.equal(sent.item.returned, true);
  assert.match(sent.item.log, /已发回给「甄选商学院对话框」/);
  const again = await store.returnFailed(created.id);
  assert.equal(again.already, true);
  const queued = await store.returnFailed(created.id + "-missing");
  assert.equal(queued.status, 404);
});
