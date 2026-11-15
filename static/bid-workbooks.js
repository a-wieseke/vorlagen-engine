/* XLSX preview is advisory. The server reparses the original file in the final
   transaction so stale taxonomy entries and duplicate imports cannot slip in. */
let bidWorkbookPreviewState = null;
function downloadBidWorkbook(){location.href='/api/bid/import-template'}
function clearBidWorkbookPreview(){
  bidWorkbookPreviewState=null;
  byId('bidWorkbookImportButton').disabled=true;
  byId('bidWorkbookSummary').textContent='';byId('bidWorkbookPreview').replaceChildren();
}
function workbookContext(){return {project_id:Number(bidImportProject.value),year:Number(byId('bidImportYear').value)}}
async function previewBidWorkbook(){
  clearBidWorkbookPreview();
  const file=byId('bidWorkbookFile').files[0],context=workbookContext();
  if(!context.project_id)return toast('Bitte ein Projekt auswählen.');
  if(!file||!file.name.toLowerCase().endsWith('.xlsx')||file.size>10000000)return toast('Bitte eine XLSX-Datei mit höchstens 10 MB auswählen.');
  const button=byId('bidWorkbookPreviewButton');button.disabled=true;
  try{
    const content_base64=await fileAsBase64(file);
    const preview=await api('/api/bid/xlsx/preview',{method:'POST',body:JSON.stringify({...context,content_base64})});
    // Do not enable a preview whose file/project changed while reading it.
    if(file!==byId('bidWorkbookFile').files[0]||JSON.stringify(context)!==JSON.stringify(workbookContext()))return;
    bidWorkbookPreviewState={...context,content_base64,file};
    const errors=preview.rows.filter(row=>row.errors.length).length;
    byId('bidWorkbookSummary').innerHTML=`<div class="${preview.valid?'info-box':'document-warning'}">${preview.rows.length} Zeilen · ${preview.importable} neue Fragen · ${preview.duplicates} Duplikate · ${errors} fehlerhafte Zeilen${!preview.rows.length?' – Bitte zuerst Fragen in die Excel-Datei eintragen.':''}</div>`;
    byId('bidWorkbookPreview').innerHTML=`<table><thead><tr><th>Zeile</th><th>Kategorie / Thema</th><th>Bieter</th><th>Frage</th><th>Kommentar</th><th>Entscheidung / Antwort</th><th>Prüfung</th></tr></thead><tbody>${preview.rows.map(row=>`<tr class="${row.errors.length?'import-row-error':''}"><td>${row.row}</td><td>${esc(row.category)}<br>${esc(row.subject)}</td><td>${esc(row.bidder)}</td><td class="multiline-cell">${esc(row.question)}</td><td class="multiline-cell">${esc(row.agency_comment)}</td><td class="multiline-cell">${esc(row.decision)}<br>${esc(row.answer)}</td><td>${row.errors.map(value=>`<p class="error-text">${esc(value)}</p>`).join('')}${row.warnings.map(value=>`<p>${esc(value)}</p>`).join('')}${!row.errors.length&&!row.warnings.length?'Bereit':''}</td></tr>`).join('')}</tbody></table>`;
    byId('bidWorkbookImportButton').disabled=!preview.valid||!preview.importable;
  }catch(error){toast(error.message)}finally{button.disabled=false}
}
async function importBidWorkbook(){
  const preview=bidWorkbookPreviewState,context=workbookContext();
  if(!preview||preview.project_id!==context.project_id||preview.year!==context.year||preview.file!==byId('bidWorkbookFile').files[0]){clearBidWorkbookPreview();return toast('Projekt, Jahr oder Datei geändert. Bitte erneut prüfen.')}
  byId('bidWorkbookImportButton').disabled=true;
  try{
    const result=await api('/api/bid/xlsx/import',{method:'POST',body:JSON.stringify({...context,content_base64:preview.content_base64})});
    clearBidWorkbookPreview();byId('bidWorkbookFile').value='';
    await loadBidModule();
    byId('bidWorkbookSummary').innerHTML=`<div class="info-box">${result.created} Fragen importiert. ${result.skipped} Duplikate übersprungen.</div>`;
  }catch(error){clearBidWorkbookPreview();toast(error.message+' Bitte die Vorschau erneut öffnen.')}
}
