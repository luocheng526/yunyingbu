/** 组织中心脚本。/shared/modules/people.js?v=… 会被浏览器按版本锁 24 小时。 */
export const PEOPLE_CLIENT_VER = "0.1.229-site-acl-ui";
export const PEOPLE_CLIENT_JS = `/api/people/client.js?v=${PEOPLE_CLIENT_VER}`;

export function rewritePeopleModuleUrl(html) {
  return String(html || "")
    .replace(/\/shared\/modules\/people\.js(?:\?v=[^"'\s>]+)?/g, PEOPLE_CLIENT_JS)
    .replace(/\/api\/people\/client\.js(?:\?v=[^"'\s>]+)?/g, PEOPLE_CLIENT_JS);
}

export function bustPeopleHtml(req, res, next) {
  const dest = String(req.path || "").replace(/\/+$/, "") || "/";
  if ((req.method === "GET" || req.method === "HEAD") && dest === "/people") {
    const send = res.send.bind(res);
    res.send = function sendPeopleHtml(body) {
      if (
        typeof body === "string" &&
        (body.includes("/shared/modules/people.js") || body.includes("/api/people/client.js"))
      ) {
        return send(rewritePeopleModuleUrl(body));
      }
      return send(body);
    };
  }
  next();
}
