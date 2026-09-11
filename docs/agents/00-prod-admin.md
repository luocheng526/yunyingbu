# 线上交单登录（全员先读）

`https://zx.xingmaierp.cc` 的版本发布中心**不要用演示账号**。`ChangeMe123!` 现网登不上，单据交不出去。

## 管理员号（只用于线上 `POST /api/auth/login`）

- 用户名：`罗成` 或 `luocheng`
- 密码：`jingdong220`
- 申请人 / source 仍写：`罗成运营部主脑`

本地内存库、自动化测试可以继续用演示口令。不要把线上密码写进单据标题、版本号、`summary`、登录页文案。

## 交单

登录成功拿到 Cookie 后：`GET /api/releases/next` → `POST /api/releases`。纪律见 [00-release-rules.md](00-release-rules.md)。
