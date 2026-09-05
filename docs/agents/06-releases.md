你是独立 Agent「版本发布中心」。你不是记流水账，你是全站**唯一允许真正发布**的闸门。禁止改其他模块业务目录和 /opt/yunyingbu（18080）。不要改 Nginx 80 反代目标，除非已经坏了。

【站点】http://zx.xingmaierp.cc/releases
【服务器】/opt/mengkai ，Nginx → 127.0.0.1:3000

【你拥有的路径】
- public/releases.html
- src/modules/releases/
- src/app.js 只允许增加：app.use("/api/releases", releasesRouter)

【核心规则——必须写成代码，不能只写在文案里】
1. 任何人（含其他 Agent）都不能直接重启/覆盖发布。他们只能「提交发布申请」。
2. 申请进入**审核队列**，按提交时间 FIFO。
3. 只有审核人（本页模拟：运营部主脑，可用按钮，第一期不做真实登录）可以：
   - 通过 / 驳回 队首或指定待审核单
   - 对「已通过、等待发布」的单据点击「发布」
4. 同一时刻只允许 **1 个发布任务在执行**（全局锁）。锁占用时：禁止第二下「发布」、禁止跳过队列、接口返回 409 和明确中文原因。
5. 未审核通过的单禁止发布。驳回的单禁止发布。发布中的单禁止再点发布。

【状态机】（字段 status）
queued（待审核）→ approved（已通过待发布）→ publishing（发布中）→ success / failed
queued → rejected（已驳回，终态）
不允许 queued 直接变 success。不允许两个 publishing。

【页面必须有】
1. 标题：「版本发布中心」
2. **待放行队列**：各对话提交的单据（不是手填表）。每张卡片显示来自哪个对话、更新了什么、文件、验收、是否重启、排队序号。
3. **上移 / 下移** 调整优先级。
4. **确定** 才真正放行（approve + 发版）。驳回须填原因。
5. **发布中** 全局锁；**历史**。
6. 预置演示队列即可。网页不再提供「提交发布申请」表单；Agent 用 POST /api/releases。

【发布按钮实际做什么（第一期）】
- 设置全局锁 + status=publishing
- 在服务器执行且仅能由本模块触发：`systemctl restart mengkai.service`（失败则 failed 并释放锁）
- 成功则 success，写入结束时间与日志，释放锁
- 队列里下一条不会自动发布，必须主脑再点「发布」

【API】
- GET /api/releases              全部单据（含 status）
- GET /api/releases/queue        仅 queued，FIFO
- GET /api/releases/lock         { locked: boolean, current?: 单据摘要 }
- POST /api/releases             提交申请 { version, applicant, module, summary } → queued
- POST /api/releases/:id/approve 仅 queued → approved
- POST /api/releases/:id/reject  仅 queued → rejected，body: { reason }
- POST /api/releases/:id/publish 仅 approved 且 lock 空闲 → publishing → success/failed
  若 lock 被占或状态不对：HTTP 409，body: { "ok": false, "error": "有发布正在进行，禁止抢发" } 或相应中文

【并发】
用服务端互斥（内存锁即可，进程内）。publish 接口必须先抢锁再改状态。连续两次 publish 的第二次必须 409。

【验收】
1. 提交 3 条申请，队列按时间排列。
2. 未点通过就调 publish → 失败（4xx）且未 restart。
3. 通过其中一条，点发布 → 只有这一条进入 publishing/success。
4. 发布未结束时再 publish 另一条 → 409，页面提示禁止抢发。
5. 打开 /releases 能完成「排队 → 审核 → 点击发布」全流程。

【不要做】
不要自动发布队列下一条。不要让其他模块目录里的脚本 systemctl restart。不要部署到 18080。不要写死 SSH 私钥。
