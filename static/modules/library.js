/** library: feature logic; state is scoped by domain in state.js. */
import {state,actions} from './state.js';

export async function loadVariables(){
  const data=await actions.api("/api/variables");state.library.variables=data.variables;
  actions.renderVariableList();actions.renderVariableChips();actions.renderProjectManualFields();actions.renderManualFields();
}

export function renderVariableChips(){
  if(!state.library.variableChips)return;
  const groups={project:"Projekt",client:"Auftraggeber",contact:"Kontakt / Ansprache",user:"Benutzer",manual:"Benutzerdefinierte Platzhalter"};
  state.library.variableChips.innerHTML=Object.entries(groups).map(([source,label])=>{
    const items=state.library.variables.filter(variable=>variable.active&&variable.source===source);
    if(!items.length)return "";
    return `<div class="chip-group"><b>${label}</b><div>${items.map(variable=>
      `<button type="button" class="chip" onclick="insertVariable('${actions.esc(variable.key)}')">{{${actions.esc(variable.key)}}}</button>`
    ).join("")}</div></div>`;
  }).join("");
}

export function renderVariableList(){
  if(!state.library.variableList||!actions.hasPermission("variables_manage"))return;
  const labels={project:"Projekt",client:"Auftraggeber",contact:"Kontakt / Ansprache",user:"Benutzer",manual:"Manuell"};
  const renderRows=items=>items.map(variable=>`<div class="list-item">
    <div><button type="button" class="text-button" onclick="editVariable(${variable.id})"><b>{{${actions.esc(variable.key)}}}</b></button><div class="small">${actions.esc(variable.label)} · ${labels[variable.source]||variable.source} · ${variable.active?"aktiv":"inaktiv"}</div></div>
    <button type="button" class="icon-button" title="Platzhalter bearbeiten" aria-label="Platzhalter bearbeiten" onclick="editVariable(${variable.id})">✎</button>
  </div>`).join("")||"<p class='muted'>Noch keine Platzhalter vorhanden.</p>";
  state.library.variableList.innerHTML=`<section class="variable-group"><h3>System- und Projektdaten</h3>${renderRows(state.library.variables.filter(variable=>variable.source!=="manual"))}</section>
    <section class="variable-group"><h3>Benutzerdefinierte Platzhalter</h3>${renderRows(state.library.variables.filter(variable=>variable.source==="manual"))}</section>`;
}

export function newVariable(){
  state.library.varId.value="";state.library.varKey.value="";state.library.varLabel.value="";state.library.varType.value="text";state.library.varSource.value="manual";
  state.library.varRequired.checked=false;state.library.varActive.checked=true;state.shared.byId("deleteVariableButton").hidden=true;
}

export function newCustomVariable(){actions.newVariable();state.library.varSource.value="manual";actions.switchTab('variable-edit');state.library.varKey.focus()}

export function editVariable(id){
  const variable=state.library.variables.find(item=>item.id===id);if(!variable)return;
  state.library.varId.value=variable.id;state.library.varKey.value=variable.key;state.library.varLabel.value=variable.label;state.library.varType.value=variable.type;
  state.library.varSource.value=variable.source;state.library.varRequired.checked=variable.required;state.library.varActive.checked=variable.active;
  state.shared.byId("deleteVariableButton").hidden=false;
  actions.switchTab('variable-edit');
}

export async function saveVariable(){
  const payload={key:state.library.varKey.value,label:state.library.varLabel.value,type:state.library.varType.value,source:state.library.varSource.value,
    required:state.library.varRequired.checked,active:state.library.varActive.checked};
  const save=WveDrafts.beginSave(state.shared.byId('tab-variable-edit'));
  try{
    if(state.library.varId.value)await actions.api("/api/variables/"+state.library.varId.value,{method:"PUT",body:JSON.stringify(payload)});
    else await actions.api("/api/variables",{method:"POST",body:JSON.stringify(payload)});
    if(WveDrafts.finishSave(save))actions.newVariable();
    actions.toast("Platzhalter gespeichert.");await actions.loadVariables();
  }catch(error){actions.toast(error.message)}
}

export async function deleteVariable(){
  if(!state.library.varId.value||!await confirmAction("Platzhalter wirklich löschen?",'Platzhalter löschen'))return;
  try{
    await actions.api("/api/variables/"+state.library.varId.value,{method:"DELETE"});
    actions.toast("Platzhalter gelöscht.");actions.newVariable();await actions.loadVariables();
  }catch(error){actions.toast(error.message)}
}

