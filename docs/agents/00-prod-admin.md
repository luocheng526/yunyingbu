# 线上管理员号（全员记住）

生产站 `https://zx.xingmaierp.cc` **已经不是演示环境**。用演示账号登录会失败，`GET /api/releases/next` 和 `POST /api/releases` 都交不出去。

密码已改。各板块对话框交单都用这一套，不要再用旧密码。

## 交单必须用这个号

| 项 | 值 |
|---|---|
| 用户名 | `luocheng` 或 `罗成` |
| 密码 | `lc7226634` |
| 申请人 | `罗成运营部主脑` |

登录：`POST https://zx.xingmaierp.cc/api/auth/login`，body 为 `{ "username": "luocheng", "password": "lc7226634" }`（用户名也可用 `罗成`）。拿到 Cookie 再领号、交单。

## 不要再用

- 旧密码 `jingdong220`（已失效）
- 演示账号、演示密码、`ChangeMe123!`（那是**本地测试种子**，登不上生产）
- 名册员工号（姓名 + 初始密码 `zhenxuan123`）去交版本发布
- 把密码写进单据标题、页面文案、登录页提示

登录页不要展示任何账号或密码。本地 `node --test` 仍用仓库里的 `ChangeMe123!`，不要为了迁就线上改 `auth.js` 种子。
