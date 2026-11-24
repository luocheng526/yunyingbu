import { normalizeOrgShops } from "./org-roster.js";
import { cellKey, readWeekStore, shiftYmd, weekTeamKey } from "./week-report.js";

const metricsReport = "channel_shop_table";
const numeric = value => {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const parsed = Number(String(value).replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : null;
};
const byName = value => String(value || "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
const shopKey = shop => shop.platform + ":" + shop.shopId;

async function orgStores() {
  try {
    const { hydrateOrgStores, listOrgStores } = await import("../people/org-board.js");
    await hydrateOrgStores();
    return normalizeOrgShops(listOrgStores({ status: "operating" }, "罗成"));
  } catch {
    throw new Error("无法读取组织中心的运营店铺");
  }
}

async function boundServices() {
  const { requestVisibleShops, requestDailyPerformance } = await import("../bound/collect.js");
  const { inspectDayResponse } = await import("../bound/shop-day.js");
  if (!requestDailyPerformance) throw new Error("BI 业绩采集尚未接入");
  return { discover: () => requestVisibleShops({ forDailyPerformance: true }), request: requestDailyPerformance, inspect: inspectDayResponse };
}

function mapShops(roster, visible) {
  const assigned = new Set();
  return roster.filter(row => weekTeamKey(row)).map(row => {
    const names = visible.filter(shop => byName(shop.shopName) === byName(row.store));
    const ids = row.shopId ? visible.filter(shop => shop.shopId === row.shopId) : [];
    const candidates = ids.length ? ids.filter(shop => !names.length || names.includes(shop)) : names;
    const match = candidates.length === 1 ? candidates[0] : null;
    if (!match || assigned.has(shopKey(match))) throw new Error("BI 未能唯一匹配运营店铺：" + row.store);
    assigned.add(shopKey(match));
    return { ...match, team: weekTeamKey(row), store: row.store };
  });
}

export async function collectWeekBi(date, { loadRoster = orgStores, services, collectSaved = {} } = {}) {
  const roster = await loadRoster();
  const { discover, request, inspect } = services || await boundServices();
  const visible = await discover();
  if (!visible.ok) {
    const message = {
      server_login_required: "BI 服务端尚未登录，请在绑定采集页登录",
      login_expired: "BI 登录已过期，请在绑定采集页重新登录",
      collector_busy: "BI 当前繁忙，稍后重试"
    }[visible.reason];
    throw new Error(message || "读取 BI 店铺列表失败（" + visible.reason + "）");
  }
  const shops = mapShops(roster, visible.shops);
  if (!shops.length) throw new Error("组织中心没有两个业绩团队的运营店铺");
  const records = {};
  const missing = [];
  for (const shop of shops) {
    const id = shopKey(shop);
    const scope = { platform: shop.platform, shopId: shop.shopId, date };
    let data = collectSaved[id];
    if (!data) {
      let result, response;
      try {
        response = await request(scope, visible.owner);
        result = inspect(metricsReport, response, null, {}, scope);
      } catch { result = { status: "request_failed" }; }
      if (["login_expired", "server_login_required", "identity_changed", "session_changed", "login_conflict"].includes(result.status)) {
        missing.push(shop.store + "（" + result.status + "）");
        break;
      }
      const rows = result.status === "received" ? result.rows.filter(row => !row.sumLine &&
        row.platform === shop.platform && String(row.shopId) === shop.shopId) : [];
      const row = rows.length === 1 ? rows[0] : {};
      const gmv = numeric(row.gmv);
      const fee = numeric(row.tghf);
      const profit = numeric(row.profit);
      const hasProfit = result.status === "received" && response.payload.data.columnInfo.some(column => column.columnKey === "profit");
      if (gmv == null || fee == null || hasProfit && profit == null) {
        missing.push(shop.store + "（" + (result.status === "received" ? "指标缺失" : result.status) + "）");
        continue;
      }
      data = { gmv, fee, rate: numeric(row.tghfXseZb), profit,
        orders: numeric(row.orderCount ?? row.orders ?? row.payOrderCount),
        visitors: numeric(row.visitors ?? row.visitor ?? row.uv ?? row.visitorCount) };
    }
    records[id] = data;
  }
  // Preserve completed reads even if authentication interrupted the remaining shops.
  return { shops, records: { ...collectSaved, ...records }, error: missing.length ?
    "昨日 BI 数据待齐：" + missing.slice(0, 4).join("、") + (missing.length > 4 ? "等 " + missing.length + " 家" : "") : "" };
}

export function weekBiCells(date, shops, records, existing = readWeekStore({ strict: true }).cells) {
  const cells = {};
  const first = date.slice(0, 8) + "01";
  const previous = shiftYmd(date, -1);
  for (const shop of shops) {
    const { team, store } = shop;
    const { gmv, fee, rate, profit, orders, visitors } = records[shopKey(shop)];
    const key = name => cellKey(team, store, name);
    const get = name => numeric(existing[key(name)]);
    const set = (name, value) => { cells[key(name + "_" + date)] = value; };
    set("gmv", gmv);
    set("fee", fee);
    set("feeRate", rate ?? (gmv ? fee / gmv : fee === 0 ? 0 : null));
    if (profit != null) set("dailyProfit", profit);
    if (orders != null) set("orders", orders);
    if (visitors != null) set("visitors", visitors);

    const addIfKnown = (a, b) => a == null || b == null ? null : a + b;
    let monthGmv = gmv, monthFee = fee, sumOfPastProfit = 0;
    for (let day = first; day < date; day = shiftYmd(day, 1)) {
      monthGmv = addIfKnown(monthGmv, get("gmv_" + day));
      monthFee = addIfKnown(monthFee, get("fee_" + day));
      sumOfPastProfit = addIfKnown(sumOfPastProfit, get("dailyProfit_" + day));
    }
    const previousProfit = date === first ? 0 : get("mtd_" + previous) ?? sumOfPastProfit;
    if (profit != null && previousProfit != null) {
      const mtd = previousProfit + profit;
      set("mtd", mtd);
      if (monthGmv) set("marginMtd", mtd / monthGmv);
    }
    if (monthFee != null) {
      set("monthSpend", monthFee);
      if (monthGmv) set("monthFee", monthFee / monthGmv);
    }
  }
  return cells;
}

export function weekDailyMessage(date, shops, cells) {
  const format = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
  const totals = new Map();
  for (const { team, store } of shops) {
    const gmv = numeric(cells[cellKey(team, store, "gmv_" + date)]);
    const fee = numeric(cells[cellKey(team, store, "fee_" + date)]);
    if (gmv == null || fee == null) throw new Error("业绩表数据已变化，请补齐昨日支付金额和推广费用");
    const total = totals.get(team) || { gmv: 0, fee: 0, count: 0 };
    total.gmv += gmv;
    total.fee += fee;
    total.count++;
    totals.set(team, total);
  }
  const lines = ["业务日期 " + date];
  for (const [team, total] of totals) {
    const name = team === "han" ? "韩梦凯" : "沈子晗";
    const ratio = total.gmv ? format.format(total.fee / total.gmv * 100) + "%" : total.fee === 0 ? "0%" : "—";
    lines.push(name + " · " + total.count + " 家店铺", "支付金额 ¥" + format.format(total.gmv) +
      "｜推广费用 ¥" + format.format(total.fee) + "｜推广费占比 " + ratio);
  }
  return lines.join("\n");
}
