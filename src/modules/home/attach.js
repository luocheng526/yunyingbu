import { homeRouter } from "./router.js";
import { registerPageRoutes } from "./pages.js";
import { rewriteHomeModuleUrl } from "./asset-ver.js";
import { rewritePeopleModuleUrl } from "../people/asset-ver.js";

function bustModuleScripts(req, res, next) {
  const dest = String(req.path || "").replace(/\/+$/, "") || "/";
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }
  if (dest === "/home") {
    const send = res.send.bind(res);
    res.send = function sendHomeHtml(body) {
      if (typeof body === "string" && body.indexOf("/shared/modules/home.js") !== -1) {
        return send(rewriteHomeModuleUrl(body));
      }
      return send(body);
    };
  } else if (dest === "/people") {
    const send = res.send.bind(res);
    res.send = function sendPeopleHtml(body) {
      if (
        typeof body === "string" &&
        (body.indexOf("/shared/modules/people.js") !== -1 || body.indexOf("/api/people/client.js") !== -1)
      ) {
        return send(rewritePeopleModuleUrl(body));
      }
      return send(body);
    };
  }
  next();
}

/** Add homepage page routes and /api/home. Also bust 组织中心 people.js cache. */
export function attachHome(app) {
  app.use(bustModuleScripts);
  registerPageRoutes(app);
  app.use("/api/home", homeRouter());
}
