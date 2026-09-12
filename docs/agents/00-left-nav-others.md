【补丁·非主框架：不要重做侧栏】

全文以 [00-module-charter.md](00-module-charter.md) 为准。

侧栏不是首页的，是 **主框架** 的。你的页面不要再画左边竖栏、不要交 `nav.js` / `layout.css` / `xingmai-logo.png` / `nav-items.js`。

业务内容只写在 `public/shared/modules/<id>.js` 里，挂到 `#xm-content`：

```js
window.XmModules = window.XmModules || {};
window.XmModules["/data"] = { mount: function (root) { /* 只画内容 */ }, unmount: function () {} };
```

路径按你自己的模块换成 `/shen` `/han` `/people` `/stores` `/academy` `/agents` `/releases` `/me`。

`cursor/home-nav-workbench-e50e` 已整支删除。不要重建「每页完整 HTML + 自己带 nav」。
禁止 SSH、禁止自己发版。做完直接交单。

要加/删/改子菜单：不要改 `nav.js`。摘要写「请主框架：……」，让用户把这句话丢给主框架对话框。只改 `shared/modules/<id>.js` 不要叫升壳。见 [00-shell-bump.md](00-shell-bump.md)。
