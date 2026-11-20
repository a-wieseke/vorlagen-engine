/** documents: feature logic; state is scoped by domain in state.js. */
import {state,actions} from './state.js';

export async function loadDocumentModule(){
  try{
    const [templateData,blockData,pdfData]=await Promise.all([actions.api("/api/document-templates"),actions.api("/api/document-blocks"),actions.api("/api/documents/pdf-status")]);
    state.documents.documentTemplates=templateData.templates||[];state.documents.documentBlocks=blockData.blocks||[];
    state.documents.documentPdfAvailable=pdfData.available;state.shared.byId("documentPdfInfo").textContent=pdfData.message;
    state.shared.byId('documentPdfButton').hidden=!pdfData.available;
    state.shared.byId("documentSavePdfOption").disabled=!state.documents.documentPdfAvailable;
    if(!state.documents.documentPdfAvailable)state.shared.byId("documentSaveFormat").value="docx";
    actions.renderDocumentTemplateOptions();actions.renderDocumentTemplateList();actions.renderDocumentBlockList();
    await actions.renderDocumentFields();
  }catch(error){actions.toast(error.message)}
}

export function selectedDocumentTemplate(){return state.documents.documentTemplates.find(item=>String(item.id)===state.shared.byId("documentTemplateSelect").value)}

export function documentProject(){return state.projects.projects.find(item=>String(item.id)===state.shared.byId("documentProjectSelect").value)}

export function documentContext(){
  const context=state.shared.byId("documentMode").value==="project"?structuredClone(actions.documentProject()?.data||{}):{};
  const index=state.shared.byId("documentContactIndex").value;
  context.kontakt=index!==""?context.kontakte?.[Number(index)]||{}:{};
  return context;
}

export function setDocumentMode(value){
  state.shared.byId("documentMode").value=value;
  state.shared.byId("documentModeManualButton").classList.toggle("active",value==="manual");
  state.shared.byId("documentModeProjectButton").classList.toggle("active",value==="project");
  state.shared.byId("documentProjectWrap").hidden=value!=="project";
  actions.renderDocumentTemplateOptions();actions.renderDocumentFields();
}

export function renderDocumentTemplateOptions(){
  const template=actions.selectedDocumentTemplate(),project=actions.documentProject();
  if(!template?.active)state.shared.byId("documentTemplateSelect").value="";
  if(!project||project.archived)state.shared.byId("documentProjectSelect").value="";
  const contact=actions.documentContext().kontakt;
  const selections=[
    ["documentTemplateButton",template?.active?template.name:"Dokumentvorlage auswählen...",!!template?.active],
    ["documentProjectButton",project&&!project.archived?`${project.project_key} – ${project.name}`:"Projekt auswählen...",!!project&&!project.archived],
    ["documentContactButton",Object.keys(contact).length?actions.contactDisplayName(contact):"Kein Kontakt",!!Object.keys(contact).length]
  ];
  selections.forEach(([id,label,selected])=>{state.shared.byId(id).textContent=label;state.shared.byId(id).classList.toggle("has-selection",selected)});
  state.shared.byId("documentSaveWrap").hidden=state.shared.byId("documentMode").value!=="project"||!state.shared.byId("documentProjectSelect").value;
}

export function openDocumentPicker(target){
  state.documents.documentPickerTarget=target;
  state.shared.byId("documentPickerTitle").textContent={template:"Dokumentvorlage auswählen",project:"Projekt auswählen",contact:"Kontakt auswählen"}[target];
  state.shared.byId("documentPickerSearch").value="";actions.renderDocumentPickerResults();
  state.shared.byId("documentPickerDialog").showModal();state.shared.byId("documentPickerSearch").focus();
}

