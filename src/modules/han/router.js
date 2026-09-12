import express, { Router } from "express";
import { createHanStore, matchOrgStoresForTeam, mergeTeamShops, buildProductCsv } from "./store.js";

async function loadOrgStores(req) {
  const host = req.get("host");
  if (!host) {
    return [];
  }
  const proto = req.protocol === "https" ? "https" : "http";
  const url = `${proto}://${host}/api/people/org/stores`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        cookie: req.headers.cookie || "",
      },
    });
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return data && data.ok ? data.stores || [] : [];
  } catch {
    return [];
  }
}

export function createHanRouter(store = createHanStore()) {
  const hanRouter = Router();

  // 智能体只读汇总：按店 + 时间范围。不要直接查 han_* 内部表。
  hanRouter.get("/summary", async (req, res) => {
    try {
      const summary = await store.listSummary({
        store: req.query.store,
        from: req.query.from,
        to: req.query.to,
      });
      res.json({ ok: true, ...summary });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/tasks", async (_req, res) => {
    try {
      res.json({ ok: true, tasks: await store.listTasks() });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post("/tasks", async (req, res) => {
    try {
      const task = await store.createTask(req.body || {});
      res.status(201).json({ ok: true, task });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/brief", async (_req, res) => {
    try {
      res.json({ ok: true, ...(await store.getBrief()) });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.put("/brief", async (req, res) => {
    try {
      const body = req.body || {};
      res.json({ ok: true, ...(await store.setBrief({ text: body.text })) });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/selection", async (_req, res) => {
    try {
      res.json({ ok: true, items: await store.listSelection() });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post("/selection", async (req, res) => {
    try {
      const item = await store.createSelection(req.body || {});
      res.status(201).json({ ok: true, item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/products", async (req, res) => {
    try {
      res.json({
        ok: true,
        items: await store.listProducts({ team: req.query.team, store: req.query.store }),
      });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/shops", async (req, res) => {
    try {
      const team = req.query.team;
      const local = await store.listShops({ team });
      const org = matchOrgStoresForTeam(await loadOrgStores(req), team);
      res.json({ ok: true, items: mergeTeamShops(org, local) });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post("/shops", async (req, res) => {
    try {
      const item = await store.createShop(req.body || {});
      res.status(201).json({ ok: true, item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post("/products", async (req, res) => {
    try {
      const item = await store.createProduct(req.body || {});
      res.status(201).json({ ok: true, item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/products.csv", async (req, res) => {
    try {
      const items = await store.listProducts({ team: req.query.team, store: req.query.store });
      const csv = "\uFEFF" + buildProductCsv(items);
      const name = encodeURIComponent((req.query.store || req.query.team || "商品") + "-分层表.csv");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="' + name + '"; filename*=UTF-8\'\'' + name);
      res.send(csv);
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.patch("/products/:id", async (req, res) => {
    try {
      const item = await store.updateProduct(req.params.id, req.body || {});
      res.json({ ok: true, item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/shop-rules", async (req, res) => {
    try {
      const item = await store.getShopRules({ team: req.query.team, store: req.query.store });
      res.json({ ok: true, ...item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.put("/shop-rules", async (req, res) => {
    try {
      const body = req.body || {};
      const item = await store.saveShopRules({
        team: body.team,
        store: body.store,
        rules: body.rules,
      });
      res.json({ ok: true, ...item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/shop-plans", async (req, res) => {
    try {
      const item = await store.getShopPlans({ team: req.query.team, store: req.query.store });
      res.json({ ok: true, ...item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.put("/shop-plans", async (req, res) => {
    try {
      const body = req.body || {};
      const item = await store.saveShopPlans({
        team: body.team,
        store: body.store,
        monthItems: body.monthItems,
        weekItems: body.weekItems,
        monthPlan: body.monthPlan,
        weekPlan: body.weekPlan,
      });
      res.json({ ok: true, ...item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.delete("/shop-rules", async (req, res) => {
    try {
      const item = await store.resetShopRules({ team: req.query.team, store: req.query.store });
      res.json({ ok: true, ...item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post("/products/classify", async (req, res) => {
    try {
      const body = req.body || {};
      const result = await store.classifyProducts({ team: body.team, store: body.store });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post("/products/import", async (req, res) => {
    try {
      const body = req.body || {};
      const result = await store.importProducts({
        team: body.team,
        store: body.store,
        items: body.items,
        csv: body.csv,
      });
      res.status(result.created.length ? 201 : 200).json({ ok: true, ...result });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post(
    "/products/import-file",
    express.raw({ type: () => true, limit: "12mb" }),
    async (req, res) => {
      try {
        const result = await store.importProducts({
          team: req.query.team,
          store: req.query.store,
          file: req.body,
          filename: String(req.query.filename || req.get("x-filename") || ""),
        });
        res.status(result.created.length ? 201 : 200).json({ ok: true, ...result });
      } catch (err) {
        res.status(err.statusCode || 500).json({ ok: false, error: err.message });
      }
    },
  );

  hanRouter.get("/paid", async (_req, res) => {
    try {
      res.json({ ok: true, items: await store.listPaid() });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post("/paid", async (req, res) => {
    try {
      const item = await store.createPaid(req.body || {});
      res.status(201).json({ ok: true, item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.get("/training", async (_req, res) => {
    try {
      res.json({ ok: true, items: await store.listTraining() });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  hanRouter.post("/training", async (req, res) => {
    try {
      const item = await store.createTraining(req.body || {});
      res.status(201).json({ ok: true, item });
    } catch (err) {
      res.status(err.statusCode || 500).json({ ok: false, error: err.message });
    }
  });

  return hanRouter;
}

export const hanRouter = createHanRouter();
export default hanRouter;
