import { dbMode, query } from "../profile/auth.js";

/** Demo-only overview payload. Persisted to MySQL so restart keeps the same numbers. */

const SEED_CARDS = [
  { key: "ordersToday", label: "今日订单", value: 128, unit: "单" },
  { key: "pending", label: "待处理", value: 17, unit: "件" },
  { key: "staffOnDuty", label: "在职人数", value: 36, unit: "人" },
  { key: "releasesThisWeek", label: "本周发布次数", value: 5, unit: "次" }
];

const SEED_EVENTS = [
  { time: "2026-09-04 09:42", type: "订单", summary: "华东仓完成早高峰对账，差额 0" },
  { time: "2026-09-04 08:15", type: "待处理", summary: "3 张售后工单转入待处理队列" },
  { time: "2026-09-03 18:50", type: "人员", summary: "本周入职 1 人，在职人数保持稳定" },
  { time: "2026-09-03 16:20", type: "发布", summary: "运营部站点完成一次演示环境发布" },
  { time: "2026-09-03 11:08", type: "订单", summary: "今日订单进度过半，峰值出现在 10:30" }
];

function payload(cards, events) {
  return {
    ok: true,
    demo: true,
    notice: "演示数据",
    cards,
    events
  };
}

export async function hydrateFromMysql() {
  const [cardRows] = await query(
    "SELECT card_key, label, value, unit, sort_n FROM data_cards ORDER BY sort_n ASC"
  );
  if (!cardRows.length) {
    for (let i = 0; i < SEED_CARDS.length; i += 1) {
      const card = SEED_CARDS[i];
      await query(
        "INSERT INTO data_cards (card_key, label, value, unit, sort_n) VALUES (?, ?, ?, ?, ?)",
        [card.key, card.label, card.value, card.unit, i]
      );
    }
  }
  const [eventRows] = await query(
    "SELECT event_time, event_type, summary, sort_n FROM data_events ORDER BY sort_n ASC"
  );
  if (!eventRows.length) {
    for (let i = 0; i < SEED_EVENTS.length; i += 1) {
      const event = SEED_EVENTS[i];
      await query(
        "INSERT INTO data_events (event_time, event_type, summary, sort_n) VALUES (?, ?, ?, ?)",
        [event.time, event.type, event.summary, i]
      );
    }
  }
}

export async function getOverview() {
  if (dbMode() === "mysql") {
    const [cardRows] = await query(
      "SELECT card_key, label, value, unit FROM data_cards ORDER BY sort_n ASC"
    );
    const [eventRows] = await query(
      "SELECT event_time, event_type, summary FROM data_events ORDER BY sort_n ASC"
    );
    return payload(
      cardRows.map((row) => ({
        key: row.card_key,
        label: row.label,
        value: Number(row.value),
        unit: row.unit
      })),
      eventRows.map((row) => ({
        time: row.event_time,
        type: row.event_type,
        summary: row.summary
      }))
    );
  }
  return payload(
    SEED_CARDS.map((card) => ({ ...card })),
    SEED_EVENTS.map((event) => ({ ...event }))
  );
}
