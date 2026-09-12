import { Router } from "express";
import { getOverview } from "./overview.js";
import { getNav } from "./nav.js";
import {
  getGoodsBoard,
  getGoodsOverview,
  getLiveBoard,
  getPlaceholder,
  getStoreLive,
  getShopOverview,
  getStoreOverview,
  getTeamOverview
} from "./pages.js";

export const dataRouter = Router();

dataRouter.get("/nav", (_req, res) => {
  res.json(getNav());
});

dataRouter.get("/overview", async (_req, res, next) => {
  try {
    res.json(await getOverview());
  } catch (err) {
    next(err);
  }
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

dataRouter.get("/placeholder", (_req, res) => {
  res.json(getPlaceholder());
});

dataRouter.get("/team", (_req, res) => {
  res.json(getTeamOverview());
});

dataRouter.get("/shops", (_req, res) => {
  res.json(getShopOverview());
});

dataRouter.get("/goods/board", (_req, res) => {
  res.json(getGoodsBoard());
});

dataRouter.get("/live", (_req, res) => {
  res.json(getLiveBoard());
});
