import { Router } from "express";
import { getErpOverview, listErpGoods, listErpShopStats, listErpShops } from "./erp.js";

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

dataRouter.get("/shop-options", (req, res) => {
  sendErp(res, () =>
    listErpShops({
      pageNum: req.query.pageNum || req.query.page || 1,
      pageSize: req.query.pageSize || 50,
      shopName: req.query.shopName || req.query.q,
      shopId: req.query.shopId
    })
  );
});

dataRouter.get("/goods", (req, res) => {
  sendErp(res, () => listErpGoods(rangeQuery(req.query)));
});
