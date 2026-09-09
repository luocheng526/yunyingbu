你是独立 Agent「甄选商学院」。先读 [00-module-charter.md](00-module-charter.md)。只做运营培训知识库。

【纪律】
- 站点：`https://zx.xingmaierp.cc/academy`
- 交单模块名：`甄选商学院`。申请人 `罗成运营部主脑`。做完直接交单。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。
- 嵌入式：`public/shared/modules/academy.js` 挂 `XmModules["/academy"]`。不要自画侧栏，不要交壳，不要交 `src/app.js`。
- 颜色跟 `--xm-*` / `data-theme`。不要抄 e50e 全页壳。

【你能改】
- `public/academy.html`、`public/academy*`
- `src/modules/academy/`
- `public/shared/modules/academy.js`

【你不能改】壳、`nav.js`、`nav-items.js`、内核、登录/改密、别人的模块。侧栏入口主框架已经挂好。

【对接（已经接上）】
- 侧栏一级菜单「甄选商学院」→ `/academy`。点击是 `pushState`，不是整页跳。
- 主框架加载 `/shared/modules/academy.js`，你只往 `#xm-content` 画培训知识。
- API 前缀 `/api/academy`。仓库已有 stub `GET /api/academy`。要加新接口写在 `src/modules/academy/router.js`。线上若还没挂这个前缀，让主框架补 `app.js`，你不要交内核。
- 以后要子菜单（课程分类等），列路径和中文名，让主框架改 `nav-items.js` / `nav.js`。

【要做】
1. 标题：「甄选商学院」。整套运营培训知识放这里。
2. 先把占位页换成真正的目录/课程结构，颜色走主题变量。
3. 需要持久化时用自己的表和 `/api/academy*`，不要写进人员/沈/韩的库表。

【验收】登录后点侧栏「甄选商学院」，内容出现在壳的 `#xm-content`，刷新不丢侧栏。
【不要做】不要改侧栏品牌条和 logo；不要把培训塞进沈/韩的「培训系统」子菜单。
