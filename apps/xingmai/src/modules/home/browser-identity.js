// Only the current, successful native account response can supply this fallback.
// belongBizId is a merchant ID, never a shop ID or an arbitrary list's first item.
export function nativeAccountMerchant(payload) {
  if (Number(payload?.code) !== 200) return "";
  const data = payload?.data;
  if (!data || data.currentBelongType == null || !Array.isArray(data.belongVos)) return "";
  const current = data.belongVos.filter(row => row && String(row.belongType) === String(data.currentBelongType));
  if (current.length !== 1) return "";
  const id = String(current[0].belongBizId || "").trim();
  return /^\d+$/.test(id) && id === String(data.venderId || "").trim() ? id : "";
}

export function nativeMerchantMatches(expected, page, merchantId) {
  return Boolean(merchantId && expected?.merchantId && !expected.ambiguousMerchant &&
    !page?.shopId && !page?.ambiguousShopId && String(expected.merchantId).trim() === merchantId);
}

export function watchNativeAccount(ws, send) {
  let merchantId = "", epoch = 0, sequence = 0, topFrame = "", stopped = false;
  const pending = new Map();
  function onMessage(event) {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.method === "Page.frameNavigated" && !message.params?.frame?.parentId) {
      epoch++; merchantId = ""; pending.clear(); topFrame = message.params?.frame?.id || "";
      return;
    }
    if (message.method === "Network.responseReceived") {
      const params = message.params, response = params?.response;
      let url;
      try { url = new URL(response.url); } catch { return; }
      if (url.protocol !== "https:" || url.hostname !== "sff.jd.com" ||
        url.searchParams.get("api") !== "dsm.shop.pageframe.navigation.accountFacade.findAccountInfo" ||
        (topFrame && params.frameId !== topFrame)) return;
      merchantId = ""; sequence++;
      if (response.status === 200) pending.set(params.requestId, { epoch, sequence, sessionId: message.sessionId || "" });
      return;
    }
    if (message.method !== "Network.loadingFinished") return;
    const requestId = message.params?.requestId, request = pending.get(requestId);
    if (!request) return;
    pending.delete(requestId);
    send(ws, "Network.getResponseBody", { requestId }, request.sessionId).then(result => {
      if (stopped || request.epoch !== epoch || request.sequence !== sequence) return;
      try {
        const body = result.base64Encoded ? Buffer.from(result.body || "", "base64").toString("utf8") : String(result.body || "");
        merchantId = nativeAccountMerchant(JSON.parse(body));
      } catch { merchantId = ""; }
    }).catch(() => {});
  }
  ws.addEventListener("message", onMessage);
  return { read: () => merchantId, stop: () => { stopped = true; pending.clear(); ws.removeEventListener("message", onMessage); } };
}
