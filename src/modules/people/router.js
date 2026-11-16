import { Router } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
import { canAssignSiteAcl, canEditLogin, canEditRoster, canSeeLogin, scopeOf } from "./org-acl.js";
import {
  hydrateSiteAcl,
  listSiteAclBoard,
  readPersonSiteAcl,
  savePersonSiteAcl,
  siteAclPersistMode
} from "./site-acl.js";
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

const peopleJsPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../public/shared/modules/people.js");

peopleRouter.get("/client.js", (_req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.type("application/javascript");
  res.sendFile(peopleJsPath);
});

export const PEOPLE_CHARTER = {
  agentAccess: "read-only",
  sourceOfTruth: {
    employment: "花名册",
    shopRights: "管辖 / 店铺主数据"
  },
  notSource: ["钉钉通讯录", "其它模块本地名单", "智能体记忆"],
  dingTalk: false,
  roster: "手维护",
  shopRightsMaintain: "手维护",
  hrModule: "智能人事",
  hrPath: "/hr",
  hrNav: "主框架",
  hrTopics: ["假勤", "打卡", "调休", "加班"],
  orgTabs: ["店铺主数据", "成员管理", "责权", "权限", "改动日志"],
  release: {
    module: "组织中心",
    applicant: "罗成运营部主脑"
  },
  rule: "智能体是只读调用方。在职与店权只认花名册和管辖。组织中心不接钉钉，不改 people 表加钉钉字段，不同步钉钉通讯录。花名册和店权仍手维护。假勤、打卡、调休、加班归智能人事。主框架已有智能人事入口，组织中心不再铺菜单。"
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

function loginViewOf(actor, person) {
  const canSee = canSeeLogin(actor, person);
  const canEdit = canEditLogin(actor, person);
  if (canSee) {
    return { ...person, canSeeLogin: true, canEditLogin: canEdit };
  }
  return { ...person, username: "", password: "", canSeeLogin: false, canEditLogin: false };
}

function findListedPerson(id) {
  const key = String(id);
  return listPeople().find((row) => String(row.id) === key) || null;
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
    "",
    "示例运营",
    "",
    "示例运营",
    "示例旗舰店",
    "",
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

peopleRouter.get("/org/site-acl/me", async (req, res) => {
  await hydratePeopleRoster();
  await hydrateOrgStores();
  await hydrateSiteAcl();
  const actor = await resolveActor(req);
  const board = listSiteAclBoard(actor);
  res.json({ ok: true, persist: siteAclPersistMode(), actor, me: board.me, catalog: board.catalog });
});

peopleRouter.get("/org/site-acl/:name", async (req, res) => {
  await hydratePeopleRoster();
  await hydrateOrgStores();
  await hydrateSiteAcl();
  const actor = await resolveActor(req);
  if (!canAssignSiteAcl(actor)) {
    res.status(403).json({ ok: false, error: "只有罗成、韩梦凯、沈子晗能配网站权限" });
    return;
  }
  sendResult(res, readPersonSiteAcl(actor, req.params.name), false);
});

peopleRouter.put("/org/site-acl/:name", async (req, res) => {
  await hydratePeopleRoster();
  await hydrateOrgStores();
  await hydrateSiteAcl();
  const actor = await resolveActor(req);
  sendResult(res, await savePersonSiteAcl(actor, req.params.name, req.body || {}), false);
});

peopleRouter.get("/org/site-acl", async (req, res) => {
  await hydratePeopleRoster();
  await hydrateOrgStores();
  await hydrateSiteAcl();
  const actor = await resolveActor(req);
  const board = listSiteAclBoard(actor);
  res.json({ ok: true, persist: siteAclPersistMode(), ...board });
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
    people: listPeople().map((row) => loginViewOf(actor, row))
  });
});

peopleRouter.get("/template", (_req, res) => {
  const sample = ["示例同事", "罗成", "沈子晗", "", "", "示例同事", "", "在职", "示例同事", "ChangeMe123!"];
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
  const actor = await requireRosterEditor(req, res);
  if (!actor) {
    return;
  }
  await hydratePeopleRoster();
  const body = req.body || {};
  const ids = (Array.isArray(body.ids) ? body.ids : []).filter((id) => {
    const person = findListedPerson(id);
    return person && canEditLogin(actor, person);
  });
  sendResult(res, await patchPeoplePasswords(ids, body.password), false);
});

peopleRouter.post("/remove", async (req, res) => {
  if (!(await requireRosterEditor(req, res))) {
    return;
  }
  await hydratePeopleRoster();
  sendResult(res, await removePeople(req.body?.ids), false);
});

peopleRouter.patch("/:id", async (req, res) => {
  const actor = await resolveActor(req);
  await hydratePeopleRoster();
  const found = findListedPerson(req.params.id);
  if (!found) {
    res.status(404).json({ ok: false, error: "人员不存在" });
    return;
  }
  const input = req.body && typeof req.body === "object" ? req.body : {};
  const loginInput = {};
  const rest = {};
  Object.keys(input).forEach((key) => {
    if (key === "username" || key === "password") {
      loginInput[key] = input[key];
    } else {
      rest[key] = input[key];
    }
  });
  if (Object.keys(rest).length && !canEditRoster(actor)) {
    res.status(403).json({ ok: false, error: "只有罗成、韩梦凯、沈子晗能改成员" });
    return;
  }
  if (Object.keys(loginInput).length && !canEditLogin(actor, found)) {
    res.status(403).json({ ok: false, error: "超出责权：只能改自己的账号密码" });
    return;
  }
  sendResult(res, await patchPerson(req.params.id, { ...rest, ...loginInput }), false);
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
