// Server-side policy shared by every module. Client visibility is presentation;
// these checks also apply to direct requests made from an already-open session.
import { effectiveSiteAcl, normalizeCap } from "./site-acl.js";
import { listOrgStores } from "./org-board.js";

export function featureForRequest(module, path, query = {}, method = "GET") {
  const tail = path.replace(/^\/api\/[^/]+\/?/, "");
  switch (module) {
    case "people": return /site-acl/.test(tail) ? "people.acl" : /rights-board/.test(tail) ? "people.rights" : /logs/.test(tail) ? "people.logs" : /notices/.test(tail) ? "people.notices" : /org\/(stores|summary)/.test(tail) ? "people.stores" : "people.members";
    case "home": return /week/.test(tail) ? "home.week" : /live|jingmai|local-paid|erp-paid/.test(tail) ? "home.realtime" : /team/.test(tail) ? "home.team" : /lead|chief/.test(tail) ? "home.lead" : /rank|board/.test(tail) ? "home.board" : /workbench/.test(tail) ? "home.workbench" : /summary|erp-kpis|fee-goals/.test(tail) ? "home.company" : "";
    case "bound": return /export/.test(tail) ? "bound.export" : /link|collect|progress|probe/.test(tail) ? "bound.link" : /prefs|catalog/.test(tail) ? "bound.cards" : "bound.board";
    case "data": return /goods|products/.test(tail) ? "data.goods" : /shops/.test(tail) ? "data.shops" : "data.overview";
    case "shen": return /jingcang/.test(tail) ? "shen.jingcang" : /recharge/.test(tail) ? "shen.recharge" : /paid/.test(tail) ? "shen.paid" : /training/.test(tail) ? "shen.training" : /tasks/.test(tail) ? "shen.tasks" : "shen.product";
    case "han": return /recharge|shop-rules|shop-plans/.test(tail) || (tail === "worker" && query.view === "rules") ? "han.recharge" : /paid|fee-targets|worker/.test(tail) ? "han.paid" : /products|goods/.test(tail) ? "han.goods" : /training/.test(tail) ? "han.training" : "han.selection";
    case "shopkeep": return /violations/.test(tail) ? "shopkeep.violations" : /shipping/.test(tail) ? "shopkeep.shipping" : /inventory|stock/.test(tail) ? "shopkeep.stock" : "shopkeep.reviews";
    case "academy": return /exams/.test(tail) ? "academy.exams" : /handbook/.test(tail) ? "academy.handbook" : "academy.courses";
    case "agent": return /settings|models/.test(tail) ? "agent.connect" : /sessions/.test(tail) ? "agent.history" : "agent.chat";
    case "work": return /diary\/(settings|ding|rest)/.test(tail) ? "work.diary" : /settings/.test(tail) ? "work.settings" : /summary|export/.test(tail) ? "work.summary" : /duty|badges|reminders/.test(tail) ? "work.duty" : "work.today";
    case "hr": return /^(access|status)?$/.test(tail) ? "" : /recruit|interview|talent|onboard/.test(tail) ? "hr.recruit" : /staff|roster|links/.test(tail) ? "hr.staff" : /effort|overtime/.test(tail) ? "hr.overtime" : "hr.attendance";
    case "releases": return method === "POST" && !tail ? "releases.submit" : /pass|approve|rollback|reject|publish|confirm|go|reorder|return|requeue/.test(tail) ? "releases.gate" : "releases.queue";
    case "profile": return /password/.test(tail) ? "profile.password" : "profile.info";
    default: return "";
  }
}

const STORE_MODULES = new Set(["home", "bound", "data", "shen", "han", "shopkeep"]);
const clean = value => String(value ?? "").trim().replace(/\s+/g, "").replace(/旗舰店$/, "旗舰");
const identityKeys = ["store", "shop", "storeName", "shopName", "shopId", "storeId", "shop_id", "store_id", "店铺", "店铺名称", "店铺ID"];
const rowLists = new Set(["rows", "records", "items", "shops", "stores", "enabledStores", "shopRuns", "subaccounts", "recharges"]);
export function storeScope(actor) {
  const all = listOrgStores({}, "罗成");
  const sheet = effectiveSiteAcl(actor, all);
  const byKey = new Map();
  for (const row of all) for (const key of [row.id, row.storeId, row.shopId, row.storeName, ...String(row.formerNames || "").split(/[、,，;]/)]) {
    if (key !== undefined && clean(key)) {
      const token = clean(key), hits = byKey.get(token) || [];
      if (!hits.includes(row)) hits.push(row);
      byKey.set(token, hits);
    }
  }
  const cap = row => normalizeCap(sheet.stores[String(row.id)]);
  const can = (key, right) => {
    const rows = byKey.get(clean(key));
    return Boolean(rows?.length && rows.every(row => cap(row)[right]));
  };
  return { configured: sheet.configured, all, byKey, cap, can,
    full: right => sheet.implicit === "max" || (all.length > 0 && all.every(row => cap(row)[right])) };
}

