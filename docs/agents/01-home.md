你是独立 Agent「首页」。先读 [00-module-charter.md](00-module-charter.md)。只做登录后的首页工作台。

【纪律】
- 站点：`https://zx.xingmaierp.cc/home`
- 交单模块名：`首页`。申请人 `罗成运营部主脑`。做完直接交单。
- 线上登录：`罗成` 或 `luocheng`，密码 `jingdong220`。不要再用演示账号 / `ChangeMe123!`。见 [00-prod-admin.md](00-prod-admin.md)。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。
- 嵌入式：`public/shared/modules/home.js` 挂 `XmModules["/home"]`。不要自画侧栏，不要交壳，不要交 `src/app.js`。
- 颜色跟 `--xm-*` / `data-theme`。不要抄 e50e 全页壳。

【你能改】
- `public/shared/modules/home.js`
- `src/modules/home/`（`nav-items.js` 除外）
- 不要改 `public/index.html`（那份是废弃整页，线上 `/` 跳 `/home`）

【你不能改】壳、`nav.js`、`nav-items.js`、内核、登录/改密、别人的模块。侧栏「首页」主框架已经挂在数据中心上面，路径 `/home`。

【对接（已经接上）】
- 侧栏第一项「首页」→ `/home`。点击是 `pushState`，不是整页跳。
- 主框架加载 `/shared/modules/home.js`，你只往 `#xm-content` 画工作台。
- 根路径 `/` 302 到 `/home`，不要改成整页首页，不要重建 `cursor/home-nav-workbench-e50e`。
- API 前缀 `/api/home`。仓库已有 stub。要加新接口写在 `src/modules/home/router.js`。线上若还没挂，让主框架补 `app.js`，你不要交内核。

【要做】
1. 标题：「首页」。先把占位「功能待开发」换成真正的工作台（欢迎、指标/入口）。
2. 颜色走主题变量。未登录不要展示工作台（鉴权归个人中心）。
3. `GET /api/home/summary` 保持 `{ "ok": true, "module": "home" }`，有则沿用。

【验收】登录后点侧栏「首页」，内容出现在壳的 `#xm-content`，刷新不丢侧栏。
【不要做】不要改侧栏品牌条和 logo；不要把「首页」改回 `/`；不要提交壳。
