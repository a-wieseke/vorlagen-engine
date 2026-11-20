/** application: feature logic; state is scoped by domain in state.js. */
import {state,actions} from './state.js';
import {pages,groups,areas,pageAllowed} from '../navigation.js';

export async function api(url, options={}){
  options.headers=Object.assign({"Content-Type":"application/json"},options.headers||{});
  const method=String(options.method||"GET").toUpperCase();
  if(state.auth.csrfToken&&!(["GET","HEAD","OPTIONS"].includes(method)))options.headers["X-CSRF-Token"]=state.auth.csrfToken;
  const response=await fetch(url,options);
  let data={}; try{data=await response.json()}catch(e){}
  if(!response.ok){const error=new Error(data.error||"Fehler bei der Anfrage.");error.status=response.status;error.code=data.code;throw error;}
  if(data.csrf_token)state.auth.csrfToken=data.csrf_token;
  return data;
}

export function toast(message){
  const element=state.shared.byId("toast");element.textContent=message;element.style.display="block";
  setTimeout(()=>element.style.display="none",3500);
}

export function esc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}

export function menuIcon(name){
  const paths={external:'<path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',duplicate:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>',edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',archive:'<path d="M3 6h18M5 6v14h14V6M9 10h6M4 3h16v3H4Z"/>',restore:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>'};
  return `<svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.edit}</svg>`;
}

export function applySettings(settings){
  state.shared.appSettings=Object.assign(state.shared.appSettings,settings||{});
  document.title=state.shared.appSettings.app_name;
  document.querySelectorAll(".dynamic-app-name").forEach(element=>element.textContent=state.shared.appSettings.app_name);
  const logo=state.shared.appSettings.logo_data||"/static/logo.png";
  document.querySelectorAll(".dynamic-logo").forEach(element=>element.src=logo);
  actions.applyMainNavigationOrder(state.shared.appSettings.navigation_order);
  window.applyNavigationAreas?.(state.shared.appSettings.navigation_areas);
}

export function applyMainNavigationOrder(order){
  // Legacy flat order remains an API compatibility field. The actual shell
  // reads the migrated per-area order, never a second navigation tree.
  window.applyNavigationAreas?.(state.shared.appSettings.navigation_areas);
}

export async function loadPublicSettings(){
  try{
    const data=await actions.api("/api/public-settings");actions.applySettings(data.settings);
    if(data.version)state.shared.byId("loginAppVersion").textContent=" · Version "+data.version;
  }catch(e){}
}

export async function boot(){
  try{
    const data=await actions.api("/api/me");state.auth.me=data.user;state.auth.csrfToken=data.csrf_token||"";
    state.shared.loginView.hidden=true;state.shared.appView.hidden=false;state.shared.who.textContent=`${state.auth.me.first_name} ${state.auth.me.last_name}`;
    actions.applyPermissionVisibility();
    if(state.auth.me.must_change){state.auth.forcedPasswordDialog.showModal();return;}
    // One broken module must not destroy a valid session or mask the error as
    // a login failure. Independent modules remain available for work.
    const load=async(label,fn)=>{try{await fn()}catch(error){
      let box=state.shared.byId('moduleLoadErrors');if(!box){box=document.createElement('div');box.id='moduleLoadErrors';box.className='warning';document.querySelector('main').prepend(box)}
      const message=document.createElement('p');message.textContent=`${label}: ${error.message} Bitte die Seite erneut laden.`;box.append(message);
    }};
    await load('Platzhalter',actions.loadVariables);
    await load('Kategorien',actions.loadCategories);
    if(actions.hasPermission("projects_view"))await load('Projekte',actions.loadProjects);
    if(actions.hasPermission("email_create")||actions.hasPermission("templates_manage")||actions.hasPermission("roles_manage"))await load('Vorlagen',actions.loadTemplates);
    if(actions.hasPermission("email_create")){await load('Favoriten',actions.loadFavorites);await load('Dashboard',actions.loadDashboard);}
    if(actions.hasPermission("roles_manage")||actions.hasPermission("users_manage"))await load('Rollen',actions.loadRoles);
    if(actions.hasPermission("users_manage"))await load('Benutzer',actions.loadUsers);
    if(["bid_questions_view","bid_questions_manage","bid_answers_manage"].some(actions.hasPermission))await load('Bieterfragen',actions.loadBidModule);
    else if(actions.hasPermission("projects_view"))await load('Bieter',actions.loadBidders);
    if(actions.hasPermission("documents_create")||actions.hasPermission("document_templates_manage"))await load('Dokumente',actions.loadDocumentModule);
    await load('Einstellungen',actions.loadSettings);
    if(actions.hasPermission("email_create"))actions.setMode("manual");
    if(actions.hasPermission("projects_manage"))actions.showProjectEntry("form");
    ["bidQuestionYear","bidBatchYear","bidImportYear"].forEach(actions.setCurrentBidYear);
    if(!await window.restoreAppRoute?.()&&!await actions.openTemplateFromPath()&&!actions.openExcelImportFromPath()){
      if(actions.hasPermission("email_create"))actions.switchTab("dashboard");
      else{
        const firstPage=pages.find(page=>page.listed&&page.group!=='footer'&&pageAllowed(page));
        if(firstPage)actions.switchTab(firstPage.id);
        else actions.switchTab("help");
      }
    }
    if(state.auth.me.must_change)state.auth.forcedPasswordDialog.showModal();
  }catch(error){
    state.shared.loginView.hidden=false;state.shared.appView.hidden=true;
    if(error?.message && error.message!=="Nicht angemeldet.") actions.toast(error.message);
  }
}

export function moduleButtonAllowed(button){
  if(button.dataset.permission)return actions.hasPermission(button.dataset.permission);
  const permissions=(button.dataset.anyPermission||"").split(",").map(value=>value.trim()).filter(Boolean);
  return !permissions.length||permissions.some(actions.hasPermission);
}

export function renderSubNavigation(module){
  // Retained as a harmless adapter for older extensions. Object tabs are
  // rendered by their own detail page, not duplicated beneath the header.
}

export function openModule(module){
  const preferred=pages.find(page=>page.group===module&&page.listed&&pageAllowed(page));
  if(preferred)actions.switchTab(preferred.id);
}

export function switchTab(name,preserveUrl=false){
  const definition=pages.find(page=>page.id===name);
  if(definition&&!pageAllowed(definition)){actions.toast('Für diese Seite fehlt die Berechtigung.');return;}
  const changedPage=!state.shared.byId("tab-"+name)?.classList.contains("active");
  const module=definition?.group||null;
  document.querySelectorAll(".tab").forEach(section=>section.classList.toggle("active",section.id==="tab-"+name));
  // Page title, breadcrumb and the expandable sidebar belong to the shared UI
  // shell. Fachmodule only need to call switchTab and stay layout-agnostic.
  window.updateAppShell?.(name,module);
  window.WveDrafts?.restore(state.shared.byId('tab-'+name));
  window.updateDraftIndicator?.();
  // Opening a separate editor/detail page starts at its heading, even if the
  // previous list or editor was scrolled to the bottom.
  if(changedPage)window.scrollTo({top:0,behavior:"instant"});
  if(name==="settings"&&!window.WveDrafts?.dirty(state.shared.byId('tab-settings')))actions.loadSettings();
  if(name==="account"||name==="users")actions.loadProjectApiKeys();
  if(name==="audit"&&actions.hasPermission("system_view"))actions.loadAuditLog();
  if(name==="usage"&&actions.hasPermission("system_view"))actions.loadUsageReport();
  if(name==="system-status"&&actions.hasPermission("system_view"))actions.loadSystemStatus();
}

export function goHome(){actions.switchTab("dashboard")}

export function loadJsonFile(input){
  const file=input.files[0];if(!file)return;const reader=new FileReader();
  reader.onload=()=>state.shared.jsonPaste.value=reader.result;reader.readAsText(file,"utf-8");
}

export async function readExcelClipboard(){
  try{state.shared.excelImportJson.value=(await navigator.clipboard.readText()).trim();actions.previewExcelImport()}
  catch(error){actions.toast("Die Zwischenablage konnte nicht gelesen werden. Bitte JSON manuell einfügen oder den Browserzugriff erlauben.")}
}

export function toggleAllArchivedSelections(entity,checked){document.querySelectorAll(`.archived-${entity}-select`).forEach(input=>input.checked=checked)}

export function openBulkDelete(entity){
  const ids=Array.from(document.querySelectorAll(`.archived-${entity}-select:checked`)).map(input=>Number(input.value));
  if(!ids.length)return actions.toast("Bitte mindestens einen archivierten Eintrag auswählen.");
  actions.openPermanentDelete(entity,ids);
}

export function openPermanentDelete(entity,ids){
  const cleanIds=[...new Set((ids||[]).map(Number).filter(Boolean))];if(!cleanIds.length)return;
  state.shared.pendingPermanentDelete={entity,ids:cleanIds};const plural=cleanIds.length>1;
  state.shared.byId("permanentDeleteTitle").textContent=plural?`${cleanIds.length} Einträge endgültig löschen?`:`${entity==="project"?"Projekt":"Vorlage"} endgültig löschen?`;
  state.shared.byId("permanentDeleteText").textContent=plural?"Alle ausgewählten archivierten Einträge werden unwiderruflich gelöscht.":entity==="project"?"Das archivierte Projekt wird unwiderruflich gelöscht.":"Die archivierte Vorlage und ihre Versionshistorie werden unwiderruflich gelöscht.";
  state.shared.permanentDeleteDialog.showModal();
}

export function cancelPermanentDelete(){state.shared.pendingPermanentDelete=null;state.shared.permanentDeleteDialog.close()}

export async function confirmPermanentDelete(){
  if(!state.shared.pendingPermanentDelete)return;const {entity,ids}=state.shared.pendingPermanentDelete;state.shared.pendingPermanentDelete=null;state.shared.permanentDeleteDialog.close();
  try{
    if(ids.length===1)await actions.api(`/api/${entity==="project"?"projects":"templates"}/${ids[0]}/permanent`,{method:"DELETE"});
    else await actions.api(`/api/${entity==="project"?"projects":"templates"}/delete-archived`,{method:"POST",body:JSON.stringify({ids})});
    if(entity==="project"){if(ids.includes(state.projects.currentProjectDetailId)){state.projects.currentProjectDetailId=null;actions.switchTab("project-overview")}await actions.loadProjects()}
    else{if(ids.includes(Number(state.library.tplId.value)))actions.newTemplate(false);await actions.loadTemplates();actions.switchTab("templates")}
    actions.toast(`${ids.length} Eintrag${ids.length===1?"":"e"} endgültig gelöscht.`);
  }catch(error){actions.toast(error.message)}
}

export function flattenImportValue(value,prefix="",output={}){
  if(Array.isArray(value)){value.forEach((item,index)=>actions.flattenImportValue(item,`${prefix}[${index}]`,output));if(!value.length)output[prefix]="[]";return output}
  if(value&&typeof value==="object"){Object.entries(value).forEach(([key,item])=>actions.flattenImportValue(item,prefix?`${prefix}.${key}`:key,output));return output}
  output[prefix]=value??"";return output;
}

export function parseDelimitedLine(line,delimiter){
  const values=[];let value="",quoted=false;
  for(let index=0;index<line.length;index++){
    const char=line[index];
    if(char==='"'&&quoted&&line[index+1]==='"'){value+='"';index++}
    else if(char==='"')quoted=!quoted;
    else if(char===delimiter&&!quoted){values.push(value.trim());value=""}
    else value+=char;
  }
  values.push(value.trim());return values;
}

export async function loadCategories(){
  const data=await actions.api("/api/categories");state.library.categories=data.categories;
  if(state.library.tplCategory)state.library.tplCategory.innerHTML=state.library.categories.filter(category=>category.active||actions.hasPermission("categories_manage")).map(category=>
    `<option value="${category.id}">${actions.esc(category.name)}${category.active?"":" (inaktiv)"}</option>`).join("");
  actions.renderCategoryList();actions.updateDashboardCategoryOptions();
}

export function templateMatches(template,search){
  const needle=String(search||"").trim().toLocaleLowerCase("de");
  return !needle||`${template.category} ${template.name}`.toLocaleLowerCase("de").includes(needle);
}

export function canonicalFieldKey(field){return field.key.includes(".")?field.key:`eingabe.${field.key}`}

export function definitionForKey(key,template){
  const catalog=state.library.variables.find(variable=>variable.key===key);
  if(catalog)return catalog;
  const oldField=(template?.fields||[]).find(field=>actions.canonicalFieldKey(field)===key);
  if(oldField)return {key,label:oldField.label||key,type:oldField.type||"text",source:"manual",required:!!oldField.required};
  return {key,label:key,type:"text",source:"manual",required:false};
}

export function updateOutputButtons(){
  const template=actions.selectedTemplate(),blocked=!!template?.notice_enabled&&!!template?.notice_text&&template.notice_mode==="acknowledge"&&!state.mail.noticeAcknowledged;
  ["openMailtoButton","downloadEmlButton","copyResultButton"].forEach(id=>{const button=state.shared.byId(id);if(button){button.classList.toggle("is-disabled",blocked);button.setAttribute("aria-disabled",String(blocked))}});
}

export function runOutputAction(action){
  const template=actions.selectedTemplate(),hasNotice=!!template?.notice_enabled&&!!String(template?.notice_text||"").trim();
  if(hasNotice&&template.notice_mode==="acknowledge"&&!state.mail.noticeAcknowledged){state.mail.noticeRequiredDialog.showModal();return}
  if(hasNotice&&template.notice_mode==="dialog"){
    state.mail.pendingNoticeAction=action;state.mail.noticeActionText.innerHTML=actions.renderHtmlTemplate(template.notice_html||actions.plainTextToHtml(template.notice_text),actions.currentEmailContext(),true);state.mail.noticeActionDialog.showModal();return;
  }
  actions.executeOutputAction(action);
}

export async function executeOutputAction(action,imagesConfirmed=false){
  if(!imagesConfirmed&&action!=="eml"&&state.mail.resultBody.querySelector("img")){
    state.shared.pendingImageExportAction=action;state.shared.byId("imageExportDialog").showModal();return;
  }
  const template=actions.selectedTemplate();
  if(template){
    const projectId=state.mail.mode.value==="project"&&state.projects.projectSelect.value?Number(state.projects.projectSelect.value):null;
    try{await actions.api("/api/usage",{method:"POST",body:JSON.stringify({template_id:template.id,project_id:projectId,output_method:action})})}catch(error){}
  }
  if(action==="mailto")actions.openMailto();else if(action==="eml")await actions.downloadEml();else if(action==="copy")await actions.copyResult();
}

export function downloadBlob(blob,name){
  const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}

export function fileAsBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file)})}

