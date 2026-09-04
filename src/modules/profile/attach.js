import { authRouter } from "./auth-router.js";
import { profileRouter } from "./profile-router.js";

export function attachProfile(app) {
  app.use("/api/auth", authRouter);
  app.use("/api/profile", profileRouter);
}
