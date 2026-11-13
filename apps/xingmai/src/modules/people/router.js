import { Router } from "express";
import {
  CENTERS,
  POSTS,
  SHOP_KINDS,
  createGrant,
  createPerson,
  createShop,
  listGrants,
  listPeople,
  listShops,
  reconcileRoster,
  updatePerson
} from "./store.js";

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

peopleRouter.patch("/:id", async (req, res) => {
  const result = await updatePerson(req.params.id, req.body || {});
  if (!result.ok) {
    res.status(result.statusCode).json({ ok: false, error: result.error });
    return;
  }
  res.json({ ok: true, person: result.person });
});
