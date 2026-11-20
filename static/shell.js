import {areas,pages,groups,pageAllowed,routeFor} from './navigation.js';

const state={area:'work',page:'dashboard',expanded:null,collapsed:false,routing:false,order:{}};
const el=id=>document.getElementById(id);
const icon=(name)=>`<svg class="nav-icon" aria-hidden="true"><use href="/static/design/icons.svg#i-${name}"/></svg>`;
const symbols={dashboard:'dashboard',projects:'folder',email:'send',documents:'document',bidder:'checklist',bidders:'users',variables:'models',users:'users',system:'laptop'};

function closeMobile(){document.body.classList.remove('sidebar-open');el('sidebarBackdrop').hidden=true;}
function render(){
  const available=Object.entries(areas).filter(([area])=>pages.some(p=>p.area===area&&p.group!=='footer'&&pageAllowed(p)));
  el('areaSelect').innerHTML=available.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');el('areaSelect').value=state.area;
  const nav=el('primaryNavigation');nav.replaceChildren();
  const list=pages.filter(p=>p.area===state.area&&p.listed&&p.group!=='footer'&&pageAllowed(p));
  const keys=[...new Set(list.map(p=>p.group))];
  const order=state.order[state.area]||[];keys.sort((a,b)=>(order.indexOf(a)<0?999:order.indexOf(a))-(order.indexOf(b)<0?999:order.indexOf(b)));
  for(const key of keys){
    const children=list.filter(p=>p.group===key),group=document.createElement('div');group.className='nav-group';
    const button=document.createElement('button');button.type='button';button.title=groups[key];
    button.className='nav-group-button';button.innerHTML=`${icon(symbols[key])}<span>${groups[key]}</span>${children.length>1?'<span class="nav-chevron">⌄</span>':''}`;
    button.classList.toggle('active',pages.find(p=>p.id===state.page)?.group===key);
    if(children.length===1){button.onclick=()=>window.switchTab(children[0].id);button.dataset.page=children[0].id;}
    else{
      button.setAttribute('aria-expanded',String(state.expanded===key));
      button.onclick=()=>{state.expanded=state.expanded===key?null:key;render()};
    }
    group.append(button);
    if(children.length>1&&state.expanded===key){
      const submenu=document.createElement('div');submenu.className='nav-children';
      children.forEach(page=>{const link=document.createElement('a');link.href=routeFor(page.id);link.textContent=page.title;
        link.classList.toggle('active',page.id===state.page);if(page.id===state.page)link.setAttribute('aria-current','page');
        link.onclick=e=>{if(e.ctrlKey||e.metaKey)return;e.preventDefault();window.switchTab(page.id)};submenu.append(link);});group.append(submenu);
    }
    nav.append(group);
  }
  document.querySelectorAll('.sidebar-footer-action').forEach(button=>{const page=pages.find(p=>p.id===button.dataset.tab);button.hidden=!pageAllowed(page);button.classList.toggle('active',page?.id===state.page)});
}
function recordFor(page){
  return {'generator':el('templateSelect')?.value,'template-edit':el('tplId')?.value,'project-detail':window.currentProjectDetailId,
    'document-template-edit':el('documentTemplateId')?.value,'document-block-edit':el('documentBlockId')?.value,
    'bid-answer-create':el('bidAnswerId')?.value,'bid-question-create':window.editingBidQuestionId,
    'bid-question-detail':el('tab-bid-question-detail')?.dataset.record,
    'project-edit':el('projectEditId')?.value,'bid-answer-detail':window.currentBidDetailId,'bidder-detail':window.currentBidDetailId,
    'variable-edit':el('varId')?.value,'role-edit':el('roleId')?.value,'bidder-create':window.editingBidderId}[page]||'';
}
export function updateShell(page){
  const definition=pages.find(p=>p.id===page);if(!definition)return;
  state.page=page;
  if(definition.group!=='footer')state.area=definition.area;
  state.expanded=definition.group;
  el('pageTitle').textContent=definition.title;el('pageBreadcrumb').textContent=`${areas[state.area]} / ${definition.title}`;
  render();closeMobile();
  if(!state.routing){const url=routeFor(page,recordFor(page));if(location.pathname!==url)history.pushState({page},'',url);}
}
export async function restoreRoute(){
  if(!location.pathname.startsWith('/app/'))return false;
  const [,,page,record]=location.pathname.split('/'),definition=pages.find(p=>p.id===page);
  if(!pageAllowed(definition)){window.toast('Diese Seite ist nicht verfügbar oder nicht freigegeben.');return false;}
  state.routing=true;
  try{
    const id=Number(record);
    if(page==='generator'&&id)await window.openTemplate(id,false);
    else if(page==='project-detail'&&id)await window.openProjectDetail(id);
    else if(page==='project-edit'&&id)window.editProject(id);
    else if(page==='bid-answer-detail'&&id)window.openBidAnswerDetail(id);
    else if(page==='bidder-detail'&&id)window.viewBidder(id);
    else if(page==='template-edit')id?window.editTemplate(id):window.newTemplate();
    else if(page==='document-template-edit')id?await window.editDocumentTemplate(id):window.newDocumentTemplate();
    else if(page==='document-block-edit')id?window.editDocumentBlock(id):window.newDocumentBlock();
    else if(page==='bid-answer-create')id?window.editBidAnswer(id):window.newBidAnswer();
    else if(page==='bid-question-detail'&&id)window.openBidQuestion(id);
    else if(page==='bid-question-create')id?window.editBidQuestion(id):window.openNewBidQuestion();
    else if(page==='variable-edit')id?window.editVariable(id):window.newCustomVariable();
    else if(page==='role-edit')id?window.editRole(id):window.newRole();
    else if(page==='bidder-create')id?window.editBidder(id):window.openNewBidder();
    else window.switchTab(page,true);
  }finally{state.routing=false;}
  return true;
}
export function initializeShell(){
  const area=document.createElement('label');area.className='area-switch';area.innerHTML='<span>Arbeitsbereich</span><select id="areaSelect" aria-label="Arbeitsbereich"></select>';
  const nav=document.createElement('nav');nav.id='primaryNavigation';nav.setAttribute('aria-label','Seitennavigation');el('navigationMount').replaceWith(area,nav);
  const toggle=document.createElement('button');toggle.id='sidebarCollapseButton';toggle.className='navigation-collapse';toggle.title='Navigation ein-/ausklappen';toggle.setAttribute('aria-label',toggle.title);toggle.innerHTML='⇤';el('sidebarCloseButton').before(toggle);
  toggle.onclick=()=>{state.collapsed=!state.collapsed;document.body.classList.toggle('sidebar-collapsed',state.collapsed);toggle.setAttribute('aria-expanded',String(!state.collapsed))};
  el('areaSelect').onchange=()=>{state.area=el('areaSelect').value;state.expanded=null;render()};
  el('sidebarOpenButton').onclick=()=>{document.body.classList.add('sidebar-open');el('sidebarBackdrop').hidden=false};
  el('sidebarCloseButton').onclick=closeMobile;el('sidebarBackdrop').onclick=closeMobile;
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMobile()});
  window.addEventListener('popstate',()=>restoreRoute());
  window.updateAppShell=updateShell;window.refreshShellPermissions=render;window.restoreAppRoute=restoreRoute;
  window.applyNavigationAreas=order=>{state.order=order||{};render()};
  render();
  for(const [page,name] of [['settings','views'],['account','account']]){
    const button=document.querySelector(`.sidebar-footer-action[data-tab="${page}"]`);if(button)button.innerHTML=icon(name)+`<span>${page==='account'?'Mein Konto':'Einstellungen'}</span>`;
  }
}
