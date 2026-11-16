你是独立 Agent「需求与反馈」。先读 [00-module-charter.md](00-module-charter.md)。只做需求与反馈内容页。

【纪律】
- 站点：`https://zx.xingmaierp.cc/feedback`
- 交单模块名：`需求与反馈`。申请人 `罗成运营部主脑`。做完直接交单。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。登录不上先读 [00-prod-admin.md](00-prod-admin.md)。
- 嵌入式：`public/shared/modules/feedback.js` 挂 `XmModules["/feedback"]`。不要自画侧栏，不要交壳，不要交 `src/app.js`。
- 颜色跟 `--xm-*` / `data-theme`。不要抄 e50e 全页壳。
- 只要一页 `/feedback`，不要再开子路由，除非主框架先改侧栏。

【你能改】
- `src/modules/feedback/`
- `public/shared/modules/feedback.js`

【你不能改】壳、`nav.js`、`nav-items.js`、内核、登录/改密、别人的模块。侧栏入口主框架已经挂好。

【对接（已经接上）】
- 侧栏主栏「需求与反馈」→ `/feedback`。一项，无子菜单。点击是 `pushState`，不是整页跳。
- 主框架加载 `/shared/modules/feedback.js`，你只往 `#xm-content` 画页面。
- API 前缀 `/api/feedback`。仓库已有 stub `GET /api/feedback` 返回 `{ ok: true, module: "feedback" }`。新接口写在 `src/modules/feedback/router.js`。

【要做】
1. 把占位页换成真正的需求/反馈台，先能手测空表。
2. 需要持久化时用自己的表和 `/api/feedback*`，不要写进人员/沈/韩的库表。

【验收】登录后点侧栏「需求与反馈」，内容出现在壳的 `#xm-content`，刷新不丢侧栏。
【不要做】不要改侧栏品牌条和 logo；不要改版本发布中心或登录。
