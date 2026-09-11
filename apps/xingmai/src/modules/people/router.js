import { Router } from "express";
import {
  currentUser,
  forceResetPassword,
  isPlatformAdmin
} from "../profile/auth.js";
import {
  CENTERS,
  POSTS,
  SHOP_KINDS,
  createGrant,
  createPerson,
  createShop,
  deletePerson,
  listGrants,
  listPeople,
  listShops,
  reconcileRoster,
  updatePerson
} from "./store.js";

function requireAdmin(req, res) {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "未登录" });
    return null;
  }
  if (!isPlatformAdmin(user)) {
    res.status(403).json({ ok: false, error: "只有超管可以改别人的登录密码或删除人员" });
    return null;
  }
  return user;
}

export const peopleRouter = Router();

peopleRouter.get("/shops", async (_req, res) => {
  res.json({ ok: true, kinds: SHOP_KINDS, shops: await listShops() });
});

peopleRouter.post("/shops", async (req, res) => {
  const result = await createShop(req.body || {});
  if (!result.ok) {
    res.status(result.statusCode).json({ ok: false, error: result.error });
    return;
  }
  res.status(201).json({ ok: true, shop: result.shop });
});

peopleRouter.get("/grants", async (_req, res) => {
  res.json({ ok: true, grants: await listGrants() });
});

peopleRouter.post("/grants", async (req, res) => {
  const result = await createGrant(req.body || {});
  if (!result.ok) {
    res.status(result.statusCode).json({ ok: false, error: result.error });
    return;
  }
  res.status(201).json({ ok: true, grant: result.grant });
});

peopleRouter.get("/reconcile", async (_req, res) => {
  res.json({ ok: true, ...(await reconcileRoster()) });
});

peopleRouter.get("/", async (_req, res) => {
  res.json({
    ok: true,
    demo: true,
    centers: CENTERS,
    posts: POSTS,
    people: await listPeople()
  });
});

peopleRouter.post("/", async (req, res) => {
  const result = await createPerson(req.body || {});
  if (!result.ok) {
    res.status(result.statusCode).json({ ok: false, error: result.error });
    return;
  }
  res.status(201).json({ ok: true, person: result.person });
});

peopleRouter.post("/:id/password", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  const roster = await listPeople();
  const person = roster.find((item) => Number(item.id) === Number(req.params.id));
  if (!person) {
    res.status(404).json({ ok: false, error: "人员不存在" });
    return;
  }
  const result = await forceResetPassword(person.loginUsername || person.name, req.body?.newPassword);
  if (!result.ok) {
    res.status(result.statusCode).json({ ok: false, error: result.error });
    return;
  }
  res.json({ ok: true, resetToDefault: !String(req.body?.newPassword || "").trim() });
});

peopleRouter.patch("/:id", async (req, res) => {
  const result = await updatePerson(req.params.id, req.body || {});
  if (!result.ok) {
    res.status(result.statusCode).json({ ok: false, error: result.error });
    return;
  }
  res.json({ ok: true, person: result.person });
});

peopleRouter.delete("/:id", async (req, res) => {
  if (!requireAdmin(req, res)) {
    return;
  }
  const result = await deletePerson(req.params.id);
  if (!result.ok) {
    res.status(result.statusCode).json({ ok: false, error: result.error });
    return;
  }
  res.json({ ok: true });
});
