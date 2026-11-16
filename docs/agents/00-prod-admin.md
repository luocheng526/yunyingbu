# 线上管理员号（交单用）

站点：`https://zx.xingmaierp.cc`

## 登录

- 用户名：`luocheng`（也可用 `罗成`）
- 密码：`lc7226634`
- **不要**再用演示口令去登线上。演示号登不上，版本发布交单会失败。
- **不要**把密码写进单据标题、摘要、验收文案、登录页、前端可见源码。

交单时先 `POST https://zx.xingmaierp.cc/api/auth/login`，body 只带用户名和上列密码。拿 Cookie 后再 `POST /api/releases`。

## 申请人 / 交单

- `module` 写：**个人中心**
- `applicant` / `source` 写：**罗成运营部主脑**
- 不要写成个人中心对话名或 Cloud 链接。

## 纪律

- **登录不要改成钉钉 SSO。** 继续用户名 + 密码走 `POST /api/auth/login`。
- **登录页仍不加载 `nav.js`。** 只保留 `login.html` / `login.css` 和页内脚本，不要挂壳导航。
- **智能人事的钉钉对接不归本对话。** 不改人事模块、不接钉钉扫码/免登。
- **登录不上先读本文档**，用上面的管理员号交单；不要把密码写进登录页或单据正文。

## 本对话备忘

仅用于 Cloud 对闸门交单，不上登录页、不写进单据正文。

## 升壳

`/me` 由主框架壳挂载 `/shared/modules/me.js`。个人中心只交模块和接口，**不改** `nav.js` / `layout.css` / `nav-items.js` / 壳 HTML。

需要用户立刻看到新 `me.js` 时（壳对 `/shared` 有长缓存，或 `me.js` 没带 `?v=`），**只给主框架说一声**，请它升 `SHELL_ASSET_VER` 并给 `me.js` 加上与 `nav.js` 相同的 `?v=`。不要自己改壳，也不要指挥其它板块。
