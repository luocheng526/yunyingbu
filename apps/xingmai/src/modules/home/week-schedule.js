import fs from "node:fs";
import path from "node:path";
import { shanghaiYmd } from "./local-paid.js";
import { atomicJson, weekDataDir } from "./week-storage.js";
import { readWeekStore, saveWeekCells, shiftYmd } from "./week-report.js";
import { collectWeekBi, weekBiCells, weekDailyMessage } from "./week-bi.js";

const retryAfter = 15 * 60_000;
const retryFor = 24 * 60 * 60_000;
const chinaTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function read(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}

function nextDay(time, now) {
  const day = shanghaiYmd(now);
  return chinaTime.format(now) <= time ? day : shiftYmd(day, 1);
}

export function createWeekSchedule({ ding, directory = weekDataDir(), now = () => new Date(),
  collect = collectWeekBi, getCells = () => readWeekStore({ strict: true }).cells, save = saveWeekCells } = {}) {
  const settingsFile = path.join(directory, "bi-schedule.json");
  const stateFile = path.join(directory, "bi-runs.json");
  let active = false;
  let timer;
  const readSettings = () => read(settingsFile, { time: "09:00", effectiveOn: nextDay("09:00", now()) });
  const readState = () => read(stateFile, { jobs: {}, deliveries: {} });

  function config() {
    const settings = readSettings();
    const state = readState();
    const last = Object.values(state.jobs).sort((a, b) => b.startedAt - a.startedAt)[0];
    const current = now();
    const today = shanghaiYmd(current);
    const ranToday = state.jobs[shiftYmd(today, -1)]?.time === settings.time;
    const next = ranToday ? shiftYmd(today, 1) : nextDay(settings.time, current);
    const date = [settings.effectiveOn, next].sort().at(-1);
    return { time: settings.time, nextDate: date, timeZone: "Asia/Shanghai", lastRun: last ?
      { date: last.date, phase: last.phase, message: last.message, nextAttemptAt: last.nextAttemptAt || null } : null };
  }

  function saveConfig(input) {
    const time = input?.time;
    if (typeof time !== "string" || !timePattern.test(time)) throw new Error("请输入有效的北京时间，格式如 09:00");
    if (!fs.existsSync(settingsFile) || readSettings().time !== time) {
      atomicJson(settingsFile, { time, effectiveOn: nextDay(time, now()) });
    }
    return config();
  }

  async function tick() {
    if (active) return;
    active = true;
    try {
      const time = now();
      const today = shanghaiYmd(time);
      const settings = readSettings();
      if (!fs.existsSync(settingsFile)) atomicJson(settingsFile, settings);
      const state = readState();
      const persist = () => atomicJson(stateFile, state);
      const date = shiftYmd(today, -1);
      if (today >= settings.effectiveOn && chinaTime.format(time) >= settings.time && state.jobs[date]?.time !== settings.time) {
        state.jobs[date] = { date, time: settings.time, phase: "collect", startedAt: +time, records: {}, message: "等待抓取昨日业绩" };
        persist();
      }
      const jobs = Object.values(state.jobs).sort((a, b) => b.date.localeCompare(a.date));
      const job = jobs.find(item => ["collect", "send"].includes(item.phase) && +time >= (item.nextAttemptAt || 0) &&
        (item.date !== date || item.time === settings.time));
      if (!job) return;
      if (+time - job.startedAt >= retryFor) {
        job.phase = "expired";
        job.nextAttemptAt = null;
        job.message = "重试已到期。" + job.message;
        delete job.records;
        persist();
        return;
      }

      try {
        if (job.phase === "collect") {
          const result = await collect(job.date, { collectSaved: job.records });
          job.records = result.records;
          if (result.error) throw new Error(result.error);
          save({ cells: weekBiCells(job.date, result.shops, result.records, getCells()) });
          job.shops = result.shops.map(({ team, store }) => ({ team, store }));
          delete job.records;
          job.phase = "send";
          job.message = "昨日业绩已写入，等待钉钉推送";
          job.nextAttemptAt = null;
          persist();
        }
        const message = weekDailyMessage(job.date, job.shops, getCells());
        const targets = await ding.automaticTargets();
        const deliveries = state.deliveries[job.date] ||= {};
        let delivered = 0, review = 0, failed = 0;
        for (const target of targets) {
          const key = target.destination.key;
          const status = deliveries[key];
          if (status === "sent" || status === "accepted") { delivered++; continue; }
          if (status === "sending" || status === "uncertain") { review++; continue; }
          deliveries[key] = "sending";
          persist();
          let result;
          try { result = await ding.send({ target, title: "昨日日报 · " + job.date, text: message }); }
          catch { result = { ok: false }; }
          if (result.ok && ["sent", "accepted"].includes(result.status)) {
            deliveries[key] = result.status;
            delivered++;
          } else if (result.definiteFailure) {
            deliveries[key] = "failed";
            failed++;
          } else {
            deliveries[key] = "uncertain";
            review++;
          }
          persist();
        }
        if (failed) throw new Error("业绩已写入，" + failed + " 个钉钉接收目标发送失败，将重试" + (review ? "，" + review + " 个目标结果待核对" : ""));
        job.phase = review ? "review" : "complete";
        job.nextAttemptAt = null;
        job.message = review ? "业绩已写入，" + review + " 个钉钉接收目标结果待核对" :
          "业绩已写入，钉钉已发送或受理（" + delivered + " 个接收目标）";
      } catch (error) {
        job.message = error.message || "业绩任务运行失败";
        job.nextAttemptAt = +now() + retryAfter;
      }
      persist();
    } finally {
      active = false;
    }
  }

  function start() {
    if (timer) return;
    const run = () => tick().catch(error => console.error("首页业绩定时任务失败：", error.message));
    timer = setInterval(run, 10_000);
    timer.unref();
    void run();
  }

  return { config, saveConfig, tick, start };
}
