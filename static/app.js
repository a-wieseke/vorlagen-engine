// DOM references and shared application state
const byId = id => document.getElementById(id);
const loginView=byId("loginView"), appView=byId("appView"), who=byId("who");
const recoveryDialog=byId("recoveryDialog"), secretDialog=byId("secretDialog"),credentialDialog=byId("credentialDialog");
const recUsername=byId("recUsername"), recCode=byId("recCode"), recPassword=byId("recPassword");
const oldPassword=byId("oldPassword"), newPassword=byId("newPassword"), newPassword2=byId("newPassword2");
const variableChips=byId("variableChips"), variableList=byId("variableList");
const projectSelect=byId("projectSelect"), projectList=byId("projectList"), contactSelect=byId("contactSelect");
const templateSelect=byId("templateSelect"), templateList=byId("templateList");
const projectSelectWrap=byId("projectSelectWrap"), mode=byId("mode"), manualFields=byId("manualFields");
const projectManualFields=byId("projectManualFields"), jsonFile=byId("jsonFile"), jsonPaste=byId("jsonPaste");
const resultTemplateName=byId("resultTemplateName"),resultTo=byId("resultTo"), resultCc=byId("resultCc"), resultSubject=byId("resultSubject"), resultBody=byId("resultBody");
const tplId=byId("tplId"), tplName=byId("tplName"), tplCategory=byId("tplCategory");
const tplSubject=byId("tplSubject"), tplBody=byId("tplBody"), tplActive=byId("tplActive"), fieldEditor=byId("fieldEditor");
const templateIdentity=byId("templateIdentity"),tplDisplayId=byId("tplDisplayId"),tplDirectLink=byId("tplDirectLink");
const tplNoticeBody=byId("tplNoticeBody"),tplNoticeMode=byId("tplNoticeMode"),tplNoticeEnabled=byId("tplNoticeEnabled");
const tplNoticeButtonLabel=byId("tplNoticeButtonLabel"),templateValidation=byId("templateValidation");
const userList=byId("userList"), uUsername=byId("uUsername"), uFirst=byId("uFirst");
const uLast=byId("uLast"), uEmail=byId("uEmail"), uRole=byId("uRole"),uPasswordPolicyExempt=byId("uPasswordPolicyExempt"),uMustChangePassword=byId("uMustChangePassword");
const varId=byId("varId"), varKey=byId("varKey"), varLabel=byId("varLabel"), varType=byId("varType");
const varSource=byId("varSource"), varRequired=byId("varRequired"), varActive=byId("varActive");
const roleList=byId("roleList"), roleId=byId("roleId"), roleName=byId("roleName");
const rolePermissionEditor=byId("rolePermissionEditor");
const roleAllCategories=byId("roleAllCategories"),roleCategoryEditor=byId("roleCategoryEditor");
const categoryList=byId("categoryList"),categoryId=byId("categoryId"),categoryName=byId("categoryName"),categoryActive=byId("categoryActive");
const dashboardTilesElement=byId("dashboardTiles"),dashboardCategorySelect=byId("dashboardCategorySelect");
const projectEditDialog=byId("projectEditDialog"),projectEditFields=byId("projectEditFields"),projectEditId=byId("projectEditId");
const projectOverviewSearch=byId("projectOverviewSearch"),projectPickerDialog=byId("projectPickerDialog");
const projectPickerSearch=byId("projectPickerSearch"),projectPickerResults=byId("projectPickerResults"),projectPickerButton=byId("projectPickerButton");
const modeProjectButton=byId("modeProjectButton"),modeManualButton=byId("modeManualButton");
const templatePickerDialog=byId("templatePickerDialog"),templatePickerSearch=byId("templatePickerSearch");
const templatePickerResults=byId("templatePickerResults"),templatePickerButton=byId("templatePickerButton");
const dashboardTemplateSearch=byId("dashboardTemplateSearch"),dashboardTemplateDialog=byId("dashboardTemplateDialog");
const dashboardTemplateDialogSearch=byId("dashboardTemplateDialogSearch"),dashboardTemplateSearchResults=byId("dashboardTemplateSearchResults");
const templateNotice=byId("templateNotice"),templateNoticeText=byId("templateNoticeText"),noticeAcknowledgeButton=byId("noticeAcknowledgeButton");
const noticeActionDialog=byId("noticeActionDialog"),noticeActionText=byId("noticeActionText");
const placeholderWarning=byId("placeholderWarning"),noticeRequiredDialog=byId("noticeRequiredDialog");
const recoveryCodeConfirmDialog=byId("recoveryCodeConfirmDialog"),linkEditorDialog=byId("linkEditorDialog");
const contactDialog=byId("contactDialog"),contactList=byId("contactList"),contactEditFields=byId("contactEditFields");
const contactQuickImport=byId("contactQuickImport"),excelImportJson=byId("excelImportJson"),excelImportPreview=byId("excelImportPreview");
const deleteContactButton=byId("deleteContactButton"),roleLockedNotice=byId("roleLockedNotice"),saveRoleButton=byId("saveRoleButton");
const templateTestDialog=byId("templateTestDialog"),templateTestFields=byId("templateTestFields");
const templateTestSubject=byId("templateTestSubject"),templateTestBody=byId("templateTestBody");
const templateTestNotice=byId("templateTestNotice"),templateTestNoticeText=byId("templateTestNoticeText"),templateTestNoticeMode=byId("templateTestNoticeMode");
const forcedPasswordDialog=byId("forcedPasswordDialog"),forcedOldPassword=byId("forcedOldPassword"),forcedNewPassword=byId("forcedNewPassword"),forcedNewPassword2=byId("forcedNewPassword2");
const archiveTemplateDialog=byId("archiveTemplateDialog"),quicklinkDialog=byId("quicklinkDialog");
const archiveProjectDialog=byId("archiveProjectDialog"),permanentDeleteDialog=byId("permanentDeleteDialog");
const navigationOrderList=byId("navigationOrderList"),projectSortOrder=byId("projectSortOrder");
const saveProjectEmailButton=byId("saveProjectEmailButton"),projectEmailDialog=byId("projectEmailDialog"),bidQuestionDialog=byId("bidQuestionDialog");
const bidQuestionList=byId("bidQuestionList"),bidQuestionProjectFilter=byId("bidQuestionProjectFilter"),bidQuestionCategoryFilter=byId("bidQuestionCategoryFilter"),bidQuestionBidderFilter=byId("bidQuestionBidderFilter"),bidQuestionSearch=byId("bidQuestionSearch");
const bidQuestionProject=byId("bidQuestionProject"),bidImportProject=byId("bidImportProject"),bidImportText=byId("bidImportText"),bidImportPreview=byId("bidImportPreview");
const bidAnswerLibrary=byId("bidAnswerLibrary"),bidAnswerSearch=byId("bidAnswerSearch"),bidAnswerTopic=byId("bidAnswerTopic");
const bidCategoryList=byId("bidCategoryList"),bidTopicList=byId("bidTopicList"),bidTopicCategory=byId("bidTopicCategory");
const bidProjectPickerDialog=byId("bidProjectPickerDialog"),bidProjectPickerSearch=byId("bidProjectPickerSearch"),bidProjectPickerResults=byId("bidProjectPickerResults");
const bidTaxonomyPickerDialog=byId("bidTaxonomyPickerDialog"),bidTaxonomyPickerSearch=byId("bidTaxonomyPickerSearch"),bidTaxonomyPickerResults=byId("bidTaxonomyPickerResults");
const standardAnswerPickerDialog=byId("standardAnswerPickerDialog"),standardAnswerPickerSearch=byId("standardAnswerPickerSearch"),standardAnswerPickerResults=byId("standardAnswerPickerResults");
const bidBatchRows=byId("bidBatchRows"),bidBatchProject=byId("bidBatchProject"),bidImportProjectButton=byId("bidImportProjectButton"),bidBatchProjectButton=byId("bidBatchProjectButton");
const bidderPickerDialog=byId("bidderPickerDialog"),bidderPickerSearch=byId("bidderPickerSearch"),bidderPickerResults=byId("bidderPickerResults");
const bidderDirectoryList=byId("bidderDirectoryList"),bidderDirectorySearch=byId("bidderDirectorySearch"),bidAnswerVariants=byId("bidAnswerVariants");

let me=null, csrfToken="", projects=[], templates=[], users=[], variables=[], roles=[], categories=[], dashboardTiles=[], dashboardQuicklinks=[], editingFields=[];
let favoriteTemplateIds=new Set();
let showFavoritesTile=false,showQuicklinksTile=false;
let permissionCatalog={};
let appSettings={app_name:"Wieseke Vorlagen-Engine",logo_data:"",navigation_order:["dashboard","email","documents","bidder","projects","users","system","help"]}, pendingLogoData="";
let editingProjectData=null;
let editingContactProject=null,editingContactIndex=-1,noticeAcknowledged=false,pendingNoticeAction=null;
let pendingRecoveryUserId=null,activeLinkEditor=null,activeLinkElement=null;
let draggedTemplateId=null,draggedTemplateCategoryId=null,draggedCategoryId=null,draggedDashboardTileId=null;
let pendingProjectImport=null,pendingRestoreBase64=null,pendingArchiveTemplateId=null,pendingArchiveProjectId=null,pendingPermanentDelete=null,draggedNavigationKey=null,draggedQuicklinkId=null,currentProjectDetailId=null;
let bidCategories=[],bidTopics=[],bidAnswers=[],bidQuestions=[],bidders=[],currentProjectWorkspace={emails:[],bid_questions:[]};
let draggedBidCategoryId=null,draggedBidTopicId=null,draggedBidTopicCategoryId=null;
let emailGenerated=false;
let activeBidProjectTarget="single",activeBidTaxonomyType="category",activeBidTaxonomyTarget="single",activeStandardAnswerTarget="single",activeStandardAnswerMode="answer",activeBidderTarget="single",activeBatchRowId=null,currentOpenedProjectEmailId=null;
let bidBatchItems=[];
let editingBidAnswerVariants=[],editingBidderId=null;
let documentTemplates=[],documentBlocks=[],editingDocumentTemplateId=null,editingDocumentBlockId=null;

async function api(url, options={}){
  options.headers=Object.assign({"Content-Type":"application/json"},options.headers||{});
  const method=String(options.method||"GET").toUpperCase();
  if(csrfToken&&!(["GET","HEAD","OPTIONS"].includes(method)))options.headers["X-CSRF-Token"]=csrfToken;
  const response=await fetch(url,options);
  let data={}; try{data=await response.json()}catch(e){}
  if(!response.ok) throw new Error(data.error||"Fehler bei der Anfrage.");
  return data;
}
function toast(message){
  const element=byId("toast");element.textContent=message;element.style.display="block";
  setTimeout(()=>element.style.display="none",3500);
}
function esc(value){
  return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
function menuIcon(name){
  const paths={external:'<path d="M14 3h7v7M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',duplicate:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>',edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',archive:'<path d="M3 6h18M5 6v14h14V6M9 10h6M4 3h16v3H4Z"/>',restore:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v5M14 11v5"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>'};
  return `<svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.edit}</svg>`;
}

// Compact project actions retain readable labels for keyboard/screen-reader users.
function projectActionIcon(icon,label,action,danger=false){
  const custom={mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',contacts:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5"/>'};
  const svg=custom[icon]?`<svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true">${custom[icon]}</svg>`:menuIcon(icon);
  return `<button type="button" class="project-action-button${danger?" danger":""}" title="${esc(label)}" aria-label="${esc(label)}" onclick="${action}">${svg}</button>`;
}

// Rich-text support is deliberately implemented without a third-party editor.
// This keeps maintenance small and makes the accepted HTML subset explicit.
const EMAIL_TAGS=new Set(["P","BR","STRONG","EM","UL","OL","LI","A"]);
let templateInsertTarget="body";
const savedEditorRanges=new WeakMap();

function plainTextToHtml(value){
  const text=String(value||"").replace(/\r\n?/g,"\n");
  return text.split("\n\n").map(part=>`<p>${esc(part).replace(/\n/g,"<br>")}</p>`).join("");
}
function safeLinkUrl(value){
  let url=String(value||"").trim();
  if(!url)return "";
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url))url="mailto:"+url;
  else if(!/^[a-z][a-z0-9+.-]*:/i.test(url))url="https://"+url;
  return /^(?:https?:\/\/|mailto:)/i.test(url)?url:"";
}
function sanitizeEmailHtml(value){
  const source=document.createElement("template");source.innerHTML=String(value||"");
  const cleanNode=node=>{
    if(node.nodeType===Node.TEXT_NODE)return document.createTextNode((node.textContent||"").replace(/\u200B/g,""));
    if(node.nodeType!==Node.ELEMENT_NODE)return document.createDocumentFragment();
    if(["SCRIPT","STYLE","IFRAME","OBJECT","SVG"].includes(node.tagName))return document.createDocumentFragment();
    if(node.tagName==="IMG")return cleanEmailImage(node);
    const mapped={B:"STRONG",I:"EM",DIV:"P"}[node.tagName]||node.tagName;
    const container=EMAIL_TAGS.has(mapped)?document.createElement(mapped.toLowerCase()):document.createDocumentFragment();
    if(mapped==="A"){
      const href=safeLinkUrl(node.getAttribute("href"));
      if(href)container.setAttribute("href",href);
    }
    Array.from(node.childNodes).forEach(child=>container.appendChild(cleanNode(child)));
    return container;
  };
  const output=document.createElement("div");
  Array.from(source.content.childNodes).forEach(node=>output.appendChild(cleanNode(node)));
  return output.innerHTML;
}
function htmlToPlainText(value){
  const source=document.createElement("div");source.innerHTML=sanitizeEmailHtml(value);
  let output="";
  const newline=count=>{
    const existing=(output.match(/\n*$/)||[""])[0].length;
    output+="\n".repeat(Math.max(0,count-existing));
  };
  const walk=node=>{
    if(node.nodeType===Node.TEXT_NODE){output+=node.textContent||"";return}
    if(node.nodeType!==Node.ELEMENT_NODE)return;
    if(node.tagName==="BR"){newline(1);return}
    if(node.tagName==="IMG"){output+=`[Bild: ${node.getAttribute("alt")||"Bild"}]`;return}
    if(node.tagName==="P")newline(output?2:0);
    if(node.tagName==="LI"){
      newline(output?1:0);
      const parent=node.parentElement;
      const index=parent?Array.from(parent.children).indexOf(node)+1:1;
      output+=parent?.tagName==="OL"?`${index}. `:"• ";
    }
    Array.from(node.childNodes).forEach(walk);
    if(node.tagName==="P")newline(2);
    if(["LI","UL","OL"].includes(node.tagName))newline(1);
  };
  Array.from(source.childNodes).forEach(walk);
  return output.replace(/[ \t]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}
function setEditorHtml(editor,html){editor.innerHTML=sanitizeEmailHtml(html);savedEditorRanges.delete(editor)}
function getEditorHtml(editor){return sanitizeEmailHtml(editor.innerHTML)}
function getEditorText(editor){return htmlToPlainText(getEditorHtml(editor))}
function selectionBelongsTo(editor,range){return editor.contains(range.commonAncestorContainer)}
function rememberEditorSelection(editor){
  const selection=window.getSelection();
  if(selection?.rangeCount&&selectionBelongsTo(editor,selection.getRangeAt(0)))savedEditorRanges.set(editor,selection.getRangeAt(0).cloneRange());
}
function restoreEditorSelection(editor){
  const range=savedEditorRanges.get(editor);if(!range)return false;
  const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);return true;
}
function activeEditorRange(editor){
  editor.focus();restoreEditorSelection(editor);
  const selection=window.getSelection();
  if(selection?.rangeCount&&selectionBelongsTo(editor,selection.getRangeAt(0)))return selection.getRangeAt(0);
  const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);
  selection.removeAllRanges();selection.addRange(range);return range;
}
function selectAfterNode(node,inside=false){
  const range=document.createRange();
  if(inside&&node.firstChild)range.setStart(node.firstChild,node.firstChild.textContent.length);
  else range.setStartAfter(node);
  range.collapse(true);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
}
function insertEditorFragment(editor,html){
  const range=activeEditorRange(editor),template=document.createElement("template");template.innerHTML=sanitizeEmailHtml(html);
  const fragment=template.content,last=fragment.lastChild;range.deleteContents();range.insertNode(fragment);
  if(last)selectAfterNode(last,last.nodeType===Node.ELEMENT_NODE&&last.childNodes.length===1&&last.firstChild?.nodeType===Node.TEXT_NODE);
  rememberEditorSelection(editor);
}
function closestEditorElement(node,tagName,editor){
  let element=node?.nodeType===Node.ELEMENT_NODE?node:node?.parentElement;
  while(element&&element!==editor){if(element.tagName===tagName.toUpperCase())return element;element=element.parentElement}
  return null;
}
function unwrapEditorElement(element,editor,preserveSelection=false){
  const parent=element.parentNode,first=element.firstChild,last=element.lastChild;
  while(element.firstChild)parent.insertBefore(element.firstChild,element);
  element.remove();
  if(preserveSelection&&first&&last){
    const range=document.createRange();range.setStartBefore(first);range.setEndAfter(last);
    const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
  }else if(last)selectAfterNode(last);else editor.focus();
}
function applyInlineFormat(editor,tagName){
  const range=activeEditorRange(editor),existing=closestEditorElement(range.commonAncestorContainer,tagName,editor);
  if(existing){unwrapEditorElement(existing,editor,true);return}
  const wrapper=document.createElement(tagName);
  if(range.collapsed){
    wrapper.appendChild(document.createTextNode("\u200B"));range.insertNode(wrapper);selectAfterNode(wrapper,true);
  }else{
    wrapper.appendChild(range.extractContents());range.insertNode(wrapper);
    const selection=window.getSelection();range.selectNodeContents(wrapper);selection.removeAllRanges();selection.addRange(range);
  }
}
function applyListFormat(editor,ordered){
  const range=activeEditorRange(editor),existing=closestEditorElement(range.commonAncestorContainer,ordered?"ol":"ul",editor);
  if(existing){removeListFormat(editor);return}
  const selected=range.toString().replace(/\u200B/g,"");
  const values=(selected||"").split(/\n+/).filter(Boolean);
  const list=document.createElement(ordered?"ol":"ul");
  (values.length?values:["\u200B"]).forEach(value=>{const item=document.createElement("li");item.textContent=value;list.appendChild(item)});
  range.deleteContents();range.insertNode(list);selectAfterNode(list.lastElementChild,true);
}
function removeListFormat(editor){
  const range=activeEditorRange(editor);
  const list=closestEditorElement(range.commonAncestorContainer,"ul",editor)||closestEditorElement(range.commonAncestorContainer,"ol",editor);
  if(!list)return;
  const fragment=document.createDocumentFragment();let last=null;
  Array.from(list.children).forEach(item=>{
    const paragraph=document.createElement("p");while(item.firstChild)paragraph.appendChild(item.firstChild);
    fragment.appendChild(paragraph);last=paragraph;
  });
  list.replaceWith(fragment);if(last)selectAfterNode(last,true);editor.focus();
}
const editorHistories=new WeakMap();
function resetEditorHistory(editor){editorHistories.set(editor,{states:[getEditorHtml(editor)],index:0})}
function recordEditorHistory(editor){
  const html=getEditorHtml(editor),history=editorHistories.get(editor)||{states:[],index:-1};
  if(history.states[history.index]===html)return;
  history.states=history.states.slice(0,history.index+1);history.states.push(html);history.index=history.states.length-1;
  // Inline images make snapshots larger: cap history by size as well as count.
  let size=history.states.reduce((total,state)=>total+state.length,0);
  while(history.states.length>2&&(history.states.length>100||size>20_000_000)){size-=history.states.shift().length;history.index--}
  editorHistories.set(editor,history);
}
function moveEditorHistory(editor,direction){
  const history=editorHistories.get(editor);if(!history)return;
  const target=history.index+direction;if(target<0||target>=history.states.length)return;
  history.index=target;setEditorHtml(editor,history.states[target]);editorHistories.set(editor,history);editor.focus();
}
function formatEditor(editorId,command){
  const editor=byId(editorId);
  if(command==="undo")return moveEditorHistory(editor,-1);
  if(command==="redo")return moveEditorHistory(editor,1);
  if(command==="bold")applyInlineFormat(editor,"strong");
  else if(command==="italic")applyInlineFormat(editor,"em");
  else if(command==="insertUnorderedList")applyListFormat(editor,false);
  else if(command==="insertOrderedList")applyListFormat(editor,true);
  else if(command==="removeList")removeListFormat(editor);
  rememberEditorSelection(editor);recordEditorHistory(editor);
}
function insertEditorLink(editorId){
  const editor=byId(editorId),range=activeEditorRange(editor);
  activeLinkEditor=editor;activeLinkElement=closestEditorElement(range.commonAncestorContainer,"a",editor);
  byId("linkEditorText").value=activeLinkElement?.textContent||range.toString()||"";
  byId("linkEditorUrl").value=activeLinkElement?.getAttribute("href")||"https://";
  byId("removeEditorLinkButton").hidden=!activeLinkElement;linkEditorDialog.showModal();
}
function saveEditorLink(){
  const href=safeLinkUrl(byId("linkEditorUrl").value),text=byId("linkEditorText").value.trim();
  if(!href||!text)return toast("Bitte Linktext und eine gültige Linkadresse eintragen.");
  if(activeLinkElement){activeLinkElement.href=href;activeLinkElement.textContent=text}
  else if(activeLinkEditor){
    const range=activeEditorRange(activeLinkEditor),link=document.createElement("a");link.href=href;link.textContent=text;
    range.deleteContents();range.insertNode(link);selectAfterNode(link,true);
  }
  if(activeLinkEditor){recordEditorHistory(activeLinkEditor);rememberEditorSelection(activeLinkEditor)}
  activeLinkEditor=null;activeLinkElement=null;linkEditorDialog.close();
}
function removeEditorLink(){
  if(activeLinkElement&&activeLinkEditor){unwrapEditorElement(activeLinkElement,activeLinkEditor);recordEditorHistory(activeLinkEditor)}
  activeLinkEditor=null;activeLinkElement=null;linkEditorDialog.close();
}
function cancelEditorLink(){activeLinkEditor=null;activeLinkElement=null;linkEditorDialog.close()}
function handleEditorPaste(event){
  event.preventDefault();
  const html=event.clipboardData?.getData("text/html");
  const text=event.clipboardData?.getData("text/plain")||"";
  const cleaned=html?sanitizeEmailHtml(html):plainTextToHtml(text);
  insertEditorFragment(event.currentTarget,cleaned);recordEditorHistory(event.currentTarget);
}

tplSubject.addEventListener("focus",()=>templateInsertTarget="subject");
tplBody.addEventListener("focus",()=>templateInsertTarget="body");
tplNoticeBody.addEventListener("focus",()=>templateInsertTarget="notice");
tplSubject.addEventListener("input",validateTemplatePlaceholders);
[tplName,tplCategory].forEach(input=>input.addEventListener("input",validateTemplatePlaceholders));
[tplBody,resultBody,tplNoticeBody].forEach(editor=>{
  editor.addEventListener("keyup",()=>rememberEditorSelection(editor));
  editor.addEventListener("mouseup",()=>rememberEditorSelection(editor));
  editor.addEventListener("input",()=>recordEditorHistory(editor));
  editor.addEventListener("keydown",event=>{
    const key=event.key.toLowerCase();
    if((event.ctrlKey||event.metaKey)&&!event.altKey&&(key==="b"||key==="i")){
      event.preventDefault();rememberEditorSelection(editor);formatEditor(editor.id,key==="b"?"bold":"italic");
    }
  });
  if(editor!==resultBody)editor.addEventListener("input",validateTemplatePlaceholders);
  // Do not replace the DOM on blur: dialogs must retain the insertion range.
  // Paste, loading, saving and exporting still pass through the sanitizers.
  editor.addEventListener("blur",()=>rememberEditorSelection(editor));
  if(editor!==tplNoticeBody)editor.addEventListener("click",event=>{
    if(event.target.tagName==="IMG")openEmailImageDialog(editor.id,event.target);
  });
  resetEditorHistory(editor);
});
// Template action menus behave like popovers and close when focus moves elsewhere.
document.addEventListener("click",event=>{
  document.querySelectorAll(".template-actions-menu[open]").forEach(menu=>{
    if(!menu.contains(event.target))menu.removeAttribute("open");
  });
});
function showSecret(title,text){
  byId("secretTitle").textContent=title;byId("secretText").textContent=text;secretDialog.showModal();
}
function showRecovery(){recoveryDialog.showModal()}

