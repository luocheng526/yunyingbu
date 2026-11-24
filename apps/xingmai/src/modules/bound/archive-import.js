import { createHash, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { mkdir, readFile, writeFile, appendFile, stat, link, unlink } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { SHOP_DAY, shopDayRequest } from "./shop-day-contract.js";
import { inspectDayResponse, chooseSoldProduct } from "./shop-day.js";

const hash = value => createHash("sha256").update(value).digest("hex");
const digest = value => hash(JSON.stringify(value));
const good = value => ["received", "empty"].includes(value);
const reject = reason => Object.assign(new Error(reason), { statusCode: 400 });

// Import actual archived responses, never credentials, arbitrary paths or a
// synthesized successful collection. Recompute identity and parsed data.
export function validateArchiveRecord(name, record) {
  if (!record || !good(record.status) || !record.scope ||
    ["platform", "shopId", "date"].some(key => record.scope[key] !== SHOP_DAY[key])) throw reject("invalid_archive_scope");
  const input = { reportId: record.reportId, page: record.page };
  for (const key of ["goodsId", "cardId", "categoryPath", "planId", "promoteKey", "columnKey", "trendDays"]) {
    if (record[key] != null) input[key] = record[key];
  }
  if (record.reportId === "product_promotion_trend") input.promoteKeys = record.request?.body?.promoteKeys;
  const expected = shopDayRequest(input);
  if (!expected || digest(expected) !== record.requestHash || digest(record.request) !== record.requestHash ||
    name !== `${record.reportId}-${record.goodsId || "shop"}-${record.page}-${record.requestHash.slice(0, 12)}.json`) throw reject("invalid_archive_identity");
  const parsed = inspectDayResponse(record.reportId, record.response || {}, record.goodsId, input);
  if (!good(parsed.status) || parsed.status !== record.status || digest(parsed.rows) !== digest(record.rows) || parsed.dataHash !== record.dataHash) throw reject("invalid_archive_data");
  for (const key of ["metricCards", "metricColumns", "metricTrend", "total"]) {
    if (parsed[key] !== undefined && digest(parsed[key]) !== digest(record[key])) throw reject("invalid_archive_metadata");
  }
  return record;
}

export function createArchiveImport({ directory, blocked = async () => false }) {
  const dir = join(directory, SHOP_DAY.platform, SHOP_DAY.shopId, SHOP_DAY.date);
  const staging = join(dir, ".imports");
  let locked = false;
  const pending = new Map();
  const busy = () => locked || [...pending.values()].some(time => Date.now() - time < 15 * 60 * 1000);
  async function readMaybe(path) {
    try { return await readFile(path); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  }
  async function accept(input) {
    if (locked) return { ok: false, statusCode: 409, reason: "collector_busy" };
    if (!input || Object.keys(input).some(k => !["name", "sha256", "offset", "chunk", "final"].includes(k)) ||
      !/^[a-z_]+-[A-Za-z0-9_-]{1,80}-[1-9][0-9]?-([a-f0-9]{12})\.json$/.test(input.name || "") ||
      !/^[a-f0-9]{64}$/.test(input.sha256 || "") || !Number.isSafeInteger(input.offset) || input.offset < 0 ||
      typeof input.chunk !== "string" || input.chunk.length > 64000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.chunk) ||
      typeof input.final !== "boolean") return { ok: false, statusCode: 400, reason: "invalid_import_chunk" };
    const key = input.name + "." + input.sha256;
    const part = join(staging, key + ".gz");
    const destination = join(dir, input.name);
    locked = true;
    try {
      if (await blocked()) return { ok: false, statusCode: 409, reason: "collector_busy" };
      await mkdir(staging, { recursive: true, mode: 0o700 });
      let size = 0;
      try { size = (await stat(part)).size; } catch (error) { if (error.code !== "ENOENT") throw error; }
      if (input.offset !== size) return { ok: false, statusCode: 409, reason: "import_offset", offset: size };
      const chunk = Buffer.from(input.chunk, "base64");
      if (size + chunk.length > 4 * 1024 * 1024) throw reject("import_too_large");
      pending.set(key, Date.now());
      await appendFile(part, chunk, { mode: 0o600 });
      size += chunk.length;
      if (!input.final) return { ok: true, complete: false, offset: size };
      const compressed = await readFile(part);
      if (hash(compressed) !== input.sha256) throw reject("import_hash_mismatch");
      let raw, record;
      try { raw = gunzipSync(compressed, { maxOutputLength: 32 * 1024 * 1024 }); record = JSON.parse(raw); }
      catch { throw reject("invalid_archive_json"); }
      validateArchiveRecord(input.name, record);
      const existing = await readMaybe(destination);
      if (existing && hash(existing) !== hash(raw)) {
        await unlink(part); pending.delete(key);
        return { ok: false, statusCode: 409, reason: "archive_conflict" };
      }
      if (!existing) {
        const temp = join(staging, randomUUID() + ".json");
        await writeFile(temp, raw, { mode: 0o600 });
        try { await link(temp, destination); } finally { await unlink(temp); }
      }
      // Reconstruct selection from its source rather than accepting an arbitrary
      // selection file supplied by a client. It never replaces existing choices.
      if (record.reportId === "channel_goods") {
        const selected = chooseSoldProduct(record);
        if (selected) {
          const temp = join(staging, randomUUID() + ".json");
          await writeFile(temp, JSON.stringify(selected), { mode: 0o600 });
          try { await link(temp, join(dir, "selection.json")); }
          catch (error) { if (error.code !== "EEXIST") throw error; }
          finally { await unlink(temp); }
        }
      }
      await unlink(part);
      pending.delete(key);
      return { ok: true, complete: true, reused: !!existing, name: input.name, sha256: hash(raw), dataHash: record.dataHash };
    } catch (error) {
      if (error.statusCode === 400) {
        await unlink(part).catch(() => {}); pending.delete(key);
        return { ok: false, statusCode: 400, reason: error.message };
      }
      return { ok: false, statusCode: 409, reason: error.code === "EEXIST" ? "archive_conflict" : "archive_import_failed" };
    } finally { locked = false; }
  }
  return { accept, busy };
}
