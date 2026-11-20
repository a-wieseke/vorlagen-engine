/** mail: feature logic; state is scoped by domain in state.js. */
import {state,actions} from './state.js';

export async function openSavedEmailInEditor(){
  if(window.WveDrafts?.dirty(state.shared.byId('tab-generator'))&&!await confirmAction('Den aktuellen E-Mail-Entwurf durch diese gespeicherte E-Mail ersetzen?'))return;
  window.WveDrafts?.clean(state.shared.byId('tab-generator'));
  const email=(state.projects.currentProjectWorkspace.emails||[]).find(item=>item.id===Number(state.shared.currentOpenedProjectEmailId));if(!email)return;
  const project=state.projects.projects.find(item=>item.id===Number(email.project_id));if(!project)return actions.toast("Das zugehörige Projekt wurde nicht gefunden.");
  state.projects.projectSelect.value=String(project.id);actions.updateProjectPickerButton();actions.setMode("project");
  const template=state.library.templates.find(item=>item.id===Number(email.template_id));
  state.library.templateSelect.value=template&&template.active&&!template.archived?String(template.id):"";actions.updateTemplatePickerButton();actions.renderManualFields();
  state.mail.resultTemplateName.value=email.template_name||template?.name||"Gespeicherte E-Mail";state.mail.resultTo.value=email.recipient||"";state.mail.resultCc.value=email.cc||"";state.mail.resultSubject.value=email.subject||"";
  actions.setEditorHtml(state.mail.resultBody,email.body_html||actions.plainTextToHtml(email.body_text));actions.resetEditorHistory(state.mail.resultBody);
  state.mail.emailGenerated=true;
  state.mail.resultContext={projectId:project.id,templateId:email.template_id??null,templateName:state.mail.resultTemplateName.value,
    selectedTemplateId:state.library.templateSelect.value,valid:true};
  actions.updatePlaceholderWarning();actions.updateSaveProjectEmailButton();
  state.mail.resultDirty=true;window.WveDrafts?.capture(state.shared.byId('tab-generator'));
  state.projects.projectEmailDialog.close();actions.switchTab("generator");actions.toast("Gespeicherte E-Mail wurde im Editor geöffnet.");
}

export function createInput(definition,className){
  const input=document.createElement(definition.type==="textarea"?"textarea":"input");
  if(input.tagName==="TEXTAREA")input.rows=3;
  else input.type=definition.type==="date"?"date":definition.type==="number"?"number":definition.type==="email"?"email":"text";
  input.className=className;input.dataset.key=definition.key;return input;
}

export function setPath(object,path,value){
  const parts=path.split(".");let current=object;
  parts.forEach((part,index)=>{
    if(index===parts.length-1)current[part]=value;
    else current=current[part]||(current[part]={});
  });
}

export function getPath(object,path){
  return path.split(".").reduce((current,key)=>current!=null&&current[key]!==undefined?current[key]:"",object);
}

export function setMode(value){
  if(state.mail.mode.value!==value&&state.mail.resultContext)state.mail.resultContext.valid=false;
  state.mail.mode.value=value;state.mail.modeProjectButton.classList.toggle("active",value==="project");state.mail.modeManualButton.classList.toggle("active",value==="manual");
  state.projects.projectSelectWrap.hidden=value!=="project";state.projects.projectSelectWrap.style.display="";actions.refreshContacts();actions.renderManualFields(true);actions.updateSaveProjectEmailButton();
  if(actions.selectedTemplate())window.WveDrafts?.capture(state.shared.byId('tab-generator'));
}

export function modeChanged(){actions.setMode(state.mail.mode.value)}

export function automaticContext(){
  const project=state.mail.mode.value==="project"?JSON.parse(JSON.stringify(actions.selectedProject()?.data||{})):{};
  project.kontakt=state.mail.mode.value==="project"&&state.projects.contactSelect.value!==""?(project.kontakte||[])[Number(state.projects.contactSelect.value)]||{}:{};
  project.benutzer={vorname:state.auth.me?.first_name||"",nachname:state.auth.me?.last_name||"",email:state.auth.me?.email||""};
  return project;
}

export function renderManualFields(reset=false){
  if(!state.mail.manualFields)return;
  const entered=reset?{}:Object.fromEntries([...state.mail.manualFields.querySelectorAll('.manual-input')].map(input=>[input.dataset.key,input.value]));
  const template=actions.selectedTemplate();state.mail.manualFields.innerHTML="";if(!template){actions.renderTemplateNotice(null);return}
  const context=actions.automaticContext();
  const keys=actions.extractTemplateKeys(template);
  if(!keys.includes("kontakt.email"))keys.unshift("kontakt.email");
  for(const key of keys){
    const definition=actions.definitionForKey(key,template);
    const existing=actions.getPath(context,key);
    const label=document.createElement("label");label.textContent=definition.label+(definition.required?" *":"");
    const input=actions.createInput({...definition,key},"manual-input");input.value=entered[key]??existing??"";
    input.addEventListener("input",()=>{actions.updatePlaceholderWarning();actions.renderTemplateNotice(template)});
    label.appendChild(input);state.mail.manualFields.appendChild(label);
  }
  actions.updatePlaceholderWarning();actions.renderTemplateNotice(template);
}

