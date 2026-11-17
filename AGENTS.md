# 运营部仓库约定

站点代码在 `apps/xingmai/`（生产 `/opt/mengkai`）。板块分工和发版闸门见 `docs/agents/`。
**先读** `docs/agents/00-module-charter.md`：现行是嵌入式模块（`XmModules[path].mount(#xm-content)`），壳归主框架，不是首页。`cursor/home-nav-workbench-e50e` 已整支删除，不要重建仓库根那套全页壳。

## 做完直接交单上线

自测通过后立刻交发布单，**图形 / 布局 / 视觉改动同样交**，不要等用户再单独说「提交」「交单」「发布」：

1. `GET /api/releases/next` 领全站下一个 `0.1.N`
2. `POST /api/releases` 入队（`contents` 为路径→正文；`files` 只写路径字符串）
3. 告知单据号，等 `https://zx.xingmaierp.cc/releases` 第 1 位「通过」

纪律全文：`docs/agents/00-release-rules.md`。演示号已停用，线上只准用罗成。登录不上先读 `docs/agents/00-prod-admin.md`。禁止 SSH、禁止自己上 ECS、禁止自己点通过。

## 禁止提交会挂站的瘦 app.js

`src/app.js` 是全站入口。非主框架 **单据禁止带 `src/app.js`**，只交自己目录和 `public/shared/modules/<id>.js`。覆盖瘦版本会让 `/api/auth/login`、`/api/releases`、`/api/health` 全部 404，闸门自己也修不了。

完整 `src/app.js` 必须同时有：`attachProfile`、`attachHome`、`createReleasesRouter`、`/api/health`。缺任一视为瘦版本，禁止覆盖线上。

## 侧栏公共文件只由主框架交付

壳文件只许模块名填「主框架」的单据包含：`public/shared/nav.js`、`public/shared/layout.css`、`public/shared/xingmai-logo.png`、`src/modules/home/nav-items.js`。首页、数据中心、沈子晗、韩梦凯、人员管理、版本发布中心、个人中心交这些路径会被闸门 400 拒绝。其它模块只引用壳，不要覆盖。侧栏底部固定「版本发布中心 / 组织中心 / 个人中心 / 退出登录」和版本号；不要顶栏「退出」「暗色」。

点「通过」时闸门再验一遍内核和壳，空 `files` 禁止全量落地。`src/app.js` / `server.js` / `boot-dirs.js` 只许主框架；`auth.js` 只许主框架或个人中心；`pages.js` 必须和 `middleware.js` 成套交。

## 页面颜色

新改的页面用公共变量 `var(--xm-*)`，不新造主色，不改壳子，不改内容和接口。主色只用 `--xm-primary`。侧栏、顶栏、`nav.js`、`layout.css` 只许主框架改。只改样子时，字段和接口保持原样。旧页面里写死的颜色，等那一页下次被改到再换。全文见 `docs/agents/00-module-charter.md`。

## 验收录屏

不要主动做预览图、截图、操作视频。主脑需要时会说「要预览图」或「要录屏」。
未明确要求时，只用接口或本地核对，不要用 RecordScreen，不要往回复里贴预览图。
