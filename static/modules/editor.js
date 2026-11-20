/** editor: feature logic; state is scoped by domain in state.js. */
import {state,actions} from './state.js';

export function plainTextToHtml(value){
  const text=String(value||"").replace(/\r\n?/g,"\n");
  return text.split("\n\n").map(part=>`<p>${actions.esc(part).replace(/\n/g,"<br>")}</p>`).join("");
}

export function safeLinkUrl(value){
  let url=String(value||"").trim();
  if(!url)return "";
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url))url="mailto:"+url;
  else if(!/^[a-z][a-z0-9+.-]*:/i.test(url))url="https://"+url;
  return /^(?:https?:\/\/|mailto:)/i.test(url)?url:"";
}

export function sanitizeEmailHtml(value){
  const source=document.createElement("template");source.innerHTML=String(value||"");
  const cleanNode=node=>{
    if(node.nodeType===Node.TEXT_NODE)return document.createTextNode((node.textContent||"").replace(/\u200B/g,""));
    if(node.nodeType!==Node.ELEMENT_NODE)return document.createDocumentFragment();
    if(["SCRIPT","STYLE","IFRAME","OBJECT","SVG"].includes(node.tagName))return document.createDocumentFragment();
    if(node.tagName==="IMG")return actions.cleanEmailImage(node);
    const mapped={B:"STRONG",I:"EM",DIV:"P"}[node.tagName]||node.tagName;
    const container=state.shared.EMAIL_TAGS.has(mapped)?document.createElement(mapped.toLowerCase()):document.createDocumentFragment();
    if(mapped==="A"){
      const href=actions.safeLinkUrl(node.getAttribute("href"));
      if(href)container.setAttribute("href",href);
    }
    Array.from(node.childNodes).forEach(child=>container.appendChild(cleanNode(child)));
    return container;
  };
  const output=document.createElement("div");
  Array.from(source.content.childNodes).forEach(node=>output.appendChild(cleanNode(node)));
  return output.innerHTML;
}

export function htmlToPlainText(value){
  const source=document.createElement("div");source.innerHTML=actions.sanitizeEmailHtml(value);
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

export function setEditorHtml(editor,html){editor.innerHTML=actions.sanitizeEmailHtml(html);state.shared.savedEditorRanges.delete(editor)}

export function getEditorHtml(editor){return actions.sanitizeEmailHtml(editor.innerHTML)}

export function getEditorText(editor){return actions.htmlToPlainText(actions.getEditorHtml(editor))}

export function selectionBelongsTo(editor,range){return editor.contains(range.commonAncestorContainer)}

export function rememberEditorSelection(editor){
  const selection=window.getSelection();
  if(selection?.rangeCount&&actions.selectionBelongsTo(editor,selection.getRangeAt(0)))state.shared.savedEditorRanges.set(editor,selection.getRangeAt(0).cloneRange());
}

export function restoreEditorSelection(editor){
  const range=state.shared.savedEditorRanges.get(editor);if(!range)return false;
  const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);return true;
}

export function activeEditorRange(editor){
  editor.focus();actions.restoreEditorSelection(editor);
  const selection=window.getSelection();
  if(selection?.rangeCount&&actions.selectionBelongsTo(editor,selection.getRangeAt(0)))return selection.getRangeAt(0);
  const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);
  selection.removeAllRanges();selection.addRange(range);return range;
}

export function selectAfterNode(node,inside=false){
  const range=document.createRange();
  if(inside&&node.firstChild)range.setStart(node.firstChild,node.firstChild.textContent.length);
  else range.setStartAfter(node);
  range.collapse(true);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
}

export function insertEditorFragment(editor,html){
  const range=actions.activeEditorRange(editor),template=document.createElement("template");template.innerHTML=actions.sanitizeEmailHtml(html);
  const fragment=template.content,last=fragment.lastChild;range.deleteContents();range.insertNode(fragment);
  if(last)actions.selectAfterNode(last,last.nodeType===Node.ELEMENT_NODE&&last.childNodes.length===1&&last.firstChild?.nodeType===Node.TEXT_NODE);
  actions.rememberEditorSelection(editor);
}

