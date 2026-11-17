你是独立 Agent「边界数据中心」。先读 [00-module-charter.md](00-module-charter.md)。只做边界数据中心内容页和自己的接口。不要改壳。不要和星脉数据中心、首页挤在同一个对话框。

【纪律】
- 站点：`https://zx.xingmaierp.cc/bound`
- 交单模块名：`边界数据中心`。申请人 `罗成运营部主脑`。做完直接交单。
- 版本号 `0.1.N-说明`，先 `GET /api/releases/next`。登录不上先读 [00-prod-admin.md](00-prod-admin.md)。
- 嵌入式：`public/shared/modules/bound.js` 挂 `XmModules["/bound"]`。不要自画侧栏，不要交壳，不要交 `src/app.js`。
- 颜色跟 `--xm-*` / `data-theme`。不要抄 e50e 全页壳。
- 每次改动都不要录屏，不要做视频分析，不要出预览图，不要截图。核对用接口或本地测试。
- 只要一页 `/bound`，不要再开子路由，除非主框架先改侧栏。
- 人事部账号只看智能人事和个人中心，不要把边界数据中心加进人事台。
- 不要覆盖现网 `hr.js`、`people.js`、`app.js`、`home.js`、`data.js`。

【你能改】
- `src/modules/bound/`
- `public/shared/modules/bound.js`

【你不能改】壳、`nav.js`、`nav-items.js`、内核、登录/改密、组织中心业务、别人的模块。侧栏入口主框架已经挂好。不要改星脉数据中心（`/data`、`shared/modules/data.js`、`src/modules/data/`）。不要改首页实时。

【对接（已经接上）】
- 侧栏主栏「边界数据中心」→ `/bound`。一项，无子菜单，在首页后面、星脉数据中心前面。点击是 `pushState`，不是整页跳。
- 主框架加载 `/shared/modules/bound.js`，你只往 `#xm-content` 画页面。
- API 前缀 `/api/bound`。仓库已有 stub：`GET /api/bound` 返回 `{ ok: true, module: "bound", source: "crawler", erp: false }`。
- 新接口写在 `src/modules/bound/router.js`。表用自己的 `bound_*`。
- 线上若还没挂 `/api/bound`，让主框架补，你不要交 `src/app.js`。

【业务】
- 这里是**爬虫数据汇总**，不是星脉 ERP 数据。
- 禁止去读、转发、展示星脉 ERP / 京麦面板 / 首页实时 / 星脉数据中心的接口。
- 后期会单独接爬虫数据接口。现在先把汇总台架子搭好：空表、筛选位、来源说明写清「爬虫，非 ERP」。
- 接口还没来之前不要假装已经是 ERP 数。

【要做】
1. 在现有 `bound.js` 上改，不要重做侧栏，不要另起一套页面。
2. 先能手测空汇总台。接口来了再接到 `/api/bound*`。
3. 需要加页签时仍留在 `/bound` 这一页。

【验收】登录后点侧栏「边界数据中心」，内容出现在壳的 `#xm-content`，刷新不丢侧栏。页面明确是爬虫汇总，不是 ERP。星脉数据中心仍在它下面，互不影响。
【不要做】不要改侧栏品牌条和 logo；不要改版本发布中心或登录；不要接 ERP；不要覆盖现网 `hr.js`、`people.js`、`app.js`、`data.js`、`home.js`。
