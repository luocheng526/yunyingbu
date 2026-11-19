/**
 * Shen Jingmai store — same MySQL tables as home.
 * Write/collect respect collector_owner + lease so home claim is real cross-worker mutex.
 * Read APIs stay available for 沈子晗 paid UI. Does not touch shen/router.js.
 */
import {
  COLLECTOR_OWNER_HOME,
  COLLECTOR_OWNER_SHEN,
  assertCollectorWrite,
  claimCollectorOwner,
  collectorLeaseExpired,
  getSession,
  listCollectTargets as homeListCollectTargets,
  listSamples,
  listSessions,
  markAuth as homeMarkAuth,
  readJingmaiLive,
  resetJingmaiStore,
  saveSample as homeSaveSample,
  saveSession as homeSaveSession,
  setJingmaiPoolForTests,
  setRoster,
  updateSessionCookies as homeUpdateSessionCookies
} from "../home/jingmai-store.js";

export {
  COLLECTOR_OWNER_HOME,
  COLLECTOR_OWNER_SHEN,
  assertCollectorWrite,
  claimCollectorOwner,
  collectorLeaseExpired,
  getSession,
  listSamples,
  listSessions,
  readJingmaiLive,
  resetJingmaiStore,
  setJingmaiPoolForTests,
  setRoster
};

export async function listCollectTargets() {
  // Skip shops home still holds under a valid lease; expired lease is reclaimable.
  return homeListCollectTargets({ writer: COLLECTOR_OWNER_SHEN });
}

export async function saveSession(store, fields) {
  return homeSaveSession(store, Object.assign({}, fields || {}, { writer: COLLECTOR_OWNER_SHEN }));
}

export async function markAuth(store, authState, authMessage, options) {
  return homeMarkAuth(
    store,
    authState,
    authMessage,
    Object.assign({}, options || {}, { writer: COLLECTOR_OWNER_SHEN })
  );
}

export async function saveSample(sample, options) {
  return homeSaveSample(sample, Object.assign({}, options || {}, { writer: COLLECTOR_OWNER_SHEN }));
}

export async function updateSessionCookies(store, cookies, options) {
  return homeUpdateSessionCookies(
    store,
    cookies,
    Object.assign({}, options || {}, { writer: COLLECTOR_OWNER_SHEN })
  );
}

/** Shen collector may claim only when empty/expired; never steals active home lease. */
export async function claimShenCollectorOwner(store) {
  return claimCollectorOwner(store, COLLECTOR_OWNER_SHEN);
}
