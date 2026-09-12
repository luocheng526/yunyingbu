/** Homepage script URL. Must not use /shared/modules/home.js?v=… — that URL is immutable for 24h. */
export const HOME_CLIENT_JS = "/api/home/client.js?v=0.1.390-home-noprof";

export function rewriteHomeModuleUrl(html) {
  return String(html || "").replace(
    /\/shared\/modules\/home\.js(?:\?v=[^"'\s>]+)?/g,
    HOME_CLIENT_JS
  );
}
