/** projects: feature logic; state is scoped by domain in state.js. */
import {state,actions} from './state.js';

export function projectActionIcon(icon,label,action,danger=false){
  const custom={mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',contacts:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5"/>'};
  const svg=custom[icon]?`<svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true">${custom[icon]}</svg>`:actions.menuIcon(icon);
  return `<button type="button" class="project-action-button${danger?" danger":""}" title="${actions.esc(label)}" aria-label="${actions.esc(label)}" onclick="${action}">${svg}</button>`;
}

export async function loadProjects(){
  const data=await actions.api("/api/projects");
  const selectedBefore=state.projects.projectSelect.value,contactBefore=state.projects.contactSelect.value;
  state.projects.projects=data.projects;
  state.projects.projectSelect.innerHTML='<option value="">Projekt auswählen...</option>'+state.projects.projects.filter(project=>!project.archived).map(project=>`<option value="${project.id}">${actions.esc(project.project_key)} – ${actions.esc(project.name)}</option>`).join("");
  state.projects.projectSelect.value=state.projects.projects.some(project=>String(project.id)===selectedBefore)?selectedBefore:"";
  actions.renderProjectList();actions.renderProjectPickerResults();actions.updateProjectPickerButton();
  actions.updateBidProjectOptions();
  if(selectedBefore!==state.projects.projectSelect.value&&state.mail.resultContext)state.mail.resultContext.valid=false;
  actions.refreshContacts();
  if(state.projects.projectSelect.value===selectedBefore)state.projects.contactSelect.value=contactBefore;
  actions.renderManualFields();actions.updateSaveProjectEmailButton();
  if(state.projects.currentProjectDetailId)actions.renderProjectDetail(state.projects.currentProjectDetailId);
}

export function projectMatches(project,search){
  const needle=String(search||"").trim().toLocaleLowerCase("de");
  return !needle||`${project.project_key} ${project.name}`.toLocaleLowerCase("de").includes(needle);
}

export function renderProjectList(){
  if(!state.projects.projectList)return;
  const showArchived=!!state.shared.byId("showArchivedProjects")?.checked;
  state.shared.byId("archivedProjectBulkActions").hidden=!showArchived||!actions.hasPermission("roles_manage");
  const direction=state.projects.projectSortOrder?.value==="za"?-1:1;
  const filtered=state.projects.projects.filter(project=>project.archived===showArchived&&actions.projectMatches(project,state.projects.projectOverviewSearch?.value))
    .sort((left,right)=>direction*String(left.project_key).localeCompare(String(right.project_key),"de",{sensitivity:"base",numeric:true}));
  const rows=filtered.map(project=>`<tr class="project-table-row ${project.archived?"archived-item":""}">
    <th scope="row" class="project-key">${project.archived&&actions.hasPermission("roles_manage")?`<input class="archived-project-select" type="checkbox" value="${project.id}" aria-label="${actions.esc(project.project_key)} auswählen"> `:""}${actions.esc(project.project_key)}</th>
    <td class="project-name"><a href="/app/project-detail/${project.id}" onclick="event.preventDefault();openProjectDetail(${project.id})"><b>${actions.esc(project.name)}</b></a>${project.archived?'<div class="small">Archiviert</div>':""}</td>
    <td class="project-date">${new Date(project.imported_at).toLocaleDateString("de-DE")}</td>
    <td class="project-table-actions">${!project.archived&&actions.hasPermission("email_create")?actions.projectActionIcon("mail","E-Mail erstellen",`useProject(${project.id})`):""}
    ${!project.archived&&actions.hasPermission("projects_manage")?actions.projectActionIcon("edit","Projektdaten bearbeiten",`editProject(${project.id})`):""}
    ${!project.archived&&actions.hasPermission("projects_manage")?actions.projectActionIcon("contacts","Kontakte bearbeiten",`openContactDialog(${project.id})`):""}
    ${actions.hasPermission("projects_manage")?(project.archived?actions.projectActionIcon("restore","Projekt wiederherstellen",`restoreProject(${project.id})`):actions.projectActionIcon("archive","Projekt archivieren",`deleteProject(${project.id})`,true)):""}
    ${project.archived&&actions.hasPermission("roles_manage")?actions.projectActionIcon("trash","Projekt endgültig löschen",`permanentlyDeleteProject(${project.id})`,true):""}</td>
  </tr>`).join("");
  state.projects.projectList.innerHTML=filtered.length?`<div class="table-wrap"><table class="project-table"><thead><tr><th>Projekt-ID</th><th>Projektbezeichnung</th><th>Letzte Änderung</th><th>Aktionen</th></tr></thead><tbody>${rows}</tbody></table></div>`:"<div class='empty-state'>Keine passenden Projekte gefunden.</div>";
}

