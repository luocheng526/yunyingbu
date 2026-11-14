import { Router } from "express";
import { getOverview } from "./overview.js";
import { getNav } from "./nav.js";
import { startErpDayJobs, summarizeDays } from "./erp-days.js";
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
startErpDayJobs();

dataRouter.get("/nav", (_req, res) => {
  res.json(getNav());
});

dataRouter.get("/overview", async (req, res, next) => {
  try {
    const from = String(req.query.from || req.query.payTimeStart || "").slice(0, 10);
    const to = String(req.query.to || req.query.payTimeEnd || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      const local = await summarizeDays({ from, to });
      if (local && local.ok && (local.shops || []).length) {
        res.json(local);
        return;
      }
    }
    res.json(await getOverview());
  } catch (err) {
    next(err);
  }
});

dataRouter.get("/erp-days", async (req, res, next) => {
  try {
    res.json(await summarizeDays(req.query));
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
