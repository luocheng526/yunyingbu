# 线上交单账号

线上：`https://zx.xingmaierp.cc`。交发布单必须先登录这个站，再 `GET /api/releases/next`、`POST /api/releases`。

## 用管理员号，不用演示号

演示密码登不上线上，交不了版本发布。各模块交单一律用管理员：

- 用户名：`罗成` 或 `luocheng`
- 密码：`jingdong220`
- 申请人 / source：仍写 `罗成运营部主脑`

本地内存库、自测登录可以继续用演示号。只有打 `zx.xingmaierp.cc` 时换管理员号。

## 不要把密码写到这些地方

- 单据 `version`、`summary`、`acceptance`、标题
- 登录页、个人中心页、任何 `public/` 文案
- 侧栏、首页、数据中心等业务页面

密码只写在本页给 Agent 用。