export function openProjectPicker(){
  state.projects.projectPickerSearch.value="";actions.renderProjectPickerResults();state.projects.projectPickerDialog.showModal();state.projects.projectPickerSearch.focus();
}

export function renderProjectPickerResults(){
  if(!state.projects.projectPickerResults)return;
  const filtered=state.projects.projects.filter(project=>!project.archived&&actions.projectMatches(project,state.projects.projectPickerSearch?.value));
  state.projects.projectPickerResults.innerHTML=filtered.length?filtered.map(project=>
    `<button type="button" onclick="chooseProject(${project.id})"><b>${actions.esc(project.project_key)}</b><span>${actions.esc(project.name)}</span></button>`
  ).join(""):"<p class='muted'>Keine passenden Projekte gefunden.</p>";
}

export function updateProjectPickerButton(){
  const project=actions.selectedProject();
  if(state.projects.projectPickerButton){
    state.projects.projectPickerButton.textContent=project?`${project.project_key} – ${project.name}`:"Projekt auswählen...";
    state.projects.projectPickerButton.classList.toggle("has-selection",!!project);
  }
}

export function chooseProject(id){
  if(state.projects.projectSelect.value!==String(id)&&state.mail.resultContext)state.mail.resultContext.valid=false;
  state.projects.projectSelect.value=String(id);actions.updateProjectPickerButton();actions.refreshContacts();actions.renderManualFields(true);
  actions.updateSaveProjectEmailButton();
  window.WveDrafts?.capture(state.shared.byId('tab-generator'));
  if(state.projects.projectPickerDialog.open)state.projects.projectPickerDialog.close();
}

export function contactChanged(){actions.renderManualFields(true);}

export function useProject(id){
  actions.chooseProject(id);actions.setMode("project");actions.switchTab("generator");
}

export async function importProject(){
  try{
    const object=JSON.parse(state.shared.jsonPaste.value);
    actions.prepareProjectImport(object,"json");
  }catch(error){actions.toast(error.message)}
}

export function openExcelImportFromPath(){
  if(location.pathname!=="/excel-import")return false;
  if(!actions.hasPermission("projects_manage")){actions.toast("Für den Excel-Import fehlt die Berechtigung.");return false}
  actions.switchTab("excel-import",true);actions.previewExcelImport();return true;
}

export function parsedExcelProject(){
  const project=JSON.parse(state.shared.excelImportJson.value||"");
  if(!project?.projekt?.id||!project?.projekt?.bezeichnung)throw new Error("Projekt-ID und Projektbezeichnung fehlen.");
  if(project.kontakte!==undefined&&!Array.isArray(project.kontakte))throw new Error("kontakte muss eine Liste sein.");
  return project;
}

export function previewExcelImport(){
  if(!state.shared.excelImportPreview)return;
  if(!state.shared.excelImportJson.value.trim()){state.shared.excelImportPreview.textContent="Noch keine Projektdaten eingelesen.";return}
  try{
    const data=actions.parsedExcelProject(),existing=state.projects.projects.find(item=>item.project_key===String(data.projekt.id));
    state.shared.excelImportPreview.innerHTML=`<b>${existing?"Vorhandenes Projekt aktualisieren":"Neues Projekt anlegen"}</b><br>${actions.esc(data.projekt.id)} – ${actions.esc(data.projekt.bezeichnung)}<br>${(data.kontakte||[]).length} Kontakt(e)`;
  }catch(error){state.shared.excelImportPreview.textContent="Die Daten sind noch nicht gültig: "+error.message}
}

export async function importExcelProject(){
  try{
    const data=actions.parsedExcelProject();
    actions.prepareProjectImport(data,"excel");
  }catch(error){actions.toast(error.message)}
}

export async function deleteProject(id){
  const project=state.projects.projects.find(item=>item.id===Number(id));if(!project)return;
  state.shared.pendingArchiveProject={id:project.id,revision:project.revision};
  state.shared.byId("archiveProjectName").textContent=`${project.project_key} – ${project.name}`;state.shared.archiveProjectDialog.showModal();
}

