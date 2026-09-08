# 全员纪律（每个模块先读这一页）

线上：`https://zx.xingmaierp.cc`。一个 Express，七个业务面 + **主框架**。
交单：登录版本发布中心 → `GET /api/releases/next` → `POST /api/releases`。申请人 `罗成运营部主脑`。做完直接交单。不要等用户再说「提交」。

## 现行结构：嵌入式，不是每人一套站

| 路由 | 谁画壳 | 谁画内容 |
|---|---|---|
| `/login` | 无壳。独立登录页，**不加载** `nav.js` | 个人中心 |
| `/` | 首页自己的 `index.html`（外观跟壳一致） | 首页 |
| `/data` `/shen` `/han` `/people` `/releases` `/me` | **主框架** `renderAppShell`：侧栏 + `#xm-content` | 各模块 `XmModules[path].mount(#xm-content)` |

模块之间点击：`history.pushState` + 加载对应 `public/shared/modules/<id>.js`。不要整页跳，不要预取全部模块文档。

### 业务模块不要做

- 自己的侧栏、顶栏、折叠条、第二套 layout
- 在 `public/*.html` 里再复制一整页壳
- 改 `public/shared/nav.js` / `layout.css` / `xingmai-logo.png` / `src/modules/home/nav-items.js`
- 改 `src/app.js` / `src/server.js` / `src/boot-dirs.js`
- 给登录页加 `nav.js`
- 空 `files` 全量同步
- 从旧分支 `cursor/home-nav-workbench-e50e` 抄结构

### 业务模块要做

- 内容脚本：`public/shared/modules/<id>.js`，挂 `window.XmModules["/<path>"] = { mount, unmount }`
- 自己的 API：`src/modules/<id>/`，前缀 `/api/<id>`
- 自己的样式：只写内容区，颜色用 `--xm-*` 和 `html[data-theme]`
- 交单：`files` 列出路径，`contents` 是路径→正文，模块名填自己

## `cursor/home-nav-workbench-e50e` 为什么不一样，能不能改

不一样，是因为**时间线和起点都不同**，不是现行仓库改坏了。

| | `e50e`（旧样板间） | 现行（嵌入式） |
|---|---|---|
| 起点 | 当时 `main` 几乎只有 README，首页 Agent 从零搭 | 代码在 `apps/xingmai/`，一个 Express 挂齐七个模块 |
| 任务稿 | 「首页抽出 nav、每页完整 HTML」 | 主框架画壳，业务 `XmModules.mount` |
| 入口 | 瘦 `src/app.js`，只有 `attachHome` | 完整内核：`attachProfile` + `attachHome` + 发版闸 + `/api/health` |
| 导航 | 整页跳 + `prefetch` 整页文档，侧栏有「项目」分组 | `history.pushState` + 加载 `shared/modules/<id>.js`，无「项目」 |
| 其它页 | 占位完整 HTML，自带侧栏 | `renderAppShell` + `#xm-content` |

**能改，但不该在 `e50e` 那条旧分支上改。** 两条 git 历史对不上。硬把它改成嵌入式再合进主线，会在仓库根再铺一套 `src/` `public/`，而且是瘦 `app.js`，登录和发版会 404（跟 rel-131 同类）。

现行 `apps/xingmai/` 里侧栏和工作台都已经在，而且是嵌入式。`e50e` 作废：不要当工作分支，不要抄，不要合进主线。首页继续只改 `index.html` 和 `shared/modules/home.js`。

## 模块边界

| 模块（交单名） | 可改 | 不可改 |
|---|---|---|
| 主框架 | 壳四件套、`nav-items.js`、内核三件、闸补丁、`auth.js` | 各业务 `public/*.html`、`shared/modules/*.js` |
| 首页 | `public/index.html`、`src/modules/home/`（除 `nav-items.js`）、`shared/modules/home.js` | 壳、内核、别人的模块 |
| 数据中心 | `public/data.html`、`public/data*`、`src/modules/data/`、`shared/modules/data.js` | 壳、内核、别人的模块 |
| 沈子晗 | `public/shen.html`、`public/shen*`、`src/modules/shen/`、`shared/modules/shen.js` | 同上 |
| 韩梦凯 | `public/han.html`、`public/han*`、`src/modules/han/`、`shared/modules/han.js` | 同上 |
| 人员管理 | `public/people.html`、`public/people*`、`src/modules/people/`、`shared/modules/people.js` | 同上 |
| 版本发布中心 | `public/releases.html`、`releases.css`、`src/modules/releases/`（**补丁**线上闸，禁止用仓库简化 router 整文件覆盖） | 壳、业务模块、线上 `app.js` |
| 个人中心 | `login.html` / `login.css` / `me.html`、`src/modules/profile/`；`home/pages.js` 与 `profile/middleware.js` 必须同单 | 壳；登录页不得加载 `nav.js` |

`nav-items.js` 虽然在 `src/modules/home/`，归属 **主框架**，首页不要交。

## 闸（交单前自己对照）

- 壳四件套 → 模块必须是 **主框架**
- `src/app.js` / `server.js` / `boot-dirs.js` → **主框架**；`app.js` 正文必须有 `attachProfile`、`attachHome`、`createReleasesRouter`、`/api/health`
- `src/modules/profile/auth.js` → 主框架 或 个人中心
- `src/modules/home/pages.js` 与 `src/modules/profile/middleware.js` 必须出现在同一张单
- `files` 不能空；`contents` 是「路径 → 正文」，不是对象数组
- 不要点「通过」**rel-131**（把内核冲成数据中心瘦文件的事故单）

## 测试（本地，改了对应文件再跑）

```bash
cd apps/xingmai && node --test test/app.test.js test/home.test.js test/theme.test.js
```

必须还在：`星脉管理系统`、`https://zx.xingmaierp.cc/login`、`#f7f7f4`、`#14120b`、`html[data-theme="dark"]`、`login-theme`、`localStorage.getItem("xm-theme")`、`ChangeMe123!`。
`src/app.js` 必须同时有 `attachProfile`、`attachHome`、`createReleasesRouter`、`/api/health`。
登录页 HTML 不得出现 `nav.js`。
