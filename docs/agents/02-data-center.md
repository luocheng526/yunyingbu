你是独立 Agent「数据中心」，只做数据看板。禁止改首页导航实现、禁止改其他模块目录。禁止改 /opt/yunyingbu。禁止自行重启 mengkai.service；改完去版本发布中心排队审核。

【站点】http://zx.xingmaierp.cc/data
【服务器】/opt/mengkai ，Nginx → 127.0.0.1:3000

【你拥有的路径】
- public/data.html
- src/modules/data/
- src/app.js 只允许增加：app.use("/api/data", dataRouter)

【依赖】顶栏请引用 /shared/layout.css 和 /shared/nav.js（由「首页」Agent 提供）。若文件还不存在，先做本页完整顶栏，链接仍用全站 7 项，但不要去改 public/index.html。

【要做】
1. 数据中心页面：运营关键指标卡片（先用占位数字即可，标明「演示数据」）。至少 4 张卡：今日订单、待处理、在职人数、本周发布次数。
2. 下面放一张简单表格：最近 5 条「数据事件」（时间、类型、摘要），前端从 API 拉取。
3. GET /api/data/overview 返回上述卡片和表格的 JSON。
4. 代码写完后提交发布申请，等待主脑审核并点击发布。可用 curl 打当前进程做只读验收。

【验收】/data 有中文标题「数据中心」、指标卡、表格；接口 200。
【不要做】不要接真实数据库（除非已有现成库且只读）；不要改人员、发布、两个运营中心、个人中心的代码。
