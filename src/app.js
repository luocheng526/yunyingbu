import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bustPeopleHtml, rewritePeopleModuleUrl } from "./modules/people/asset-ver.js";
import { peopleRouter } from "./modules/people/router.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(bustPeopleHtml);
  app.use(express.static(publicDir));
  app.use("/api/people", peopleRouter);
  app.get("/people", (_req, res) => {
    const html = fs.readFileSync(path.join(publicDir, "people.html"), "utf8");
    res.type("html").send(rewritePeopleModuleUrl(html));
  });
  return app;
}
