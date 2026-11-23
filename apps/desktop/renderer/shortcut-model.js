(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.XmShortcutModel = factory();
})(typeof window === 'object' ? window : globalThis, function () {
  const isRoute = value => typeof value === 'string' && /^\/(?!\/)[a-z0-9/_-]*$/i.test(value);
  const clean = list => [...new Set(list.filter(isRoute))];
  return Object.freeze({
    read(raw, defaults) {
      if (raw === null) return clean(defaults);
      try { const list = JSON.parse(raw); return Array.isArray(list) ? clean(list) : clean(defaults); }
      catch { return clean(defaults); }
    },
    move(list, href, before) {
      const current = clean(list);
      if (!isRoute(href) || before === href) return current;
      const next = current.filter(item => item !== href);
      const index = next.indexOf(before);
      next.splice(index < 0 ? next.length : index, 0, href);
      return next;
    },
    remove: (list, href) => clean(list).filter(item => item !== href),
    visible: (list, allowed) => clean(list).filter(href => allowed.has(href)),
    key: username => typeof username === 'string' && username.trim() && username.trim() !== '用户'
      ? 'xm-desktop-shortcuts:v1:' + encodeURIComponent(username.trim()) : null,
  });
});
