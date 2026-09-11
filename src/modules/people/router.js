import { Router } from "express";
import {
  CENTERS,
  POSTS,
  createGrant,
  createPerson,
  createShop,
  importPeople,
  listGrants,
  listPeople,
  listShops,
  patchPerson,
  patchPeoplePasswords,
  PEOPLE_IMPORT_HEADERS,
  reconcilePeople
} from "./store.js";
import { scopeOf } from "./org-acl.js";
import {
  STORE_IMPORT_HEADERS,
  createOrgStore,
  importOrgStores,
  listOrgLogs,
  listOrgStores,
  listRightsBoard,
  listTeams,
  patchOrgStore,
  pinRightsName,
  removeOrgStore,
  summarizeOrg,
  unpinRightsName
} from "./org-board.js";
import {
  createNotice,
  createValue,
  listLeaderboard,
  listNotices,
  listValues,
  noticeStats
} from "./org-extra.js";

async function resolveActor(req) {
  const fromQuery = typeof req.query?.actor === "string" ? req.query.actor.trim() : "";
  const header = typeof req.headers["x-actor"] === "string" ? req.headers["x-actor"].trim() : "";
  if (req.user && req.user.username) {
    return String(req.user.username);
  }
  try {
    const auth = await import("../profile/auth.js");
    if (typeof auth.currentUser === "function") {
      const user = auth.currentUser(req);
      if (user && user.username) {
        return String(user.username);
      }
    }
    return fromQuery || header || "";
  } catch {
    return fromQuery || header || "罗成";
  }
}

export const peopleRouter = Router();

export const PEOPLE_CHARTER = {
  agentAccess: "read-only",
  sourceOfTruth: {
    employment: "花名册",
    shopRights: "管辖 / 店铺主数据"
  },
  rule: "智能体是只读调用方。在职与店权只认花名册和管辖。"
};

function sendResult(res, result, created) {
  if (!result.ok) {
    res.status(result.statusCode).json({ ok: false, error: result.error });
    return;
  }
  res.status(created ? 201 : 200).json({ ok: true, ...result });
}

peopleRouter.get("/charter", (_req, res) => {
  res.json({ ok: true, ...PEOPLE_CHARTER });
});

peopleRouter.get("/org/summary", async (req, res) => {
  const actor = await resolveActor(req);
  const scope = scopeOf(actor);
  res.json({
    ok: true,
    demo: true,
    actor,
    scope: scope.key,
    scopeLabel: scope.label,
    teams: listTeams(),
    summary: summarizeOrg(actor)
  });
});

peopleRouter.get("/org/stores", async (req, res) => {
  const actor = await resolveActor(req);
  const scope = scopeOf(actor);
  res.json({
    ok: true,
    demo: true,
    actor,
    scope: scope.key,
    scopeLabel: scope.label,
    canCreate: scope.key !== "none",
    teams: listTeams(),
    stores: listOrgStores(req.query || {}, actor)
  });
});

peopleRouter.get("/org/stores/template", (_req, res) => {
  const sample = [
    "沈子晗组",
    "张文静",
    "示例运营",
    "示例旗舰店",
    "10001",
    "11009999",
    "运营中",
    "9.11更新",
    "",
    "demo_9999",
    "Demo123!"
  ];
  const csv =
    "\uFEFF" +
    STORE_IMPORT_HEADERS.join(",") +
    "\n" +
    sample.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",") +
    "\n";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="org-stores-template.csv"');
  res.send(csv);
});

peopleRouter.post("/org/stores/import", async (req, res) => {
  const actor = await resolveActor(req);
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) {
    res.status(400).json({ ok: false, error: "请按模板导入至少一行" });
    return;
  }
  sendResult(res, importOrgStores(rows, actor), false);
});

peopleRouter.post("/org/stores", async (req, res) => {
  sendResult(res, createOrgStore(req.body || {}, await resolveActor(req)), true);
});

peopleRouter.patch("/org/stores/:id", async (req, res) => {
  sendResult(res, patchOrgStore(req.params.id, req.body || {}, await resolveActor(req)), false);
});

peopleRouter.delete("/org/stores/:id", async (req, res) => {
  sendResult(res, removeOrgStore(req.params.id, await resolveActor(req)), false);
});

peopleRouter.get("/org/logs", (_req, res) => {
  res.json({ ok: true, logs: listOrgLogs() });
});

peopleRouter.get("/org/rights-board", (_req, res) => {
  res.json(listRightsBoard());
});

peopleRouter.post("/org/rights-board/pin", (req, res) => {
  sendResult(res, pinRightsName(req.body?.name, req.body?.role), false);
});

peopleRouter.post("/org/rights-board/unpin", (req, res) => {
  sendResult(res, unpinRightsName(req.body?.name), false);
});

peopleRouter.get("/org/board", async (req, res) => {
  const actor = await resolveActor(req);
  res.json({ ok: true, actor, ...listLeaderboard(actor) });
});

peopleRouter.get("/org/values", (_req, res) => {
  res.json({ ok: true, items: listValues() });
});

peopleRouter.post("/org/values", (req, res) => {
  sendResult(res, createValue(req.body || {}), true);
});

peopleRouter.get("/org/notices", (req, res) => {
  res.json({
    ok: true,
    stats: noticeStats(),
    items: listNotices(req.query || {})
  });
});

peopleRouter.post("/org/notices", async (req, res) => {
  sendResult(res, createNotice(req.body || {}, await resolveActor(req)), true);
});

peopleRouter.get("/shops", (_req, res) => {
  res.json({ ok: true, kinds: ["店铺", "店群"], shops: listShops() });
});

peopleRouter.post("/shops", (req, res) => {
  sendResult(res, createShop(req.body || {}), true);
});

peopleRouter.get("/grants", (_req, res) => {
  res.json({ ok: true, grants: listGrants() });
});

peopleRouter.post("/grants", (req, res) => {
  sendResult(res, createGrant(req.body || {}), true);
});

peopleRouter.get("/reconcile", (_req, res) => {
  res.json({ ok: true, ...reconcilePeople() });
});

peopleRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    demo: true,
    charter: PEOPLE_CHARTER,
    centers: CENTERS,
    posts: POSTS,
    people: listPeople()
  });
});

peopleRouter.get("/template", (_req, res) => {
  const sample = ["示例同事", "沈子晗运营中心", "沈子晗", "运营", "沈子晗运营中心", "在职", "示例同事", "ChangeMe123!"];
  const csv =
    "\uFEFF" +
    PEOPLE_IMPORT_HEADERS.join(",") +
    "\n" +
    sample.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",") +
    "\n";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="people-template.csv"');
  res.send(csv);
});

peopleRouter.post("/import", (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  sendResult(res, importPeople(rows), false);
});

peopleRouter.patch("/passwords", (req, res) => {
  const body = req.body || {};
  sendResult(res, patchPeoplePasswords(body.ids, body.password), false);
});

peopleRouter.patch("/:id", (req, res) => {
  sendResult(res, patchPerson(req.params.id, req.body || {}), false);
});

peopleRouter.post("/", (req, res) => {
  const result = createPerson(req.body || {});
  if (!result.ok) {
    res.status(result.statusCode).json({ ok: false, error: result.error });
    return;
  }
  res.status(201).json({ ok: true, person: result.person });
});
