# 沈子晗充值规则接口

网站只保存规则和修改历史，不保存京准通 / 京麦 Cookie，也不直接发起充值。本地工作机拉到完整有效配置并 ACK 成功后，才按京小洁数据判断是否打开京准通充值。接口异常时，本地必须继续使用上一次校验成功的规则。

夜间 23:55 转出、00:05 启动是独立规则，本页不改。

## 权限

- 网页接口按登录用户过滤店铺。超级管理员 / 全平台数据可看全部。
- 其他人只看组织中心 `visibleShops` 与 `POST /api/shen/paid/recharge-config/owners` 写入的归属。
- 后端校验店铺归属，前端隐藏不能当权限。
- 主账户ID、子账号ID按字符串保存，拒绝小数和科学计数法。

## 默认规则

新账号未保存时按此档位展示（保存后才进版本号）。默认计划ROI为 2。自动充值=true 时计划ROI必须大于 0，否则本地机校验失败、不会开跑。

1. `1 ≤ 花费 < 1000` 且 `ROI ≥ 计划ROI` 且 `余额 ≤ 100`：充值 100。
2. `花费 ≥ 1000` 且 `ROI ≥ 计划ROI` 且 `余额 ≤ 50`：充值 150，不回退第一档。
3. `ROI < 计划ROI` 且比上次有效查询上涨：不看余额，充值 100。
4. 以上成功充值统一计数；连续 3 次单量未涨，第 4 次前暂停 30 分钟。
5. 暂停期间单量上涨可提前解除；否则 30 分钟后解除。
6. 解除后计数清零，重新判断，不因解除直接充值。

## 网页接口

### `GET /api/shen/paid/recharge-config/editor?store=&q=&enabled=1`

当前用户可编辑的子账号规则（未保存行带默认档位）。

```json
{
  "ok": true,
  "version": 28,
  "actor": "沈子晗",
  "scope": "assigned",
  "syncStatus": "待同步",
  "rows": [
    {
      "store": "飒望旗舰店",
      "accountId": "99931330021",
      "subAccountId": "99945558065",
      "subAccountName": "飒望旗舰-测试放大2",
      "autoRecharge": true,
      "plannedRoi": 2.3,
      "tier1MinSpend": 1,
      "tier1MaxSpend": 1000,
      "tier1Balance": 100,
      "tier1Amount": 100,
      "tier2MinSpend": 1000,
      "tier2Balance": 50,
      "tier2Amount": 150,
      "roiRiseAmount": 100,
      "noOrderTimes": 3,
      "pauseMinutes": 30,
      "version": 28,
      "updatedBy": "沈子晗",
      "updatedAt": "2026-09-18T23:55:00+08:00",
      "syncStatus": "待同步",
      "syncedAt": ""
    }
  ]
}
```

### `PUT /api/shen/paid/recharge-config`

同一批保存共用一个递增 `version`。`patch=roi` 只改勾选子账号的计划ROI。

```json
{
  "patch": "roi",
  "changeSummary": "批量设置计划ROI",
  "rows": [
    {
      "店铺名称": "飒望旗舰店",
      "京准通主账户ID": "99931330021",
      "子账号ID": "99945558065",
      "子账号名称": "飒望旗舰-测试放大2",
      "计划ROI": 2.3
    }
  ]
}
```

成功：`{ "ok": true, "version": 28, "updatedAt": "...", "updatedBy": "沈子晗", "saved": 1 }`

### `GET /api/shen/paid/recharge-config/history?store=&subAccountId=&limit=100`

谁在什么时间改了哪个字段。

## 工作机运行店铺

这是本地工作机的持续运行控制，不是一次性任务。本地机只需启动一次并保持运行，以后店铺启停和规则都由本页保存后升版本下发。

网页「充值规则」上方勾选要开启的店，点「保存运行状态」。