export function renderCategoryList(){
  if(!state.library.categoryList||!actions.hasPermission("categories_manage"))return;
  state.library.categoryList.innerHTML=state.library.categories.map(category=>`<div class="list-item category-list-item" data-category-id="${category.id}" ondragover="allowCategoryDrop(event)" ondragleave="clearCategoryDrop(event)" ondrop="dropCategory(event,${category.id})"><div class="template-row-content"><span class="drag-handle" draggable="true" title="Kategorie verschieben" aria-label="Kategorie verschieben" ondragstart="beginCategoryDrag(event,${category.id})" ondragend="endCategoryDrag()">⋮⋮</span><div><button class="text-button" onclick="editCategory(${category.id})"><b>${actions.esc(category.name)}</b></button><div class="small">${category.active?"aktiv":"inaktiv"}</div></div></div><button onclick="editCategory(${category.id})">Bearbeiten</button></div>`).join("");
}

export function beginCategoryDrag(event,id){state.library.draggedCategoryId=id;event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(id))}

export function allowCategoryDrop(event){if(state.library.draggedCategoryId){event.preventDefault();event.dataTransfer.dropEffect="move";event.currentTarget.classList.add("drag-over")}}

export function clearCategoryDrop(event){event.currentTarget.classList.remove("drag-over")}

export function endCategoryDrag(){document.querySelectorAll(".category-list-item.drag-over").forEach(row=>row.classList.remove("drag-over"));state.library.draggedCategoryId=null}

export async function dropCategory(event,targetCategoryId){
  event.preventDefault();actions.clearCategoryDrop(event);
  if(!state.library.draggedCategoryId||state.library.draggedCategoryId===targetCategoryId)return actions.endCategoryDrag();
  const dragged=state.library.categories.find(category=>category.id===state.library.draggedCategoryId),remaining=state.library.categories.filter(category=>category.id!==state.library.draggedCategoryId);
  const targetIndex=remaining.findIndex(category=>category.id===targetCategoryId),rect=event.currentTarget.getBoundingClientRect();
  remaining.splice(targetIndex+(event.clientY>rect.top+rect.height/2?1:0),0,dragged);state.library.categories=remaining;actions.endCategoryDrag();actions.renderCategoryList();
  try{
    await actions.api("/api/categories/order",{method:"PUT",body:JSON.stringify({category_ids:state.library.categories.map(category=>category.id)})});
    await actions.loadCategories();
    if(actions.hasPermission("email_create")||actions.hasPermission("templates_manage")||actions.hasPermission("roles_manage"))await actions.loadTemplates();
    if(actions.hasPermission("email_create"))await actions.loadDashboard();
    actions.toast("Kategorienreihenfolge gespeichert.");
  }
  catch(error){actions.toast(error.message);await actions.loadCategories()}
}

export function newCategory(){state.library.categoryId.value="";state.library.categoryName.value="";state.library.categoryActive.checked=true;state.shared.byId("deleteCategoryButton").hidden=true}

export function editCategory(id){const category=state.library.categories.find(item=>item.id===id);if(!category)return;state.library.categoryId.value=category.id;state.library.categoryName.value=category.name;state.library.categoryActive.checked=category.active;state.shared.byId("deleteCategoryButton").hidden=false}

export async function saveCategory(){
  const payload={name:state.library.categoryName.value,active:state.library.categoryActive.checked};
  try{
    if(state.library.categoryId.value)await actions.api("/api/categories/"+state.library.categoryId.value,{method:"PUT",body:JSON.stringify(payload)});
    else await actions.api("/api/categories",{method:"POST",body:JSON.stringify(payload)});
    actions.toast("Kategorie gespeichert.");actions.newCategory();await actions.loadCategories();
    if(actions.hasPermission("email_create")||actions.hasPermission("templates_manage")||actions.hasPermission("roles_manage"))await actions.loadTemplates();
    if(actions.hasPermission("email_create"))await actions.loadDashboard();if(actions.hasPermission("roles_manage"))await actions.loadRoles();
  }catch(error){actions.toast(error.message)}
}

export async function deleteCategory(){
  if(!state.library.categoryId.value||!await confirmAction("Kategorie wirklich löschen?",'Kategorie löschen'))return;
  try{await actions.api("/api/categories/"+state.library.categoryId.value,{method:"DELETE"});actions.toast("Kategorie gelöscht.");actions.newCategory();await actions.loadCategories()}
  catch(error){actions.toast(error.message)}
}

export async function openTemplate(id,pushHistory=true){
  const template=state.library.templates.find(item=>item.id===Number(id));
  if(!template){actions.toast("Diese Vorlage ist für Ihre Rolle nicht freigegeben.");return false}
  if(await actions.chooseTemplate(id)===false)return false;
  actions.switchTab("generator",true);return true;
}

export function openTemplateEditor(id){actions.editTemplate(id)}

export function openTemplateFromPath(){
  const match=location.pathname.match(/^\/vorlage\/(\d+)$/);if(!match)return false;
  return actions.openTemplate(Number(match[1]),false);
}

