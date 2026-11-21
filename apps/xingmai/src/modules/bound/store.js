import { resetQrClient, resetPasswordCredentials, stopCollectLoop, setBoundFetch } from "./collect.js";
import { resetBoundStore as resetMemory } from "./persist.js";
import { setBoundClock } from "./time.js";

export { setBoundFetch, startLink, pollLink, pickAccount, qrBytes, linkStatus, noteQrClient, resetQrClient, tick, ensureCollectLoop, loginWithPassword } from "./collect.js";
export { readView, savePagePref, saveRowMark, exportView, catalogBody, coverageBody, progressBody } from "./view.js";
export { setBoundClock } from "./time.js";

export function resetBoundStore() {
  stopCollectLoop();
  resetQrClient();
  resetPasswordCredentials();
  setBoundFetch(globalThis.fetch);
  setBoundClock(null);
  resetMemory();
}

export function isBoundAdmin(user) {
  const names = [user && user.username, user && user.displayName, user && user.name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return names.some((name) => name === "罗成" || name.toLowerCase() === "luocheng");
}
