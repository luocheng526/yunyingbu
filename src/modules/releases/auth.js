import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const COOKIE_NAME = "mk_sid";
export const RELEASES_CSS_HREF = "/releases.css?v=hist-scroll-1";
export const RELEASES_SCROLL_STYLE_ID = "xm-releases-scroll";
export const RELEASES_FETCH_PATCH_ID = "xm-releases-fetch-patch";
const releasesCssFile = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../public/releases.css");

export function releasesScrollStyleTag() {
  return `<style id="${RELEASES_SCROLL_STYLE_ID}">
html:has(.oc-wrap),html:has(.oc-wrap) body,html:has(.oc-wrap) body.xm-app,html:has(.oc-wrap) body.xm-app-shell,html:has(.oc-wrap) body:has(.xm-shell){height:100%!important;max-height:100dvh!important;overflow:hidden!important;}
.xm-shell:has(.oc-wrap){display:flex!important;align-items:stretch!important;height:100dvh!important;max-height:100dvh!important;min-height:0!important;overflow:hidden!important;}
.xm-shell:has(.oc-wrap) .xm-main{display:flex!important;flex-direction:column!important;flex:1 1 0%!important;min-width:0!important;min-height:0!important;overflow:hidden!important;}
.xm-content:has(.oc-wrap),.xm-shell:has(.oc-wrap) .xm-content{flex:1 1 0%!important;height:0!important;min-height:0!important;overflow-x:auto!important;overflow-y:scroll!important;touch-action:pan-y;}
.pane,.xm-content .pane,.page .pane{display:none!important;}
.pane.on,.xm-content .pane.on,.page .pane.on{display:block!important;}
#history-view,#logs-view,.xm-content #history-view,.xm-content #logs-view{max-height:calc(100dvh - 15rem);overflow-x:auto!important;overflow-y:scroll!important;touch-action:pan-y;}
</style>`;
}

export function releasesFetchPatchTag() {
  return `<script id="${RELEASES_FETCH_PATCH_ID}">
(function(){
  var raw=window.fetch;
  if(!raw||raw.__xmRelPatch){return;}
  function patched(input,init){
    var url=typeof input==="string"?input:(input&&input.url)||"";
    init=init?Object.assign({},init):{};
    if(String(url).indexOf("/api/releases")===0){
      delete init.signal;
    }
    return raw.call(this,input,init);
  }
  patched.__xmRelPatch=1;
  window.fetch=patched;
})();
</script>`;
}

function looksLikeHtml(text) {
  return /<html[\s>]/i.test(text) || /<\/head>/i.test(text) || /<head[\s>]/i.test(text);
}

export function injectReleasesCssLink(html) {
  const text = String(html || "");
  if (!text || !looksLikeHtml(text)) {
    return text;
  }
  const linkTag = `<link rel="stylesheet" href="${RELEASES_CSS_HREF}">`;
  let out = text.replace(/<link\b[^>]*href=["'][^"']*\/releases\.css[^"']*["'][^>]*>/gi, (full) => {
    if (/rel\s*=\s*["']?(?:preload|stylesheet)/i.test(full)) {
      return linkTag;
    }
    return full;
  });
  const extras = [];
  if (!out.includes(`id="${RELEASES_SCROLL_STYLE_ID}"`)) {
    extras.push(releasesScrollStyleTag());
  }
  if (!out.includes(`id="${RELEASES_FETCH_PATCH_ID}"`)) {
    extras.push(releasesFetchPatchTag());
  }
  if (!out.includes(`href="${RELEASES_CSS_HREF}"`)) {
    extras.push(linkTag);
  }
  if (extras.length && /<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, `${extras.join("\n")}\n</head>`);
  }
  return out;
}

const profileAuthPath = fileURLToPath(new URL("../profile/auth.js", import.meta.url));
const profileSessionPath = fileURLToPath(new URL("../profile/session.js", import.meta.url));

let profileCurrentUser = undefined;
let profileImport = null;