export function acknowledgeNotice(){state.mail.noticeAcknowledged=true;state.mail.noticeAcknowledgeButton.hidden=true;actions.updateOutputButtons();actions.toast("Hinweis wurde bestätigt.")}

export function currentEmailContext(){
  const context=actions.automaticContext();
  document.querySelectorAll(".manual-input").forEach(input=>actions.setPath(context,input.dataset.key,input.value));
  return context;
}

export function updatePlaceholderWarning(){
  const template=actions.selectedTemplate();if(!template){state.shared.placeholderWarning.hidden=true;return}
  const context=actions.currentEmailContext();
  state.shared.placeholderWarning.hidden=!actions.extractTemplateKeys(template).some(key=>!String(actions.getPath(context,key)||"").trim());
}

export function renderText(text,context,preserveMissing=false){
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g,(match,key)=>{
    const value=actions.getPath(context,key);return value===undefined||value===null||value===""?(preserveMissing?match:""):value;
  });
}

export async function generateEmail(){
  if(state.mail.resultDirty&&!await confirmAction('Der bearbeitete E-Mailtext wird aus den aktuellen Variablen neu erzeugt.'))return;
  const template=actions.selectedTemplate();if(!template)return actions.toast("Bitte eine Vorlage wählen.");
  if(state.mail.mode.value==="project"&&!actions.selectedProject())return actions.toast("Bitte ein Projekt wählen.");
  const context=actions.automaticContext();
  for(const input of document.querySelectorAll(".manual-input"))actions.setPath(context,input.dataset.key,input.value);
  const keys=actions.extractTemplateKeys(template);
  if(!keys.includes("kontakt.email"))keys.unshift("kontakt.email");
  for(const key of keys){
    const definition=actions.definitionForKey(key,template);
    if(definition.required&&!String(actions.getPath(context,key)).trim())return actions.toast("Pflichtfeld fehlt: "+definition.label);
  }
  state.mail.resultTemplateName.value=template.name;state.mail.resultTo.value=actions.getPath(context,"kontakt.email")||"";
  state.mail.resultSubject.value=actions.renderText(template.subject,context);
  actions.setEditorHtml(state.mail.resultBody,actions.renderHtmlTemplate(template.body_html||actions.plainTextToHtml(template.body),context));
  actions.resetEditorHistory(state.mail.resultBody);
  actions.updatePlaceholderWarning();
  state.mail.emailGenerated=true;
  state.mail.resultContext={projectId:state.mail.mode.value==="project"?actions.selectedProject().id:null,
    templateId:template.id,templateName:template.name,selectedTemplateId:state.library.templateSelect.value,valid:true};
  actions.updateSaveProjectEmailButton();
  state.mail.resultDirty=false;window.WveDrafts?.capture(state.shared.byId('tab-generator'));
}

export function mailtoEncode(value){return encodeURIComponent(value||"").replace(/%0A/g,"%0D%0A")}

export function confirmNoticeAction(){
  const action=state.mail.pendingNoticeAction;state.mail.pendingNoticeAction=null;state.mail.noticeActionDialog.close();if(action)actions.executeOutputAction(action);
}

export function cancelNoticeAction(){state.mail.pendingNoticeAction=null;state.mail.noticeActionDialog.close()}

export function openMailto(){
  const query=[];
  if(state.mail.resultCc.value)query.push("cc="+actions.mailtoEncode(state.mail.resultCc.value));
  query.push("subject="+actions.mailtoEncode(state.mail.resultSubject.value));
  query.push("body="+actions.mailtoEncode(actions.getEditorText(state.mail.resultBody)));
  location.href=`mailto:${actions.mailtoEncode(state.mail.resultTo.value)}?${query.join("&")}`;
}

export async function downloadEml(){
  // One server-side MIME implementation serves result and template exports.
  // The server revalidates pixels and embeds CID parts without sending mail.
  try{
    const response=await fetch("/api/email/eml",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":state.auth.csrfToken},body:JSON.stringify({
      recipient:state.mail.resultTo.value,cc:state.mail.resultCc.value,subject:state.mail.resultSubject.value,body_html:actions.getEditorHtml(state.mail.resultBody)
    })});
    if(!response.ok){const error=await response.json();throw Error(error.error||"EML-Export fehlgeschlagen.")}
    actions.downloadBlob(await response.blob(),(state.mail.resultSubject.value||"E-Mail").replace(/[\\/:*?"<>|]/g,"_")+".eml");
  }catch(error){actions.toast(error.message)}
}

export async function copyResult(){
  const html=actions.getEditorHtml(state.mail.resultBody),text=actions.getEditorText(state.mail.resultBody);
  try{
    if(state.mail.resultBody.querySelector("img")){
      await navigator.clipboard.writeText(text);actions.toast("E-Mailtext ohne Bilder kopiert.");return;
    }
    if(window.ClipboardItem&&navigator.clipboard.write){
      await navigator.clipboard.write([new ClipboardItem({
        "text/html":new Blob([html],{type:"text/html"}),
        "text/plain":new Blob([text],{type:"text/plain"})
      })]);
    }else await navigator.clipboard.writeText(text);
    actions.toast("Nur der formatierte E-Mailtext wurde kopiert.");
  }catch(error){
    try{await navigator.clipboard.writeText(text);actions.toast("Nur der E-Mailtext wurde kopiert.")}
    catch(fallbackError){actions.toast("Der Text konnte nicht kopiert werden.")}
  }
}
