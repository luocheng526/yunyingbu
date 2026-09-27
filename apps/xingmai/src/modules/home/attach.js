import { homeRouter } from "./router.js";
import { registerPageRoutes } from "./pages.js";
import { rewriteHomeModuleUrl } from "./asset-ver.js";

function bustHomeScript(req, res, next) {
  const dest = String(req.path || "").replace(/\/+$/, "") || "/";
  if ((req.method === "GET" || req.method === "HEAD") && dest === "/home") {
    const send = res.send.bind(res);
    res.send = function sendHomeHtml(body) {
      if (typeof body === "string" && body.indexOf("/shared/modules/home.js") !== -1) {
        return send(rewriteHomeModuleUrl(body));
      }
      return send(body);
    };
  }
  next();
}

/** Add homepage page routes and /api/home. Does not remove existing middleware. */
export function attachHome(app) {
  app.use(bustHomeScript);
  registerPageRoutes(app);
  app.use("/api/home", homeRouter());
}
