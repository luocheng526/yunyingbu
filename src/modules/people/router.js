import { Router } from "express";
import {
  CENTERS,
  POSTS,
  createGrant,
  createPerson,
  createShop,
  listGrants,
  listPeople,
  listShops,
  patchPerson,
  reconcilePeople
} from "./store.js";
import {
  createOrgStore,
  listOrgLogs,
  listOrgStores,
  listTeams,
  patchOrgStore,
  removeOrgStore,
  summarizeOrg
} from "./org-board.js";

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

peopleRouter.get("/org/summary", (_req, res) => {
  res.json({ ok: true, demo: true, teams: listTeams(), summary: summarizeOrg() });
});

peopleRouter.get("/org/stores", (req, res) => {
  res.json({
    ok: true,
    demo: true,
    teams: listTeams(),
    stores: listOrgStores(req.query || {})
  });
});

peopleRouter.post("/org/stores", (req, res) => {
  sendResult(res, createOrgStore(req.body || {}), true);
});

peopleRouter.patch("/org/stores/:id", (req, res) => {
  sendResult(res, patchOrgStore(req.params.id, req.body || {}), false);
});

peopleRouter.delete("/org/stores/:id", (req, res) => {
  sendResult(res, removeOrgStore(req.params.id), false);
});

peopleRouter.get("/org/logs", (_req, res) => {
  res.json({ ok: true, logs: listOrgLogs() });
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
