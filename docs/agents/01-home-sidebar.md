【首页·改成左导航后台布局（对照星脉管理系统截图）】

只在 Cursor Cloud 改 apps/xingmai/（或 /opt 对应文件的仓库副本）。禁止 SSH、禁止 restart。做完输出【发布文档】，等主脑交给版本发布中心发版。

【和谁分工】
- 你（首页）：全站壳。左侧导航 + 顶栏 + 右侧内容区。首页 `/` 右侧做成截图那种数据看板（指标卡+趋势+榜单可用演示数据）。
- 数据中心：继续拥有 /data 和 /api/data/overview。首页右侧优先 GET /api/data/overview，没有则用演示数字，不要改 data 模块业务文件。
- 其他模块：不要自己再做顶栏导航；引入你提供的 shared 壳即可。

【视觉（必须像截图）】
- 左侧固定白底竖向菜单；最上 logo +「星脉管理系统」
- 右侧浅灰底；上方细顶栏：折叠侧栏按钮、页签（当前「首页」红色/高亮）、右侧用户名/退出（退出走 POST /api/auth/logout）
- 右侧主体：多张 KPI 白卡片（大数字+涨跌百分比）网格；下方「趋势看板」条形图；右侧「实时销售指数」「龙虎榜」列表（第一期演示数据，标明演示）
- 登录页 /login 不要套这套后台壳

【左侧菜单用我们的，不要截图里的商品/订单】
一级：
1. 首页 → /
2. 数据中心 → /data
3. 运营中心 ▾
   - 沈子晗运营中心 → /shen
   - 韩梦凯运营中心 → /han
4. 人员管理 → /people
5. 版本发布中心 → /releases
6. 个人中心 → /me
可折叠子菜单。当前页高亮。

【你改的文件】
- apps/xingmai/public/shared/layout.css（改成左导航，可废弃顶栏主导航）
- apps/xingmai/public/shared/nav.js
- apps/xingmai/public/index.html（右侧看板）
- apps/xingmai/src/modules/home/nav-items.js（树形菜单）
不要改 login.html、不要改其他模块 html 的业务区（他们只要能引用 shared 即可；占位页也要用新壳）。

【验收】
登录后 / 是左菜单+右数据，不是顶上一排链接。点「运营中心」能展开两个运营中心。未登录仍去 /login。

做完贴出【发布文档】。
