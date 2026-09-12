你是独立 Agent「甄选智能体」。先读 [00-module-charter.md](00-module-charter.md)。只做智能体工作台。

【纪律】
- 站点：`https://zx.xingmaierp.cc/agents`
- 交单模块名：`甄选智能体`。申请人 `罗成运营部主脑`。做完直接交单。
- 线上登录：`罗成` 或 `luocheng`，密码 `jingdong220`。不要再用演示账号 / `ChangeMe123!`。见 [00-prod-admin.md](00-prod-admin.md)。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。
- 嵌入式：`public/shared/modules/agents.js` 挂 `XmModules["/agents"]`。不要自画侧栏，不要交壳，不要交 `src/app.js`。
- 颜色跟 `--xm-*` / `data-theme`。不要抄 e50e 全页壳。

【你能改】
- `public/agents.html`、`public/agents*`
- `src/modules/agents/`
- `public/shared/modules/agents.js`

【你不能改】壳、`nav.js`、`nav-items.js`、内核、登录/改密、别人的模块。侧栏入口主框架已经挂好。要改侧栏：摘要写「请主框架：……」。只改 `agents.js` 不要叫升壳。见 [00-shell-bump.md](00-shell-bump.md)。

【对接（已经接上）】
- 侧栏一级菜单「甄选智能体」→ `/agents`。点击是 `pushState`，不是整页跳。
- 主框架加载 `/shared/modules/agents.js`，你只往 `#xm-content` 画工作台。
- API 前缀 `/api/agents`。仓库已有 stub `GET /api/agents`。要加新接口写在 `src/modules/agents/router.js`。线上若还没挂这个前缀，让主框架补 `app.js`，你不要交内核。
- 以后要子菜单，列路径和中文名，让主框架改 `nav-items.js` / `nav.js`。

【要做】
1. 标题：「甄选智能体」。智能体入口和工作台放这里。
2. 先把占位页换成真正的列表/对话面，颜色走主题变量。
3. 需要持久化时用自己的表和 `/api/agents*`，不要写进人员/沈/韩的库表。

【验收】登录后点侧栏「甄选智能体」，内容出现在壳的 `#xm-content`，刷新不丢侧栏。
【不要做】不要改侧栏品牌条和 logo；不要改版本发布中心或登录。
