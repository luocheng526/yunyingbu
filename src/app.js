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
  app.use("/api/data", dataRouter);
  return app;
}