export function cancelArchiveProject(){state.shared.pendingArchiveProject=null;state.shared.archiveProjectDialog.close()}

export async function confirmArchiveProject(){
  const pending=state.shared.pendingArchiveProject;if(!pending)return;
  const {id,revision}=pending;actions.cancelArchiveProject();
  try{
    await actions.api("/api/projects/"+id,{method:"DELETE",body:JSON.stringify({expected_revision:revision})});
    if(state.projects.currentProjectDetailId===id&&state.shared.byId("tab-project-detail").classList.contains("active")){
      state.projects.currentProjectDetailId=null;actions.switchTab("project-overview");
    }
    await actions.loadProjects();actions.toast("Projekt archiviert.");
  }catch(error){await refreshOnProjectConflict(error)}
}

export async function restoreProject(id){
  const project=state.projects.projects.find(item=>item.id===Number(id));if(!project)return;
  const revision=project.revision;
  if(!await confirmAction(`${project.project_key} – ${project.name} wiederherstellen?`,"Projekt wiederherstellen"))return;
  try{
    await actions.api(`/api/projects/${id}/restore`,{method:"PUT",body:JSON.stringify({expected_revision:revision})});
    await actions.loadProjects();actions.toast("Projekt wiederhergestellt.");
  }catch(error){await refreshOnProjectConflict(error)}
}

async function refreshOnProjectConflict(error){
  if(error.status!==409)return actions.toast(error.message);
  if(await confirmAction(error.message+" Projektliste aktualisieren?","Projekt wurde inzwischen geändert")){
    try{await actions.loadProjects()}catch(loadError){actions.toast(loadError.message)}
  }
}

export async function permanentlyDeleteProject(id){
  actions.openPermanentDelete("project",[id]);
}

export function prepareProjectImport(data,source){
  if(!data?.projekt?.id||!data?.projekt?.bezeichnung)return actions.toast("Projekt-ID und Projektbezeichnung fehlen.");
  const existing=state.projects.projects.find(project=>project.project_key===String(data.projekt.id).trim());
  if(existing?.archived)return actions.toast("Dieses Projekt ist archiviert. Bitte stellen Sie es vor einem Import wieder her.");
  const before=existing?actions.flattenImportValue(existing.data):{},after=actions.flattenImportValue(data),keys=[...new Set([...Object.keys(before),...Object.keys(after)])].sort();
  const changes=keys.filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key])).map(key=>({key,before:before[key],after:after[key]}));
  if(data.kontakte!==undefined&&!Array.isArray(data.kontakte))return actions.toast('Kontakte müssen als Liste angegeben werden.');
  state.shared.pendingProjectImport={data,source,revision:existing?.revision};
  importPreviewContent.innerHTML=`<div class="info-box"><b>${existing?"Vorhandenes Projekt aktualisieren":"Neues Projekt anlegen"}</b><br>${actions.esc(data.projekt.id)} – ${actions.esc(data.projekt.bezeichnung)}<br>${(data.kontakte||[]).length} Kontakt(e)</div>`+
    (changes.length?`<div class="change-list">${changes.map(change=>`<div><b>${actions.esc(change.key)}</b><span class="old-value">${change.before===undefined?"—":actions.esc(change.before)}</span><span aria-hidden="true">→</span><span class="new-value">${change.after===undefined?"—":actions.esc(change.after)}</span></div>`).join("")}</div>`:"<p>Keine inhaltlichen Änderungen erkannt.</p>");
  importPreviewDialog.showModal();
}

export function cancelProjectImport(){state.shared.pendingProjectImport=null;importPreviewDialog.close()}

export async function confirmProjectImport(){
  if(!state.shared.pendingProjectImport)return;
  const pending=state.shared.pendingProjectImport,{data,source,revision}=pending;
  const save=WveDrafts.beginSave(state.shared.byId(source==="json"?"tab-project-create":"tab-excel-import"));
  try{
    await actions.api("/api/projects",{method:"POST",body:JSON.stringify({data,expected_revision:revision})});
    const current=WveDrafts.finishSave(save);
    if(state.shared.pendingProjectImport===pending)actions.cancelProjectImport();
    await actions.loadProjects();
    if(current&&WveDrafts.isCurrentSave(save)){
      if(source==="json"){state.shared.jsonPaste.value="";state.shared.jsonFile.value=""}else actions.previewExcelImport();
    }
    actions.toast("Projekt wurde importiert.");
  }catch(error){
    if(error.code!=="revision_conflict"||state.shared.pendingProjectImport!==pending||!importPreviewDialog.open)return actions.toast(error.message);
    if(await confirmAction(error.message+" Importvorschau aktualisieren?","Projektstand hat sich geändert")){
      importPreviewDialog.close();
      state.shared.pendingProjectImport=null;
      try{await actions.loadProjects();actions.prepareProjectImport(data,source)}catch(loadError){actions.toast(loadError.message)}
    }
  }
}

