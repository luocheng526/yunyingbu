import path from "node:path";
import { fileURLToPath } from "node:url";
import { authRouter, currentUser, profileRouter } from "./auth.js";
import { requireLoginUnlessPublic } from "./middleware.js";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../public");

export function attachProfile(app) {
  app.use(requireLoginUnlessPublic);
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/login", (req, res) => {
    if (currentUser(req)) {
      res.redirect("/");
      return;
    }
    res.sendFile(path.join(publicDir, "login.html"));
  });
  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
}
