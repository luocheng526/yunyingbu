import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { shenRouter } from "./modules/shen/router.js";
import { SHEN_LEGACY_REDIRECTS, SHEN_SUBMENUS } from "./modules/shen/submenu.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get("/shen", (_req, res) => {
    res.redirect(302, "/shen/selection");
  });
  for (const item of SHEN_SUBMENUS) {
    app.get(item.href, (_req, res) => {
      res.sendFile(path.join(publicDir, "shen", item.slug, "index.html"));
    });
  }
  for (const item of SHEN_LEGACY_REDIRECTS) {
    app.get(item.from, (_req, res) => {
      res.redirect(302, item.to);
    });
  }
  app.use(express.static(publicDir));
  app.use("/api/shen", shenRouter);
  return app;
}
