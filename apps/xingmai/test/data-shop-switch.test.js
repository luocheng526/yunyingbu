import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataJs = readFileSync(join(root, "public/shared/modules/data.js"), "utf8");
const shopsJs = readFileSync(join(root, "public/data-shops.js"), "utf8");
const goodsJs = readFileSync(join(root, "public/data-goods.js"), "utf8");
const overviewJs = readFileSync(join(root, "public/data-overview.js"), "utf8");

test("data.js resets each pane to its own board before loading scripts", () => {
  assert.match(dataJs, /0\.1\.595-data-shop-switch/);
  assert.match(dataJs, /function resetDataPage\(root, kind, label\)/);
  assert.match(dataJs, /resetDataPage\(root, "shops", "正在加载店铺数据…"\)/);
  assert.match(dataJs, /resetDataPage\(root, "goods", "正在加载商品数据…"\)/);
  assert.match(dataJs, /resetDataPage\(root, "overview", "正在加载数据总览…"\)/);
  assert.match(dataJs, /data-shops\.js\?v=shop-wide7/);
  assert.match(dataJs, /data-goods\.js\?v=goods-erp2/);
  assert.match(dataJs, /data-overview\.js\?v=data-ov28/);
});

test("shop goods and overview boards stay isolated and do not auto-paint the first #board", () => {
  assert.match(shopsJs, /data-board="shops"/);
  assert.match(goodsJs, /data-board="goods"/);
  assert.match(overviewJs, /data-board="overview"/);
  assert.match(shopsJs, /xm-pane\[data-xm-href="\/data\/shops"\]/);
  assert.match(goodsJs, /xm-pane\[data-xm-href="\/data\/goods"\]/);
  assert.match(overviewJs, /xm-pane\[data-xm-href="\/data\/overview"\]/);
  assert.doesNotMatch(shopsJs, /getElementById\("board"\)/);
  assert.doesNotMatch(goodsJs, /getElementById\("board"\)/);
  assert.doesNotMatch(overviewJs, /getElementById\("board"\)/);
});

test("shop dashboard title stays 店铺总览 and goods title stays 商品数据总览", () => {
  assert.match(shopsJs, /店铺总览/);
  assert.match(goodsJs, /商品数据总览/);
  assert.doesNotMatch(shopsJs, /商品数据总览/);
});
