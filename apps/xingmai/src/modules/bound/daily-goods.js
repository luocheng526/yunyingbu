import { addDays, shanghaiToday } from './time.js';

// Operating shops selected for the historical goods backfill.
const shops = [
  "JD:150078094",
  "JD:16107402",
  "JD:19251344",
  "JD:134760544",
  "JD:13341301",
  "JD:16099188",
  "JD:19969955",
  "JD:16098199",
  "JD:16091982",
  "JD:16091983",
  "JD:12286853",
  "JD:16144453",
  "JD:13056431",
  "JD:121386728",
  "JD:19992380",
  "JD:19984390",
  "JD:12777956",
  "JD:13109914",
  "JD:16838264",
  "JD:16846466",
  "JD:16268142",
  "JD:13291050",
  "JD:14478638",
  "JD:13479474",
  "JD:191778957",
  "JD:205598874",
  "JD:196509787",
  "JD:25015107",
  "JD:16046901",
  "JD:25014981",
  "JD:16065563",
  "JD:20035685",
  "JD:18998544",
  "JD:218330674",
  "JD:16501691",
  "JD:13320250",
  "JD:13760886",
  "JD:25014869",
  "JD:83371711",
  "JD:83335358",
  "JD:20035248",
  "JD:39133580",
  "JD:33102281"
];
const firstDay = '2026-11-19';

export function nextDailyGoods(scopes, today, selection = shops) {
  const yesterday = addDays(today, -1);
  const reviewThrough = addDays(today, -2);
  const index = new Map(scopes.map(s => [s.date + '/' + s.platform + ':' + s.shopId, s]));
  for (const review of [false, true]) {
    const end = review ? reviewThrough : yesterday;
    for (let day = firstDay; day <= end; day = addDays(day, 1)) {
      const mature = Date.parse(addDays(day, 2) + 'T00:00:00+08:00');
      const due = selection.filter(key => {
        const saved = index.get(day + '/' + key);
        if (!review) return !saved;
        return saved && !(Date.parse(saved.sampledAt || saved.verifiedAt) >= mature);
      });
      if (due.length) return { from: day, to: day, shopKeys: due };
    }
  }
  return null;
}

export function startDailyGoods(backfill, linkStatus) {
  async function tick() {
    const current = await backfill.status();
    if (backfill.busy() || current?.status === 'paused') return;
    if (current?.failed && Date.now() - Date.parse(current.finishedAt) < 15 * 60000) return;
    const input = nextDailyGoods(await backfill.scopes(), shanghaiToday());
    if (!input) return;
    const link = await linkStatus();
    if (link.batchLoginReady && !link.collection.batchEnabled) await backfill.start(input, true);
  }
  async function poll() {
    try { await tick(); }
    catch (error) { console.error('边界商品自动采集检查失败', error.code || error.name); }
    finally { globalThis.setTimeout(poll, 60000).unref(); }
  }
  globalThis.setTimeout(poll, 15000).unref();
}