export function renderDocumentPickerResults(){
  const needle=state.shared.byId("documentPickerSearch").value.trim().toLocaleLowerCase("de");let rows=[];
  if(state.documents.documentPickerTarget==="template")rows=state.documents.documentTemplates.filter(item=>item.active).map(item=>({id:item.id,label:item.name,detail:item.description||item.original_filename}));
  if(state.documents.documentPickerTarget==="project")rows=actions.activeProjects().map(item=>({id:item.id,label:`${item.project_key} – ${item.name}`,detail:""}));
  if(state.documents.documentPickerTarget==="contact")rows=(actions.documentProject()?.data?.kontakte||[]).map((item,index)=>({id:index,label:actions.contactDisplayName(item),detail:item.email||""}));
  rows=rows.filter(item=>`${item.label} ${item.detail}`.toLocaleLowerCase("de").includes(needle));
  state.shared.byId("documentPickerResults").innerHTML=(state.documents.documentPickerTarget==="contact"?'<button class="list-row" onclick="selectDocumentPicker(null)">Kein Kontakt</button>':"")+
    (rows.map(item=>`<button class="list-row" onclick="selectDocumentPicker(${item.id})"><span><b>${actions.esc(item.label)}</b><small>${actions.esc(item.detail)}</small></span></button>`).join("")||'<p class="muted">Keine passenden Einträge.</p>');
}

export function selectDocumentPicker(id){
  const target={template:"documentTemplateSelect",project:"documentProjectSelect",contact:"documentContactIndex"}[state.documents.documentPickerTarget];
  state.shared.byId(target).value=id===null?"":String(id);
  if(state.documents.documentPickerTarget==="project")state.shared.byId("documentContactIndex").value="";
  state.shared.byId("documentPickerDialog").close();actions.renderDocumentTemplateOptions();actions.renderDocumentFields();
}

export function documentAnalysisHtml(analysis){
  const fields=analysis.placeholders||[],blocks=analysis.blocks||[];
  return `<b>${fields.length} Datenfeld(er) · ${blocks.length} Textbaustein(e)</b>
    <p class="placeholder-key-list">${fields.map(key=>`<code>${actions.esc(key)}</code>`).join(" ")||"Keine Datenfelder."}</p>
    ${blocks.length?`<p>Textbausteine: ${blocks.map(actions.esc).join(", ")}</p>`:""}
    ${analysis.warnings?.length?`<div class="document-warning"><b>Hinweise zur Vorlage</b><ul>${analysis.warnings.map(w=>`<li>${actions.esc(w)}</li>`).join("")}</ul></div>`:"<p>Keine Auffälligkeiten in der Platzhalterprüfung.</p>"}`;
}

export async function renderDocumentFields(){
  ++state.documents.documentInputRevision;
  const request=++state.documents.documentFieldRequest,template=actions.selectedDocumentTemplate();
  state.documents.documentAnalysis=null;state.shared.byId("documentFieldList").innerHTML="";state.shared.byId("documentValidation").innerHTML="";actions.documentOutputState();
  if(!template){state.shared.byId("documentTemplateInfo").textContent="Bitte zuerst eine Dokumentvorlage auswählen.";return}
  state.shared.byId("documentTemplateInfo").textContent="Vorlage wird geprüft…";
  try{
    const analysis=await actions.api(`/api/document-templates/${template.id}/analysis`);
    if(request!==state.documents.documentFieldRequest)return;
    state.documents.documentAnalysis=analysis;const context=actions.documentContext();
    for(const key of analysis.placeholders||[]){
      if(key.startsWith("benutzer.")||key==="kontakte")continue;
      const definition=state.library.variables.find(item=>item.key===key)||{key,label:key,type:"text"};
      const label=document.createElement("label");label.textContent=definition.label;
      const input=actions.createInput(definition,"document-input"),existing=actions.getPath(context,key);
      // Contact arrays remain structured project data, not "[object Object]".
      if(existing!==null&&typeof existing==="object")continue;
      input.value=existing??"";input.addEventListener("input",()=>{++state.documents.documentInputRevision;state.shared.byId("documentValidation").innerHTML=""});
      label.appendChild(input);state.shared.byId("documentFieldList").appendChild(label);
    }
    state.shared.byId("documentTemplateInfo").innerHTML=`<b>${actions.esc(template.name)}</b><p>${actions.esc(template.description||"")}</p>${actions.documentAnalysisHtml(analysis)}`;
    if((analysis.placeholders||[]).includes("kontakte"))state.shared.byId("documentTemplateInfo").insertAdjacentHTML("beforeend",'<p>Die Kontaktliste wird aus dem gewählten Projekt übernommen; im manuellen Modus ist sie leer.</p>');
  }catch(error){if(request===state.documents.documentFieldRequest)state.shared.byId("documentTemplateInfo").textContent=error.message}
  finally{if(request===state.documents.documentFieldRequest)actions.documentOutputState()}
}