// Branding and public settings are loaded before authentication is required.
function applySettings(settings){
  appSettings=Object.assign(appSettings,settings||{});
  document.title=appSettings.app_name;
  document.querySelectorAll(".dynamic-app-name").forEach(element=>element.textContent=appSettings.app_name);
  const logo=appSettings.logo_data||"/static/logo.png";
  document.querySelectorAll(".dynamic-logo").forEach(element=>element.src=logo);
  applyMainNavigationOrder(appSettings.navigation_order);
}
function applyMainNavigationOrder(order){
  const navigation=byId("moduleNav");if(!navigation)return;
  const buttons=new Map(Array.from(navigation.querySelectorAll("[data-nav-key]")).map(button=>[button.dataset.navKey,button]));
  // Sidebar submenus are generated by ui-shell.js. Move the module button and
  // its submenu as one unit so a saved custom order cannot separate them.
  for(const key of order||[])if(buttons.has(key)){
    const button=buttons.get(key);navigation.appendChild(button.closest('.nav-main-row')||button);
    const submenu=button.dataset.module?navigation.querySelector(`.sidebar-submenu[data-sidebar-module="${button.dataset.module}"]`):null;
    if(submenu)navigation.appendChild(submenu);
  }
}
async function loadPublicSettings(){
  try{const data=await api("/api/public-settings");applySettings(data.settings)}catch(e){}
}

const params=new URLSearchParams(location.search);
if(params.get("login_error")){
  const retry=Number(params.get("retry")||0);
  byId("loginError").textContent=params.get("login_error")==="locked"
    ?`Das Konto ist vorübergehend gesperrt. Erneuter Versuch in ${retry} Sekunden.`
    :"Die Anmeldung ist fehlgeschlagen. Bitte Benutzername und Passwort prüfen.";
  byId("loginError").hidden=false;
}
if(byId("loginNext"))byId("loginNext").value=(/^\/vorlage\/\d+$/.test(location.pathname)||location.pathname==="/excel-import")?location.pathname:"/";

async function boot(){
  try{
    const data=await api("/api/me");me=data.user;csrfToken=data.csrf_token||"";
    loginView.hidden=true;appView.hidden=false;who.textContent=`${me.first_name} ${me.last_name}`;
    applyPermissionVisibility();
    await loadVariables();
    await loadCategories();
    if(hasPermission("projects_view"))await loadProjects();
    if(hasPermission("email_create")||hasPermission("templates_manage")||hasPermission("roles_manage"))await loadTemplates();
    if(hasPermission("email_create"))await loadFavorites();
    if(hasPermission("email_create"))await loadDashboard();
    if(hasPermission("roles_manage")||hasPermission("users_manage"))await loadRoles();
    if(hasPermission("users_manage"))await loadUsers();
    if(["bid_questions_view","bid_questions_manage","bid_answers_manage"].some(hasPermission))await loadBidModule();
    else if(hasPermission("projects_view"))await loadBidders();
    if(hasPermission("documents_create")||hasPermission("document_templates_manage"))await loadDocumentModule();
    await loadSettings();
    if(hasPermission("email_create"))setMode("manual");
    if(hasPermission("projects_manage"))showProjectEntry("form");
    ["bidQuestionYear","bidBatchYear","bidImportYear"].forEach(setCurrentBidYear);
    if(!openTemplateFromPath()&&!openExcelImportFromPath()){
      if(hasPermission("email_create"))switchTab("dashboard");
      else{
        const firstModule=document.querySelector("#moduleNav button[data-module]:not([hidden])");
        if(firstModule)openModule(firstModule.dataset.module);
        else switchTab("help");
      }
    }
    if(me.must_change)forcedPasswordDialog.showModal();
  }catch(error){
    loginView.hidden=false;appView.hidden=true;
    if(error?.message && error.message!=="Nicht angemeldet.") toast(error.message);
  }
}
function hasPermission(permission){return !!me?.permissions?.includes(permission)}
function applyPermissionVisibility(){
  document.querySelectorAll("[data-permission]").forEach(element=>{
    element.hidden=!hasPermission(element.dataset.permission);
  });
  document.querySelectorAll("[data-any-permission]").forEach(element=>{
    const required=element.dataset.anyPermission.split(",").map(value=>value.trim()).filter(Boolean);
    element.hidden=!required.some(hasPermission);
  });
  // The responsive sidebar mirrors the horizontal function navigation.
  // Keep both representations in sync after permissions become available.
  window.refreshShellPermissions?.();
}
async function logout(){await api("/api/logout",{method:"POST",body:"{}"});location.reload()}
async function recoverPassword(){
  try{
    const data=await api("/api/recover",{method:"POST",body:JSON.stringify({
      username:recUsername.value,recovery_code:recCode.value,new_password:recPassword.value
    })});
    recoveryDialog.close();showSecret("Neuer Wiederherstellungscode",data.new_recovery_code);toast("Passwort wurde geändert.");
  }catch(error){toast(error.message)}
}
async function changePassword(){
  if(newPassword.value!==newPassword2.value)return toast("Die neuen Passwörter stimmen nicht überein.");
  try{
    const data=await api("/api/change-password",{method:"POST",body:JSON.stringify({
      old_password:oldPassword.value,new_password:newPassword.value
    })});
    showSecret("Neuer Wiederherstellungscode",data.new_recovery_code);
    oldPassword.value=newPassword.value=newPassword2.value="";
  }catch(error){toast(error.message)}
}
async function completeForcedPasswordChange(){
  if(forcedNewPassword.value!==forcedNewPassword2.value)return toast("Die neuen Passwörter stimmen nicht überein.");
  try{
    const data=await api("/api/change-password",{method:"POST",body:JSON.stringify({
      old_password:forcedOldPassword.value,new_password:forcedNewPassword.value
    })});
    me.must_change=false;forcedPasswordDialog.close();
    forcedOldPassword.value=forcedNewPassword.value=forcedNewPassword2.value="";
    showSecret("Neuer Wiederherstellungscode",data.new_recovery_code);
    toast("Passwort wurde geändert.");
  }catch(error){toast(error.message)}
}
if(forcedPasswordDialog)forcedPasswordDialog.addEventListener("cancel",event=>event.preventDefault());

// Two-level single-page navigation. The first bar selects a functional module;
// the smaller second bar exposes only pages belonging to that module.
// Central registry for current and future functional modules. Adding another
// module only requires one registry entry plus its pages and permissions.
const MODULE_REGISTRY={
  dashboard:{label:"Hauptseite",tabs:[]},
  email:{label:"E-Mail-Vorlagen",tabs:["generator","templates","categories","template-edit"]},
  documents:{label:"Dokumente",tabs:["document-create","document-templates","document-blocks","document-template-edit"]},
  bidder:{label:"Bieterfragen",tabs:["bid-questions","bid-question-create","bid-question-batch","bid-question-import","bid-answers","bid-answer-create","bid-taxonomy"]},
  projects:{label:"Projekte",tabs:["project-overview","project-create","bidders","bidder-create","variables","project-detail","excel-import"]},
  users:{label:"Benutzerverwaltung",tabs:["users","roles"]},
  system:{label:"System",tabs:["system-status","audit","usage"]},
  help:{label:"Hilfe",tabs:[]}
};
const TAB_MODULES={};
const MODULE_DEFAULTS={};
for(const [module,definition] of Object.entries(MODULE_REGISTRY)){
  if(definition.tabs.length)MODULE_DEFAULTS[module]=definition.tabs.filter(tab=>!["excel-import","project-detail","template-edit","document-template-edit"].includes(tab));
  for(const tab of definition.tabs)TAB_MODULES[tab]=module;
}
document.querySelectorAll("#moduleNav button[data-tab]").forEach(button=>button.onclick=()=>switchTab(button.dataset.tab));
document.querySelectorAll("#moduleNav button[data-module]").forEach(button=>button.onclick=()=>openModule(button.dataset.module));
document.querySelectorAll("#subNav button[data-tab]").forEach(button=>button.onclick=()=>button.dataset.tab==="bid-answer-create"?newBidAnswer():switchTab(button.dataset.tab));
function moduleButtonAllowed(button){
  if(button.dataset.permission)return hasPermission(button.dataset.permission);
  const permissions=(button.dataset.anyPermission||"").split(",").map(value=>value.trim()).filter(Boolean);
  return !permissions.length||permissions.some(hasPermission);
}
function renderSubNavigation(module){
  const navigation=byId("subNav");
  if(!navigation)return;
  let visibleCount=0;
  navigation.querySelectorAll("button[data-tab]").forEach(button=>{
    const visible=button.dataset.moduleOwner===module&&moduleButtonAllowed(button);
    button.hidden=!visible;
    if(visible)visibleCount++;
  });
  navigation.hidden=!module||visibleCount===0;
}
function openModule(module){
  const preferred=(MODULE_DEFAULTS[module]||[]).find(tab=>{
    const button=document.querySelector(`#subNav button[data-tab="${tab}"]`);
    return button&&moduleButtonAllowed(button);
  });
  if(preferred)switchTab(preferred);
}
function switchTab(name,preserveUrl=false){
  const changedPage=!byId("tab-"+name)?.classList.contains("active");
  const module=TAB_MODULES[name]||null;
  document.querySelectorAll("#moduleNav button").forEach(button=>{
    button.classList.toggle("active",button.dataset.tab===name||(module&&button.dataset.module===module));
  });
  renderSubNavigation(module);
  document.querySelectorAll("#subNav button").forEach(button=>button.classList.toggle("active",button.dataset.tab===(name==="template-edit"?"templates":name==="document-template-edit"?"document-templates":name)));
  document.querySelectorAll(".tab").forEach(section=>section.classList.toggle("active",section.id==="tab-"+name));
  // Page title, breadcrumb and the expandable sidebar belong to the shared UI
  // shell. Fachmodule only need to call switchTab and stay layout-agnostic.
  window.updateAppShell?.(name,module);
  // Opening a separate editor/detail page starts at its heading, even if the
  // previous list or editor was scrolled to the bottom.
  if(changedPage)window.scrollTo({top:0,behavior:"instant"});
  if(!preserveUrl&&(/^\/vorlage\/\d+$/.test(location.pathname)||location.pathname==="/excel-import"))history.replaceState({},"","/");
  if(name==="settings")loadSettings();
  if(name==="account"||name==="users")loadProjectApiKeys();
  if(name==="audit"&&hasPermission("system_view"))loadAuditLog();
  if(name==="usage"&&hasPermission("system_view"))loadUsageReport();
  if(name==="system-status"&&hasPermission("system_view"))loadSystemStatus();
}
function goHome(){switchTab("dashboard")}
window.addEventListener("popstate",()=>{if(!openTemplateFromPath()&&!openExcelImportFromPath())switchTab("dashboard",true)});

// Central placeholder catalog
async function loadVariables(){
  const data=await api("/api/variables");variables=data.variables;
  renderVariableList();renderVariableChips();renderProjectManualFields();renderManualFields();
}
function renderVariableChips(){
  if(!variableChips)return;
  const groups={project:"Projekt",client:"Auftraggeber",contact:"Kontakt / Ansprache",user:"Benutzer",manual:"Benutzerdefinierte Platzhalter"};
  variableChips.innerHTML=Object.entries(groups).map(([source,label])=>{
    const items=variables.filter(variable=>variable.active&&variable.source===source);
    if(!items.length)return "";
    return `<div class="chip-group"><b>${label}</b><div>${items.map(variable=>
      `<button type="button" class="chip" onclick="insertVariable('${esc(variable.key)}')">{{${esc(variable.key)}}}</button>`
    ).join("")}</div></div>`;
  }).join("");
}
function renderVariableList(){
  if(!variableList||!hasPermission("variables_manage"))return;
  const labels={project:"Projekt",client:"Auftraggeber",contact:"Kontakt / Ansprache",user:"Benutzer",manual:"Manuell"};
  const renderRows=items=>items.map(variable=>`<div class="list-item">
    <div><button type="button" class="text-button" onclick="editVariable(${variable.id})"><b>{{${esc(variable.key)}}}</b></button><div class="small">${esc(variable.label)} · ${labels[variable.source]||variable.source} · ${variable.active?"aktiv":"inaktiv"}</div></div>
    <button type="button" class="icon-button" title="Platzhalter bearbeiten" aria-label="Platzhalter bearbeiten" onclick="editVariable(${variable.id})">✎</button>
  </div>`).join("")||"<p class='muted'>Noch keine Platzhalter vorhanden.</p>";
  variableList.innerHTML=`<section class="variable-group"><h3>System- und Projektdaten</h3>${renderRows(variables.filter(variable=>variable.source!=="manual"))}</section>
    <section class="variable-group"><h3>Benutzerdefinierte Platzhalter</h3>${renderRows(variables.filter(variable=>variable.source==="manual"))}</section>`;
}
function newVariable(){
  varId.value="";varKey.value="";varLabel.value="";varType.value="text";varSource.value="manual";
  varRequired.checked=false;varActive.checked=true;byId("deleteVariableButton").hidden=true;
}
function newCustomVariable(){newVariable();varSource.value="manual";varKey.focus()}
function editVariable(id){
  const variable=variables.find(item=>item.id===id);if(!variable)return;
  varId.value=variable.id;varKey.value=variable.key;varLabel.value=variable.label;varType.value=variable.type;
  varSource.value=variable.source;varRequired.checked=variable.required;varActive.checked=variable.active;
  byId("deleteVariableButton").hidden=false;
}
async function saveVariable(){
  const payload={key:varKey.value,label:varLabel.value,type:varType.value,source:varSource.value,
    required:varRequired.checked,active:varActive.checked};
  try{
    if(varId.value)await api("/api/variables/"+varId.value,{method:"PUT",body:JSON.stringify(payload)});
    else await api("/api/variables",{method:"POST",body:JSON.stringify(payload)});
    toast("Platzhalter gespeichert.");newVariable();await loadVariables();
  }catch(error){toast(error.message)}
}
async function deleteVariable(){
  if(!varId.value||!confirm("Platzhalter wirklich löschen?"))return;
  try{
    await api("/api/variables/"+varId.value,{method:"DELETE"});
    toast("Platzhalter gelöscht.");newVariable();await loadVariables();
  }catch(error){toast(error.message)}
}

// Projects, live search and project master data
async function loadProjects(){
  const selectedBefore=projectSelect.value;
  const data=await api("/api/projects");projects=data.projects;
  projectSelect.innerHTML='<option value="">Projekt auswählen...</option>'+projects.filter(project=>!project.archived).map(project=>`<option value="${project.id}">${esc(project.project_key)} – ${esc(project.name)}</option>`).join("");
  projectSelect.value=projects.some(project=>String(project.id)===selectedBefore)?selectedBefore:"";
  renderProjectList();renderProjectPickerResults();updateProjectPickerButton();
  updateBidProjectOptions();
  refreshContacts();renderManualFields();
  if(currentProjectDetailId)renderProjectDetail(currentProjectDetailId);
}
function projectMatches(project,search){
  const needle=String(search||"").trim().toLocaleLowerCase("de");
  return !needle||`${project.project_key} ${project.name}`.toLocaleLowerCase("de").includes(needle);
}
function renderProjectList(){
  if(!projectList)return;
  const showArchived=!!byId("showArchivedProjects")?.checked;
  byId("archivedProjectBulkActions").hidden=!showArchived||!hasPermission("roles_manage");
  const direction=projectSortOrder?.value==="za"?-1:1;
  const filtered=projects.filter(project=>project.archived===showArchived&&projectMatches(project,projectOverviewSearch?.value))
    .sort((left,right)=>direction*String(left.project_key).localeCompare(String(right.project_key),"de",{sensitivity:"base",numeric:true}));
  const rows=filtered.map(project=>`<div class="project-table-row ${project.archived?"archived-item":""}">
    <div class="project-key">${project.archived&&hasPermission("roles_manage")?`<input class="archived-project-select" type="checkbox" value="${project.id}" aria-label="${esc(project.project_key)} auswählen"> `:""}${esc(project.project_key)}</div>
    <div class="project-name"><button type="button" class="text-button" onclick="openProjectDetail(${project.id})"><b>${esc(project.name)}</b></button>${project.archived?'<div class="small">Archiviert</div>':""}</div>
    <div class="project-date">${new Date(project.imported_at).toLocaleDateString("de-DE")}</div>
    <div class="project-table-actions">${!project.archived&&hasPermission("email_create")?projectActionIcon("mail","E-Mail erstellen",`useProject(${project.id})`):""}
    ${!project.archived&&hasPermission("projects_manage")?projectActionIcon("edit","Projektdaten bearbeiten",`editProject(${project.id})`):""}
    ${!project.archived&&hasPermission("projects_manage")?projectActionIcon("contacts","Kontakte bearbeiten",`openContactDialog(${project.id})`):""}
    ${hasPermission("projects_manage")?(project.archived?projectActionIcon("restore","Projekt wiederherstellen",`restoreProject(${project.id})`):projectActionIcon("archive","Projekt archivieren",`deleteProject(${project.id})`,true)):""}
    ${project.archived&&hasPermission("roles_manage")?projectActionIcon("trash","Projekt endgültig löschen",`permanentlyDeleteProject(${project.id})`,true):""}</div>
  </div>`).join("");
  projectList.innerHTML=filtered.length?`<div class="project-table-shell"><div class="project-table-head"><span>Projekt-ID</span><span>Projektbezeichnung</span><span class="project-date-column">Letzte Änderung</span><span>Aktionen</span></div>${rows}</div>`:"<div class='empty-state'>Keine passenden Projekte gefunden.</div>";
}
function openProjectPicker(){
  projectPickerSearch.value="";renderProjectPickerResults();projectPickerDialog.showModal();projectPickerSearch.focus();
}
function renderProjectPickerResults(){
  if(!projectPickerResults)return;
  const filtered=projects.filter(project=>!project.archived&&projectMatches(project,projectPickerSearch?.value));
  projectPickerResults.innerHTML=filtered.length?filtered.map(project=>
    `<button type="button" onclick="chooseProject(${project.id})"><b>${esc(project.project_key)}</b><span>${esc(project.name)}</span></button>`
  ).join(""):"<p class='muted'>Keine passenden Projekte gefunden.</p>";
}
function updateProjectPickerButton(){
  const project=selectedProject();
  if(projectPickerButton){
    projectPickerButton.textContent=project?`${project.project_key} – ${project.name}`:"Projekt auswählen...";
    projectPickerButton.classList.toggle("has-selection",!!project);
  }
}
function chooseProject(id){
  projectSelect.value=String(id);emailGenerated=false;updateProjectPickerButton();refreshContacts();renderManualFields();
  showTemplatePreview();
  if(projectPickerDialog.open)projectPickerDialog.close();
}
function contactChanged(){renderManualFields();showTemplatePreview()}
function useProject(id){
  chooseProject(id);setMode("project");switchTab("generator");
}
function loadJsonFile(input){
  const file=input.files[0];if(!file)return;const reader=new FileReader();
  reader.onload=()=>jsonPaste.value=reader.result;reader.readAsText(file,"utf-8");
}
async function importProject(){
  try{
    const object=JSON.parse(jsonPaste.value);
    prepareProjectImport(object,"json");
  }catch(error){toast(error.message)}
}

// Excel opens this dedicated route after placing the same project JSON on the clipboard.
function openExcelImportFromPath(){
  if(location.pathname!=="/excel-import")return false;
  if(!hasPermission("projects_manage")){toast("Für den Excel-Import fehlt die Berechtigung.");return false}
  switchTab("excel-import",true);previewExcelImport();return true;
}
function parsedExcelProject(){
  const project=JSON.parse(excelImportJson.value||"");
  if(!project?.projekt?.id||!project?.projekt?.bezeichnung)throw new Error("Projekt-ID und Projektbezeichnung fehlen.");
  if(project.kontakte!==undefined&&!Array.isArray(project.kontakte))throw new Error("kontakte muss eine Liste sein.");
  return project;
}
function previewExcelImport(){
  if(!excelImportPreview)return;
  if(!excelImportJson.value.trim()){excelImportPreview.textContent="Noch keine Projektdaten eingelesen.";return}
  try{
    const data=parsedExcelProject(),existing=projects.find(item=>item.project_key===String(data.projekt.id));
    excelImportPreview.innerHTML=`<b>${existing?"Vorhandenes Projekt aktualisieren":"Neues Projekt anlegen"}</b><br>${esc(data.projekt.id)} – ${esc(data.projekt.bezeichnung)}<br>${(data.kontakte||[]).length} Kontakt(e)`;
  }catch(error){excelImportPreview.textContent="Die Daten sind noch nicht gültig: "+error.message}
}
async function readExcelClipboard(){
  try{excelImportJson.value=(await navigator.clipboard.readText()).trim();previewExcelImport()}
  catch(error){toast("Die Zwischenablage konnte nicht gelesen werden. Bitte JSON manuell einfügen oder den Browserzugriff erlauben.")}
}
async function importExcelProject(){
  try{
    const data=parsedExcelProject();
    prepareProjectImport(data,"excel");
  }catch(error){toast(error.message)}
}
async function deleteProject(id){
  const project=projects.find(item=>item.id===Number(id));if(!project)return;
  pendingArchiveProjectId=project.id;byId("archiveProjectName").textContent=`${project.project_key} – ${project.name}`;archiveProjectDialog.showModal();
}
function cancelArchiveProject(){pendingArchiveProjectId=null;archiveProjectDialog.close()}
async function confirmArchiveProject(){
  if(!pendingArchiveProjectId)return;const id=pendingArchiveProjectId;pendingArchiveProjectId=null;archiveProjectDialog.close();
  try{await api("/api/projects/"+id,{method:"DELETE"});if(currentProjectDetailId===id){currentProjectDetailId=null;switchTab("project-overview")}await loadProjects();toast("Projekt archiviert.")}catch(error){toast(error.message)}
}
async function restoreProject(id){try{await api(`/api/projects/${id}/restore`,{method:"PUT",body:"{}"});await loadProjects();toast("Projekt wiederhergestellt.")}catch(error){toast(error.message)}}
async function permanentlyDeleteProject(id){
  openPermanentDelete("project",[id]);
}
function toggleAllArchivedSelections(entity,checked){document.querySelectorAll(`.archived-${entity}-select`).forEach(input=>input.checked=checked)}
function openBulkDelete(entity){
  const ids=Array.from(document.querySelectorAll(`.archived-${entity}-select:checked`)).map(input=>Number(input.value));
  if(!ids.length)return toast("Bitte mindestens einen archivierten Eintrag auswählen.");
  openPermanentDelete(entity,ids);
}
function openPermanentDelete(entity,ids){
  const cleanIds=[...new Set((ids||[]).map(Number).filter(Boolean))];if(!cleanIds.length)return;
  pendingPermanentDelete={entity,ids:cleanIds};const plural=cleanIds.length>1;
  byId("permanentDeleteTitle").textContent=plural?`${cleanIds.length} Einträge endgültig löschen?`:`${entity==="project"?"Projekt":"Vorlage"} endgültig löschen?`;
  byId("permanentDeleteText").textContent=plural?"Alle ausgewählten archivierten Einträge werden unwiderruflich gelöscht.":entity==="project"?"Das archivierte Projekt wird unwiderruflich gelöscht.":"Die archivierte Vorlage und ihre Versionshistorie werden unwiderruflich gelöscht.";
  permanentDeleteDialog.showModal();
}
function cancelPermanentDelete(){pendingPermanentDelete=null;permanentDeleteDialog.close()}
async function confirmPermanentDelete(){
  if(!pendingPermanentDelete)return;const {entity,ids}=pendingPermanentDelete;pendingPermanentDelete=null;permanentDeleteDialog.close();
  try{
    if(ids.length===1)await api(`/api/${entity==="project"?"projects":"templates"}/${ids[0]}/permanent`,{method:"DELETE"});
    else await api(`/api/${entity==="project"?"projects":"templates"}/delete-archived`,{method:"POST",body:JSON.stringify({ids})});
    if(entity==="project"){if(ids.includes(currentProjectDetailId)){currentProjectDetailId=null;switchTab("project-overview")}await loadProjects()}
    else{if(ids.includes(Number(tplId.value)))newTemplate(false);await loadTemplates();switchTab("templates")}
    toast(`${ids.length} Eintrag${ids.length===1?"":"e"} endgültig gelöscht.`);
  }catch(error){toast(error.message)}
}

