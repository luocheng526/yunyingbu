import { Router } from "express";
import {
  CENTERS,
  POSTS,
  createGrant,
  createPerson,
  createShop,
  hydratePeopleRoster,
  importPeople,
  listGrants,
  listPeople,
  listShops,
  patchPerson,
  patchPeoplePasswords,
  peopleRosterPersistMode,
  PEOPLE_IMPORT_HEADERS,
  reconcilePeople,
  removePeople
} from "./store.js";
import { canEditRoster, scopeOf } from "./org-acl.js";
import {
  STORE_IMPORT_HEADERS,
  createOrgStore,
  hydrateOrgStores,
  importOrgStores,
  listOrgLogs,
  listOrgStores,
  listRightsBoard,
  listTeams,
  orgStoresPersistMode,
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

async function requireRosterEditor(req, res) {
  const actor = await resolveActor(req);
  if (!canEditRoster(actor)) {
    res.status(403).json({ ok: false, error: "只有罗成、韩梦凯、沈子晗能改成员" });
    return null;
  }
  return actor;
}

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
  await hydrateOrgStores();
  const actor = await resolveActor(req);
  const scope = scopeOf(actor);
  res.json({
    ok: true,
    demo: true,
    actor,
    scope: scope.key,
    scopeLabel: scope.label,
    persist: orgStoresPersistMode(),
    teams: listTeams(),
    summary: summarizeOrg(actor)
  });
});

peopleRouter.get("/org/stores", async (req, res) => {
  await hydrateOrgStores();
  const actor = await resolveActor(req);
  const scope = scopeOf(actor);
  res.json({
    ok: true,
    demo: true,
    actor,
    scope: scope.key,
    scopeLabel: scope.label,
    persist: orgStoresPersistMode(),
    canCreate: scope.key !== "none",
    teams: listTeams(),
    stores: listOrgStores(req.query || {}, actor)
  });
});

peopleRouter.get("/org/stores/template", (_req, res) => {
  const sample = [
    "罗成",
    "沈子晗",
    "",
    "示例运营",
    "",
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
  await hydrateOrgStores();
  const actor = await resolveActor(req);
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) {
    res.status(400).json({ ok: false, error: "请按模板导入至少一行" });
    return;
  }
  sendResult(res, await importOrgStores(rows, actor, { groupId: req.body?.groupId || req.body?.group_id || "" }), false);
});

peopleRouter.post("/org/stores", async (req, res) => {
  await hydrateOrgStores();
  sendResult(res, await createOrgStore(req.body || {}, await resolveActor(req)), true);
});

peopleRouter.patch("/org/stores/:id", async (req, res) => {
  await hydrateOrgStores();
  sendResult(res, await patchOrgStore(req.params.id, req.body || {}, await resolveActor(req)), false);
});

peopleRouter.delete("/org/stores/:id", async (req, res) => {
  await hydrateOrgStores();
  sendResult(res, await removeOrgStore(req.params.id, await resolveActor(req)), false);
});

peopleRouter.get("/org/logs", async (_req, res) => {
  await hydrateOrgStores();
  res.json({ ok: true, persist: orgStoresPersistMode(), logs: listOrgLogs() });
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

peopleRouter.get("/", async (req, res) => {
  await hydratePeopleRoster();
  const actor = await resolveActor(req);
  res.json({
    ok: true,
    demo: true,
    actor,
    canEdit: canEditRoster(actor),
    persist: peopleRosterPersistMode(),
    charter: PEOPLE_CHARTER,
    centers: CENTERS,
    posts: POSTS,
    people: listPeople()
  });
});

peopleRouter.get("/template", (_req, res) => {
  const sample = ["示例同事", "罗成", "沈子晗", "", "示例同事", "", "在职", "示例同事", "ChangeMe123!"];
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

peopleRouter.post("/import", async (req, res) => {
  if (!(await requireRosterEditor(req, res))) {
    return;
  }
  await hydratePeopleRoster();
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  sendResult(res, await importPeople(rows), false);
});

peopleRouter.patch("/passwords", async (req, res) => {
  if (!(await requireRosterEditor(req, res))) {
    return;
  }
  await hydratePeopleRoster();
  const body = req.body || {};
  sendResult(res, await patchPeoplePasswords(body.ids, body.password), false);
});

peopleRouter.post("/remove", async (req, res) => {
  if (!(await requireRosterEditor(req, res))) {
    return;
  }
  await hydratePeopleRoster();
  sendResult(res, await removePeople(req.body?.ids), false);
});

peopleRouter.patch("/:id", async (req, res) => {
  if (!(await requireRosterEditor(req, res))) {
    return;
  }
  await hydratePeopleRoster();
  sendResult(res, await patchPerson(req.params.id, req.body || {}), false);
});

peopleRouter.post("/", async (req, res) => {
  if (!(await requireRosterEditor(req, res))) {
    return;
  }
  await hydratePeopleRoster();
  const result = await createPerson(req.body || {});
  if (!result.ok) {
    res.status(result.statusCode).json({ ok: false, error: result.error });
    return;
  }
  res.status(201).json({ ok: true, person: result.person });
});
