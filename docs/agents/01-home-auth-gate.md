【补丁·首页——登录不归你】

仍有效的部分：登录页和鉴权由个人中心做。首页不要在 `public/index.html` 画用户名密码表单。未登录打开 `/` 应被送到 `/login`。

已过期的部分：导航壳不归首页，归主框架。顶栏不要再做「退出」「暗色」。见 [00-module-charter.md](00-module-charter.md) 和 [01-home.md](01-home.md)。