export function documentValues(){
  const values={};document.querySelectorAll("#documentFieldList [data-key]").forEach(input=>{
    values[input.dataset.key]=input.type==="number"&&input.value!==""?Number(input.value):input.value;
  });return values;
}

export function documentPayload(output="docx",save=false){
  if(!actions.selectedDocumentTemplate()||!state.documents.documentAnalysis)throw Error("Bitte eine Dokumentvorlage auswählen und die Prüfung abwarten.");
  const isProject=state.shared.byId("documentMode").value==="project",projectId=isProject?Number(state.shared.byId("documentProjectSelect").value)||null:null;
  if(isProject&&!projectId)throw Error("Bitte ein Projekt auswählen.");
  const contact=state.shared.byId("documentContactIndex").value;
  return {template_id:actions.selectedDocumentTemplate().id,project_id:projectId,contact_index:isProject&&contact!==""?Number(contact):null,values:actions.documentValues(),output,save_to_project:save};
}

export function documentOutputState(){
  document.querySelectorAll("[data-document-output]").forEach(button=>button.disabled=state.documents.documentBusy||!state.documents.documentAnalysis||(button.id==="documentPdfButton"&&!state.documents.documentPdfAvailable));
}

export async function validateDocument(){
  if(state.documents.documentBusy)return;
  try{
    const payload=actions.documentPayload(),revision=state.documents.documentInputRevision;state.documents.documentBusy=true;actions.documentOutputState();
    const result=await actions.api("/api/documents/validate",{method:"POST",body:JSON.stringify(payload)});
    // A result applies only to the inputs actually validated, never newer edits.
    if(revision!==state.documents.documentInputRevision)return;
    state.shared.byId("documentValidation").innerHTML=`<div class="${result.valid&&!result.warnings.length?"info-box":"document-warning"}"><b>${result.valid?"Test erfolgreich":"Bitte Vorlage prüfen"}</b><p>${actions.esc(result.message||result.error||"")}</p>${result.warnings.length?`<ul>${result.warnings.map(w=>`<li>${actions.esc(w)}</li>`).join("")}</ul>`:""}</div>`;
  }catch(error){actions.toast(error.message)}
  finally{state.documents.documentBusy=false;actions.documentOutputState()}
}

export async function generateDocument(output,save=false){
  if(state.documents.documentBusy)return;
  try{
    // Snapshot current selection before awaiting the server.
    const payload=actions.documentPayload(output,save),template=actions.selectedDocumentTemplate();state.documents.documentBusy=true;actions.documentOutputState();
    const response=await fetch("/api/documents/generate",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":state.auth.csrfToken},body:JSON.stringify(payload)});
    if(!response.ok){let message="Dokument konnte nicht erzeugt werden.";try{message=(await response.json()).error||message}catch{}throw Error(message)}
    if(save){
      const result=await response.json();actions.toast(`${result.filename} wurde im Projekt gespeichert.`);
      if(state.projects.currentProjectDetailId===payload.project_id)await actions.loadProjectWorkspace(payload.project_id);
    }else{
      const disposition=response.headers.get("Content-Disposition")||"",match=disposition.match(/filename="([^"]+)"/);
      actions.downloadBlob(await response.blob(),match?.[1]||`${template.name}.${output}`);
    }
  }catch(error){actions.toast(error.message)}
  finally{state.documents.documentBusy=false;actions.documentOutputState()}
}

