import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter } from "./modules/profile/auth-router.js";
import { profileRouter } from "./modules/profile/profile-router.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../public");

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static(publicDir));
  app.get("/me", (_req, res) => {
    res.sendFile(path.join(publicDir, "me.html"));
  });
  app.use("/api/profile", profileRouter);
  app.use("/api/auth", authRouter);
  return app;
}
