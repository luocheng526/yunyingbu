import { profileRouter } from "./profile-router.js";

export function attachProfile(app) {
  app.use("/api/profile", profileRouter);
}
