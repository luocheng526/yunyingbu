你是独立 Agent「工作汇报」。先读 [00-module-charter.md](00-module-charter.md)。只做工作汇报内容页和自己的接口。

【纪律】
- 站点：`https://zx.xingmaierp.cc/work`
- 交单模块名：`工作汇报`。申请人 `罗成运营部主脑`。做完直接交单。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。登录不上先读 [00-prod-admin.md](00-prod-admin.md)。
- 嵌入式：`public/shared/modules/work.js` 挂 `XmModules["/work"]`。不要自画侧栏，不要交壳，不要交 `src/app.js`。
- 颜色跟 `--xm-*` / `data-theme`。不要抄 e50e 全页壳。
- 只要一页 `/work`，上面用页签切换，不要再开子路由，除非主框架先改侧栏。

【你能改】
- `src/modules/work/`
- `public/shared/modules/work.js`

【你不能改】壳、`nav.js`、`nav-items.js`、内核、登录/改密、组织中心业务、别人的模块。侧栏入口主框架已经挂好。人事部账号只看智能人事和个人中心，不要把工作汇报加进人事台。

【对接（已经接上）】
- 侧栏主栏「工作汇报」→ `/work`。一项，无子菜单，在甄选智能体后面。点击是 `pushState`，不是整页跳。
- 主框架加载 `/shared/modules/work.js`，你只往 `#xm-content` 画页面。
- API 前缀 `/api/work`。仓库已有：
  - `GET /api/work`
  - `GET /api/work/settings`、`PUT /api/work/settings/members`、`PUT /api/work/settings/templates`
  - `GET /api/work/report`、`PUT /api/work/report`
- 新接口写在 `src/modules/work/router.js`。表用自己的 `work_report_*`，人名单和责权读 `GET /api/people`，不要改组织中心表。
- 线上若还没挂 `/api/work`，让主框架补，你不要交 `src/app.js`。

【业务】
- 只有运营部、人事部、技术部要汇报，其他部门不用报。
- 罗成按责权把人排进三个部门，并配部门模板或个人模板。其他人按模板填当天事项。
- 默认看今天（北京时间），可以选日期。表格填报。
- 登录名要对上组织中心姓名或 username。

【要做】
1. 在现有 `work.js` / `store.js` 上改，不要重做侧栏，不要另起一套页面。
2. 罗成能设部门名单和模板；名单里的人能选日期填当天表。
3. 需要加字段或页签时仍留在 `/work` 这一页。

【验收】登录后点侧栏「工作汇报」，内容出现在壳的 `#xm-content`，刷新不丢侧栏。罗成能排人、配模板；被排进运营部/人事部/技术部的人能填当天表。
【不要做】不要改侧栏品牌条和 logo；不要改版本发布中心或登录；不要覆盖现网 `hr.js`、`people.js`、`app.js`。
