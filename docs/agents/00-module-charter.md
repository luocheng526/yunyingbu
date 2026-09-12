# 全员纪律（每个模块先读这一页）

线上：`https://zx.xingmaierp.cc`。一个 Express，十个业务面 + **主框架**。
交单：用管理员号登录 → `GET /api/releases/next` → `POST /api/releases`。申请人 `罗成运营部主脑`。做完直接交单。不要等用户再说「提交」。
线上账号：`罗成` 或 `luocheng`，密码 `jingdong220`。不要再用演示账号 / `ChangeMe123!`（登不上生产）。全文：[00-prod-admin.md](00-prod-admin.md)。

## 现行结构：嵌入式，不是每人一套站

| 路由 | 谁画壳 | 谁画内容 |
|---|---|---|
| `/login` | 无壳。独立登录页，**不加载** `nav.js` | 个人中心 |
| `/` | 无菜单项。登录后 302 到 `/home` | — |
| `/home` `/data` `/shen` `/han` `/people` `/stores` `/academy` `/agents` `/releases` `/me` | **主框架** `renderAppShell`：侧栏 + `#xm-content` | 各模块 `XmModules[path].mount(#xm-content)` |

模块之间点击：`history.pushState` + 加载对应 `public/shared/modules/<id>.js`。不要整页跳，不要预取全部模块文档。

### 业务模块不要做

- 自己的侧栏、顶栏、折叠条、第二套 layout
- 在 `public/*.html` 里再复制一整页壳
- 改 `public/shared/nav.js` / `layout.css` / `xingmai-logo.png` / `src/modules/home/nav-items.js`
- 改 `src/app.js` / `src/server.js` / `src/boot-dirs.js`
- 给登录页加 `nav.js`
- 空 `files` 全量同步
- 复活已删的 `cursor/home-nav-workbench-e50e` 全页壳（瘦 `app.js`、prefetch 整页、「项目」分组）

### 业务模块要做

- 内容脚本：`public/shared/modules/<id>.js`，挂 `window.XmModules["/<path>"] = { mount, unmount }`
- 自己的 API：`src/modules/<id>/`，前缀 `/api/<id>`
- 自己的样式：只写内容区，颜色用 `--xm-*` 和 `html[data-theme]`
- 交单：`files` 列出路径，`contents` 是路径→正文，模块名填自己

## 已删除：`cursor/home-nav-workbench-e50e`

旧首页样板间已整支删除（远程分支和对应单都关掉了）。那套是仓库根上的全页壳：瘦 `src/app.js`、侧栏写死在 HTML、`prefetch` 整页、「项目」分组。现行壳只在 `apps/xingmai/public/shared/`，不要重建 e50e，不要往仓库根再铺 `public/` `src/`。

## 模块边界

| 模块（交单名） | 可改 | 不可改 |
|---|---|---|
| 主框架 | 壳四件套、`nav-items.js`、内核三件、闸补丁、`auth.js` | 各业务 `public/*.html`、`shared/modules/*.js` |
| 首页 | `shared/modules/home.js`、`src/modules/home/`（除 `nav-items.js`） | 壳、内核、别人的模块。侧栏第一项「首页」，路径 `/home`。不要改 `public/index.html`，`/` 跳 `/home` |
| 数据中心 | `public/data.html`、`public/data*`、`src/modules/data/`、`shared/modules/data.js` | 壳、内核、别人的模块 |
| 沈子晗 | `public/shen.html`、`public/shen*`、`src/modules/shen/`、`shared/modules/shen.js` | 同上 |
| 韩梦凯 | `public/han.html`、`public/han*`、`src/modules/han/`、`shared/modules/han.js` | 同上 |
| 组织中心 | `public/people.html`、`public/people*`、`src/modules/people/`、`shared/modules/people.js` | 同上。侧栏显示「组织中心」，路径仍是 `/people`。旧交单名「人员管理」闸门仍认，新单用「组织中心」 |
| 店铺维护中心 | `public/stores.html`、`public/stores*`、`src/modules/stores/`、`shared/modules/stores.js` | 同上。侧栏一级菜单在「甄选商学院」上面，路径 `/stores`，不要占用 `/data/shops` |
| 甄选商学院 | `public/academy.html`、`public/academy*`、`src/modules/academy/`、`shared/modules/academy.js` | 同上 |
| 甄选智能体 | `public/agents.html`、`public/agents*`、`src/modules/agents/`、`shared/modules/agents.js` | 同上 |
| 版本发布中心 | `public/releases.html`、`releases.css`、`src/modules/releases/`（**补丁**线上闸，禁止用仓库简化 router 整文件覆盖） | 壳、业务模块、线上 `app.js` |
| 个人中心 | `login.html` / `login.css` / `me.html`、`src/modules/profile/`；`home/pages.js` 与 `profile/middleware.js` 必须同单 | 壳；登录页不得加载 `nav.js` |

