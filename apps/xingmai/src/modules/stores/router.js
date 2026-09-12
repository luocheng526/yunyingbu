import { Router } from "express";
import {
  STORE_PAGES,
  listErpInventory,
  listErpReviews,
  listErpShipping,
  listErpStoreShops,
  listErpViolations
} from "./erp.js";
import {
  createRecord,
  createStore,
  deleteRecord,
  deleteStore,
  snapshot,
  updateRecord,
  updateStore
} from "./store.js";

export const storesRouter = Router();

function sendResult(res, result, created) {
  if (!result.ok) {
    res.status(result.statusCode || 400).json({ ok: false, error: result.error });
    return;
  }
  res.status(created ? 201 : 200).json({ ok: true, ...result });
}

function sendErp(res, run) {
  return run()
    .then((data) => res.json(data))
    .catch((err) => {
      const status = Number(err.statusCode) || 500;
      res.status(status).json({ ok: false, error: err.message || "星脉 ERP 调用失败" });
    });
}

function erpQuery(query = {}) {
  return {
    pageNum: query.pageNum || query.page,
    pageSize: query.pageSize,
    shopId: query.shopId,
    shopIds: query.shopIds,
    shopName: query.shopName || query.q,
    orderStatus: query.orderStatus,
    productStatus: query.productStatus
  };
}

storesRouter.get("/erp/shops", (_req, res) => {
  sendErp(res, () => listErpStoreShops());
});

storesRouter.get("/erp/reviews", (req, res) => {
  sendErp(res, () => listErpReviews(erpQuery(req.query)));
});

storesRouter.get("/erp/violations", (req, res) => {
  sendErp(res, () => listErpViolations(erpQuery(req.query)));
});

storesRouter.get("/erp/shipping", (req, res) => {
  sendErp(res, () => listErpShipping(erpQuery(req.query)));
});

storesRouter.get("/erp/inventory", (req, res) => {
  sendErp(res, () => listErpInventory(erpQuery(req.query)));
});

storesRouter.get("/erp/pages", (_req, res) => {
  res.json({ ok: true, module: "店铺维护中心", pages: STORE_PAGES });
});

storesRouter.get("/", async (_req, res) => {
  const data = await snapshot();
  res.json({
    ok: true,
    module: "店铺维护中心",
    message: "",
    pages: STORE_PAGES,
    ...data
  });
});

storesRouter.post("/", async (req, res) => {
  sendResult(res, await createStore(req.body || {}), true);
});

storesRouter.patch("/:id", async (req, res) => {
  sendResult(res, await updateStore(req.params.id, req.body || {}), false);
});

storesRouter.delete("/:id", async (req, res) => {
  sendResult(res, await deleteStore(req.params.id), false);
});

storesRouter.post("/records", async (req, res) => {
  sendResult(res, await createRecord(req.body || {}), true);
});

storesRouter.patch("/records/:id", async (req, res) => {
  sendResult(res, await updateRecord(req.params.id, req.body || {}), false);
});

storesRouter.delete("/records/:id", async (req, res) => {
  sendResult(res, await deleteRecord(req.params.id), false);
});