export function editProject(id){
  const project=state.projects.projects.find(item=>item.id===id);if(!project)return;
  state.projects.editingProjectData=JSON.parse(JSON.stringify(project.data||{}));
  state.projects.editingProjectRevision=project.revision;
  state.projects.editingProjectData.kontakte=Array.isArray(state.projects.editingProjectData.kontakte)?state.projects.editingProjectData.kontakte:[];
  state.projects.projectEditId.value=String(id);state.projects.projectEditFields.innerHTML="";
  state.shared.byId("projectEditConflict").hidden=true;
  const context=state.projects.editingProjectData;
  for(const variable of actions.projectRecordVariables()){
    const label=document.createElement("label");label.textContent=variable.label+(variable.required?" *":"");
    const input=actions.createInput(variable,"project-edit-input");input.value=actions.getPath(context,variable.key)||"";
    label.appendChild(input);state.projects.projectEditFields.appendChild(label);
  }
  actions.switchTab('project-edit');
  window.WveDrafts?.restore(state.projects.projectEditDialog);
}

export async function saveEditedProject(){
  if(!state.projects.editingProjectData)return;
  const context=state.projects.editingProjectData;
  document.querySelectorAll(".project-edit-input").forEach(input=>actions.setPath(context,input.dataset.key,input.value));
  const missing=actions.projectRecordVariables().filter(variable=>variable.required&&!String(actions.getPath(context,variable.key)).trim());
  if(missing.length)return actions.toast("Pflichtfeld fehlt: "+missing[0].label);
  const projectId=Number(state.projects.projectEditId.value);
  const save=WveDrafts.beginSave(state.projects.projectEditDialog);
  try{
    await actions.api(`/api/projects/${projectId}`,{method:"PUT",body:JSON.stringify({data:context,expected_revision:state.projects.editingProjectRevision})});
    const current=WveDrafts.finishSave(save);
    actions.toast("Projekt wurde aktualisiert.");await actions.loadProjects();
    if(current&&WveDrafts.isCurrentSave(save))actions.openProjectDetail(projectId);
  }catch(error){
    if(!WveDrafts.isCurrentSave(save))return actions.toast(error.message);
    const warning=state.shared.byId("projectEditConflict");warning.querySelector("span").textContent=error.message;warning.hidden=false;
  }
}

export async function reloadEditingProject(){
  if(!await confirmAction('Ihre Eingaben werden durch den aktuellen Projektstand ersetzt.'))return;
  window.WveDrafts?.clean(state.projects.projectEditDialog);await actions.loadProjects();actions.editProject(Number(state.projects.projectEditId.value));
}

export function openProjectDetail(id){state.projects.currentProjectDetailId=Number(id);actions.renderProjectDetail(state.projects.currentProjectDetailId);actions.switchTab("project-detail")}