function loadProfileCurrentUser() {
  if (profileCurrentUser !== undefined) {
    return Promise.resolve(profileCurrentUser);
  }
  const spec = existsSync(profileAuthPath)
    ? "../profile/auth.js"
    : existsSync(profileSessionPath)
      ? "../profile/session.js"
      : null;
  if (!spec) {
    return Promise.resolve(null);
  }
  if (!profileImport) {
    profileImport = import(spec)
      .then((mod) => {
        profileCurrentUser = typeof mod.currentUser === "function" ? mod.currentUser : null;
        return profileCurrentUser;
      })
      .catch(() => {
        profileCurrentUser = null;
        profileImport = null;
        return null;
      });
  }
  return profileImport;
}

export async function resolveUser(req, options = {}) {
  if (Object.prototype.hasOwnProperty.call(options, "getUser")) {
    return options.getUser(req) || null;
  }
  const currentUser = await loadProfileCurrentUser();
  if (typeof currentUser !== "function") {
    return null;
  }
  return currentUser(req) || null;
}

export function requireReleasesAuth(options = {}) {
  return async function requireReleasesAuthMiddleware(req, res, next) {
    const path = String(req.path || "");
    if (req.method === "POST" && (path === "/webhooks/github" || path.endsWith("/webhooks/github"))) {
      next();
      return;
    }
    const user = await resolveUser(req, options);
    if (!user) {
      res.status(401).json({ ok: false, error: "未登录" });
      return;
    }
    req.user = user;
    next();
  };
}

function requestPath(req) {
  return String(req.path || "/").replace(/\/+$/, "") || "/";
}

function isReleasesPage(req) {
  const method = String(req.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }
  const pathname = requestPath(req);
  return pathname === "/releases" || pathname === "/releases.html";
}

function isReleasesCss(req) {
  const method = String(req.method || "GET").toUpperCase();
  return (method === "GET" || method === "HEAD") && requestPath(req) === "/releases.css";
}

function rewriteHtmlBody(body) {
  if (typeof body === "string") {
    return looksLikeHtml(body) ? injectReleasesCssLink(body) : body;
  }
  if (Buffer.isBuffer(body) && body.length < 500000) {
    const text = body.toString("utf8");
    if (looksLikeHtml(text)) {
      const next = injectReleasesCssLink(text);
      return next === text ? body : next;
    }
  }
  return body;
}

function attachCssInjector(res) {
  if (res.__xmReleasesCssInject) {
    return;
  }
  res.__xmReleasesCssInject = true;
  res.setHeader("Link", `<${RELEASES_CSS_HREF}>; rel=stylesheet`);
  const origSend = res.send.bind(res);
  res.send = function sendWithCss(body) {
    return origSend(rewriteHtmlBody(body));
  };
  const origSendFile = typeof res.sendFile === "function" ? res.sendFile.bind(res) : null;
  if (origSendFile) {
    res.sendFile = function sendFileWithCss(filePath, options, callback) {
      const cb = typeof options === "function" ? options : callback;
      const opts = typeof options === "function" || options == null ? undefined : options;
      try {
        if (/\.html?$/i.test(String(filePath || "")) && existsSync(filePath)) {
          res.type("html");
          return origSend(injectReleasesCssLink(readFileSync(filePath, "utf8")));
        }
      } catch {
        /* fall through to sendFile */
      }
      return origSendFile(filePath, opts, cb);
    };
  }
  const origEnd = res.end.bind(res);
  res.end = function endWithCss(chunk, encoding, cb) {
    const rewritten = rewriteHtmlBody(chunk);
    if (rewritten !== chunk) {
      res.removeHeader("Content-Length");
      return origEnd.call(this, rewritten, encoding, cb);
    }
    return origEnd.call(this, chunk, encoding, cb);
  };
}

export function releasesPageGate(options = {}) {
  return async function releasesPageGateMiddleware(req, res, next) {
    if (isReleasesCss(req)) {
      res.setHeader("Cache-Control", "no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      if (!existsSync(releasesCssFile)) {
        next();
        return;
      }
      res.type("css").send(readFileSync(releasesCssFile, "utf8"));
      return;
    }
    if (!isReleasesPage(req)) {
      next();
      return;
    }
    const user = await resolveUser(req, options);
    if (user) {
      res.setHeader("Cache-Control", "no-store");
      attachCssInjector(res);
      next();
      return;
    }
    res.redirect("/login");
  };
}
