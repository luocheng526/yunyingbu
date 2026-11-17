# 全员纪律（每个模块先读这一页）

线上：`https://zx.xingmaierp.cc`。一个 Express，十个业务面 + **主框架**。
交单：登录版本发布中心 → `GET /api/releases/next` → `POST /api/releases`。申请人 `罗成运营部主脑`。演示号已停用，只准用罗成。登录不上先读 [00-prod-admin.md](00-prod-admin.md)。做完直接交单。不要等用户再说「提交」。

## 现行结构：嵌入式，不是每人一套站

| 路由 | 谁画壳 | 谁画内容 |
|---|---|---|
| `/login` | 无壳。独立登录页，**不加载** `nav.js` | 个人中心 |
| `/` | 无菜单项。登录后 302 到 `/data` | — |
| `/data` `/bound` `/shen` `/han` `/people` `/hr` `/academy` `/agents` `/work` `/feedback` `/releases` `/me` | **主框架** `renderAppShell`：侧栏 + `#xm-content` | 各模块 `XmModules[path].mount(#xm-content)` |

模块之间点击：`history.pushState` + 加载对应 `public/shared/modules/<id>.js`。不要整页跳，不要预取全部模块文档。

### 业务模块不要做

- 自己的侧栏、顶栏、折叠条、第二套 layout
- 按设计参考图重做系统外壳或更换导航组件
- 在 `public/*.html` 里再复制一整页壳
- 改 `public/shared/nav.js` / `layout.css` / `xingmai-logo.png` / `xm-ui.css` / `xm-ui.js` / `src/modules/home/nav-items.js`
- 改 `docs/XM_UI_DESIGN_SYSTEM.md` 或 `.cursor/rules/xm-ui-design.mdc`
- 另做一套卡片、表格、按钮，或引入新的 UI 框架，或写未经批准的全局 CSS
- 改 `src/app.js` / `src/server.js` / `src/boot-dirs.js`
- 给登录页加 `nav.js`
- 空 `files` 全量同步
- 复活已删的 `cursor/home-nav-workbench-e50e` 全页壳（瘦 `app.js`、prefetch 整页、「项目」分组）
- 每次改动都不要录屏，不要做视频分析，不要出预览图，不要截图

### 业务模块要做

- 内容脚本：`public/shared/modules/<id>.js`，挂 `window.XmModules["/<path>"] = { mount, unmount }`
- 自己的 API：`src/modules/<id>/`，前缀 `/api/<id>`
- 自己的样式：只写内容区。新改的页面先读 `docs/XM_UI_DESIGN_SYSTEM.md`，根节点加 `xm-ui-scope`，优先用 `window.XmUI`。主色只用规范里的 `--xm-ui-primary` / `--xm-primary`，不新造颜色，不改壳子，不改内容和接口
- 交单：`files` 列出路径，`contents` 是路径→正文，模块名填自己

## 已删除：`cursor/home-nav-workbench-e50e`

旧首页样板间已整支删除（远程分支和对应单都关掉了）。那套是仓库根上的全页壳：瘦 `src/app.js`、侧栏写死在 HTML、`prefetch` 整页、「项目」分组。现行壳只在 `apps/xingmai/public/shared/`，不要重建 e50e，不要往仓库根再铺 `public/` `src/`。

## 模块边界

