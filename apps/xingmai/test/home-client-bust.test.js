import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { HOME_CLIENT_JS, rewriteHomeModuleUrl } from "../src/modules/home/asset-ver.js";
import { homeRouter } from "../src/modules/home/router.js";

test("rewrites immutable homepage script url to no-store client.js", () => {
  const html =
    '<link rel="preload" href="/shared/modules/home.js?v=0.1.136" as="script" />' +
    '<script src="/shared/modules/home.js?v=0.1.136" defer></script>';
  const out = rewriteHomeModuleUrl(html);
  assert.equal(out.includes("/shared/modules/home.js"), false);
  assert.equal(out.includes(HOME_CLIENT_JS), true);
  assert.match(HOME_CLIENT_JS, /^\/api\/home\/client\.js\?v=0\.1\.723-home-headset$/);
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
    assert.match(text, /xm-module-home 0\.1\.723-home-headset/);
    assert.match(text, /function liveTheadHtml/);
    assert.match(text, /function liveFilterHtml/);
    assert.match(text, /data-live-filter="pick"/);
    assert.match(text, /data-refresh-live/);
    assert.match(text, /data-live-heads/);
    assert.match(text, /京准通主账户ID/);
    assert.match(text, /真实费比/);
    assert.match(text, /店铺列表/);
    assert.match(text, /\.xm-hm-table thead th\{text-align:center\}/);
    assert.match(text, /label: "费比监控"/);
    assert.match(text, /label: "更新时间"/);
    assert.match(text, /label: "费比目标设置"/);
    assert.doesNotMatch(text, /label: "实时利润"/);
    assert.doesNotMatch(text, /label: "实时销售额"/);
    assert.match(text, /data-fee-shop/);
    assert.match(text, /xm-home-live-cols/);
    assert.match(text, /\.xm-hm-table th\{text-align:center/);
    assert.match(text, /京麦面板实时金额/);
    assert.match(text, /实时付费接入店铺数量/);
    assert.doesNotMatch(text, /实时销售指数/);
    assert.match(text, /xm-home-live-card-order/);
    assert.match(text, /xm-home-live-row/);
    assert.match(text, /xm-home-live-head-order/);
    assert.match(text, /is-picked/);
    assert.match(text, /xm-home-fee-targets/);
    assert.match(text, /费比监控/);
    assert.match(text, /更新时间 /);
    assert.match(text, /onOutsideCardSet/);
    assert.match(text, /\/api\/home\/erp-paid/);
    assert.match(text, /\/api\/home\/erp-kpis/);
    assert.match(text, /platformFee/);
    assert.match(text, /按支付时间统计的订单金额\(包含无效单、代发单\)/);
    assert.match(text, /SPU推广费用/);
    assert.match(text, /京小洁采购单成本\+导入的货品成本/);
    assert.match(text, /净货品成本占比 \(支付\)/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});
