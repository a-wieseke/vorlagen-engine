// Limited email-image support. Pixel validation is authoritative on the server;
// this browser allowlist prevents remote URLs and unwanted HTML attributes.
function cleanEmailImage(node){
  const src=node.getAttribute("src")||"";
  if(!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\r\n]+$/.test(src))return document.createDocumentFragment();
  const image=document.createElement("img");image.src=src;image.alt=(node.getAttribute("alt")||"Bild").slice(0,300);
  for(const attr of ["width","height"]){
    const value=Number(node.getAttribute(attr));if(Number.isInteger(value)&&value>0)image.setAttribute(attr,String(Math.min(1600,value)));
  }
  return image;
}
let activeEmailImageEditor=null,activeEmailImage=null,emailImageData=null,imageUploadRevision=0,pendingImageExportAction=null;

function openEmailImageDialog(editorId,image=null){
  activeEmailImageEditor=byId(editorId);activeEmailImage=image;rememberEditorSelection(activeEmailImageEditor);
  emailImageData=null;imageUploadRevision++;
  byId("emailImageFile").value="";byId("emailImageAlt").value=image?.alt||"";
  byId("emailImageWidth").value=image?.getAttribute("width")||600;
  byId("emailImageError").textContent="";byId("removeEmailImageButton").hidden=!image;
  byId("saveEmailImageButton").disabled=!image;
  const preview=byId("emailImagePreview");preview.hidden=!image;
  if(image){
    emailImageData={src:image.src,width:image.naturalWidth||Number(image.width),height:image.naturalHeight||Number(image.height)};
    preview.src=image.src;byId("emailImageWidth").max=emailImageData.width;
  }else preview.removeAttribute("src");
  byId("emailImageDialog").showModal();
}
async function uploadEmailImage(){
  const file=byId("emailImageFile").files[0];if(!file)return;
  const revision=++imageUploadRevision;
  emailImageData=null;byId("saveEmailImageButton").disabled=true;byId("emailImagePreview").hidden=true;
  byId("emailImageError").textContent="Bild wird geprüft …";
  try{
    if(file.size>8_000_000)throw Error("Bitte ein Bild mit höchstens 8 MB auswählen.");
    const result=await api("/api/email/images",{method:"POST",body:JSON.stringify({content_base64:await fileAsBase64(file)})});
    // Ignore uploads that finish after cancellation or a newer file selection.
    if(revision!==imageUploadRevision||!byId("emailImageDialog").open)return;
    emailImageData=result;byId("emailImagePreview").src=result.src;byId("emailImagePreview").hidden=false;
    byId("emailImageWidth").max=result.width;byId("emailImageWidth").value=Math.min(600,result.width);
    if(!byId("emailImageAlt").value)byId("emailImageAlt").value=file.name.replace(/\.[^.]+$/,"");
    byId("emailImageError").textContent="";byId("saveEmailImageButton").disabled=false;
  }catch(error){if(revision===imageUploadRevision)byId("emailImageError").textContent=error.message}
}
function cancelEmailImage(){imageUploadRevision++;byId("emailImageDialog").close()}
function saveEmailImage(){
  if(!emailImageData||!activeEmailImageEditor)return;
  const width=Number(byId("emailImageWidth").value),limit=Math.min(1600,emailImageData.width);
  if(!Number.isInteger(width)||width<1||width>limit){byId("emailImageError").textContent=`Bitte eine Breite zwischen 1 und ${limit} Pixeln eingeben.`;return}
  const otherImages=Array.from(activeEmailImageEditor.querySelectorAll("img")).filter(image=>image!==activeEmailImage);
  const total=[...otherImages.map(image=>image.src),emailImageData.src].reduce((sum,src)=>sum+Math.ceil((src.split(",")[1]||"").length*3/4),0);
  if(otherImages.length>=10||total>4_000_000){byId("emailImageError").textContent="Höchstens 10 Bilder mit zusammen 4 MB pro E-Mail.";return}
  recordEditorHistory(activeEmailImageEditor);
  const image=document.createElement("img");image.src=emailImageData.src;image.alt=byId("emailImageAlt").value.trim().slice(0,300)||"Bild";
  image.width=width;image.height=Math.max(1,Math.round(emailImageData.height*width/emailImageData.width));
  byId("emailImageDialog").close();
  if(activeEmailImage&&activeEmailImageEditor.contains(activeEmailImage))activeEmailImage.replaceWith(image);
  else{const range=activeEditorRange(activeEmailImageEditor);range.deleteContents();range.insertNode(image)}
  selectAfterNode(image);rememberEditorSelection(activeEmailImageEditor);
  activeEmailImageEditor.dispatchEvent(new Event("input",{bubbles:true}));
}
function removeEmailImage(){
  if(!activeEmailImage||!activeEmailImageEditor?.contains(activeEmailImage))return;
  recordEditorHistory(activeEmailImageEditor);activeEmailImage.remove();byId("emailImageDialog").close();
  activeEmailImageEditor.dispatchEvent(new Event("input",{bubbles:true}));
}
function confirmImageTextExport(){
  const action=pendingImageExportAction;pendingImageExportAction=null;byId("imageExportDialog").close();
  if(action)executeOutputAction(action,true);
}