| 模块（交单名） | 可改 | 不可改 |
|---|---|---|
| 主框架 | 壳四件套、`nav-items.js`、内核三件、闸补丁、`auth.js` | 各业务 `public/*.html`、`shared/modules/*.js` |
| 首页 | `shared/modules/home.js`、`src/modules/home/`（除 `nav-items.js`） | 壳、内核、别人的模块。侧栏第一项「首页」，路径 `/home`。不要改 `public/index.html`，`/` 仍跳数据中心 |
| 数据中心 | `public/data.html`、`public/data*`、`src/modules/data/`、`shared/modules/data.js` | 壳、内核、别人的模块。侧栏显示「星脉数据中心」，路径仍是 `/data`，交单名仍是「数据中心」 |
| 边界数据中心 | `src/modules/bound/`、`shared/modules/bound.js` | 同上。侧栏一项 `/bound`，无子菜单，在首页后面、星脉数据中心前面。爬虫汇总，不是 ERP |
| 沈子晗 | `public/shen.html`、`public/shen*`、`src/modules/shen/`、`shared/modules/shen.js` | 同上 |
| 韩梦凯 | `public/han.html`、`public/han*`、`src/modules/han/`、`shared/modules/han.js` | 同上 |
| 组织中心 | `public/people.html`、`public/people*`、`src/modules/people/`、`shared/modules/people.js` | 同上。侧栏显示「组织中心」，路径仍是 `/people`。旧交单名「人员管理」闸门仍认，新单用「组织中心」。**不接钉钉** |
| 智能人事 | `src/modules/hr/`、`shared/modules/hr.js` | 同上。侧栏一项 `/hr`，无子菜单。钉钉假勤归这里；人列表读 `GET /api/people` |
| 甄选商学院 | `public/academy.html`、`public/academy*`、`src/modules/academy/`、`shared/modules/academy.js` | 同上 |
| 甄选智能体 | `public/agents.html`、`public/agents*`、`src/modules/agents/`、`shared/modules/agents.js` | 同上 |
| 工作汇报 | `src/modules/work/`、`shared/modules/work.js` | 同上。侧栏主栏一项 `/work`，无子菜单。运营部、人事部、技术部按责权填报 |
| 月度大会 | `src/modules/meeting/`、`shared/modules/meeting.js` | 同上。侧栏主栏一项 `/meeting`，无子菜单。一页小看板 |
| 需求与反馈 | `src/modules/feedback/`、`shared/modules/feedback.js` | 同上。侧栏主栏一项 `/feedback`，无子菜单 |
| 版本发布中心 | `public/releases.html`、`releases.css`、`src/modules/releases/`（**补丁**线上闸，禁止用仓库简化 router 整文件覆盖） | 壳、业务模块、线上 `app.js` |
| 个人中心 | `login.html` / `login.css` / `me.html`、`src/modules/profile/`；`home/pages.js` 与 `profile/middleware.js` 必须同单 | 壳；登录页不得加载 `nav.js` |

`nav-items.js` 虽然在 `src/modules/home/`，归属 **主框架**，首页不要交。

主框架已认识：侧栏第一项「首页」`/home`（`/` 仍跳首页）；「边界数据中心」`/bound`；「星脉数据中心」`/data`（交单名仍是数据中心）；「甄选商学院」一项、无子菜单，路径 `/academy`；「甄选智能体」`/agents`；「工作汇报」`/work`；「月度大会」`/meeting`；「需求与反馈」`/feedback`；底部「组织中心 / 智能人事 / 版本发布中心 / 个人中心」，智能人事路径 `/hr`。要再加子菜单或改 `src/app.js` 挂新 API，问主框架，不要自己改壳。

## 业务内容区

全员先读 [XM_UI_DESIGN_SYSTEM.md](../XM_UI_DESIGN_SYSTEM.md)。这是业务内容区的唯一母版，名字是 XM Light Tech Admin。顶部和左侧保持现状。只优化 `#xm-content` 里面被点名的页面。

壳子已经引入 `/shared/xm-ui.css` 和 `/shared/xm-ui.js`。业务页不要再引，也不要把 `xm-ui-scope` 加到整页壳上。只在自己的内容根节点加这个 class，然后用 `window.XmUI` 的 `PageContentHeader`、`StatCard`、`ContentCard`、`SectionTitle`、`FilterToolbar`、`DataTable`、`StatusBadge`、`ChartCard`、`ProgressCard`、`EmptyState`。