export function closestEditorElement(node,tagName,editor){
  let element=node?.nodeType===Node.ELEMENT_NODE?node:node?.parentElement;
  while(element&&element!==editor){if(element.tagName===tagName.toUpperCase())return element;element=element.parentElement}
  return null;
}

export function unwrapEditorElement(element,editor,preserveSelection=false){
  const parent=element.parentNode,first=element.firstChild,last=element.lastChild;
  while(element.firstChild)parent.insertBefore(element.firstChild,element);
  element.remove();
  if(preserveSelection&&first&&last){
    const range=document.createRange();range.setStartBefore(first);range.setEndAfter(last);
    const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);
  }else if(last)actions.selectAfterNode(last);else editor.focus();
}

export function applyInlineFormat(editor,tagName){
  const range=actions.activeEditorRange(editor),existing=actions.closestEditorElement(range.commonAncestorContainer,tagName,editor);
  if(existing){actions.unwrapEditorElement(existing,editor,true);return}
  const wrapper=document.createElement(tagName);
  if(range.collapsed){
    wrapper.appendChild(document.createTextNode("\u200B"));range.insertNode(wrapper);actions.selectAfterNode(wrapper,true);
  }else{
    wrapper.appendChild(range.extractContents());range.insertNode(wrapper);
    const selection=window.getSelection();range.selectNodeContents(wrapper);selection.removeAllRanges();selection.addRange(range);
  }
}

export function applyListFormat(editor,ordered){
  const range=actions.activeEditorRange(editor),existing=actions.closestEditorElement(range.commonAncestorContainer,ordered?"ol":"ul",editor);
  if(existing){actions.removeListFormat(editor);return}
  const selected=range.toString().replace(/\u200B/g,"");
  const values=(selected||"").split(/\n+/).filter(Boolean);
  const list=document.createElement(ordered?"ol":"ul");
  (values.length?values:["\u200B"]).forEach(value=>{const item=document.createElement("li");item.textContent=value;list.appendChild(item)});
  range.deleteContents();range.insertNode(list);actions.selectAfterNode(list.lastElementChild,true);
}

export function removeListFormat(editor){
  const range=actions.activeEditorRange(editor);
  const list=actions.closestEditorElement(range.commonAncestorContainer,"ul",editor)||actions.closestEditorElement(range.commonAncestorContainer,"ol",editor);
  if(!list)return;
  const fragment=document.createDocumentFragment();let last=null;
  Array.from(list.children).forEach(item=>{
    const paragraph=document.createElement("p");while(item.firstChild)paragraph.appendChild(item.firstChild);
    fragment.appendChild(paragraph);last=paragraph;
  });
  list.replaceWith(fragment);if(last)actions.selectAfterNode(last,true);editor.focus();
}

export function resetEditorHistory(editor){state.shared.editorHistories.set(editor,{states:[actions.getEditorHtml(editor)],index:0})}

export function recordEditorHistory(editor){
  const html=actions.getEditorHtml(editor),history=state.shared.editorHistories.get(editor)||{states:[],index:-1};
  if(history.states[history.index]===html)return;
  history.states=history.states.slice(0,history.index+1);history.states.push(html);history.index=history.states.length-1;
  // Inline images make snapshots larger: cap history by size as well as count.
  let size=history.states.reduce((total,state)=>total+state.length,0);
  while(history.states.length>2&&(history.states.length>100||size>20_000_000)){size-=history.states.shift().length;history.index--}
  state.shared.editorHistories.set(editor,history);
  if(editor===state.mail.resultBody)state.mail.resultDirty=true;
  window.WveDrafts?.capture(editor.closest('.tab,dialog'));
}

