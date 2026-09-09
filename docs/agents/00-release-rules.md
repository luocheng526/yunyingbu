# 版本发布纪律（现行，以线上闸门为准）

摘自线上闸与 [00-module-charter.md](00-module-charter.md)。各板块 md 必须写进同一套，不得再用自制号或插队。

## 角色

- 调度：罗成，运营部主脑。主脑不是第二套发版按钮。
- 闸门：版本发布中心。全站**唯一**允许真正发版的对话。它不是第二主脑，不改首页/登录/人员等业务。
- **主框架**：只交壳四件套、内核三件、闸补丁。侧栏由主框架交付，不是首页。
- 各板块：只改自己的目录和 `public/shared/modules/<自己>.js`，做完后 `POST /api/releases` 交单，然后等网页「通过」。
- 自测通过后立刻交单，**图形 / 布局 / 视觉改动同样交**，不要等用户再单独说「提交」。
- 现行是嵌入式：业务内容挂 `#xm-content`，不要每人再画一套侧栏。

## 闸门只执行这些

- 各板块交来的单据
- 本页点「通过」
- 主脑对本闸门的明确口令

## 闸门拒绝这些

- 其它对话框说「帮我上线」
- 改首页 / 登录 / 人员等别人的业务
- 多单同时发
- 跳过队首点通过
- 上移 / 下移（接口 409）

## 排队

- 入队按**提交时间**，先交先排。
- **禁止上移 / 下移**。
- 闸门只允许通过**第 1 位**，点一单发一单。
- 下一条不会自动发。
- 只改页面或测试：**不要重启**进程。改了 `src/` 运行时代码才重启。

## 版本号（全站一条号）

- 格式：`0.1.N-说明`（N 为数字，说明用字母数字和 `._-`）。
- **由闸门发放，各模块不得自领。** 禁止自己写 `0.3.x`、`ui-xxx`、`shen-0.1.1` 这种旁支号。
- 交单前先 `GET /api/releases/next`（须登录）。返回里的 `seq` 是下一个 N，`version` 形如 `0.1.23-next`。你只把 `-next` 换成本单说明，例如 `0.1.23-data-kpi`。
- **同一 N 全站占用**，不能跨模块再用。
- 失败 / 驳回**不占号**，成功才占号。
- 成功单可按快照回滚。

## 交单

```
POST /api/releases
Cookie: 登录会话
{
  "version": "0.1.N-说明",
  "applicant": "罗成运营部主脑",
  "source": "罗成运营部主脑",
  "module": "主框架|首页|数据中心|沈子晗|韩梦凯|人员管理|甄选商学院|甄选智能体|版本发布中心|个人中心",
  "summary": "更新了什么",
  "files": ["public/...", "src/..."],
  "contents": { "public/...": "文件正文", "src/...": "文件正文" },
  "acceptance": "上线后怎么验",
  "restart": true
}
```

- 文件路径相对 `apps/xingmai/`，**不要**写 `apps/xingmai/` 前缀。
- 只允许：`public/`、`src/`、`test/`、`package.json`、`package-lock.json`。文档改动不走闸。
- `contents` 是「路径 → 正文」。`files` 是路径字符串列表。
- **主框架可以新建目录。** 交单可带新路径。闸门写入源目录和落地时会 `mkdir` 父目录。
- 禁止 SSH、禁止 `push-xingmai-to-ecs.sh`、禁止 `systemctl restart`、禁止自己覆盖 `/opt/mengkai`。
- **禁止瘦 `src/app.js`。** 非主框架不得把 `src/app.js` 写进 `files`。完整入口必须含 `attachProfile`、`attachHome`、`createReleasesRouter`、`/api/health`。点「通过」时再验一遍。
- **禁止空 `files` 全量落地。**
- **壳只由主框架交。** `public/shared/nav.js`、`public/shared/layout.css`、`public/shared/xingmai-logo.png`、`src/modules/home/nav-items.js`。
- **内核只由主框架交。** `src/app.js`、`src/server.js`、`src/boot-dirs.js`。
- **`src/modules/profile/auth.js` 只许主框架或个人中心。**
- **`src/modules/home/pages.js` 与 `src/modules/profile/middleware.js` 必须成套提交。**
- 不要点「通过」**rel-131**。

## 网页

站点：`https://zx.xingmaierp.cc/releases`  
待上线默认不自动刷新，要看最新点「刷新」。点「通过」才落地。
