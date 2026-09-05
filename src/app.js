import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dataRouter } from "./modules/data/router.js";
import { hanRouter } from "./modules/han/router.js";
import { attachHome } from "./modules/home/attach.js";
import { peopleRouter } from "./modules/people/router.js";
import { attachProfile } from "./modules/profile/attach.js";
import { releasesPageGate } from "./modules/releases/auth.js";
import { createReleasesRouter } from "./modules/releases/router.js";
import { shenRouter } from "./modules/shen/router.js";
import { createNotesStore } from "./notes-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

export function createApp(options = {}) {
  const notes = options.notesStore || createNotesStore();
  const app = express();
  app.use(express.json());
  attachProfile(app);
  app.use(releasesPageGate(options));
  app.use(express.static(publicDir));
  attachHome(app);

  app.get("/api/notes", (_req, res) => {
    res.json(notes.list());
  });
  app.post("/api/notes", (req, res) => {
    const text = req.body?.text;
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    res.status(201).json(notes.create(text));
  });

  app.use("/api/data", dataRouter);
  app.use("/api/han", hanRouter);
  app.use("/api/shen", shenRouter);
  app.use("/api/people", peopleRouter);
  app.use("/api/releases", createReleasesRouter(options));
  return app;
}