export function renderDocumentBlockList(){const container=state.shared.byId("documentBlockList");if(!container)return;container.innerHTML=state.documents.documentBlocks.map(item=>`<button class="list-row" onclick="editDocumentBlock(${item.id})"><span><b>${actions.esc(item.name)}</b><small>{{baustein.${actions.esc(item.key)}}}${item.category?` · ${actions.esc(item.category)}`:""}</small></span><span class="status-pill ${item.active?"active":"inactive"}">${item.active?"aktiv":"inaktiv"}</span></button>`).join("")||"<p class='muted'>Noch keine Textbausteine vorhanden.</p>"}

export function newDocumentBlock(){state.documents.editingDocumentBlockId=null;["documentBlockId","documentBlockName","documentBlockKey","documentBlockCategory","documentBlockContent"].forEach(id=>state.shared.byId(id).value="");state.shared.byId("documentBlockActive").checked=true;state.shared.byId("deleteDocumentBlockButton").hidden=true;state.shared.byId("documentBlockFormTitle").textContent="Textbaustein anlegen"}

export function editDocumentBlock(id){const item=state.documents.documentBlocks.find(entry=>entry.id===Number(id));if(!item)return;state.documents.editingDocumentBlockId=item.id;state.shared.byId("documentBlockId").value=item.id;state.shared.byId("documentBlockName").value=item.name;state.shared.byId("documentBlockKey").value=item.key;state.shared.byId("documentBlockCategory").value=item.category;state.shared.byId("documentBlockContent").value=item.content;state.shared.byId("documentBlockActive").checked=item.active;state.shared.byId("deleteDocumentBlockButton").hidden=false;state.shared.byId("documentBlockFormTitle").textContent="Textbaustein bearbeiten"}

