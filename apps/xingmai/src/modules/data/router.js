import { Router } from "express";
import { getOverview } from "./overview.js";
import { listErpGoods, listErpShops } from "./erp.js";

export const dataRouter = Router();

function sendErp(res, run) {
  return run()
    .then((data) => res.json(data))
    .catch((err) => {
      const status = Number(err.statusCode) || 500;
      res.status(status).json({ ok: false, error: err.message || "星脉 ERP 调用失败" });
    });
}

dataRouter.get("/overview", async (_req, res) => {
  res.json(await getOverview());
});

dataRouter.get("/shops", (req, res) => {
  sendErp(res, () =>
    listErpShops({
      pageNum: req.query.pageNum || req.query.page,
      pageSize: req.query.pageSize,
      shopName: req.query.shopName || req.query.q,
      shopId: req.query.shopId
    })
  );
});

dataRouter.get("/goods", (req, res) => {
  sendErp(res, () =>
    listErpGoods({
      pageNum: req.query.pageNum || req.query.page,
      pageSize: req.query.pageSize,
      shopId: req.query.shopId,
      shopIds: req.query.shopIds,
      payTimeStart: req.query.payTimeStart || req.query.from,
      payTimeEnd: req.query.payTimeEnd || req.query.to,
      orderBy: req.query.orderBy,
      asc: req.query.asc
    })
  );
});
