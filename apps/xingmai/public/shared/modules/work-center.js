/* Work center V2. Embedded in the existing /work shell. */
(function(){
  'use strict';
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const btn=(label,action,cls='',extra='')=>`<button type="button" class="wc-btn ${cls}" data-action="${action}" ${extra}>${esc(label)}</button>`;
  const link=(label,action,id)=>`<button type="button" class="wc-link" data-action="${action}" data-id="${esc(id)}">${esc(label)}</button>`;
  const badge=(label,tone='')=>`<span class="wc-badge ${tone}">${esc(label)}</span>`;
  const status=s=>badge(s,['已完成','已提交','已解决'].includes(s)?'green':['未提交','已退回','已取消'].includes(s)?'red':s==='迟交'?'orange':['进行中','待验收'].includes(s)?'blue':'');
  const percent=n=>n==null?'—':n+'%';
  const when=v=>v?(/Z$/.test(v)?new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):v.replace('T',' ')):'—';
  const empty=(title,detail='')=>`<div class="wc-empty"><strong>${esc(title)}</strong>${esc(detail)}</div>`;
  const card=(title,body,actions='',heading='h2')=>`<section class="wc-card"><div class="wc-card-head"><${heading}>${esc(title)}</${heading}><div class="wc-actions">${actions}</div></div>${body}</section>`;
  const field=(label,name,type='text',value='',full=false,extra='')=>`<label class="wc-field ${full?'full':''}"><span>${esc(label)}</span>${type==='textarea'?`<textarea name="${esc(name)}" ${extra}>${esc(value)}</textarea>`:`<input name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}>`}</label>`;
  const opts=(rows,value='',blank='全部')=>`${blank!=null?`<option value="">${esc(blank)}</option>`:''}${rows.map(r=>{const id=typeof r==='string'?r:r.id,label=typeof r==='string'?r:r.name;return `<option value="${esc(id)}" ${String(value)===String(id)?'selected':''}>${esc(label)}</option>`;}).join('')}`;
  const select=(label,name,rows,value='',blank='请选择',full=false)=>`<label class="wc-field ${full?'full':''}"><span>${esc(label)}</span><select name="${name}" aria-label="${esc(label)}">${opts(rows,value,blank)}</select></label>`;
  function collaboratorPicker(people){
    return `<div class="wc-field wc-collaborators"><div class="wc-people-label">协作人 <span>可选 · 可多选</span></div><details class="wc-people-picker"><summary aria-label="选择协作人"><span class="wc-people-value is-empty">不添加协作人</span><svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></summary><div class="wc-people-panel"><div class="wc-people-search"><input type="search" aria-label="搜索协作人" placeholder="搜索姓名或团队" autocomplete="off"></div><div class="wc-people-options" role="group" aria-label="可选协作人">${people.map(p=>`<label class="wc-people-option" data-search="${esc((p.name+' '+(p.teamName||'')).toLocaleLowerCase())}"><span class="wc-person"><span class="wc-avatar" aria-hidden="true">${esc(p.name.slice(-2))}</span><span class="wc-people-person"><strong>${esc(p.name)}</strong><small>${esc(p.teamName||p.role||'')}</small></span></span><input type="checkbox" name="collaborators" value="${esc(p.id)}" data-name="${esc(p.name)}" aria-label="${esc(p.name)}"></label>`).join('')}<div class="wc-people-empty" ${people.length?'hidden':''}>${people.length?'没有找到匹配的人员':'暂无可选协作人'}</div></div><div class="wc-people-footer"><span class="wc-people-count" aria-live="polite">已选 0 人</span><button type="button" class="wc-people-clear" disabled>清空</button><button type="button" class="wc-people-done">完成</button></div></div></details></div>`;
  }
  function bindCollaboratorPicker(form){
    const picker=form.querySelector('.wc-people-picker');if(!picker)return;
    const summary=picker.querySelector('summary'),value=picker.querySelector('.wc-people-value'),search=picker.querySelector('input[type=search]');
    const boxes=[...picker.querySelectorAll('input[type=checkbox]')],rows=[...picker.querySelectorAll('.wc-people-option')];
    const clear=picker.querySelector('.wc-people-clear'),count=picker.querySelector('.wc-people-count');
    const filter=()=>{const query=search.value.trim().toLocaleLowerCase();let visible=0;rows.forEach(row=>{row.hidden=!row.dataset.search.includes(query);if(!row.hidden)visible++;});picker.querySelector('.wc-people-empty').hidden=visible>0;};
    const refresh=()=>{const selected=boxes.filter(box=>box.checked);value.textContent=selected.length?selected.slice(0,2).map(box=>box.dataset.name).join('、')+(selected.length>2?' 等 '+selected.length+' 人':''):'不添加协作人';value.classList.toggle('is-empty',!selected.length);value.title=selected.map(box=>box.dataset.name).join('、');count.textContent='已选 '+selected.length+' 人';clear.disabled=!selected.length;boxes.forEach(box=>box.closest('label').classList.toggle('selected',box.checked));};
    picker.addEventListener('change',refresh);
    search.addEventListener('input',filter);
    search.addEventListener('keydown',e=>{if(e.key==='Enter')e.preventDefault();});
    const close=()=>{picker.open=false;summary.focus();};
    clear.addEventListener('click',()=>{boxes.forEach(box=>box.checked=false);refresh();});
    picker.querySelector('.wc-people-done').addEventListener('click',close);
    picker.addEventListener('keydown',e=>{if(e.key==='Escape'&&picker.open){e.preventDefault();e.stopPropagation();close();}});
    picker.addEventListener('toggle',()=>{if(picker.open){search.value='';filter();picker.querySelector('.wc-people-panel').scrollIntoView({block:'nearest'});search.focus({preventScroll:true});}});
    form.closest('dialog').addEventListener('click',e=>{if(!picker.contains(e.target))picker.open=false;});
    refresh();
  }
  const table=(headers,rows,centerMetrics=false)=>rows.length?`<div class="wc-table-wrap"><table class="wc-table${centerMetrics?' wc-table-metrics':''}"><thead><tr>${headers.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty('暂无记录','调整筛选条件，或开始记录工作。');
  const personCell=p=>`<div class="wc-person"><span class="wc-avatar">${esc(p.name?.slice(-2))}</span><div>${link(p.name,'person',p.id)}<div class="wc-small">${esc(p.role)}${p.orgRole&&p.orgRole!==p.role&&p.role==='员工'?' · '+esc(p.orgRole):''}</div></div></div>`;
  const progress=(n,label='')=>`<span class="wc-small">${esc(label||n+'%')}</span><div class="wc-progress"><span style="width:${Math.max(0,Math.min(100,Number(n)||0))}%"></span></div>`;
  async function api(path,body,method='POST'){
    const res=await fetch('/api/work/'+path,{credentials:'same-origin',method:body===undefined?'GET':method,headers:body instanceof FormData?{}:{'Content-Type':'application/vnd.xm-work+json'},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
    if(path==='center/daily'&&res.status===413)throw new Error('本次日报上传内容过大，请缩小图片或移除部分图片后重试');
    let data;try{data=await res.json();}catch{throw new Error('服务暂不可用，请稍后重试');}
    if(!res.ok||data.ok===false)throw new Error(data.error||'操作失败');return data;
  }
  window.XmWorkCenter={permissionVersion:'catalog-2',mount(root){
    const abort=new AbortController();let alive=true,data=null,tab='overview',taskView='list',mode='all',search='',page=1,dialog=null,legacyCleanup=null,request=0;
    const dashboardTabs=new Set(['overview','supervisors','statistics']);
    const canOpenManagement=()=>Boolean(data?.canViewManagement)&&can('management');
    const dashboardAvailable=()=>can('overview')||canOpenManagement()||can('statistics');
    const tabBadgeLabels={tasks:'项任务待开始',reports:'份今日日报未提交'};
    let refreshingBadges=false;
    let filters={from:'',to:'',team:'',person:'',role:'',department:'',shop:'',board:''},organizationOpen=false;let chartMode='bar',distributionMode='team',dailyMode='submitted';const drafts={},taskCache=new Map(),workCache=new Map(),dailyCache=new Map();
    const can=(feature,right='enter')=>Boolean(data?.permissions?.['work.'+feature]?.[right]);
    const actionFeature={newWork:'records',newIssue:'records',writeDaily:'reports',publish:'publish',export:'export',notifications:'messages',readNotice:'messages',newTemplate:'settings',removeTemplate:'settings',reminderStatus:'settings'};
    const readActions=new Set(['export','notifications','reminderStatus']);
    function actionAllowed(action,id,kind){
      if(action==='legacy')return can(id==='diarySettings'?'legacyDiary':'legacySettings');
      if(action==='taskAction'){const f=['start','progress','submit'].includes(kind)?'execute':['approve','return','review'].includes(kind)?'acceptance':kind==='confirmTeam'?'settings':'publish';return can(f,'edit');}
      if(action==='tab'&&id==='overview')return dashboardAvailable();
      if(action==='taskView')return can(id==='acceptance'?'acceptance':'tasks');
      if(action==='tasks'||action==='tab'&&id==='tasks')return can('tasks')||can('acceptance');
      if(action==='acceptance'||action==='tab'&&id==='acceptance')return can('acceptance');
      if(action==='export')return can('statistics')&&can('export');
      if(action==='overdue'||action==='completed')return can('tasks');
      const target=data?.tabs?.find(t=>t.tab===(action==='tab'?id:action));if(target)return can(target.id.slice(5));
      const feature=actionFeature[action];return !feature||can(feature,readActions.has(action)?'enter':'edit');
    }
    function applyPermissions(){root.querySelectorAll('[data-action]').forEach(el=>{if(!actionAllowed(el.dataset.action,el.dataset.id,el.dataset.kind)){el.hidden=true;el.style.display='none';}});if(tab==='settings'&&!can('settings','edit'))root.querySelectorAll('[data-wc-body] input,[data-wc-body] select,[data-wc-body] textarea,[data-wc-body] button[type="submit"]').forEach(el=>el.disabled=true);}
    const deep=new URLSearchParams(location.search);if(deep.get('tab')==='taskMine'){tab='tasks';mode='mine';}if(deep.get('tab')==='reports'){tab='reports';const date=deep.get('date');if(/^\d{4}-\d{2}-\d{2}$/.test(date||''))filters.from=filters.to=date;}if(['taskReview','acceptance'].includes(deep.get('tab'))){tab='tasks';taskView='acceptance';}if(deep.get('tab')==='taskPublish'){tab='tasks';mode='published';}if(deep.get('tab')==='tasks'){tab='tasks';if(deep.get('view')==='acceptance')taskView='acceptance';}
    const notify=(message,error=false)=>{document.querySelectorAll('.wc-toast').forEach(n=>n.remove());const node=document.createElement('div');node.className='wc-toast'+(error?' error':'');node.textContent=message;node.setAttribute('role','status');document.body.appendChild(node);setTimeout(()=>node.remove(),5000);};
    async function reload(){const id=++request;try{const next=await api('center?'+new URLSearchParams(Object.entries(filters).filter(([,v])=>v)));if(!alive||id!==request)return;data=next;filters.from=next.from;filters.to=next.to;paint();}catch(error){if(!alive)return;if(!data)root.innerHTML=`<main class="wc">${card('工作中心',`<div class="wc-error">${esc(error.message)}</div>`,btn('重新加载','refresh'))}</main>`;else notify(error.message,true);}}
    function paintTabBadges(){
      root.querySelectorAll('[data-wc-tab-count]').forEach(el=>{
        const tab=el.dataset.wcTabCount,ownCount=data.badges?.[tab]||0;
        const acceptance=tab==='tasks'?(data.badges?.acceptance||0):0;
        const count=ownCount+acceptance;
        const label=[ownCount&&ownCount+' '+tabBadgeLabels[tab],acceptance&&acceptance+' 项任务待你验收'].filter(Boolean).join('，');
        el.hidden=!count;
        el.textContent=count||'';
        el.title=label;
        el.setAttribute('aria-label',label);
      });
    }
    async function refreshTabBadges(){
      if(!alive||!data||document.hidden||refreshingBadges)return;
      refreshingBadges=true;
      const id=request;
      try{
        const next=await api('center/badges');
        if(!alive||id!==request)return;
        data.today=next.today;
        data.badges=next.badges;
        paintTabBadges();
      }catch{
        // Keep the last available counts until the next refresh.
      }finally{refreshingBadges=false;}
    }
    function imageUrl(image,parentId,task=false){return '/api/work/center/image/'+encodeURIComponent(image.id)+'?'+new URLSearchParams({[task?'task':'record']:parentId});}
    function imageCards(images,parentId,field,task=false){return (images||[]).filter(i=>!field||i.field===field).map(i=>'<button type="button" class="wc-compose-saved" data-action="previewComposer" data-src="'+esc(imageUrl(i,parentId,task))+'" aria-label="放大图片"><img loading="lazy" src="'+esc(imageUrl(i,parentId,task))+'" alt="'+esc(i.name||'图片')+'"></button>').join('');}
    function hydrateImages(form,item,task=false){if(!form||!item)return;form.querySelectorAll('[data-rich-editor]').forEach(editor=>{
      const key=editor.getAttribute('data-label')||editor.dataset.richEditor,images=(item.composerImages||[]).filter(i=>i.field===key);
      if(task&&['description','criteria'].includes(key))images.push(...(item[key+'_doc']||[]).filter(n=>n.type==='image').map(n=>({fileId:n.fileId})));
      form._wtSetImages(editor.dataset.richEditor,images,async i=>{if(!i.fileId)return imageUrl(i,item.id,task);const f=await api('tasks/file?id='+encodeURIComponent(i.fileId));return 'data:'+f.mime+';base64,'+f.data;});
    });}
    function closeDialog(){if(legacyCleanup){legacyCleanup();legacyCleanup=null;}if(dialog){dialog.close();dialog.remove();dialog=null;}}
    function reminderSettings(s){return card('自动钉钉提醒',`<form data-form="reminders" class="wc-form">${select('任务到期、逾期及验收超时','taskReminders',[{id:'true',name:'开启'},{id:'false',name:'关闭'}],String(s.taskReminders),null)}${select('未提交日报提醒','dailyReminders',[{id:'true',name:'开启'},{id:'false',name:'关闭'}],String(s.dailyReminders),null)}${field('任务截止前提醒（分钟）','dueSoonMinutes','number',s.dueSoonMinutes,false,'min="1" max="1440" required')}${field('持续逾期 / 验收超时每日催办','repeatReminderAt','time',s.repeatReminderAt,false,'required')}<p class="wc-muted wc-field full">日报在上方设定的截止时间催交，仅提醒当天应报且未提交的人。任务逾期提醒执行人；待验收任务超过验收时限后提醒验收人。同一事项同一天不重复催办，发送失败自动重试。需先绑定员工钉钉。</p><div class="wc-actions wc-field full"><button class="wc-btn primary" type="submit">保存提醒规则</button>${btn('查看发送与绑定状态','reminderStatus')}</div></form>`);}
    async function showReminderStatus(){try{const r=await api('center/reminders');modal('钉钉提醒状态',`<p>已绑定 ${r.bound} / ${r.active} 人；未绑定 ${r.unbound.length} 人。</p><p class="wc-text">${esc(r.unbound.map(p=>p.name).join('、')||'人员均已绑定')}</p><p class="wc-muted">${esc(r.rule)}</p>${table(['提醒','接收人','状态','最近尝试'],r.recent.map(n=>[esc(n.title),esc(n.personName),esc(n.statusLabel),esc(when(n.lastAttemptAt||n.createdAt))]))}<p class="wc-muted">发送成功表示钉钉接口已受理，不代表对方已读。</p>`);}catch(e){notify(e.message,true);}}
    function modal(title,body){closeDialog();dialog=document.createElement('dialog');dialog.className='wc-dialog';dialog.innerHTML=`<div class="wc-dialog-head"><h2>${esc(title)}</h2>${btn('关闭','close')}</div><div class="wc-dialog-body"><div class="wc">${body}</div></div>`;root.appendChild(dialog);applyPermissions();dialog.addEventListener('cancel',()=>{if(legacyCleanup){legacyCleanup();legacyCleanup=null;}},{once:true});dialog.addEventListener('click',e=>{if(e.target===dialog)closeDialog();});dialog.showModal();dialog.querySelectorAll('form').forEach(form=>window.XmWorkRich.upgrade(form));}
    function toolbar(organizationOnly=false,dashboard=false){
      const options=data.options;
      const teams=[...new Map(options.people.filter(p=>p.teamId).map(p=>[p.teamId,{id:p.teamId,name:p.teamName}])).values()];
      const fields=[
        ['组织板块','board',options.boards,'全部组织板块'],['团队','team',teams,'全部团队'],
        ['岗位','role',options.roles,'全部岗位'],['员工','person',options.people,'全部员工'],
        ['店铺','shop',options.shops,'全部店铺'],['部门','department',options.departments,'全部部门']
      ];
      const choices=fields.map(([label,key,rows,blank])=>dashboard
        ?select(label,key,rows,filters[key],blank)
        :`<select aria-label="${label}" name="${key}">${opts(rows,filters[key],blank)}</select>`).join('');
      const dates=organizationOnly?'':`<label><span>工作日期</span><input aria-label="开始日期" name="from" type="date" value="${filters.from}"></label><span class="wc-muted">至</span><input aria-label="结束日期" name="to" type="date" value="${filters.to}">`;
      const extraDates=`<select aria-label="更多日期" data-quick-range><option value="">更多日期</option><option value="yesterday">昨日</option><option value="30days">近30天</option><option value="month">本月</option><option value="lastmonth">上月</option></select>`;
      const apply='<button class="wc-btn primary" type="submit">查询</button>';
      if(!dashboard){
        const shortcuts=organizationOnly?'':btn('今天','today')+btn('近7天','week')+extraDates;
        return `<form class="wc-toolbar" data-form="filter" aria-label="${organizationOnly?'组织关系筛选':'工作筛选'}">${dates}${choices}${apply}${shortcuts}</form>`;
      }
      const activeFilters=fields.filter(([,key])=>filters[key]).length;
      const period=(label,action,selected)=>btn(label,action,selected?'is-selected':'',`aria-pressed="${selected}"`);
      const isToday=filters.to===data.today&&filters.from===data.today;
      const isWeek=filters.to===data.today&&Date.parse(filters.to)-Date.parse(filters.from)===6*86400000;
      return `<form class="wc-toolbar wc-dash-toolbar" data-form="filter" aria-label="工作筛选">
        <div class="wc-dash-filter-date">${dates}</div>
        <div class="wc-dash-period" role="group" aria-label="快捷日期">${period('今天','today',isToday)}${period('近7天','week',isWeek)}${extraDates}</div>
        <div class="wc-dash-filter-actions">
          <details class="wc-dash-filter">
            <summary>筛选条件${activeFilters?` <span class="wc-dash-filter-count">${activeFilters}</span>`:''}</summary>
            <div class="wc-dash-filter-panel">${choices}<button class="wc-btn" type="submit">应用筛选</button></div>
          </details>
          ${apply}
        </div>
      </form>`;
    }
    function teamTable(){return table(['管理团队 / 部门','成员','任务 / 子任务','到期完成','待验收','逾期','日报提交率'],data.teams.map(t=>[link(t.name,'team',t.id),t.members,`${t.metrics.roots} / ${t.metrics.children}`,`${t.metrics.completed} / ${t.metrics.due} ${progress(t.metrics.completionRate||0,percent(t.metrics.completionRate))}`,status(String(t.metrics.pending)),t.metrics.overdue?badge(t.metrics.overdue,'red'):'0',percent(t.reportRate)]));}
    function peopleTable(rows=data.people){return table(['员工','所属团队 / 店铺','任务','已完成','待验收','逾期','日报','操作'],rows.map(p=>[personCell(p),`<div>${esc(p.teamName)}</div><div class="wc-small">${esc(p.boardName)} · ${esc(p.department)}</div><div class="wc-small" title="${esc(p.visibleShops.join('、'))}">${esc(p.visibleShops.slice(0,2).join('、')||'暂未关联店铺')}${p.visibleShops.length>2?' 等'+p.visibleShops.length+'家':''}</div>`,p.received,p.metrics.completedEvents,p.metrics.pending,p.metrics.overdue?badge(p.metrics.overdue,'red'):'0',status(p.reportStatus),link('查看工作','person',p.id)]));}
    function alerts(all=false) {
      if(!data.alerts.length)return empty('暂无异常提醒');
      const rows=data.alerts.map(a=>{
        const action=a.type==='task'?'task':a.type==='person'?'person':'issue';
        const urgent=a.reason.includes('逾期')||a.type==='issue';
        return `<li><button type="button" class="wc-dash-alert${urgent?' is-urgent':''}" data-action="${action}" data-id="${esc(a.id)}">
          <i aria-hidden="true"></i><span><strong>${esc(a.title)}</strong><small>${esc(a.reason)}</small></span><span class="wc-dash-alert-arrow" aria-hidden="true">›</span>
        </button></li>`;
      });
      const visible=all?rows.length:3;
      return `<ul class="wc-dash-alerts">${rows.slice(0,visible).join('')}</ul>`;
    }
    function dashboardMetric(label,value,action,tone='') {
      const contents=`<span>${label}</span><strong>${value}</strong>`;
      return action&&actionAllowed(action)
        ? `<button type="button" class="wc-dash-metric ${tone}" data-action="${action}">${contents}</button>`
        : `<div class="wc-dash-metric ${tone}">${contents}</div>`;
    }
    function dashboardCount(label,value,action) {
      return actionAllowed(action)?link(label+' '+value,action):`<span>${label} <b>${value}</b></span>`;
    }
    function dashboardSummary(c) {
      return `<div class="wc-dash-kpis">
        <section class="wc-dash-tile">
          ${dashboardMetric('独立任务',c.roots,'tasks')}
          <div class="wc-dash-tile-details"><span>子任务 <b>${c.children}</b></span>${dashboardCount('本期到期',c.due,'tasks')}</div>
        </section>
        <section class="wc-dash-tile">
          ${dashboardMetric('本期到期 · 已验收完成',c.completed,'completed','green')}
          <div class="wc-dash-tile-details"><span>任务完成率 <b>${percent(c.completionRate)}</b></span></div>
        </section>
        <section class="wc-dash-tile">
          ${dashboardMetric('待验收任务',c.pending,'acceptance','amber')}
          <div class="wc-dash-tile-details"><span>提交成果后待审核</span></div>
        </section>
        <section class="wc-dash-tile">
          ${dashboardMetric('逾期任务',c.overdue,'overdue','red')}
          <div class="wc-dash-tile-details"><span>当前未验收完成</span></div>
        </section>
        <section class="wc-dash-tile">
          ${dashboardMetric('日报已交 / 应交',`${c.reported} <small>/ ${c.should}</small>`,'reports')}
          <div class="wc-dash-tile-details"><span>未交 <b>${c.missing}</b></span><span>提交率 <b>${percent(c.reportRate)}</b></span></div>
        </section>
      </div>`;
    }
    const dashboardCard=(title,body,actions)=>card(title,body,actions,'h3');
    function compactCard(title,body,actions='',kind=''){
      return `<section class="wc-card wc-compact-card ${kind}">
        <div class="wc-compact-card-head"><h2>${title}</h2>${actions}</div>
        <div class="wc-compact-card-body">${body}</div>
      </section>`;
    }
    function compactLink(label,id){
      return link(label,'dashboardDetail',id);
    }
    function distribution(){
      const total=data.people.length;
      if(!total)return empty('当前范围暂无人员');
      const byTeam=distributionMode==='team';
      const groups=byTeam?data.teams:data.departments;
      const rows=groups.filter(group=>group.members>0);
      const assigned=rows.reduce((sum,group)=>sum+group.members,0);
      const other=total-assigned;
      if(other>0)rows.push({name:byTeam?'未归属团队':'其他',members:other});
      const colors=['#2677ed','#14a787','#e8a335','#8e70e0','#d75582','#8499b4'];
      let filled=0;
      const trends=rows.map((row,i)=>{
        const color=colors[i%colors.length];
        const share=row.members/total*100;
        const arc=`${color} ${filled}% ${filled+share}%`;
        filled+=share;
        return {...row,color,share,arc};
      });
      const legend=trends.map(r=>{
        const content=`<i style="--dot:${r.color}" aria-hidden="true"></i><span>${esc(r.name)}</span><b>${r.members}</b><small>${r.share.toFixed(1)}%</small>`;
        return `<li>${r.id
          ?`<button type="button" class="wc-dist-row" data-action="dashboardScope" data-kind="${byTeam?'team':'board'}" data-id="${esc(r.id)}">${content}</button>`
          :`<span class="wc-dist-row">${content}</span>`}</li>`;
      }).join('');
      const fill=`conic-gradient(${trends.map(row=>row.arc).join(',')})`;
      return `<div class="wc-compact-distribution"><div class="wc-donut" style="background:${fill}"><div><span>在职人员</span><strong>${total}</strong></div></div>
        <ul>${legend}</ul></div>`;
    }
    function compactRankings(){
      const rows=data.teams.filter(t=>t.metrics.completionRate!=null)
        .sort((a,b)=>b.metrics.completionRate-a.metrics.completionRate||b.metrics.due-a.metrics.due).slice(0,5);
      return rows.length?`<ol class="wc-compact-ranking">${rows.map(row=>
        `<li><button type="button" data-action="dashboardScope" data-kind="team" data-id="${esc(row.id)}">
          <span class="wc-rank-name">${esc(row.name)}</span><b>${percent(row.metrics.completionRate)}</b>
          <span class="wc-rank-bar" aria-hidden="true"><i style="width:${row.metrics.completionRate}%"></i></span>
        </button></li>`).join('')}</ol>`:empty('暂无到期任务');
    }
    function compactTasks(){
      const rows=[...data.tasks].filter(t=>!['已完成','已取消'].includes(t.state))
        .sort((a,b)=>Number(b.overdue)-Number(a.overdue)||String(a.due_at).localeCompare(String(b.due_at))).slice(0,4);
      return rows.length?`<ul class="wc-compact-list">${rows.map(t=>
        `<li><button type="button" data-action="task" data-id="${esc(t.id)}"><i class="wc-list-dot ${t.overdue?'urgent':''}" aria-hidden="true"></i>
          <span><strong>${esc(t.title)}</strong><small>${esc(t.assigneeName||'未分配')} · ${esc(when(t.due_at))}</small></span>
          ${status(t.overdue?'已逾期':t.state)}
        </button></li>`).join('')}</ul>`:empty('暂无待跟进任务');
    }
    function compactDaily(){
      const pending=dailyMode==='missing';
      const rows=(pending?data.people.filter(p=>p.reportStatus==='未提交'):data.dailies.filter(r=>r.submittedAt&&r.date===filters.to)).slice(0,4);
      return rows.length?`<ul class="wc-compact-list">${rows.map(row=>{
        const personName=pending?row.name:row.personName;
        return `<li><button type="button" data-action="${pending?'person':'daily'}" data-id="${esc(row.id)}">
          <span class="wc-avatar" aria-hidden="true">${esc(personName.slice(-2))}</span>
          <span><strong>${esc(personName)}</strong><small>${esc(row.teamName||'')}</small></span>
          ${status(pending?'未提交':row.late?'迟交':'已提交')}
        </button></li>`;
      }).join('')}</ul>`:empty(pending?'暂无未交人员':'暂无已交日报');
    }
    function dashboardDetail(id){
      const summary=can('overview'),statistics=can('statistics'),management=canOpenManagement();
      if(id==='alerts'&&summary){modal('全部待办事项',alerts(true));return;}
      if(id==='teams'&&(summary||statistics||management)){
        const departments=management||(summary&&data.me.role==='总监');
        modal('部门与团队',`${departments?dashboardCard('部门工作情况',departmentTable(true)):''}${dashboardCard('团队执行情况',teamTable())}`);
        return;
      }
      if(id==='management'&&management){modal('管理跟进',managementCards(summary||statistics));return;}
      if(id==='analysis'&&statistics){modal('数据分析',analysisCards());}
    }
    function dashboardSwitch(kind,label,choices,selected){
      return `<div class="wc-compact-switch" role="group" aria-label="${label}">${choices.map(([id,text])=>
        `<button type="button" data-action="dashboardSwitch" data-kind="${kind}" data-id="${id}" aria-pressed="${id===selected}">${text}</button>`).join('')}</div>`;
    }
    function overview(){
      const summary=can('overview'),statistics=can('statistics'),management=canOpenManagement();
      const execution=summary||statistics;
      const views=[
        ['management','管理跟进',management],['analysis','数据分析',statistics]
      ];
      const tools=views.filter(([, ,visible])=>visible).map(([id,label])=>compactLink(label,id)).join('');
      const selectedTeam=data.options.people.find(p=>p.teamId===filters.team)?.teamName;
      const selectedBoard=data.options.boards.find(b=>b.id===filters.board)?.name;
      const scope=[selectedBoard,selectedTeam].filter(Boolean).join(' / ');
      const filtered=Object.entries(filters).some(([key,value])=>key!=='from'&&key!=='to'&&value);
      const scopeLabel=scope||(filtered?'当前筛选范围':data.me.role==='总监'?'全公司':'当前可见范围');
      return `<div class="wc-dashboard wc-compact-dashboard">
        <div class="wc-compact-heading"><div><h1>工作总览</h1><div class="wc-compact-scope">当前视角 <strong>${esc(scopeLabel)}</strong>${filtered?link('清除筛选','dashboardScope',''):''}</div></div>
          <div class="wc-compact-heading-actions">${tools}${statistics&&can('export')?btn('导出 Excel','export'):''}${btn('刷新','refresh')}</div></div>
        <div class="wc-dash-control-row">${toolbar(false,true)}</div>
        ${summary?dashboardSummary(data.counts):''}
        ${summary?`<div class="wc-compact-grid">
          ${compactCard(`待办事项 <span>${data.alerts.length}</span>`,alerts(),data.alerts.length>3?compactLink('查看全部','alerts'):'','wc-compact-attention')}
          ${compactCard('任务跟进',compactTasks(),link('任务管理','tab','tasks'))}
          ${compactCard('日报提交',compactDaily(),`<div class="wc-compact-card-actions">
            ${dashboardSwitch('daily','日报状态',[['submitted','已交'],['missing','未交']],dailyMode)}
            ${link('查看日报','tab','reports')}
          </div>`)}
        </div>`:''}
        ${execution||management?`<div class="wc-compact-grid wc-compact-grid-insights">
          ${statistics?chart():''}
          ${compactCard('人员分布',distribution(),dashboardSwitch('distribution','分布维度',[['team','团队'],['board','部门']],distributionMode))}
          ${compactCard('团队到期完成率',compactRankings(),compactLink('查看全部','teams'))}
          ${execution?performanceCards(data.counts,summary,statistics):''}
        </div>`:''}
      </div>`;
    }
    function tasksForMode(){let rows=data.tasks;if(taskView==='acceptance')rows=rows.filter(t=>mode==='all'?t.state==='待验收':mode==='processed'?(t.events||[]).some(e=>e.actor===data.me.id&&['检查通过','退回修改'].includes(e.action)):t.reviewer===data.me.id&&t.state==='待验收');else if(mode==='mine')rows=rows.filter(t=>t.assignee===data.me.id||(t.collaborators||[]).includes(data.me.id));else if(mode==='published')rows=rows.filter(t=>t.publisher===data.me.id);else if(mode==='overdue')rows=rows.filter(t=>t.overdue);else if(mode==='completed')rows=rows.filter(t=>t.state==='已完成');else if(mode==='pending')rows=rows.filter(t=>t.state==='待验收');if(search)rows=rows.filter(t=>[t.title,t.assigneeName,t.publisherName,t.shop_name,t.category].join(' ').toLowerCase().includes(search.toLowerCase()));return rows;}
    function taskTable(rows){return table(['任务','负责人 / 团队','实际发布人','截止时间','进度','状态','操作'],rows.map(t=>[`<div class="wrap">${link(t.title,'task',t.id)}<div class="wc-small">${t.parent_id?'子任务 · ':''}${esc(t.category||'历史任务')}${t.shop_name?' · '+esc(t.shop_name):''}</div></div>`,`<div>${esc(t.assigneeName)}</div><div class="wc-small">${esc(t.team_name||'团队待确认')}</div>`,`<div>${esc(t.publisherName)}</div><div class="wc-small">${esc(t.source||'历史任务')}</div>`,`<span>${esc(when(t.due_at))}</span>`,progress(t.progress||0),`<div class="wc-badges">${status(t.state)}${t.overdue?badge('已逾期','red'):''}${t.returned?badge('已退回','orange'):''}${t.blocked?badge('有阻碍','red'):''}${t.delayed?badge('已延期','purple'):''}</div>`,link('查看详情','task',t.id)]));}
    function tasks(){const modes=taskView==='acceptance'?[['all','待验收'],['review','由我验收'],['processed','我已处理']]:[['all','全部可见'],['mine','我收到的'],['published','我发布的'],['pending','待验收'],['overdue','已逾期'],['completed','已完成']];const rows=tasksForMode(),size=12,max=Math.max(1,Math.ceil(rows.length/size));page=Math.min(page,max);return card('任务管理',`<nav class="wc-subtabs" aria-label="任务管理导航">${[['list','任务列表','tasks'],['acceptance','任务验收','acceptance']].filter(([, ,feature])=>can(feature)).map(([key,label])=>`<button type="button" class="${taskView===key?'active':''}" data-action="taskView" data-id="${key}" aria-current="${taskView===key?'page':'false'}">${label}${key==='acceptance'&&data.counts.pending?' '+data.counts.pending:''}</button>`).join('')}</nav><div class="wc-subtabs" aria-label="${taskView==='acceptance'?'任务验收筛选':'任务列表筛选'}">${modes.map(([key,label])=>`<button class="${mode===key?'active':''}" data-action="mode" data-id="${key}">${label}</button>`).join('')}</div><form data-form="search" class="wc-toolbar"><input class="wc-search" name="search" aria-label="搜索任务" placeholder="搜索任务、人员或店铺" value="${esc(search)}"><button class="wc-btn" type="submit">搜索</button><span class="wc-small">${rows.length} 项任务 · 所有状态均保留操作历史</span></form>${taskTable(rows.slice((page-1)*size,page*size))}<div class="wc-foot"><span>第 ${page} / ${max} 页，共 ${rows.length} 项</span><div class="wc-actions">${btn('上一页','prev')}${btn('下一页','next')}</div></div>`,data.canPublish?btn('发布任务','publish','primary'):'');}
    function timeline(rows){return rows.length?`<div class="wc-timeline">${rows.slice(0,100).map(e=>`<div class="wc-event"><div class="wc-small">${esc(when(e.at))} · ${esc(e.actor||'')}</div><b>${esc(e.action)}</b> ${e.taskId?link(e.title,'task',e.taskId):esc(e.title)}${e.note?`<p class="wc-muted">${esc(e.note)}</p>`:''}</div>`).join('')}</div>`:empty('这段时间暂无工作记录','系统操作会自动记录到时间线。');}
    function people(){return card('人员工作明细',peopleTable())+card('工作时间线',timeline(data.timeline));}
    function departmentTable(centerMetrics=false){return table(['组织板块','在职人员','独立任务 / 子任务','已验收完成','待验收','当前逾期','日报 已交 / 应交'],(data.departments||[]).map(d=>[link(d.name,'board',d.id),d.members,d.metrics.roots+' / '+d.metrics.children,d.metrics.completedEvents,d.metrics.pending,d.metrics.overdue,d.reported+' / '+d.should]),centerMetrics);}
    function managementCards(hasExecutionTable) {
      const managers=(data.managers||[]).map(m=>[link(m.name,'person',m.id),m.members,m.teams,m.published,m.directorPublished,m.metrics.completedEvents,m.metrics.pending,m.metrics.overdue]);
      const teamHeaders=['管理团队 / 部门','负责人主动发布','总监发布','经理发布','运营发布','本期验收操作','通过','及时验收率'];
      const teamRows=data.teams.map(t=>[
        link(t.name,'team',t.id),t.selfPublished,t.directorPublished,t.managerPublished,t.operatorPublished,t.reviewed,t.accepted,percent(t.timelyReviewRate),
        ...(!hasExecutionTable?[t.metrics.overdue]:[]),`${t.issues} / ${t.resolved}`,percent(t.issueResolutionRate),t.training,status(t.dailyStatus)
      ]);
      const managementHeaders=[...teamHeaders,...(!hasExecutionTable?['逾期']:[]),'问题 / 已解决','问题解决率','培养记录','管理日结'];
      return `
        ${dashboardCard('经理管理范围',table(['经理','管理人数','主管团队','本人发布','总监直派','已验收完成','待验收','逾期'],managers,true))}
        ${dashboardCard('团队管理情况',`<p class="wc-dash-table-note">实际发布人和团队归属分别记录，上级直派不会计入下级主动发布。</p>${table(managementHeaders,teamRows,true)}`)}
        ${dashboardCard('管理范围内的问题',issueTable(data.issues),btn('登记问题','newIssue'))}
        ${dashboardCard('管理人员日结',dailyTable(data.dailies.filter(r=>['经理','主管'].includes(r.role))))}
      `;
    }
    function dailyTable(rows){return table(['工作日期','员工','团队','状态','提交时间','版本','操作'],rows.map(r=>[esc(r.date),esc(r.personName),esc(r.teamName),status(r.submittedAt?(r.late?'迟交':'已提交'):'草稿'),esc(when(r.submittedAt)),r.revision,link('查看日报','daily',r.id)]));}
    function workTable(rows){return table(['日期','员工','自主工作','店铺','成果','操作'],rows.map(w=>[esc(w.date),esc(w.personName),esc(w.title),esc(w.shopName||'—'),`<span title="${esc(w.result)}">${esc(w.result||'—')}</span>`,link('查看','work',w.id)]));}
    function reports(){const current=data.currentDaily;return card('我的日报',`<div class="wc-statusline"><b>${esc(filters.to)}</b>${status(current?.submittedAt?(current.late?'迟交':'已提交'):'未提交')}<span class="wc-muted">任务 ${data.draft.tasks.length} 项 · 自主工作 ${data.draft.work.length} 项已自动关联</span></div><p class="wc-small">经理和主管日报包含管理范围日结；提交时保存当时的任务快照，修改保留版本。</p>`,btn('填写日报','writeDaily','primary')+btn('登记自主工作','newWork')+btn('店铺 / 部门填报','legacy','',`data-id="today"`))+card('日报提交情况',peopleTable())+card('日报与团队日结',dailyTable(data.dailies))+card('自主工作记录',workTable(data.works),btn('查看原有汇总','legacy','',`data-id="summary"`)+btn('原有待办事项','legacy','',`data-id="todo"`)+btn('原有提交情况','legacy','',`data-id="duty"`));}
    function issueTable(rows){return table(['问题','提出人','团队','状态','升级','操作'],rows.map(i=>[esc(i.title),esc(i.personName),esc(i.teamName),status(i.status),i.escalated?badge('上级协调','orange'):'—',link('查看处理','issue',i.id)]));}
    function chart() {
      const rows=data.trend;
      if(!rows.some(row=>row.created||row.completed))return compactCard('任务趋势',empty('本期暂无新增或验收完成的任务'));
      const header=`<div class="wc-dash-chart-head"><div><h3>任务趋势</h3><span class="wc-dash-chart-sub">按日期查看新增与验收完成</span></div><div class="wc-dash-chart-tools"><div class="wc-dash-chart-legend">
        <span><i></i>新增任务</span><span><i class="completed"></i>验收完成</span>
      </div><div class="wc-dash-chart-switch">${btn('柱状图','chartMode',chartMode==='bar'?'is-selected':'','data-mode="bar" aria-pressed="'+(chartMode==='bar')+'"')}${btn('折线图','chartMode',chartMode==='line'?'is-selected':'','data-mode="line" aria-pressed="'+(chartMode==='line')+'"')}</div></div></div>`;
      const max=Math.max(4,Math.ceil(Math.max(...rows.map(r=>Math.max(r.created,r.completed)))/4)*4);
      const left=39,right=880,top=14,bottom=177;
      const step=(right-left)/rows.length;
      const x=i=>left+step*(i+.5);
      const y=n=>bottom-(bottom-top)*n/max;
      const axes=[0,1,2,3,4].map(i=>{
        const value=i*max/4;
        return `<path class="wc-dash-chart-grid" d="M${left} ${y(value)}H${right}"/><text x="${left-12}" y="${y(value)+4}" text-anchor="end">${value}</text>`;
      }).join('');
      const width=Math.min(28,step*.27);
      const gap=Math.min(6,step*.085);
      const bars=rows.map((row,i)=>['created','completed'].map((key,j)=>{
        const value=row[key];
        return `<rect class="wc-dash-bar ${key}" x="${x(i)+(j?gap/2:-width-gap/2)}" y="${y(value)}" width="${width}" height="${bottom-y(value)}" rx="${Math.min(3,width/4)}">
          <title>${esc(row.date)} ${j?'验收完成':'新增任务'} ${value}</title></rect>`;
      }).join('')).join('');
      const lines=chartMode==='line'?['created','completed'].map((key,j)=>{const points=rows.map((row,i)=>`${x(i)},${y(row[key])}`).join(' ');return `<polyline class="wc-dash-line ${key}" points="${points}"/><g class="wc-dash-points ${key}">${rows.map((row,i)=>`<circle cx="${x(i)}" cy="${y(row[key])}" r="3"><title>${esc(row.date)} ${j?'验收完成':'新增任务'} ${row[key]}</title></circle>`).join('')}</g>`}).join(''):'';
      const labelStep=Math.max(1,Math.ceil((rows.length-1)/7));
      const labelIndices=rows.map((row,i)=>i).filter(i=>(i%labelStep===0&&i+labelStep<rows.length)||i===rows.length-1);
      const labels=labelIndices.map((i,j)=>`<text class="${j%2&&j<labelIndices.length-1?'wc-dash-chart-date-secondary':''}" x="${x(i)}" y="201" text-anchor="middle">${esc(rows[i].date.slice(5))}</text>`).join('');
      return `<section class="wc-card wc-compact-card wc-compact-chart"><div class="wc-dash-chart-body">${header}
        <svg class="wc-chart wc-dash-chart" viewBox="0 0 900 211" role="img" aria-label="按创建和验收日期统计的任务趋势">
          ${axes}${chartMode==='line'?lines:bars}${labels}
        </svg>
      </div></section>`;
    }
    function performanceCards(c,summary,statistics) {
      const metrics=[
        ...(!summary?[['任务完成率',percent(c.completionRate),'tasks'],['日报提交率',percent(c.reportRate),'reports']]:[]),
        ['按时首次提交率',percent(c.onTimeSubmissionRate),'tasks'],
        ['按时验收完成率',percent(c.onTimeCompletionRate),'completed'],
        ...(statistics?[
          ['按时有效提交率',percent(c.validSubmissionRate),'tasks'],
          ['当前逾期率',percent(c.overdueRate),'overdue'],
          ['验收通过率',percent(c.reviewPassRate),'acceptance'],
          ['本期验收工作量',c.completedEvents,'completed']
        ]:[])
      ];
      return compactCard('执行指标',`<div class="wc-dash-rates">${metrics.map(([label,value,action])=>dashboardMetric(label,value,action)).join('')}</div>`);
    }
    function analysisCards() {
      const byRole=data.options.roles.map(role=>({
        role,people:data.people.filter(p=>p.role===role),
        tasks:data.tasks.filter(t=>data.people.find(p=>p.id===t.assignee)?.role===role)
      }));
      const shopRows=data.options.shops.map(s=>({shop:s,rows:data.tasks.filter(t=>t.shop_id===s.id)})).filter(x=>x.rows.length);
      const ranked=[...data.people].sort((a,b)=>b.metrics.completedEvents-a.metrics.completedEvents||b.workCount-a.workCount).slice(0,10);
      return `
        ${dashboardCard('员工统计',peopleTable())}
        <div class="wc-dash-two">
          ${dashboardCard('岗位统计',table(['岗位','人数','承接任务','已验收完成','待验收'],byRole.map(r=>[r.role,r.people.length,r.tasks.length,r.tasks.filter(t=>t.state==='已完成').length,r.tasks.filter(t=>t.state==='待验收').length]),true))}
          ${dashboardCard('店铺统计',table(['店铺','独立任务','子任务','已验收完成'],shopRows.map(({shop,rows})=>[esc(shop.name),rows.filter(t=>!t.parent_id).length,rows.filter(t=>t.parent_id).length,rows.filter(t=>t.state==='已完成').length]),true))}
        </div>
        ${dashboardCard('工作量参考榜',table(['员工','验收完成事项','自主工作记录'],ranked.map(p=>[personCell(p),p.metrics.completedEvents,p.workCount]),true))}
        <p class="wc-small">取消任务不进入完成率。父子任务分别计数。延期保留原截止时间与修改记录。工作量仅作参考，不直接等于绩效。</p>
      `;
    }
    function organizationSettings(){
      const rows=data.people.map(p=>[
        esc(p.name),esc(p.orgRole),esc(p.role),esc(p.parentName||'—'),esc(p.teamName)
      ]);
      return `<details class="wc-card wc-organization" data-organization-settings ${organizationOpen?'open':''}>
        <summary>组织关系</summary>
        <p class="wc-muted">人员、岗位和店铺在组织中心维护。直属上级按组织中心的职级顺序查找，空缺时顺延。</p>
        ${toolbar(true)}${table(['员工','组织岗位','工作中心角色','直属上级','所属团队'],rows)}
      </details>`;
    }
    function reportPolicySettings(s){
      return card('日报与提醒规则',`<form data-form="policy" class="wc-form">
        ${field('日报截止时间（北京时间）','deadline','time',s.deadline)}
        ${field('验收超时提醒（小时）','reviewHours','number',s.reviewHours,false,'min="1" max="720"')}
        ${field('重点任务未更新站内提示（小时）','staleHours','number',s.staleHours,false,'min="1" max="720"')}
        ${select('允许补交','allowLate',[{id:'true',name:'允许并标记迟交'},{id:'false',name:'不允许'}],String(s.allowLate),null)}
        <fieldset class="wc-field full wc-report-roles">
          <legend>需要日报的岗位</legend>
          <div class="wc-checks">${data.options.roles.map(r=>`<label><input type="checkbox" name="reportRoles" value="${esc(r)}" ${s.reportRoles.includes(r)?'checked':''}>${esc(r)}</label>`).join('')}</div>
        </fieldset>
        <div class="wc-field full"><span>填报工作日</span><div class="wc-checks">${['周日','周一','周二','周三','周四','周五','周六'].map((r,i)=>`<label><input type="checkbox" name="weekdays" value="${i}" ${s.weekdays.includes(i)?'checked':''}>${r}</label>`).join('')}</div></div>
        ${field('例外休息日（逗号分隔，YYYY-MM-DD）','restDays','text',s.restDays.join(', '),true)}
        <div class="wc-field full"><button type="submit" class="wc-btn primary">保存规则</button></div>
      </form>`);
    }
    function settingsPage(){const s=data.settings;return `${organizationSettings()}${reportPolicySettings(s)}${reminderSettings(s)}${card('任务分类与附件要求',`<form data-form="categories" class="wc-form">${field('任务分类（每行一个；删除代表停用，历史保留）','categories','textarea',s.categories.join('\n'),true)}${field('必须附成果文件的分类（每行一个）','requiredAttachmentCategories','textarea',s.requiredAttachmentCategories.join('\n'),true)}<button type="submit" class="wc-btn primary">保存分类</button></form>`)}${card('任务模板',table(['模板','分类','说明','操作'],(s.taskTemplates||[]).map((t,i)=>[esc(t.title),esc(t.category),esc(t.description)+imageCards(t.composerImages,'settings'),link('删除模板','removeTemplate',i)])),btn('新建模板','newTemplate'))}${card('岗位日报模板',`<form data-form="reportTemplates" class="wc-form">${data.options.roles.map(r=>field(r+'补充栏目（每行一个）','fields_'+r,'textarea',(s.reportFields[r]||[]).join('\n'))).join('')}<div class="wc-field full"><button class="wc-btn primary" type="submit">保存日报模板</button></div></form>`)}${card('原有工作设置',`<p class="wc-muted">已有部门事项模板、店铺填报项目与钉钉配置继续保留。</p>`,btn('部门模板','legacy','',`data-id="settings"`)+btn('店铺日报设置','legacy','',`data-id="diarySettings"`))}${card('设置操作日志',table(['时间','操作人','原因','详情'],(s.history||[]).slice().reverse().map((h,i)=>[esc(when(h.at)),esc(name(h.actor)),esc(h.reason),link('查看变更','audit',s.history.length-1-i)])))}`;}
    function name(id){return data.options.people.find(p=>p.id===String(id))?.name||data.options.assignees.find(p=>p.id===String(id))?.name||String(id||'—');}
    function paint(){
      organizationOpen=root.querySelector('[data-organization-settings]')?.open??organizationOpen;
      const tabs=(data.tabs||[])
        .filter(t=>!dashboardTabs.has(t.tab)&&can(t.id.slice(5))&&(t.tab!=='settings'||data.canManage))
        .map(t=>t.tab==='acceptance'?['tasks','任务管理']:[t.tab,t.name])
        .filter(([id],index,rows)=>rows.findIndex(([key])=>key===id)===index);
      if(dashboardAvailable())tabs.unshift(['overview','工作总览']);
      if(!tabs.some(([id])=>id===tab))tab=tabs[0]?.[0]||'';
      if(tab==='tasks'&&!can(taskView==='acceptance'?'acceptance':'tasks')){taskView=can('tasks')?'list':'acceptance';mode='all';page=1;}
      const body=!tab?empty('尚未开放工作功能','请在组织中心配置工作中心的功能与操作权限。')
        :tab==='overview'?overview():tab==='people'?people():tab==='tasks'?tasks():tab==='reports'?reports():settingsPage();
      root.innerHTML=`<main class="wc${tab==='overview'?' wc-overview-page':''}"><header class="wc-head">${tab==='overview'?'':`<div><div class="wc-eyebrow">甄选未来 · WORK CENTER</div><h1>工作中心</h1><p class="wc-muted">${data.me.role==='总监'?'掌握全公司工作，覆盖各部门与团队。':'查看管理范围与个人任务，跟进工作结果。'}</p></div>`}<div class="wc-actions">${badge(data.me.name+' · '+data.me.role,'blue')}${btn('消息 '+(data.notices.filter(n=>!n.readAt).length+data.alerts.length),'notifications')}${btn('登记工作','newWork')}${data.canPublish?btn('发布任务','publish','primary'):btn('写日报','writeDaily','primary')}</div></header><nav class="wc-nav" aria-label="工作中心导航">${tabs.map(([id,label])=>`<button data-action="tab" data-id="${id}" class="${tab===id?'active':''}" aria-current="${tab===id?'page':'false'}">${label}${tabBadgeLabels[id]?`<span class="wc-nav-count" data-wc-tab-count="${id}" hidden></span>`:''}</button>`).join('')}</nav>${tab==='settings'||tab==='overview'||!tab?'':toolbar()}<div data-wc-body>${body}</div><footer class="wc-foot"><span>北京时间 · 数据来自组织、任务及工作记录</span>${tab==='overview'?'':btn('刷新数据','refresh')}</footer></main>`;
      root.querySelectorAll('form').forEach(form=>window.XmWorkRich.upgrade(form));
      applyPermissions();
      paintTabBadges();
    }
    function fileInput(label='其他附件（与正文图片合计最多 3 个、3 MB）'){return `<label class="wc-field full"><span>${label}</span><input type="file" name="files" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.pdf,.txt,.csv,.xls,.xlsx,.doc,.docx,.ppt,.pptx,.zip"><small class="wc-small">任务说明、验收要求中可直接粘贴图片；这里添加其他附件。</small><div data-file-previews></div></label>`;}
    function formEnd(label='保存'){return `<div class="wc-field full"><div data-form-error role="alert"></div><div class="wc-actions"><button class="wc-btn primary" type="submit">${label}</button>${btn('取消','close')}</div></div></form>`;}
    function setupFiles(form){const input=form.querySelector('[name=files]');if(!input)return;let files=[],urls=[];input._wtFiles=files;const box=form.querySelector('[data-file-previews]');function draw(){input._wtFiles=files;urls.forEach(URL.revokeObjectURL);urls=[];box.innerHTML=files.map((f,i)=>{const url=f.type.startsWith('image/')?URL.createObjectURL(f):'';if(url)urls.push(url);return `<span class="wc-inline-image">${url?`<img src="${url}" alt="${esc(f.name)}">`:esc(f.name)}<button type="button" data-remove-file="${i}" aria-label="移除${esc(f.name)}">×</button></span>`;}).join('');}function add(newFiles){if(files.length+(form._wtInlineFiles?.().length||0)+newFiles.length>3||[...files,...(form._wtInlineFiles?.()||[]),...newFiles].reduce((n,f)=>n+f.size,0)>3*1024*1024){notify('附件最多 3 个，合计 3 MB',true);return;}files.push(...newFiles);draw();}input.addEventListener('change',()=>{add([...input.files]);input.value='';});box.addEventListener('click',e=>{const b=e.target.closest('[data-remove-file]');if(b){files.splice(Number(b.dataset.removeFile),1);draw();}});form.addEventListener('paste',e=>{if(e.defaultPrevented||e.target.closest('.wt-rich-field'))return;const pasted=[...(e.clipboardData?.files||[])].filter(f=>f.type.startsWith('image/'));if(pasted.length){e.preventDefault();add(pasted);}});form._files=()=>files;dialog.addEventListener('close',()=>urls.forEach(URL.revokeObjectURL),{once:true});}
    async function publish(parent=null){
      if(window.XmWorkRich?.version!=="chat-input-1") { try { await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/shared/modules/work-tasks.js?v=20261123-chat-input-1';script.onload=resolve;script.onerror=()=>reject(new Error('图文编辑器加载失败，请重试'));document.head.appendChild(script);}); } catch(error){notify(error.message,true);return;} }
      window.XmWorkRich.style();
const start=filters.to===data.today?new Date(Date.now()+8*3600000).toISOString().slice(0,16):data.today+'T09:00';modal(parent?'拆分子任务':'发布任务',`<div class="wc-note">${parent?'父任务：'+esc(parent.title)+'。子任务完成后，父任务仍需单独验收。':'所属团队按负责人自动记录；实际发布人始终保留。'}</div><form class="wc-form" data-form="publish" data-key="${crypto.randomUUID()}" data-parent="${esc(parent?.id||'')}">${data.settings.taskTemplates?.length?select('套用任务模板','template',data.settings.taskTemplates.map((t,i)=>({id:i,name:t.title})),'','不使用模板',true):''}${field('任务标题 *','title','text','',true,'required maxlength="200"')}${select('负责人 *','assignee',data.options.assignees.map(p=>({id:p.id,name:p.name+' · '+p.teamName})))}${select('验收人 *','reviewer',data.options.reviewers,data.me.id,null)}${select('关联店铺','shop_id',data.options.shops,'','不关联店铺')}${select('任务分类','category',data.settings.categories,'',null)}${select('优先级','priority',['普通','高','紧急','低'],'普通',null)}${field('计划开始 *','start_at','datetime-local',start,false,'required')}${field('截止时间 *','due_at','datetime-local',data.today+'T18:00',false,'required')}${collaboratorPicker(data.options.assignees)}<div class="wc-field full">${window.XmWorkRich.editor('任务说明','description',4000)}</div><div class="wc-field full">${window.XmWorkRich.editor('验收要求','criteria',2000)}</div><div class="wt-rich-message wc-field full" data-rich-message role="status"></div>${fileInput()}${formEnd('发布任务')}`);const form=dialog.querySelector('form');bindCollaboratorPicker(form);setupFiles(form);window.XmWorkRich.bind(form);form.querySelector('[name=assignee]').addEventListener('change',()=>{const p=data.options.assignees.find(x=>x.id===form.assignee.value);const reviewers=data.options.reviewers.filter(r=>p?.reviewerIds.includes(r.id));form.reviewer.innerHTML=opts(reviewers,data.me.id,null);form.shop_id.innerHTML=opts(data.options.shops.filter(s=>p?.shops.includes(s.name)),'','不关联店铺');});form.querySelector('[name=template]')?.addEventListener('change',e=>{const t=data.settings.taskTemplates[Number(e.target.value)];if(!t||e.target.value==='')return;for(const k of ['title','description','criteria','category','priority']){if(form.elements[k])form.elements[k].value=t[k]||'';const editor=form.querySelector('[data-rich-editor="'+k+'"]');if(editor)editor.value=t[k]||'';}hydrateImages(form,{...t,id:'settings'});});}
    const taskImageMime=/^image\/(?:png|jpeg|gif|webp|bmp)$/i;
    const taskImageExtension=/\.(?:png|jpe?g|gif|webp|bmp)$/i;
    function taskFileButton(file){
      return btn(file.name||'下载附件','file','',`data-id="${esc(file.id)}"`);
    }
    function taskImage(src,label,fallback='图片暂不可用'){
      return `<figure class="wc-task-image"><button type="button" class="wc-task-image-preview" data-action="previewComposer" data-src="${esc(src)}" aria-label="放大查看 ${esc(label)}" title="点击放大"><img src="${esc(src)}" alt="${esc(label)}" loading="lazy" decoding="async"></button><span data-task-image-fallback hidden>${fallback}</span></figure>`;
    }
    function taskFileImage(file){
      const src='/api/work/tasks/file?'+new URLSearchParams({id:file.id,inline:'1'});
      return taskImage(src,file.name||'任务图片',taskFileButton(file));
    }
    function taskFiles(files){
      const images=[],attachments=[];
      for(const file of files||[]){
        const image=taskImageMime.test(file.mime)||((!file.mime||file.mime==='application/octet-stream')&&taskImageExtension.test(file.name));
        if(image)images.push(taskFileImage(file));
        else attachments.push(taskFileButton(file));
      }
      return images.join('')+(attachments.length?`<div class="wc-actions wc-task-files">${attachments.join('')}</div>`:'');
    }
    function taskComposerImages(images,taskId,field){
      return (images||[]).filter(image=>!field||image.field===field)
        .map(image=>taskImage(imageUrl(image,taskId,true),image.name||'任务图片')).join('');
    }
    function taskBody(task,field){
      const doc=task[field+'_doc'];
      const content=doc?.length?doc.map(node=>{
        if(node.type==='text')return `<div class="wc-text">${esc(node.text)}</div>`;
        if(node.type==='image')return taskFileImage((task.files||[]).find(file=>file.id===node.fileId)||{id:node.fileId});
        return '';
      }).join(''):task[field]?`<p class="wc-text">${esc(task[field])}</p>`:'';
      return content+taskComposerImages(task.composerImages,task.id,field)||'<p class="wc-small">—</p>';
    }
    function taskOutcomeLinks(event){
      const links=event.changes?.links;
      if(!Array.isArray(links))return '';
      const valid=links.filter(url=>typeof url==='string'&&/^https?:\/\//i.test(url));
      return valid.length?`<ul class="wc-task-links">${valid.map(url=>`<li><a target="_blank" rel="noopener noreferrer" href="${esc(url)}">${esc(url)}</a></li>`).join('')}</ul>`:'';
    }
    function taskEventContent(task,event){
      return (event.note?`<p class="wc-text">${esc(event.note)}</p>`:'')+
        taskComposerImages(event.composerImages,task.id)+taskFiles(event.files)+taskOutcomeLinks(event);
    }
    function taskExecution(task){
      const events=task.events||[];
      const assignment=events.findLastIndex(event=>event.changes?.assignee);
      const current=events.slice(assignment+1).filter(event=>String(event.actor)===String(task.assignee));
      const progress=current.findLast(event=>event.action==='更新进度');
      const outcome=current.findLast(event=>event.action==='提交检查');
      const show=(label,event)=>event?`<div class="wc-task-execution"><h4>${label}</h4><div class="wc-small">${esc(when(event.at))}</div>${taskEventContent(task,event)}</div>`:'';
      return card('执行内容与成果',`<div class="wc-small">执行人 · ${esc(outcome?.actor_name||progress?.actor_name||task.assigneeName)}</div>${progress||outcome?show('最近执行进度',progress)+show('提交成果',outcome):'<p class="wc-muted">暂未记录执行内容或提交成果</p>'}`);
    }
    function taskHistory(task){
      const labels={due_at:'截止时间',assignee:'负责人',reviewer:'验收人',title:'标题',progress:'进度',team_id:'团队',description:'说明',criteria:'验收要求'};
      const events=(task.events||[]).slice().reverse().map(event=>{
        const actor=event.actor_name||(event.actor===task.publisher?task.publisherName:event.actor===task.assignee?task.assigneeName:event.actor===task.reviewer?task.reviewerName:name(event.actor));
        const changes=Object.entries(event.changes||{}).filter(([key])=>key!=='links').map(([key,value])=>
          `<div class="wc-small">${esc(labels[key]||key)}：${esc(value?.before)} → ${esc(value?.after)}</div>`).join('');
        return `<div class="wc-event"><div class="wc-small">${esc(when(event.at))} · ${esc(actor)}</div><b>${esc(event.action)}</b>${taskEventContent(task,event)}${changes}</div>`;
      });
      return card('操作历史',`<div class="wc-timeline">${events.join('')}</div>`);
    }
    async function taskDetail(id){
      let detail;
      try{detail=await api('center/tasks/'+encodeURIComponent(id));}
      catch(e){notify(e.message,true);return;}
      const task=detail.task,children=detail.children;
      taskCache.set(task.id,task);
      children.forEach(child=>taskCache.set(child.id,child));
      const bodyImages=new Set([...(task.description_doc||[]),...(task.criteria_doc||[])].filter(node=>node.type==='image').map(node=>node.fileId));
      const attachments=taskFiles((task.files||[]).filter(file=>!bodyImages.has(file.id)));
      const labels={start:'开始执行',progress:'更新进度',submit:'提交成果',approve:'验收通过',return:'退回修改',edit:'修改 / 延期',cancel:'取消任务',review:'管理复核',split:'拆分子任务',confirmTeam:'确认历史团队'};
      const actions=task.actions.map(action=>btn(labels[action],'taskAction',['submit','approve','start'].includes(action)?'primary':action==='cancel'?'danger':'',`data-id="${esc(id)}" data-kind="${action}"`)).join('');
      const metadata=[['负责人',task.assigneeName],['实际发布人',task.publisherName],['验收人',task.reviewerName],
        ['归属团队',task.team_name||'历史归属待确认'],['计划开始',when(task.start_at)],['截止时间',when(task.due_at)],
        ['原截止时间',when(task.original_due_at||task.due_at)],['首次提交',when(task.first_submitted_at)],['验收完成',when(task.completed_at)]];
      modal(task.title,`<div class="wc-badges" style="margin-bottom:16px">${status(task.state)}${task.overdue?badge('已逾期','red'):''}${task.returned?badge('退回 '+task.return_count+' 次','orange'):''}${badge(task.priority||'普通')}${task.parent_id?link('查看父任务','task',task.parent_id):badge('独立任务','blue')}</div>
        <div class="wc-detail-grid">${metadata.map(([label,value])=>`<div><small>${label}</small>${esc(value)}</div>`).join('')}</div>
        <section class="wc-task-section"><h3>任务说明</h3><div class="wc-rich">${taskBody(task,'description')}</div></section>
        <section class="wc-task-section"><h3>验收要求</h3><div class="wc-rich">${taskBody(task,'criteria')}</div></section>
        ${attachments?`<section class="wc-task-section"><h3>任务附件</h3>${attachments}</section>`:''}
        ${taskExecution(task)}${children.length?card('子任务',taskTable(children)):''}
        <div class="wc-actions" style="margin:18px 0">${actions}${btn('反馈问题','newIssue','',`data-id="${esc(id)}"`)}</div>
        ${taskHistory(task)}`);
    }
    function taskAction(id,kind){const t=taskCache.get(id)||data.tasks.find(t=>t.id===id);if(!t)return;if(kind==='split'){publish(t);return;}if(kind==='start'){mutate('tasks/action',{id,action:kind,revision:t.revision});return;}const title=({progress:'更新进度',submit:'提交成果',approve:'验收通过',return:'退回修改',edit:'修改任务 / 申请延期',cancel:'取消任务',review:'管理复核',confirmTeam:'确认历史任务团队'})[kind];let body='';if(kind==='progress')body=field('完成进度（0～100）','progress','number',t.progress||0,false,'min="0" max="100" required')+select('执行情况','blocked',[{id:'false',name:'正常执行'},{id:'true',name:'遇到阻碍'}],String(Boolean(t.blocked)),null);if(kind==='edit')body=field('任务标题','title','text',t.title,true,'required')+select('负责人','assignee',data.options.assignees.some(p=>p.id===t.assignee)?data.options.assignees:[{id:t.assignee,name:t.assigneeName},...data.options.assignees],t.assignee,null)+select('验收人','reviewer',data.options.reviewers.some(p=>p.id===t.reviewer)?data.options.reviewers:[{id:t.reviewer,name:t.reviewerName},...data.options.reviewers],t.reviewer,null)+field('新的截止时间','due_at','datetime-local',t.due_at)+select('优先级','priority',['普通','高','紧急','低'],t.priority||'普通',null)+field('任务说明','description','textarea',t.description,true)+field('验收要求','criteria','textarea',t.criteria,true);if(kind==='confirmTeam')body=select('任务当时所属主管','supervisor_id',data.options.people.filter(p=>p.role==='主管'));body+=field(kind==='submit'?'执行内容与成果说明 *':kind==='return'?'退回原因 *':kind==='edit'?'修改原因 *':'说明 / 验收意见','note','textarea','',true,kind==='approve'?'':'required');if(kind==='submit')body+=field('成果链接（每行一个 https / http 链接）','links','textarea','',true)+fileInput();modal(title,`<form data-form="taskAction" data-id="${id}" data-kind="${kind}" data-revision="${t.revision}" class="wc-form">${body}${formEnd(title)}</form>`);if(kind==='submit')setupFiles(dialog.querySelector('form'));if(kind==='edit')hydrateImages(dialog.querySelector('form'),t,true);}
    async function mutate(path,body,method){try{await api(path,body,method);closeDialog();notify('已保存');await reload();}catch(e){notify(e.message,true);}}
    function teamSnapshot(team){return team?`<details><summary>团队日结快照 · ${esc(team.name)} · ${team.tasks.length} 项任务</summary>${table(['团队任务','负责人','状态','进度'],team.tasks.map(t=>[link(t.title,'task',t.id),esc(t.assigneeName),status(t.status),t.progress+'%']))}<p class="wc-small">自主工作 ${team.work.length} 项 · 团队问题 ${team.issues.length} 项 · 应交日报 ${team.members.filter(p=>p.required).length} 人 / 已交 ${team.members.filter(p=>p.required&&p.submitted).length} 人</p></details>`:'';}
    function writeDaily(){const draft=drafts[filters.to]||data.currentDaily?.notes||{},fields=data.settings.reportFields[data.me.role]||['今日工作','遇到的问题','明日计划'];modal('填写 '+filters.to+' 日报',`<div class="wc-note">已自动关联 ${data.draft.tasks.length} 项任务、${data.draft.work.length} 项自主工作。提交时保存快照；任务状态需在任务中更新。</div><details><summary>查看自动关联任务</summary>${table(['任务','状态','进度'],data.draft.tasks.map(t=>[esc(t.title),status(t.status),t.progress+'%']))}</details>${teamSnapshot(data.draft.team)}<form data-form="daily" data-revision="${data.currentDaily?.revision||0}" class="wc-form">${fields.map((f,i)=>field(f,'note'+i,'textarea',draft[f]||'',true,`data-label="${esc(f)}"`)).join('')}<div class="wc-field full"><div data-form-error role="alert"></div><div class="wc-actions">${!data.currentDaily?.submittedAt?'<button class="wc-btn" type="submit" name="submitMode" value="draft">保存草稿</button>':''}<button class="wc-btn primary" type="submit" name="submitMode" value="submit">提交日报${['经理','主管'].includes(data.me.role)?'与管理日结':''}</button></div></div></form>`);hydrateImages(dialog.querySelector('form'),data.currentDaily);dialog.querySelector('form').addEventListener('input',()=>{drafts[filters.to]=Object.fromEntries([...dialog.querySelectorAll('[data-label]')].map(el=>[el.dataset.label,el.value]));});}
    function dailyDetail(id){const r=dailyCache.get(id)||data.dailies.find(x=>x.id===id);if(!r)return;const report=v=>`<p class="wc-muted">${esc(v.personName)} · ${esc(v.date)} · ${esc(v.teamName)} · 版本 ${v.revision||r.revision}</p>${table(['关联任务','提交时状态','进度'],(v.snapshot?.tasks||[]).map(t=>[link(t.title,'task',t.id),status(t.status),t.progress+'%']))}${teamSnapshot(v.snapshot?.team)}${(v.snapshot?.work||[]).length?card('自主工作快照',workTable(v.snapshot.work)):''}${Object.entries(v.notes||{}).map(([k,text])=>`<h3 style="margin-top:16px">${esc(k)}</h3><p class="wc-text">${esc(text||'—')}</p>${imageCards(v.composerImages,r.id,k)}`).join('')}`;modal('工作日报',report(r)+(r.history?.length?`<details><summary>历史版本（${r.history.length}）</summary>${r.history.slice().reverse().map(v=>`<div class="wc-version">${report(v)}</div>`).join('')}</details>`:''));}
    function newWork(existing=null){const w=existing||{};modal(existing?'编辑自主工作':'登记自主工作',`<form data-form="work" data-id="${esc(w.id||crypto.randomUUID())}" data-revision="${w.revision||0}" class="wc-form">${field('工作事项 *','title','text',w.title||'',true,'required maxlength="200"')}${field('工作日期','date','date',w.date||filters.to,false,`max="${data.today}" required`)}${select('关联店铺','shopId',data.options.shops,w.shopId||'','不关联店铺')}${select('工作类型','category',['自主工作','员工培养','问题排查','其他'],w.category||'自主工作',null)}${field('实际完成时间（手动记录）','completedAt','datetime-local',w.completedAt||'')}${field('执行内容','content','textarea',w.content||'',true)}${field('工作成果','result','textarea',w.result||'',true)}${formEnd('保存工作记录')}`);hydrateImages(dialog.querySelector('form'),w);}
    function newIssue(taskId=''){modal('反馈问题',`<form data-form="issue" data-task="${esc(taskId)}" class="wc-form">${field('问题标题 *','title','text','',true,'required')}${field('问题描述','description','textarea','',true)}${field('影响范围','impact','textarea')}${field('已尝试措施','attempts','textarea')}${field('需要谁协助 / 协助事项','assistance','textarea','',true)}${select('处理级别','escalated',[{id:'false',name:'团队内处理'},{id:'true',name:'紧急，需要上级协调'}],'false',null)}${formEnd('提交问题')}`);}
    function issueDetail(id){const r=data.issues.find(i=>i.id===id);if(!r)return;modal(r.title,`<p>${esc(r.personName)} · ${esc(r.teamName)} ${status(r.status)}</p>${[['问题描述',r.description,'description'],['影响范围',r.impact,'impact'],['已尝试措施',r.attempts,'attempts'],['需要协助',r.assistance,'assistance']].map(([k,v,field])=>`<h3 style="margin-top:14px">${k}</h3><p class="wc-text">${esc(v||'—')}</p>${imageCards(r.composerImages,r.id,field)}`).join('')}<form data-form="resolveIssue" data-id="${r.id}" data-revision="${r.revision}" class="wc-form" style="margin-top:18px">${field('处理措施 *','resolution','textarea',r.resolution||'',true,'required')}${select('处理结果','status',['处理中','已解决'],r.status==='已解决'?'已解决':'处理中',null)}${formEnd('保存处理结果')}</form><div class="wc-timeline">${(r.history||[]).map(e=>`<div class="wc-event"><small>${esc(when(e.at))} · ${esc(name(e.actor))}</small><p>${esc(e.resolution)}</p>${imageCards(e.composerImages,r.id)}</div>`).join('')}</div>`);hydrateImages(dialog.querySelector('form'),r);}
    async function personDetail(id){try{const detail=await api('center?'+new URLSearchParams({...filters,person:id}));const p=detail.people.find(p=>p.id===id);if(!p)return;detail.works.forEach(w=>workCache.set(w.id,w));detail.dailies.forEach(r=>dailyCache.set(r.id,r));modal(p.name+'的工作',`<div class="wc-note">${esc(p.role)} · ${esc(p.teamName)} · ${esc(p.visibleShops.join('、')||'未关联店铺')}</div>${card('接收的任务',taskTable(detail.tasks))}${card('发布的任务',taskTable(detail.publishedTasks||[]))}${card('自主工作',workTable(detail.works.filter(w=>w.personId===id)))}${card('工作日报',dailyTable(detail.dailies.filter(r=>r.personId===id)))}${card('每日工作时间线',timeline(detail.timeline))}`);}catch(e){notify(e.message,true);}}
    function newTemplate(){modal('新建任务模板',`<form data-form="template" class="wc-form">${field('模板标题 *','title','text','',true,'required')}${select('分类','category',data.settings.categories,'',null)}${select('优先级','priority',['普通','高','紧急','低'],'普通',null)}${field('任务说明','description','textarea','',true)}${field('验收要求','criteria','textarea','',true)}${formEnd('保存模板')}`);}
    function notifications(){modal('消息与提醒',card('当前待处理',alerts())+card('工作消息',data.notices.length?data.notices.slice().reverse().map(n=>`<div class="wc-version"><b>${esc(n.title)}</b> ${n.readAt?'':badge('未读','blue')}<p>${esc(n.text)}</p><div class="wc-small">${esc(when(n.createdAt))}</div>${n.readAt?'':btn('标为已读','readNotice','',`data-id="${n.id}"`)}</div>`).join(''):empty('暂无工作消息')));}
    function legacy(tab){modal('原有工作汇报',`<div class="wc-legacy" data-legacy-host></div>`);legacyCleanup=window.XmWorkLegacy.mount(dialog.querySelector('[data-legacy-host]'),tab);}
    async function file(id){try{const f=await api('tasks/file?id='+encodeURIComponent(id));const bytes=Uint8Array.from(atob(f.data),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:f.mime}),url=URL.createObjectURL(blob);if(/^image\/(png|jpeg|webp|gif)$/.test(f.mime)){const img=document.createElement('img');img.src=url;img.alt=f.name;img.style='max-width:100%;display:block;margin:auto';modal(f.name,'<div data-image></div>');dialog.querySelector('[data-image]').appendChild(img);dialog.addEventListener('close',()=>URL.revokeObjectURL(url),{once:true});}else{const a=document.createElement('a');a.href=url;a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}}catch(e){notify(e.message,true);}}
    root.addEventListener('error',e=>{
      if(!e.target.matches('.wc-task-image img'))return;
      const preview=e.target.closest('.wc-task-image');
      e.target.parentElement.hidden=true;
      preview.querySelector('[data-task-image-fallback]').hidden=false;
    },{capture:true,signal:abort.signal});
    root.addEventListener('click',async e=>{const el=e.target.closest('[data-action]');if(!el||!root.contains(el))return;const action=el.dataset.action,id=el.dataset.id;if(!actionAllowed(action,id,el.dataset.kind)){notify('组织中心未授予此操作权限',true);return;}if(action==='previewComposer'){window.XmWorkRich.preview(dialog||root,el.dataset.src,'图片');return;}if(action==='close'){closeDialog();return;}if(action==='refresh'){await reload();return;}if(action==='chartMode'){
        if(!can('statistics'))return;
        chartMode=el.dataset.mode==='line'?'line':'bar';paint();
        root.querySelector('[data-action="chartMode"][aria-pressed="true"]')?.focus({preventScroll:true});
        return;
      }
      if(action==='dashboardDetail'){dashboardDetail(id);return;}
      if(action==='dashboardSwitch'){
        if(el.dataset.kind==='distribution')distributionMode=id==='board'?'board':'team';
        else dailyMode=id==='missing'?'missing':'submitted';
        paint();
        root.querySelector('[data-action="dashboardSwitch"][data-kind="'+el.dataset.kind+'"][aria-pressed="true"]')?.focus({preventScroll:true});
        return;
      }
      if(action==='dashboardScope'){
        if(el.dataset.kind==='board'){filters.board=id;filters.team='';}
        else if(el.dataset.kind==='team')filters.team=id;
        else {for(const key of ['board','team','role','shop'])filters[key]='';}
        filters.person='';filters.department='';
        await reload();
        return;
      }if(action==='taskView'){closeDialog();tab='tasks';taskView=id;mode='all';page=1;search='';paint();return;}if(action==='tab'){closeDialog();tab=id==='acceptance'?'tasks':id;taskView=id==='acceptance'?'acceptance':'list';mode='all';page=1;search='';paint();return;}if(['overview','people','tasks','reports','acceptance'].includes(action)){tab=action==='acceptance'?'tasks':action;taskView=action==='acceptance'?'acceptance':'list';mode='all';page=1;search='';paint();return;}if(['overdue','completed'].includes(action)){tab='tasks';taskView='list';mode=action;page=1;search='';paint();return;}if(action==='today'||action==='week'){const end=data.today;filters.to=end;filters.from=action==='today'?end:new Date(Date.parse(end)-6*86400000).toISOString().slice(0,10);await reload();return;}if(action==='board'){closeDialog();filters.board=id;filters.team='';filters.person='';filters.department='';tab='people';await reload();return;}if(action==='team'){closeDialog();filters.team=id;tab='people';await reload();return;}if(action==='mode'){mode=id;page=1;paint();return;}if(action==='prev'||action==='next'){page=Math.max(1,page+(action==='prev'?-1:1));paint();return;}if(action==='task')await taskDetail(id);if(action==='person')await personDetail(id);if(action==='publish')publish();if(action==='taskAction')taskAction(id,el.dataset.kind);if(action==='writeDaily')writeDaily();if(action==='daily')dailyDetail(id);if(action==='newWork')newWork();if(action==='work'){const w=workCache.get(id)||data.works.find(w=>w.id===id);if(w?.personId===data.me.id&&can('records','edit'))newWork(w);else if(w)modal(w.title,`<p>${esc(w.personName)} · ${esc(w.date)}</p><h3>执行内容</h3><p class="wc-text">${esc(w.content)}</p><h3>工作成果</h3><p class="wc-text">${esc(w.result)}</p>${imageCards(w.composerImages,w.id)}`);}if(action==='newIssue')newIssue(id||'');if(action==='issue')issueDetail(id);if(action==='newTemplate')newTemplate();if(action==='removeTemplate'){const list=data.settings.taskTemplates.filter((_,i)=>i!==Number(id));await mutate('center/settings',{revision:data.settings.revision||0,taskTemplates:list,reason:'停用任务模板'},'PUT');}if(action==='audit'){const h=data.settings.history[Number(id)];modal('设置变更记录',`<p>${esc(when(h.at))} · ${esc(name(h.actor))}</p><p>${esc(h.reason)}</p>${imageCards(h.composerImages,'settings')}<h3>修改前</h3><pre class="wc-text">${esc(JSON.stringify(h.before,null,2))}</pre><h3>修改后</h3><pre class="wc-text">${esc(JSON.stringify(h.after,null,2))}</pre>`);}if(action==='reminderStatus')await showReminderStatus();if(action==='notifications')notifications();if(action==='readNotice')await mutate('center/notices/read',{id});if(action==='legacy')legacy(id);if(action==='file')await file(id);if(action==='export'){const a=document.createElement('a');a.href='/api/work/center/export?'+new URLSearchParams(filters);a.download='工作统计.xlsx';a.click();}}, {signal:abort.signal});
    root.addEventListener('change',async e=>{
      if(!e.target.matches('[data-quick-range]')||!e.target.value)return;const end=data.today,value=e.target.value;let from=end,to=end;if(value==='yesterday')from=to=new Date(Date.parse(end)-86400000).toISOString().slice(0,10);if(value==='30days')from=new Date(Date.parse(end)-29*86400000).toISOString().slice(0,10);if(value==='month')from=end.slice(0,8)+'01';if(value==='lastmonth'){to=new Date(Date.parse(end.slice(0,8)+'01')-86400000).toISOString().slice(0,10);from=to.slice(0,8)+'01';}filters.from=from;filters.to=to;page=1;await reload();},{signal:abort.signal});
    root.addEventListener('submit',async e=>{const form=e.target.closest('[data-form]');if(!form)return;e.preventDefault();const kind=form.dataset.form,fd=new FormData(form),values=Object.fromEntries(fd),submitter=e.submitter;if(kind==='filter'){for(const key of Object.keys(filters))if(fd.has(key))filters[key]=values[key];page=1;await reload();return;}if(kind==='search'){search=values.search;page=1;paint();return;}const buttons=[...form.querySelectorAll('button[type=submit]')];buttons.forEach(b=>b.disabled=true);const error=form.querySelector('[data-form-error]');if(error)error.innerHTML='';try{let path,body,method='POST';if(kind==='publish'){path='tasks/publish';body={...values,id:form.dataset.key,parent_id:form.dataset.parent,collaborators:fd.getAll('collaborators')};delete body.files;delete body.template;}if(kind==='taskAction'){path='tasks/action';body={...values,id:form.dataset.id,revision:Number(form.dataset.revision),action:form.dataset.kind,blocked:values.blocked==='true',links:String(values.links||'').split('\n').map(s=>s.trim()).filter(Boolean)};delete body.files;}if(kind==='daily'){path='center/daily';body={date:filters.to,revision:Number(form.dataset.revision),submit:submitter?.value==='submit',notes:Object.fromEntries([...form.querySelectorAll('[data-label]')].map(el=>[el.dataset.label,el.value]))};}if(kind==='work'){path='center/work';body={...values,id:form.dataset.id,revision:Number(form.dataset.revision)};}if(kind==='issue'){path='center/issue';body={...values,taskId:form.dataset.task,escalated:values.escalated==='true'};}if(kind==='resolveIssue'){path='center/issue';body={...values,id:form.dataset.id,revision:Number(form.dataset.revision)};}if(['policy','categories','template','reportTemplates','reminders'].includes(kind)){path='center/settings';method='PUT';body={revision:data.settings.revision||0};if(kind==='reminders')Object.assign(body,{taskReminders:values.taskReminders==='true',dailyReminders:values.dailyReminders==='true',dueSoonMinutes:Number(values.dueSoonMinutes),repeatReminderAt:values.repeatReminderAt,reason:'调整自动钉钉提醒'});if(kind==='policy')Object.assign(body,{deadline:values.deadline,reviewHours:Number(values.reviewHours),staleHours:Number(values.staleHours),allowLate:values.allowLate==='true',reportRoles:fd.getAll('reportRoles'),weekdays:fd.getAll('weekdays').map(Number),restDays:values.restDays.split(/[,，\s]+/).filter(Boolean)});if(kind==='categories'){body.categories=values.categories.split('\n').map(s=>s.trim()).filter(Boolean);body.requiredAttachmentCategories=values.requiredAttachmentCategories.split('\n').map(s=>s.trim()).filter(Boolean);}if(kind==='template')body.taskTemplates=[...data.settings.taskTemplates,values];if(kind==='reportTemplates')body.reportFields=Object.fromEntries(Object.entries(values).map(([k,v])=>[k.replace('fields_',''),v.split('\n').map(s=>s.trim()).filter(Boolean)]));}
      if(form._wtComposerPayload&&kind!=='publish'){const images=form._wtComposerPayload();if(kind==='template')body.taskTemplates.at(-1).composerImages=images;else body.composerImages=images;}
      if(form._files){const rich=kind==='publish'&&form._wtRichPayload?form._wtRichPayload():null;if(rich)Object.assign(body,rich.fields);const files=await Promise.all((rich?rich.files:form._files()).map(f=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:f.name,mime:f.type||'application/octet-stream',data:String(reader.result).split(',')[1]});reader.onerror=()=>reject(new Error('附件读取失败'));reader.readAsDataURL(f);})));body.files=files;}
      await api(path,body,method);if(kind==='daily')delete drafts[filters.to];closeDialog();notify('已保存');await reload();
    }catch(err){if(error)error.innerHTML=`<div class="wc-error">${esc(err.message)}</div>`;else notify(err.message,true);}finally{buttons.forEach(b=>b.disabled=false);}}, {signal:abort.signal});
    root.innerHTML='<main class="wc"><div class="wc-loading">正在读取团队与工作记录…</div></main>';reload().then(()=>{const taskId=deep.get('task')||deep.get('taskId');if(taskId&&data&&(can('tasks')||can('acceptance')))taskDetail(taskId);else if(data&&can('reports','edit')&&deep.get('tab')==='reports'&&deep.get('compose')==='1')writeDaily();});
    const badgeTimer=setInterval(refreshTabBadges,30000);
    document.addEventListener('visibilitychange',refreshTabBadges,{signal:abort.signal});
    return ()=>{alive=false;clearInterval(badgeTimer);abort.abort();closeDialog();root.innerHTML='';};
  }};
})();
