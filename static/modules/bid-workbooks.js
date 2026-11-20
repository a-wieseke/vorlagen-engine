/** bid-workbooks: feature logic; state is scoped by domain in state.js. */
import {state,actions} from './state.js';

export function downloadBidWorkbook(){return actions.downloadUrl('/api/bid/import-template')}

export function clearBidWorkbookPreview(){
  state.bids.bidWorkbookPreviewState=null;
  state.shared.byId('bidWorkbookImportButton').disabled=true;
  state.shared.byId('bidWorkbookSummary').textContent='';state.shared.byId('bidWorkbookPreview').replaceChildren();
}

export function workbookContext(){return {project_id:Number(state.bids.bidImportProject.value),year:Number(state.shared.byId('bidImportYear').value)}}

export async function previewBidWorkbook(){
  actions.clearBidWorkbookPreview();
  const file=state.shared.byId('bidWorkbookFile').files[0],context=actions.workbookContext();
  if(!context.project_id)return actions.toast('Bitte ein Projekt auswählen.');
  if(!file||!file.name.toLowerCase().endsWith('.xlsx')||file.size>10000000)return actions.toast('Bitte eine XLSX-Datei mit höchstens 10 MB auswählen.');
  const button=state.shared.byId('bidWorkbookPreviewButton');button.disabled=true;
  try{
    const content_base64=await actions.fileAsBase64(file);
    const preview=await actions.api('/api/bid/xlsx/preview',{method:'POST',body:JSON.stringify({...context,content_base64})});
    // Do not enable a preview whose file/project changed while reading it.
    if(file!==state.shared.byId('bidWorkbookFile').files[0]||JSON.stringify(context)!==JSON.stringify(actions.workbookContext()))return;
    state.bids.bidWorkbookPreviewState={...context,content_base64,file};
    const errors=preview.rows.filter(row=>row.errors.length).length;
    state.shared.byId('bidWorkbookSummary').innerHTML=`<div class="${preview.valid?'info-box':'document-warning'}">${preview.rows.length} Zeilen · ${preview.importable} neue Fragen · ${preview.duplicates} Duplikate · ${errors} fehlerhafte Zeilen${!preview.rows.length?' – Bitte zuerst Fragen in die Excel-Datei eintragen.':''}</div>`;
    state.shared.byId('bidWorkbookPreview').innerHTML=`<table><thead><tr><th>Zeile</th><th>Kategorie / Thema</th><th>Bieter</th><th>Frage</th><th>Kommentar</th><th>Entscheidung / Antwort</th><th>Prüfung</th></tr></thead><tbody>${preview.rows.map(row=>`<tr class="${row.errors.length?'import-row-error':''}"><td>${row.row}</td><td>${actions.esc(row.category)}<br>${actions.esc(row.subject)}</td><td>${actions.esc(row.bidder)}</td><td class="multiline-cell">${actions.esc(row.question)}</td><td class="multiline-cell">${actions.esc(row.agency_comment)}</td><td class="multiline-cell">${actions.esc(row.decision)}<br>${actions.esc(row.answer)}</td><td>${row.errors.map(value=>`<p class="error-text">${actions.esc(value)}</p>`).join('')}${row.warnings.map(value=>`<p>${actions.esc(value)}</p>`).join('')}${!row.errors.length&&!row.warnings.length?'Bereit':''}</td></tr>`).join('')}</tbody></table>`;
    state.shared.byId('bidWorkbookImportButton').disabled=!preview.valid||!preview.importable;
  }catch(error){actions.toast(error.message)}finally{button.disabled=false}
}

export async function importBidWorkbook(){
  const preview=state.bids.bidWorkbookPreviewState,context=actions.workbookContext();
  if(!preview||preview.project_id!==context.project_id||preview.year!==context.year||preview.file!==state.shared.byId('bidWorkbookFile').files[0]){actions.clearBidWorkbookPreview();return actions.toast('Projekt, Jahr oder Datei geändert. Bitte erneut prüfen.')}
  state.shared.byId('bidWorkbookImportButton').disabled=true;
  try{
    const result=await actions.api('/api/bid/xlsx/import',{method:'POST',body:JSON.stringify({...context,content_base64:preview.content_base64})});
    actions.clearBidWorkbookPreview();state.shared.byId('bidWorkbookFile').value='';
    await actions.loadBidModule();
    state.shared.byId('bidWorkbookSummary').innerHTML=`<div class="info-box">${result.created} Fragen importiert. ${result.skipped} Duplikate übersprungen.</div>`;
  }catch(error){actions.clearBidWorkbookPreview();actions.toast(error.message+' Bitte die Vorschau erneut öffnen.')}
}
