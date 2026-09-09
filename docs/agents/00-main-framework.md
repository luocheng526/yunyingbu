# 主框架（壳 + 内核 + 闸）

先读 [00-module-charter.md](00-module-charter.md)。你只改壳、进程入口、发布闸。业务页和业务 API 一律不碰。

## 你能改

- `public/shared/nav.js`
- `public/shared/layout.css`
- `public/shared/xingmai-logo.png`
- `src/modules/home/nav-items.js`（菜单数据，文件虽在 home 目录，归属主框架）
- `src/app.js` / `src/server.js` / `src/boot-dirs.js`（必须整文件是完整内核）
- `src/modules/releases/document.js`、`router.js`（只补丁线上闸，禁止用仓库简化版整文件覆盖）
- `src/modules/releases/store.js` / `store-memory.js` 的 `MODULES` 列表（加模块名）
- `src/modules/profile/auth.js`（会话策略；也可交给个人中心）
- `src/modules/home/pages.js` + `src/modules/profile/middleware.js`（必须同单；`renderAppShell` 在 middleware）

## 你不能改

- `public/index.html`、`public/data.html`、`public/releases.html`、`public/login.html`、`public/me.html`
- `public/shared/modules/*.js`（各业务模块自己的嵌入脚本）
- `src/modules/{home,data,shen,han,people,academy,agents}/**`（`nav-items.js` 除外）
- 用仓库里的简化 `releases/router.js` 整文件覆盖线上 `/opt/mengkai`

## 现行结构（对）

1. 一个 Express 进程：`attachProfile` → 闸页拦截 → `attachHome` → 各业务 attach → 静态 → `createReleasesRouter`。
2. 登录页独立，**不进壳**，**不加载** `nav.js`。
3. 首页 `/` 用完整 `index.html`（自带壳外观）。
4. 其它已登录路由：`renderAppShell(href)` 画出侧栏 + `#xm-content`，再 `XmModules[path].mount(root)`。
5. 模块之间点击：`history.pushState` + 加载对应 `public/shared/modules/<id>.js`，不要整页跳、不要预取全部模块。
6. 侧栏：窄 `200px`、无「项目」分组、无顶栏退出/暗色按钮。主区是数据中心 / 沈 / 韩 / 甄选商学院 / 甄选智能体。底部是版本发布中心 / 组织中心 / 个人中心 / 退出登录 / 版本号。
7. 主框架必须认识「甄选商学院」（子菜单：培训课程 / 培训考试 / 运营手册）和「甄选智能体」：`NAV_MAIN`、`APP_MODULES`、`MODULES`、章程。新对话框只填内容，不要再铺菜单。

`cursor/home-nav-workbench-e50e` 已整支删除。不要在仓库根再铺一套全页壳。

## 交单

- 模块名填 **主框架**。
- `files` 必须列出每个路径；`contents` 是「路径 → 正文」。
- 改壳四件套时只交这四件（可加 `nav-items.js`），版本号 `0.1.x`，`SHELL_ASSET_VER` 与线上一致或 +1。
- 改 `app.js` 时正文必须同时有 `attachProfile`、`attachHome`、`createReleasesRouter`、`/api/health`。缺一个闸会拒。
- 禁止空 `files`。
- 申请人：`罗成运营部主脑`。做完直接交单。
