import { stopCollectLoop, setBoundFetch } from "./collect.js";
import { resetBoundStore as resetMemory } from "./persist.js";
import { setBoundClock } from "./time.js";

export { setBoundFetch, startLink, pollLink, pickAccount, qrBytes, linkStatus, tick, ensureCollectLoop } from "./collect.js";
export { readView, savePagePref, saveRowMark, exportView, catalogBody, coverageBody, progressBody } from "./view.js";
export { setBoundClock } from "./time.js";

export function resetBoundStore() {
  stopCollectLoop();
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