function flattenImportValue(value,prefix="",output={}){
  if(Array.isArray(value)){value.forEach((item,index)=>flattenImportValue(item,`${prefix}[${index}]`,output));if(!value.length)output[prefix]="[]";return output}
  if(value&&typeof value==="object"){Object.entries(value).forEach(([key,item])=>flattenImportValue(item,prefix?`${prefix}.${key}`:key,output));return output}
  output[prefix]=value??"";return output;
}
function prepareProjectImport(data,source){
  if(!data?.projekt?.id||!data?.projekt?.bezeichnung)return toast("Projekt-ID und Projektbezeichnung fehlen.");
  const existing=projects.find(project=>project.project_key===String(data.projekt.id));
  const before=existing?flattenImportValue(existing.data):{},after=flattenImportValue(data),keys=[...new Set([...Object.keys(before),...Object.keys(after)])].sort();
  const changes=keys.filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key])).map(key=>({key,before:before[key],after:after[key]}));
  pendingProjectImport={data,source};
  importPreviewContent.innerHTML=`<div class="info-box"><b>${existing?"Vorhandenes Projekt aktualisieren":"Neues Projekt anlegen"}</b><br>${esc(data.projekt.id)} – ${esc(data.projekt.bezeichnung)}<br>${(data.kontakte||[]).length} Kontakt(e)</div>`+
    (changes.length?`<div class="change-list">${changes.map(change=>`<div><b>${esc(change.key)}</b><span class="old-value">${change.before===undefined?"—":esc(change.before)}</span><span aria-hidden="true">→</span><span class="new-value">${change.after===undefined?"—":esc(change.after)}</span></div>`).join("")}</div>`:"<p>Keine inhaltlichen Änderungen erkannt.</p>");
  importPreviewDialog.showModal();
}
function cancelProjectImport(){pendingProjectImport=null;importPreviewDialog.close()}
async function confirmProjectImport(){
  if(!pendingProjectImport)return;
  const {data,source}=pendingProjectImport;pendingProjectImport=null;importPreviewDialog.close();
  try{await api("/api/projects",{method:"POST",body:JSON.stringify({data})});await loadProjects();
    if(source==="json"){jsonPaste.value="";jsonFile.value=""}else previewExcelImport();toast("Projekt wurde importiert.")
  }catch(error){toast(error.message)}
}
function editProject(id){
  const project=projects.find(item=>item.id===id);if(!project)return;
  editingProjectData=JSON.parse(JSON.stringify(project.data||{}));
  editingProjectData.kontakte=Array.isArray(editingProjectData.kontakte)?editingProjectData.kontakte:[];
  projectEditId.value=String(id);projectEditFields.innerHTML="";
  byId("projectEditConflict").hidden=true;
  const context=editingProjectData;
  for(const variable of projectRecordVariables()){
    const label=document.createElement("label");label.textContent=variable.label+(variable.required?" *":"");
    const input=createInput(variable,"project-edit-input");input.value=getPath(context,variable.key)||"";
    label.appendChild(input);projectEditFields.appendChild(label);
  }
  projectEditDialog.showModal();
}
async function saveEditedProject(){
  if(!editingProjectData)return;
  const context=editingProjectData;
  document.querySelectorAll(".project-edit-input").forEach(input=>setPath(context,input.dataset.key,input.value));
  const missing=projectRecordVariables().filter(variable=>variable.required&&!String(getPath(context,variable.key)).trim());
  if(missing.length)return toast("Pflichtfeld fehlt: "+missing[0].label);
  try{
    await api(`/api/projects/${projectEditId.value}`,{method:"PUT",body:JSON.stringify({data:editingProjectData})});
    const projectId=Number(projectEditId.value);projectEditDialog.close();editingProjectData=null;toast("Projekt wurde aktualisiert.");await loadProjects();if(currentProjectDetailId===projectId)renderProjectDetail(projectId);
  }catch(error){
    const warning=byId("projectEditConflict");warning.querySelector("span").textContent=error.message;warning.hidden=false;
  }
}

function openProjectDetail(id){currentProjectDetailId=Number(id);renderProjectDetail(currentProjectDetailId);switchTab("project-detail")}
function renderProjectDetail(id){
  const project=projects.find(item=>item.id===Number(id));if(!project){currentProjectDetailId=null;return switchTab("project-overview")}
  byId("projectDetailTitle").textContent=`${project.project_key} – ${project.name}`;
  byId("projectDetailMeta").textContent=`Zuletzt geändert: ${new Date(project.imported_at).toLocaleString()}${project.archived?" · archiviert":""}`;
  byId("projectDetailVariables").innerHTML=projectRecordVariables().map(variable=>`<div><dt>${esc(variable.label)}</dt><dd>${esc(getPath(project.data,variable.key)||"—")}</dd></div>`).join("");
  const contacts=project.data?.kontakte||[];
  byId("projectDetailContacts").innerHTML=contacts.length?`<ul class="contact-list">${contacts.map(contact=>`<li class="project-contact-row"><div class="contact-list-name"><strong>${esc([contact.vorname,contact.nachname].filter(Boolean).join(" ")||contact.anrede||"Kontakt")}</strong><span class="muted">${esc(contact.rolle||"Keine Rolle")}</span></div><dl><div><dt>Ansprache</dt><dd>${esc(contact.anrede||"—")}</dd></div><div><dt>E-Mail</dt><dd>${contact.email?`<a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>`:"—"}</dd></div><div><dt>Telefon</dt><dd>${esc(contact.telefon||"—")}</dd></div></dl></li>`).join("")}</ul>`:"<p class='muted'>Für dieses Projekt sind noch keine Kontakte hinterlegt.</p>";
  const contactsEdit=byId("projectContactsEditButton");
  contactsEdit.hidden=project.archived||!hasPermission("projects_manage");
  contactsEdit.onclick=()=>openContactDialog(project.id);
  byId("projectDetailActions").innerHTML=`${!project.archived&&hasPermission("email_create")?`<button type="button" onclick="useProject(${project.id})">E-Mail erstellen</button>`:""}${!project.archived&&hasPermission("projects_manage")?`<button type="button" onclick="editProject(${project.id})">Projektdaten bearbeiten</button><button type="button" class="danger" onclick="deleteProject(${project.id})">Archivieren</button>`:""}${project.archived&&hasPermission("projects_manage")?`<button type="button" onclick="restoreProject(${project.id})">Wiederherstellen</button>`:""}${project.archived&&hasPermission("roles_manage")?`<button type="button" class="danger" onclick="permanentlyDeleteProject(${project.id})">Endgültig löschen</button>`:""}`;
  loadProjectWorkspace(project.id);
}

async function loadProjectWorkspace(projectId){
  try{
    currentProjectWorkspace=await api(`/api/projects/${projectId}/workspace`);
    renderProjectWorkspace();
  }catch(error){
    currentProjectWorkspace={emails:[],bid_questions:[]};renderProjectWorkspace();toast(error.message);
  }
}
function renderProjectWorkspace(){
  renderProjectDocuments();
  const questions=currentProjectWorkspace.bid_questions||[],emails=currentProjectWorkspace.emails||[];
  const questionTarget=byId("projectPhaseBidQuestions"),emailTarget=byId("projectSavedEmails");
  if(questionTarget)questionTarget.innerHTML=questions.length?`<div class="phase-module-heading"><b>Bieterfragen</b><span>${questions.length}</span></div>`+questions.map(question=>
    `<article class="phase-bid-question"><header><button type="button" class="text-button" onclick="openBidQuestion(${question.id})"><b>${esc(question.category||"Ohne Kategorie")} · ${esc(question.subject||"Ohne Thema")}</b></button><span class="bid-status ${question.answered_at?"done":""}">${bidQuestionStatus(question)}</span></header><div>${bidOverviewLine("Bieter",question.bidder||"—")}${bidOverviewLine("Bieterfrage",question.question)}${bidOverviewLine("Kommentar Agentur Wieseke",question.agency_comment||"—")}${bidOverviewLine("Entscheidung",question.decision||"—")}${bidOverviewLine("Antwort",question.answer||"—")}</div>${hasPermission("bid_questions_manage")&&question.answer&&!question.answered_at?`<footer><button type="button" class="success-button" onclick="acknowledgeBidQuestion(${question.id})">Beantwortung quittieren</button></footer>`:""}</article>`
  ).join(""):"<div class='phase-empty'>Noch keine Bieterfragen erfasst.</div>";
  if(emailTarget)emailTarget.innerHTML=emails.length?emails.map(email=>`<button type="button" class="project-email-record" onclick="openProjectEmail(${email.id})"><span><b>${esc(email.subject)}</b><small>${esc(email.template_name||"Ohne Vorlage")} · ${new Date(email.created_at).toLocaleString()}</small></span><span>${esc(email.recipient||"Kein Empfänger")}</span></button>`).join(""):"<p class='muted'>Noch keine E-Mails im Projekt gespeichert.</p>";
}
function openProjectEmail(id){
  const email=(currentProjectWorkspace.emails||[]).find(item=>item.id===Number(id));if(!email)return;
  currentOpenedProjectEmailId=email.id;
  byId("projectEmailDialogSubject").textContent=email.subject;
  byId("projectEmailDialogMeta").textContent=`${email.template_name||"Ohne Vorlage"} · gespeichert ${new Date(email.created_at).toLocaleString()} von ${email.username}`;
  byId("projectEmailDialogTo").textContent=email.recipient||"—";byId("projectEmailDialogCc").textContent=email.cc||"—";
  byId("projectEmailDialogBody").innerHTML=sanitizeEmailHtml(email.body_html||plainTextToHtml(email.body_text));
  projectEmailDialog.showModal();
}
function openSavedEmailInEditor(){
  const email=(currentProjectWorkspace.emails||[]).find(item=>item.id===Number(currentOpenedProjectEmailId));if(!email)return;
  const project=projects.find(item=>item.id===Number(email.project_id));if(!project)return toast("Das zugehörige Projekt wurde nicht gefunden.");
  projectSelect.value=String(project.id);updateProjectPickerButton();setMode("project");
  const template=templates.find(item=>item.id===Number(email.template_id));
  templateSelect.value=template&&template.active&&!template.archived?String(template.id):"";updateTemplatePickerButton();renderManualFields();
  resultTemplateName.value=email.template_name||template?.name||"Gespeicherte E-Mail";resultTo.value=email.recipient||"";resultCc.value=email.cc||"";resultSubject.value=email.subject||"";
  setEditorHtml(resultBody,email.body_html||plainTextToHtml(email.body_text));resetEditorHistory(resultBody);emailGenerated=true;updatePlaceholderWarning();updateSaveProjectEmailButton();
  projectEmailDialog.close();switchTab("generator");toast("Gespeicherte E-Mail wurde im Editor geöffnet.");
}

// Contact management is deliberately separated from the project master-data form.
function openContactDialog(id){
  editingContactProject=projects.find(project=>project.id===id);if(!editingContactProject)return;
  byId("contactDialogProject").textContent=`${editingContactProject.project_key} – ${editingContactProject.name}`;
  renderContactList();newContact();contactDialog.showModal();
}
function contactDisplayName(contact){
  return [contact.rolle,contact.anrede,contact.vorname,contact.nachname].filter(Boolean).join(" – ")||contact.email||"Kontakt";
}
function renderContactList(){
  const contacts=editingContactProject?.data?.kontakte||[];
  contactList.innerHTML=contacts.length?contacts.map((contact,index)=>
    `<button type="button" class="contact-list-button" onclick="editContact(${index})"><b>${esc(contactDisplayName(contact))}</b><span>${esc(contact.email||"")}</span></button>`
  ).join(""):"<p class='muted'>Noch keine Kontakte vorhanden.</p>";
}
function newContact(){editingContactIndex=-1;renderContactEditor({});byId("contactEditorTitle").textContent="Kontakt hinzufügen";deleteContactButton.hidden=true}
function editContact(index){
  const contact=editingContactProject?.data?.kontakte?.[index];if(!contact)return;
  editingContactIndex=index;renderContactEditor(contact);byId("contactEditorTitle").textContent="Kontakt bearbeiten";deleteContactButton.hidden=false;
}
function renderContactEditor(contact){
  contactEditFields.innerHTML="";const context={kontakt:contact||{}};
  for(const variable of contactVariables()){
    const label=document.createElement("label");label.textContent=variable.label+(variable.required?" *":"");
    const input=createInput(variable,"contact-edit-input");input.value=getPath(context,variable.key)||"";
    label.appendChild(input);contactEditFields.appendChild(label);
  }
}
async function persistContacts(contacts){
  const data=JSON.parse(JSON.stringify(editingContactProject.data||{}));data.kontakte=contacts;
  await api("/api/projects",{method:"POST",body:JSON.stringify({data})});
  const projectId=editingContactProject.id;await loadProjects();editingContactProject=projects.find(project=>project.id===projectId);
  renderContactList();newContact();
}
async function saveContact(){
  const context={kontakt:{}};document.querySelectorAll(".contact-edit-input").forEach(input=>setPath(context,input.dataset.key,input.value));
  const missing=contactVariables().filter(variable=>variable.required&&!String(getPath(context,variable.key)).trim());
  if(missing.length)return toast("Pflichtfeld fehlt: "+missing[0].label);
  const contacts=JSON.parse(JSON.stringify(editingContactProject?.data?.kontakte||[]));
  if(editingContactIndex<0)contacts.push(context.kontakt);else contacts[editingContactIndex]=context.kontakt;
  try{await persistContacts(contacts);toast("Kontakt wurde gespeichert.")}catch(error){toast(error.message)}
}
async function deleteContact(){
  if(editingContactIndex<0||!confirm("Kontakt wirklich löschen?"))return;
  const contacts=JSON.parse(JSON.stringify(editingContactProject?.data?.kontakte||[]));contacts.splice(editingContactIndex,1);
  try{await persistContacts(contacts);toast("Kontakt wurde gelöscht.")}catch(error){toast(error.message)}
}
function parseDelimitedLine(line,delimiter){
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
async function importContactRows(){
  const lines=String(contactQuickImport?.value||"").split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(!editingContactProject||!lines.length)return toast("Bitte mindestens eine Kontaktzeile einfügen.");
  const keys=["rolle","anrede","vorname","nachname","email","telefon"];
  const normalized={rolle:"rolle",anrede:"anrede",vorname:"vorname",nachname:"nachname",email:"email","e-mail":"email",telefon:"telefon"};
  const delimiter=lines[0].includes(";")?";":"\t";
  let rows=lines.map(line=>parseDelimitedLine(line,delimiter));
  let columns=keys;
  if(rows[0].some(cell=>normalized[cell.toLocaleLowerCase("de")])){
    columns=rows.shift().map(cell=>normalized[cell.toLocaleLowerCase("de")]||"");
  }
  const imported=rows.map(row=>Object.fromEntries(row.map((value,index)=>[columns[index],value]).filter(([key,value])=>key&&value)))
    .filter(contact=>Object.keys(contact).length);
  if(!imported.length)return toast("Es wurden keine Kontaktdaten erkannt.");
  const contacts=JSON.parse(JSON.stringify(editingContactProject.data?.kontakte||[]));contacts.push(...imported);
  try{await persistContacts(contacts);contactQuickImport.value="";toast(`${imported.length} Kontakt(e) wurden importiert.`)}
  catch(error){toast(error.message)}
}
function showProjectEntry(type){
  const json=type==="json";
  byId("projectJsonEntry").hidden=!json;byId("projectFormEntry").hidden=json;
  byId("projectJsonTabButton").classList.toggle("active",json);
  byId("projectFormTabButton").classList.toggle("active",!json);
}
function relevantProjectVariables(){
  return variables.filter(variable=>variable.active&&["project","client","contact"].includes(variable.source));
}
function projectRecordVariables(){return variables.filter(variable=>variable.active&&["project","client"].includes(variable.source))}
function contactVariables(){return variables.filter(variable=>variable.active&&variable.source==="contact")}
function createInput(definition,className){
  const input=document.createElement(definition.type==="textarea"?"textarea":"input");
  if(input.tagName==="TEXTAREA")input.rows=3;
  else input.type=definition.type==="date"?"date":definition.type==="number"?"number":definition.type==="email"?"email":"text";
  input.className=className;input.dataset.key=definition.key;return input;
}
function renderProjectManualFields(){
  if(!projectManualFields)return;
  projectManualFields.innerHTML="";
  for(const variable of projectRecordVariables()){
    const label=document.createElement("label");label.textContent=variable.label+(variable.required?" *":"");
    label.appendChild(createInput(variable,"project-manual-input"));projectManualFields.appendChild(label);
  }
}
function setPath(object,path,value){
  const parts=path.split(".");let current=object;
  parts.forEach((part,index)=>{
    if(index===parts.length-1)current[part]=value;
    else current=current[part]||(current[part]={});
  });
}
function getPath(object,path){
  return path.split(".").reduce((current,key)=>current!=null&&current[key]!==undefined?current[key]:"",object);
}
// Project creation intentionally excludes contacts. They are managed separately
// in the project overview, while JSON imports may still contain many contacts.
function projectObjectFromInputs(selector){
  const data={schema_version:"1.0",projekt:{},auftraggeber:{},kontakte:[]};
  document.querySelectorAll(selector).forEach(input=>setPath(data,input.dataset.key,input.value));
  return data;
}
async function saveManualProject(){
  const data=projectObjectFromInputs(".project-manual-input");
  const missing=projectRecordVariables().filter(variable=>variable.required&&!getPath(data,variable.key));
  if(missing.length)return toast("Pflichtfeld fehlt: "+missing[0].label);
  try{
    await api("/api/projects",{method:"POST",body:JSON.stringify({data})});
    toast("Projekt wurde gespeichert.");
    document.querySelectorAll(".project-manual-input").forEach(input=>input.value="");
    await loadProjects();
  }catch(error){toast(error.message)}
}
function buildProjectJsonTemplate(){
  const data={schema_version:"1.0",projekt:{},auftraggeber:{},kontakte:[]};
  const contact={};
  for(const variable of relevantProjectVariables()){
    if(variable.source==="contact")setPath({kontakt:contact},variable.key,"");
    else setPath(data,variable.key,"");
  }
  if(Object.keys(contact).length)data.kontakte.push(contact);
  return data;
}
function downloadProjectJsonTemplate(){
  const blob=new Blob([JSON.stringify(buildProjectJsonTemplate(),null,2)],{type:"application/json;charset=utf-8"});
  downloadBlob(blob,"Projekt-Vorlage.json");
}

// Mail categories and personal dashboard tiles
async function loadCategories(){
  const data=await api("/api/categories");categories=data.categories;
  if(tplCategory)tplCategory.innerHTML=categories.filter(category=>category.active||hasPermission("categories_manage")).map(category=>
    `<option value="${category.id}">${esc(category.name)}${category.active?"":" (inaktiv)"}</option>`).join("");
  renderCategoryList();updateDashboardCategoryOptions();
}
function renderCategoryList(){
  if(!categoryList||!hasPermission("categories_manage"))return;
  categoryList.innerHTML=categories.map(category=>`<div class="list-item category-list-item" data-category-id="${category.id}" ondragover="allowCategoryDrop(event)" ondragleave="clearCategoryDrop(event)" ondrop="dropCategory(event,${category.id})"><div class="template-row-content"><span class="drag-handle" draggable="true" title="Kategorie verschieben" aria-label="Kategorie verschieben" ondragstart="beginCategoryDrag(event,${category.id})" ondragend="endCategoryDrag()">⋮⋮</span><div><button class="text-button" onclick="editCategory(${category.id})"><b>${esc(category.name)}</b></button><div class="small">${category.active?"aktiv":"inaktiv"}</div></div></div><button onclick="editCategory(${category.id})">Bearbeiten</button></div>`).join("");
}
function beginCategoryDrag(event,id){draggedCategoryId=id;event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(id))}
function allowCategoryDrop(event){if(draggedCategoryId){event.preventDefault();event.dataTransfer.dropEffect="move";event.currentTarget.classList.add("drag-over")}}
function clearCategoryDrop(event){event.currentTarget.classList.remove("drag-over")}
function endCategoryDrag(){document.querySelectorAll(".category-list-item.drag-over").forEach(row=>row.classList.remove("drag-over"));draggedCategoryId=null}
async function dropCategory(event,targetCategoryId){
  event.preventDefault();clearCategoryDrop(event);
  if(!draggedCategoryId||draggedCategoryId===targetCategoryId)return endCategoryDrag();
  const dragged=categories.find(category=>category.id===draggedCategoryId),remaining=categories.filter(category=>category.id!==draggedCategoryId);
  const targetIndex=remaining.findIndex(category=>category.id===targetCategoryId),rect=event.currentTarget.getBoundingClientRect();
  remaining.splice(targetIndex+(event.clientY>rect.top+rect.height/2?1:0),0,dragged);categories=remaining;endCategoryDrag();renderCategoryList();
  try{
    await api("/api/categories/order",{method:"PUT",body:JSON.stringify({category_ids:categories.map(category=>category.id)})});
    await loadCategories();
    if(hasPermission("email_create")||hasPermission("templates_manage")||hasPermission("roles_manage"))await loadTemplates();
    if(hasPermission("email_create"))await loadDashboard();
    toast("Kategorienreihenfolge gespeichert.");
  }
  catch(error){toast(error.message);await loadCategories()}
}
function newCategory(){categoryId.value="";categoryName.value="";categoryActive.checked=true;byId("deleteCategoryButton").hidden=true}
function editCategory(id){const category=categories.find(item=>item.id===id);if(!category)return;categoryId.value=category.id;categoryName.value=category.name;categoryActive.checked=category.active;byId("deleteCategoryButton").hidden=false}
async function saveCategory(){
  const payload={name:categoryName.value,active:categoryActive.checked};
  try{
    if(categoryId.value)await api("/api/categories/"+categoryId.value,{method:"PUT",body:JSON.stringify(payload)});
    else await api("/api/categories",{method:"POST",body:JSON.stringify(payload)});
    toast("Kategorie gespeichert.");newCategory();await loadCategories();
    if(hasPermission("email_create")||hasPermission("templates_manage")||hasPermission("roles_manage"))await loadTemplates();
    if(hasPermission("email_create"))await loadDashboard();if(hasPermission("roles_manage"))await loadRoles();
  }catch(error){toast(error.message)}
}
async function deleteCategory(){
  if(!categoryId.value||!confirm("Kategorie wirklich löschen?"))return;
  try{await api("/api/categories/"+categoryId.value,{method:"DELETE"});toast("Kategorie gelöscht.");newCategory();await loadCategories()}
  catch(error){toast(error.message)}
}
async function loadDashboard(){
  const data=await api("/api/dashboard");dashboardTiles=data.tiles;showFavoritesTile=!!data.show_favorites;
  showQuicklinksTile=!!data.show_quicklinks;dashboardQuicklinks=data.quicklinks||[];renderDashboard();updateDashboardCategoryOptions();
}
function renderDashboard(){
  if(!dashboardTilesElement)return;
  const favoriteTemplates=templates.filter(template=>template.active&&!template.archived&&favoriteTemplateIds.has(template.id));
  const tileTemplateRows=list=>list.length?list.map(template=>`<div class="tile-template-row"><button class="tile-template-open" onclick="openTemplateFromDashboard(${template.id})">${esc(template.name)}</button>${hasPermission("templates_manage")?`<button class="tile-template-edit" title="Vorlage bearbeiten" aria-label="${esc(template.name)} bearbeiten" onclick="openTemplateEditor(${template.id})">✎</button>`:""}</div>`).join(""):"";
  const favoriteTile=showFavoritesTile?`<article class="dashboard-tile favorite-tile"><div class="tile-head"><h3>★ Favoriten</h3><button title="Kachel entfernen" onclick="removeFavoriteTile()">×</button></div><div class="tile-links">${tileTemplateRows(favoriteTemplates)||"<p class='muted'>Noch keine Favoriten markiert.</p>"}</div></article>`:"";
  const quicklinkRows=dashboardQuicklinks.length?dashboardQuicklinks.map(link=>`<div class="quicklink-row" draggable="true" data-quicklink-id="${link.id}" ondragstart="beginQuicklinkDrag(event,${link.id})" ondragover="allowQuicklinkDrop(event)" ondragleave="event.currentTarget.classList.remove('drag-over')" ondrop="dropQuicklink(event,${link.id})" ondragend="endQuicklinkDrag()">${link.link_type==="internal"?`<button type="button" onclick="openInternalQuicklink('${esc(link.target)}')">${menuIcon("external")}<span>${esc(link.title)}</span></button>`:`<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${menuIcon("external")}<span>${esc(link.title)}</span></a>`}</div>`).join(""):"<p class='muted'>Noch keine Quicklinks angelegt.</p>";
  const quicklinkTile=showQuicklinksTile?`<article class="dashboard-tile quicklink-tile"><div class="tile-head"><h3>Quicklinks</h3><div class="tile-head-actions"><button title="Quicklinks verwalten" aria-label="Quicklinks verwalten" onclick="openQuicklinkDialog()">${menuIcon("settings")}</button><button title="Kachel entfernen" aria-label="Quicklink-Kachel entfernen" onclick="removeQuicklinksTile()">×</button></div></div><div class="tile-links">${quicklinkRows}</div></article>`:"";
  const categoryTiles=dashboardTiles.map(tile=>`<article class="dashboard-tile" data-tile-id="${tile.id}" ondragover="allowDashboardDrop(event)" ondragleave="clearDashboardDrop(event)" ondrop="dropDashboardTile(event,${tile.id})">
    <div class="tile-head"><div class="template-row-content"><span class="drag-handle dashboard-drag-handle" draggable="true" title="Kachel verschieben" aria-label="Kachel verschieben" ondragstart="beginDashboardDrag(event,${tile.id})" ondragend="endDashboardDrag()">⋮⋮</span><h3>${esc(tile.category.name)}</h3></div><button title="Kachel entfernen" onclick="removeDashboardTile(${tile.id})">×</button></div>
    <div class="tile-links">${tileTemplateRows(tile.templates)||"<p class='muted'>Keine freigegebenen Vorlagen.</p>"}</div>
  </article>`).join("");
  dashboardTilesElement.innerHTML=favoriteTile+quicklinkTile+categoryTiles||( "<div class='card empty-dashboard'><h3>Noch keine Kacheln</h3><p>Wählen Sie oben eine Kategorie und fügen Sie Ihre erste Kachel hinzu oder markieren Sie Vorlagen als Favoriten.</p></div>");
}
function updateDashboardCategoryOptions(){
  if(!dashboardCategorySelect)return;const used=new Set(dashboardTiles.map(tile=>tile.category.id));
  const favoriteOption=showFavoritesTile?"":'<option value="favorites">★ Favoriten</option>';
  const quicklinksOption=showQuicklinksTile?"":'<option value="quicklinks">Quicklinks</option>';
  dashboardCategorySelect.innerHTML=favoriteOption+quicklinksOption+categories.filter(category=>category.active&&!used.has(category.id)).map(category=>`<option value="${category.id}">${esc(category.name)}</option>`).join("");
}
async function addDashboardTile(){
  if(!dashboardCategorySelect.value)return toast("Keine weitere Kategorie verfügbar.");
  try{
    if(dashboardCategorySelect.value==="favorites")await api("/api/dashboard/favorites",{method:"PUT",body:JSON.stringify({visible:true})});
    else if(dashboardCategorySelect.value==="quicklinks")await api("/api/dashboard/quicklinks/visibility",{method:"PUT",body:JSON.stringify({visible:true})});
    else await api("/api/dashboard",{method:"POST",body:JSON.stringify({category_id:Number(dashboardCategorySelect.value)})});
    await loadDashboard()
  }
  catch(error){toast(error.message)}
}
async function removeFavoriteTile(){try{await api("/api/dashboard/favorites",{method:"PUT",body:JSON.stringify({visible:false})});await loadDashboard()}catch(error){toast(error.message)}}
async function removeQuicklinksTile(){try{await api("/api/dashboard/quicklinks/visibility",{method:"PUT",body:JSON.stringify({visible:false})});await loadDashboard()}catch(error){toast(error.message)}}
async function removeDashboardTile(id){try{await api("/api/dashboard/"+id,{method:"DELETE"});await loadDashboard()}catch(error){toast(error.message)}}
const INTERNAL_QUICKLINKS=[
  {target:"dashboard",label:"Hauptseite",permission:"email_create"},{target:"generator",label:"E-Mail erstellen",permission:"email_create"},{target:"bid-questions",label:"Bieterfragen – Gesamtübersicht",anyPermission:["bid_questions_view","bid_questions_manage"]},{target:"bid-question-create",label:"Bieterfragen – Einzelerfassung",permission:"bid_questions_manage"},{target:"bid-question-batch",label:"Bieterfragen – Batch-Erfassung",permission:"bid_questions_manage"},{target:"bid-question-import",label:"Bieterfragen – Excel-Import",permission:"bid_questions_manage"},{target:"bid-answers",label:"Standardantworten",anyPermission:["bid_questions_view","bid_questions_manage","bid_answers_manage"]},{target:"bid-answer-create",label:"Standardantwort anlegen",permission:"bid_answers_manage"},{target:"bid-taxonomy",label:"Bieterfragen – Kategorien und Themen",permission:"bid_answers_manage"},{target:"project-overview",label:"Projektübersicht",permission:"projects_view"},{target:"project-create",label:"Projekt anlegen",permission:"projects_manage"},{target:"bidders",label:"Bieterverzeichnis",permission:"projects_view"},{target:"templates",label:"Vorlagen",permission:"templates_manage"},{target:"categories",label:"Mailkategorien",permission:"categories_manage"},{target:"variables",label:"Platzhalter",permission:"variables_manage"},{target:"users",label:"Benutzer",permission:"users_manage"},{target:"roles",label:"Rollen",permission:"roles_manage"},{target:"system-status",label:"Systemstatus",permission:"system_view"},{target:"audit",label:"Änderungsprotokoll",permission:"system_view"},{target:"usage",label:"Nutzungsauswertung",permission:"system_view"},{target:"help",label:"Hilfe"},{target:"settings",label:"Einstellungen",anyPermission:["settings_manage","backup_manage","templates_export_all"]},{target:"account",label:"Mein Konto"}
];
function internalQuicklinkAllowed(item){return !item.permission&&!item.anyPermission||item.permission&&hasPermission(item.permission)||item.anyPermission?.some(hasPermission)}
function openQuicklinkDialog(){
  byId("quicklinkTarget").innerHTML=INTERNAL_QUICKLINKS.filter(internalQuicklinkAllowed).map(item=>`<option value="${esc(item.target)}">${esc(item.label)}</option>`).join("");
  toggleQuicklinkType();renderQuicklinkList();quicklinkDialog.showModal();
}
function toggleQuicklinkType(){const internal=byId("quicklinkType").value==="internal";byId("quicklinkUrlWrap").hidden=internal;byId("quicklinkTargetWrap").hidden=!internal}
function renderQuicklinkList(){
  const target=byId("quicklinkList");if(!target)return;
  target.innerHTML=dashboardQuicklinks.length?dashboardQuicklinks.map(link=>`<div class="list-item quicklink-admin-row" draggable="true" data-quicklink-id="${link.id}" ondragstart="beginQuicklinkDrag(event,${link.id})" ondragover="allowQuicklinkDrop(event)" ondragleave="event.currentTarget.classList.remove('drag-over')" ondrop="dropQuicklink(event,${link.id})" ondragend="endQuicklinkDrag()"><div class="template-row-content"><span class="drag-handle" aria-hidden="true">⋮⋮</span><div><b>${esc(link.title)}</b><div class="small">${link.link_type==="internal"?"Interne Seite: "+esc(INTERNAL_QUICKLINKS.find(item=>item.target===link.target)?.label||link.target):esc(link.url)}</div></div></div><button type="button" class="danger" onclick="deleteQuicklink(${link.id})">${menuIcon("trash")} Entfernen</button></div>`).join(""):"<p class='muted'>Noch keine Quicklinks angelegt.</p>";
}
async function addQuicklink(){
  try{await api("/api/dashboard/quicklinks",{method:"POST",body:JSON.stringify({title:byId("quicklinkTitle").value,url:byId("quicklinkUrl").value,link_type:byId("quicklinkType").value,target:byId("quicklinkTarget").value})});byId("quicklinkTitle").value=byId("quicklinkUrl").value="";await loadDashboard();renderQuicklinkList();toast("Quicklink hinzugefügt.")}
  catch(error){toast(error.message)}
}
function openInternalQuicklink(target){const item=INTERNAL_QUICKLINKS.find(entry=>entry.target===target);if(!item||!internalQuicklinkAllowed(item))return toast("Für diese Seite fehlt die Berechtigung.");switchTab(target)}
function beginQuicklinkDrag(event,id){draggedQuicklinkId=id;event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(id))}
function allowQuicklinkDrop(event){if(draggedQuicklinkId){event.preventDefault();event.dataTransfer.dropEffect="move";event.currentTarget.classList.add("drag-over")}}
function endQuicklinkDrag(){draggedQuicklinkId=null;document.querySelectorAll(".quicklink-row.drag-over,.quicklink-admin-row.drag-over").forEach(row=>row.classList.remove("drag-over"))}
async function dropQuicklink(event,targetId){
  event.preventDefault();event.currentTarget.classList.remove("drag-over");if(!draggedQuicklinkId||draggedQuicklinkId===targetId)return endQuicklinkDrag();
  const dragged=dashboardQuicklinks.find(link=>link.id===draggedQuicklinkId),remaining=dashboardQuicklinks.filter(link=>link.id!==draggedQuicklinkId),targetIndex=remaining.findIndex(link=>link.id===targetId),rect=event.currentTarget.getBoundingClientRect();
  remaining.splice(targetIndex+(event.clientY>rect.top+rect.height/2?1:0),0,dragged);dashboardQuicklinks=remaining;endQuicklinkDrag();renderDashboard();renderQuicklinkList();
  try{await api("/api/dashboard/quicklinks/order",{method:"PUT",body:JSON.stringify({link_ids:dashboardQuicklinks.map(link=>link.id)})});toast("Quicklink-Reihenfolge gespeichert.")}catch(error){toast(error.message);await loadDashboard();renderQuicklinkList()}
}
async function deleteQuicklink(id){
  try{await api(`/api/dashboard/quicklinks/${id}`,{method:"DELETE"});await loadDashboard();renderQuicklinkList();toast("Quicklink entfernt.")}
  catch(error){toast(error.message)}
}
function beginDashboardDrag(event,id){draggedDashboardTileId=id;event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(id))}
function allowDashboardDrop(event){if(draggedDashboardTileId){event.preventDefault();event.dataTransfer.dropEffect="move";event.currentTarget.classList.add("drag-over")}}
function clearDashboardDrop(event){event.currentTarget.classList.remove("drag-over")}
function endDashboardDrag(){document.querySelectorAll(".dashboard-tile.drag-over").forEach(tile=>tile.classList.remove("drag-over"));draggedDashboardTileId=null}
async function dropDashboardTile(event,targetTileId){
  event.preventDefault();clearDashboardDrop(event);
  if(!draggedDashboardTileId||draggedDashboardTileId===targetTileId)return endDashboardDrag();
  const dragged=dashboardTiles.find(tile=>tile.id===draggedDashboardTileId),remaining=dashboardTiles.filter(tile=>tile.id!==draggedDashboardTileId);
  const targetIndex=remaining.findIndex(tile=>tile.id===targetTileId),rect=event.currentTarget.getBoundingClientRect();
  const after=event.clientY>rect.top+rect.height/2||event.clientX>rect.left+rect.width/2;
  remaining.splice(targetIndex+(after?1:0),0,dragged);dashboardTiles=remaining;endDashboardDrag();renderDashboard();
  try{await api("/api/dashboard/order",{method:"PUT",body:JSON.stringify({tile_ids:dashboardTiles.map(tile=>tile.id)})});toast("Kachelreihenfolge gespeichert.")}
  catch(error){toast(error.message);await loadDashboard()}
}
function openTemplate(id,pushHistory=true){
  const template=templates.find(item=>item.id===Number(id));
  if(!template){toast("Diese Vorlage ist für Ihre Rolle nicht freigegeben.");return false}
  templateSelect.value=String(template.id);
  updateTemplatePickerButton();noticeAcknowledged=false;
  if(pushHistory)history.pushState({},"",`/vorlage/${template.id}`);
  switchTab("generator",true);renderManualFields();showTemplatePreview();return true;
}
function openTemplateFromDashboard(id){openTemplate(id,true)}
function openTemplateEditor(id){editTemplate(id)}
function openTemplateFromPath(){
  const match=location.pathname.match(/^\/vorlage\/(\d+)$/);if(!match)return false;
  return openTemplate(Number(match[1]),false);
}
async function copyTemplateLink(id){
  const link=`${location.origin}/vorlage/${id}`;
  try{await navigator.clipboard.writeText(link);toast("Vorlagenlink wurde kopiert.")}catch(error){toast(link)}
}