export async function copyTemplateLink(id){
  const link=`${location.origin}/vorlage/${id}`;
  try{await navigator.clipboard.writeText(link);actions.toast("Vorlagenlink wurde kopiert.")}catch(error){actions.toast(link)}
}

export async function loadTemplates(){
  const data=await actions.api("/api/templates");const selectedBefore=state.library.templateSelect.value;
  state.library.templates=data.templates;
  state.library.templateSelect.innerHTML='<option value="">E-Mailvorlage auswählen...</option>'+state.library.templates.filter(template=>template.active&&!template.archived).map(template=>
    `<option value="${template.id}">${actions.esc(template.category?template.category+" – ":"")}${actions.esc(template.name)}</option>`
  ).join("");
  state.library.templateSelect.value=state.library.templates.some(template=>template.active&&!template.archived&&String(template.id)===selectedBefore)?selectedBefore:"";
  actions.updateTemplatePickerButton();actions.updateSaveProjectEmailButton();actions.renderTemplatePickerResults();
  if(actions.hasPermission("templates_manage")){
    const archivedOnly=!!state.shared.byId("showArchivedTemplates")?.checked;
    state.shared.byId("archivedTemplateBulkActions").hidden=!archivedOnly||!actions.hasPermission("roles_manage");
    state.library.templateList.innerHTML=state.library.categories.map(category=>{
      const grouped=state.library.templates.filter(template=>template.category_id===category.id&&template.archived===archivedOnly);
      if(!grouped.length)return "";
      return `<section class="template-category-group"><h3>${actions.esc(category.name)}</h3>${grouped.map((template,index)=>`<div class="list-item template-list-item" data-template-id="${template.id}" ondragover="allowTemplateDrop(event,${category.id})" ondragleave="clearTemplateDrop(event)" ondrop="dropTemplate(event,${template.id},${category.id})">
        <div class="template-row-content">${template.archived&&actions.hasPermission("roles_manage")?`<input class="archived-template-select" type="checkbox" value="${template.id}" aria-label="${actions.esc(template.name)} auswählen">`:""}<span class="drag-handle" draggable="${!template.archived}" title="Vorlage verschieben" aria-label="Vorlage verschieben" ondragstart="beginTemplateDrag(event,${template.id},${category.id})" ondragend="endTemplateDrag()">⋮⋮</span><div><button class="text-button" onclick="editTemplate(${template.id})"><b>${actions.esc(template.name)}</b></button><div class="small">${template.archived?"archiviert":template.active?"aktiv":"inaktiv"}</div></div></div>
        <details class="template-actions-menu"><summary aria-label="Aktionen für ${actions.esc(template.name)}" title="Aktionen">⋮</summary><div>
          ${template.archived?`<button type="button" onclick="restoreTemplate(${template.id})">${actions.menuIcon("restore")} Wiederherstellen</button>${actions.hasPermission("roles_manage")?`<button type="button" class="danger" onclick="permanentlyDeleteTemplate(${template.id})">${actions.menuIcon("trash")} Endgültig löschen</button>`:""}`:`<a class="button-link" href="/vorlage/${template.id}">${actions.menuIcon("external")} Direkt öffnen</a><button type="button" onclick="copyTemplateLink(${template.id})">${actions.menuIcon("copy")} Link kopieren</button>${actions.hasPermission("template_export")?`<button type="button" onclick="exportTemplateById(${template.id},'json')">${actions.menuIcon("download")} Als JSON exportieren</button><button type="button" onclick="exportTemplateById(${template.id},'eml')">${actions.menuIcon("download")} Als EML exportieren</button>`:""}<button type="button" onclick="duplicateTemplate(${template.id})">${actions.menuIcon("duplicate")} Duplizieren</button><button type="button" onclick="editTemplate(${template.id})">${actions.menuIcon("edit")} Bearbeiten</button><button type="button" class="danger archive-menu-action" onclick="archiveTemplate(${template.id})">${actions.menuIcon("archive")} Archivieren</button>`}
        </div></details>
      </div>`).join("")}</section>`;
    }).join("");
  }
  actions.renderManualFields();actions.showTemplatePreview();
  state.shared.byId('templateLibrarySearch')?.dispatchEvent(new Event('input'));
  if(actions.hasPermission("templates_manage")&&state.library.templateValidation&&!state.library.templateValidation.innerHTML)actions.validateTemplatePlaceholders();
}

export function beginTemplateDrag(event,templateId,categoryId){
  state.library.draggedTemplateId=templateId;state.library.draggedTemplateCategoryId=categoryId;
  event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(templateId));
}

export function allowTemplateDrop(event,categoryId){
  if(state.library.draggedTemplateId&&state.library.draggedTemplateCategoryId===categoryId){event.preventDefault();event.dataTransfer.dropEffect="move";event.currentTarget.classList.add("drag-over")}
}

export function clearTemplateDrop(event){event.currentTarget.classList.remove("drag-over")}

