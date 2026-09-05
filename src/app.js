import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { shenRouter } from "./modules/shen/router.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(publicDir));
  app.get("/shen", (_req, res) => {
    res.sendFile(path.join(publicDir, "shen.html"));
  });
  app.use("/api/shen", shenRouter);
  return app;
}