function openDashboardTemplateSearch(){
  dashboardTemplateDialogSearch.value=dashboardTemplateSearch.value||"";
  renderDashboardTemplateSearchResults();dashboardTemplateDialog.showModal();dashboardTemplateDialogSearch.focus();
}
function closeDashboardTemplateSearch(){dashboardTemplateDialog.close();dashboardTemplateSearch.value=""}
function renderDashboardTemplateSearchResults(){
  if(!dashboardTemplateSearchResults)return;
  const filtered=templates.filter(template=>templateMatches(template,dashboardTemplateDialogSearch?.value));
  dashboardTemplateSearchResults.innerHTML=filtered.length?filtered.map(template=>`<div class="dashboard-template-result">
    <div><b>${esc(template.category)}</b><span>${esc(template.name)}${template.archived?" · archiviert":template.active?"":" · inaktiv"}</span></div>
    <div class="actions compact">${template.active&&!template.archived&&hasPermission("email_create")?`<button type="button" onclick="createEmailFromDashboardSearch(${template.id})">E-Mail erstellen</button>`:""}${hasPermission("templates_manage")?`<button type="button" onclick="editTemplateFromDashboardSearch(${template.id})">Vorlage bearbeiten</button>`:""}</div>
  </div>`).join(""):"<p class='muted'>Keine passenden Vorlagen gefunden.</p>";
}
function createEmailFromDashboardSearch(id){closeDashboardTemplateSearch();openTemplate(id,true)}
function editTemplateFromDashboardSearch(id){closeDashboardTemplateSearch();editTemplate(id)}