export async function saveDocumentBlock(){
  const id=state.documents.editingDocumentBlockId;
  const payload={name:state.shared.byId("documentBlockName").value,key:state.shared.byId("documentBlockKey").value,category:state.shared.byId("documentBlockCategory").value,content:state.shared.byId("documentBlockContent").value,active:state.shared.byId("documentBlockActive").checked};
  const save=WveDrafts.beginSave(state.shared.byId('tab-document-block-edit'));
  try{
    await actions.api(id?`/api/document-blocks/${id}`:"/api/document-blocks",{method:id?"PUT":"POST",body:JSON.stringify(payload)});
    if(WveDrafts.finishSave(save))actions.newDocumentBlock();
    await actions.loadDocumentModule();actions.toast("Textbaustein gespeichert.");
  }catch(error){actions.toast(error.message)}
}

export async function deleteDocumentBlock(){if(!state.documents.editingDocumentBlockId)return;try{await actions.api(`/api/document-blocks/${state.documents.editingDocumentBlockId}`,{method:"DELETE"});actions.newDocumentBlock();await actions.loadDocumentModule();actions.toast("Textbaustein gelöscht.")}catch(error){actions.toast(error.message)}}

export async function loadSettings(){
  try{
    const data=await actions.api("/api/settings");
    if(WveDrafts.dirty(state.shared.byId('tab-settings')))return;
    actions.applySettings(data.settings);
    state.shared.byId("settingsAppName").value=data.settings.app_name;
    state.shared.byId("settingsLogoPreview").src=data.settings.logo_data||"/static/logo.png";
    state.shared.pendingLogoData=data.settings.logo_data||"";
    actions.renderNavigationOrderEditor();
  }catch(error){}
}

