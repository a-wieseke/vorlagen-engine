/** email-images: feature logic; state is scoped by domain in state.js. */
import {state,actions} from './state.js';

export function cleanEmailImage(node){
  const src=node.getAttribute("src")||"";
  if(!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\r\n]+$/.test(src))return document.createDocumentFragment();
  const image=document.createElement("img");image.src=src;image.alt=(node.getAttribute("alt")||"Bild").slice(0,300);
  for(const attr of ["width","height"]){
    const value=Number(node.getAttribute(attr));if(Number.isInteger(value)&&value>0)image.setAttribute(attr,String(Math.min(1600,value)));
  }
  return image;
}

export function openEmailImageDialog(editorId,image=null){
  state.shared.activeEmailImageEditor=state.shared.byId(editorId);state.shared.activeEmailImage=image;actions.rememberEditorSelection(state.shared.activeEmailImageEditor);
  state.shared.emailImageData=null;state.shared.imageUploadRevision++;
  state.shared.byId("emailImageFile").value="";state.shared.byId("emailImageAlt").value=image?.alt||"";
  state.shared.byId("emailImageWidth").value=image?.getAttribute("width")||600;
  state.shared.byId("emailImageError").textContent="";state.shared.byId("removeEmailImageButton").hidden=!image;
  state.shared.byId("saveEmailImageButton").disabled=!image;
  const preview=state.shared.byId("emailImagePreview");preview.hidden=!image;
  if(image){
    state.shared.emailImageData={src:image.src,width:image.naturalWidth||Number(image.width),height:image.naturalHeight||Number(image.height)};
    preview.src=image.src;state.shared.byId("emailImageWidth").max=state.shared.emailImageData.width;
  }else preview.removeAttribute("src");
  state.shared.byId("emailImageDialog").showModal();
}

export async function uploadEmailImage(){
  const file=state.shared.byId("emailImageFile").files[0];if(!file)return;
  const revision=++state.shared.imageUploadRevision;
  state.shared.emailImageData=null;state.shared.byId("saveEmailImageButton").disabled=true;state.shared.byId("emailImagePreview").hidden=true;
  state.shared.byId("emailImageError").textContent="Bild wird geprüft …";
  try{
    if(file.size>8_000_000)throw Error("Bitte ein Bild mit höchstens 8 MB auswählen.");
    const result=await actions.api("/api/email/images",{method:"POST",body:JSON.stringify({content_base64:await actions.fileAsBase64(file)})});
    // Ignore uploads that finish after cancellation or a newer file selection.
    if(revision!==state.shared.imageUploadRevision||!state.shared.byId("emailImageDialog").open)return;
    state.shared.emailImageData=result;state.shared.byId("emailImagePreview").src=result.src;state.shared.byId("emailImagePreview").hidden=false;
    state.shared.byId("emailImageWidth").max=result.width;state.shared.byId("emailImageWidth").value=Math.min(600,result.width);
    if(!state.shared.byId("emailImageAlt").value)state.shared.byId("emailImageAlt").value=file.name.replace(/\.[^.]+$/,"");
    state.shared.byId("emailImageError").textContent="";state.shared.byId("saveEmailImageButton").disabled=false;
  }catch(error){if(revision===state.shared.imageUploadRevision)state.shared.byId("emailImageError").textContent=error.message}
}

export function cancelEmailImage(){state.shared.imageUploadRevision++;state.shared.byId("emailImageDialog").close()}

export function saveEmailImage(){
  if(!state.shared.emailImageData||!state.shared.activeEmailImageEditor)return;
  const width=Number(state.shared.byId("emailImageWidth").value),limit=Math.min(1600,state.shared.emailImageData.width);
  if(!Number.isInteger(width)||width<1||width>limit){state.shared.byId("emailImageError").textContent=`Bitte eine Breite zwischen 1 und ${limit} Pixeln eingeben.`;return}
  const otherImages=Array.from(state.shared.activeEmailImageEditor.querySelectorAll("img")).filter(image=>image!==state.shared.activeEmailImage);
  const total=[...otherImages.map(image=>image.src),state.shared.emailImageData.src].reduce((sum,src)=>sum+Math.ceil((src.split(",")[1]||"").length*3/4),0);
  if(otherImages.length>=10||total>4_000_000){state.shared.byId("emailImageError").textContent="Höchstens 10 Bilder mit zusammen 4 MB pro E-Mail.";return}
  actions.recordEditorHistory(state.shared.activeEmailImageEditor);
  const image=document.createElement("img");image.src=state.shared.emailImageData.src;image.alt=state.shared.byId("emailImageAlt").value.trim().slice(0,300)||"Bild";
  image.width=width;image.height=Math.max(1,Math.round(state.shared.emailImageData.height*width/state.shared.emailImageData.width));
  state.shared.byId("emailImageDialog").close();
  if(state.shared.activeEmailImage&&state.shared.activeEmailImageEditor.contains(state.shared.activeEmailImage))state.shared.activeEmailImage.replaceWith(image);
  else{const range=actions.activeEditorRange(state.shared.activeEmailImageEditor);range.deleteContents();range.insertNode(image)}
  actions.selectAfterNode(image);actions.rememberEditorSelection(state.shared.activeEmailImageEditor);
  state.shared.activeEmailImageEditor.dispatchEvent(new Event("input",{bubbles:true}));
}

export function removeEmailImage(){
  if(!state.shared.activeEmailImage||!state.shared.activeEmailImageEditor?.contains(state.shared.activeEmailImage))return;
  actions.recordEditorHistory(state.shared.activeEmailImageEditor);state.shared.activeEmailImage.remove();state.shared.byId("emailImageDialog").close();
  state.shared.activeEmailImageEditor.dispatchEvent(new Event("input",{bubbles:true}));
}

export function confirmImageTextExport(){
  const action=state.shared.pendingImageExportAction;state.shared.pendingImageExportAction=null;state.shared.byId("imageExportDialog").close();
  if(action)actions.executeOutputAction(action,true);
}
