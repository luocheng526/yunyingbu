/** Bound page script. Must not use /shared/modules/bound.js?v=… — that URL is immutable for 24h. */
export const BOUND_CLIENT_JS = "/api/bound/client.js?v=qr-still-3";

export function rewriteBoundModuleUrl(html) {
  return String(html || "").replace(
    /\/shared\/modules\/bound\.js(?:\?[^"'\s>]*)?/g,
    BOUND_CLIENT_JS
  );
}