- 还没保存过运行状态：本地机仍拉权限范围内全部店（默认已开启）。
- 保存后：本地机 `shops` / `runShops` **只含已开启的店**。空名单 `runShops=[]` 表示工作机在线待机，禁止回退到本地店单。
- 已开启：本地持续循环采集、回传并按规则充值。
- 已停止：本地不得再启动该店的新一轮采集或充值。
- 停止中：刚从开启改为停止，本地正在完成已开始的安全收尾。停止不强杀正在提交的转账；完成本笔及弹窗后不再开下一笔或下一轮。
- 每次店铺启停或规则修改并保存，都必须递增 `version`。
- `执行机` 为空：任意已绑定机都可跑这店。填了 `machineId`：只有该机跑。第二台机器换新的 `machineId` 即可。

```json
PUT /api/shen/paid/recharge-config
{
  "patch": "run",
  "changeSummary": "保存运行状态",
  "runShops": ["飒望旗舰店", "RASW潮流生活旗舰店"]
}
```

指定执行机：

```json
{
  "patch": "run",
  "shopRuns": [
    { "店铺名称": "飒望旗舰店", "启用": true, "执行机": "" },
    { "店铺名称": "RASW潮流生活旗舰店", "启用": true, "执行机": "paid-worker-02" }
  ]
}
```

## 本地机接口

### `GET /api/shen/paid/recharge-config?machineId=paid-worker-01&sinceVersion=27`

只返回该机当前已开启的店铺。已停止的店不得再放进 `runShops`。无新版本：

```json
{ "changed": false, "version": 27, "machineId": "paid-worker-01" }
```

有更新时返回**完整当前有效配置**，不要本地拼接，也不要自己补没出现的店：

```json
{
  "changed": true,
  "version": 28,
  "updatedAt": "2026-09-18T23:55:00+08:00",
  "machineId": "paid-worker-01",
  "runShops": ["飒望旗舰店"],
  "shops": [
    {
      "店铺名称": "飒望旗舰店",
      "京准通主账户ID": "99931330021",
      "启用": true,
      "执行机": "",
      "子账号": [
        {
          "子账号ID": "99945558065",
          "子账号名称": "飒望旗舰-测试放大2",
          "自动充值": true,
          "计划ROI": 2.3,
          "第一档花费下限": 1,
          "第一档花费上限": 1000,
          "第一档余额阈值": 100,
          "第一档充值金额": 100,
          "第二档花费下限": 1000,
          "第二档余额阈值": 50,
          "第二档充值金额": 150,
          "ROI上涨充值金额": 100,
          "连续充值未增单次数": 3,
          "暂停分钟数": 30
        }
      ]
    }
  ]
}
```

首次拉取需能识别执行人（登录会话或 `x-shen-user` / `x-shen-role`）。`machineId` 会记下执行人和权限范围，后续无会话也能按绑定人过滤店铺。

尚未保存过规则时 `version` 为 0，接口仍返回当前有效默认档位（`changed: true`），方便本地机落地。已保存后若 `sinceVersion` 已是最新版本：

```http
GET /api/shen/paid/recharge-config?machineId=paid-worker-01&sinceVersion=28&http304=1
```

可返回 `304`。不带 `http304=1` 时返回 `{ "changed": false, "version": 28, "machineId": "paid-worker-01" }`。

### `POST /api/shen/paid/recharge-config/ack`

```json
{
  "machineId": "paid-worker-01",
  "version": 28,
  "status": "success",
  "receivedAt": "2026-09-18T23:55:10+08:00",
  "message": "已校验并启用28版规则"
}
```

失败：`"status": "failed"`。页面据此显示待同步 / 已同步 / 同步失败。

## 充值执行回传

现有 `POST /api/shen/paid/ingest` 覆盖规则不变。可选多带：

- `executionId`：唯一。重复上传不新增第二笔。
- `configVersion` / `ruleCode`
- `plannedRoi`、当时花费 / ROI / 单量、`result`

没有 `executionId` 时仍按店铺 + 日期 + 充值时间 + 金额去重。有 `executionId` 时按该编号去重，重复上传不会新增第二笔。

可选字段示例：

