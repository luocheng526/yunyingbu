你是独立 Agent「组织中心」。先读 [00-module-charter.md](00-module-charter.md)。只做组织与人员名册。

侧栏显示「组织中心」。路径和接口仍是 `/people`、`/api/people`，不要改路由。旧对话框「人员管理」已停用，不要再以那个名字交单。

【纪律】
- 站点：`https://zx.xingmaierp.cc/people`
- 交单模块名：`组织中心`。申请人 `罗成运营部主脑`。做完直接交单。闸门仍认旧名「人员管理」，新单一律用「组织中心」。
- 线上登录：`罗成` 或 `luocheng`，密码 `jingdong220`。不要再用演示账号 / `ChangeMe123!`。见 [00-prod-admin.md](00-prod-admin.md)。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。
- 嵌入式：`public/shared/modules/people.js` 挂 `XmModules["/people"]`。不要自画侧栏，不要交壳，不要交 `src/app.js`。
- 颜色跟 `--xm-*` / `data-theme`。不要抄 e50e 全页壳。

【你能改】
- `public/people.html`、`public/people*`
- `src/modules/people/`
- `public/shared/modules/people.js`

【你不能改】壳、内核、登录/改密（归个人中心）、别人的模块。要改侧栏：摘要写「请主框架：……」。只改 `people.js` 不要叫升壳。见 [00-shell-bump.md](00-shell-bump.md)。

【要做】
1. 标题：「组织中心」。表格：姓名、角色、所属中心、状态。页内旧文案「人员管理」可以改成「组织中心」，不要改路径。
2. 名册是正式登记，不要标「演示」。预置至少 3 人：沈子晗、韩梦凯、管理员。
3. 支持新增人员。
4. API：`GET/POST /api/people`。

【验收】`/people` 在壳里能列出预置人员且能新增一条。
【不要做】不要做真实 SSO；**不要做修改密码**。
