import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createNotesStore } from "./notes-store.js";
import { hanRouter } from "./modules/han/router.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

export function createApp() {
  const store = createNotesStore();
  const app = express();
  app.use(express.json());
  app.use(express.static(publicDir));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/notes", (_req, res) => {
    res.json(store.list());
  });

  app.post("/api/notes", (req, res) => {
    const text = req.body?.text;
    if (!text) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    res.status(201).json(store.create(text));
  });

  app.use("/api/han", hanRouter);

  app.get("/han", (_req, res) => {
    res.sendFile(path.join(publicDir, "han.html"));
  });

  return app;
}
