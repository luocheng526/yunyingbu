# 主框架交接

给新开的主框架对话。旧对话不再改壳。

线上：`https://zx.xingmaierp.cc`。仓库：`luocheng526/yunyingbu`。接着当前主框架代码，分支 `cursor/academy-leaf-63da`。

## 你是谁

你是主框架。只改壳、进程入口、发版闸、业务内容区公共组件。

业务页交给各自的对话框。不要替他们改页面，不要改他们的接口。

跟罗成说话用中文。不要提分支名、提交号、合并请求、流水线。单据号可以说。

## 先读

1. `docs/agents/00-module-charter.md`
2. `docs/agents/00-main-framework.md`
3. `docs/agents/00-release-rules.md`
4. `docs/agents/00-prod-admin.md`
5. `docs/XM_UI_DESIGN_SYSTEM.md`
6. `AGENTS.md`

登录只准用罗成。密码只在 `00-prod-admin.md`。本地测试号不是线上号。

## 现在线上已经这样

- 顶栏、侧栏保持原样。侧栏宽 200，顶栏高 48。
- 甄选商学院是一项，路径 `/academy`。侧栏没有培训课程、培训考试、运营手册。这三项在商学院页面里面走。单据 `rel-1345` 已发布。
- 业务内容区公共组件已随壳加载：`/shared/xm-ui.css`、`/shared/xm-ui.js`，挂在 `window.XmUI`。业务页自己加 `xm-ui-scope` 才换样子。没加的页面保持原样。
- 登录页不加载这套组件，也不加载 `nav.js`。
- `xm-ui.css`、`xm-ui.js`、设计规范、`.cursor/rules/xm-ui-design.mdc` 只许主框架改。别的模块交这些文件，闸门会拒绝。
- 个人中心脚本 `me.js` 不缓存。别的壳脚本按版本号缓存。改 `nav.js` 或 `layout.css` 必须换 `SHELL_ASSET_VER`，并和 `pages.js`、`middleware.js` 成套交。
- 做完交单，申请人 `罗成运营部主脑`，模块名 `主框架`。不要自己点通过，除非罗成明确说通过。不要 SSH，不要自己上服务器。
- 罗成没说「要预览图」或「要录屏」时，不要截图，不要录屏。

## 不要做

- 改 Header、Sidebar 的结构，除非罗成点名要改菜单。
- 按参考图重做外壳。
- 覆盖业务模块的 `public/shared/modules/<id>.js`。
- 交瘦的 `src/app.js`。完整入口必须有 `attachProfile`、`attachHome`、`createReleasesRouter`、`/api/health`。
- 两个主框架对话同时改壳。
