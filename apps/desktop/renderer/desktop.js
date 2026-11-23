(function () {
  'use strict';
  if (!window.XmDesktop || document.getElementById('xd-controls')) return;
  const root = document.documentElement;
  root.classList.add('xm-native', 'xm-glass');
  root.dataset.nativeMaterial = window.XmDesktop.material;
  const appUrl=new URL(location.href);appUrl.searchParams.set('app','glass');history.replaceState(history.state,'',appUrl.pathname+appUrl.search+appUrl.hash);
  const login = !!document.querySelector('#login-form');
  const logo = __XM_APP_ICON__;
  document.querySelectorAll('.hero-logo,.xm-logo img').forEach(img=>{img.src=logo;img.alt='甄选未来';img.classList.add('xd-company-logo');});
  if (login) root.classList.add('xm-glass-login');
  const paths = {
    home:'<path d="m3 10 9-7 9 7v10h-6v-7H9v7H3z"/>',
    data:'<path d="M5 20V11m7 9V4m7 16V8"/>',
    work:'<rect x="4" y="6" width="16" height="15" rx="3"/><path d="M9 6V3h6v3M8 12h8m-8 4h5"/>',
    people:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2m1-16a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 5"/>',
    me:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    back:'<path d="m15 5-7 7 7 7"/>',
    minimize:'<path d="M5 12h14"/>',
    maximize:'<rect x="5" y="5" width="14" height="14" rx="2"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    center:'<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M1 12h2m18 0h2M12 1v2m0 18v2"/>',
    edit:'<path d="m4 16 11-11 4 4-11 11H4zM13 7l4 4"/>',
  };
  const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[name]+'</svg>';
  function button(name, symbol, callback) {
    const b=document.createElement('button');b.type='button';b.title=name;b.setAttribute('aria-label',name);b.innerHTML=icon(symbol);b.addEventListener('click',callback);return b;
  }
  const controls=document.createElement('div');controls.id='xd-controls';controls.className='xd-controls';
  controls.append(button('恢复居中大小','center',()=>window.XmDesktop.center()),button('最小化','minimize',()=>window.XmDesktop.minimize()),button('最大化或还原','maximize',()=>window.XmDesktop.maximize()),button('关闭 App','close',()=>window.XmDesktop.close()));
  const top=document.querySelector('.xm-topbar');
  if(top) {
    const brand=document.createElement('img');brand.src=logo;brand.alt='甄选未来';brand.title='甄选未来 App '+window.XmDesktop.version;brand.className='xd-brand-mark';top.prepend(brand);
    top.appendChild(controls);
  }
  else {controls.classList.add('xd-controls-floating');document.body.appendChild(controls);}
  const drag=document.createElement('div');drag.className='xd-drag-strip';drag.setAttribute('aria-hidden','true');document.body.appendChild(drag);

  function permitted(href) {
    return [...document.querySelectorAll('.xm-menu a[href]')].find(a=>{
      if(a.getAttribute('href')!==href||a.closest('[hidden]')||getComputedStyle(a).display==='none')return false;
      for(let p=a.parentElement;p&&!p.classList.contains('xm-sider');p=p.parentElement)if(p.style.display==='none')return false;
      return true;
    });
  }
  function go(href) {
    if(!permitted(href)||typeof window.__xmGo!=='function') return;
    window.__xmGo(href);root.classList.remove('xd-menu-open');sync();
  }
  const options=[{href:'/home',label:'首页',icon:'home'},{href:'/bound',label:'边界数据',icon:'data'},{href:'/data/overview',label:'星脉数据',icon:'data'},{href:'/work',label:'工作汇报',icon:'work'},{href:'/people',label:'组织中心',icon:'people'},{href:'/me',label:'个人中心',icon:'me'}];
  const model=window.XmShortcutModel;
  const defaults=['/home','/data/overview','/work','/me'];
  let rail,dock,railSignature='',dockSignature='',accountKey=null,shortcuts=defaults.slice(),editing=false,pointerDrag=null;
  let contextMenu=null,noticeTimer,skipClickUntil=0;
  const pills=new Map();
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const notice=document.createElement('div');notice.className='xd-shortcut-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  function announce(message){notice.textContent=message;notice.classList.add('is-visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>notice.classList.remove('is-visible'),2400);}
  function catalog(){
    const result=new Map();
    document.querySelectorAll('.xm-menu a[href]').forEach(a=>{
      const href=a.getAttribute('href');if(!permitted(href))return;
      result.set(href,{href,label:a.querySelector('span')?.textContent.trim()||a.textContent.trim(),icon:options.find(x=>x.href===href)?.icon||'grid',source:a});
    });
    return result;
  }
  function readAccount(){
    const user=window.__xmBootUser;
    const key=model.key(user?.username||document.querySelector('#xm-username')?.textContent);
    if(key===accountKey)return;
    accountKey=key;
    let raw=null;try{if(key)raw=localStorage.getItem(key);}catch{}
    shortcuts=model.read(raw,defaults);dockSignature='';
  }
  function save(next,message){
    shortcuts=next;dockSignature='';
    try{if(accountKey)localStorage.setItem(accountKey,JSON.stringify(shortcuts));}
    catch{message+='；当前设备暂时无法保存设置';}
    sync();if(message)announce(message);
  }
  function removeShortcut(href){closeContext();save(model.remove(shortcuts,href),'已从快捷栏移除，左侧菜单仍可使用');}
  function closeContext(){if(contextMenu){contextMenu.remove();contextMenu=null;}}
  function openContext(href,point,trigger){
    if(!shortcuts.includes(href))return;
    closeContext();contextMenu=document.createElement('div');contextMenu.className='xd-shortcut-context';contextMenu.setAttribute('role','menu');
    const remove=button('从快捷栏移除','close',()=>{removeShortcut(href);dock.querySelector('.xd-edit')?.focus();});
    remove.setAttribute('role','menuitem');const label=document.createElement('span');label.textContent='从快捷栏移除';remove.appendChild(label);contextMenu.appendChild(remove);document.body.appendChild(contextMenu);
    const rect=contextMenu.getBoundingClientRect();
    contextMenu.style.left=Math.max(8,Math.min(point.x,innerWidth-rect.width-8))+'px';
    contextMenu.style.top=Math.max(8,Math.min(point.y-rect.height-8,innerHeight-rect.height-8))+'px';
    contextMenu._trigger=trigger;remove.focus();
  }
  function makePill(nav){
    const pill=document.createElement('div');pill.className='xd-liquid-pill';pill.setAttribute('aria-hidden','true');nav.prepend(pill);
    pills.set(nav,{element:pill,rect:null,animation:null});return pill;
  }
  function movePill(nav){
    const state=pills.get(nav);if(!state)return;
    const active=nav.querySelector('[data-href][aria-current="page"]');
    if(!active){state.element.hidden=true;state.rect=null;state.animation?.cancel();return;}
    const target=active.getBoundingClientRect(),base=nav.getBoundingClientRect();
    const next={x:target.left-base.left-nav.clientLeft+nav.scrollLeft,y:target.top-base.top-nav.clientTop+nav.scrollTop,w:target.width,h:target.height};
    let previous=state.rect;state.element.hidden=false;
    if(previous&&Object.keys(next).every(key=>Math.abs(next[key]-previous[key])<.5))return;
    if(previous&&state.animation?.playState==='running'){
      const shown=state.element.getBoundingClientRect();previous={x:shown.left-base.left-nav.clientLeft+nav.scrollLeft,y:shown.top-base.top-nav.clientTop+nav.scrollTop,w:shown.width,h:shown.height};
    }
    state.animation?.cancel();state.rect=next;
    const frame=r=>({left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});
    Object.assign(state.element.style,frame(next));
    if(!previous||reducedMotion.matches)return;
    const dx=next.x-previous.x,dy=next.y-previous.y,horizontal=Math.abs(dx)>=Math.abs(dy);
    const stretch=Math.min(22,Math.hypot(dx,dy)*.16);
    const mid={x:previous.x+dx*.62,y:previous.y+dy*.62,w:next.w,h:next.h};
    if(horizontal){mid.x-=stretch/2;mid.w+=stretch;}else{mid.y-=stretch/2;mid.h+=stretch;}
    const overshoot={...next,x:next.x+dx*.035,y:next.y+dy*.035};
    state.animation=state.element.animate([
      {...frame(previous),offset:0,easing:'cubic-bezier(.3,0,.2,1)'},
      {...frame(mid),offset:.52,easing:'cubic-bezier(.15,.7,.25,1)'},
      {...frame(overshoot),offset:.8,easing:'cubic-bezier(.25,.7,.25,1)'},
      {...frame(next),offset:1},
    ],{duration:440,easing:'linear'});
  }
  function updatePills(){if(rail)movePill(rail);if(dock)movePill(dock);}
  function decorateItem(b,item){
    if(item.source?.querySelector('svg')&&!options.some(x=>x.href===item.href))b.replaceChildren(item.source.querySelector('svg').cloneNode(true));
    b.dataset.href=item.href;b.dataset.label=item.label;b.draggable=false;
    b.addEventListener('click',event=>{if(Date.now()<skipClickUntil){event.stopImmediatePropagation();event.preventDefault();}},true);
  }
  if(!login&&document.querySelector('.xm-shell')) {
    rail=document.createElement('nav');rail.className='xd-rail';rail.setAttribute('aria-label','App 主导航');
    dock=document.createElement('nav');dock.className='xd-dock';dock.setAttribute('aria-label','自定义快捷栏');dock.title='从左侧拖入添加，拖动排序，右键移除';
    document.querySelector('.xm-shell').appendChild(rail);document.body.appendChild(dock);
    document.body.appendChild(notice);makePill(rail);makePill(dock);
    const scrim=button('关闭全部菜单','close',()=>root.classList.remove('xd-menu-open'));
    scrim.className='xd-menu-scrim';document.querySelector('.xm-shell').appendChild(scrim);
    const dragSelector='.xd-rail [data-href],.xd-dock [data-href],.xm-menu a[href]';
    document.addEventListener('dragstart',event=>{if(event.target.closest(dragSelector))event.preventDefault();});
    document.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      const el=event.target.closest(dragSelector);
      const href=el?.dataset.href||el?.getAttribute('href');if(!href||!permitted(href))return;
      pointerDrag={href,el,id:event.pointerId,x:event.clientX,y:event.clientY,active:false,ghost:null};
      el.setPointerCapture(event.pointerId);
    });
    function cleanupDrag(){
      if(pointerDrag){
        if(pointerDrag.active)skipClickUntil=Date.now()+250;
        if(pointerDrag.el.hasPointerCapture(pointerDrag.id))pointerDrag.el.releasePointerCapture(pointerDrag.id);
        pointerDrag.ghost?.remove();pointerDrag=null;
      }
      root.classList.remove('xd-dragging');dock.classList.remove('is-receiving');document.querySelectorAll('.xd-drop-before,.is-dragging').forEach(el=>el.classList.remove('xd-drop-before','is-dragging'));
    }
    function dropBefore(x){return [...dock.querySelectorAll('.xd-shortcut')].find(el=>x<el.getBoundingClientRect().left+el.getBoundingClientRect().width/2)?.dataset.shortcut||null;}
    function overDock(event){const r=dock.getBoundingClientRect();return event.clientX>=r.left-8&&event.clientX<=r.right+8&&event.clientY>=r.top-12&&event.clientY<=r.bottom+8;}
    document.addEventListener('pointermove',event=>{
      if(!pointerDrag||pointerDrag.id!==event.pointerId)return;
      if(!pointerDrag.active&&Math.hypot(event.clientX-pointerDrag.x,event.clientY-pointerDrag.y)<7)return;
      event.preventDefault();
      if(!pointerDrag.active){
        pointerDrag.active=true;closeContext();root.classList.add('xd-dragging');dock.classList.add('is-receiving');pointerDrag.el.classList.add('is-dragging');
        const ghost=document.createElement('div');ghost.className='xd-drag-ghost';ghost.textContent=catalog().get(pointerDrag.href)?.label||'快捷入口';document.body.appendChild(ghost);pointerDrag.ghost=ghost;
      }
      pointerDrag.ghost.style.transform=`translate(${event.clientX+12}px,${event.clientY-35}px)`;
      const before=dropBefore(event.clientX);dock.querySelectorAll('.xd-shortcut').forEach(el=>el.classList.toggle('xd-drop-before',el.dataset.shortcut===before));
      const rect=dock.getBoundingClientRect();if(event.clientX>rect.right-35)dock.scrollLeft+=12;else if(event.clientX<rect.left+35)dock.scrollLeft-=12;
    },{passive:false});
    document.addEventListener('pointerup',event=>{
      if(!pointerDrag||pointerDrag.id!==event.pointerId)return;
      const href=pointerDrag.href,shouldDrop=pointerDrag.active&&overDock(event)&&permitted(href);
      if(pointerDrag.active){event.preventDefault();event.stopPropagation();}
      const before=dropBefore(event.clientX);cleanupDrag();
      if(shouldDrop){const existed=shortcuts.includes(href);save(model.move(shortcuts,href,before),existed?'快捷栏顺序已保存':'已添加到快捷栏');root.classList.remove('xd-menu-open');}
    });
    document.addEventListener('pointercancel',cleanupDrag);
    window.addEventListener('blur',cleanupDrag);
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&pointerDrag)cleanupDrag();});
    document.addEventListener('click',event=>{if(Date.now()<skipClickUntil&&event.target.closest(dragSelector)){event.preventDefault();event.stopImmediatePropagation();}},true);
    dock.addEventListener('contextmenu',event=>{
      const b=event.target.closest('[data-href]');if(!b)return;event.preventDefault();openContext(b.dataset.href,{x:event.clientX,y:event.clientY},b);
    });
    dock.addEventListener('keydown',event=>{
      const b=event.target.closest('[data-href]');if(!b)return;
      if(event.key==='Delete'&&editing){event.preventDefault();removeShortcut(b.dataset.href);dock.querySelector('.xd-edit')?.focus();}
      if(event.key==='F10'&&event.shiftKey){event.preventDefault();const rect=b.getBoundingClientRect();openContext(b.dataset.href,{x:rect.left,y:rect.top},b);}
    });
    new ResizeObserver(()=>requestAnimationFrame(updatePills)).observe(dock);
    new ResizeObserver(()=>requestAnimationFrame(updatePills)).observe(rail);
    window.addEventListener('resize',updatePills);
  }
  function sync() {
    if(!rail) return;
    readAccount();const allItems=catalog();const available=options.filter(x=>allItems.has(x.href));
    const next=available.map(x=>x.href).join('|');
    if(next!==railSignature) {
      railSignature=next;rail.replaceChildren(pills.get(rail).element);
      available.forEach(item=>{
        const b=button(item.label,item.icon,()=>go(item.href));decorateItem(b,item);rail.appendChild(b);
      });
      rail.appendChild(button('全部功能','grid',()=>root.classList.toggle('xd-menu-open')));
    }
    const visible=model.visible(shortcuts,new Set(allItems.keys()));
    const nextDock=JSON.stringify([visible.map(href=>[href,allItems.get(href).label]),editing]);
    if(nextDock!==dockSignature){
      dockSignature=nextDock;dock.replaceChildren(pills.get(dock).element);dock.classList.toggle('is-editing',editing);
      visible.forEach(href=>{
        const item=allItems.get(href),wrap=document.createElement('div');wrap.className='xd-shortcut';wrap.dataset.shortcut=href;
        const b=button(item.label,item.icon,()=>go(href));decorateItem(b,item);
        const label=document.createElement('span');label.textContent=item.label;b.appendChild(label);wrap.appendChild(b);
        const remove=button('移除'+item.label+'快捷入口','close',()=>removeShortcut(href));remove.className='xd-shortcut-remove';remove.hidden=!editing;wrap.appendChild(remove);dock.appendChild(wrap);
      });
      if(!visible.length){const hint=document.createElement('span');hint.className='xd-shortcut-empty';hint.textContent='从左侧拖入快捷入口';dock.appendChild(hint);}
      const all=button('全部功能','grid',()=>root.classList.toggle('xd-menu-open'));all.className='xd-all';const label=document.createElement('span');label.textContent='全部';all.appendChild(label);dock.appendChild(all);
      const edit=button(editing?'完成编辑':'编辑快捷栏','edit',()=>{editing=!editing;closeContext();sync();if(editing)announce('拖动调整顺序，点 × 移除快捷入口');});edit.className='xd-edit';edit.setAttribute('aria-pressed',String(editing));dock.appendChild(edit);
    }
    document.querySelectorAll('.xd-rail [data-href],.xd-dock [data-href]').forEach(b=>b.setAttribute('aria-current',location.pathname===b.dataset.href?'page':'false'));
    updatePills();
    const title=document.querySelector('.xm-tab.is-active .xm-tab-label')?.textContent||document.querySelector('.xm-menu a.is-active')?.textContent||'工作台';
    const heading=document.querySelector('.xg-heading h1');if(heading) heading.textContent=title.trim()==='首页'?'经营总览':title.trim();
  }
  let pending=false;
  function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;sync();});}
  const menu=document.querySelector('.xm-sider');
  if(menu)new MutationObserver(schedule).observe(menu,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','style']});
  document.addEventListener('click',event=>{if(event.target.closest('.xm-sider a[href]'))root.classList.remove('xd-menu-open');if(contextMenu&&!contextMenu.contains(event.target))closeContext();schedule();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){const trigger=contextMenu?._trigger;closeContext();trigger?.focus();root.classList.remove('xd-menu-open');if(editing){editing=false;sync();}}});
  window.addEventListener('popstate',schedule);
  sync();
})();