`nav-items.js` 虽然在 `src/modules/home/`，归属 **主框架**，首页不要交。

主框架已认识：侧栏第一项「首页」`/home`（`/` 跳 `/home`）；「店铺维护中心」`/stores`（在「甄选商学院」上面）；「甄选商学院」带子菜单培训课程 / 培训考试 / 运营手册；「甄选智能体」`/agents`。要再加子菜单或改 `src/app.js` 挂新 API，问主框架，不要自己改壳。

升壳规矩见 [00-shell-bump.md](00-shell-bump.md)。**只有改侧栏/顶栏/`nav.js`/`layout.css`/壳 HTML 才升壳。** 只改 `public/shared/modules/<id>.js` 不要叫主框架升壳。要改子菜单：摘要写「请主框架：……」，让用户把同一句话丢给主框架对话框；主框架自己升壳交单。

## 怎么新建独立对话框并对接

每个新业务面单独开一个 **Cursor Cloud Agent**（新对话），不要挤在主框架或别人的对话框里。

1. 打开 [cursor.com/agents](https://cursor.com/agents) → **New agent**。
2. 仓库选 **同一份** `luocheng526/yunyingbu`，环境和主框架相同。
3. 第一条消息只贴自己的 brief，不要让它改壳：

```
你是独立 Agent「店铺维护中心」。先读 docs/agents/00-module-charter.md 和 docs/agents/10-stores.md。
你只改 stores 目录和 public/shared/modules/stores.js。不要改侧栏、nav.js、src/app.js。
做完用模块名「店铺维护中心」交单，申请人 罗成运营部主脑。
线上登录：罗成 或 luocheng，密码 jingdong220。不要再用演示账号。
侧栏一级菜单「店铺维护中心」已经挂在甄选商学院上面，路径 /stores，API 前缀 /api/stores，内容挂 #xm-content。
```

商学院对话框把上面换成 `08-academy.md`、`academy`、`甄选商学院`。智能体对话框换成 `09-agents.md`、`agents`、`甄选智能体`。

4. 对接方式（已经接好，新对话不用再铺壳）：
   - 登录后点侧栏对应入口 → 主框架 `pushState` → 加载 `public/shared/modules/<id>.js` → `mount(#xm-content)`。
   - API 前缀：`/api/stores`、`/api/academy`、`/api/agents`。仓库入口已挂 stub；线上若还没有，让主框架补 `app.js`，不要自己交内核。
   - 交单：`GET /api/releases/next` → `POST /api/releases`，`module` 填自己的中文名。
5. 主框架认这些名字：章程表、`NAV_MAIN`、`APP_MODULES`、`MODULES`。新对话改内容即可，不用再申请菜单。

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

必须还在：`星脉管理系统`、`https://zx.xingmaierp.cc/login`、`#f7f7f4`、`#14120b`、`html[data-theme="dark"]`、`login-theme`、`localStorage.getItem("xm-theme")`。
本地测试种子仍是 `ChangeMe123!`；线上交单用 `jingdong220`，见 [00-prod-admin.md](00-prod-admin.md)。
`src/app.js` 必须同时有 `attachProfile`、`attachHome`、`createReleasesRouter`、`/api/health`。
登录页 HTML 不得出现 `nav.js`。
