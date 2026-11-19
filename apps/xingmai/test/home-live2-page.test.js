import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const homeJs = readFileSync(new URL("../public/shared/modules/home.js", import.meta.url), "utf8");

test("实时（新版） sits after 近七天业绩汇总 and stays independent of old live", () => {
  const views = homeJs.slice(homeJs.indexOf("var VIEWS"), homeJs.indexOf("var OVERVIEW_PANES"));
  assert.match(views, /key: "live", label: "实时" \},\s*\{ key: "week", label: "近七天业绩汇总" \},\s*\{ key: "live2", label: "实时（新版）" \}/);
  assert.match(homeJs, /live2: true/);
  assert.match(homeJs, /function adaptLive2Shops/);
  assert.match(homeJs, /xm-home-live2-/);
  assert.match(homeJs, /采集功能待接入/);
  assert.match(homeJs, /实时费比 =（实时付费金额 \/ 实时成交金额）× 100%/);
  assert.match(homeJs, /data-connect-live2/);
  assert.match(homeJs, /data-refresh-live2/);
  assert.match(homeJs, /pendingCollect/);
  assert.match(homeJs, /待接入/);
  assert.match(homeJs, /xm-hm-login-link is-wait[\s\S]{0,180}待接入<\/button>/);
  assert.match(homeJs, /manual: state\.view === "live2"/);
  assert.match(homeJs, /账号和密码已经填好，请在画面里点登录/);
  const panel = homeJs.slice(homeJs.indexOf("function live2PanelHtml"), homeJs.indexOf("function paint"));
  assert.match(panel, /liveDeskHtml\(state\)/);
});

test("opening 实时（新版） does not call old collect or login endpoints", () => {
  const start = homeJs.indexOf("function refreshLive2");
  const end = homeJs.indexOf("function pullLive");
  const body = homeJs.slice(start, end);
  assert.equal(start > 0, true);
  assert.match(body, /\/api\/people\/org\/stores/);
  assert.match(body, /\/api\/home\/live2/);
  assert.doesNotMatch(body, /local-paid|live-login|jingmai|erp-paid|\/api\/shen\/paid|\/api\/han\/paid/);
  const mount = homeJs.slice(homeJs.lastIndexOf("pullBoard();"));
  assert.match(mount, /state\.view === "live2"[\s\S]*refreshLive2\(\)[\s\S]*pullLive\(\)/);
  assert.match(homeJs, /if \(state\.view === "live" \|\| state\.view === "company"\) \{\s*pullLive\(\);\s*\}/);
  const boot = homeJs.slice(homeJs.lastIndexOf("pullBoard();"), homeJs.lastIndexOf("poll = window.setInterval"));
  assert.match(boot, /state\.view === "live2"/);
  assert.match(boot, /refreshLive2\(\)/);
  assert.match(boot, /pullLive\(\)/);
  assert.doesNotMatch(boot, /view === "live2"[\s\S]{0,40}pullLive\(/);
});