export function endTemplateDrag(){document.querySelectorAll(".template-list-item.drag-over").forEach(row=>row.classList.remove("drag-over"));state.library.draggedTemplateId=null;state.library.draggedTemplateCategoryId=null}

export async function dropTemplate(event,targetTemplateId,categoryId){
  event.preventDefault();actions.clearTemplateDrop(event);
  if(!state.library.draggedTemplateId||state.library.draggedTemplateCategoryId!==categoryId||state.library.draggedTemplateId===targetTemplateId)return actions.endTemplateDrag();
  const ordered=state.library.templates.filter(template=>template.category_id===categoryId),dragged=ordered.find(template=>template.id===state.library.draggedTemplateId);
  const remaining=ordered.filter(template=>template.id!==state.library.draggedTemplateId),targetIndex=remaining.findIndex(template=>template.id===targetTemplateId);
  const targetRow=event.currentTarget.getBoundingClientRect(),insertAfter=event.clientY>targetRow.top+targetRow.height/2;
  remaining.splice(targetIndex+(insertAfter?1:0),0,dragged);actions.endTemplateDrag();
  try{await actions.api("/api/templates/order",{method:"PUT",body:JSON.stringify({category_id:categoryId,template_ids:remaining.map(template=>template.id)})});await actions.loadTemplates();await actions.loadDashboard();actions.toast("Vorlagenreihenfolge gespeichert.")}
  catch(error){actions.toast(error.message);await actions.loadTemplates()}
}

export function openTemplatePicker(){
  state.library.templatePickerSearch.value="";actions.renderTemplatePickerResults();state.library.templatePickerDialog.showModal();state.library.templatePickerSearch.focus();
}

export function renderTemplatePickerResults(){
  if(!state.library.templatePickerResults)return;
  const filtered=state.library.templates.filter(template=>template.active&&!template.archived&&actions.templateMatches(template,state.library.templatePickerSearch?.value));
  state.library.templatePickerResults.innerHTML=filtered.length?filtered.map(template=>
    `<div class="picker-result-row"><button class="template-choice" type="button" onclick="chooseTemplate(${template.id})"><b>${actions.esc(template.category)}</b><span>${actions.esc(template.name)}</span></button><button class="favorite-toggle" type="button" title="${state.dashboard.favoriteTemplateIds.has(template.id)?"Favorit entfernen":"Als Favorit markieren"}" aria-label="${state.dashboard.favoriteTemplateIds.has(template.id)?"Favorit entfernen":"Als Favorit markieren"}" onclick="toggleFavorite(${template.id})">${state.dashboard.favoriteTemplateIds.has(template.id)?"★":"☆"}</button></div>`
  ).join(""):"<p class='muted'>Keine passenden Vorlagen gefunden.</p>";
}

export function updateTemplatePickerButton(){
  const template=actions.selectedTemplate();
  if(state.library.templatePickerButton){
    state.library.templatePickerButton.textContent=template?`${template.category} – ${template.name}`:"E-Mailvorlage auswählen...";
    state.library.templatePickerButton.classList.toggle("has-selection",!!template);
  }
  if(state.mail.resultTemplateName)state.mail.resultTemplateName.value=state.mail.resultContext?.templateName??template?.name??"";
}

export async function chooseTemplate(id){
  if(state.mail.resultDirty&&!await confirmAction('Der bearbeitete E-Mailtext wird durch die neue Vorlage ersetzt.'))return false;
  state.mail.resultDirty=false;
  state.library.templateSelect.value=String(id);state.mail.emailGenerated=false;state.mail.resultContext=null;
  actions.updateTemplatePickerButton();actions.updateSaveProjectEmailButton();state.mail.noticeAcknowledged=false;actions.renderManualFields(true);
  actions.showTemplatePreview();
  window.WveDrafts?.capture(state.shared.byId('tab-generator'));
  if(state.library.templatePickerDialog.open)state.library.templatePickerDialog.close();
}

export function selectedTemplate(){return state.library.templates.find(template=>String(template.id)===state.library.templateSelect.value)}

export function extractTemplateKeys(template){
  const keys=[],regex=/\{\{\s*([^}]+?)\s*\}\}/g;
  for(const text of [template?.subject||"",template?.body_html||template?.body||""]){
    let match;while((match=regex.exec(text))!==null)if(!keys.includes(match[1]))keys.push(match[1]);
  }
  for(const field of template?.fields||[]){
    const key=actions.canonicalFieldKey(field);if(!keys.includes(key))keys.push(key);
  }
  return keys;
}

