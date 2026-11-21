import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { gzipSync } from "node:zlib";
import express from "express";
import { createArchiveImport, validateArchiveRecord } from "../src/modules/bound/archive-import.js";
import { SHOP_DAY, shopDayRequest } from "../src/modules/bound/shop-day-contract.js";
import { inspectDayResponse } from "../src/modules/bound/shop-day.js";
import { createShopDayRouter } from "../src/modules/bound/shop-day-router.js";
import { boundRouter } from "../src/modules/bound/router.js";

const hash = data => createHash("sha256").update(data).digest("hex");
function fixture() {
  const request = shopDayRequest({ reportId: "channel_goods", page: 1 });
  const requestHash = hash(JSON.stringify(request));
  const response = { httpStatus: 200, payload: { code: 0, data: { columnInfo: [], columnData: [
    { platform: "JD", shopId: SHOP_DAY.shopId, goodsId: "123", gmv: 100, date: SHOP_DAY.date }
  ] } } };
  const record = { scope: SHOP_DAY, reportId: "channel_goods", goodsId: null, page: 1, request, requestHash, response,
    ...inspectDayResponse("channel_goods", response) };
  const name = `channel_goods-shop-1-${requestHash.slice(0, 12)}.json`;
  const raw = Buffer.from(JSON.stringify(record));
  const zipped = gzipSync(raw);
  return { record, name, raw, zipped, sha256: hash(zipped) };
}

test("档案导入支持断点、校验和、重复导入，保留原始数据并重建选品", async () => {
  const directory = await mkdtemp(join(tmpdir(), "bound-import-"));
  try {
    const importer = createArchiveImport({ directory });
    const f = fixture(), half = Math.floor(f.zipped.length / 2);
    assert.equal(validateArchiveRecord(f.name, f.record), f.record);
    const first = { name: f.name, sha256: f.sha256, offset: 0, chunk: f.zipped.subarray(0, half).toString("base64"), final: false };
    assert.equal((await importer.accept(first)).offset, half);
    assert.equal(importer.busy(), true);
    const duplicate = await importer.accept(first);
    assert.equal(duplicate.reason, "import_offset"); assert.equal(duplicate.offset, half);
    const resumed = createArchiveImport({ directory });
    const finished = await resumed.accept({ ...first, offset: half, chunk: f.zipped.subarray(half).toString("base64"), final: true });
    assert.equal(finished.complete, true); assert.equal(finished.sha256, hash(f.raw));
    const dir = join(directory, SHOP_DAY.platform, SHOP_DAY.shopId, SHOP_DAY.date);
    assert.deepEqual(await readFile(join(dir, f.name)), f.raw);
    assert.equal(JSON.parse(await readFile(join(dir, "selection.json"))).goodsId, "123");
    assert.equal((await resumed.accept({ ...first, chunk: f.zipped.toString("base64"), final: true })).reused, true);
    const changed = { ...f.record, id: "different-collection" };
    const zipped = gzipSync(JSON.stringify(changed));
    assert.equal((await resumed.accept({ ...first, sha256: hash(zipped), chunk: zipped.toString("base64"), final: true })).reason, "archive_conflict");
    assert.deepEqual(await readFile(join(dir, f.name)), f.raw);
    assert.deepEqual(await readdir(join(dir, ".imports")), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("拒绝串店、篡改数据、任意路径和坏压缩包，采集进行时禁止导入", async () => {
  const directory = await mkdtemp(join(tmpdir(), "bound-import-reject-"));
  try {
    const f = fixture();
    assert.throws(() => validateArchiveRecord(f.name, { ...f.record, scope: { ...SHOP_DAY, shopId: "other" } }), /scope/);
    assert.throws(() => validateArchiveRecord(f.name, { ...f.record, rows: [] }), /data/);
    const importer = createArchiveImport({ directory });
    const input = { name: f.name, sha256: f.sha256, offset: 0, chunk: f.zipped.toString("base64"), final: true };
    assert.equal((await importer.accept({ ...input, name: "../router.js" })).statusCode, 400);
    assert.equal((await importer.accept({ ...input, sha256: "0".repeat(64) })).reason, "import_hash_mismatch");
    assert.equal((await createArchiveImport({ directory, blocked: async () => true }).accept(input)).reason, "collector_busy");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("导入接口继承管理员及同源限制，导入后页面读取不触发 BI", async () => {
  const directory = await mkdtemp(join(tmpdir(), "bound-import-route-"));
  let calls = 0;
  const app = express(); app.use(express.json());
  app.use("/restricted", (req, _res, next) => { if (req.headers["x-test-user"]) req.user = { username: req.headers["x-test-user"] }; next(); }, boundRouter);
  app.use("/sample", createShopDayRouter({ directory, request: async () => { calls++; throw new Error("BI must not be called"); } }));
  const server = app.listen(0, "127.0.0.1"); await new Promise(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const f = fixture();
    const options = { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ name: f.name, sha256: f.sha256, offset: 0, chunk: f.zipped.toString("base64"), final: true }) };
    assert.equal((await fetch(base + "/restricted/shop-day/import", options)).status, 401);
    assert.equal((await fetch(base + "/restricted/shop-day/import", { ...options, headers: { ...options.headers, "x-test-user": "ordinary" } })).status, 403);
    assert.equal((await fetch(base + "/sample/import", { ...options, headers: { ...options.headers, Origin: "https://other.example" } })).status, 403);
    assert.equal((await (await fetch(base + "/sample/import", options)).json()).complete, true);
    const loaded = await (await fetch(base + "/sample/report?reportId=channel_goods")).json();
    assert.equal(loaded.record.rows[0].gmv, 100); assert.equal(calls, 0);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
});
