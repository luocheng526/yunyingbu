(function () {
  'use strict';
  if (!window.XmDesktop || document.getElementById('xd-table-nav')) return;
  const workspace = document.querySelector('.xm-workspace');
  if (!workspace) return;
  const root = document.documentElement;
  const entries = new Map();
  let scheduled = false, active = null, discoverNeeded = true;
  const nav = document.createElement('div');
  nav.id = 'xd-table-nav'; nav.className = 'xd-table-nav'; nav.hidden = true;
  nav.setAttribute('role', 'group'); nav.setAttribute('aria-label', '表格横向浏览');
  const label = document.createElement('span'); label.className = 'xd-table-nav-label';
  const range = document.createElement('input'); range.type = 'range'; range.min = '0'; range.step = '1';
  range.setAttribute('aria-label', '表格横向位置');
  function scrollTo(left) { if (active) { active.host.scrollLeft = left; schedule(); } }
  function action(name, text, run) {
    const b = document.createElement('button'); b.type = 'button'; b.title = name;
    b.setAttribute('aria-label', name); b.textContent = text; b.addEventListener('click', run); return b;
  }
  const first = action('查看最左列', '«', () => scrollTo(0));
  const prev = action('向左查看列', '‹', () => { if (active) scrollTo(active.host.scrollLeft - active.host.clientWidth * .7); });
  const next = action('向右查看列', '›', () => { if (active) scrollTo(active.host.scrollLeft + active.host.clientWidth * .7); });
  const last = action('查看最右列', '»', () => { if (active) scrollTo(active.host.scrollWidth); });
  range.addEventListener('input', () => scrollTo(Number(range.value)));
  nav.append(label, first, prev, range, next, last); document.body.appendChild(nav);
  const resize = new ResizeObserver(() => schedule());
  resize.observe(workspace);
  const liveWidths = { rank:44, shop:164, feeWarn:94, feeGoal:124, liveAt:144, liveOn:90 };
  function fitLiveTable(table) {
    if (!table.closest('.xm-hm-live')) return;
    // A user-resized table has explicit min/max widths. Respect that preference.
    if (table.style.maxWidth) { table.classList.remove('xd-fit-table'); return; }
    const heads = [...table.querySelectorAll('thead th[data-live-col]')];
    const cols = [...table.querySelectorAll('colgroup col')];
    if (!heads.length || heads.length !== cols.length) return;
    let min = 0;
    heads.forEach((head, i) => {
      const width = liveWidths[head.dataset.liveCol] || 82;
      min += width; cols[i].style.setProperty('--xd-col-width', width + 'px');
    });
    table.style.setProperty('--xd-table-min', min + 'px'); table.classList.add('xd-fit-table');
  }
  function discover() {
    for (const [table, entry] of entries) {
      if (!table.isConnected || !entry.host.isConnected) {
        resize.unobserve(table); resize.unobserve(entry.host); entry.manual.disconnect(); entries.delete(table);
      }
    }
    workspace.querySelectorAll('table').forEach(table => {
      if (table.closest('table table') || table.getAttribute('role') === 'presentation') return;
      fitLiveTable(table);
      if (entries.has(table)) return;
      let host = table.parentElement;
      // Reuse dedicated existing containers so module listeners and selectors keep working.
      if (!host.matches('.xm-hm-panel,.org-table-wrap,.wc-table-wrap,.xm-ui-table-wrap,.bd-table-wrap,.table-wrap,.table-wrapper,.xd-table-viewport') &&
          !(host.children.length === 1 && host.tagName === 'DIV')) {
        host = document.createElement('div'); host.className = 'xd-table-wrapper';
        table.before(host); host.appendChild(table);
      }
      host.classList.add('xd-table-viewport');
      if (!host.hasAttribute('tabindex')) host.tabIndex = 0;
      if (!host.hasAttribute('role')) host.setAttribute('role', 'region');
      if (!host.hasAttribute('aria-label')) host.setAttribute('aria-label', '数据表格，可左右滚动查看全部列');
      host.addEventListener('keydown', event => {
        if (event.target !== host) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); host.scrollLeft += event.key === 'ArrowLeft' ? -100 : 100;
        }
      });
      const manual = new MutationObserver(() => {
        if (table.style.maxWidth && table.classList.contains('xd-fit-table')) table.classList.remove('xd-fit-table');
        schedule();
      });
      manual.observe(table, {attributes:true, attributeFilter:['style']});
      entries.set(table, {table, host, manual}); resize.observe(host); resize.observe(table);
    });
  }
  function update() {
    if (discoverNeeded) { discoverNeeded = false; discover(); }
    const pane = workspace.querySelector('.xm-pane.is-active') || document.getElementById('xm-content');
    const wide = [...entries.values()].filter(({table, host}) => pane?.contains(table) && host.clientWidth > 0 && host.scrollWidth > host.clientWidth + 2);
    root.classList.toggle('xd-has-wide-table', wide.length > 0);
    if (!pane) { active = null; nav.hidden = true; return; }
    if (!pane.hasAttribute('tabindex')) pane.tabIndex = 0;
    const p = pane.getBoundingClientRect();
    let best = null, score = 0;
    wide.forEach(entry => {
      const r = entry.table.getBoundingClientRect();
      const visible = Math.max(0, Math.min(r.bottom, p.bottom) - Math.max(r.top, p.top));
      if (visible > score) { best = entry; score = visible; }
    });
    active = best;
    const modalVisible = [...document.querySelectorAll('dialog[open],.org-modal.show,.work-modal:not([hidden])')]
      .some(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    nav.hidden = !active || score < 24 || modalVisible;
    if (nav.hidden) return;
    nav.style.left = Math.max(p.left, 8) + 'px';
    nav.style.top = (p.bottom + 4) + 'px';
    nav.style.width = Math.max(0, Math.min(p.right, innerWidth - 8) - Math.max(p.left, 8)) + 'px';
    const max = Math.max(0, active.host.scrollWidth - active.host.clientWidth);
    const left = Math.max(0, Math.min(max, active.host.scrollLeft));
    range.max = String(max); range.value = String(left);
    range.setAttribute('aria-valuetext', left <= 1 ? '已到最左侧' : left >= max - 1 ? '已到最右侧' : '横向位置 ' + Math.round(left / max * 100) + '%');
    first.disabled = prev.disabled = left <= 1;
    last.disabled = next.disabled = left >= max - 1;
    label.textContent = left <= 1 ? '右侧还有列 · 拖动查看' : left >= max - 1 ? '已到最右侧' : '左右拖动查看全部列';
  }
  function schedule(discoverMore = false) {
    if (discoverMore === true) discoverNeeded = true;
    if (scheduled) return;
    scheduled = true; requestAnimationFrame(() => { scheduled = false; update(); });
  }
  // Business modules replace tables during filtering, refresh and navigation.
  new MutationObserver(mutations => {
    if (mutations.some(m => m.type === 'childList')) schedule(true);
    else schedule();
  }).observe(workspace, {childList:true, subtree:true, attributes:true, attributeFilter:['hidden','class']});
  document.addEventListener('scroll', () => schedule(), {capture:true, passive:true});
  window.addEventListener('resize', () => schedule());
  window.addEventListener('popstate', () => schedule(true));
  schedule(true);
})();
