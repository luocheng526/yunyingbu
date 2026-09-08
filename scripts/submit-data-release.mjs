#!/usr/bin/env node
/**
 * Submit a data-center release ticket. Never restarts production.
 */
const endpoints = (process.env.RELEASES_API || "http://127.0.0.1:3000/api/releases,http://zx.xingmaierp.cc/api/releases")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const payload = {
  version: process.env.RELEASE_VERSION || "0.1.0-data",
  applicant: process.env.RELEASE_APPLICANT || "数据中心",
  module: process.env.RELEASE_MODULE || "数据中心",
  summary:
    process.env.RELEASE_SUMMARY ||
    "数据中心看板：演示指标卡（今日订单/待处理/在职人数/本周发布次数）与 GET /api/data/overview；不自行重启生产。"
};

async function submit(url) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { url, status: res.status, text, json };
}

const errors = [];
for (const url of endpoints) {
  try {
    const result = await submit(url);
    if (result.status === 201 || result.status === 200) {
      console.log(JSON.stringify({ ok: true, submitted: true, ...result, payload }, null, 2));
      process.exit(0);
    }
    errors.push({ url, status: result.status, body: result.json || result.text.slice(0, 300) });
  } catch (err) {
    errors.push({ url, error: err.message });
  }
}

console.log(
  JSON.stringify(
    {
      ok: false,
      submitted: false,
      payload,
      errors,
      next: "请到「版本发布中心」http://zx.xingmaierp.cc/releases 提交审核单。真正发布只能等主脑审核通过后点击发布。"
    },
    null,
    2
  )
);
process.exit(1);
