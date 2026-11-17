你是独立 Agent「需求与反馈」。先读 [00-module-charter.md](00-module-charter.md)。只做需求与反馈内容页和自己的接口。不要改壳。不要和月度大会、工作汇报挤在同一个对话框。

【纪律】
- 站点：`https://zx.xingmaierp.cc/feedback`
- 交单模块名：`需求与反馈`。申请人 `罗成运营部主脑`。做完直接交单。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。登录不上先读 [00-prod-admin.md](00-prod-admin.md)。
- 嵌入式：`public/shared/modules/feedback.js` 挂 `XmModules["/feedback"]`。不要自画侧栏，不要交壳，不要交 `src/app.js`。
- 颜色跟 `--xm-*` / `data-theme`。不要抄 e50e 全页壳。
- 每次改动都不要录屏，不要做视频分析，不要出预览图，不要截图。核对用接口或本地测试。
- 只要一页 `/feedback`，上面用页签切换即可，不要再开子路由，除非主框架先改侧栏。
- 人事部账号只看智能人事和个人中心，不要把需求与反馈加进人事台。
- 不要覆盖现网 `hr.js`、`people.js`、`app.js`。

【你能改】
- `src/modules/feedback/`
- `public/shared/modules/feedback.js`

【你不能改】壳、`nav.js`、`nav-items.js`、内核、登录/改密、组织中心业务、别人的模块。侧栏入口主框架已经挂好。

【对接（已经接上）】
- 侧栏主栏「需求与反馈」→ `/feedback`。一项，无子菜单，在月度大会后面。点击是 `pushState`，不是整页跳。
- 主框架加载 `/shared/modules/feedback.js`，你只往 `#xm-content` 画页面。
- API 前缀 `/api/feedback`。仓库已有 stub：`GET /api/feedback` 返回 `{ ok: true, module: "feedback" }`。
- 新接口写在 `src/modules/feedback/router.js`。表用自己的 `feedback_*`，不要写进人员/沈/韩/工作汇报的库表。
- 线上若还没挂 `/api/feedback`，让主框架补，你不要交 `src/app.js`。

【业务】
- 把占位页换成真正的需求/反馈台。先能提交、能列表、能看状态。
- 罗成能看全部；其他人先能提自己的需求和反馈。
- 需要持久化时用自己的表和 `/api/feedback*`。
- 需要加页签时仍留在 `/feedback` 这一页。

【要做】
1. 在现有 `feedback.js` 上改，不要重做侧栏，不要另起一套页面。
2. 先能手测空表，再补流程（提交、处理、关闭）。
3. 不要去改月度大会或工作汇报。

【验收】登录后点侧栏「需求与反馈」，内容出现在壳的 `#xm-content`，刷新不丢侧栏。能提交一条需求或反馈并在列表里看到。
【不要做】不要改侧栏品牌条和 logo；不要改版本发布中心或登录；不要覆盖现网 `hr.js`、`people.js`、`app.js`。