export function renderTemplateNotice(template){
  const html=template?.notice_enabled?String(template?.notice_html||actions.plainTextToHtml(template?.notice_text||"")).trim():"";
  state.library.templateNotice.hidden=!html;state.library.templateNoticeText.innerHTML=html?actions.renderHtmlTemplate(html,actions.currentEmailContext(),true):"";
  state.mail.noticeAcknowledgeButton.textContent=template?.notice_button_label||"Hinweistext gesehen";
  state.mail.noticeAcknowledgeButton.hidden=!html||template?.notice_mode!=="acknowledge"||state.mail.noticeAcknowledged;
  actions.updateOutputButtons();
}

export function renderHtmlTemplate(html,context,preserveMissing=false){
  const rendered=String(html||"").replace(/\{\{\s*([^}]+?)\s*\}\}/g,(match,key)=>
    {
      const value=actions.getPath(context,key);
      return actions.esc(value===undefined||value===null||value===""?(preserveMissing?match:""):value).replace(/\r\n?|\n/g,"<br>");
    });
  return actions.sanitizeEmailHtml(rendered);
}

export function showTemplatePreview(){
  if(state.mail.resultDirty||state.mail.emailGenerated)return;
  const template=actions.selectedTemplate();
  if(state.mail.resultTemplateName)state.mail.resultTemplateName.value=template?.name||"";
  if(!template){
    state.mail.resultTo.value=state.mail.resultCc.value=state.mail.resultSubject.value="";actions.setEditorHtml(state.mail.resultBody,"");actions.resetEditorHistory(state.mail.resultBody);
    actions.renderTemplateNotice(null);state.shared.placeholderWarning.hidden=true;actions.updateSaveProjectEmailButton();return;
  }
  const context=actions.currentEmailContext();
  state.mail.resultTemplateName.value=template.name;state.mail.resultTo.value=actions.getPath(context,"kontakt.email")||"";
  state.mail.resultSubject.value=actions.renderText(template.subject,context,true);
  actions.setEditorHtml(state.mail.resultBody,actions.renderHtmlTemplate(template.body_html||actions.plainTextToHtml(template.body),context,true));
  actions.resetEditorHistory(state.mail.resultBody);
  actions.updatePlaceholderWarning();
  actions.updateSaveProjectEmailButton();
}

export function newTemplate(openEditor=true){
  state.library.tplId.value="";state.library.tplName.value="";state.library.tplSubject.value="";actions.setEditorHtml(state.library.tplBody,"");actions.resetEditorHistory(state.library.tplBody);
  actions.setEditorHtml(state.library.tplNoticeBody,"");actions.resetEditorHistory(state.library.tplNoticeBody);state.library.tplNoticeMode.value="display";state.library.tplNoticeEnabled.checked=false;
  state.library.tplNoticeButtonLabel.value="Hinweistext gesehen";actions.toggleTemplateNoticeEditor();
  state.library.tplCategory.value=state.library.categories[0]?String(state.library.categories[0].id):"";
  state.library.tplActive.checked=true;state.library.editingFields=[];actions.renderFieldEditor();
  state.library.templateIdentity.hidden=true;state.library.tplDisplayId.value=state.library.tplDirectLink.value="";
  templateHistoryButton.hidden=true;
  state.shared.byId("templateExportActions").hidden=true;
  actions.validateTemplatePlaceholders();
  state.shared.byId("templateEditorTitle").textContent="Neue Vorlage erstellen";
  if(openEditor)actions.switchTab("template-edit");
}

export function editTemplate(id){
  const template=state.library.templates.find(item=>item.id===id);if(!template)return;
  state.library.tplId.value=template.id;state.library.tplName.value=template.name;state.library.tplCategory.value=String(template.category_id||"");
  state.library.tplSubject.value=template.subject;
  actions.setEditorHtml(state.library.tplBody,template.body_html||actions.plainTextToHtml(template.body));
  actions.resetEditorHistory(state.library.tplBody);
  state.library.tplActive.checked=template.active;
  actions.setEditorHtml(state.library.tplNoticeBody,template.notice_html||actions.plainTextToHtml(template.notice_text||""));actions.resetEditorHistory(state.library.tplNoticeBody);
  state.library.tplNoticeMode.value=template.notice_mode||"display";state.library.tplNoticeButtonLabel.value=template.notice_button_label||"Hinweistext gesehen";
  state.library.tplNoticeEnabled.checked=!!template.notice_enabled;actions.toggleTemplateNoticeEditor();
  state.library.editingFields=JSON.parse(JSON.stringify(template.fields||[]));actions.renderFieldEditor();
  state.library.templateIdentity.hidden=false;state.library.tplDisplayId.value=String(template.id);state.library.tplDirectLink.value=`${location.origin}/vorlage/${template.id}`;
  templateHistoryButton.hidden=false;
  state.shared.byId("templateExportActions").hidden=!actions.hasPermission("template_export");
  actions.validateTemplatePlaceholders();
  state.shared.byId("templateEditorTitle").textContent=template.name;
  actions.switchTab("template-edit");
}

