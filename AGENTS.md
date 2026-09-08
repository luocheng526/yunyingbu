# 运营部仓库约定

站点代码在 `apps/xingmai/`（生产 `/opt/mengkai`）。板块分工和发版闸门见 `docs/agents/`。

## 做完直接交单上线

自测通过后立刻交发布单，**图形 / 布局 / 视觉改动同样交**，不要等用户再单独说「提交」「交单」「发布」：

1. `GET /api/releases/next` 领全站下一个 `0.1.N`
2. `POST /api/releases` 入队（`contents` 为路径→正文；`files` 只写路径字符串）
3. 告知单据号，等 `https://zx.xingmaierp.cc/releases` 第 1 位「通过」

纪律全文：`docs/agents/00-release-rules.md`。禁止 SSH、禁止自己上 ECS、禁止自己点通过。

## 禁止提交会挂站的瘦 app.js

`src/app.js` 是全站入口。数据中心 / 沈子晗 / 韩梦凯 / 人员管理 **单据禁止带 `src/app.js`**，只交自己目录。覆盖瘦版本会让 `/api/auth/login`、`/api/releases`、`/api/health` 全部 404，闸门自己也修不了。

完整 `src/app.js` 必须同时有：`attachProfile`、`attachHome`、`createReleasesRouter`、`/api/health`。缺任一视为瘦版本，禁止覆盖线上。

## 侧栏公共文件只由首页交付

壳文件只许模块名填「首页」的单据包含：`public/shared/nav.js`、`public/shared/layout.css`、`public/shared/xingmai-logo.png`、`src/modules/home/nav-items.js`。数据中心、沈子晗、韩梦凯、人员管理、版本发布中心、个人中心交这些路径会被闸门 400 拒绝。其它模块只引用壳，不要覆盖。侧栏底部固定「版本发布中心 / 个人中心 / 退出登录」和版本号；不要顶栏「退出」「暗色」。

点「通过」时闸门再验一遍内核和壳，空 `files` 禁止全量落地。
