import { homeRouter } from "./router.js";
import { registerPageRoutes } from "./pages.js";

/** Add homepage page routes and /api/home. Does not remove existing middleware. */
export function attachHome(app) {
  registerPageRoutes(app);
  app.use("/api/home", homeRouter());
}
