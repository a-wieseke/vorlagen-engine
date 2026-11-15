/* Word owns the layout. This module handles selection, data checks and files.
 * Request counters prevent slow responses from painting a previous selection.
 */
let documentAnalysis=null,documentFieldRequest=0,documentEditRequest=0;
let documentInputRevision=0;
let documentPickerTarget="template",documentPdfAvailable=false,documentBusy=false;
async function loadDocumentModule(){
  try{
    const [templateData,blockData,pdfData]=await Promise.all([api("/api/document-templates"),api("/api/document-blocks"),api("/api/documents/pdf-status")]);
    documentTemplates=templateData.templates||[];documentBlocks=blockData.blocks||[];
    documentPdfAvailable=pdfData.available;byId("documentPdfInfo").textContent=pdfData.message;
    byId("documentSavePdfOption").disabled=!documentPdfAvailable;
    if(!documentPdfAvailable)byId("documentSaveFormat").value="docx";
    renderDocumentTemplateOptions();renderDocumentTemplateList();renderDocumentBlockList();
    await renderDocumentFields();
  }catch(error){toast(error.message)}
}
function selectedDocumentTemplate(){return documentTemplates.find(item=>String(item.id)===byId("documentTemplateSelect").value)}
function documentProject(){return projects.find(item=>String(item.id)===byId("documentProjectSelect").value)}
function documentContext(){
  const context=byId("documentMode").value==="project"?structuredClone(documentProject()?.data||{}):{};
  const index=byId("documentContactIndex").value;
  context.kontakt=index!==""?context.kontakte?.[Number(index)]||{}:{};
  return context;
}
function setDocumentMode(value){
  byId("documentMode").value=value;
  byId("documentModeManualButton").classList.toggle("active",value==="manual");
  byId("documentModeProjectButton").classList.toggle("active",value==="project");
  byId("documentProjectWrap").hidden=value!=="project";
  renderDocumentTemplateOptions();renderDocumentFields();
}
function renderDocumentTemplateOptions(){
  const template=selectedDocumentTemplate(),project=documentProject();
  if(!template?.active)byId("documentTemplateSelect").value="";
  if(!project||project.archived)byId("documentProjectSelect").value="";
  const contact=documentContext().kontakt;
  const selections=[
    ["documentTemplateButton",template?.active?template.name:"Dokumentvorlage auswählen...",!!template?.active],
    ["documentProjectButton",project&&!project.archived?`${project.project_key} – ${project.name}`:"Projekt auswählen...",!!project&&!project.archived],
    ["documentContactButton",Object.keys(contact).length?contactDisplayName(contact):"Kein Kontakt",!!Object.keys(contact).length]
  ];
  selections.forEach(([id,label,selected])=>{byId(id).textContent=label;byId(id).classList.toggle("has-selection",selected)});
  byId("documentSaveWrap").hidden=byId("documentMode").value!=="project"||!byId("documentProjectSelect").value;
}
function openDocumentPicker(target){
  documentPickerTarget=target;
  byId("documentPickerTitle").textContent={template:"Dokumentvorlage auswählen",project:"Projekt auswählen",contact:"Kontakt auswählen"}[target];
  byId("documentPickerSearch").value="";renderDocumentPickerResults();
  byId("documentPickerDialog").showModal();byId("documentPickerSearch").focus();
}
function renderDocumentPickerResults(){
  const needle=byId("documentPickerSearch").value.trim().toLocaleLowerCase("de");let rows=[];
  if(documentPickerTarget==="template")rows=documentTemplates.filter(item=>item.active).map(item=>({id:item.id,label:item.name,detail:item.description||item.original_filename}));
  if(documentPickerTarget==="project")rows=activeProjects().map(item=>({id:item.id,label:`${item.project_key} – ${item.name}`,detail:""}));
  if(documentPickerTarget==="contact")rows=(documentProject()?.data?.kontakte||[]).map((item,index)=>({id:index,label:contactDisplayName(item),detail:item.email||""}));
  rows=rows.filter(item=>`${item.label} ${item.detail}`.toLocaleLowerCase("de").includes(needle));
  byId("documentPickerResults").innerHTML=(documentPickerTarget==="contact"?'<button class="list-row" onclick="selectDocumentPicker(null)">Kein Kontakt</button>':"")+
    (rows.map(item=>`<button class="list-row" onclick="selectDocumentPicker(${item.id})"><span><b>${esc(item.label)}</b><small>${esc(item.detail)}</small></span></button>`).join("")||'<p class="muted">Keine passenden Einträge.</p>');
}
function selectDocumentPicker(id){
  const target={template:"documentTemplateSelect",project:"documentProjectSelect",contact:"documentContactIndex"}[documentPickerTarget];
  byId(target).value=id===null?"":String(id);
  if(documentPickerTarget==="project")byId("documentContactIndex").value="";
  byId("documentPickerDialog").close();renderDocumentTemplateOptions();renderDocumentFields();
}
function documentAnalysisHtml(analysis){
  const fields=analysis.placeholders||[],blocks=analysis.blocks||[];
  return `<b>${fields.length} Datenfeld(er) · ${blocks.length} Textbaustein(e)</b>
    <p class="placeholder-key-list">${fields.map(key=>`<code>${esc(key)}</code>`).join(" ")||"Keine Datenfelder."}</p>
    ${blocks.length?`<p>Textbausteine: ${blocks.map(esc).join(", ")}</p>`:""}
    ${analysis.warnings?.length?`<div class="document-warning"><b>Hinweise zur Vorlage</b><ul>${analysis.warnings.map(w=>`<li>${esc(w)}</li>`).join("")}</ul></div>`:"<p>Keine Auffälligkeiten in der Platzhalterprüfung.</p>"}`;
}
async function renderDocumentFields(){
  ++documentInputRevision;
  const request=++documentFieldRequest,template=selectedDocumentTemplate();
  documentAnalysis=null;byId("documentFieldList").innerHTML="";byId("documentValidation").innerHTML="";documentOutputState();
  if(!template){byId("documentTemplateInfo").textContent="Bitte zuerst eine Dokumentvorlage auswählen.";return}
  byId("documentTemplateInfo").textContent="Vorlage wird geprüft…";
  try{
    const analysis=await api(`/api/document-templates/${template.id}/analysis`);
    if(request!==documentFieldRequest)return;
    documentAnalysis=analysis;const context=documentContext();
    for(const key of analysis.placeholders||[]){
      if(key.startsWith("benutzer.")||key==="kontakte")continue;
      const definition=variables.find(item=>item.key===key)||{key,label:key,type:"text"};
      const label=document.createElement("label");label.textContent=definition.label;
      const input=createInput(definition,"document-input"),existing=getPath(context,key);
      // Contact arrays remain structured project data, not "[object Object]".
      if(existing!==null&&typeof existing==="object")continue;
      input.value=existing??"";input.addEventListener("input",()=>{++documentInputRevision;byId("documentValidation").innerHTML=""});
      label.appendChild(input);byId("documentFieldList").appendChild(label);
    }
    byId("documentTemplateInfo").innerHTML=`<b>${esc(template.name)}</b><p>${esc(template.description||"")}</p>${documentAnalysisHtml(analysis)}`;
    if((analysis.placeholders||[]).includes("kontakte"))byId("documentTemplateInfo").insertAdjacentHTML("beforeend",'<p>Die Kontaktliste wird aus dem gewählten Projekt übernommen; im manuellen Modus ist sie leer.</p>');
  }catch(error){if(request===documentFieldRequest)byId("documentTemplateInfo").textContent=error.message}
  finally{if(request===documentFieldRequest)documentOutputState()}
}
function documentValues(){
  const values={};document.querySelectorAll("#documentFieldList [data-key]").forEach(input=>{
    values[input.dataset.key]=input.type==="number"&&input.value!==""?Number(input.value):input.value;
  });return values;
}
function documentPayload(output="docx",save=false){
  if(!selectedDocumentTemplate()||!documentAnalysis)throw Error("Bitte eine Dokumentvorlage auswählen und die Prüfung abwarten.");
  const isProject=byId("documentMode").value==="project",projectId=isProject?Number(byId("documentProjectSelect").value)||null:null;
  if(isProject&&!projectId)throw Error("Bitte ein Projekt auswählen.");
  const contact=byId("documentContactIndex").value;
  return {template_id:selectedDocumentTemplate().id,project_id:projectId,contact_index:isProject&&contact!==""?Number(contact):null,values:documentValues(),output,save_to_project:save};
}
function documentOutputState(){
  document.querySelectorAll("[data-document-output]").forEach(button=>button.disabled=documentBusy||!documentAnalysis||(button.id==="documentPdfButton"&&!documentPdfAvailable));
}
async function validateDocument(){
  if(documentBusy)return;
  try{
    const payload=documentPayload(),revision=documentInputRevision;documentBusy=true;documentOutputState();
    const result=await api("/api/documents/validate",{method:"POST",body:JSON.stringify(payload)});
    // A result applies only to the inputs actually validated, never newer edits.
    if(revision!==documentInputRevision)return;
    byId("documentValidation").innerHTML=`<div class="${result.valid&&!result.warnings.length?"info-box":"document-warning"}"><b>${result.valid?"Test erfolgreich":"Bitte Vorlage prüfen"}</b><p>${esc(result.message||result.error||"")}</p>${result.warnings.length?`<ul>${result.warnings.map(w=>`<li>${esc(w)}</li>`).join("")}</ul>`:""}</div>`;
  }catch(error){toast(error.message)}
  finally{documentBusy=false;documentOutputState()}
}
async function generateDocument(output,save=false){
  if(documentBusy)return;
  try{
    // Snapshot current selection before awaiting the server.
    const payload=documentPayload(output,save),template=selectedDocumentTemplate();documentBusy=true;documentOutputState();
    const response=await fetch("/api/documents/generate",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":csrfToken},body:JSON.stringify(payload)});
    if(!response.ok){let message="Dokument konnte nicht erzeugt werden.";try{message=(await response.json()).error||message}catch{}throw Error(message)}
    if(save){
      const result=await response.json();toast(`${result.filename} wurde im Projekt gespeichert.`);
      if(currentProjectDetailId===payload.project_id)await loadProjectWorkspace(payload.project_id);
    }else{
      const disposition=response.headers.get("Content-Disposition")||"",match=disposition.match(/filename="([^"]+)"/);
      downloadBlob(await response.blob(),match?.[1]||`${template.name}.${output}`);
    }
  }catch(error){toast(error.message)}
  finally{documentBusy=false;documentOutputState()}
}
function renderDocumentTemplateList(){
  const needle=String(byId("documentTemplateSearch").value||"").toLocaleLowerCase("de");
  const items=documentTemplates.filter(item=>[item.name,item.description,item.original_filename].join(" ").toLocaleLowerCase("de").includes(needle));
  byId("documentTemplateList").innerHTML=items.map(item=>`<button class="list-row" onclick="editDocumentTemplate(${item.id})"><span><b>${esc(item.name)}</b><small>${esc(item.original_filename)} · ${item.placeholders.length} direkte Platzhalter</small></span><span class="status-pill ${item.active?"active":"inactive"}">${item.active?"aktiv":"inaktiv"}</span></button>`).join("")||"<p class='muted'>Keine Dokumentvorlagen gefunden.</p>";
}
function newDocumentTemplate(){
  ++documentEditRequest;editingDocumentTemplateId=null;
  ["documentTemplateId","documentTemplateName","documentTemplateDescription","documentTemplateFile"].forEach(id=>byId(id).value="");
  byId("documentTemplateActive").checked=true;byId("deleteDocumentTemplateButton").hidden=byId("testDocumentTemplateButton").hidden=true;
  byId("documentTemplateFormTitle").textContent="Dokumentvorlage anlegen";
  byId("documentTemplateDetected").textContent="Nach dem Upload werden erkannte Platzhalter hier angezeigt.";
  byId("documentTemplateVersions").textContent="Noch keine Datei gespeichert.";switchTab("document-template-edit");
}
async function editDocumentTemplate(id){
  const item=documentTemplates.find(entry=>entry.id===Number(id));if(!item)return;
  const request=++documentEditRequest;editingDocumentTemplateId=item.id;
  byId("documentTemplateId").value=item.id;byId("documentTemplateName").value=item.name;
  byId("documentTemplateDescription").value=item.description;byId("documentTemplateFile").value="";
  byId("documentTemplateActive").checked=item.active;byId("deleteDocumentTemplateButton").hidden=false;
  byId("testDocumentTemplateButton").hidden=!hasPermission("documents_create");
  byId("documentTemplateFormTitle").textContent="Dokumentvorlage bearbeiten";
  byId("documentTemplateDetected").textContent="Prüfung wird geladen…";byId("documentTemplateVersions").textContent="";switchTab("document-template-edit");
  try{
    const [analysis,history]=await Promise.all([api(`/api/document-templates/${id}/analysis`),api(`/api/document-templates/${id}/versions`)]);
    if(request!==documentEditRequest)return;
    byId("documentTemplateDetected").innerHTML=documentAnalysisHtml(analysis);
    byId("documentTemplateVersions").innerHTML=`<p><a href="/api/document-templates/${id}/download">Aktuelles Word-Original herunterladen</a></p>`+
      history.versions.map(version=>`<div class="document-version-row"><a href="/api/document-templates/${id}/versions/${version.id}/download">Dateiversion ${version.version_no} · ${esc(version.original_filename)}</a><small>${new Date(version.created_at).toLocaleString("de-DE")}</small></div>`).join("");
  }catch(error){if(request===documentEditRequest)byId("documentTemplateDetected").textContent=error.message}
}
async function inspectDocumentUpload(){
  const request=++documentEditRequest,file=byId("documentTemplateFile").files[0];if(!file)return;
  byId("documentTemplateDetected").textContent="Neue Datei wird geprüft…";
  try{
    if(!file.name.toLowerCase().endsWith(".docx")||file.size>10000000)throw Error("Bitte eine DOCX-Datei mit höchstens 10 MB auswählen.");
    const analysis=await api("/api/document-templates/inspect",{method:"POST",body:JSON.stringify({content_base64:await fileAsBase64(file)})});
    if(request===documentEditRequest)byId("documentTemplateDetected").innerHTML=documentAnalysisHtml(analysis);
  }catch(error){if(request===documentEditRequest)byId("documentTemplateDetected").textContent=error.message}
}
async function saveDocumentTemplate(){
  const button=byId("saveDocumentTemplateButton");if(button.disabled)return;
  try{
    const file=byId("documentTemplateFile").files[0],id=editingDocumentTemplateId;
    if(!id&&!file)return toast("Bitte eine DOCX-Datei auswählen.");
    if(file&&(!file.name.toLowerCase().endsWith(".docx")||file.size>10000000))return toast("Bitte eine DOCX-Datei mit höchstens 10 MB auswählen.");
    const payload={name:byId("documentTemplateName").value,description:byId("documentTemplateDescription").value,active:byId("documentTemplateActive").checked};button.disabled=true;
    if(file){payload.filename=file.name;payload.content_base64=await fileAsBase64(file)}
    const result=await api(id?`/api/document-templates/${id}`:"/api/document-templates",{method:id?"PUT":"POST",body:JSON.stringify(payload)});
    await loadDocumentModule();await editDocumentTemplate(id||result.id);toast("Dokumentvorlage gespeichert.");
  }catch(error){toast(error.message)}
  finally{button.disabled=false}
}
function testDocumentTemplate(){
  if(byId("documentTemplateFile").files.length)return toast("Bitte die neue Word-Datei zuerst speichern.");
  const item=documentTemplates.find(t=>t.id===editingDocumentTemplateId);
  if(!item?.active)return toast("Bitte die Vorlage zuerst aktivieren und speichern.");
  byId("documentTemplateSelect").value=String(item.id);renderDocumentTemplateOptions();renderDocumentFields();switchTab("document-create");
}
async function deleteDocumentTemplate(){
  const id=editingDocumentTemplateId;if(!id)return;byId("deleteDocumentTemplateDialog").close();
  try{await api(`/api/document-templates/${id}`,{method:"DELETE"});editingDocumentTemplateId=null;await loadDocumentModule();switchTab("document-templates");toast("Dokumentvorlage und ihre Dateiversionen gelöscht.")}
  catch(error){toast(error.message)}
}
function renderProjectDocuments(){
  const section=byId("projectDocumentSection");if(!section)return;
  section.hidden=!hasPermission("documents_create")&&!hasPermission("document_templates_manage");
  const project=projects.find(p=>p.id===currentProjectDetailId);
  section.querySelector("button").hidden=!hasPermission("documents_create")||!project||project.archived;
  byId("projectSavedDocuments").innerHTML=(currentProjectWorkspace.documents||[]).map(item=>
    `<a class="project-email-record" href="/api/project-documents/${item.id}/download"><span><b>${esc(item.filename)}</b><small>${esc(item.template_name)} · ${new Date(item.created_at).toLocaleString("de-DE")} · ${esc(item.username||"")}</small></span><span>${Math.ceil(item.size/1024)} KB · Herunterladen</span></a>`
  ).join("")||"<p class='muted'>Noch keine Dokumente im Projekt gespeichert.</p>";
}
function createDocumentForCurrentProject(){
  const project=projects.find(p=>p.id===currentProjectDetailId);if(!project||project.archived)return;
  byId("documentProjectSelect").value=String(project.id);byId("documentContactIndex").value="";setDocumentMode("project");switchTab("document-create");
}

