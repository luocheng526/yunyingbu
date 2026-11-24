// The deployed homepage script is served through the existing week-report source patch.
const scheduleDialog = String.raw`async function openWeekSchedule(refresh) {
    var dialog = weekDialog("业绩抓取时间"), content = dialog.querySelector("[data-dialog-content]");
    dialog.classList.add("is-schedule");
    content.innerHTML = '<form><label>每天抓取时间（北京时间）<input type="time" name="time" required step="60" disabled /></label>' +
      '<p>到点抓取昨天的业绩，写入业绩表后按钉钉默认发送方式推送日报。</p><p data-week-next></p><p data-week-run role="status"></p>' +
      '<div class="xm-hm-week-form-actions"><button type="submit" disabled>保存时间</button></div><p data-week-schedule-status role="status"></p></form>';
    var form = content.querySelector("form"), time = form.elements.time, button = form.querySelector("button");
    var status = content.querySelector("[data-week-schedule-status]");
    var lastRun = "", saving = false;
    function render(config, loadTime) {
      if (loadTime) time.value = config.time;
      content.querySelector("[data-week-next]").textContent = "下次计划抓取 " + config.nextDate + " " + config.time;
      var run = config.lastRun;
      var text = run ? "最近任务（" + run.date + "） " + run.message : "暂无运行记录";
      if (run && run.nextAttemptAt) text += "，将于 " + new Date(run.nextAttemptAt).toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false }) + " 重试";
      content.querySelector("[data-week-run]").textContent = text;
      if (run && lastRun && lastRun !== text && run.phase !== "collect" && refresh) refresh();
      lastRun = text;
    }
    async function load(initial) {
      if (saving) return;
      try {
        var data = await weekRequest("/api/home/week-schedule");
        if (!dialog.isConnected || saving) return;
        render(data.config, initial);
        if (initial) time.disabled = button.disabled = false;
      } catch (error) {
        if (initial && dialog.isConnected) weekNotice(status, error.message, true);
      }
    }
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      saving = button.disabled = true;
      weekNotice(status, "正在保存…");
      try {
        var data = await weekRequest("/api/home/week-schedule", { time: time.value });
        render(data.config, true);
        weekNotice(status, "抓取时间已保存");
      } catch (error) { weekNotice(status, error.message, true); }
      finally { saving = button.disabled = false; }
    });
    await load(true);
    if (dialog.isConnected && !time.disabled) {
      var poll = setInterval(function () { void load(false); }, 10000);
      dialog.addEventListener("close", function () { clearInterval(poll); }, { once: true });
    }
  }`;

const replacements = [
  ["var days = weekLastDays(7, today);", "var days = weekLastDays(7, weekShiftYmd(today, -1));"],
  ["Number(parts[1]) + \".1-\" + Number(day.ymd.split(\"-\")[2]) + \"号利润\"", "Number(day.ymd.split(\"-\")[1]) + \".1-\" + Number(day.ymd.split(\"-\")[2]) + \"号利润\""],
  ["      \"</h2><p>\" + escapeHtml(pack.note || \"表头按原五倍表。店铺和当天成交/花费先接韩梦凯实时付费、沈子晗付费中心；其余格子可手填，保存到服务器。发送时保存表格和图片。\") + \"</p></div><span style=\\\"\" + (pack.historical ? \"display:none\" : \"\") + \"\\\"><button type=\\\"button\\\" data-week-wps>WPS 配置</button><button type=\\\"button\\\" data-week-ding-config>钉钉配置</button><button type=\\\"button\\\" data-week-history>历史数据</button><button type=\\\"button\\\" data-week-preview>预览图片</button><button type=\\\"button\\\" data-week-send \" + (pack.source === \"wps\" && (pack.sync.testOnly || !pack.readyToSend) ? 'disabled title=\"本地测试或数据尚未完整\"' : '') + \">\" +", "      \"</h2><p>\" + escapeHtml(pack.note || \"数据来自业绩表。历史数据可手填，昨日数据按设置从 BI 更新。\") + \"</p></div><span style=\\\"\" + (pack.historical ? \"display:none\" : \"\") + \"\\\"><button type=\\\"button\\\" data-week-schedule>抓取时间</button><button type=\\\"button\\\" data-week-ding-config>钉钉配置</button><button type=\\\"button\\\" data-week-history>历史数据</button><button type=\\\"button\\\" data-week-preview>预览图片</button><button type=\\\"button\\\" data-week-send>\" +"],
  ["    if (event.target.closest(\"[data-week-wps]\")) { openWeekWps(refresh); return true; }", "    if (event.target.closest(\"[data-week-schedule]\")) { openWeekSchedule(refresh); return true; }"],
  ["近七天业绩汇总：爬虫填店铺和当天数字，其余可手填；一键发送图片发到钉钉。", "近七天业绩汇总从业绩表取数，支持一键发送图片到钉钉。"],
  [".xm-hm-week-dialog[open]{display:flex;", ".xm-hm-week-dialog.is-schedule{width:min(490px,94vw)}.xm-hm-week-dialog.is-schedule input[type=time]{max-width:180px}.xm-hm-week-dialog[open]{display:flex;"],
];

export function applyWeekScheduleUi(source) {
  const start = source.indexOf("  async function openWeekWps(");
  const end = source.indexOf("  async function openWeekHistory(", start);
  if (start < 0 || end < 0 || replacements.some(([from]) => !source.includes(from))) return source;
  const updated = source.slice(0, start) + "  " + scheduleDialog + "\n" + source.slice(end);
  return replacements.reduce((text, [from, to]) => text.replace(from, () => to), updated);
}
