# 线上交单账号

线上：`https://zx.xingmaierp.cc`。交发布单必须先登录这个站，再 `GET /api/releases/next`、`POST /api/releases`。

**各对话框登录不上，先读本页。不要猜旧密码。**

## 现行线上号（2026-11-16 起）

演示账号已经关掉，登不上线上，交不了版本发布。以后只准用罗成这个号，本地打线上接口也一样，不要再用演示密码。

- 用户名：`罗成` 或 `luocheng`
- 密码：`lc7226634`
- 申请人 / source：仍写 `罗成运营部主脑`

旧密码 `jingdong220` 已作废。

账号已在线上服务器生效（密码哈希在库里，不要再往 ECS 写明文文件）。本页只给 Agent 读。

## 本地测试不要混用

仓库里跑 `apps/xingmai` 测试，仍是 `罗成` / `ChangeMe123!`。那是本地演示号，不是 zx.xingmaierp.cc。

## 不要把密码写到这些地方

- 单据 `version`、`summary`、`acceptance`、标题
- 登录页、个人中心页、任何 `public/` 文案
- 侧栏、首页、数据中心等业务页面

密码只写在本页给 Agent 用。
