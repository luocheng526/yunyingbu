import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notices-store-"));
process.env.NOTICES_DATA_FILE = path.join(tmpDir, "notices.json");

const store = await import("../src/modules/notices/store.js");

test("date-range notices hide from active list and banner outside the window", () => {
  const created = store.upsertNotice({
    title: "限时公告",
    category: "daily",
    level: "important",
    banner: true,
    popup: true,
    alwaysShow: false,
    startOn: "2026-09-01",
    endOn: "2026-09-05",
    status: "active"
  });
  assert.equal(created.ok, true);
  assert.equal(created.item.alwaysShow, false);
  assert.equal(created.item.displayLabel, "2026-09-01 至 2026-09-05");
  assert.equal(store.isNoticeShowing(created.item, "2026-09-03"), true);
  assert.equal(store.isNoticeShowing(created.item, "2026-09-06"), false);

  const always = store.upsertNotice({
    title: "长期公告",
    category: "general",
    level: "normal",
    banner: true,
    alwaysShow: true,
    status: "active"
  });
  assert.equal(always.ok, true);
  assert.equal(always.item.displayLabel, "一直展示");
  assert.equal(store.isNoticeShowing(always.item, "2099-01-01"), true);

  const today = store.todayYmd();
  const listed = store.listNotices({ status: "active" });
  const titles = listed.items.map((item) => item.title);
  assert.equal(titles.includes("长期公告"), true);
  assert.equal(titles.includes("限时公告"), store.isNoticeShowing(created.item, today));
  assert.equal(listed.stats.active, titles.length);

  const missingDates = store.upsertNotice({
    title: "缺日期",
    alwaysShow: false,
    status: "active"
  });
  assert.equal(missingDates.ok, false);
  assert.match(missingDates.error, /起止日期/);
});