export function renderNavigationOrderEditor(){
  if(!state.shared.navigationOrderList)return;
  state.shared.navigationOrderList.innerHTML=Object.entries(state.shared.appSettings.navigation_areas||{}).map(([area,order])=>`<section data-nav-area="${area}"><h3>${areas[area]}</h3>${order.map(key=>`<div class="navigation-order-item" tabindex="0" aria-label="${groups[key]}. Mit Alt und Pfeiltasten verschieben." onkeydown="moveNavigationWithKeyboard(event,'${key}','${area}')" draggable="true" data-nav-order-key="${key}" ondragstart="beginNavigationDrag(event,'${key}')" ondragover="allowNavigationDrop(event)" ondragleave="event.currentTarget.classList.remove('drag-over')" ondrop="dropNavigationItem(event,'${key}')" ondragend="endNavigationDrag()"><span class="drag-handle" aria-hidden="true">⋮⋮</span><b>${groups[key]}</b></div>`).join('')}</section>`).join('');
}

export function beginNavigationDrag(event,key){state.shared.draggedNavigationKey=key;state.shared.draggedNavigationArea=event.currentTarget.closest('[data-nav-area]').dataset.navArea;event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",key)}

export function allowNavigationDrop(event){if(state.shared.draggedNavigationKey){event.preventDefault();event.dataTransfer.dropEffect="move";event.currentTarget.classList.add("drag-over")}}

export function endNavigationDrag(){state.shared.draggedNavigationKey=null;document.querySelectorAll(".navigation-order-item.drag-over").forEach(item=>item.classList.remove("drag-over"))}

export function dropNavigationItem(event,targetKey){
  event.preventDefault();event.currentTarget.classList.remove("drag-over");if(!state.shared.draggedNavigationKey||state.shared.draggedNavigationKey===targetKey)return actions.endNavigationDrag();
  const area=event.currentTarget.closest('[data-nav-area]').dataset.navArea;
  if(area!==state.shared.draggedNavigationArea)return actions.endNavigationDrag();
  const order=state.shared.appSettings.navigation_areas[area],dragged=state.shared.draggedNavigationKey;
  const remaining=order.filter(key=>key!==dragged),targetIndex=remaining.indexOf(targetKey),rect=event.currentTarget.getBoundingClientRect();
  remaining.splice(targetIndex+(event.clientY>rect.top+rect.height/2?1:0),0,dragged);state.shared.appSettings.navigation_areas[area]=remaining;actions.endNavigationDrag();actions.renderNavigationOrderEditor();window.WveDrafts?.capture(state.shared.byId('tab-settings'));
}

export function moveNavigationWithKeyboard(event,key,area){
  if(!event.altKey||!['ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();const order=state.shared.appSettings.navigation_areas[area],index=order.indexOf(key),target=index+(event.key==='ArrowUp'?-1:1);
  if(target<0||target>=order.length)return;[order[index],order[target]]=[order[target],order[index]];
  actions.renderNavigationOrderEditor();state.shared.navigationOrderList.querySelector(`[data-nav-area="${area}"] [data-nav-order-key="${key}"]`).focus();window.WveDrafts?.capture(state.shared.byId('tab-settings'));
}

export function previewSettingsLogo(input){
  const file=input.files[0];if(!file)return;
  if(file.size>1_000_000){input.value="";return actions.toast("Das Logo darf höchstens 1 MB groß sein.")}
  const reader=new FileReader();
  reader.onload=()=>{state.shared.pendingLogoData=reader.result;state.shared.byId("settingsLogoPreview").src=state.shared.pendingLogoData;state.shared.byId("settingsRemoveLogo").checked=false};
  reader.readAsDataURL(file);
}

export async function saveSettings(){
  const logo=state.shared.byId("settingsRemoveLogo").checked?"":state.shared.pendingLogoData;
  const save=WveDrafts.beginSave(state.shared.byId('tab-settings'));
  try{
    const data=await actions.api("/api/settings",{method:"PUT",body:JSON.stringify({
      app_name:state.shared.byId("settingsAppName").value,logo_data:logo,
      navigation_order:state.shared.appSettings.navigation_order,navigation_areas:state.shared.appSettings.navigation_areas
    })});
    const current=WveDrafts.finishSave(save);
    // Navigation order is itself part of the settings draft.
    if(!WveDrafts.dirty(state.shared.byId('tab-settings')))actions.applySettings(data.settings);
    if(current){
      state.shared.pendingLogoData=data.settings.logo_data||"";
      state.shared.byId("settingsLogoPreview").src=state.shared.pendingLogoData||"/static/logo.png";
      state.shared.byId("settingsLogoFile").value="";state.shared.byId("settingsRemoveLogo").checked=false;
    }
    actions.toast("Einstellungen gespeichert.");
  }catch(error){actions.toast(error.message)}
}

export function downloadDatabaseBackup(){return actions.downloadUrl('/api/admin/backup')}

export async function downloadUrl(url){
  // Fetching a download keeps the active page and its drafts in place. A
  // location assignment can incorrectly trigger beforeunload for downloads.
  try{
    const response=await fetch(url);if(!response.ok){const data=await response.json();throw Error(data.error||'Download fehlgeschlagen.');}
    const disposition=response.headers.get('Content-Disposition')||'';
    const encoded=disposition.match(/filename\*=UTF-8''([^;]+)/i),plain=disposition.match(/filename="([^"]+)"/i);
    actions.downloadBlob(await response.blob(),encoded?decodeURIComponent(encoded[1]):plain?.[1]||'download');
  }catch(error){actions.toast(error.message)}
}

export function chooseDatabaseRestore(){state.shared.byId("databaseRestoreFile").click()}

export function prepareDatabaseRestore(input){
  const file=input.files?.[0];if(!file)return;
  if(file.size>20_000_000){input.value="";return actions.toast("Die Sicherung darf höchstens 20 MB groß sein.")}
  const reader=new FileReader();reader.onload=()=>{state.shared.pendingRestoreBase64=String(reader.result).split(",")[1]||"";restoreConfirmDialog.showModal()};reader.readAsDataURL(file);
}

export function cancelDatabaseRestore(){state.shared.pendingRestoreBase64=null;state.shared.byId("databaseRestoreFile").value="";restoreConfirmDialog.close()}

export async function confirmDatabaseRestore(){
  if(!state.shared.pendingRestoreBase64)return;
  const database_base64=state.shared.pendingRestoreBase64;state.shared.pendingRestoreBase64=null;restoreConfirmDialog.close();
  try{await actions.api("/api/admin/restore",{method:"POST",body:JSON.stringify({database_base64})});window.WveDrafts?.clear();await confirmAction("Die Sicherung wurde wiederhergestellt. Bitte melden Sie sich erneut an.",'Wiederherstellung abgeschlossen');location.reload()}
  catch(error){state.shared.byId("databaseRestoreFile").value="";actions.toast(error.message)}
}

export async function loadAuditLog(){
  if(!actions.hasPermission("system_view")||!state.shared.byId("auditList"))return;
  try{const data=await actions.api("/api/audit?limit=250");
    const actionLabels={create:"Angelegt",update:"Geändert",archive:"Archiviert",restore:"Wiederhergestellt",download:"Heruntergeladen",export:"Exportiert",duplicate:"Dupliziert","delete-permanent":"Endgültig gelöscht"};
    auditList.innerHTML=data.entries.map(entry=>`<div class="list-item"><div><b>${actions.esc(actionLabels[entry.action]||entry.action)} · ${actions.esc(entry.entity_type)}</b><div>${actions.esc(entry.summary||"")}</div><div class="small">${new Date(entry.created_at).toLocaleString()} · ${actions.esc(entry.username||"System")}${entry.entity_id?` · ID ${actions.esc(entry.entity_id)}`:""}</div></div></div>`).join("")||"<p class='muted'>Noch keine Änderungen protokolliert.</p>";
  }catch(error){actions.toast(error.message)}
}

export function renderUsageRanking(targetId,items){
  const target=state.shared.byId(targetId);if(!target)return;
  target.innerHTML=items.length?items.map(item=>`<div class="metric-row"><span>${actions.esc(item.name||"Unbekannt")}</span><b>${item.count}</b></div>`).join(""):"<p class='muted'>Keine Daten im Zeitraum.</p>";
}

export async function loadUsageReport(){
  if(!actions.hasPermission("system_view")||!state.shared.byId("usageSummary"))return;
  try{
    const data=await actions.api(`/api/usage?days=${Number(state.shared.byId("usageDays").value)||30}`);
    state.shared.byId("usageSummary").innerHTML=`<div><span>Ausgaben im Zeitraum</span><b>${data.total}</b></div><div><span>Zeitraum</span><b>${data.days} Tage</b></div><div><span>Genutzte Vorlagen</span><b>${data.by_template.length}</b></div>`;
    actions.renderUsageRanking("usageByTemplate",data.by_template);actions.renderUsageRanking("usageByMethod",data.by_method.map(item=>({...item,name:{eml:"EML",mailto:"Outlook / mailto",copy:"E-Mailtext kopiert"}[item.name]||item.name})));actions.renderUsageRanking("usageByUser",data.by_user);
    state.shared.byId("usageRecent").innerHTML=data.recent.length?data.recent.map(entry=>`<div class="list-item"><div><b>${actions.esc(entry.template_name)}</b><div>${actions.esc({eml:"EML",mailto:"Outlook / mailto",copy:"E-Mailtext kopiert"}[entry.output_method]||entry.output_method)}${entry.project_key?` · Projekt ${actions.esc(entry.project_key)}`:""}</div><div class="small">${new Date(entry.created_at).toLocaleString()} · ${actions.esc(entry.username)}</div></div></div>`).join(""):"<p class='muted'>Noch keine Ausgaben erfasst.</p>";
  }catch(error){actions.toast(error.message)}
}

export function formatBytes(bytes){
  const units=["B","KB","MB","GB"];let value=Number(bytes)||0,index=0;
  while(value>=1024&&index<units.length-1){value/=1024;index++}
  return `${value.toLocaleString("de-DE",{maximumFractionDigits:index?2:0})} ${units[index]}`;
}

export async function loadSystemStatus(){
  if(!actions.hasPermission("system_view")||!state.shared.byId("systemStatusGrid"))return;
  try{
    const data=(await actions.api("/api/system-status")).status;
    const values=[
      ["Softwareversion",data.version],["Versionsjahr",data.version_year],["Datenbankschema",data.schema_version],["Datenbankgröße",actions.formatBytes(data.database_size_bytes)],
      ["Letztes Backup",data.last_backup_at?new Date(data.last_backup_at).toLocaleString():"Noch kein Backup"],
      ["Aktive Benutzer",`${data.users_active} von ${data.users_total}`],["Aktive Vorlagen",`${data.templates_active} von ${data.templates_total}`],
      ["Aktive Projekte",`${data.projects_active} von ${data.projects_total}`],["Erfasste Ausgaben",data.usage_events],
      ["Gespeicherte Projekt-E-Mails",data.project_emails],["Bieterfragen",data.bid_questions],["Standardantworten",data.bid_answers],
      ["Anwendung gestartet",new Date(data.started_at).toLocaleString()],["Aktive Sitzungen",data.sessions_active]
    ];
    state.shared.byId("systemStatusGrid").innerHTML=values.map(([label,value])=>`<div><span>${actions.esc(label)}</span><b>${actions.esc(value)}</b></div>`).join("");
  }catch(error){actions.toast(error.message)}
}