export function exportTemplateById(id,type){
  if(!actions.hasPermission("template_export"))return actions.toast("Für diesen Export fehlt die Berechtigung.");
  actions.downloadUrl(`/api/templates/${id}/export/${type}`);
}

export function exportTemplate(type){
  const id=Number(state.library.tplId.value);if(!id)return actions.toast("Bitte speichern Sie die Vorlage vor dem Export.");
  actions.exportTemplateById(id,type);
}

export function exportAllTemplates(type){
  if(!actions.hasPermission("templates_export_all"))return actions.toast("Für diesen Export fehlt die Berechtigung.");
  actions.downloadUrl(`/api/templates/export/${type}`);
}

export async function archiveTemplate(id){
  const template=state.library.templates.find(item=>item.id===Number(id));if(!template)return;
  state.shared.pendingArchiveTemplateId=template.id;state.shared.byId("archiveTemplateName").textContent=template.name;state.shared.archiveTemplateDialog.showModal();
}

export function cancelArchiveTemplate(){state.shared.pendingArchiveTemplateId=null;state.shared.archiveTemplateDialog.close()}

export async function confirmArchiveTemplate(){
  if(!state.shared.pendingArchiveTemplateId)return;
  const id=state.shared.pendingArchiveTemplateId;state.shared.pendingArchiveTemplateId=null;state.shared.archiveTemplateDialog.close();
  try{await actions.api(`/api/templates/${id}`,{method:"DELETE"});if(Number(state.library.tplId.value)===id)actions.newTemplate(false);await actions.loadTemplates();actions.switchTab("templates");actions.toast("Vorlage archiviert.")}catch(error){actions.toast(error.message)}
}

export async function restoreTemplate(id){try{await actions.api(`/api/templates/${id}/restore`,{method:"PUT",body:"{}"});await actions.loadTemplates();actions.toast("Vorlage wiederhergestellt.")}catch(error){actions.toast(error.message)}}

export async function permanentlyDeleteTemplate(id){
  actions.openPermanentDelete("template",[id]);
}

export async function openTemplateHistory(){
  const id=Number(state.library.tplId.value);if(!id)return;
  try{const data=await actions.api(`/api/templates/${id}/versions`);templateHistoryTitle.textContent=state.library.tplName.value;
    templateHistoryList.innerHTML=data.versions.map(version=>`<div class="list-item"><div><b>Version ${version.version_no}</b><div class="small">${new Date(version.created_at).toLocaleString()} · ${actions.esc(version.username||"System")}</div></div><button type="button" onclick="restoreTemplateVersion(${id},${version.id},${version.version_no})">Wiederherstellen</button></div>`).join("")||"<p class='muted'>Keine Versionen vorhanden.</p>";
    templateHistoryDialog.showModal();
  }catch(error){actions.toast(error.message)}
}

export async function restoreTemplateVersion(templateId,versionId,versionNo){
  if(!await confirmAction(`Version ${versionNo} wiederherstellen? Der aktuelle Stand bleibt als Version erhalten.`,'Version wiederherstellen'))return;
  try{await actions.api(`/api/templates/${templateId}/versions/${versionId}/restore`,{method:"POST",body:"{}"});templateHistoryDialog.close();await actions.loadTemplates();actions.editTemplate(templateId);actions.toast("Vorlagenversion wiederhergestellt.")}catch(error){actions.toast(error.message)}
}

export function toggleTemplateNoticeEditor(){
  state.shared.byId("tplNoticeSettings").hidden=!state.library.tplNoticeEnabled.checked;
  state.shared.byId("tplNoticeButtonLabelWrap").hidden=!state.library.tplNoticeEnabled.checked||state.library.tplNoticeMode.value!=="acknowledge";
  actions.validateTemplatePlaceholders();
}

export function renderFieldEditor(){
  if(!state.shared.fieldEditor){actions.validateTemplatePlaceholders();return}
  state.shared.fieldEditor.innerHTML=state.library.editingFields.map((field,index)=>`<div class="field-row">
    <label>Schlüssel<input value="${actions.esc(field.key)}" onchange="editingFields[${index}].key=this.value;validateTemplatePlaceholders()"></label>
    <label>Beschriftung<input value="${actions.esc(field.label)}" onchange="editingFields[${index}].label=this.value"></label>
    <label>Typ<select onchange="editingFields[${index}].type=this.value">${["text","textarea","date","number","email"].map(type=>
      `<option value="${type}" ${field.type===type?"selected":""}>${type}</option>`).join("")}</select></label>
    <label><input type="checkbox" ${field.required?"checked":""} onchange="editingFields[${index}].required=this.checked"> Pflicht</label>
    <button onclick="editingFields.splice(${index},1);renderFieldEditor()">×</button>
  </div>`).join("");actions.validateTemplatePlaceholders();
}

