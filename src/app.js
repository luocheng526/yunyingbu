import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { peopleRouter } from "./modules/people/router.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(publicDir));
  app.use("/api/people", peopleRouter);
  app.get("/people", (_req, res) => {
    res.sendFile(path.join(publicDir, "people.html"));
  });
  return app;
}
