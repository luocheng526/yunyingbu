import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { addNote, listNotes } from "./notes-store.js";
import { attachHome } from "./modules/home/attach.js";
import { attachProfile } from "./modules/profile/attach.js";
import { releasesPageGate } from "./modules/releases/auth.js";
import { createReleasesRouter } from "./modules/releases/router.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.use(express.json());
  attachProfile(app);
  app.use(releasesPageGate());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/notes", (_req, res) => {
    res.json(listNotes());
  });

  app.post("/api/notes", (req, res) => {
    try {
      const note = addNote(req.body?.text);
      res.status(201).json(note);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.use(express.static(join(__dirname, "..", "public")));

  attachHome(app);
  app.use("/api/releases", createReleasesRouter());
  return app;
}
