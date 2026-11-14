import { HOME_CLIENT_JS, rewriteHomeModuleUrl } from "./asset-ver.js";
import { homeRouter } from "./router.js";
import { registerPageRoutes } from "./pages.js";

function isLoginHtml(html) {
  return /class=["'][^"']*\blogin-page\b/.test(html) || /href=["']\/login\.css/.test(html);
}

function homeLiveBoot() {
  return `    <script data-xm-home-live-js="1">(function(){var live=${JSON.stringify(
    HOME_CLIENT_JS
  )};function swap(u){return String(u||"").indexOf("/shared/modules/home.js")>=0?live:u;}var p=window.HTMLScriptElement&&HTMLScriptElement.prototype;if(!p)return;var d=Object.getOwnPropertyDescriptor(p,"src");if(d&&d.set){Object.defineProperty(p,"src",{configurable:true,enumerable:d.enumerable,get:d.get,set:function(u){d.set.call(this,swap(u));}});}var s=p.setAttribute;if(typeof s==="function"){p.setAttribute=function(n,v){if(String(n).toLowerCase()==="src")v=swap(v);return s.call(this,n,v);};}})();</script>
`;
}

function bustHomeScript(req, res, next) {
  const send = res.send.bind(res);
  res.send = function sendHomeHtml(body) {
    if (typeof body !== "string") {
      return send(body);
    }
    let html = body;
    if (html.indexOf("/shared/modules/home.js") !== -1) {
      html = rewriteHomeModuleUrl(html);
    }
    if (
      /<html[\s>]/i.test(html) &&
      html.indexOf("data-xm-home-live-js") === -1 &&
      html.indexOf("</head>") !== -1 &&
      !isLoginHtml(html)
    ) {
      html = html.replace("</head>", homeLiveBoot() + "  </head>");
    }
    return send(html);
  };
  next();
}

/** Add homepage page routes and /api/home. Does not remove existing middleware. */
export function attachHome(app) {
  app.use(bustHomeScript);
  registerPageRoutes(app);
  app.use("/api/home", homeRouter());
}
