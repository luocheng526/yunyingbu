import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter, currentUser, profileRouter, publicProfile, resolveDesk } from "./auth.js";
import { injectHtmlShell, requireLoginUnlessPublic } from "./middleware.js";
import { prefsRouter } from "./prefs.js";

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
        await resolveDesk(user);
      } catch {
        user.desk = user.desk || "";
      }
      const profile = publicProfile(user);
      res.redirect((profile && profile.home) || "/home");
      return;
    }
    res.sendFile(path.join(publicDir, "login.html"));
  });
  app.use("/api/auth/prefs", prefsRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
}
