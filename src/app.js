/**
 * Local demo app only. Never copy this file onto /opt/mengkai or into a
 * release ticket. Live createApp() belongs to the shared mengkai tree;
 * we only overlay src/modules/data/* and public/data*.
 */
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dataRouter } from "./modules/data/router.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(publicDir));
  app.get("/data", (_req, res) => {
    res.sendFile(path.join(publicDir, "data.html"));
  });
  app.get("/data/stores/live", (_req, res) => {
    res.sendFile(path.join(publicDir, "data-store-live.html"));
  });
  app.get("/data/stores/overview", (_req, res) => {
    res.sendFile(path.join(publicDir, "data-store-overview.html"));
  });
  app.get("/data/goods/overview", (_req, res) => {
    res.sendFile(path.join(publicDir, "data-goods-overview.html"));
  });
  app.get("/data/placeholder", (_req, res) => {
    res.sendFile(path.join(publicDir, "data/placeholder/index.html"));
  });
  app.use("/api/data", dataRouter);
  return app;
}
