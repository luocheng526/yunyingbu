import { Router } from "express";
import { CENTERS, createPerson, listPeople } from "./store.js";
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
  const shops = listOrgStores().map((row) => ({
    id: row.id,
    name: row.storeName,
    kind: "店铺",
    pack: row.team,
    bundle: row.lead,
    demo: row.demo
  }));
  res.json({ ok: true, kinds: ["店铺", "店群"], shops });
});

peopleRouter.get("/grants", (_req, res) => {
  const grants = listOrgStores().map((row) => ({
    id: row.id,
    personName: row.owner,
    shopName: row.storeName,
    role: "运营",
    startOn: "",
    endOn: "",
    active: row.statusKey !== "closed",
    revoked: false
  }));
  res.json({ ok: true, grants });
});

peopleRouter.get("/reconcile", (_req, res) => {
  res.json({ ok: true, employedNoGrant: [], grantOnLeft: [] });
});

peopleRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    demo: true,
    charter: PEOPLE_CHARTER,
    centers: CENTERS,
    posts: ["店长", "运营", "主管", "经理"],
    people: listPeople()
  });
});

peopleRouter.post("/", (req, res) => {
  const result = createPerson(req.body || {});
  if (!result.ok) {
    res.status(result.statusCode).json({ ok: false, error: result.error });
    return;
  }
  res.status(201).json({ ok: true, person: result.person });
});
