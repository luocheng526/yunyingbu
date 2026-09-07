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

  // 页面路由必须在 static 前面。否则 GET / 会被 index.html 直接吐出，绕过注入。
  attachHome(app);
  app.use(
    express.static(join(__dirname, "..", "public"), {
      index: false,
      etag: true,
      lastModified: true,
      setHeaders(res, filePath) {
        if (/\.(?:css|js)$/i.test(filePath)) {
          const versioned = Boolean(res.req && res.req.query && res.req.query.v);
          res.setHeader(
            "Cache-Control",
            versioned ? "public, max-age=86400, immutable" : "public, max-age=0, must-revalidate"
          );
          return;
        }
        if (/\.html?$/i.test(filePath)) {
          res.setHeader("Cache-Control", "private, no-store");
        }
      }
    })
  );
  app.use("/api/releases", createReleasesRouter());
  return app;
}