export function renderProjectDetail(id){
  const project=state.projects.projects.find(item=>item.id===Number(id));if(!project){state.projects.currentProjectDetailId=null;return actions.switchTab("project-overview")}
  state.shared.byId("projectDetailTitle").textContent=`${project.project_key} – ${project.name}`;
  state.shared.byId("projectDetailMeta").textContent=`Zuletzt geändert: ${new Date(project.imported_at).toLocaleString()}${project.archived?" · archiviert":""}`;
  state.shared.byId("projectDetailVariables").innerHTML=actions.projectRecordVariables().map(variable=>`<div><dt>${actions.esc(variable.label)}</dt><dd>${actions.esc(actions.getPath(project.data,variable.key)||"—")}</dd></div>`).join("");
  const contacts=project.data?.kontakte||[];
  state.shared.byId("projectDetailContacts").innerHTML=contacts.length?`<ul class="contact-list">${contacts.map(contact=>`<li class="project-contact-row"><div class="contact-list-name"><strong>${actions.esc([contact.vorname,contact.nachname].filter(Boolean).join(" ")||contact.anrede||"Kontakt")}</strong><span class="muted">${actions.esc(contact.rolle||"Keine Rolle")}</span></div><dl><div><dt>Ansprache</dt><dd>${actions.esc(contact.anrede||"—")}</dd></div><div><dt>E-Mail</dt><dd>${contact.email?`<a href="mailto:${actions.esc(contact.email)}">${actions.esc(contact.email)}</a>`:"—"}</dd></div><div><dt>Telefon</dt><dd>${actions.esc(contact.telefon||"—")}</dd></div></dl></li>`).join("")}</ul>`:"<p class='muted'>Für dieses Projekt sind noch keine Kontakte hinterlegt.</p>";
  const contactsEdit=state.shared.byId("projectContactsEditButton");
  contactsEdit.hidden=project.archived||!actions.hasPermission("projects_manage");
  contactsEdit.onclick=()=>actions.openContactDialog(project.id);
  state.shared.byId("projectDetailActions").innerHTML=`${!project.archived&&actions.hasPermission("email_create")?`<button type="button" onclick="useProject(${project.id})">E-Mail erstellen</button>`:""}${!project.archived&&actions.hasPermission("projects_manage")?`<button type="button" onclick="editProject(${project.id})">Projektdaten bearbeiten</button><button type="button" class="danger" onclick="deleteProject(${project.id})">Archivieren</button>`:""}${project.archived&&actions.hasPermission("projects_manage")?`<button type="button" onclick="restoreProject(${project.id})">Wiederherstellen</button>`:""}${project.archived&&actions.hasPermission("roles_manage")?`<button type="button" class="danger" onclick="permanentlyDeleteProject(${project.id})">Endgültig löschen</button>`:""}`;
  actions.loadProjectWorkspace(project.id);
}

export async function loadProjectWorkspace(projectId){
  const request=++state.projects.workspaceRequest;
  try{
    const workspace=await actions.api(`/api/projects/${projectId}/workspace`);
    if(request!==state.projects.workspaceRequest||Number(projectId)!==state.projects.currentProjectDetailId)return;
    state.projects.currentProjectWorkspace=workspace;
    actions.renderProjectWorkspace();
  }catch(error){
    if(request!==state.projects.workspaceRequest)return;
    state.projects.currentProjectWorkspace={emails:[],bid_questions:[]};actions.renderProjectWorkspace();actions.toast(error.message);
  }
}

export function renderProjectWorkspace(){
  actions.renderProjectDocuments();
  const questions=state.projects.currentProjectWorkspace.bid_questions||[],emails=state.projects.currentProjectWorkspace.emails||[];
  const questionTarget=state.shared.byId("projectPhaseBidQuestions"),emailTarget=state.shared.byId("projectSavedEmails");
  if(questionTarget)questionTarget.innerHTML=questions.length?`<div class="phase-module-heading"><b>Bieterfragen</b><span>${questions.length}</span></div>`+questions.map(question=>
    `<article class="phase-bid-question"><header><button type="button" class="text-button" onclick="openBidQuestion(${question.id})"><b>${actions.esc(question.category||"Ohne Kategorie")} · ${actions.esc(question.subject||"Ohne Thema")}</b></button><span class="bid-status ${question.answered_at?"done":""}">${actions.bidQuestionStatus(question)}</span></header><div>${actions.bidOverviewLine("Bieter",question.bidder||"—")}${actions.bidOverviewLine("Bieterfrage",question.question)}${actions.bidOverviewLine("Kommentar Agentur Wieseke",question.agency_comment||"—")}${actions.bidOverviewLine("Entscheidung",question.decision||"—")}${actions.bidOverviewLine("Antwort",question.answer||"—")}</div>${actions.hasPermission("bid_questions_manage")&&question.answer&&!question.answered_at?`<footer><button type="button" class="success-button" onclick="acknowledgeBidQuestion(${question.id})">Beantwortung quittieren</button></footer>`:""}</article>`
  ).join(""):"<div class='phase-empty'>Noch keine Bieterfragen erfasst.</div>";
  if(emailTarget)emailTarget.innerHTML=emails.length?emails.map(email=>`<button type="button" class="project-email-record" onclick="openProjectEmail(${email.id})"><span><b>${actions.esc(email.subject)}</b><small>${actions.esc(email.template_name||"Ohne Vorlage")} · ${new Date(email.created_at).toLocaleString()}</small></span><span>${actions.esc(email.recipient||"Kein Empfänger")}</span></button>`).join(""):"<p class='muted'>Noch keine E-Mails im Projekt gespeichert.</p>";
}

