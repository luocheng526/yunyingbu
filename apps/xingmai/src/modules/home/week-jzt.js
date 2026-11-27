import { readJztTotalSpend } from "./jingmai-client.js";
import { beijingParts } from "./jingmai.js";
import { homeCollectionGate } from "./jingmai-runner.js";
import { getSession, sessionVersionOf } from "./jingmai-store.js";

function queryError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

export function createWeekJztReader({
  gate = homeCollectionGate(), sessionOf = getSession, readSpend = readJztTotalSpend,
  today = () => beijingParts().day
} = {}) {
  const jobs = new Map();

  async function read(store, date) {
    const name = typeof store === "string" ? store.trim() : "";
    if (!name || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw queryError(400, "请选择店铺和业务日期");
    }
    const parsed = new Date(date + "T00:00:00Z");
    if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date || date >= today()) {
      throw queryError(400, "业务日期须早于北京时间今天");
    }

    const { inflight, humanProtectsShop } = gate;
    if (inflight.has(name) || humanProtectsShop(name)) {
      throw queryError(409, "店铺正在实时采集或处理登录，请稍后重试");
    }
    if (jobs.size) throw queryError(409, "已有京准通历史查询，请稍后重试");

    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    inflight.add(name);
    const done = Promise.resolve().then(async () => {
      const session = await sessionOf(name);
      if (signal.aborted) throw signal.reason;
      if (session?.enabled === false || !session?.cookies?.length) {
        throw queryError(409, "该店铺没有可用的服务器登录会话");
      }

      const jar = session.cookies.map(cookie => ({ ...cookie }));
      const spend = await readSpend(jar, { store: name, shopId: session.shopId }, date, signal);
      const latest = await sessionOf(name);
      if (signal.aborted) throw signal.reason;
      if (!latest || latest.enabled === false || humanProtectsShop(name) ||
          sessionVersionOf(latest) !== sessionVersionOf(session) || latest.shopId !== session.shopId) {
        throw queryError(409, "查询期间店铺登录会话已变更，请稍后重试");
      }
      return { store: name, date, spend };
    }).catch(error => {
      if (controller.signal.aborted) throw queryError(409, "店铺正在进行实时采集，请稍后重试");
      if (signal.aborted) throw queryError(504, "京准通总花费查询超时，请稍后重试");
      throw error;
    }).finally(() => {
      jobs.delete(name);
      inflight.delete(name);
    });
    jobs.set(name, { controller, done });
    return done;
  }

  async function interrupt(store) {
    const job = jobs.get(store);
    if (!job) return;
    job.controller.abort();
    // Keep the shared lock until the request and any temporary browser have stopped.
    await job.done.catch(() => {});
  }

  return { read, interrupt };
}

const reader = createWeekJztReader();
export const readWeekJztSpend = reader.read;
export const interruptWeekJzt = reader.interrupt;
