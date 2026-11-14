import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { HOME_CLIENT_JS, HOME_JS_STAMP, rewriteHomeModuleUrl } from "../src/modules/home/asset-ver.js";
import { attachHome } from "../src/modules/home/attach.js";
import { homeRouter } from "../src/modules/home/router.js";

test("rewrites immutable homepage script url to no-store client.js", () => {
  const html =
    '<link rel="preload" href="/shared/modules/home.js?v=0.1.136" as="script" />' +
    '<script src="/shared/modules/home.js?v=0.1.136" defer></script>';
  const out = rewriteHomeModuleUrl(html);
  assert.equal(out.includes("/shared/modules/home.js"), false);
  assert.equal(out.includes(HOME_CLIENT_JS), true);
    assert.match(HOME_CLIENT_JS, /^\/api\/home\/client\.js\?v=0\.1\.951-noerp$/);
});

test("serves /api/home/client.js from current homepage module", async () => {
  const app = express();
  app.use("/api/home", homeRouter());
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/home/client.js`);
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.match(String(res.headers.get("cache-control") || ""), /no-store/i);
    assert.match(text, /xm-module-home 0\.1\.951-noerp/);
    assert.match(text, /function liveTheadHtml/);
    assert.match(text, /function liveFilterHtml/);
    assert.match(text, /data-live-filter="pick"/);
    assert.match(text, /data-refresh-live/);
    assert.match(text, /data-live-heads/);
    assert.match(text, /京准通主账户ID/);
    assert.match(text, /真实费比/);
    assert.match(text, /店铺列表/);
    assert.match(text, /责权归属/);
    assert.match(text, /xm-hm-live-at">更新时间 /);
    assert.match(text, /\/api\/han\/worker\?view=overview/);
    assert.match(text, /\/api\/shen\/paid\?latest=1/);
    assert.match(text, /\/api\/shen\/paid\/jingmai/);
    assert.match(text, /function mergeLivePaid/);
    assert.match(text, /function sortLiveShops/);
    assert.match(text, /sortLiveShops\(feePickShops/);
    assert.match(text, /han-shen-local/);
    assert.match(text, /function liveBoardOf/);
    assert.match(text, /function seesAllLiveShops/);
    assert.doesNotMatch(text, /各店费比目标在表头列里单独设置/);
    assert.match(text, /\.xm-hm-table thead th\{text-align:center\}/);
    assert.match(text, /label: "费比监控"/);
    assert.match(text, /label: "更新时间"/);
    assert.match(text, /label: "费比设置"/);
    assert.doesNotMatch(text, /label: "是否回传成功"/);
    assert.match(text, /label: "状态"/);
    assert.match(text, /function liveLinkOf/);
    assert.match(text, /费比超标/);
    assert.match(text, /加大付费/);
    assert.doesNotMatch(text, /label: "实时利润"/);
    assert.doesNotMatch(text, /label: "实时销售额"/);
    assert.match(text, /placeholder="搜索店铺"/);
    assert.match(text, /liveChipHtml\("link", "off", "掉线"/);
    assert.match(text, /liveChipHtml\("paid", "no", "未接入店铺"/);
    assert.match(text, /function liveSearchHtml/);
    assert.match(text, /xm-home-live-cols/);
    assert.match(text, /\.xm-hm-table th\{text-align:center/);
    assert.match(text, /实时成交金额/);
    assert.doesNotMatch(text, /京麦面板实时金额/);
    assert.match(text, /实时总成交金额/);
    assert.match(text, /推广总花费/);
    assert.match(text, /xm-hm-yest-now/);
    assert.match(text, /环比 —/);
    assert.match(text, /xm-home-live-yday/);
    assert.match(text, /function feeChartOf/);
    assert.match(text, /function mixFeeHours/);
    assert.match(text, /repeat\(3,minmax\(0,1fr\)\)/);
    assert.match(text, /LIVE_CARD_KEYS = \["livePay", "roi", "livePaid", "feeHot", "feeCold", "liveAt"\]/);
    assert.match(text, /实时付费超标店铺/);
    assert.match(text, /实时费比低店铺/);
    assert.match(text, /实时付费接入店铺数量/);
    assert.doesNotMatch(text, /实时销售指数/);
    assert.match(text, /xm-home-live-card-order/);
    assert.match(text, /xm-home-live-row/);
    assert.match(text, /xm-home-live-head-order/);
    assert.match(text, /is-picked/);
    assert.doesNotMatch(text, /xm-home-fee-targets/);
    assert.match(text, /han-fee-targets/);
    assert.match(text, /shen-fee-targets/);
    assert.match(text, /shen-home-fee-targets/);
    assert.doesNotMatch(text, /\/api\/han\/fee-targets/);
    assert.doesNotMatch(text, /\/api\/shen\/fee-targets/);
    assert.doesNotMatch(text, /function overlayFeeBooks/);
    assert.match(text, /LIVE_REFRESH_MS = 10 \* 60 \* 1000/);
    assert.match(text, /cache: "no-store"/);
    assert.match(text, /Promise\.resolve\(pullLive\(\)\)/);
    assert.doesNotMatch(text, /function kickLive/);
    assert.match(text, /function scrapedFeeRange/);
    assert.match(text, /function scrapedFeeBook/);
    assert.match(text, /function applyFeeBook/);
    assert.match(text, /function ensureFreshHome/);
    assert.match(text, /m\.feeTargets = d\.feeTargets/);
    assert.match(text, /var HOME_JS_STAMP = "0\.1\.951-noerp"/);
    assert.match(text, /费比监控/);
    assert.match(text, /label: "更新时间"/);
    assert.match(text, /onOutsideCardSet/);
    assert.doesNotMatch(text, /\/api\/home\/erp-paid/);
    assert.doesNotMatch(text, /function liveFromErp/);
    assert.doesNotMatch(text, /function pullLiveKpis/);
    assert.match(text, /method: body \? "POST"/);
    assert.match(text, /api\("\/api\/home\/local-paid"/);
    assert.match(text, /sum\.spend \* \(sY \/ sT\)/);
    assert.match(text, /fillLocalPaid\(blankLive\(\)/);
    assert.match(text, /m\.hourly = d\.hourly/);
    assert.match(text, /\/api\/home\/erp-kpis/);
    assert.match(text, /platformFee/);
    assert.match(text, /按支付时间统计的订单金额\(包含无效单、代发单\)/);
    assert.match(text, /SPU推广费用/);
    assert.match(text, /京小洁采购单成本\+导入的货品成本/);
    assert.match(text, /净货品成本占比 \(支付\)/);
    const sum = await fetch(`http://127.0.0.1:${port}/api/home/summary`);
    const sumJson = await sum.json();
    assert.equal(sumJson.stamp, HOME_JS_STAMP);
    assert.match(String(sum.headers.get("cache-control") || ""), /no-store/i);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test("any html page rewrites home.js to no-store client.js and intercepts later loads", async () => {
  const app = express();
  attachHome(app);
  app.get("/probe", (_req, res) => {
    res
      .type("html")
      .send(
        '<!DOCTYPE html><html lang="zh-CN"><head></head><body><script src="/shared/modules/home.js?v=0.1.112"></script></body></html>'
      );
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/probe`);
    const html = await res.text();
    assert.equal(html.includes('/shared/modules/home.js?v=0.1.112'), false);
    assert.equal(html.includes(HOME_CLIENT_JS), true);
    assert.match(html, /data-xm-home-live-js="1"/);
    assert.match(html, /HTMLScriptElement/);
    assert.match(html, /indexOf\("\/shared\/modules\/home\.js"\)/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