公共组件和设计变量只由主框架维护。各业务对话只改自己的页面，不要同时覆盖 `xm-ui.css`、`xm-ui.js` 或规范文件。要加通用组件，交给主框架检查后再进 `XmUI`。独立分支先接上已验收的壳和公共母版，再改业务页。

做完必须核对被改的那一页，字段、按钮、表格列和接口保持原样。每次改动都不要录屏，不要做视频分析，不要出预览图，不要截图。核对用接口或本地测试。

## 页面颜色

新改的页面用公共变量 `var(--xm-*)`，不新造主色，不改壳子，不改内容和接口。业务内容区优先用 `docs/XM_UI_DESIGN_SYSTEM.md` 里的 `--xm-ui-*`，作用域只在 `.xm-ui-scope`。

- 主色只用 `--xm-primary`。悬停、浅底、按下用 `--xm-primary-hover`、`--xm-primary-soft`、`--xm-primary-deep`。不要再写一套蓝，也不要在业务页里写死 `#1677ff`。
- 页面底、字、边框、卡片、表头、成功、警告、危险用已有的 `--xm-bg`、`--xm-ink`、`--xm-muted`、`--xm-line`、`--xm-card`、`--xm-table-head`、`--xm-success`、`--xm-warning`、`--xm-danger`。
- 侧栏、顶栏、页签、`nav.js`、`layout.css` 只许主框架改。业务页只改自己的内容区。
- 只改样子时，字段、按钮、表格列和接口保持原样。
- 旧页面里已经写死的色值先留着，等那一页下次被改到时再换成变量。不要为了换色去翻别人的页面。

## 怎么新建独立对话框并对接

每个新业务面单独开一个 **Cursor Cloud Agent**（新对话），不要挤在主框架或别人的对话框里。

1. 打开 [cursor.com/agents](https://cursor.com/agents) → **New agent**。
2. 仓库选 **同一份** `luocheng526/yunyingbu`，环境和主框架相同。
3. 第一条消息只贴自己的 brief，不要让它改壳：

```
你是独立 Agent「甄选商学院」。先读 docs/agents/00-module-charter.md、docs/XM_UI_DESIGN_SYSTEM.md 和 docs/agents/08-academy.md。
你只改 academy 目录和 public/shared/modules/academy.js。不要改 Header、Sidebar、nav.js、layout.css、xm-ui.css、xm-ui.js、src/app.js。
业务内容区用 window.XmUI，根节点加 xm-ui-scope。不要另做卡片、表格、按钮，不要引入新的 UI 框架。
不改原有字段和接口。只改被点名的页面。
每次改动都不要录屏，不要做视频分析，不要出预览图，不要截图。核对用接口或本地测试。
用模块名「甄选商学院」交单，申请人 罗成运营部主脑。
```

智能体对话框把上面两处换成 `09-agents.md`、`agents`、`甄选智能体`。智能人事换成 `10-hr.md`、`hr`、`智能人事`。工作汇报换成 `12-work.md`、`work`、`工作汇报`。需求与反馈换成 `11-feedback.md`、`feedback`、`需求与反馈`。月度大会换成 `13-meeting.md`、`meeting`、`月度大会`。边界数据中心换成 `14-bound.md`、`bound`、`边界数据中心`。

4. 对接方式（已经接好，新对话不用再铺壳）：
   - 登录后点侧栏对应入口 → 主框架 `pushState` → 加载 `public/shared/modules/<id>.js` → `mount(#xm-content)`。
   - API 前缀：`/api/academy`、`/api/agents`。仓库入口已挂 stub；线上若还没有，让主框架补 `app.js`，不要自己交内核。
   - 交单：`GET /api/releases/next` → `POST /api/releases`，`module` 填自己的中文名。
5. 主框架认这两个名字：章程表、`NAV_MAIN`、`APP_MODULES`、`MODULES`。新对话改内容即可，不用再申请菜单。

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
