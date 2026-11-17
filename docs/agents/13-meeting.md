你是独立 Agent「月度大会」。先读 [00-module-charter.md](00-module-charter.md)。只做月度大会内容页和自己的接口。不要改壳。不要和需求与反馈、工作汇报挤在同一个对话框。

【纪律】
- 站点：`https://zx.xingmaierp.cc/meeting`
- 交单模块名：`月度大会`。申请人 `罗成运营部主脑`。做完直接交单。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。登录不上先读 [00-prod-admin.md](00-prod-admin.md)。
- 嵌入式：`public/shared/modules/meeting.js` 挂 `XmModules["/meeting"]`。不要自画侧栏，不要交壳，不要交 `src/app.js`。
- 颜色跟 `--xm-*` / `data-theme`。不要抄 e50e 全页壳。
- 每次改动都不要录屏，不要做视频分析，不要出预览图，不要截图。核对用接口或本地测试。
- 只要一页 `/meeting`，小看板，不要再开子路由，除非主框架先改侧栏。
- 人事部账号只看智能人事和个人中心，不要把月度大会加进人事台。
- 不要覆盖现网 `hr.js`、`people.js`、`app.js`。

【你能改】
- `src/modules/meeting/`
- `public/shared/modules/meeting.js`

【你不能改】壳、`nav.js`、`nav-items.js`、内核、登录/改密、组织中心业务、别人的模块。侧栏入口主框架已经挂好。

【对接（已经接上）】
- 侧栏主栏「月度大会」→ `/meeting`。一项，无子菜单，在工作汇报后面、需求与反馈前面。点击是 `pushState`，不是整页跳。
- 主框架加载 `/shared/modules/meeting.js`，你只往 `#xm-content` 画页面。
- API 前缀 `/api/meeting`。仓库已有：
  - `GET /api/meeting`
  - `PUT /api/meeting`（只有罗成能改，其他人只看）
- 新接口写在 `src/modules/meeting/router.js`。表用自己的 `meeting_*`，不要改组织中心表。
- 线上若还没挂 `/api/meeting`，让主框架补，你不要交 `src/app.js`。

【业务】
- 一页小看板，不要做成很多子页。
- 已有彩色 KPI 卡和表格模板：奋斗时长、奋斗排名、BI利润、新人介绍、职级调整、个人目标、优秀员工。
- 在现有 `meeting.js` / `store.js` 上改，不要推倒重做，不要另起一套页面。
- 罗成能改数字和表格；其他人登录只能看。
- 需要加字段或块时仍留在 `/meeting` 这一页。

【要做】
1. 先打开现网 `/meeting` 看已有小看板，再改内容，不要先清空。
2. 罗成保存后刷新还在；其他人看不到保存按钮。
3. 卡片保持小、一页看完，不要铺成大后台。

【验收】登录后点侧栏「月度大会」，内容出现在壳的 `#xm-content`，刷新不丢侧栏。罗成能改；其他人只能看。
【不要做】不要改侧栏品牌条和 logo；不要改版本发布中心或登录；不要覆盖现网 `hr.js`、`people.js`、`app.js`。
