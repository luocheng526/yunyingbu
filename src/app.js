import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachHome } from "./modules/home/attach.js";
import { createReleasesRouter } from "./modules/releases/router.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

export function createApp(options = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.static(publicDir));
  attachHome(app);
  app.use("/api/releases", createReleasesRouter(options));
  return app;
}
