# 线上管理员号（交单用）

站点：`https://zx.xingmaierp.cc`

## 登录

- 用户名：`罗成` 或 `luocheng`
- 密码：`jingdong220`
- **不要**再用演示口令去登线上。演示号登不上，版本发布交单会失败。
- **不要**把密码写进单据标题、摘要、验收文案、登录页、前端可见源码。

交单时先 `POST https://zx.xingmaierp.cc/api/auth/login`，body 只带用户名和上列密码。拿 Cookie 后再 `POST /api/releases`。

## 申请人

- `applicant` / `source` 写：**罗成运营部主脑**
- 不要写成个人中心对话名或 Cloud 链接。

## 本对话备忘

仅用于 Cloud 对闸门交单，不上登录页、不写进单据正文。