export function renderDocumentTemplateList(){
  const needle=String(state.shared.byId("documentTemplateSearch").value||"").toLocaleLowerCase("de");
  const items=state.documents.documentTemplates.filter(item=>[item.name,item.description,item.original_filename].join(" ").toLocaleLowerCase("de").includes(needle));
  state.shared.byId("documentTemplateList").innerHTML=items.map(item=>`<button class="list-row" onclick="editDocumentTemplate(${item.id})"><span><b>${actions.esc(item.name)}</b><small>${actions.esc(item.original_filename)} · ${item.placeholders.length} direkte Platzhalter</small></span><span class="status-pill ${item.active?"active":"inactive"}">${item.active?"aktiv":"inaktiv"}</span></button>`).join("")||"<p class='muted'>Keine Dokumentvorlagen gefunden.</p>";
}

export function newDocumentTemplate(){
  ++state.documents.documentEditRequest;state.documents.editingDocumentTemplateId=null;
  ["documentTemplateId","documentTemplateName","documentTemplateDescription","documentTemplateFile"].forEach(id=>state.shared.byId(id).value="");
  state.shared.byId("documentTemplateActive").checked=true;state.shared.byId("deleteDocumentTemplateButton").hidden=state.shared.byId("testDocumentTemplateButton").hidden=true;
  state.shared.byId("documentTemplateFormTitle").textContent="Dokumentvorlage anlegen";
  state.shared.byId("documentTemplateDetected").textContent="Nach dem Upload werden erkannte Platzhalter hier angezeigt.";
  state.shared.byId("documentTemplateVersions").textContent="Noch keine Datei gespeichert.";actions.switchTab("document-template-edit");
}

export async function editDocumentTemplate(id){
  const item=state.documents.documentTemplates.find(entry=>entry.id===Number(id));if(!item)return;
  const request=++state.documents.documentEditRequest;state.documents.editingDocumentTemplateId=item.id;
  state.shared.byId("documentTemplateId").value=item.id;state.shared.byId("documentTemplateName").value=item.name;
  state.shared.byId("documentTemplateDescription").value=item.description;state.shared.byId("documentTemplateFile").value="";
  state.shared.byId("documentTemplateActive").checked=item.active;state.shared.byId("deleteDocumentTemplateButton").hidden=false;
  state.shared.byId("testDocumentTemplateButton").hidden=!actions.hasPermission("documents_create");
  state.shared.byId("documentTemplateFormTitle").textContent="Dokumentvorlage bearbeiten";
  state.shared.byId("documentTemplateDetected").textContent="Prüfung wird geladen…";state.shared.byId("documentTemplateVersions").textContent="";actions.switchTab("document-template-edit");
  try{
    const [analysis,history]=await Promise.all([actions.api(`/api/document-templates/${id}/analysis`),actions.api(`/api/document-templates/${id}/versions`)]);
    if(request!==state.documents.documentEditRequest)return;
    state.shared.byId("documentTemplateDetected").innerHTML=actions.documentAnalysisHtml(analysis);
    state.shared.byId("documentTemplateVersions").innerHTML=`<p><a href="/api/document-templates/${id}/download">Aktuelles Word-Original herunterladen</a></p>`+
      history.versions.map(version=>`<div class="document-version-row"><a href="/api/document-templates/${id}/versions/${version.id}/download">Dateiversion ${version.version_no} · ${actions.esc(version.original_filename)}</a><small>${new Date(version.created_at).toLocaleString("de-DE")}</small></div>`).join("");
  }catch(error){if(request===state.documents.documentEditRequest)state.shared.byId("documentTemplateDetected").textContent=error.message}
}

export async function inspectDocumentUpload(){
  const request=++state.documents.documentEditRequest,file=state.shared.byId("documentTemplateFile").files[0];if(!file)return;
  state.shared.byId("documentTemplateDetected").textContent="Neue Datei wird geprüft…";
  try{
    if(!file.name.toLowerCase().endsWith(".docx")||file.size>10000000)throw Error("Bitte eine DOCX-Datei mit höchstens 10 MB auswählen.");
    const analysis=await actions.api("/api/document-templates/inspect",{method:"POST",body:JSON.stringify({content_base64:await actions.fileAsBase64(file)})});
    if(request===state.documents.documentEditRequest)state.shared.byId("documentTemplateDetected").innerHTML=actions.documentAnalysisHtml(analysis);
  }catch(error){if(request===state.documents.documentEditRequest)state.shared.byId("documentTemplateDetected").textContent=error.message}
}