export function moveEditorHistory(editor,direction){
  const history=state.shared.editorHistories.get(editor);if(!history)return;
  const target=history.index+direction;if(target<0||target>=history.states.length)return;
  history.index=target;actions.setEditorHtml(editor,history.states[target]);state.shared.editorHistories.set(editor,history);editor.focus();
  if(editor===state.mail.resultBody)state.mail.resultDirty=true;
  window.WveDrafts?.capture(editor.closest('.tab,dialog'));
}

export function formatEditor(editorId,command){
  const editor=state.shared.byId(editorId);
  if(command==="undo")return actions.moveEditorHistory(editor,-1);
  if(command==="redo")return actions.moveEditorHistory(editor,1);
  if(command==="bold")actions.applyInlineFormat(editor,"strong");
  else if(command==="italic")actions.applyInlineFormat(editor,"em");
  else if(command==="insertUnorderedList")actions.applyListFormat(editor,false);
  else if(command==="insertOrderedList")actions.applyListFormat(editor,true);
  else if(command==="removeList")actions.removeListFormat(editor);
  actions.rememberEditorSelection(editor);actions.recordEditorHistory(editor);
  editor.dispatchEvent(new Event('input',{bubbles:true}));
}

export function insertEditorLink(editorId){
  const editor=state.shared.byId(editorId),range=actions.activeEditorRange(editor);
  state.shared.activeLinkEditor=editor;state.shared.activeLinkElement=actions.closestEditorElement(range.commonAncestorContainer,"a",editor);
  state.shared.byId("linkEditorText").value=state.shared.activeLinkElement?.textContent||range.toString()||"";
  state.shared.byId("linkEditorUrl").value=state.shared.activeLinkElement?.getAttribute("href")||"https://";
  state.shared.byId("removeEditorLinkButton").hidden=!state.shared.activeLinkElement;state.shared.linkEditorDialog.showModal();
}

export function saveEditorLink(){
  const href=actions.safeLinkUrl(state.shared.byId("linkEditorUrl").value),text=state.shared.byId("linkEditorText").value.trim();
  if(!href||!text)return actions.toast("Bitte Linktext und eine gültige Linkadresse eintragen.");
  if(state.shared.activeLinkElement){state.shared.activeLinkElement.href=href;state.shared.activeLinkElement.textContent=text}
  else if(state.shared.activeLinkEditor){
    const range=actions.activeEditorRange(state.shared.activeLinkEditor),link=document.createElement("a");link.href=href;link.textContent=text;
    range.deleteContents();range.insertNode(link);actions.selectAfterNode(link,true);
  }
  if(state.shared.activeLinkEditor){actions.recordEditorHistory(state.shared.activeLinkEditor);actions.rememberEditorSelection(state.shared.activeLinkEditor)}
  state.shared.activeLinkEditor=null;state.shared.activeLinkElement=null;state.shared.linkEditorDialog.close();
}

export function removeEditorLink(){
  if(state.shared.activeLinkElement&&state.shared.activeLinkEditor){actions.unwrapEditorElement(state.shared.activeLinkElement,state.shared.activeLinkEditor);actions.recordEditorHistory(state.shared.activeLinkEditor)}
  state.shared.activeLinkEditor=null;state.shared.activeLinkElement=null;state.shared.linkEditorDialog.close();
}

export function cancelEditorLink(){state.shared.activeLinkEditor=null;state.shared.activeLinkElement=null;state.shared.linkEditorDialog.close()}

export function handleEditorPaste(event){
  event.preventDefault();
  const html=event.clipboardData?.getData("text/html");
  const text=event.clipboardData?.getData("text/plain")||"";
  const cleaned=html?actions.sanitizeEmailHtml(html):actions.plainTextToHtml(text);
  actions.insertEditorFragment(event.currentTarget,cleaned);actions.recordEditorHistory(event.currentTarget);
}

export function showSecret(title,text){
  state.shared.byId("secretTitle").textContent=title;state.shared.byId("secretText").textContent=text;state.shared.secretDialog.showModal();
}

export function showRecovery(){state.shared.recoveryDialog.showModal()}
