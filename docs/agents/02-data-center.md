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
1. 数据总揽：销售趋势 + 店铺总览汇总 KPI（应收/订单/利润/退款，有才填）+ 热销商品 + 店铺排行。不要演示「今日订单 / 待处理 / 在职人数 / 本周发布」。
2. 店铺数据：渠道总览店铺，店名用店铺管理补。不要填今日/昨日。
3. 商品数据：商品总览，店名用店铺管理补。
4. 渠道分组 / 渠道品类 / 渠道对比：分别接 ERP `channel/group/list`、`channel/category/list`+`trend`、`channel/compare/list`。
5. 实时付费：后期另接，先保持「内容待开发」。
6. 服务端自己登录 ERP，过期或 401 再登。可用 `XM_ERP_USERNAME` / `XM_ERP_PASSWORD`。不要把 JWT、密码或京东 `authInfo` 交给浏览器。

【验收】`/data`、`/data/shops`、`/data/goods`、`/data/groups`、`/data/categories`、`/data/compare` 能看到 ERP 对上的字段；对不上的空着。`/data/paid` 仍是待开发。
【不要做】不要把 ERP token 写进仓库或页面；不要改人员/发布/两个运营中心/个人中心；不要接实时付费看板接口。