```json
{
  "充值记录": [
    {
      "店铺名称": "飒望旗舰店",
      "京准通主账户ID": "99931330021",
      "子账号ID": "99945558065",
      "子账号名称": "飒望旗舰-测试放大2",
      "充值时间": "2026-09-18T10:12:00+08:00",
      "充值金额": 100,
      "executionId": "paid-worker-01-28-tier1-20260918101200",
      "configVersion": 28,
      "ruleCode": "tier1",
      "plannedRoi": 2.3,
      "execSpend": 860,
      "execRoi": 2.41,
      "execPaidOrders": 12,
      "result": "success"
    }
  ]
}
```

## 发给本地程序

把下面整段原样发给本地 Codex / 工作机，按此对齐。网站地址 `https://zx.xingmaierp.cc`。网站不存京准通 / 京麦 Cookie，也不发起充值。这是持续运行控制，不是一次性任务。本机启动一次并保持在线，店铺启停和规则都听网站。

1. 本机固定一个 `machineId`。第一台用 `paid-worker-01`（现网已绑定罗成）。以后第二台必须换新的，例如 `paid-worker-02`。不要两台共用一个号。
2. 保持循环：`GET https://zx.xingmaierp.cc/api/shen/paid/recharge-config?machineId=<本机>&sinceVersion=<上次成功ACK的版本>`。第一次 `sinceVersion=0`。
3. 首次请求带登录会话 cookie `mk_sid`，或请求头 `x-shen-user` / `x-shen-role` / `x-shen-scope`（中文要 URI 编码）。网站会把这台机绑到这个人的店铺权限上。已经绑过的机后续无会话也能按绑定人过滤。
4. `changed: false` 或 HTTP 304：配置没变，继续按本机上次校验成功的配置循环。不要重新发明规则。
5. `changed: true`：整包替换本机配置。只持续运行返回体里的 `runShops` / `shops`。某店没出现在这次包里 = 已停止或正在停止：完成本店已开始的转账及弹窗后停止该店，不再开新一轮采集或充值。不要强杀正在提交的资金操作。`runShops` 为空数组 = 全部停止，本机保持在线待机，禁止回退本地店单。
6. 每个子账号还要看 `自动充值`。`false` 的子账号只采集不充值。档位、计划 ROI、暂停次数以网站包为准，不要本地改公式。
7. 接口异常时继续用上一次校验成功的规则。夜间 23:55 / 00:05 独立规则，本页不管。
8. 本机校验并启用这版规则后立刻 `POST /api/shen/paid/recharge-config/ack`：`{ "machineId": "paid-worker-01", "version": 28, "status": "success", "receivedAt": "2026-09-19T10:00:00+08:00", "message": "已校验并启用28版规则" }`。失败把 `status` 改成 `failed`。页面用它显示待同步 / 已同步 / 同步失败。ACK 前刚被移出 `runShops` 的店在网页上显示停止中。
9. 付费回传仍是现有 `POST /api/shen/paid/ingest`，一次带齐同级 `rows`、`子账号`、`充值记录`，可选 `启用店铺`、`抓取时间`。充值必须是打款成功的流水。补传不重复：无 `executionId` 时按店铺+日期+充值时间+金额覆盖；有 `executionId` 时按该号去重。ID 一律字符串，不要科学计数法。充值记录建议再带 `executionId`、`configVersion`、`ruleCode`、`plannedRoi`、当时花费 / ROI / 单量、`result`。
10. 第二台机只换 `machineId`，协议不变。店铺上 `执行机` 为空 = 已绑定的机都能跑开启的店；填了 `machineId` = 只有该机跑。
11. 验收闭合：网站 Ctrl+F5 打开 `/shen/recharge-rules/index.html` → 勾选店铺并点「保存运行状态」→ version 递增 → 本机 GET 的 `runShops` 只有已开启的店 → 持续只跑这些店 → ACK 成功 → 页面变已同步。取消勾选后该店离开 `runShops`，页面先停止中，ACK 后已停止。全部取消时本机待机。