// Searchable template selection and direct links
async function loadTemplates(){
  const selectedBefore=templateSelect.value;
  const data=await api("/api/templates");templates=data.templates;
  templateSelect.innerHTML='<option value="">E-Mailvorlage auswählen...</option>'+templates.filter(template=>template.active&&!template.archived).map(template=>
    `<option value="${template.id}">${esc(template.category?template.category+" – ":"")}${esc(template.name)}</option>`
  ).join("");
  templateSelect.value=templates.some(template=>template.active&&!template.archived&&String(template.id)===selectedBefore)?selectedBefore:"";
  updateTemplatePickerButton();renderTemplatePickerResults();
  if(hasPermission("templates_manage")){
    const archivedOnly=!!byId("showArchivedTemplates")?.checked;
    byId("archivedTemplateBulkActions").hidden=!archivedOnly||!hasPermission("roles_manage");
    templateList.innerHTML=categories.map(category=>{
      const grouped=templates.filter(template=>template.category_id===category.id&&template.archived===archivedOnly);
      if(!grouped.length)return "";
      return `<section class="template-category-group"><h3>${esc(category.name)}</h3>${grouped.map((template,index)=>`<div class="list-item template-list-item" data-template-id="${template.id}" ondragover="allowTemplateDrop(event,${category.id})" ondragleave="clearTemplateDrop(event)" ondrop="dropTemplate(event,${template.id},${category.id})">
        <div class="template-row-content">${template.archived&&hasPermission("roles_manage")?`<input class="archived-template-select" type="checkbox" value="${template.id}" aria-label="${esc(template.name)} auswählen">`:""}<span class="drag-handle" draggable="${!template.archived}" title="Vorlage verschieben" aria-label="Vorlage verschieben" ondragstart="beginTemplateDrag(event,${template.id},${category.id})" ondragend="endTemplateDrag()">⋮⋮</span><div><button class="text-button" onclick="editTemplate(${template.id})"><b>${esc(template.name)}</b></button><div class="small">${template.archived?"archiviert":template.active?"aktiv":"inaktiv"}</div></div></div>
        <details class="template-actions-menu"><summary aria-label="Aktionen für ${esc(template.name)}" title="Aktionen">⋮</summary><div>
          ${template.archived?`<button type="button" onclick="restoreTemplate(${template.id})">${menuIcon("restore")} Wiederherstellen</button>${hasPermission("roles_manage")?`<button type="button" class="danger" onclick="permanentlyDeleteTemplate(${template.id})">${menuIcon("trash")} Endgültig löschen</button>`:""}`:`<a class="button-link" href="/vorlage/${template.id}">${menuIcon("external")} Direkt öffnen</a><button type="button" onclick="copyTemplateLink(${template.id})">${menuIcon("copy")} Link kopieren</button>${hasPermission("template_export")?`<button type="button" onclick="exportTemplateById(${template.id},'json')">${menuIcon("download")} Als JSON exportieren</button><button type="button" onclick="exportTemplateById(${template.id},'eml')">${menuIcon("download")} Als EML exportieren</button>`:""}<button type="button" onclick="duplicateTemplate(${template.id})">${menuIcon("duplicate")} Duplizieren</button><button type="button" onclick="editTemplate(${template.id})">${menuIcon("edit")} Bearbeiten</button><button type="button" class="danger archive-menu-action" onclick="archiveTemplate(${template.id})">${menuIcon("archive")} Archivieren</button>`}
        </div></details>
      </div>`).join("")}</section>`;
    }).join("");
  }
  renderManualFields();showTemplatePreview();
  if(hasPermission("templates_manage")&&templateValidation&&!templateValidation.innerHTML)validateTemplatePlaceholders();
}
function beginTemplateDrag(event,templateId,categoryId){
  draggedTemplateId=templateId;draggedTemplateCategoryId=categoryId;
  event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(templateId));
}
function allowTemplateDrop(event,categoryId){
  if(draggedTemplateId&&draggedTemplateCategoryId===categoryId){event.preventDefault();event.dataTransfer.dropEffect="move";event.currentTarget.classList.add("drag-over")}
}
function clearTemplateDrop(event){event.currentTarget.classList.remove("drag-over")}
function endTemplateDrag(){document.querySelectorAll(".template-list-item.drag-over").forEach(row=>row.classList.remove("drag-over"));draggedTemplateId=null;draggedTemplateCategoryId=null}
async function dropTemplate(event,targetTemplateId,categoryId){
  event.preventDefault();clearTemplateDrop(event);
  if(!draggedTemplateId||draggedTemplateCategoryId!==categoryId||draggedTemplateId===targetTemplateId)return endTemplateDrag();
  const ordered=templates.filter(template=>template.category_id===categoryId),dragged=ordered.find(template=>template.id===draggedTemplateId);
  const remaining=ordered.filter(template=>template.id!==draggedTemplateId),targetIndex=remaining.findIndex(template=>template.id===targetTemplateId);
  const targetRow=event.currentTarget.getBoundingClientRect(),insertAfter=event.clientY>targetRow.top+targetRow.height/2;
  remaining.splice(targetIndex+(insertAfter?1:0),0,dragged);endTemplateDrag();
  try{await api("/api/templates/order",{method:"PUT",body:JSON.stringify({category_id:categoryId,template_ids:remaining.map(template=>template.id)})});await loadTemplates();await loadDashboard();toast("Vorlagenreihenfolge gespeichert.")}
  catch(error){toast(error.message);await loadTemplates()}
}
function templateMatches(template,search){
  const needle=String(search||"").trim().toLocaleLowerCase("de");
  return !needle||`${template.category} ${template.name}`.toLocaleLowerCase("de").includes(needle);
}
function openTemplatePicker(){
  templatePickerSearch.value="";renderTemplatePickerResults();templatePickerDialog.showModal();templatePickerSearch.focus();
}
function renderTemplatePickerResults(){
  if(!templatePickerResults)return;
  const filtered=templates.filter(template=>template.active&&!template.archived&&templateMatches(template,templatePickerSearch?.value));
  templatePickerResults.innerHTML=filtered.length?filtered.map(template=>
    `<div class="picker-result-row"><button class="template-choice" type="button" onclick="chooseTemplate(${template.id})"><b>${esc(template.category)}</b><span>${esc(template.name)}</span></button><button class="favorite-toggle" type="button" title="${favoriteTemplateIds.has(template.id)?"Favorit entfernen":"Als Favorit markieren"}" aria-label="${favoriteTemplateIds.has(template.id)?"Favorit entfernen":"Als Favorit markieren"}" onclick="toggleFavorite(${template.id})">${favoriteTemplateIds.has(template.id)?"★":"☆"}</button></div>`
  ).join(""):"<p class='muted'>Keine passenden Vorlagen gefunden.</p>";
}
async function loadFavorites(){
  const data=await api("/api/favorites");favoriteTemplateIds=new Set(data.template_ids||[]);
  renderTemplatePickerResults();renderDashboard();
}
async function toggleFavorite(id){
  try{
    if(favoriteTemplateIds.has(id))await api(`/api/favorites/${id}`,{method:"DELETE"});
    else await api("/api/favorites",{method:"POST",body:JSON.stringify({template_id:id})});
    await loadFavorites();toast(favoriteTemplateIds.has(id)?"Vorlage als Favorit gespeichert.":"Favorit entfernt.");
  }catch(error){toast(error.message)}
}
function updateTemplatePickerButton(){
  const template=selectedTemplate();
  if(templatePickerButton){
    templatePickerButton.textContent=template?`${template.category} – ${template.name}`:"E-Mailvorlage auswählen...";
    templatePickerButton.classList.toggle("has-selection",!!template);
  }
  if(resultTemplateName)resultTemplateName.value=template?.name||"";
}
function chooseTemplate(id){
  templateSelect.value=String(id);emailGenerated=false;updateTemplatePickerButton();noticeAcknowledged=false;renderManualFields();
  showTemplatePreview();
  if(templatePickerDialog.open)templatePickerDialog.close();
}
function setMode(value){
  emailGenerated=false;
  mode.value=value;modeProjectButton.classList.toggle("active",value==="project");modeManualButton.classList.toggle("active",value==="manual");
  projectSelectWrap.hidden=value!=="project";projectSelectWrap.style.display="";refreshContacts();renderManualFields();showTemplatePreview();updateSaveProjectEmailButton();
}
function modeChanged(){setMode(mode.value)}
function selectedProject(){return projects.find(project=>String(project.id)===projectSelect.value)}
function refreshContacts(){
  const project=selectedProject(),contacts=project?.data?.kontakte||[];
  contactSelect.innerHTML='<option value="">Keinen Kontakt auswählen</option>'+contacts.map((contact,index)=>
    `<option value="${index}">${esc([contact.rolle,contact.vorname,contact.nachname].filter(Boolean).join(" – "))}</option>`
  ).join("");
}
function selectedTemplate(){return templates.find(template=>String(template.id)===templateSelect.value)}
function canonicalFieldKey(field){return field.key.includes(".")?field.key:`eingabe.${field.key}`}
function extractTemplateKeys(template){
  const keys=[],regex=/\{\{\s*([^}]+?)\s*\}\}/g;
  for(const text of [template?.subject||"",template?.body_html||template?.body||""]){
    let match;while((match=regex.exec(text))!==null)if(!keys.includes(match[1]))keys.push(match[1]);
  }
  for(const field of template?.fields||[]){
    const key=canonicalFieldKey(field);if(!keys.includes(key))keys.push(key);
  }
  return keys;
}
function definitionForKey(key,template){
  const catalog=variables.find(variable=>variable.key===key);
  if(catalog)return catalog;
  const oldField=(template?.fields||[]).find(field=>canonicalFieldKey(field)===key);
  if(oldField)return {key,label:oldField.label||key,type:oldField.type||"text",source:"manual",required:!!oldField.required};
  return {key,label:key,type:"text",source:"manual",required:false};
}
function automaticContext(){
  const project=mode.value==="project"?JSON.parse(JSON.stringify(selectedProject()?.data||{})):{};
  project.kontakt=mode.value==="project"&&contactSelect.value!==""?(project.kontakte||[])[Number(contactSelect.value)]||{}:{};
  project.benutzer={vorname:me?.first_name||"",nachname:me?.last_name||"",email:me?.email||""};
  return project;
}
// Email generation: every template field remains visible and editable.
function renderManualFields(){
  if(!manualFields)return;
  const template=selectedTemplate();manualFields.innerHTML="";if(!template){renderTemplateNotice(null);return}
  const context=automaticContext();
  const keys=extractTemplateKeys(template);
  if(!keys.includes("kontakt.email"))keys.unshift("kontakt.email");
  for(const key of keys){
    const definition=definitionForKey(key,template);
    const existing=getPath(context,key);
    const label=document.createElement("label");label.textContent=definition.label+(definition.required?" *":"");
    const input=createInput({...definition,key},"manual-input");input.value=existing||"";
    input.addEventListener("input",()=>{updatePlaceholderWarning();renderTemplateNotice(template)});
    label.appendChild(input);manualFields.appendChild(label);
  }
  updatePlaceholderWarning();renderTemplateNotice(template);
}
function renderTemplateNotice(template){
  const html=template?.notice_enabled?String(template?.notice_html||plainTextToHtml(template?.notice_text||"")).trim():"";
  templateNotice.hidden=!html;templateNoticeText.innerHTML=html?renderHtmlTemplate(html,currentEmailContext(),true):"";
  noticeAcknowledgeButton.textContent=template?.notice_button_label||"Hinweistext gesehen";
  noticeAcknowledgeButton.hidden=!html||template?.notice_mode!=="acknowledge"||noticeAcknowledged;
  updateOutputButtons();
}
function acknowledgeNotice(){noticeAcknowledged=true;noticeAcknowledgeButton.hidden=true;updateOutputButtons();toast("Hinweis wurde bestätigt.")}
function updateOutputButtons(){
  const template=selectedTemplate(),blocked=!!template?.notice_enabled&&!!template?.notice_text&&template.notice_mode==="acknowledge"&&!noticeAcknowledged;
  ["openMailtoButton","downloadEmlButton","copyResultButton"].forEach(id=>{const button=byId(id);if(button){button.classList.toggle("is-disabled",blocked);button.setAttribute("aria-disabled",String(blocked))}});
}
function currentEmailContext(){
  const context=automaticContext();
  document.querySelectorAll(".manual-input").forEach(input=>setPath(context,input.dataset.key,input.value));
  return context;
}
function updatePlaceholderWarning(){
  const template=selectedTemplate();if(!template){placeholderWarning.hidden=true;return}
  const context=currentEmailContext();
  placeholderWarning.hidden=!extractTemplateKeys(template).some(key=>!String(getPath(context,key)||"").trim());
}
function renderText(text,context,preserveMissing=false){
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g,(match,key)=>{
    const value=getPath(context,key);return value===undefined||value===null||value===""?(preserveMissing?match:""):value;
  });
}
function renderHtmlTemplate(html,context,preserveMissing=false){
  const rendered=String(html||"").replace(/\{\{\s*([^}]+?)\s*\}\}/g,(match,key)=>
    {
      const value=getPath(context,key);
      return esc(value===undefined||value===null||value===""?(preserveMissing?match:""):value).replace(/\r\n?|\n/g,"<br>");
    });
  return sanitizeEmailHtml(rendered);
}
function showTemplatePreview(){
  const template=selectedTemplate();
  if(resultTemplateName)resultTemplateName.value=template?.name||"";
  if(!template){
    resultTo.value=resultCc.value=resultSubject.value="";setEditorHtml(resultBody,"");resetEditorHistory(resultBody);
    renderTemplateNotice(null);placeholderWarning.hidden=true;updateSaveProjectEmailButton();return;
  }
  const context=currentEmailContext();
  resultTemplateName.value=template.name;resultTo.value=getPath(context,"kontakt.email")||"";
  resultSubject.value=renderText(template.subject,context,true);
  setEditorHtml(resultBody,renderHtmlTemplate(template.body_html||plainTextToHtml(template.body),context,true));
  resetEditorHistory(resultBody);
  updatePlaceholderWarning();
  updateSaveProjectEmailButton();
}
function generateEmail(){
  const template=selectedTemplate();if(!template)return toast("Bitte eine Vorlage wählen.");
  if(mode.value==="project"&&!selectedProject())return toast("Bitte ein Projekt wählen.");
  const context=automaticContext();
  for(const input of document.querySelectorAll(".manual-input"))setPath(context,input.dataset.key,input.value);
  const keys=extractTemplateKeys(template);
  if(!keys.includes("kontakt.email"))keys.unshift("kontakt.email");
  for(const key of keys){
    const definition=definitionForKey(key,template);
    if(definition.required&&!String(getPath(context,key)).trim())return toast("Pflichtfeld fehlt: "+definition.label);
  }
  resultTemplateName.value=template.name;resultTo.value=getPath(context,"kontakt.email")||"";
  resultSubject.value=renderText(template.subject,context);
  setEditorHtml(resultBody,renderHtmlTemplate(template.body_html||plainTextToHtml(template.body),context));
  resetEditorHistory(resultBody);
  updatePlaceholderWarning();
  emailGenerated=true;updateSaveProjectEmailButton();
}
function updateSaveProjectEmailButton(){
  if(saveProjectEmailButton)saveProjectEmailButton.hidden=!(emailGenerated&&mode.value==="project"&&selectedProject()&&selectedTemplate());
}
async function saveEmailToProject(){
  const project=selectedProject(),template=selectedTemplate();
  if(!project||!template||!emailGenerated)return toast("Die E-Mail muss zuerst mit einem gespeicherten Projekt erzeugt werden.");
  try{
    await api(`/api/projects/${project.id}/emails`,{method:"POST",body:JSON.stringify({
      template_id:template.id,template_name:template.name,recipient:resultTo.value,cc:resultCc.value,
      subject:resultSubject.value,body_text:getEditorText(resultBody),body_html:getEditorHtml(resultBody)
    })});
    toast("E-Mail wurde im Projekt gespeichert.");
    if(currentProjectDetailId===project.id)await loadProjectWorkspace(project.id);
  }catch(error){toast(error.message)}
}
// Output actions share one notice guard before mailto, EML or clipboard handling.
function mailtoEncode(value){return encodeURIComponent(value||"").replace(/%0A/g,"%0D%0A")}
function runOutputAction(action){
  const template=selectedTemplate(),hasNotice=!!template?.notice_enabled&&!!String(template?.notice_text||"").trim();
  if(hasNotice&&template.notice_mode==="acknowledge"&&!noticeAcknowledged){noticeRequiredDialog.showModal();return}
  if(hasNotice&&template.notice_mode==="dialog"){
    pendingNoticeAction=action;noticeActionText.innerHTML=renderHtmlTemplate(template.notice_html||plainTextToHtml(template.notice_text),currentEmailContext(),true);noticeActionDialog.showModal();return;
  }
  executeOutputAction(action);
}
function confirmNoticeAction(){
  const action=pendingNoticeAction;pendingNoticeAction=null;noticeActionDialog.close();if(action)executeOutputAction(action);
}
function cancelNoticeAction(){pendingNoticeAction=null;noticeActionDialog.close()}
async function executeOutputAction(action,imagesConfirmed=false){
  if(!imagesConfirmed&&action!=="eml"&&resultBody.querySelector("img")){
    pendingImageExportAction=action;byId("imageExportDialog").showModal();return;
  }
  const template=selectedTemplate();
  if(template){
    const projectId=mode.value==="project"&&projectSelect.value?Number(projectSelect.value):null;
    try{await api("/api/usage",{method:"POST",body:JSON.stringify({template_id:template.id,project_id:projectId,output_method:action})})}catch(error){}
  }
  if(action==="mailto")openMailto();else if(action==="eml")await downloadEml();else if(action==="copy")await copyResult();
}
function openMailto(){
  const query=[];
  if(resultCc.value)query.push("cc="+mailtoEncode(resultCc.value));
  query.push("subject="+mailtoEncode(resultSubject.value));
  query.push("body="+mailtoEncode(getEditorText(resultBody)));
  location.href=`mailto:${mailtoEncode(resultTo.value)}?${query.join("&")}`;
}
async function downloadEml(){
  // One server-side MIME implementation serves result and template exports.
  // The server revalidates pixels and embeds CID parts without sending mail.
  try{
    const response=await fetch("/api/email/eml",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":csrfToken},body:JSON.stringify({
      recipient:resultTo.value,cc:resultCc.value,subject:resultSubject.value,body_html:getEditorHtml(resultBody)
    })});
    if(!response.ok){const error=await response.json();throw Error(error.error||"EML-Export fehlgeschlagen.")}
    downloadBlob(await response.blob(),(resultSubject.value||"E-Mail").replace(/[\\/:*?"<>|]/g,"_")+".eml");
  }catch(error){toast(error.message)}
}
function downloadBlob(blob,name){
  const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}
async function copyResult(){
  const html=getEditorHtml(resultBody),text=getEditorText(resultBody);
  try{
    if(resultBody.querySelector("img")){
      await navigator.clipboard.writeText(text);toast("E-Mailtext ohne Bilder kopiert.");return;
    }
    if(window.ClipboardItem&&navigator.clipboard.write){
      await navigator.clipboard.write([new ClipboardItem({
        "text/html":new Blob([html],{type:"text/html"}),
        "text/plain":new Blob([text],{type:"text/plain"})
      })]);
    }else await navigator.clipboard.writeText(text);
    toast("Nur der formatierte E-Mailtext wurde kopiert.");
  }catch(error){
    try{await navigator.clipboard.writeText(text);toast("Nur der E-Mailtext wurde kopiert.")}
    catch(fallbackError){toast("Der Text konnte nicht kopiert werden.")}
  }
}

// Document generation lives in documents.js; shared file reading also serves XLSX imports.
function fileAsBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file)})}
function renderDocumentBlockList(){const container=byId("documentBlockList");if(!container)return;container.innerHTML=documentBlocks.map(item=>`<button class="list-row" onclick="editDocumentBlock(${item.id})"><span><b>${esc(item.name)}</b><small>{{baustein.${esc(item.key)}}}${item.category?` · ${esc(item.category)}`:""}</small></span><span class="status-pill ${item.active?"active":"inactive"}">${item.active?"aktiv":"inaktiv"}</span></button>`).join("")||"<p class='muted'>Noch keine Textbausteine vorhanden.</p>"}
function newDocumentBlock(){editingDocumentBlockId=null;["documentBlockId","documentBlockName","documentBlockKey","documentBlockCategory","documentBlockContent"].forEach(id=>byId(id).value="");byId("documentBlockActive").checked=true;byId("deleteDocumentBlockButton").hidden=true;byId("documentBlockFormTitle").textContent="Textbaustein anlegen"}
function editDocumentBlock(id){const item=documentBlocks.find(entry=>entry.id===Number(id));if(!item)return;editingDocumentBlockId=item.id;byId("documentBlockId").value=item.id;byId("documentBlockName").value=item.name;byId("documentBlockKey").value=item.key;byId("documentBlockCategory").value=item.category;byId("documentBlockContent").value=item.content;byId("documentBlockActive").checked=item.active;byId("deleteDocumentBlockButton").hidden=false;byId("documentBlockFormTitle").textContent="Textbaustein bearbeiten"}
async function saveDocumentBlock(){const payload={name:byId("documentBlockName").value,key:byId("documentBlockKey").value,category:byId("documentBlockCategory").value,content:byId("documentBlockContent").value,active:byId("documentBlockActive").checked};try{await api(editingDocumentBlockId?`/api/document-blocks/${editingDocumentBlockId}`:"/api/document-blocks",{method:editingDocumentBlockId?"PUT":"POST",body:JSON.stringify(payload)});newDocumentBlock();await loadDocumentModule();toast("Textbaustein gespeichert.")}catch(error){toast(error.message)}}
async function deleteDocumentBlock(){if(!editingDocumentBlockId)return;try{await api(`/api/document-blocks/${editingDocumentBlockId}`,{method:"DELETE"});newDocumentBlock();await loadDocumentModule();toast("Textbaustein gelöscht.")}catch(error){toast(error.message)}}

// Bieterfragen module: project documentation and reusable standard answers are
// deliberately stored separately. This avoids changing a project record when
// a reusable answer is edited later.
let editingBidQuestionId=null;
async function loadBidders(){try{const data=await api("/api/bidders");bidders=data.bidders||[];updateBidFilterOptions();updateSingleBidderButton();renderBidderDirectory()}catch(error){toast(error.message)}}
async function loadBidModule(){
  try{
    const requests=[api("/api/bid/categories"),api("/api/bid/topics"),api("/api/bid/answers"),api("/api/bidders")];
    if(hasPermission("bid_questions_view")||hasPermission("bid_questions_manage"))requests.push(api("/api/bid/questions"));
    const [categoryData,topicData,answerData,bidderData,questionData]=await Promise.all(requests);
    bidCategories=categoryData.categories||[];bidTopics=topicData.topics||[];bidAnswers=answerData.answers||[];bidders=bidderData.bidders||[];bidQuestions=questionData?.questions||[];
    updateBidProjectOptions();updateBidFilterOptions();updateBidTaxonomyOptions();updateSingleBidTaxonomyButtons();updateSingleBidderButton();renderBidQuestionList();renderBidAnswerLibrary();renderBidTaxonomy();renderBidBatchRows();renderBidderDirectory();
  }catch(error){toast(error.message)}
}

