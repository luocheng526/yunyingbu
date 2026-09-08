/** Demo-only overview payload. No database. */

export function getOverview() {
  return {
    ok: true,
    demo: true,
    notice: "演示数据",
    cards: [
      { key: "ordersToday", label: "今日订单", value: 128, unit: "单" },
      { key: "pending", label: "待处理", value: 17, unit: "件" },
      { key: "staffOnDuty", label: "在职人数", value: 36, unit: "人" },
      { key: "releasesThisWeek", label: "本周发布次数", value: 5, unit: "次" }
    ],
    events: [
      {
        time: "2026-09-04 09:42",
        type: "订单",
        summary: "华东仓完成早高峰对账，差额 0"
      },
      {
        time: "2026-09-04 08:15",
        type: "待处理",
        summary: "3 张售后工单转入待处理队列"
      },
      {
        time: "2026-09-03 18:50",
        type: "人员",
        summary: "本周入职 1 人，在职人数保持稳定"
      },
      {
        time: "2026-09-03 16:20",
        type: "发布",
        summary: "运营部站点完成一次演示环境发布"
      },
      {
        time: "2026-09-03 11:08",
        type: "订单",
        summary: "今日订单进度过半，峰值出现在 10:30"
      }
    ]
  };
}