export async function copyTemplateIdentityLink(){
  try{await navigator.clipboard.writeText(state.library.tplDirectLink.value);actions.toast("Vorlagenlink wurde kopiert.")}
  catch(error){actions.toast(state.library.tplDirectLink.value)}
}

export function insertVariable(key){
  const token=`{{${key}}}`;
  if(state.library.templateInsertTarget==="subject"){
    const start=state.library.tplSubject.selectionStart??state.library.tplSubject.value.length,end=state.library.tplSubject.selectionEnd??start;
    state.library.tplSubject.value=state.library.tplSubject.value.slice(0,start)+token+state.library.tplSubject.value.slice(end);state.library.tplSubject.focus();
    state.library.tplSubject.setSelectionRange(start+token.length,start+token.length);state.library.tplSubject.dispatchEvent(new Event('input',{bubbles:true}));return;
  }
  const editor=state.library.templateInsertTarget==="notice"?state.library.tplNoticeBody:state.library.tplBody;
  editor.focus();actions.restoreEditorSelection(editor);actions.insertEditorFragment(editor,actions.esc(token));actions.recordEditorHistory(editor);actions.validateTemplatePlaceholders();
}

export function templateEditorKeys(){
  const keys=[],regex=/\{\{\s*([^}]+?)\s*\}\}/g;
  const texts=[state.library.tplSubject.value,actions.getEditorHtml(state.library.tplBody),state.library.tplNoticeEnabled.checked?actions.getEditorHtml(state.library.tplNoticeBody):""];
  for(const text of texts){let match;while((match=regex.exec(text))!==null)if(!keys.includes(match[1]))keys.push(match[1])}
  return keys;
}

export function validateTemplatePlaceholders(){
  if(!state.library.templateValidation)return true;
  const used=actions.templateEditorKeys(),fieldKeys=state.library.editingFields.map(actions.canonicalFieldKey);
  const known=new Set([...state.library.variables.map(variable=>variable.key),...fieldKeys]);
  const unknown=used.filter(key=>!known.has(key));
  const inactive=used.filter(key=>state.library.variables.some(variable=>variable.key===key&&!variable.active));
  const unused=fieldKeys.filter(key=>!used.includes(key));
  const messages=[];
  if(!state.library.tplName.value.trim())messages.push("<b>Name fehlt:</b> Die Vorlage sollte eindeutig bezeichnet werden.");
  if(!state.library.tplCategory.value)messages.push("<b>Kategorie fehlt:</b> Bitte eine Mailkategorie auswählen.");
  if(!state.library.tplSubject.value.trim())messages.push("<b>Betreff fehlt:</b> Die erzeugte E-Mail hätte keinen Betreff.");
  if(!actions.getEditorText(state.library.tplBody).trim())messages.push("<b>E-Mail-Text fehlt:</b> Die Vorlage enthält keinen Nachrichtentext.");
  if(state.library.tplNoticeEnabled.checked&&!actions.getEditorText(state.library.tplNoticeBody).trim())messages.push("<b>Leeres Hinweisfeld:</b> Das Hinweisfeld ist aktiviert, enthält aber keinen Text.");
  if(unknown.length)messages.push(`<b>Unbekannte Platzhalter:</b> ${unknown.map(key=>`{{${actions.esc(key)}}}`).join(", ")}`);
  if(inactive.length)messages.push(`<b>Inaktive Platzhalter:</b> ${inactive.map(key=>`{{${actions.esc(key)}}}`).join(", ")}`);
  if(unused.length)messages.push(`<b>Definiert, aber nicht verwendet:</b> ${unused.map(key=>`{{${actions.esc(key)}}}`).join(", ")}`);
  state.library.templateValidation.className="template-validation "+(messages.length?"problem":"ok");
  state.library.templateValidation.innerHTML=messages.length?messages.join("<br>"):"✓ Die Vorlage enthält keine erkennbaren Auffälligkeiten.";
  return messages;
}

export function templateTestDefinition(key){
  const catalog=state.library.variables.find(variable=>variable.key===key);
  if(catalog)return catalog;
  const custom=state.library.editingFields.find(field=>actions.canonicalFieldKey(field)===key);
  return custom?{...custom,key,source:"manual"}:{key,label:key,type:"text",source:"manual",required:false};
}

export function templateTestSample(definition){
  const examples={
    "projekt.id":"2026-001","projekt.bezeichnung":"HLF 20 Musterstadt","projekt.fahrzeugtyp":"HLF 20","projekt.status":"Auftragsabwicklung",
    "auftraggeber.name":"Stadt Musterstadt","auftraggeber.strasse":"Musterstraße 1","auftraggeber.plz":"12345","auftraggeber.ort":"Musterstadt",
    "kontakt.anrede":"Herr","kontakt.vorname":"Max","kontakt.nachname":"Mustermann","kontakt.email":"max.mustermann@example.de","kontakt.telefon":"01234 567890",
    "benutzer.vorname":state.auth.me?.first_name||"Marcel","benutzer.nachname":state.auth.me?.last_name||"Mustermann","benutzer.email":state.auth.me?.email||"marcel@example.de"
  };
  if(examples[definition.key])return examples[definition.key];
  if(definition.type==="date")return new Date().toISOString().slice(0,10);
  if(definition.type==="number")return "1";
  if(definition.type==="email")return "test@example.de";
  return `${definition.label||definition.key} – Beispiel`;
}

