import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { applyHomeXmUi, patchConnectPicker } from "../src/modules/home/connect-patch.js";

const homeJs = fs.readFileSync(new URL("../public/shared/modules/home.js", import.meta.url), "utf8");

test("homepage content uses XmUI and the live login hooks stay", () => {
  assert.match(homeJs, /class="xm-hm xm-ui-scope"/);
  assert.match(homeJs, /window\.XmUI\.PageContentHeader/);
  assert.match(homeJs, /window\.XmUI\.StatCard/);
  assert.match(homeJs, /window\.XmUI\.ChartCard/);
  assert.match(homeJs, /window\.XmUI\.DataTable/);
  assert.match(homeJs, /window\.XmUI\.StatusBadge/);
  assert.match(homeJs, /window\.XmUI\.FilterToolbar/);
  assert.match(homeJs, /window\.XmUI\.EmptyState/);
  assert.match(homeJs, /data-connect-jingmai/);
  assert.match(homeJs, /data-live-login/);
  assert.match(homeJs, /data-live-col/);
  assert.equal(patchConnectPicker(homeJs), homeJs);
  assert.equal(applyHomeXmUi(homeJs), homeJs);
});

test("the live client patch adds XmUI without dropping the login dialog", () => {
  const servedPath = "/tmp/xm-home-now.js";
  if (!fs.existsSync(servedPath)) return;
  const served = fs.readFileSync(servedPath, "utf8");
  const out = patchConnectPicker(served);
  assert.match(out, /xm-ui-scope/);
  assert.match(out, /function uiButton/);
  assert.match(out, /data-connect-jingmai/);
  assert.match(out, /data-live-login/);
  assert.match(out, /data-desk-shop/);
  assert.doesNotMatch(out, /<div class="xm-hm" id="xm-hm">/);
  assert.equal(applyHomeXmUi(out), out);
});
