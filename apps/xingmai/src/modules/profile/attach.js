import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter, currentUser, profileRouter } from "./auth.js";
import { injectHtmlShell, requireLoginUnlessPublic } from "./middleware.js";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../public");

export function attachProfile(app) {
  app.use(requireLoginUnlessPublic);
  app.use(injectHtmlShell);
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/login", async (req, res) => {
    const leaving = String(req.query.out || "") === "1";
    const user = currentUser(req);
    if (!leaving && user) {
      try {
        const { deskOf } = await import("../work/store.js");
        user.desk = await deskOf(user);
      } catch {
        user.desk = user.desk || "";
      }
      res.redirect(user.desk === "hr" ? "/hr" : "/data");
      return;
    }
    res.sendFile(path.join(publicDir, "login.html"));
  });
  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
}
