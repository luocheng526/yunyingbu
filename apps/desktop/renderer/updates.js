(function () {
  'use strict';
  const api = window.XmDesktop?.updates;
  if (!api || document.getElementById('xd-update-entry')) return;
  const entry = document.createElement('button');
  entry.id = 'xd-update-entry'; entry.type = 'button'; entry.textContent = 'App 更新';
  entry.setAttribute('aria-haspopup','dialog');
  const controls = document.getElementById('xd-controls');
  if (controls) controls.prepend(entry); else return;
  const panel = document.createElement('dialog'); panel.id = 'xd-update-dialog';
  panel.setAttribute('aria-labelledby','xd-update-title');
  panel.innerHTML = '<button type="button" class="xd-update-close" aria-label="关闭版本更新">×</button><p class="xd-update-eyebrow">甄选未来 · APP</p><h2 id="xd-update-title">App 版本更新</h2><p class="xd-update-version"></p><div class="xd-update-status" role="status" aria-live="polite"></div><ul class="xd-update-notes"></ul><div class="xd-update-progress"><progress max="100" value="0" aria-label="更新下载进度"></progress><span></span></div><p class="xd-update-hint"></p><div class="xd-update-actions"><button type="button" class="xd-update-check">检查更新</button><button type="button" class="xd-update-cancel">取消下载</button><button type="button" class="xd-update-primary">下载更新</button></div>';
  document.body.appendChild(panel);
  const toast = document.createElement('button'); toast.type='button'; toast.className='xd-update-toast'; toast.hidden=true;
  document.body.appendChild(toast);
  const find = selector => panel.querySelector(selector);
  const primary = find('.xd-update-primary'), check = find('.xd-update-check'), cancel = find('.xd-update-cancel');
  let state, notifiedVersion, toastTimer;
  const show = () => { toast.hidden=true; if(!panel.open) panel.showModal(); };
  entry.addEventListener('click',()=>{show(); if(state && ['idle','current','error'].includes(state.status)) run(()=>api.check());});
  toast.addEventListener('click',show);
  find('.xd-update-close').addEventListener('click',()=>panel.close());
  panel.addEventListener('close',()=>entry.focus());
  check.addEventListener('click',()=>run(()=>api.check()));
  cancel.addEventListener('click',()=>run(()=>api.cancel()));
  primary.addEventListener('click',()=>run(()=>state?.status==='ready'?api.install():api.download()));
  async function run(action) {
    try { render(await action()); }
    catch { find('.xd-update-status').textContent='操作未完成，请稍后重试'; }
  }
  function render(next) {
    if(!next) return;
    state=next;
    const {status,update,currentVersion,progress,message,supported} = state;
    const available = !!update;
    const busy = ['checking','downloading','installing'].includes(status);
    entry.textContent=status==='downloading'?`更新 ${progress}%`:status==='ready'?'重启更新':available?'发现新版':'App 更新';
    entry.classList.toggle('has-update',available);
    entry.title='App 版本更新 · 当前 '+currentVersion+(update?' · 新版 '+update.version:'');
    find('.xd-update-version').textContent='当前版本 '+currentVersion+(update?'   →   新版本 '+update.version:'');
    const messages={idle:'可以在这里检查 App 的新版本',checking:'正在检查新版本…',current:'已经是最新版本',available:'发现新版本',downloading:'正在下载更新，可以继续使用 App',ready:'下载完成，更新包已校验',installing:'正在准备重启更新…',unsupported:'当前平台暂不支持 App 内更新',error:message||'暂时无法检查更新'};
    find('.xd-update-status').textContent=status==='ready'&&message?message:(messages[status]||message);
    const list = find('.xd-update-notes'); list.replaceChildren();
    (update?.notes||[]).forEach(note=>{const li=document.createElement('li');li.textContent=note;list.appendChild(li);});
    list.hidden=!update?.notes?.length;
    find('.xd-update-progress').hidden=!['downloading','ready'].includes(status);
    find('progress').value=progress; find('.xd-update-progress span').textContent=progress+'%';
    find('.xd-update-hint').textContent=available?'下载不会中断工作。重启更新前请先保存正在编辑的内容，账号和快捷菜单设置会保留。':'业务数据与网站同步；这里更新 App 的界面和桌面功能。';
    check.hidden=!supported || status==='ready'; check.disabled=busy;
    cancel.hidden=status!=='downloading';
    primary.hidden=!available || ['checking','downloading'].includes(status);
    primary.disabled=status==='installing';
    primary.textContent=status==='ready'?'重启并更新':status==='installing'?'正在更新…':status==='error'&&state.phase==='download'?'重新下载':'下载更新';
    if(status==='available' && update.version!==notifiedVersion) {
      notifiedVersion=update.version;
      let seen=false;
      try { seen=localStorage.getItem('xm-app-update-notified')===update.version; localStorage.setItem('xm-app-update-notified',update.version); } catch {}
      if(!seen && !panel.open) {
        toast.textContent='App 有新版本 '+update.version+' · 查看更新'; toast.hidden=false;
        clearTimeout(toastTimer); toastTimer=setTimeout(()=>{toast.hidden=true;},12000);
      }
    }
  }
  const unsubscribe = api.onState(render);
  window.addEventListener('pagehide',()=>{unsubscribe();clearTimeout(toastTimer);},{once:true});
  run(()=>api.state());
})();
