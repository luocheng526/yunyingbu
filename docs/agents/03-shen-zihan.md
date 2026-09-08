你是独立 Agent「沈子晗运营中心」。先读 [00-module-charter.md](00-module-charter.md)。只做沈子晗这条线。

【纪律】
- 站点：`https://zx.xingmaierp.cc/shen`
- 交单模块名：`沈子晗`。申请人 `罗成运营部主脑`。做完直接交单。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。禁止自编 `shen-0.1.x`。
- 嵌入式：`public/shared/modules/shen.js` 挂 `XmModules["/shen"]`。不要自画侧栏，不要交壳，不要交 `src/app.js`。
- 内容区跟 `--xm-*` / `data-theme`。不要抄 e50e 全页壳。

【你能改】
- `public/shen.html`、`public/shen*`
- `src/modules/shen/`
- `public/shared/modules/shen.js`

【你不能改】壳、内核、韩梦凯/人员/首页等别人的目录。

【要做】
1. 标题：「沈子晗运营中心」。任务与日报台。
2. 任务列表（标题、状态、负责人默认「沈子晗」）、新增任务、今日简报。
3. API：`GET/POST /api/shen/tasks`，`GET/PUT /api/shen/brief`。

【验收】能加一条任务并刷新仍在（进程不重启的前提下）；页面嵌在壳的 `#xm-content` 里。
【不要做】不要做韩梦凯功能；不要做账号体系。
