# 运营部仓库约定

站点代码在 `apps/xingmai/`（生产 `/opt/mengkai`）。板块分工和发版闸门见 `docs/agents/`。
**先读** `docs/agents/00-module-charter.md`：现行是嵌入式模块（`XmModules[path].mount(#xm-content)`），壳归主框架，不是首页。`cursor/home-nav-workbench-e50e` 已整支删除，不要重建仓库根那套全页壳。

## 做完直接交单上线

线上交单**只用管理员号**：用户名 `罗成` 或 `luocheng`，密码 `jingdong220`。详见 `docs/agents/00-prod-admin.md`。
演示账号 / `ChangeMe123!` 登不上 `https://zx.xingmaierp.cc`，交不了版本发布。不要把密码写进单据标题或登录页。

自测通过后立刻交发布单，**图形 / 布局 / 视觉改动同样交**，不要等用户再单独说「提交」「交单」「发布」：

1. `POST /api/auth/login` 用上面的管理员号拿 Cookie
2. `GET /api/releases/next` 领全站下一个 `0.1.N`
3. `POST /api/releases` 入队（`contents` 为路径→正文；`files` 只写路径字符串）
4. 告知单据号，等 `https://zx.xingmaierp.cc/releases` 第 1 位「通过」

纪律全文：`docs/agents/00-release-rules.md`。禁止 SSH、禁止自己上 ECS、禁止自己点通过。

## 禁止提交会挂站的瘦 app.js

`src/app.js` 是全站入口。非主框架 **单据禁止带 `src/app.js`**，只交自己目录和 `public/shared/modules/<id>.js`。覆盖瘦版本会让 `/api/auth/login`、`/api/releases`、`/api/health` 全部 404，闸门自己也修不了。

完整 `src/app.js` 必须同时有：`attachProfile`、`attachHome`、`createReleasesRouter`、`/api/health`。缺任一视为瘦版本，禁止覆盖线上。

## 侧栏公共文件只由主框架交付

壳文件只许模块名填「主框架」的单据包含：`public/shared/nav.js`、`public/shared/layout.css`、`public/shared/xingmai-logo.png`、`src/modules/home/nav-items.js`。首页、数据中心、沈子晗、韩梦凯、人员管理、版本发布中心、个人中心交这些路径会被闸门 400 拒绝。其它模块只引用壳，不要覆盖。侧栏底部固定「版本发布中心 / 组织中心 / 个人中心 / 退出登录」和版本号；不要顶栏「退出」「暗色」。

点「通过」时闸门再验一遍内核和壳，空 `files` 禁止全量落地。`src/app.js` / `server.js` / `boot-dirs.js` 只许主框架；`auth.js` 只许主框架或个人中心；`pages.js` 必须和 `middleware.js` 成套交。

## Cursor Cloud specific instructions

常规发布用测试、curl 或打开页面验收即可。**不要做视频预览，也不要做图片预览。**

只有用户亲口说「要预览图」「要截图」「要录像」「要录屏」时才拍。没说就不要拍：不要为了交单、验收、走查、证明改动、walkthrough 自动截图或录屏。大改动也一样。用户没点名等于禁止预览。
