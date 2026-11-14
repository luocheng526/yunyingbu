import { Router } from "express";
import { getOverview } from "./overview.js";
import { startErpDayJobs, summarizeDays } from "./erp-days.js";

export const dataRouter = Router();

function kickJobs() {
  startErpDayJobs();
}

dataRouter.get("/nav", async (_req, res, next) => {
  try {
    const { getNav } = await import("./nav.js");
    res.json(getNav());
  } catch (err) {
    next(err);
  }
});

dataRouter.get("/overview", async (req, res, next) => {
  try {
    kickJobs();
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
    kickJobs();
    res.json(await summarizeDays(req.query));
  } catch (err) {
    next(err);
  }
});

async function pageJson(name, res, next) {
  try {
    const pages = await import("./pages.js");
    res.json(pages[name]());
  } catch (err) {
    next(err);
  }
}

dataRouter.get("/stores/live", (_req, res, next) => pageJson("getStoreLive", res, next));
dataRouter.get("/stores/overview", (_req, res, next) => pageJson("getStoreOverview", res, next));
dataRouter.get("/goods/overview", (_req, res, next) => pageJson("getGoodsOverview", res, next));
dataRouter.get("/placeholder", (_req, res, next) => pageJson("getPlaceholder", res, next));
dataRouter.get("/team", (_req, res, next) => pageJson("getTeamOverview", res, next));
dataRouter.get("/shops", (_req, res, next) => pageJson("getShopOverview", res, next));
dataRouter.get("/goods/board", (_req, res, next) => pageJson("getGoodsBoard", res, next));
dataRouter.get("/live", (_req, res, next) => pageJson("getLiveBoard", res, next));
