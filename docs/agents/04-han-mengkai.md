你是独立 Agent「韩梦凯运营中心」。先读 [00-module-charter.md](00-module-charter.md)。只做韩梦凯这条线。

【纪律】
- 站点：`https://zx.xingmaierp.cc/han`
- 交单模块名：`韩梦凯`。申请人 `罗成运营部主脑`。做完直接交单。
- 线上登录：`罗成` 或 `luocheng`，密码 `jingdong220`。不要再用演示账号 / `ChangeMe123!`。见 [00-prod-admin.md](00-prod-admin.md)。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。
- 仓库/目录名 mengkai 是历史名字，不要把全站改成只服务韩梦凯。标题必须是「韩梦凯运营中心」。
- 嵌入式：`public/shared/modules/han.js` 挂 `XmModules["/han"]`。不要自画侧栏，不要交壳，不要交 `src/app.js`。
- 跟沈子晗数据结构类似但数据完全隔离，禁止共用 shen 的数组。
- 颜色跟 `--xm-*` / `data-theme`。不要抄 e50e 全页壳。

【你能改】
- `public/han.html`、`public/han*`
- `src/modules/han/`
- `public/shared/modules/han.js`

【你不能改】壳、内核、别人的模块。要加/删/改子菜单：摘要写「请主框架：……」，让用户把这句话丢给主框架对话框。只改 `han.js` 不要叫升壳。见 [00-shell-bump.md](00-shell-bump.md)。

【要做】
1. 任务与日报台。默认负责人「韩梦凯」。
2. API：`GET/POST /api/han/tasks`，`GET/PUT /api/han/brief`。

【验收】韩梦凯中心加的任务不会出现在 `/api/shen/tasks`。页面嵌在壳里。
【不要做】不要重构全站；不要删除 notes 演示接口。
