import { Router } from "express";
import { getOverview } from "./overview.js";
import { getNav } from "./nav.js";
import { getGoodsOverview, getStoreLive, getStoreOverview } from "./pages.js";

export const dataRouter = Router();

dataRouter.get("/nav", (_req, res) => {
  res.json(getNav());
});

dataRouter.get("/overview", (_req, res) => {
  res.json(getOverview());
});

dataRouter.get("/stores/live", (_req, res) => {
  res.json(getStoreLive());
});

dataRouter.get("/stores/overview", (_req, res) => {
  res.json(getStoreOverview());
});

dataRouter.get("/goods/overview", (_req, res) => {
  res.json(getGoodsOverview());
});
