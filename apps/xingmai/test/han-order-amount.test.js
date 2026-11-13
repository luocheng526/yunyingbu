import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const source = readFileSync(new URL("../src/modules/han/worker.js", import.meta.url), "utf8");
const stubbed = source.replace(
  /import \{[\s\S]*?\} from "\.\/stale-alert\.js";/,
  `const dingtalkTestText = () => "";
const isDingtalkWebhook = () => false;
const postDingtalk = async () => {};
const staleAlertText = () => "";
const staleDecision = () => ({});`,
);
writeFileSync("/tmp/han-worker-amount.mjs", stubbed);
const { readJingzhuntongOrderAmount } = await import(`${pathToFileURL("/tmp/han-worker-amount.mjs").href}?t=${Date.now()}`);

test("flat 非全站营销总订单金额 wins over a leading 全站 0", () => {
  assert.equal(
    Number(
      readJingzhuntongOrderAmount({
        店铺名称: "平铺店",
        全站营销总订单金额: 0,
        非全站营销总订单金额: 5285.56,
      }),
    ),
    5285.56,
  );
});

test("placeholder 京准通总订单金额 0 does not hide 总订单金额", () => {
  assert.equal(
    Number(
      readJingzhuntongOrderAmount({
        店铺名称: "占位店",
        京准通总订单金额: 0,
        总订单金额: 4321,
      }),
    ),
    4321,
  );
});

test("nested 非全站 0 does not hide a sibling flat amount", () => {
  assert.equal(
    Number(
      readJingzhuntongOrderAmount({
        店铺名称: "嵌套零",
        非全站营销: { ROI: 1.88, 总订单金额: 0 },
        全站营销: { 总订单金额: 0 },
        非全站营销总订单金额: 1098.05,
      }),
    ),
    1098.05,
  );
});

test("nested 非全站 总订单金额 is used when it has a value", () => {
  assert.equal(
    Number(
      readJingzhuntongOrderAmount({
        店铺名称: "嵌套店",
        全站营销: { ROI: 8, 总订单金额: 800 },
        非全站营销: { ROI: 2.69, 总订单金额: 1098.05 },
      }),
    ),
    1098.05,
  );
});

test("product-line list keeps the 非全站 row", () => {
  assert.equal(
    Number(
      readJingzhuntongOrderAmount({
        店铺名称: "分线店",
        产品线: [
          { 类型: "全站营销", ROI: 7, 总订单金额: 70 },
          { 类型: "非全站营销", ROI: 0.4, 总订单金额: 139 },
        ],
      }),
    ),
    139,
  );
});

test("sitewide-only amount is not used as 京准通总订单金额", () => {
  assert.equal(
    readJingzhuntongOrderAmount({
      店铺名称: "全站店",
      全站营销总订单金额: 99999,
    }),
    "",
  );
});

test("explicit 非全站 0 is kept instead of 全站", () => {
  assert.equal(
    Number(
      readJingzhuntongOrderAmount({
        店铺名称: "零单店",
        全站营销总订单金额: 99999,
        非全站营销总订单金额: 0,
      }),
    ),
    0,
  );
});

test("object-shaped amount unwraps value", () => {
  const raw = readJingzhuntongOrderAmount({
    店铺名称: "对象店",
    非全站营销: { 总订单金额: { value: "1,234.50元" } },
  });
  assert.equal(Number(String(raw).replace(/[¥￥,\s%元]/g, "")), 1234.5);
});

test("nested 非全站营销 投产比 plus 总订单金额 with yen", () => {
  assert.equal(
    Number(
      String(
        readJingzhuntongOrderAmount({
          店铺名称: "本机店",
          非全站营销: { 投产比: 2.38, 总订单金额: "¥9,090.00" },
        }),
      ).replace(/[¥￥,\s%元]/g, ""),
    ),
    9090,
  );
});

test("非全站营销 blob text keeps 总订单金额", () => {
  assert.equal(
    Number(
      String(
        readJingzhuntongOrderAmount({
          店铺名称: "整段店",
          非全站营销: "投产比 2.38 总订单金额 ¥9,090.00",
        }),
      ).replace(/[¥￥,\s%元]/g, ""),
    ),
    9090,
  );
});

test("非全站营销 html blob keeps 总订单金额", () => {
  assert.equal(
    Number(
      String(
        readJingzhuntongOrderAmount({
          店铺名称: "网页店",
          非全站营销: "<div>投产比</div>2.38<div>总订单金额</div>¥9,090.00",
        }),
      ).replace(/[¥￥,\s%元]/g, ""),
    ),
    9090,
  );
});

test("非全站营销 metric pairs keep 总订单金额", () => {
  assert.equal(
    Number(
      String(
        readJingzhuntongOrderAmount({
          店铺名称: "指标店",
          非全站营销: [
            { 名称: "投产比", 值: 2.38 },
            { 名称: "总订单金额", 值: "¥9,090.00" },
          ],
        }),
      ).replace(/[¥￥,\s%元]/g, ""),
    ),
    9090,
  );
});

test("product-line English name keeps 非全站 总订单金额", () => {
  assert.equal(
    Number(
      String(
        readJingzhuntongOrderAmount({
          店铺名称: "英文店",
          产品线: [
            { name: "全站营销", 投产比: 8, 总订单金额: "¥100.00" },
            { name: "非全站营销", 投产比: 2.38, 总订单金额: "¥9,090.00" },
          ],
        }),
      ).replace(/[¥￥,\s%元]/g, ""),
    ),
    9090,
  );
});

test("display text object under 总订单金额 unwraps", () => {
  assert.equal(
    Number(
      String(
        readJingzhuntongOrderAmount({
          店铺名称: "展示店",
          非全站营销: { 投产比: 2.38, 总订单金额: { text: "¥9,090.00", display: "¥9,090.00" } },
        }),
      ).replace(/[¥￥,\s%元]/g, ""),
    ),
    9090,
  );
});

test("flattened roi 0 amount still reads nested 非全站营销 总订单金额", () => {
  assert.equal(
    Number(
      String(
        readJingzhuntongOrderAmount({
          店铺名称: "扁平店",
          roi: 2.38,
          totalOrderAmount: 0,
          spend: 3819,
          非全站营销: { 投产比: 2.38, 总订单金额: "¥9,090.00" },
        }),
      ).replace(/[¥￥,\s%元]/g, ""),
    ),
    9090,
  );
});
