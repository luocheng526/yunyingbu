import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachHome } from "./modules/home/attach.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(publicDir));
  attachHome(app);
  return app;
}