export function openProjectEmail(id){
  const email=(state.projects.currentProjectWorkspace.emails||[]).find(item=>item.id===Number(id));if(!email)return;
  state.shared.currentOpenedProjectEmailId=email.id;
  state.shared.byId("projectEmailDialogSubject").textContent=email.subject;
  state.shared.byId("projectEmailDialogMeta").textContent=`${email.template_name||"Ohne Vorlage"} · gespeichert ${new Date(email.created_at).toLocaleString()} von ${email.username}`;
  state.shared.byId("projectEmailDialogTo").textContent=email.recipient||"—";state.shared.byId("projectEmailDialogCc").textContent=email.cc||"—";
  state.shared.byId("projectEmailDialogBody").innerHTML=actions.sanitizeEmailHtml(email.body_html||actions.plainTextToHtml(email.body_text));
  state.projects.projectEmailDialog.showModal();
}

export function openContactDialog(id){
  state.projects.editingContactProject=state.projects.projects.find(project=>project.id===id);if(!state.projects.editingContactProject)return;
  state.shared.byId("contactDialogProject").textContent=`${state.projects.editingContactProject.project_key} – ${state.projects.editingContactProject.name}`;
  state.shared.byId('contactConflict')?.remove();
  actions.renderContactList();actions.newContact();state.projects.contactDialog.showModal();
}

export function contactDisplayName(contact){
  return [contact.rolle,contact.anrede,contact.vorname,contact.nachname].filter(Boolean).join(" – ")||contact.email||"Kontakt";
}

export function renderContactList(){
  const contacts=state.projects.editingContactProject?.data?.kontakte||[];
  state.projects.contactList.innerHTML=contacts.length?contacts.map((contact,index)=>
    `<button type="button" class="contact-list-button" onclick="editContact(${index})"><b>${actions.esc(actions.contactDisplayName(contact))}</b><span>${actions.esc(contact.email||"")}</span></button>`
  ).join(""):"<p class='muted'>Noch keine Kontakte vorhanden.</p>";
}

export function newContact(){state.projects.editingContactIndex=-1;actions.renderContactEditor({});state.shared.byId("contactEditorTitle").textContent="Kontakt hinzufügen";state.shared.deleteContactButton.hidden=true;window.WveDrafts?.restore(state.projects.contactDialog)}

export function editContact(index){
  const contact=state.projects.editingContactProject?.data?.kontakte?.[index];if(!contact)return;
  state.projects.editingContactIndex=index;actions.renderContactEditor(contact);state.shared.byId("contactEditorTitle").textContent="Kontakt bearbeiten";state.shared.deleteContactButton.hidden=false;
  window.WveDrafts?.restore(state.projects.contactDialog);
}

export function renderContactEditor(contact){
  state.projects.contactEditFields.innerHTML="";const context={kontakt:contact||{}};
  for(const variable of actions.contactVariables()){
    const label=document.createElement("label");label.textContent=variable.label+(variable.required?" *":"");
    const input=actions.createInput(variable,"contact-edit-input");input.value=actions.getPath(context,variable.key)||"";
    label.appendChild(input);state.projects.contactEditFields.appendChild(label);
  }
}

export async function persistContacts(contacts){
  const {id:projectId,revision}=state.projects.editingContactProject;
  const save=WveDrafts.beginSave(state.projects.contactDialog);
  try{await actions.api(`/api/projects/${projectId}/contacts`,{method:"PUT",body:JSON.stringify({kontakte:contacts,expected_revision:revision})});}
  catch(error){
    if(error.status===409&&WveDrafts.isCurrentSave(save)){
      state.shared.byId('contactConflict')?.remove();const warning=document.createElement('div');warning.id='contactConflict';warning.className='warning';warning.setAttribute('role','alert');warning.textContent=error.message+' Ihre Eingaben bleiben erhalten. ';
      const reload=document.createElement('button');reload.textContent='Aktuellen Stand neu laden';reload.onclick=async()=>{if(!await confirmAction('Kontaktentwurf verwerfen und aktuellen Projektstand laden?'))return;const id=state.projects.editingContactProject.id;window.WveDrafts?.clean(state.projects.contactDialog);state.projects.contactDialog.close();await actions.loadProjects();actions.openContactDialog(id)};
      warning.append(reload);state.projects.contactEditFields.before(warning);
    }
    throw error;
  }
  const current=WveDrafts.finishSave(save);
  await actions.loadProjects();
  if(!current||!WveDrafts.isCurrentSave(save))return false;
  state.projects.editingContactProject=state.projects.projects.find(project=>project.id===projectId);
  actions.renderContactList();actions.newContact();
  return true;
}

