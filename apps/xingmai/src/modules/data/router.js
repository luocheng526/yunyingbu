import { Router } from "express";
import {
  getErpCategoryBoard,
  getErpOverview,
  listErpChannelGroups,
  listErpCompare,
  listErpGoods,
  listErpShopOptions,
  listErpShopStats
} from "./erp.js";

export const dataRouter = Router();

function sendErp(res, run) {
  return run()
    .then((data) => res.json(data))
    .catch((err) => {
      const status = Number(err.statusCode) || 500;
      res.status(status).json({ ok: false, error: err.message || "星脉 ERP 调用失败" });
    });
}

function rangeQuery(query) {
  return {
    pageNum: query.pageNum || query.page,
    pageSize: query.pageSize,
    shopId: query.shopId,
    shopIds: query.shopIds,
    shopName: query.shopName || query.q,
    payTimeStart: query.payTimeStart || query.from,
    payTimeEnd: query.payTimeEnd || query.to,
    orderBy: query.orderBy,
    asc: query.asc
  };
}

dataRouter.get("/overview", (req, res) => {
  sendErp(res, () => getErpOverview(rangeQuery(req.query)));
});

dataRouter.get("/shops", (req, res) => {
  sendErp(res, () => listErpShopStats(rangeQuery(req.query)));
});

dataRouter.get("/shop-options", (_req, res) => {
  sendErp(res, () => listErpShopOptions());
});

dataRouter.get("/goods", (req, res) => {
  sendErp(res, () => listErpGoods(rangeQuery(req.query)));
});

dataRouter.get("/groups", (req, res) => {
  sendErp(res, () => listErpChannelGroups(rangeQuery(req.query)));
});

dataRouter.get("/categories", (req, res) => {
  sendErp(res, () => getErpCategoryBoard(rangeQuery(req.query)));
});

dataRouter.get("/compare", (req, res) => {
  sendErp(res, () => listErpCompare(rangeQuery(req.query)));
});
