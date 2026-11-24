/* global AbortSignal */
// Run only after the shop-day worker has stopped. Each read keeps the same shop
// and date; card IDs come from that account's archived card configuration.
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SHOP_DAY } from "./shop-day-contract.js";

export async function collectClassifications({ base, directory, fetcher = fetch }) {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(base) || !directory) throw new Error("仅支持本机单店采集");
  const state = await (await fetcher(base + "/api/bound/shop-day")).json();
  if (!state.ok || state.scope.shopId !== SHOP_DAY.shopId || state.scope.date !== SHOP_DAY.date || !state.inventory?.complete || !Array.isArray(state.inventory.items)) throw new Error("店日清单未核验");
  if (["collecting", "running"].includes(state.run?.status)) throw new Error("先等待店日采集停止，再核验分类");
  const result = { scope: SHOP_DAY, status: "running", startedAt: new Date().toISOString(), done: 0, requests: 0, cards: [], errors: [] };
  const output = join(directory, SHOP_DAY.platform, SHOP_DAY.shopId, SHOP_DAY.date, "classification-run.json");
  const save = () => writeFile(output, JSON.stringify(result, null, 2));
  async function collect(task) {
    const response = await fetcher(base + "/api/bound/shop-day/collect", { method: "POST", headers: { Origin: base, "Content-Type": "application/json" }, body: JSON.stringify(task), signal: AbortSignal.timeout(60000) });
    const body = await response.json();
    if (!body.cached) result.requests += body.record?.requestCount || 0;
    if (!response.ok || !body.ok || body.record?.cardId !== task.cardId) throw new Error(body.reason || body.record?.status || "classification_not_verified");
    return body.record;
  }
  try {
    for (const dim of ["sku", "spu"]) {
      const response = await fetcher(base + "/api/bound/shop-day/report?reportId=shop_cards_" + dim + "&page=1");
      const { record } = await response.json();
      if (!record || !["received", "empty"].includes(record.status) || record.scope.shopId !== SHOP_DAY.shopId || record.scope.date !== SHOP_DAY.date || record.reportId !== "shop_cards_" + dim) throw new Error("cards_not_collected");
      const prefix = dim === "spu" ? "shop_spu_" : "shop_goods_";
      const identity = dim === "spu" ? "spuid" : "goodsId";
      const allowed = new Set(state.inventory.items.map(row => String(row[identity] || "")).filter(Boolean));
      for (const card of record.rows) {
        const cardId = String(card.id), rows = [];
        let total = null;
        for (let page = 1; page <= 10; page++) {
          const record = await collect({ reportId: prefix + "page", cardId, page });
          total ??= record.total;
          if (total !== record.total || total !== Number(card.count)) throw new Error("card_count_mismatch");
          rows.push(...record.rows.filter(row => !row.sumLine));
          if (!record.nextPage) break;
          if (record.nextPage !== page + 1) throw new Error("invalid_card_pagination");
        }
        if (rows.length !== total) throw new Error("card_pages_incomplete");
        const identities = rows.map(row => String(row[identity] || ""));
        if (new Set(identities).size !== total || identities.some(id => !allowed.has(id))) throw new Error("card_membership_unverified");
        const sum = await collect({ reportId: prefix + "total", cardId, page: 1 });
        result.cards.push({ dim, cardId, name: card.cardName, count: total, identities, totalHash: sum.requestHash });
        result.done++;
        await save();
      }
    }
    result.status = "complete";
  } catch (error) { result.status = "stopped"; result.errors.push({ reason: /^[a-z_]+$/.test(error.message) ? error.message : "local_request_error" }); }
  result.finishedAt = new Date().toISOString();
  await save();
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await collectClassifications({ base: `http://127.0.0.1:${process.env.BOUND_PROBE_PORT || "52483"}`, directory: process.env.BOUND_DAY_ARCHIVE_DIR });
  console.log(JSON.stringify({ status: result.status, done: result.done, requests: result.requests, errors: result.errors }));
}