export async function saveContact(){
  const context={kontakt:{}};document.querySelectorAll(".contact-edit-input").forEach(input=>actions.setPath(context,input.dataset.key,input.value));
  const missing=actions.contactVariables().filter(variable=>variable.required&&!String(actions.getPath(context,variable.key)).trim());
  if(missing.length)return actions.toast("Pflichtfeld fehlt: "+missing[0].label);
  const contacts=JSON.parse(JSON.stringify(state.projects.editingContactProject?.data?.kontakte||[]));
  if(state.projects.editingContactIndex<0)contacts.push(context.kontakt);else contacts[state.projects.editingContactIndex]=context.kontakt;
  try{await actions.persistContacts(contacts);actions.toast("Kontakt wurde gespeichert.")}catch(error){actions.toast(error.message)}
}

export async function deleteContact(){
  if(state.projects.editingContactIndex<0||!await confirmAction("Kontakt wirklich löschen?",'Kontakt löschen'))return;
  const contacts=JSON.parse(JSON.stringify(state.projects.editingContactProject?.data?.kontakte||[]));contacts.splice(state.projects.editingContactIndex,1);
  try{await actions.persistContacts(contacts);actions.toast("Kontakt wurde gelöscht.")}catch(error){actions.toast(error.message)}
}

export async function importContactRows(){
  const lines=String(state.projects.contactQuickImport?.value||"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(!state.projects.editingContactProject||!lines.length)return actions.toast("Bitte mindestens eine Kontaktzeile einfügen.");
  const keys=["rolle","anrede","vorname","nachname","email","telefon"];
  const normalized={rolle:"rolle",anrede:"anrede",vorname:"vorname",nachname:"nachname",email:"email","e-mail":"email",telefon:"telefon"};
  const delimiter=lines[0].includes(";")?";":"\t";
  let rows=lines.map(line=>actions.parseDelimitedLine(line,delimiter));
  let columns=keys;
  if(rows[0].some(cell=>normalized[cell.toLocaleLowerCase("de")])){
    columns=rows.shift().map(cell=>normalized[cell.toLocaleLowerCase("de")]||"");
  }
  const imported=rows.map(row=>Object.fromEntries(row.map((value,index)=>[columns[index],value]).filter(([key,value])=>key&&value)))
    .filter(contact=>Object.keys(contact).length);
  if(!imported.length)return actions.toast("Es wurden keine Kontaktdaten erkannt.");
  const contacts=JSON.parse(JSON.stringify(state.projects.editingContactProject.data?.kontakte||[]));contacts.push(...imported);
  try{if(await actions.persistContacts(contacts))state.projects.contactQuickImport.value="";actions.toast(`${imported.length} Kontakt(e) wurden importiert.`)}
  catch(error){actions.toast(error.message)}
}

export function showProjectEntry(type){
  const json=type==="json";
  state.shared.byId("projectJsonEntry").hidden=!json;state.shared.byId("projectFormEntry").hidden=json;
  state.shared.byId("projectJsonTabButton").classList.toggle("active",json);
  state.shared.byId("projectFormTabButton").classList.toggle("active",!json);
}

export function relevantProjectVariables(){
  return state.library.variables.filter(variable=>variable.active&&["project","client","contact"].includes(variable.source));
}

export function projectRecordVariables(){return state.library.variables.filter(variable=>variable.active&&["project","client"].includes(variable.source))}

export function contactVariables(){return state.library.variables.filter(variable=>variable.active&&variable.source==="contact")}

export function renderProjectManualFields(){
  if(!state.projects.projectManualFields)return;
  const entered=Object.fromEntries([...state.projects.projectManualFields.querySelectorAll(".project-manual-input")].map(input=>[input.dataset.key,input.value]));
  state.projects.projectManualFields.innerHTML="";
  for(const variable of actions.projectRecordVariables()){
    const label=document.createElement("label");label.textContent=variable.label+(variable.required?" *":"");
    const input=actions.createInput(variable,"project-manual-input");input.value=entered[variable.key]??"";
    label.appendChild(input);state.projects.projectManualFields.appendChild(label);
  }
}

export function projectObjectFromInputs(selector){
  const data={schema_version:"1.0",projekt:{},auftraggeber:{},kontakte:[]};
  document.querySelectorAll(selector).forEach(input=>actions.setPath(data,input.dataset.key,input.value));
  return data;
}

export async function saveManualProject(){
  const data=actions.projectObjectFromInputs(".project-manual-input");
  const missing=actions.projectRecordVariables().filter(variable=>variable.required&&!actions.getPath(data,variable.key));
  if(missing.length)return actions.toast("Pflichtfeld fehlt: "+missing[0].label);
  const save=WveDrafts.beginSave(state.shared.byId('tab-project-create'));
  try{
    await actions.api("/api/projects",{method:"POST",body:JSON.stringify({data})});
    actions.toast("Projekt wurde gespeichert.");
    if(WveDrafts.finishSave(save))document.querySelectorAll(".project-manual-input").forEach(input=>input.value="");
    await actions.loadProjects();
  }catch(error){actions.toast(error.message)}
}

export function buildProjectJsonTemplate(){
  const data={schema_version:"1.0",projekt:{},auftraggeber:{},kontakte:[]};
  const contact={};
  for(const variable of actions.relevantProjectVariables()){
    if(variable.source==="contact")actions.setPath({kontakt:contact},variable.key,"");
    else actions.setPath(data,variable.key,"");
  }
  if(Object.keys(contact).length)data.kontakte.push(contact);
  return data;
}

export function downloadProjectJsonTemplate(){
  const blob=new Blob([JSON.stringify(actions.buildProjectJsonTemplate(),null,2)],{type:"application/json;charset=utf-8"});
  actions.downloadBlob(blob,"Projekt-Vorlage.json");
}

export function selectedProject(){return state.projects.projects.find(project=>String(project.id)===state.projects.projectSelect.value)}

export function refreshContacts(){
  const project=actions.selectedProject(),contacts=project?.data?.kontakte||[];
  state.projects.contactSelect.innerHTML='<option value="">Keinen Kontakt auswählen</option>'+contacts.map((contact,index)=>
    `<option value="${index}">${actions.esc([contact.rolle,contact.vorname,contact.nachname].filter(Boolean).join(" – "))}</option>`
  ).join("");
}

// The editor can intentionally show an old result while the left-hand context
// changes. Only a result produced for this exact context may be filed here.
function projectEmailTarget(){
  const project=actions.selectedProject(),context=state.mail.resultContext;
  return state.mail.emailGenerated&&state.mail.mode.value==="project"&&project&&!project.archived&&
    context?.valid&&context.projectId===project.id&&context.selectedTemplateId===state.library.templateSelect.value?context:null;
}

export function updateSaveProjectEmailButton(){
  const button=state.shared.saveProjectEmailButton;if(!button)return;
  const shown=state.mail.mode.value==="project"&&!!actions.selectedProject();
  const enabled=!!projectEmailTarget();
  button.hidden=!shown;
  button.disabled=!enabled;
  state.shared.byId("saveProjectEmailHint").hidden=!(shown&&!enabled);
}

export async function saveEmailToProject(){
  const target=projectEmailTarget();
  if(!target)return actions.toast("Bitte die Angaben für das ausgewählte Projekt zuerst in die E-Mail übernehmen.");
  try{
    await actions.api(`/api/projects/${target.projectId}/emails`,{method:"POST",body:JSON.stringify({
      template_id:target.templateId,template_name:target.templateName,recipient:state.mail.resultTo.value,cc:state.mail.resultCc.value,
      subject:state.mail.resultSubject.value,body_text:actions.getEditorText(state.mail.resultBody),body_html:actions.getEditorHtml(state.mail.resultBody)
    })});
    actions.toast("E-Mail wurde im Projekt gespeichert.");
    if(state.projects.currentProjectDetailId===target.projectId)await actions.loadProjectWorkspace(target.projectId);
  }catch(error){actions.toast(error.message)}
}