export async function saveDocumentTemplate(){
  const button=state.shared.byId("saveDocumentTemplateButton");if(button.disabled)return;
  try{
    const file=state.shared.byId("documentTemplateFile").files[0],id=state.documents.editingDocumentTemplateId;
    if(!id&&!file)return actions.toast("Bitte eine DOCX-Datei auswählen.");
    if(file&&(!file.name.toLowerCase().endsWith(".docx")||file.size>10000000))return actions.toast("Bitte eine DOCX-Datei mit höchstens 10 MB auswählen.");
    const payload={name:state.shared.byId("documentTemplateName").value,description:state.shared.byId("documentTemplateDescription").value,active:state.shared.byId("documentTemplateActive").checked};button.disabled=true;
    const save=WveDrafts.beginSave(state.shared.byId('tab-document-template-edit'));
    if(file){payload.filename=file.name;payload.content_base64=await actions.fileAsBase64(file)}
    const result=await actions.api(id?`/api/document-templates/${id}`:"/api/document-templates",{method:id?"PUT":"POST",body:JSON.stringify(payload)});
    const current=WveDrafts.finishSave(save);
    await actions.loadDocumentModule();
    if(current&&WveDrafts.isCurrentSave(save))await actions.editDocumentTemplate(id||result.id);
    actions.toast("Dokumentvorlage gespeichert.");
  }catch(error){actions.toast(error.message)}
  finally{button.disabled=false}
}

export function testDocumentTemplate(){
  if(state.shared.byId("documentTemplateFile").files.length)return actions.toast("Bitte die neue Word-Datei zuerst speichern.");
  const item=state.documents.documentTemplates.find(t=>t.id===state.documents.editingDocumentTemplateId);
  if(!item?.active)return actions.toast("Bitte die Vorlage zuerst aktivieren und speichern.");
  state.shared.byId("documentTemplateSelect").value=String(item.id);actions.renderDocumentTemplateOptions();actions.renderDocumentFields();actions.switchTab("document-create");
}

export async function deleteDocumentTemplate(){
  const id=state.documents.editingDocumentTemplateId;if(!id)return;state.shared.byId("deleteDocumentTemplateDialog").close();
  try{await actions.api(`/api/document-templates/${id}`,{method:"DELETE"});state.documents.editingDocumentTemplateId=null;await actions.loadDocumentModule();actions.switchTab("document-templates");actions.toast("Dokumentvorlage und ihre Dateiversionen gelöscht.")}
  catch(error){actions.toast(error.message)}
}

export function renderProjectDocuments(){
  const section=state.shared.byId("projectDocumentSection");if(!section)return;
  if(!actions.hasPermission("documents_create")&&!actions.hasPermission("document_templates_manage"))section.hidden=true;
  const project=state.projects.projects.find(p=>p.id===state.projects.currentProjectDetailId);
  section.querySelector("button").hidden=!actions.hasPermission("documents_create")||!project||project.archived;
  state.shared.byId("projectSavedDocuments").innerHTML=(state.projects.currentProjectWorkspace.documents||[]).map(item=>
    `<a class="project-email-record" href="/api/project-documents/${item.id}/download"><span><b>${actions.esc(item.filename)}</b><small>${actions.esc(item.template_name)} · ${new Date(item.created_at).toLocaleString("de-DE")} · ${actions.esc(item.username||"")}</small></span><span>${Math.ceil(item.size/1024)} KB · Herunterladen</span></a>`
  ).join("")||"<p class='muted'>Noch keine Dokumente im Projekt gespeichert.</p>";
}

export function createDocumentForCurrentProject(){
  const project=state.projects.projects.find(p=>p.id===state.projects.currentProjectDetailId);if(!project||project.archived)return;
  state.shared.byId("documentProjectSelect").value=String(project.id);state.shared.byId("documentContactIndex").value="";actions.setDocumentMode("project");actions.switchTab("document-create");
}
