【补丁·非主框架：不要重做侧栏】

全文以 [00-module-charter.md](00-module-charter.md) 为准。

侧栏不是首页的，是 **主框架** 的。你的页面不要再画左边竖栏、不要交 `nav.js` / `layout.css` / `xingmai-logo.png` / `nav-items.js`。

业务内容只写在 `public/shared/modules/<id>.js` 里，挂到 `#xm-content`：

```js
window.XmModules = window.XmModules || {};
window.XmModules["/data"] = { mount: function (root) { /* 只画内容 */ }, unmount: function () {} };
```

路径按你自己的模块换成 `/shen` `/han` `/people` `/releases` `/me`。

不要从 `cursor/home-nav-workbench-e50e` 抄「每页完整 HTML + 自己带 nav」。那是旧全页壳，不是现在的嵌入式。
禁止 SSH、禁止自己发版。做完直接交单。
