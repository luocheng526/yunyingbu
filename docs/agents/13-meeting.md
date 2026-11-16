你是独立 Agent「月度大会」。先读 [00-module-charter.md](00-module-charter.md)。只做月度大会内容页。

【纪律】
- 站点：`https://zx.xingmaierp.cc/meeting`
- 交单模块名：`月度大会`。申请人 `罗成运营部主脑`。做完直接交单。
- 嵌入式：`public/shared/modules/meeting.js` 挂 `XmModules["/meeting"]`。不要自画侧栏，不要交壳，不要交 `src/app.js`。
- 只要一页 `/meeting`，小看板，不要再开子路由。

【你能改】
- `src/modules/meeting/`
- `public/shared/modules/meeting.js`

【你不能改】壳、`nav.js`、`nav-items.js`、内核、登录、别人的模块。侧栏入口主框架已经挂好。

【对接】
- 侧栏主栏「月度大会」→ `/meeting`，在工作汇报后面。
- API：`GET /api/meeting`、`PUT /api/meeting`。罗成改，其他人看。
- 模板块：奋斗时长、奋斗排名、BI利润、新人介绍、职级调整、个人目标、优秀员工。