export function checkStoreRequest(scope, module, req) {
  if (!scope.configured || !STORE_MODULES.has(module)) return true;
  const read = ["GET", "HEAD"].includes(req.method);
  const right = read ? "enter" : "edit";
  const targets = [];
  const collect = input => {
    if (!input || typeof input !== "object") return;
    for (const key of [...identityKeys, "shops", "stores", "shopIds", "storeIds"]) {
      const value = input[key];
      if (Array.isArray(value)) value.forEach(item => typeof item === "object" ? collect(item) : targets.push(item));
      else if (value && typeof value !== "object") targets.push(value);
    }
    for (const key of ["rows", "records", "items"]) if (Array.isArray(input[key])) input[key].forEach(collect);
  };
  collect(req.query); collect(req.body);
  if (read && !targets.length && !scope.full("see") && /\.(?:png|jpe?g|pdf|xlsx?|pptx?)$|\/week-history\/[^/]+\/export|\/week-shot\//i.test(req.path || req.originalUrl || "")) return false;
  if (targets.some(key => !scope.can(key, right))) return false;
  // A whole-site write without explicit shop selectors must not mutate denied shops.
  if (!read && !targets.length && !scope.full("edit")) return false;
  return true;
}

export function filterStorePayload(payload, scope) {
  if (!scope.configured || scope.full("see") || !payload || typeof payload !== "object") return payload;
  let removed = false;
  const visit = (value, key = "", inherited = false) => {
    if (Array.isArray(value)) return value.map(row => visit(row, key, inherited)).filter(row => row !== undefined);
    if (!value || typeof value !== "object") {
      if (typeof value === "string" && scope.byKey.has(clean(value)) && !scope.can(value, "see")) { removed = true; return undefined; }
      return value;
    }
    const tokens = identityKeys.filter(k => typeof value[k] === "string" || typeof value[k] === "number").map(k => value[k]).filter(v => clean(v));
    if (!tokens.length && ["shops", "stores", "enabledStores"].includes(key)) {
      if (value.name) tokens.push(value.name); else if (value.id !== undefined) tokens.push(value.id);
    }
    const knownName = value.name && scope.byKey.has(clean(value.name));
    if (!tokens.length && knownName) tokens.push(value.name);
    if (tokens.length && tokens.some(token => !scope.can(token, "see"))) { removed = true; return undefined; }
    if (!inherited && !tokens.length && rowLists.has(key)) { removed = true; return undefined; }
    const out = {};
    for (const [childKey, child] of Object.entries(value)) {
      if (!inherited && !tokens.length && ["totals", "total", "summary", "metrics", "kpis", "rankings", "trend"].includes(childKey)) { removed = true; continue; }
      if (scope.byKey.has(clean(childKey)) && !scope.can(childKey, "see")) { removed = true; continue; }
      const next = visit(child, childKey, inherited || tokens.length > 0);
      if (next !== undefined) out[childKey] = next;
    }
    return out;
  };
  const next = visit(payload) || { ok: true };
  // Global aggregate snapshots are not valid after narrowing a shop list. Keep
  // permitted detail and omit those aggregates instead of exposing other shops.
  if (removed || !scope.full("see")) {
    for (const key of ["totals", "total", "summary", "metrics", "kpis", "rankings", "trend"]) delete next[key];
    for (const [key, value] of Object.entries(next)) {
      if (typeof value === "number" && !["page", "pageSize", "limit", "offset", "version", "timestamp"].includes(key)) delete next[key];
    }
    next.scopeFiltered = true;
  }
  return next;
}

export function protectStoreResponse(res, module, scope) {
  if (!STORE_MODULES.has(module) || !scope.configured || scope.full("see")) return;
  const json = res.json.bind(res);
  res.json = body => { res.set("Cache-Control", "private, no-store"); return json(res.statusCode >= 400 ? body : filterStorePayload(body, scope)); };
  const send = res.send.bind(res);
  res.send = body => {
    const type = String(res.get("Content-Type") || "");
    if (res.statusCode < 400 && /csv/.test(type) && (typeof body === "string" || Buffer.isBuffer(body))) {
      const csv = filterStoreCsv(String(body), scope);
      if (csv === null) { res.status(403).type("json"); return send(JSON.stringify({ ok: false, error: "导出未提供店铺标识，无法按数据权限导出" })); }
      res.set("Cache-Control", "private, no-store"); return send(csv);
    }
    return send(body);
  };
}

export function filterStoreCsv(text, scope) {
  const rows = []; let cells = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (!quoted && char === ',') { cells.push(cell); cell = ""; }
    else if (!quoted && (char === '\n' || char === '\r')) { if (char === '\r' && text[i+1] === '\n') i++; cells.push(cell); rows.push(cells); cells=[]; cell=""; }
    else cell += char;
  }
  if (cell || cells.length) { cells.push(cell); rows.push(cells); }
  if (!rows.length) return text;
  const index = rows[0].findIndex(name => [...identityKeys, "店铺名"].includes(name.replace(/^\uFEFF/, "").trim()));
  if (index < 0) return null;
  const allowed = [rows[0], ...rows.slice(1).filter(row => scope.can(row[index], "see"))];
  return allowed.map(row => row.map(value => '"' + value.replaceAll('"', '""') + '"').join(',')).join('\r\n');
}
