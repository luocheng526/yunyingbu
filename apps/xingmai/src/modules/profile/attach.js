import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter, profileRouter } from "./auth.js";
import { injectHtmlShell, requireLoginUnlessPublic } from "./middleware.js";
import { noticesRouter } from "../notices/router.js";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../public");

export function attachProfile(app) {
  app.use(requireLoginUnlessPublic);
  app.use(injectHtmlShell);
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/login", (_req, res) => {
    res.sendFile(path.join(publicDir, "login.html"));
  });
  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
  // 公告接口挂在这里，避免交 src/app.js。网页点「通过」只 POST {}，闸门看不到 app.js 正文会 400。
  app.use("/api/notices", noticesRouter);
}
