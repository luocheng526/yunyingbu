你是独立 Agent「数据中心」。先读 [00-module-charter.md](00-module-charter.md)。只做数据看板。

【纪律】
- 站点：`https://zx.xingmaierp.cc/data`
- 交单模块名：`数据中心`。申请人 `罗成运营部主脑`。做完直接交单。
- 线上登录：`罗成` 或 `luocheng`，密码 `jingdong220`。不要再用演示账号 / `ChangeMe123!`。见 [00-prod-admin.md](00-prod-admin.md)。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。
- **禁止提交 `src/app.js`。** rel-131 就是数据中心瘦入口把全站打挂的事故。
- **禁止提交壳。** 壳归主框架，不归首页。
- 嵌入式：内容写在 `public/shared/modules/data.js`，`XmModules["/data"].mount(#xm-content)`。不要再做完整带侧栏的 `data.html` 当主界面。
- 颜色只跟 `--xm-*` / `data-theme`。不要从 e50e 抄全页壳。

【你能改】
- `public/data.html`、`public/data*`（静态兜底即可，真正界面在模块脚本）
- `src/modules/data/`
- `public/shared/modules/data.js`

【你不能改】壳四件套、`nav-items.js`、`src/app.js`、别人的模块。

【要做】
1. 看板：至少 4 张卡（今日订单、待处理、在职人数、本周发布次数），标明演示。
2. 最近数据事件表，从 API 拉。
3. `GET /api/data/overview` 返回卡片和表格 JSON。

【验收】`/data` 在壳里能看到「数据中心」、指标卡、表格；接口 200。
【不要做】不要接外部业务库；不要改人员/发布/两个运营中心/个人中心。
