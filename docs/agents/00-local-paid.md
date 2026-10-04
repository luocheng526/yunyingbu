# 主脑口令：实时 / 付费看板只用本地接口

2026-10-04 罗成运营部主脑。覆盖旧稿里「实时付费另接接口 / 待开发 / 调用 ERP / 对接星脉 BI」的说法。

四个对话框都先读这一页：**首页**、**数据中心**、**沈子晗运营中心**、**韩梦凯运营中心**。

## 一句话

首页「实时」、韩梦凯「实时付费」、沈子晗「付费中心」、数据中心「实时付费」——板上的付费数字全部来自**本站本地接口**（韩梦凯、沈子晗本地机回传）。**不是星脉 BI。不要去接星脉 BI。**

## 本地接口（已经在线上）

| 页面 | 谁维护 | 只准读这些 | 不要用 |
|------|--------|------------|--------|
| 首页 `/home` 实时页的付费数字 | 首页 | 汇总 `GET /api/han/worker?view=overview` + `GET /api/shen/paid?view=latest` | 星脉 BI；`/api/home/erp-paid` 填付费列；空的 `/api/home/local-paid` 存根当唯一数据；`/api/han/paid`（items 常空） |
| 韩梦凯 `/han/paid` 实时付费 | 韩梦凯 | `GET /api/han/worker?view=overview\|shop\|rules\|history`（本地机 `han-worker-01` 回传） | 星脉 BI；`GET /api/han/paid` 当主数据；`/api/home/erp-paid` |
| 沈子晗 `/shen/paid` 付费中心 | 沈子晗 | `GET /api/shen/paid?view=latest` 以及本中心已有的 `/api/shen/paid/*` 回传 | 星脉 BI；ERP；韩的 worker |
| 数据中心 `/data/paid` 实时付费 | 数据中心 | 与首页同一套：韩 overview + 沈 latest 本地回传 | 星脉 BI；`/api/home/live`；`/api/data/live`；`/data/live-demo.json`；`/api/home/erp-paid`；`/api/data/overview`（那是公司 ERP KPI，另一页） |

`/api/home/erp-paid`、`/api/home/erp-kpis`、`/api/data/overview` 的 `source: xingmai-erp` 是**星脉 ERP 销售/店铺 KPI**，不是付费看板，更不是星脉 BI。公司/店铺总揽可以继续走 ERP；**付费看板不许走 ERP，也不许走 BI。**

## 字段怎么对

韩 `view=overview` 的 `shops[]`、沈 `view=latest` 的 `rows[]` 都是本地机口径，常见字段：

- 店铺：`store` / `店铺名称`
- 花费：`spend`
- 付费订单：`paidOrders` / `orders`
- 京准通成交：`jingmaiGmv` / `gmv`
- 总订单金额：`totalOrderAmount`
- 投产：`roi`（没有就 `totalOrderAmount / spend`）
- 更新时间：韩用 `capturedAt` / `asOf`；沈用 `asOf`

首页和数据中心做汇总时：两份店铺按店名去重合并，卡片和表用合并后的数。更新时间取两份里较新的那条，刷新一次就改一次。不要自己造空库假装「本地数据」。

## 责权

罗成 / 韩梦凯 / 沈子晗看全量本地回传。其他人只看自己责权店。沈中心只出沈组织店，韩中心只出韩组织店。壳上的中心过滤已经在抓 `/api/han/worker?view=*` 和 `/api/shen/paid*`，不要再接一套 BI 来绕过。

## 各对话要做

1. **首页**：实时页付费金额 / ROI / 京准通花费与成交 / 费比 / 付费成交额 / 接入店铺数，全部改读上面两份本地回传。不要再把付费列绑到 `/api/home/erp-paid`。空存根 `/api/home/local-paid` 只能做聚合壳，里面必须转发韩+沈，不能回空数组。
2. **数据中心**：`/data/paid` 按同一套本地回传更新数字。不要再用 404 的 `/api/home/live`、`/api/data/live` 或 demo JSON。总揽页 ERP 不动。
3. **韩梦凯**：继续本地机 `han-worker-01` 回传。不要改接星脉 BI。首页和数据中心会来读 `view=overview`。
4. **沈子晗**：继续本地机回传 `/api/shen/paid`。不要改接星脉 BI。首页和数据中心会来读 `view=latest`。

主框架不改这四页的业务代码，不交这四页的发布单。各对话自己改、自己交单。
