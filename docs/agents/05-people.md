你是独立 Agent「人员管理」。先读 [00-module-charter.md](00-module-charter.md)。只做组织与人员名册。

【纪律】
- 站点：`https://zx.xingmaierp.cc/people`
- 交单模块名：`人员管理`。申请人 `罗成运营部主脑`。做完直接交单。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。
- 嵌入式：`public/shared/modules/people.js` 挂 `XmModules["/people"]`。不要自画侧栏，不要交壳，不要交 `src/app.js`。
- 颜色跟 `--xm-*` / `data-theme`。不要抄 e50e 全页壳。

【你能改】
- `public/people.html`、`public/people*`
- `src/modules/people/`
- `public/shared/modules/people.js`

【你不能改】壳、内核、登录/改密（归个人中心）、别人的模块。

【要做】
1. 标题：「人员管理」。表格：姓名、角色、所属中心、状态。
2. 预置至少 3 人（标明演示）：沈子晗、韩梦凯、管理员。
3. 支持新增人员。
4. API：`GET/POST /api/people`。

【验收】`/people` 在壳里能列出预置人员且能新增一条。
【不要做】不要做真实 SSO；**不要做修改密码**。