function updateBidFilterOptions(){
  if(bidQuestionCategoryFilter){const before=bidQuestionCategoryFilter.value,names=[...new Set([...bidCategories.map(item=>item.name),...bidQuestions.map(item=>item.category).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"de"));bidQuestionCategoryFilter.innerHTML='<option value="">Alle Kategorien</option>'+names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join("");bidQuestionCategoryFilter.value=names.includes(before)?before:""}
  if(bidQuestionBidderFilter){const before=bidQuestionBidderFilter.value,names=[...new Set([...bidders.map(item=>item.bidder),...bidQuestions.map(item=>item.bidder).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"de"));bidQuestionBidderFilter.innerHTML='<option value="">Alle Bieter</option>'+names.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join("");bidQuestionBidderFilter.value=names.includes(before)?before:""}
}
function activeProjects(){return projects.filter(project=>!project.archived)}
function updateBidProjectOptions(){
  const options=activeProjects().map(project=>`<option value="${project.id}">${esc(project.project_key)} – ${esc(project.name)}</option>`).join("");
  if(bidQuestionProjectFilter){const before=bidQuestionProjectFilter.value;bidQuestionProjectFilter.innerHTML='<option value="">Alle Projekte</option>'+options;bidQuestionProjectFilter.value=activeProjects().some(project=>String(project.id)===before)?before:""}
  updateBidProjectButton("single");updateBidProjectButton("batch");updateBidProjectButton("import");
}
function bidProjectTargetElements(target){
  if(target==="batch")return {input:bidBatchProject,button:bidBatchProjectButton};
  if(target==="import")return {input:bidImportProject,button:bidImportProjectButton};
  return {input:bidQuestionProject,button:byId("bidQuestionProjectButton")};
}
function updateBidProjectButton(target){
  const {input,button}=bidProjectTargetElements(target);if(!input||!button)return;
  const project=projects.find(item=>String(item.id)===input.value);
  button.textContent=project?`${project.project_key} – ${project.name}`:"Projekt auswählen...";
  button.classList.toggle("has-selection",!!project);
}
function openBidProjectPicker(target){
  activeBidProjectTarget=target;bidProjectPickerSearch.value="";renderBidProjectPickerResults();bidProjectPickerDialog.showModal();bidProjectPickerSearch.focus();
}
function renderBidProjectPickerResults(){
  const filtered=activeProjects().filter(project=>projectMatches(project,bidProjectPickerSearch.value));
  bidProjectPickerResults.innerHTML=filtered.length?filtered.map(project=>`<button type="button" onclick="chooseBidProject(${project.id})"><b>${esc(project.project_key)}</b><span>${esc(project.name)}</span></button>`).join(""):"<p class='muted'>Keine passenden Projekte gefunden.</p>";
}
function chooseBidProject(id){
  const {input}=bidProjectTargetElements(activeBidProjectTarget);if(input)input.value=String(id);
  updateBidProjectButton(activeBidProjectTarget);bidProjectPickerDialog.close();
}
function openBidderPicker(target,rowId=null){activeBidderTarget=target;activeBatchRowId=rowId;bidderPickerSearch.value="";renderBidderPickerResults();bidderPickerDialog.showModal();bidderPickerSearch.focus()}
function renderBidderPickerResults(){
  const needle=bidderPickerSearch.value.trim().toLocaleLowerCase("de");
  const filtered=bidders.filter(item=>item.active&&(!needle||[item.bidder,item.company_name,item.street,item.postal_code,item.city,item.country].join(" ").toLocaleLowerCase("de").includes(needle)));
  bidderPickerResults.innerHTML=filtered.length?filtered.map(item=>`<button type="button" onclick="chooseBidder(${item.id})"><b>${esc(item.bidder)}</b><span>${esc([item.company_name,item.city].filter(Boolean).join(" · "))}</span></button>`).join(""):"<p class='muted'>Keine passenden Bieter gefunden.</p>";
}
function chooseBidder(id){
  const bidder=bidders.find(item=>item.id===Number(id));if(!bidder)return;
  if(activeBidderTarget==="single"){byId("bidQuestionBidderId").value=String(bidder.id);updateSingleBidderButton()}
  else{const row=bidBatchItems.find(item=>item.id===activeBatchRowId);if(row){row.bidder_id=bidder.id;row.bidder=bidder.bidder}renderBidBatchRows()}
  bidderPickerDialog.close();
}
async function createQuickBidder(){const name=byId("quickBidderName").value.trim();if(!name)return toast("Bitte einen Bieternamen eingeben.");try{const data=await api("/api/bidders",{method:"POST",body:JSON.stringify({bidder:name,company_name:byId("quickBidderCompany").value,active:true})});await loadBidders();byId("quickBidderName").value=byId("quickBidderCompany").value="";chooseBidder(data.id);toast("Bieter wurde angelegt.")}catch(error){toast(error.message)}}
function updateSingleBidderButton(){const bidder=bidders.find(item=>String(item.id)===byId("bidQuestionBidderId")?.value),button=byId("bidQuestionBidderButton");if(!button)return;button.textContent=bidder?.bidder||"Bieter auswählen...";button.classList.toggle("has-selection",!!bidder)}

function renderBidderDirectory(){
  if(!bidderDirectoryList)return;const needle=String(bidderDirectorySearch?.value||"").trim().toLocaleLowerCase("de");
  const matching=bidders.filter(item=>!needle||[item.bidder,item.company_name,item.street,item.postal_code,item.city,item.country,item.website,item.comment].join(" ").toLocaleLowerCase("de").includes(needle));
  bidderDirectoryList.classList.remove("bidder-directory-grid");
  bidderDirectoryList.classList.add("bidder-table-wrapper");
  bidderDirectoryList.innerHTML=matching.length?`<table class="bidder-table"><caption class="visually-hidden">Bieterverzeichnis</caption><thead><tr>${["Bieter","Firmenname","Straße","PLZ","Ort","Land","Website","Kommentar","Status",...(hasPermission("projects_manage")?["Aktionen"]:[])].map(label=>`<th scope="col">${label}</th>`).join("")}</tr></thead><tbody>${matching.map(item=>{
    const url=safeLinkUrl(item.website);
    return `<tr><th scope="row"><button type="button" class="text-button" onclick="viewBidder(${item.id})">${esc(item.bidder)}</button></th>${[item.company_name,item.street,item.postal_code,item.city,item.country].map(value=>`<td>${esc(value||"–")}</td>`).join("")}<td>${/^https?:\/\//i.test(url)?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(item.website)}</a>`:esc(item.website||"–")}</td><td class="bidder-comment">${esc(item.comment||"–")}</td><td><span class="status-pill ${item.active?"active":"inactive"}">${item.active?"aktiv":"inaktiv"}</span></td>${hasPermission("projects_manage")?`<td><button type="button" title="Bieter bearbeiten" aria-label="Bieter bearbeiten" onclick="editBidder(${item.id})">${menuIcon("edit")}</button></td>`:""}</tr>`;
  }).join("")}</tbody></table>`:"<p class='muted'>Keine Bieter gefunden.</p>";
}
function newBidder(){editingBidderId=null;["bidderId","bidderName","bidderCompany","bidderStreet","bidderPostalCode","bidderCity","bidderCountry","bidderWebsite","bidderComment"].forEach(id=>byId(id).value="");byId("bidderActive").checked=true;byId("deleteBidderButton").hidden=true}
function editBidder(id){const item=bidders.find(entry=>entry.id===Number(id));if(!item||!hasPermission("projects_manage"))return;editingBidderId=item.id;byId("bidderId").value=item.id;byId("bidderName").value=item.bidder;byId("bidderCompany").value=item.company_name;byId("bidderStreet").value=item.street;byId("bidderPostalCode").value=item.postal_code;byId("bidderCity").value=item.city;byId("bidderCountry").value=item.country;byId("bidderWebsite").value=item.website;byId("bidderComment").value=item.comment||"";byId("bidderActive").checked=item.active;byId("deleteBidderButton").hidden=false;switchTab("bidder-create")}
function bidderFormPayload(){return {bidder:byId("bidderName").value,company_name:byId("bidderCompany").value,street:byId("bidderStreet").value,postal_code:byId("bidderPostalCode").value,city:byId("bidderCity").value,country:byId("bidderCountry").value,website:byId("bidderWebsite").value,comment:byId("bidderComment").value,active:byId("bidderActive").checked}}
async function saveBidder(){try{const id=editingBidderId;if(id)await api(`/api/bidders/${id}`,{method:"PUT",body:JSON.stringify(bidderFormPayload())});else await api("/api/bidders",{method:"POST",body:JSON.stringify(bidderFormPayload())});newBidder();await loadBidders();toast("Bieter gespeichert.")}catch(error){toast(error.message)}}
async function deleteBidder(){if(!editingBidderId)return;try{await api(`/api/bidders/${editingBidderId}`,{method:"DELETE"});newBidder();await loadBidders();toast("Bieter gelöscht.")}catch(error){toast(error.message)}}
function parseBidderImport(){const raw=byId("bidderImportText").value.trim();if(!raw)return [];if(raw.startsWith("{")||raw.startsWith("[")){const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:(parsed.bidders||[parsed])}const lines=raw.replace(/\r/g,"").split("\n").filter(Boolean),delimiter=lines.some(line=>line.includes("\t"))?"\t":";";const rows=lines.map(line=>parseDelimitedLine(line,delimiter));if(rows[0]?.[0]?.toLocaleLowerCase("de").includes("bieter"))rows.shift();return rows.map(row=>({bidder:row[0]||"",company_name:row[1]||"",street:row[2]||"",postal_code:row[3]||"",city:row[4]||"",country:row[5]||"",website:row[6]||"",comment:row[7]||""}))}
async function importBidders(){try{const items=parseBidderImport();if(!items.length)return toast("Keine Bieter erkannt.");const data=await api("/api/bidders/import",{method:"POST",body:JSON.stringify({bidders:items})});byId("bidderImportText").value="";await loadBidders();toast(`${data.saved} Bieter gespeichert.`)}catch(error){toast(error.message)}}
function downloadBidderExampleJson(){location.href="/api/bidders/example-json"}
function bidQuestionMatches(item,needle){
  const search=String(needle||"").trim().toLocaleLowerCase("de");
  if(!search)return true;
  const selected=Array.from(document.querySelectorAll("[data-bid-search-field]:checked")).map(input=>input.dataset.bidSearchField);
  return selected.some(field=>String(item[field]||"").toLocaleLowerCase("de").includes(search));
}
function bidQuestionStatus(item){
  if(item.answered_at)return "beantwortet";
  if(String(item.answer||"").trim())return "Antwort erstellt";
  const decision=String(item.decision||"").trim().toLocaleLowerCase("de");
  return decision&&!["offen","ausstehend","noch offen","-"].includes(decision)?"entschieden":"offen";
}
function renderBidQuestionList(){
  if(!bidQuestionList)return;
  const projectId=Number(bidQuestionProjectFilter?.value)||0;
  const categoryName=bidQuestionCategoryFilter?.value||"",bidderName=bidQuestionBidderFilter?.value||"";
  const filtered=bidQuestions.filter(item=>(!projectId||item.project_id===projectId)&&(!categoryName||item.category===categoryName)&&(!bidderName||item.bidder===bidderName)&&bidQuestionMatches(item,bidQuestionSearch?.value));
  bidQuestionList.innerHTML=filtered.length?filtered.map(item=>`<article class="bid-question-card">
    <header><button type="button" class="text-button" onclick="openBidQuestion(${item.id})"><b>${esc(item.project_key)} – ${esc(item.project_name)}</b></button><span class="bid-status ${item.answered_at?"done":""}">${bidQuestionStatus(item)}</span></header>
    <div class="bid-question-lines">
      ${bidOverviewLine("Fragenkategorie",item.category||"—")}${bidOverviewLine("Bieter",item.bidder||"—")}${bidOverviewLine("Thema",item.subject||"—")}
      ${bidOverviewLine("Bieterfrage",item.question)}${bidOverviewLine("Kommentar Agentur Wieseke",item.agency_comment||"—")}${bidOverviewLine("Entscheidung",item.decision||"—")}${bidOverviewLine("Antwort",item.answer||"—")}
    </div>
    <footer><button type="button" onclick="openBidQuestion(${item.id})">Öffnen</button>${hasPermission("bid_questions_manage")&&item.answer&&!item.answered_at?`<button type="button" class="success-button" onclick="acknowledgeBidQuestion(${item.id})">Beantwortung quittieren</button>`:""}</footer>
  </article>`).join(""):"<p class='muted'>Keine passenden Bieterfragen gefunden.</p>";
}
function bidOverviewLine(label,value){return `<div><b>${esc(label)}</b><span>${esc(value).replace(/\n/g,"<br>")}</span></div>`}
function bidDetailField(label,value){return `<section><h4>${esc(label)}</h4><div>${esc(value||"—").replace(/\n/g,"<br>")}</div></section>`}
function openBidQuestion(id){
  const item=bidQuestions.find(question=>question.id===Number(id))||(currentProjectWorkspace.bid_questions||[]).find(question=>question.id===Number(id));if(!item)return;
  byId("bidQuestionDialogTitle").textContent=item.subject||"Bieterfrage";
  byId("bidQuestionDialogMeta").textContent=`${item.project_key} – ${item.project_name} · ${item.category||"Ohne Kategorie"} · ${item.bidder||"Bieter nicht angegeben"}`;
  byId("bidQuestionDialogContent").innerHTML=bidDetailField("Bieterfrage",item.question)+bidDetailField("Kommentar Agentur Wieseke",item.agency_comment)+bidDetailField("Entscheidung",item.decision)+bidDetailField("Antwort",item.answer);
  byId("bidQuestionDialogActions").innerHTML=hasPermission("bid_questions_manage")?`${item.answer&&!item.answered_at?`<button type="button" class="success-button" onclick="acknowledgeBidQuestion(${item.id})">Beantwortung quittieren</button>`:""}<button type="button" onclick="editBidQuestion(${item.id})">Bearbeiten</button><button type="button" class="danger" onclick="deleteBidQuestion(${item.id})">Bieterfrage löschen</button>`:"";
  bidQuestionDialog.showModal();
}
async function acknowledgeBidQuestion(id){
  try{await api(`/api/bid/questions/${id}/acknowledge`,{method:"PUT",body:"{}"});if(bidQuestionDialog.open)bidQuestionDialog.close();await loadBidModule();if(currentProjectDetailId)await loadProjectWorkspace(currentProjectDetailId);toast("Beantwortung wurde quittiert.")}catch(error){toast(error.message)}
}
function clearBidQuestionForm(){
  editingBidQuestionId=null;["bidQuestionProject","bidQuestionCategoryId","bidQuestionTopicId","bidQuestionBidderId","bidQuestionStandardAnswerId","bidQuestionStandardVariantId","bidQuestionText","bidQuestionComment","bidQuestionDecision","bidQuestionAnswer"].forEach(id=>byId(id).value="");
  setCurrentBidYear("bidQuestionYear");updateBidProjectButton("single");updateSingleBidTaxonomyButtons();updateSingleBidderButton();
}
function setCurrentBidYear(id){const input=byId(id);if(input)input.value=String(new Date().getFullYear())}
async function saveBidQuestion(){
  const categoryId=Number(byId("bidQuestionCategoryId").value)||null,topicId=Number(byId("bidQuestionTopicId").value)||null;
  const category=bidCategories.find(item=>item.id===categoryId),topic=bidTopics.find(item=>item.id===topicId);
  const bidderId=Number(byId("bidQuestionBidderId").value)||null,bidder=bidders.find(item=>item.id===bidderId);
  const payload={project_id:Number(bidQuestionProject.value),question_year:Number(byId("bidQuestionYear").value),category_id:categoryId,topic_id:topicId,bidder_id:bidderId,standard_answer_id:Number(byId("bidQuestionStandardAnswerId").value)||null,standard_variant_id:Number(byId("bidQuestionStandardVariantId").value)||null,category:category?.name||"",bidder:bidder?.bidder||"",subject:topic?.name||"",question:byId("bidQuestionText").value,agency_comment:byId("bidQuestionComment").value,decision:byId("bidQuestionDecision").value,answer:byId("bidQuestionAnswer").value};
  try{
    if(editingBidQuestionId)await api(`/api/bid/questions/${editingBidQuestionId}`,{method:"PUT",body:JSON.stringify(payload)});
    else await api("/api/bid/questions",{method:"POST",body:JSON.stringify(payload)});
    toast(editingBidQuestionId?"Bieterfrage aktualisiert.":"Bieterfrage gespeichert.");clearBidQuestionForm();await loadBidModule();
  }catch(error){toast(error.message)}
}
function editBidQuestion(id){
  const item=bidQuestions.find(question=>question.id===Number(id))||(currentProjectWorkspace.bid_questions||[]).find(question=>question.id===Number(id));if(!item)return;
  const matchedCategory=bidCategories.find(category=>category.id===item.category_id||category.name===item.category),matchedTopic=bidTopics.find(topic=>topic.id===item.topic_id||(topic.name===item.subject&&(!matchedCategory||topic.category_id===matchedCategory.id)));
  editingBidQuestionId=item.id;bidQuestionProject.value=String(item.project_id);byId("bidQuestionCategoryId").value=String(matchedCategory?.id||matchedTopic?.category_id||"");byId("bidQuestionTopicId").value=String(matchedTopic?.id||"");byId("bidQuestionBidderId").value=String(item.bidder_id||bidders.find(entry=>entry.bidder===item.bidder)?.id||"");byId("bidQuestionStandardAnswerId").value=String(item.standard_answer_id||"");byId("bidQuestionStandardVariantId").value=String(item.standard_variant_id||"");byId("bidQuestionText").value=item.question;byId("bidQuestionComment").value=item.agency_comment;byId("bidQuestionDecision").value=["zugelassen","abgelehnt"].includes(item.decision)?item.decision:"";byId("bidQuestionAnswer").value=item.answer;
  byId("bidQuestionYear").value=String(item.question_year||new Date().getFullYear());
  updateBidProjectButton("single");updateSingleBidTaxonomyButtons();updateSingleBidderButton();
  bidQuestionDialog.close();switchTab("bid-question-create");
}
async function deleteBidQuestion(id){
  try{await api(`/api/bid/questions/${id}`,{method:"DELETE"});bidQuestionDialog.close();await loadBidModule();if(currentProjectDetailId)await loadProjectWorkspace(currentProjectDetailId);toast("Bieterfrage gelöscht.")}catch(error){toast(error.message)}
}
function updateSingleBidTaxonomyButtons(){
  const category=bidCategories.find(item=>String(item.id)===byId("bidQuestionCategoryId").value),topic=bidTopics.find(item=>String(item.id)===byId("bidQuestionTopicId").value);
  const categoryButton=byId("bidQuestionCategoryButton"),topicButton=byId("bidQuestionTopicButton");
  categoryButton.textContent=category?.name||"Fragenkategorie auswählen...";categoryButton.classList.toggle("has-selection",!!category);
  topicButton.textContent=topic?.name||"Thema auswählen...";topicButton.classList.toggle("has-selection",!!topic);
}
function openBidTaxonomyPicker(type,target,rowId=null){
  activeBidTaxonomyType=type;activeBidTaxonomyTarget=target;activeBatchRowId=rowId;bidTaxonomyPickerSearch.value="";byId("bidTaxonomyCreateName").value="";
  byId("bidTaxonomyPickerTitle").textContent=type==="category"?"Fragenkategorie auswählen":"Thema auswählen";
  byId("bidTaxonomyPickerHint").textContent=type==="category"?"Vorhandene Kategorie auswählen oder direkt eine neue anlegen.":"Vorhandenes Thema auswählen oder direkt ein neues Thema anlegen.";
  byId("bidTaxonomyCreateTitle").textContent=type==="category"?"Neue Fragenkategorie":"Neues Thema";
  byId("bidTaxonomyCreateCategoryWrap").hidden=type!=="topic";
  const currentCategory=target==="single"?Number(byId("bidQuestionCategoryId").value):target==="answer-form"?Number(bidTopics.find(item=>String(item.id)===bidAnswerTopic.value)?.category_id):Number(bidBatchItems.find(item=>item.id===rowId)?.category_id);
  byId("bidTaxonomyCreateCategory").innerHTML='<option value="">Kategorie auswählen...</option>'+bidCategories.filter(item=>item.active).map(item=>`<option value="${item.id}">${esc(item.name)}</option>`).join("");
  if(currentCategory)byId("bidTaxonomyCreateCategory").value=String(currentCategory);
  renderBidTaxonomyPickerResults();bidTaxonomyPickerDialog.showModal();bidTaxonomyPickerSearch.focus();
}
function renderBidTaxonomyPickerResults(){
  const needle=bidTaxonomyPickerSearch.value.trim().toLocaleLowerCase("de");
  let items=activeBidTaxonomyType==="category"?bidCategories.filter(item=>item.active):bidTopics.filter(item=>item.active);
  if(activeBidTaxonomyType==="topic"){
    const categoryId=activeBidTaxonomyTarget==="single"?Number(byId("bidQuestionCategoryId").value):activeBidTaxonomyTarget==="answer-form"?0:Number(bidBatchItems.find(item=>item.id===activeBatchRowId)?.category_id);
    if(categoryId)items=items.filter(item=>item.category_id===categoryId);
  }
  items=items.filter(item=>!needle||item.name.toLocaleLowerCase("de").includes(needle));
  if(activeBidTaxonomyType==="topic"&&activeBidTaxonomyTarget==="answer-form")bidTaxonomyPickerResults.innerHTML=bidCategories.map(category=>{const topics=items.filter(item=>item.category_id===category.id);return topics.length?`<section class="picker-hierarchy"><h3>${esc(category.name)}</h3>${topics.map(item=>`<button type="button" onclick="chooseBidTaxonomy(${item.id})"><b>${esc(item.name)}</b></button>`).join("")}</section>`:""}).join("")||"<p class='muted'>Keine passenden Themen gefunden.</p>";
  else bidTaxonomyPickerResults.innerHTML=items.length?items.map(item=>`<button type="button" onclick="chooseBidTaxonomy(${item.id})"><b>${esc(item.name)}</b>${activeBidTaxonomyType==="topic"?`<span>${esc(bidCategories.find(category=>category.id===item.category_id)?.name||"")}</span>`:""}</button>`).join(""):"<p class='muted'>Keine passenden Einträge gefunden.</p>";
}
function chooseBidTaxonomy(id){
  const item=(activeBidTaxonomyType==="category"?bidCategories:bidTopics).find(entry=>entry.id===Number(id));if(!item)return;
  if(activeBidTaxonomyTarget==="single"){
    if(activeBidTaxonomyType==="category"){byId("bidQuestionCategoryId").value=String(item.id);const topic=bidTopics.find(entry=>String(entry.id)===byId("bidQuestionTopicId").value);if(topic&&topic.category_id!==item.id)byId("bidQuestionTopicId").value=""}
    else{byId("bidQuestionTopicId").value=String(item.id);byId("bidQuestionCategoryId").value=String(item.category_id)}
    updateSingleBidTaxonomyButtons();
  }else if(activeBidTaxonomyTarget==="answer-form"){
    bidAnswerTopic.value=String(item.id);updateBidAnswerTopicButton();
  }else{
    const row=bidBatchItems.find(entry=>entry.id===activeBatchRowId);if(!row)return;
    if(activeBidTaxonomyType==="category"){row.category_id=item.id;if(row.topic_id&&!bidTopics.some(topic=>topic.id===row.topic_id&&topic.category_id===item.id))row.topic_id=null}
    else{row.topic_id=item.id;row.category_id=item.category_id}
    renderBidBatchRows();
  }
  bidTaxonomyPickerDialog.close();
}
async function createFromBidTaxonomyPicker(){
  const name=byId("bidTaxonomyCreateName").value.trim();if(!name)return toast("Bitte eine Bezeichnung eingeben.");
  try{
    let data;if(activeBidTaxonomyType==="category")data=await api("/api/bid/categories",{method:"POST",body:JSON.stringify({name,active:true})});
    else{const categoryId=Number(byId("bidTaxonomyCreateCategory").value);if(!categoryId)return toast("Bitte eine Kategorie auswählen.");data=await api("/api/bid/topics",{method:"POST",body:JSON.stringify({category_id:categoryId,name,active:true})})}
    await loadBidModule();chooseBidTaxonomy(data.id);toast(activeBidTaxonomyType==="category"?"Kategorie angelegt.":"Thema angelegt.");
  }catch(error){toast(error.message)}
}
function openStandardAnswerPicker(target,mode="answer",rowId=null){activeStandardAnswerTarget=target;activeStandardAnswerMode=mode;activeBatchRowId=rowId;standardAnswerPickerSearch.value="";renderStandardAnswerPickerResults();standardAnswerPickerDialog.showModal();standardAnswerPickerSearch.focus()}
function renderStandardAnswerPickerResults(){
  const needle=standardAnswerPickerSearch.value,linkedId=activeStandardAnswerTarget==="single"?Number(byId("bidQuestionStandardAnswerId").value):Number(bidBatchItems.find(item=>item.id===activeBatchRowId)?.standard_answer_id),matching=bidAnswers.filter(answer=>(needle||activeStandardAnswerMode==="comment"||!linkedId||answer.id===linkedId)&&answerMatches(answer,needle));
  const decision=activeStandardAnswerTarget==="single"?byId("bidQuestionDecision").value:(bidBatchItems.find(item=>item.id===activeBatchRowId)?.decision||"");
  standardAnswerPickerResults.innerHTML=matching.length?matching.map(answer=>{const variants=(answer.variants||[]).filter(item=>!decision||item.decision===decision);return `<article class="standard-answer-picker-card"><div><b>${esc(answer.short_question)}</b><small>${esc(answer.category_name)} · ${esc(answer.topic_name)}</small>${answer.agency_comment?`<p><strong>Kommentar:</strong> ${esc(answer.agency_comment).replace(/\n/g,"<br>")}</p>`:""}</div>${activeStandardAnswerMode==="comment"?`<button type="button" class="primary" onclick="chooseStandardAnswer(${answer.id},null)">Kommentar übernehmen</button>`:`<div class="variant-picker-list">${variants.map(variant=>`<button type="button" onclick="chooseStandardAnswer(${answer.id},${variant.id})"><span class="decision-chip ${variant.decision}">${esc(variant.decision)}</span>${esc(variant.answer)}</button>`).join("")||"<p class='muted'>Keine Variante für diese Entscheidung.</p>"}</div>`}</article>`}).join(""):"<p class='muted'>Kein passender Antwortfall gefunden.</p>";
}
function chooseStandardAnswer(id,variantId=null){const answer=bidAnswers.find(item=>item.id===Number(id));if(!answer)return;const variant=(answer.variants||[]).find(item=>item.id===Number(variantId));if(activeStandardAnswerTarget==="single"){byId("bidQuestionStandardAnswerId").value=String(answer.id);byId("bidQuestionStandardVariantId").value=variant?String(variant.id):"";byId("bidQuestionComment").value=answer.agency_comment||byId("bidQuestionComment").value;if(variant){byId("bidQuestionAnswer").value=variant.answer;byId("bidQuestionDecision").value=variant.decision}byId("bidQuestionCategoryId").value=String(answer.category_id);byId("bidQuestionTopicId").value=String(answer.topic_id);updateSingleBidTaxonomyButtons()}else{const row=bidBatchItems.find(item=>item.id===activeBatchRowId);if(row){row.standard_answer_id=answer.id;row.standard_variant_id=variant?.id||null;row.agency_comment=answer.agency_comment||row.agency_comment;if(variant){row.answer=variant.answer;row.decision=variant.decision}row.category_id=answer.category_id;row.topic_id=answer.topic_id}renderBidBatchRows()}standardAnswerPickerDialog.close();toast(variant?"Antwortvariante und Verknüpfung übernommen.":"Kommentar und Verknüpfung übernommen.")}
function bidDecisionChanged(){const variantId=Number(byId("bidQuestionStandardVariantId").value),variant=bidAnswers.flatMap(item=>item.variants||[]).find(item=>item.id===variantId);if(variant&&variant.decision!==byId("bidQuestionDecision").value)byId("bidQuestionStandardVariantId").value=""}
function newBidBatchItem(){return {id:Date.now()+Math.random(),category_id:null,topic_id:null,bidder_id:null,bidder:"",question:"",agency_comment:"",decision:"",answer:"",standard_answer_id:null,standard_variant_id:null}}
function addBidBatchRow(){bidBatchItems.push(newBidBatchItem());renderBidBatchRows()}
function clearBidBatch(){setCurrentBidYear("bidBatchYear");bidBatchItems=[newBidBatchItem(),newBidBatchItem(),newBidBatchItem()];renderBidBatchRows()}
function removeBidBatchRow(id){bidBatchItems=bidBatchItems.filter(item=>item.id!==id);if(!bidBatchItems.length)addBidBatchRow();else renderBidBatchRows()}
function updateBidBatch(id,key,value){const row=bidBatchItems.find(item=>item.id===id);if(!row)return;row[key]=value;if(key==="decision"&&row.standard_variant_id){const variant=bidAnswers.flatMap(item=>item.variants||[]).find(item=>item.id===row.standard_variant_id);if(variant&&variant.decision!==value)row.standard_variant_id=null}}
function renderBidBatchRows(){
  if(!bidBatchRows)return;if(!bidBatchItems.length)clearBidBatch();
  bidBatchRows.innerHTML=bidBatchItems.map((row,index)=>{const category=bidCategories.find(item=>item.id===row.category_id),topic=bidTopics.find(item=>item.id===row.topic_id);return `<article class="bid-batch-row"><header><b>Zeile ${index+1}</b><button type="button" class="icon-only danger" title="Zeile entfernen" onclick="removeBidBatchRow(${row.id})">×</button></header><div class="bid-batch-grid">
    <label>Kategorie<button type="button" class="select-button ${category?"has-selection":""}" onclick="openBidTaxonomyPicker('category','batch',${row.id})">${esc(category?.name||"Auswählen...")}</button></label>
    <label>Thema<button type="button" class="select-button ${topic?"has-selection":""}" onclick="openBidTaxonomyPicker('topic','batch',${row.id})">${esc(topic?.name||"Auswählen...")}</button></label>
    <label>Bieter<button type="button" class="select-button ${row.bidder_id?"has-selection":""}" onclick="openBidderPicker('batch',${row.id})">${esc(row.bidder||"Bieter auswählen...")}</button></label>
    <label>Entscheidung<select onchange="updateBidBatch(${row.id},'decision',this.value)"><option value="" ${!row.decision?"selected":""}>Noch offen</option><option value="zugelassen" ${row.decision==="zugelassen"?"selected":""}>zugelassen</option><option value="abgelehnt" ${row.decision==="abgelehnt"?"selected":""}>abgelehnt</option></select></label>
    <label class="wide">Bieterfrage<textarea rows="3" oninput="updateBidBatch(${row.id},'question',this.value)">${esc(row.question)}</textarea></label>
    <label class="wide">Kommentar Agentur Wieseke<div class="answer-input-head"><span>Kommentar</span><button type="button" onclick="openStandardAnswerPicker('batch','comment',${row.id})">Kommentar auswählen</button></div><textarea rows="3" oninput="updateBidBatch(${row.id},'agency_comment',this.value)">${esc(row.agency_comment)}</textarea></label>
    <label class="wide">Antwort<div class="answer-input-head"><span>Antworttext</span><button type="button" onclick="openStandardAnswerPicker('batch','answer',${row.id})">Antwortvariante</button></div><textarea rows="4" oninput="updateBidBatch(${row.id},'answer',this.value)">${esc(row.answer)}</textarea></label>
  </div></article>`}).join("");
}
async function saveBidBatch(){
  const projectId=Number(bidBatchProject.value);if(!projectId)return toast("Bitte ein Projekt auswählen.");
  const usable=bidBatchItems.filter(item=>item.question.trim()||item.bidder.trim()||item.answer.trim());if(!usable.length)return toast("Bitte mindestens eine Bieterfrage erfassen.");
  if(usable.some(item=>!item.question.trim()))return toast("Jede ausgefüllte Zeile benötigt eine Bieterfrage.");
  const questions=usable.map(item=>{const category=bidCategories.find(entry=>entry.id===item.category_id),topic=bidTopics.find(entry=>entry.id===item.topic_id);return {project_id:projectId,question_year:Number(byId("bidBatchYear").value),category_id:item.category_id,topic_id:item.topic_id,bidder_id:item.bidder_id,standard_answer_id:item.standard_answer_id,standard_variant_id:item.standard_variant_id,category:category?.name||"",subject:topic?.name||"",bidder:item.bidder,question:item.question,agency_comment:item.agency_comment,decision:item.decision,answer:item.answer}});
  try{const data=await api("/api/bid/questions",{method:"POST",body:JSON.stringify({questions})});clearBidBatch();await loadBidModule();toast(`${data.created} Bieterfrage(n) gespeichert.`)}catch(error){toast(error.message)}
}
function parseDelimitedLine(line,delimiter){
  const values=[];let value="",quoted=false;
  for(let index=0;index<line.length;index++){const char=line[index];if(char==='"'){if(quoted&&line[index+1]==='"'){value+='"';index++}else quoted=!quoted}else if(char===delimiter&&!quoted){values.push(value.trim());value=""}else value+=char}
  values.push(value.trim());return values;
}
function parsedBidImport(){
  const lines=String(bidImportText?.value||"").replace(/\r/g,"").split("\n").filter(line=>line.trim());if(!lines.length)return [];
  const delimiter=lines.some(line=>line.includes("\t"))?"\t":";";
  const rows=lines.map(line=>parseDelimitedLine(line,delimiter));
  if(rows[0]?.join(" ").toLocaleLowerCase("de").includes("bieterfrage"))rows.shift();
  return rows.filter(row=>row.some(Boolean)).map(row=>({category:row[0]||"",bidder:row[1]||"",subject:row[2]||"",question:row[3]||"",agency_comment:row[4]||"",decision:String(row[5]||"").trim().toLocaleLowerCase("de"),answer:row[6]||""}));
}
function previewBidImport(){
  if(!bidImportPreview)return;const rows=parsedBidImport();
  bidImportPreview.innerHTML=rows.length?`<p><b>${rows.length} Zeile(n) erkannt</b></p><table><thead><tr><th>Kategorie</th><th>Bieter</th><th>Thema</th><th>Bieterfrage</th></tr></thead><tbody>${rows.slice(0,50).map(row=>`<tr><td>${esc(row.category)}</td><td>${esc(row.bidder)}</td><td>${esc(row.subject)}</td><td>${esc(row.question)}</td></tr>`).join("")}</tbody></table>${rows.length>50?"<p class='muted'>Vorschau auf 50 Zeilen begrenzt.</p>":""}`:"<p class='muted'>Noch keine Zeilen erkannt.</p>";
}
async function importBidQuestions(){
  const projectId=Number(bidImportProject.value),rows=parsedBidImport();if(!projectId)return toast("Bitte ein Projekt auswählen.");if(!rows.length)return toast("Keine importierbaren Zeilen erkannt.");
  if(rows.some(row=>!row.question))return toast("Mindestens eine Zeile enthält keine Bieterfrage.");
  if(rows.some(row=>row.decision&&!['zugelassen','abgelehnt'].includes(row.decision)))return toast("Entscheidungen müssen zugelassen oder abgelehnt sein.");
  try{const data=await api("/api/bid/questions",{method:"POST",body:JSON.stringify({questions:rows.map(row=>({...row,project_id:projectId,question_year:Number(byId("bidImportYear").value)}))})});bidImportText.value="";previewBidImport();await loadBidModule();toast(`${data.created} Bieterfrage(n) importiert.`)}catch(error){toast(error.message)}
}
function updateBidTaxonomyOptions(){
  const categoryOptions=bidCategories.filter(category=>category.active).map(category=>`<option value="${category.id}">${esc(category.name)}</option>`).join("");
  if(bidTopicCategory){const before=bidTopicCategory.value;bidTopicCategory.innerHTML='<option value="">Kategorie auswählen...</option>'+categoryOptions;bidTopicCategory.value=bidCategories.some(item=>String(item.id)===before)?before:""}
  updateBidAnswerTopicButton();
}
function updateBidAnswerTopicButton(){const topic=bidTopics.find(item=>String(item.id)===bidAnswerTopic?.value),category=topic&&bidCategories.find(item=>item.id===topic.category_id),button=byId("bidAnswerTopicButton");if(!button)return;button.textContent=topic?`${category?.name||""} · ${topic.name}`:"Thema auswählen...";button.classList.toggle("has-selection",!!topic)}
function answerMatches(answer,needle){const search=String(needle||"").trim().toLocaleLowerCase("de");return !search||[answer.category_name,answer.topic_name,answer.short_question,answer.question,answer.agency_comment,...(answer.variants||[]).flatMap(item=>[item.short_description,item.answer])].join(" ").toLocaleLowerCase("de").includes(search)}
function renderBidAnswerLibrary(){
  if(!bidAnswerLibrary)return;const matching=bidAnswers.filter(answer=>answerMatches(answer,bidAnswerSearch?.value));
  bidAnswerLibrary.innerHTML=bidCategories.map(category=>{const categoryAnswers=matching.filter(answer=>answer.category_id===category.id);if(!categoryAnswers.length)return "";const topics=bidTopics.filter(topic=>topic.category_id===category.id).map(topic=>{const answers=categoryAnswers.filter(answer=>answer.topic_id===topic.id);if(!answers.length)return "";return `<details class="bid-topic-group" open><summary><span>${esc(topic.name)}</span><small>${answers.length} Antwortfall/-fälle</small></summary><div class="compact-answer-list">${answers.map(answer=>`<article class="compact-answer-row"><button class="text-button" onclick="openBidAnswerDetail(${answer.id})"><b>${esc(answer.short_question)}</b><small>${esc((answer.agency_comment||answer.question||"Ohne Zusatzinformation").slice(0,150))}</small></button><div class="compact-answer-meta">${(answer.variants||[]).map(variant=>`<span class="decision-chip ${variant.decision}" title="${esc(variant.short_description||"")}">${esc(variant.short_description||variant.decision)}</span>`).join("")}</div><button type="button" onclick="openBidAnswerDetail(${answer.id})">Details</button></article>`).join("")}</div></details>`}).join("");return `<details class="bid-category-group" open><summary><h3>${esc(category.name)}</h3><span>${categoryAnswers.length}</span></summary>${topics}</details>`}).join("")||"<p class='muted'>Keine passenden Standardantworten gefunden.</p>";
}
function openBidAnswerDetail(id){const answer=bidAnswers.find(item=>item.id===Number(id));if(!answer)return;byId("bidAnswerDetailTitle").textContent=answer.short_question;byId("bidAnswerDetailContent").innerHTML=`<p class="muted">${esc(answer.category_name)} · ${esc(answer.topic_name)}</p>${answer.question?bidAnswerField(answer,"question","Frage"):""}${answer.agency_comment?bidAnswerField(answer,"agency_comment","Kommentar Agentur Wieseke"):""}<section class="bid-answer-variant-list"><h3>Antwortvarianten</h3>${(answer.variants||[]).map(variant=>`<div><span class="decision-chip ${variant.decision}">${esc(variant.decision)}</span>${variant.short_description?`<b>${esc(variant.short_description)}</b>`:""}<p>${esc(variant.answer).replace(/\n/g,"<br>")}</p><button type="button" class="copy-icon-button" onclick="copyBidVariant(${answer.id},${variant.id})" title="Antwort kopieren">${menuIcon("copy")}</button></div>`).join("")}</section>`;byId("bidAnswerDetailActions").innerHTML=hasPermission("bid_answers_manage")?`<button onclick="bidAnswerDetailDialog.close();editBidAnswer(${answer.id})">Bearbeiten</button>`:"";bidAnswerDetailDialog.showModal()}
function bidAnswerField(answer,key,label){return `<section class="bid-answer-field"><div><b>${esc(label)}</b><button type="button" class="copy-icon-button" title="${esc(label)} kopieren" aria-label="${esc(label)} kopieren" onclick="copyBidAnswerField(${answer.id},'${key}')">${menuIcon("copy")}</button></div><p>${esc(answer[key]||"").replace(/\n/g,"<br>")}</p></section>`}
async function copyBidAnswerField(id,key){const answer=bidAnswers.find(item=>item.id===Number(id));if(!answer)return;try{await navigator.clipboard.writeText(answer[key]||"");toast("Text wurde kopiert.")}catch(error){toast("Der Text konnte nicht kopiert werden.")}}
async function copyBidVariant(answerId,variantId){const answer=bidAnswers.find(item=>item.id===Number(answerId)),variant=answer?.variants?.find(item=>item.id===Number(variantId));if(!variant)return;try{await navigator.clipboard.writeText(variant.answer);toast("Antwort kopiert.")}catch(error){toast("Die Antwort konnte nicht kopiert werden.")}}
function newBidAnswerVariant(decision="zugelassen",answer="",short_description=""){return {local_id:Date.now()+Math.random(),decision,answer,short_description}}
function addBidAnswerVariant(decision="zugelassen",answer=""){editingBidAnswerVariants.push(newBidAnswerVariant(decision,answer));renderBidAnswerVariants()}
function removeBidAnswerVariant(localId){editingBidAnswerVariants=editingBidAnswerVariants.filter(item=>item.local_id!==localId);renderBidAnswerVariants()}
function updateBidAnswerVariant(localId,key,value){const item=editingBidAnswerVariants.find(entry=>entry.local_id===localId);if(item)item[key]=value}
function renderBidAnswerVariants(){if(!bidAnswerVariants)return;bidAnswerVariants.innerHTML=editingBidAnswerVariants.map((variant,index)=>`<article class="bid-answer-variant"><header><b>Variante ${index+1}</b><button type="button" class="icon-only danger" onclick="removeBidAnswerVariant(${variant.local_id})">×</button></header><label>Entscheidung<select onchange="updateBidAnswerVariant(${variant.local_id},'decision',this.value)"><option value="zugelassen" ${variant.decision==="zugelassen"?"selected":""}>zugelassen</option><option value="abgelehnt" ${variant.decision==="abgelehnt"?"selected":""}>abgelehnt</option></select></label><label>Kurzbeschreibung<input maxlength="300" value="${esc(variant.short_description||"")}" oninput="updateBidAnswerVariant(${variant.local_id},'short_description',this.value)" placeholder="z. B. Fristverlängerung um 7 Tage"></label><label>Antwort<textarea rows="5" oninput="updateBidAnswerVariant(${variant.local_id},'answer',this.value)">${esc(variant.answer)}</textarea></label></article>`).join("")||"<p class='muted'>Noch keine Antwortvariante vorhanden.</p>"}
function newBidAnswer(){byId("bidAnswerId").value="";bidAnswerTopic.value="";byId("bidAnswerShortQuestion").value=byId("bidAnswerQuestion").value=byId("bidAnswerComment").value="";editingBidAnswerVariants=[newBidAnswerVariant("zugelassen"),newBidAnswerVariant("abgelehnt")];renderBidAnswerVariants();updateBidAnswerTopicButton();byId("bidAnswerFormTitle").textContent="Standardantwort anlegen";byId("deleteBidAnswerButton").hidden=true;switchTab("bid-answer-create")}
function editBidAnswer(id){const answer=bidAnswers.find(item=>item.id===Number(id));if(!answer)return;byId("bidAnswerId").value=answer.id;bidAnswerTopic.value=answer.topic_id;byId("bidAnswerShortQuestion").value=answer.short_question;byId("bidAnswerQuestion").value=answer.question;byId("bidAnswerComment").value=answer.agency_comment||"";editingBidAnswerVariants=(answer.variants||[]).map(item=>({local_id:Date.now()+Math.random(),decision:item.decision,answer:item.answer,short_description:item.short_description||""}));renderBidAnswerVariants();updateBidAnswerTopicButton();byId("bidAnswerFormTitle").textContent="Standardantwort bearbeiten";byId("deleteBidAnswerButton").hidden=false;switchTab("bid-answer-create")}
async function saveBidAnswer(){const id=byId("bidAnswerId").value,payload={topic_id:Number(bidAnswerTopic.value),short_question:byId("bidAnswerShortQuestion").value,question:byId("bidAnswerQuestion").value,agency_comment:byId("bidAnswerComment").value,variants:editingBidAnswerVariants.filter(item=>item.answer.trim()).map(item=>({decision:item.decision,short_description:item.short_description||"",answer:item.answer}))};try{if(id)await api(`/api/bid/answers/${id}`,{method:"PUT",body:JSON.stringify(payload)});else await api("/api/bid/answers",{method:"POST",body:JSON.stringify(payload)});await loadBidModule();toast("Antwortfall gespeichert.");switchTab("bid-answers")}catch(error){toast(error.message)}}
async function deleteBidAnswer(){const id=byId("bidAnswerId").value;if(!id)return;try{await api(`/api/bid/answers/${id}`,{method:"DELETE"});await loadBidModule();toast("Standardantwort gelöscht.");newBidAnswer()}catch(error){toast(error.message)}}

function newBidCategory(){byId("bidCategoryId").value=byId("bidCategoryName").value="";byId("bidCategoryActive").checked=true;byId("deleteBidCategoryButton").hidden=true}
function editBidCategory(id){const item=bidCategories.find(category=>category.id===Number(id));if(!item)return;byId("bidCategoryId").value=item.id;byId("bidCategoryName").value=item.name;byId("bidCategoryActive").checked=item.active;byId("deleteBidCategoryButton").hidden=false}
async function saveBidCategory(){const id=byId("bidCategoryId").value,payload={name:byId("bidCategoryName").value,active:byId("bidCategoryActive").checked};try{if(id)await api(`/api/bid/categories/${id}`,{method:"PUT",body:JSON.stringify(payload)});else await api("/api/bid/categories",{method:"POST",body:JSON.stringify(payload)});newBidCategory();await loadBidModule();toast("Kategorie gespeichert.")}catch(error){toast(error.message)}}
async function deleteBidCategory(){const id=byId("bidCategoryId").value;if(!id)return;try{await api(`/api/bid/categories/${id}`,{method:"DELETE"});newBidCategory();await loadBidModule();toast("Kategorie gelöscht.")}catch(error){toast(error.message)}}
function newBidTopic(){byId("bidTopicId").value=byId("bidTopicName").value="";byId("bidTopicActive").checked=true;byId("deleteBidTopicButton").hidden=true;updateBidTaxonomyOptions()}
function editBidTopic(id){const item=bidTopics.find(topic=>topic.id===Number(id));if(!item)return;byId("bidTopicId").value=item.id;bidTopicCategory.value=item.category_id;byId("bidTopicName").value=item.name;byId("bidTopicActive").checked=item.active;byId("deleteBidTopicButton").hidden=false}
async function saveBidTopic(){const id=byId("bidTopicId").value,payload={category_id:Number(bidTopicCategory.value),name:byId("bidTopicName").value,active:byId("bidTopicActive").checked};try{if(id)await api(`/api/bid/topics/${id}`,{method:"PUT",body:JSON.stringify(payload)});else await api("/api/bid/topics",{method:"POST",body:JSON.stringify(payload)});newBidTopic();await loadBidModule();toast("Thema gespeichert.")}catch(error){toast(error.message)}}
async function deleteBidTopic(){const id=byId("bidTopicId").value;if(!id)return;try{await api(`/api/bid/topics/${id}`,{method:"DELETE"});newBidTopic();await loadBidModule();toast("Thema gelöscht.")}catch(error){toast(error.message)}}
function renderBidTaxonomy(){
  if(bidCategoryList)bidCategoryList.innerHTML=bidCategories.map(category=>`<div class="taxonomy-item" draggable="true" ondragstart="beginBidCategoryDrag(event,${category.id})" ondragover="allowBidTaxonomyDrop(event)" ondragleave="event.currentTarget.classList.remove('drag-over')" ondrop="dropBidCategory(event,${category.id})"><span class="drag-handle">⋮⋮</span><button class="text-button" onclick="editBidCategory(${category.id})"><b>${esc(category.name)}</b><small>${category.active?"aktiv":"inaktiv"}</small></button></div>`).join("")||"<p class='muted'>Noch keine Kategorien vorhanden.</p>";
  if(bidTopicList)bidTopicList.innerHTML=bidCategories.map(category=>{const topics=bidTopics.filter(topic=>topic.category_id===category.id);return topics.length?`<section><h3>${esc(category.name)}</h3>${topics.map(topic=>`<div class="taxonomy-item" draggable="true" ondragstart="beginBidTopicDrag(event,${topic.id},${category.id})" ondragover="allowBidTaxonomyDrop(event)" ondragleave="event.currentTarget.classList.remove('drag-over')" ondrop="dropBidTopic(event,${topic.id},${category.id})"><span class="drag-handle">⋮⋮</span><button class="text-button" onclick="editBidTopic(${topic.id})"><b>${esc(topic.name)}</b><small>${topic.active?"aktiv":"inaktiv"}</small></button></div>`).join("")}</section>`:""}).join("")||"<p class='muted'>Noch keine Themen vorhanden.</p>";
}
function beginBidCategoryDrag(event,id){draggedBidCategoryId=id;event.dataTransfer.setData("text/plain",String(id))}
function beginBidTopicDrag(event,id,categoryId){draggedBidTopicId=id;draggedBidTopicCategoryId=categoryId;event.dataTransfer.setData("text/plain",String(id))}
function allowBidTaxonomyDrop(event){if(draggedBidCategoryId||draggedBidTopicId){event.preventDefault();event.currentTarget.classList.add("drag-over")}}
async function dropBidCategory(event,targetId){event.preventDefault();event.currentTarget.classList.remove("drag-over");if(!draggedBidCategoryId||draggedBidCategoryId===targetId)return;const dragged=bidCategories.find(item=>item.id===draggedBidCategoryId),remaining=bidCategories.filter(item=>item.id!==draggedBidCategoryId),index=remaining.findIndex(item=>item.id===targetId);remaining.splice(index,0,dragged);draggedBidCategoryId=null;bidCategories=remaining;renderBidTaxonomy();try{await api("/api/bid/categories/order",{method:"PUT",body:JSON.stringify({ids:remaining.map(item=>item.id)})})}catch(error){toast(error.message);await loadBidModule()}}
async function dropBidTopic(event,targetId,categoryId){event.preventDefault();event.currentTarget.classList.remove("drag-over");if(!draggedBidTopicId||draggedBidTopicCategoryId!==categoryId||draggedBidTopicId===targetId)return;const ordered=bidTopics.filter(item=>item.category_id===categoryId),dragged=ordered.find(item=>item.id===draggedBidTopicId),remaining=ordered.filter(item=>item.id!==draggedBidTopicId),index=remaining.findIndex(item=>item.id===targetId);remaining.splice(index,0,dragged);draggedBidTopicId=null;draggedBidTopicCategoryId=null;bidTopics=[...bidTopics.filter(item=>item.category_id!==categoryId),...remaining];renderBidTaxonomy();try{await api("/api/bid/topics/order",{method:"PUT",body:JSON.stringify({category_id:categoryId,ids:remaining.map(item=>item.id)})})}catch(error){toast(error.message);await loadBidModule()}}

// Template administration
function newTemplate(openEditor=true){
  tplId.value="";tplName.value="";tplSubject.value="";setEditorHtml(tplBody,"");resetEditorHistory(tplBody);
  setEditorHtml(tplNoticeBody,"");resetEditorHistory(tplNoticeBody);tplNoticeMode.value="display";tplNoticeEnabled.checked=false;
  tplNoticeButtonLabel.value="Hinweistext gesehen";toggleTemplateNoticeEditor();
  tplCategory.value=categories[0]?String(categories[0].id):"";
  tplActive.checked=true;editingFields=[];renderFieldEditor();
  templateIdentity.hidden=true;tplDisplayId.value=tplDirectLink.value="";
  templateHistoryButton.hidden=true;
  byId("templateExportActions").hidden=true;
  validateTemplatePlaceholders();
  byId("templateEditorTitle").textContent="Neue Vorlage erstellen";
  if(openEditor)switchTab("template-edit");
}
function editTemplate(id){
  const template=templates.find(item=>item.id===id);if(!template)return;
  tplId.value=template.id;tplName.value=template.name;tplCategory.value=String(template.category_id||"");
  tplSubject.value=template.subject;
  setEditorHtml(tplBody,template.body_html||plainTextToHtml(template.body));
  resetEditorHistory(tplBody);
  tplActive.checked=template.active;
  setEditorHtml(tplNoticeBody,template.notice_html||plainTextToHtml(template.notice_text||""));resetEditorHistory(tplNoticeBody);
  tplNoticeMode.value=template.notice_mode||"display";tplNoticeButtonLabel.value=template.notice_button_label||"Hinweistext gesehen";
  tplNoticeEnabled.checked=!!template.notice_enabled;toggleTemplateNoticeEditor();
  editingFields=JSON.parse(JSON.stringify(template.fields||[]));renderFieldEditor();
  templateIdentity.hidden=false;tplDisplayId.value=String(template.id);tplDirectLink.value=`${location.origin}/vorlage/${template.id}`;
  templateHistoryButton.hidden=false;
  byId("templateExportActions").hidden=!hasPermission("template_export");
  validateTemplatePlaceholders();
  byId("templateEditorTitle").textContent=template.name;
  switchTab("template-edit");
}

function exportTemplateById(id,type){
  if(!hasPermission("template_export"))return toast("Für diesen Export fehlt die Berechtigung.");
  location.href=`/api/templates/${id}/export/${type}`;
}
function exportTemplate(type){
  const id=Number(tplId.value);if(!id)return toast("Bitte speichern Sie die Vorlage vor dem Export.");
  exportTemplateById(id,type);
}
function exportAllTemplates(type){
  if(!hasPermission("templates_export_all"))return toast("Für diesen Export fehlt die Berechtigung.");
  location.href=`/api/templates/export/${type}`;
}

async function archiveTemplate(id){
  const template=templates.find(item=>item.id===Number(id));if(!template)return;
  pendingArchiveTemplateId=template.id;byId("archiveTemplateName").textContent=template.name;archiveTemplateDialog.showModal();
}
function cancelArchiveTemplate(){pendingArchiveTemplateId=null;archiveTemplateDialog.close()}
async function confirmArchiveTemplate(){
  if(!pendingArchiveTemplateId)return;
  const id=pendingArchiveTemplateId;pendingArchiveTemplateId=null;archiveTemplateDialog.close();
  try{await api(`/api/templates/${id}`,{method:"DELETE"});if(Number(tplId.value)===id)newTemplate(false);await loadTemplates();switchTab("templates");toast("Vorlage archiviert.")}catch(error){toast(error.message)}
}
async function restoreTemplate(id){try{await api(`/api/templates/${id}/restore`,{method:"PUT",body:"{}"});await loadTemplates();toast("Vorlage wiederhergestellt.")}catch(error){toast(error.message)}}
async function permanentlyDeleteTemplate(id){
  openPermanentDelete("template",[id]);
}
async function openTemplateHistory(){
  const id=Number(tplId.value);if(!id)return;
  try{const data=await api(`/api/templates/${id}/versions`);templateHistoryTitle.textContent=tplName.value;
    templateHistoryList.innerHTML=data.versions.map(version=>`<div class="list-item"><div><b>Version ${version.version_no}</b><div class="small">${new Date(version.created_at).toLocaleString()} · ${esc(version.username||"System")}</div></div><button type="button" onclick="restoreTemplateVersion(${id},${version.id},${version.version_no})">Wiederherstellen</button></div>`).join("")||"<p class='muted'>Keine Versionen vorhanden.</p>";
    templateHistoryDialog.showModal();
  }catch(error){toast(error.message)}
}
async function restoreTemplateVersion(templateId,versionId,versionNo){
  if(!confirm(`Version ${versionNo} wiederherstellen? Der aktuelle Stand bleibt als Version erhalten.`))return;
  try{await api(`/api/templates/${templateId}/versions/${versionId}/restore`,{method:"POST",body:"{}"});templateHistoryDialog.close();await loadTemplates();editTemplate(templateId);toast("Vorlagenversion wiederhergestellt.")}catch(error){toast(error.message)}
}
function toggleTemplateNoticeEditor(){
  byId("tplNoticeSettings").hidden=!tplNoticeEnabled.checked;
  byId("tplNoticeButtonLabelWrap").hidden=!tplNoticeEnabled.checked||tplNoticeMode.value!=="acknowledge";
  validateTemplatePlaceholders();
}
function renderFieldEditor(){
  if(!fieldEditor){validateTemplatePlaceholders();return}
  fieldEditor.innerHTML=editingFields.map((field,index)=>`<div class="field-row">
    <label>Schlüssel<input value="${esc(field.key)}" onchange="editingFields[${index}].key=this.value;validateTemplatePlaceholders()"></label>
    <label>Beschriftung<input value="${esc(field.label)}" onchange="editingFields[${index}].label=this.value"></label>
    <label>Typ<select onchange="editingFields[${index}].type=this.value">${["text","textarea","date","number","email"].map(type=>
      `<option value="${type}" ${field.type===type?"selected":""}>${type}</option>`).join("")}</select></label>
    <label><input type="checkbox" ${field.required?"checked":""} onchange="editingFields[${index}].required=this.checked"> Pflicht</label>
    <button onclick="editingFields.splice(${index},1);renderFieldEditor()">×</button>
  </div>`).join("");validateTemplatePlaceholders();
}
async function copyTemplateIdentityLink(){
  try{await navigator.clipboard.writeText(tplDirectLink.value);toast("Vorlagenlink wurde kopiert.")}
  catch(error){toast(tplDirectLink.value)}
}
function insertVariable(key){
  const token=`{{${key}}}`;
  if(templateInsertTarget==="subject"){
    const start=tplSubject.selectionStart??tplSubject.value.length,end=tplSubject.selectionEnd??start;
    tplSubject.value=tplSubject.value.slice(0,start)+token+tplSubject.value.slice(end);tplSubject.focus();
    tplSubject.setSelectionRange(start+token.length,start+token.length);return;
  }
  const editor=templateInsertTarget==="notice"?tplNoticeBody:tplBody;
  editor.focus();restoreEditorSelection(editor);insertEditorFragment(editor,esc(token));recordEditorHistory(editor);validateTemplatePlaceholders();
}
function templateEditorKeys(){
  const keys=[],regex=/\{\{\s*([^}]+?)\s*\}\}/g;
  const texts=[tplSubject.value,getEditorHtml(tplBody),tplNoticeEnabled.checked?getEditorHtml(tplNoticeBody):""];
  for(const text of texts){let match;while((match=regex.exec(text))!==null)if(!keys.includes(match[1]))keys.push(match[1])}
  return keys;
}
function validateTemplatePlaceholders(){
  if(!templateValidation)return true;
  const used=templateEditorKeys(),fieldKeys=editingFields.map(canonicalFieldKey);
  const known=new Set([...variables.map(variable=>variable.key),...fieldKeys]);
  const unknown=used.filter(key=>!known.has(key));
  const inactive=used.filter(key=>variables.some(variable=>variable.key===key&&!variable.active));
  const unused=fieldKeys.filter(key=>!used.includes(key));
  const messages=[];
  if(!tplName.value.trim())messages.push("<b>Name fehlt:</b> Die Vorlage sollte eindeutig bezeichnet werden.");
  if(!tplCategory.value)messages.push("<b>Kategorie fehlt:</b> Bitte eine Mailkategorie auswählen.");
  if(!tplSubject.value.trim())messages.push("<b>Betreff fehlt:</b> Die erzeugte E-Mail hätte keinen Betreff.");
  if(!getEditorText(tplBody).trim())messages.push("<b>E-Mail-Text fehlt:</b> Die Vorlage enthält keinen Nachrichtentext.");
  if(tplNoticeEnabled.checked&&!getEditorText(tplNoticeBody).trim())messages.push("<b>Leeres Hinweisfeld:</b> Das Hinweisfeld ist aktiviert, enthält aber keinen Text.");
  if(unknown.length)messages.push(`<b>Unbekannte Platzhalter:</b> ${unknown.map(key=>`{{${esc(key)}}}`).join(", ")}`);
  if(inactive.length)messages.push(`<b>Inaktive Platzhalter:</b> ${inactive.map(key=>`{{${esc(key)}}}`).join(", ")}`);
  if(unused.length)messages.push(`<b>Definiert, aber nicht verwendet:</b> ${unused.map(key=>`{{${esc(key)}}}`).join(", ")}`);
  templateValidation.className="template-validation "+(messages.length?"problem":"ok");
  templateValidation.innerHTML=messages.length?messages.join("<br>"):"✓ Die Vorlage enthält keine erkennbaren Auffälligkeiten.";
  return messages;
}
// The test mode renders the unsaved editor state with disposable sample data.
// It deliberately does not call the API, so inactive and unfinished templates can be checked safely.
function templateTestDefinition(key){
  const catalog=variables.find(variable=>variable.key===key);
  if(catalog)return catalog;
  const custom=editingFields.find(field=>canonicalFieldKey(field)===key);
  return custom?{...custom,key,source:"manual"}:{key,label:key,type:"text",source:"manual",required:false};
}
function templateTestSample(definition){
  const examples={
    "projekt.id":"2026-001","projekt.bezeichnung":"HLF 20 Musterstadt","projekt.fahrzeugtyp":"HLF 20","projekt.status":"Auftragsabwicklung",
    "auftraggeber.name":"Stadt Musterstadt","auftraggeber.strasse":"Musterstraße 1","auftraggeber.plz":"12345","auftraggeber.ort":"Musterstadt",
    "kontakt.anrede":"Herr","kontakt.vorname":"Max","kontakt.nachname":"Mustermann","kontakt.email":"max.mustermann@example.de","kontakt.telefon":"01234 567890",
    "benutzer.vorname":me?.first_name||"Marcel","benutzer.nachname":me?.last_name||"Mustermann","benutzer.email":me?.email||"marcel@example.de"
  };
  if(examples[definition.key])return examples[definition.key];
  if(definition.type==="date")return new Date().toISOString().slice(0,10);
  if(definition.type==="number")return "1";
  if(definition.type==="email")return "test@example.de";
  return `${definition.label||definition.key} – Beispiel`;
}
function openTemplateTest(){
  const keys=templateEditorKeys();templateTestFields.innerHTML="";
  for(const key of keys){
    const definition=templateTestDefinition(key),label=document.createElement("label");label.textContent=definition.label||key;
    const input=createInput(definition,"template-test-input");input.value=templateTestSample(definition);input.addEventListener("input",updateTemplateTestPreview);
    label.appendChild(input);templateTestFields.appendChild(label);
  }
  if(!keys.length)templateTestFields.innerHTML='<p class="muted">Diese Vorlage verwendet keine Platzhalter.</p>';
  updateTemplateTestPreview();templateTestDialog.showModal();
}
function updateTemplateTestPreview(){
  const context={};document.querySelectorAll(".template-test-input").forEach(input=>setPath(context,input.dataset.key,input.value));
  templateTestSubject.value=renderText(tplSubject.value,context,true);
  templateTestBody.innerHTML=renderHtmlTemplate(getEditorHtml(tplBody),context,true);
  const noticeHtml=tplNoticeEnabled.checked?getEditorHtml(tplNoticeBody):"";
  templateTestNotice.hidden=!noticeHtml;templateTestNoticeText.innerHTML=noticeHtml?renderHtmlTemplate(noticeHtml,context,true):"";
  const modeLabels={display:"Hinweis wird nur angezeigt.",dialog:"Vor jeder Ausgabe muss die Warnung bestätigt werden.",acknowledge:`Ausgaben werden erst nach „${tplNoticeButtonLabel.value||"Hinweistext gesehen"}“ freigegeben.`};
  templateTestNoticeMode.textContent=noticeHtml?modeLabels[tplNoticeMode.value]||"":"";
}
async function duplicateTemplate(id){
  try{const data=await api(`/api/templates/${id}/duplicate`,{method:"POST",body:"{}"});await loadTemplates();editTemplate(data.id);toast("Vorlage wurde als inaktive Kopie angelegt.")}
  catch(error){toast(error.message)}
}
async function saveTemplate(){
  validateTemplatePlaceholders();
  const body_html=getEditorHtml(tplBody),body=getEditorText(tplBody);
  const notice_html=getEditorHtml(tplNoticeBody),notice_text=getEditorText(tplNoticeBody);
  const data={name:tplName.value,category_id:Number(tplCategory.value),subject:tplSubject.value,body,body_html,
    active:tplActive.checked,fields:editingFields,notice_enabled:tplNoticeEnabled.checked,
    notice_text,notice_html,notice_mode:tplNoticeMode.value,notice_button_label:tplNoticeButtonLabel.value};
  try{
    let savedId=Number(tplId.value)||0;
    if(savedId)await api("/api/templates/"+savedId,{method:"PUT",body:JSON.stringify(data)});
    else{const created=await api("/api/templates",{method:"POST",body:JSON.stringify(data)});savedId=created.id}
    toast("Vorlage gespeichert.");await loadVariables();await loadTemplates();editTemplate(savedId);
  }catch(error){toast(error.message)}
}

// Role and category-access administration
async function loadRoles(){
  const data=await api("/api/roles");roles=data.roles;permissionCatalog=data.permission_catalog||{};
  if(uRole){
    uRole.innerHTML=roles.map(role=>`<option value="${role.id}">${esc(role.name)}</option>`).join("");
    const defaultRole=roles.find(role=>role.name==="Benutzer")||roles[0];
    if(defaultRole)uRole.value=String(defaultRole.id);
  }
  renderRoleList();
  if(!roleId.value)newRole();
}
function renderRoleList(){
  if(!roleList||!hasPermission("roles_manage"))return;
  roleList.innerHTML=roles.map(role=>`<div class="list-item">
    <div><button class="text-button" onclick="editRole(${role.id})"><b>${esc(role.name)}</b></button><div class="small">${role.permissions.length} Berechtigungen · ${role.all_categories?"alle Kategorien":role.category_ids.length+" Kategorien"}</div></div>
    <button onclick="editRole(${role.id})">Bearbeiten</button>
  </div>`).join("");
}
function newRole(){
  roleId.value="";roleName.value="";roleAllCategories.checked=false;
  byId("deleteRoleButton").hidden=true;
  renderRolePermissionEditor(["email_create"]);
  renderRoleCategoryEditor([]);
  setRoleEditorLocked(false);
}
function editRole(id){
  const role=roles.find(item=>item.id===id);if(!role)return;
  roleId.value=role.id;roleName.value=role.name;roleAllCategories.checked=role.all_categories;
  renderRolePermissionEditor(role.permissions);renderRoleCategoryEditor(role.category_ids);
  byId("deleteRoleButton").hidden=role.is_system;
  setRoleEditorLocked(role.name==="Administrator");
}
function setRoleEditorLocked(locked){
  roleLockedNotice.hidden=!locked;saveRoleButton.hidden=locked;roleName.disabled=locked;roleAllCategories.disabled=locked;
  document.querySelectorAll("#rolePermissionEditor input,#roleCategoryEditor input").forEach(input=>input.disabled=locked);
}
function renderRolePermissionEditor(selected=[]){
  rolePermissionEditor.innerHTML=Object.entries(permissionCatalog).map(([key,label])=>
    `<label><input type="checkbox" class="role-permission" value="${esc(key)}" ${selected.includes(key)?"checked":""}> ${esc(label)}</label>`
  ).join("");
}
function renderRoleCategoryEditor(selected){
  const selectedIds=selected||Array.from(document.querySelectorAll(".role-category:checked")).map(input=>Number(input.value));
  roleCategoryEditor.hidden=roleAllCategories.checked;
  roleCategoryEditor.innerHTML=roleAllCategories.checked?"":categories.filter(category=>category.active).map(category=>
    `<label><input type="checkbox" class="role-category" value="${category.id}" ${selectedIds.includes(category.id)?"checked":""}> ${esc(category.name)}</label>`
  ).join("");
}
async function saveRole(){
  const payload={
    name:roleName.value,
    permissions:Array.from(document.querySelectorAll(".role-permission:checked")).map(input=>input.value),
    all_categories:roleAllCategories.checked,
    category_ids:Array.from(document.querySelectorAll(".role-category:checked")).map(input=>Number(input.value))
  };
  try{
    if(roleId.value)await api("/api/roles/"+roleId.value,{method:"PUT",body:JSON.stringify(payload)});
    else await api("/api/roles",{method:"POST",body:JSON.stringify(payload)});
    toast("Rolle gespeichert.");roleId.value="";await loadRoles();if(hasPermission("users_manage"))await loadUsers();
  }catch(error){toast(error.message)}
}
async function deleteRole(){
  if(!roleId.value||!confirm("Rolle wirklich löschen?"))return;
  try{await api("/api/roles/"+roleId.value,{method:"DELETE"});toast("Rolle gelöscht.");roleId.value="";await loadRoles()}
  catch(error){toast(error.message)}
}

// User administration, including progressive login lock information
async function loadUsers(){
  const data=await api("/api/users");users=data.users;
  userList.innerHTML=users.map(user=>`<div class="user-card">
    <div><b>${esc(user.username)}</b> – ${esc(user.first_name+" "+user.last_name)}
      <div class="small">${esc(user.role_name)} · ${user.active?"aktiv":"deaktiviert"}${user.locked_until?` · <span class="lock-status">Login gesperrt bis ${new Date(user.locked_until).toLocaleString()}</span>`:user.failed_login_attempts?` · ${user.failed_login_attempts} Fehlversuche`:""}</div></div>
    <label class="inline-role">Rolle <select onchange="assignUserRole(${user.id},this.value)">${roles.map(role=>
      `<option value="${role.id}" ${role.id===user.role_id?"selected":""}>${esc(role.name)}</option>`).join("")}</select></label>
    <label class="inline-role"><input type="checkbox" ${user.password_policy_exempt?"checked":""} onchange="setUserPolicyExemption(${user.id},this.checked)"> Passwortrichtlinie aussetzen</label>
    <div class="actions compact">
      <button onclick="openAdminPassword(${user.id})">Passwort ändern</button>
      <button onclick="generateRecoveryCode(${user.id})">Neuer Wiederherstellungscode</button>
      ${user.locked_until||user.failed_login_attempts?`<button onclick="unlockUser(${user.id})">Login-Sperre aufheben</button>`:""}
      <button onclick="toggleUser(${user.id},${!user.active})">${user.active?"Deaktivieren":"Aktivieren"}</button>
    </div>
  </div>`).join("");
}
async function unlockUser(id){
  try{await api(`/api/users/${id}/unlock`,{method:"PUT",body:"{}"});toast("Login-Sperre wurde aufgehoben.");await loadUsers()}
  catch(error){toast(error.message)}
}
async function createUser(){
  try{
    const data=await api("/api/users",{method:"POST",body:JSON.stringify({
      username:uUsername.value,first_name:uFirst.value,last_name:uLast.value,email:uEmail.value,role_id:Number(uRole.value),
      password_policy_exempt:uPasswordPolicyExempt.checked,must_change:uMustChangePassword.checked
    })});
    showCredentials(data);
    uUsername.value=uFirst.value=uLast.value=uEmail.value="";uPasswordPolicyExempt.checked=false;uMustChangePassword.checked=true;await loadUsers();
  }catch(error){toast(error.message)}
}
async function setUserPolicyExemption(id,password_policy_exempt){
  try{await api("/api/users/"+id,{method:"PUT",body:JSON.stringify({password_policy_exempt})});toast("Passwortrichtlinie aktualisiert.");await loadUsers()}
  catch(error){toast(error.message);await loadUsers()}
}
function showCredentials(data){
  byId("credentialUsername").value=data.username||"";
  byId("credentialPassword").value=data.temporary_password||"";
  byId("credentialRecovery").value=data.recovery_code||"";
  credentialDialog.showModal();
}
async function copyCredential(id){
  try{await navigator.clipboard.writeText(byId(id).value);toast("Angabe wurde kopiert.")}
  catch(error){toast("Die Angabe konnte nicht kopiert werden.")}
}
async function copyAllCredentials(){
  const text=`Benutzername: ${byId("credentialUsername").value}\nPasswort: ${byId("credentialPassword").value}\nWiederherstellungscode: ${byId("credentialRecovery").value}`;
  try{await navigator.clipboard.writeText(text);toast("Alle Zugangsdaten wurden kopiert.")}
  catch(error){toast("Die Zugangsdaten konnten nicht kopiert werden.")}
}
async function assignUserRole(id,roleIdValue){
  try{await api("/api/users/"+id,{method:"PUT",body:JSON.stringify({role_id:Number(roleIdValue)})});toast("Rolle zugewiesen.");await loadUsers()}
  catch(error){toast(error.message);await loadUsers()}
}
async function toggleUser(id,active){
  try{await api("/api/users/"+id,{method:"PUT",body:JSON.stringify({active})});await loadUsers()}
  catch(error){toast(error.message)}
}
function openAdminPassword(id){
  const user=users.find(item=>item.id===id);if(!user)return;
  byId("adminPasswordUserId").value=id;byId("adminPasswordUserLabel").textContent=`Konto: ${user.username}`;
  byId("adminPasswordValue").value=byId("adminPasswordValue2").value="";
  byId("adminPasswordDialog").showModal();
}
async function saveAdminPassword(){
  const first=byId("adminPasswordValue").value,second=byId("adminPasswordValue2").value;
  if(first!==second)return toast("Die Passwörter stimmen nicht überein.");
  try{
    await api(`/api/users/${byId("adminPasswordUserId").value}/password`,{method:"PUT",body:JSON.stringify({new_password:first})});
    byId("adminPasswordDialog").close();toast("Passwort wurde geändert.");
  }catch(error){toast(error.message)}
}
async function generateRecoveryCode(id){
  pendingRecoveryUserId=id;recoveryCodeConfirmDialog.showModal();
}
function cancelRecoveryCodeGeneration(){pendingRecoveryUserId=null;recoveryCodeConfirmDialog.close()}
async function confirmRecoveryCodeGeneration(){
  if(!pendingRecoveryUserId)return;
  const id=pendingRecoveryUserId;pendingRecoveryUserId=null;recoveryCodeConfirmDialog.close();
  try{
    const data=await api(`/api/users/${id}/recovery`,{method:"PUT",body:"{}"});
    showSecret("Neuer Wiederherstellungscode",data.recovery_code);
  }catch(error){toast(error.message)}
}

async function loadSettings(){
  try{
    const data=await api("/api/settings");applySettings(data.settings);
    byId("settingsAppName").value=data.settings.app_name;
    byId("settingsLogoPreview").src=data.settings.logo_data||"/static/logo.png";
    pendingLogoData=data.settings.logo_data||"";
    renderNavigationOrderEditor();
  }catch(error){}
}
function renderNavigationOrderEditor(){
  if(!navigationOrderList)return;
  navigationOrderList.innerHTML=(appSettings.navigation_order||Object.keys(MODULE_REGISTRY)).map(key=>`<div class="navigation-order-item" draggable="true" data-nav-order-key="${esc(key)}" ondragstart="beginNavigationDrag(event,'${esc(key)}')" ondragover="allowNavigationDrop(event)" ondragleave="event.currentTarget.classList.remove('drag-over')" ondrop="dropNavigationItem(event,'${esc(key)}')" ondragend="endNavigationDrag()"><span class="drag-handle" aria-hidden="true">⋮⋮</span><b>${esc(MODULE_REGISTRY[key]?.label||key)}</b></div>`).join("");
}
function beginNavigationDrag(event,key){draggedNavigationKey=key;event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",key)}
function allowNavigationDrop(event){if(draggedNavigationKey){event.preventDefault();event.dataTransfer.dropEffect="move";event.currentTarget.classList.add("drag-over")}}
function endNavigationDrag(){draggedNavigationKey=null;document.querySelectorAll(".navigation-order-item.drag-over").forEach(item=>item.classList.remove("drag-over"))}
function dropNavigationItem(event,targetKey){
  event.preventDefault();event.currentTarget.classList.remove("drag-over");if(!draggedNavigationKey||draggedNavigationKey===targetKey)return endNavigationDrag();
  const order=Array.from(navigationOrderList.querySelectorAll("[data-nav-order-key]")).map(item=>item.dataset.navOrderKey),dragged=draggedNavigationKey;
  const remaining=order.filter(key=>key!==dragged),targetIndex=remaining.indexOf(targetKey),rect=event.currentTarget.getBoundingClientRect();
  remaining.splice(targetIndex+(event.clientY>rect.top+rect.height/2?1:0),0,dragged);appSettings.navigation_order=remaining;endNavigationDrag();renderNavigationOrderEditor();
}
function previewSettingsLogo(input){
  const file=input.files[0];if(!file)return;
  if(file.size>1_000_000){input.value="";return toast("Das Logo darf höchstens 1 MB groß sein.")}
  const reader=new FileReader();
  reader.onload=()=>{pendingLogoData=reader.result;byId("settingsLogoPreview").src=pendingLogoData;byId("settingsRemoveLogo").checked=false};
  reader.readAsDataURL(file);
}
async function saveSettings(){
  const logo=byId("settingsRemoveLogo").checked?"":pendingLogoData;
  try{
    const data=await api("/api/settings",{method:"PUT",body:JSON.stringify({
      app_name:byId("settingsAppName").value,logo_data:logo,
      navigation_order:Array.from(navigationOrderList.querySelectorAll("[data-nav-order-key]")).map(item=>item.dataset.navOrderKey)
    })});
    applySettings(data.settings);pendingLogoData=data.settings.logo_data||"";
    byId("settingsLogoPreview").src=pendingLogoData||"/static/logo.png";
    byId("settingsLogoFile").value="";byId("settingsRemoveLogo").checked=false;toast("Einstellungen gespeichert.");
  }catch(error){toast(error.message)}
}

function downloadDatabaseBackup(){location.href="/api/admin/backup"}
function chooseDatabaseRestore(){byId("databaseRestoreFile").click()}
function prepareDatabaseRestore(input){
  const file=input.files?.[0];if(!file)return;
  if(file.size>20_000_000){input.value="";return toast("Die Sicherung darf höchstens 20 MB groß sein.")}
  const reader=new FileReader();reader.onload=()=>{pendingRestoreBase64=String(reader.result).split(",")[1]||"";restoreConfirmDialog.showModal()};reader.readAsDataURL(file);
}
function cancelDatabaseRestore(){pendingRestoreBase64=null;byId("databaseRestoreFile").value="";restoreConfirmDialog.close()}
async function confirmDatabaseRestore(){
  if(!pendingRestoreBase64)return;
  const database_base64=pendingRestoreBase64;pendingRestoreBase64=null;restoreConfirmDialog.close();
  try{await api("/api/admin/restore",{method:"POST",body:JSON.stringify({database_base64})});alert("Die Sicherung wurde wiederhergestellt. Sie werden jetzt neu angemeldet.");location.reload()}
  catch(error){byId("databaseRestoreFile").value="";toast(error.message)}
}

async function loadAuditLog(){
  if(!hasPermission("system_view")||!byId("auditList"))return;
  try{const data=await api("/api/audit?limit=250");
    const actionLabels={create:"Angelegt",update:"Geändert",archive:"Archiviert",restore:"Wiederhergestellt",download:"Heruntergeladen",export:"Exportiert",duplicate:"Dupliziert","delete-permanent":"Endgültig gelöscht"};
    auditList.innerHTML=data.entries.map(entry=>`<div class="list-item"><div><b>${esc(actionLabels[entry.action]||entry.action)} · ${esc(entry.entity_type)}</b><div>${esc(entry.summary||"")}</div><div class="small">${new Date(entry.created_at).toLocaleString()} · ${esc(entry.username||"System")}${entry.entity_id?` · ID ${esc(entry.entity_id)}`:""}</div></div></div>`).join("")||"<p class='muted'>Noch keine Änderungen protokolliert.</p>";
  }catch(error){toast(error.message)}
}

function renderUsageRanking(targetId,items){
  const target=byId(targetId);if(!target)return;
  target.innerHTML=items.length?items.map(item=>`<div class="metric-row"><span>${esc(item.name||"Unbekannt")}</span><b>${item.count}</b></div>`).join(""):"<p class='muted'>Keine Daten im Zeitraum.</p>";
}
async function loadUsageReport(){
  if(!hasPermission("system_view")||!byId("usageSummary"))return;
  try{
    const data=await api(`/api/usage?days=${Number(byId("usageDays").value)||30}`);
    byId("usageSummary").innerHTML=`<div><span>Ausgaben im Zeitraum</span><b>${data.total}</b></div><div><span>Zeitraum</span><b>${data.days} Tage</b></div><div><span>Genutzte Vorlagen</span><b>${data.by_template.length}</b></div>`;
    renderUsageRanking("usageByTemplate",data.by_template);renderUsageRanking("usageByMethod",data.by_method.map(item=>({...item,name:{eml:"EML",mailto:"Outlook / mailto",copy:"E-Mailtext kopiert"}[item.name]||item.name})));renderUsageRanking("usageByUser",data.by_user);
    byId("usageRecent").innerHTML=data.recent.length?data.recent.map(entry=>`<div class="list-item"><div><b>${esc(entry.template_name)}</b><div>${esc({eml:"EML",mailto:"Outlook / mailto",copy:"E-Mailtext kopiert"}[entry.output_method]||entry.output_method)}${entry.project_key?` · Projekt ${esc(entry.project_key)}`:""}</div><div class="small">${new Date(entry.created_at).toLocaleString()} · ${esc(entry.username)}</div></div></div>`).join(""):"<p class='muted'>Noch keine Ausgaben erfasst.</p>";
  }catch(error){toast(error.message)}
}
function formatBytes(bytes){
  const units=["B","KB","MB","GB"];let value=Number(bytes)||0,index=0;
  while(value>=1024&&index<units.length-1){value/=1024;index++}
  return `${value.toLocaleString("de-DE",{maximumFractionDigits:index?2:0})} ${units[index]}`;
}
async function loadSystemStatus(){
  if(!hasPermission("system_view")||!byId("systemStatusGrid"))return;
  try{
    const data=(await api("/api/system-status")).status;
    const values=[
      ["Softwareversion",data.version],["Versionsjahr",data.version_year],["Datenbankschema",data.schema_version],["Datenbankgröße",formatBytes(data.database_size_bytes)],
      ["Letztes Backup",data.last_backup_at?new Date(data.last_backup_at).toLocaleString():"Noch kein Backup"],
      ["Aktive Benutzer",`${data.users_active} von ${data.users_total}`],["Aktive Vorlagen",`${data.templates_active} von ${data.templates_total}`],
      ["Aktive Projekte",`${data.projects_active} von ${data.projects_total}`],["Erfasste Ausgaben",data.usage_events],
      ["Gespeicherte Projekt-E-Mails",data.project_emails],["Bieterfragen",data.bid_questions],["Standardantworten",data.bid_answers],
      ["Anwendung gestartet",new Date(data.started_at).toLocaleString()],["Aktive Sitzungen",data.sessions_active]
    ];
    byId("systemStatusGrid").innerHTML=values.map(([label,value])=>`<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join("");
  }catch(error){toast(error.message)}
}

loadPublicSettings();
boot();