export function openTemplateTest(){
  const keys=actions.templateEditorKeys();state.library.templateTestFields.innerHTML="";
  for(const key of keys){
    const definition=actions.templateTestDefinition(key),label=document.createElement("label");label.textContent=definition.label||key;
    const input=actions.createInput(definition,"template-test-input");input.value=actions.templateTestSample(definition);input.addEventListener("input",actions.updateTemplateTestPreview);
    label.appendChild(input);state.library.templateTestFields.appendChild(label);
  }
  if(!keys.length)state.library.templateTestFields.innerHTML='<p class="muted">Diese Vorlage verwendet keine Platzhalter.</p>';
  actions.updateTemplateTestPreview();state.library.templateTestDialog.showModal();
}

export function updateTemplateTestPreview(){
  const context={};document.querySelectorAll(".template-test-input").forEach(input=>actions.setPath(context,input.dataset.key,input.value));
  state.library.templateTestSubject.value=actions.renderText(state.library.tplSubject.value,context,true);
  state.library.templateTestBody.innerHTML=actions.renderHtmlTemplate(actions.getEditorHtml(state.library.tplBody),context,true);
  const noticeHtml=state.library.tplNoticeEnabled.checked?actions.getEditorHtml(state.library.tplNoticeBody):"";
  state.library.templateTestNotice.hidden=!noticeHtml;state.library.templateTestNoticeText.innerHTML=noticeHtml?actions.renderHtmlTemplate(noticeHtml,context,true):"";
  const modeLabels={display:"Hinweis wird nur angezeigt.",dialog:"Vor jeder Ausgabe muss die Warnung bestätigt werden.",acknowledge:`Ausgaben werden erst nach „${state.library.tplNoticeButtonLabel.value||"Hinweistext gesehen"}“ freigegeben.`};
  state.library.templateTestNoticeMode.textContent=noticeHtml?modeLabels[state.library.tplNoticeMode.value]||"":"";
}

export async function duplicateTemplate(id){
  try{const data=await actions.api(`/api/templates/${id}/duplicate`,{method:"POST",body:"{}"});await actions.loadTemplates();actions.editTemplate(data.id);actions.toast("Vorlage wurde als inaktive Kopie angelegt.")}
  catch(error){actions.toast(error.message)}
}

export async function saveTemplate(){
  actions.validateTemplatePlaceholders();
  const body_html=actions.getEditorHtml(state.library.tplBody),body=actions.getEditorText(state.library.tplBody);
  const notice_html=actions.getEditorHtml(state.library.tplNoticeBody),notice_text=actions.getEditorText(state.library.tplNoticeBody);
  const data={name:state.library.tplName.value,category_id:Number(state.library.tplCategory.value),subject:state.library.tplSubject.value,body,body_html,
    active:state.library.tplActive.checked,fields:state.library.editingFields,notice_enabled:state.library.tplNoticeEnabled.checked,
    notice_text,notice_html,notice_mode:state.library.tplNoticeMode.value,notice_button_label:state.library.tplNoticeButtonLabel.value};
  const save=WveDrafts.beginSave(state.shared.byId('tab-template-edit'));
  try{
    let savedId=Number(state.library.tplId.value)||0;
    if(savedId)await actions.api("/api/templates/"+savedId,{method:"PUT",body:JSON.stringify(data)});
    else{const created=await actions.api("/api/templates",{method:"POST",body:JSON.stringify(data)});savedId=created.id}
    const current=WveDrafts.finishSave(save);
    actions.toast("Vorlage gespeichert.");
    await actions.loadVariables();await actions.loadTemplates();
    if(current&&WveDrafts.isCurrentSave(save))actions.editTemplate(savedId);
  }catch(error){actions.toast(error.message)}
}

export function renderRoleCategoryEditor(selected){
  const selectedIds=selected||Array.from(document.querySelectorAll(".role-category:checked")).map(input=>Number(input.value));
  state.auth.roleCategoryEditor.hidden=state.auth.roleAllCategories.checked;
  state.auth.roleCategoryEditor.innerHTML=state.auth.roleAllCategories.checked?"":state.library.categories.filter(category=>category.active).map(category=>
    `<label><input type="checkbox" class="role-category" value="${category.id}" ${selectedIds.includes(category.id)?"checked":""}> ${actions.esc(category.name)}</label>`
  ).join("");
}
