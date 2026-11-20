/** dashboard: feature logic; state is scoped by domain in state.js. */
import {state,actions} from './state.js';

export async function loadDashboard(){
  const data=await actions.api("/api/dashboard");state.dashboard.dashboardTiles=data.tiles;state.dashboard.showFavoritesTile=!!data.show_favorites;
  state.dashboard.showQuicklinksTile=!!data.show_quicklinks;state.dashboard.dashboardQuicklinks=data.quicklinks||[];actions.renderDashboard();actions.updateDashboardCategoryOptions();
}

export function renderDashboard(){
  if(!state.dashboard.dashboardTilesElement)return;
  const favoriteTemplates=state.library.templates.filter(template=>template.active&&!template.archived&&state.dashboard.favoriteTemplateIds.has(template.id));
  const tileTemplateRows=list=>list.length?list.map(template=>`<div class="tile-template-row"><button class="tile-template-open" onclick="openTemplateFromDashboard(${template.id})">${actions.esc(template.name)}</button>${actions.hasPermission("templates_manage")?`<button class="tile-template-edit" title="Vorlage bearbeiten" aria-label="${actions.esc(template.name)} bearbeiten" onclick="openTemplateEditor(${template.id})">✎</button>`:""}</div>`).join(""):"";
  const favoriteTile=state.dashboard.showFavoritesTile?`<article class="dashboard-tile favorite-tile"><div class="tile-head"><h3>★ Favoriten</h3><button title="Kachel entfernen" onclick="removeFavoriteTile()">×</button></div><div class="tile-links">${tileTemplateRows(favoriteTemplates)||"<p class='muted'>Noch keine Favoriten markiert.</p>"}</div></article>`:"";
  const quicklinkRows=state.dashboard.dashboardQuicklinks.length?state.dashboard.dashboardQuicklinks.map(link=>`<div class="quicklink-row" draggable="true" data-quicklink-id="${link.id}" ondragstart="beginQuicklinkDrag(event,${link.id})" ondragover="allowQuicklinkDrop(event)" ondragleave="event.currentTarget.classList.remove('drag-over')" ondrop="dropQuicklink(event,${link.id})" ondragend="endQuicklinkDrag()">${link.link_type==="internal"?`<button type="button" onclick="openInternalQuicklink('${actions.esc(link.target)}')">${actions.menuIcon("external")}<span>${actions.esc(link.title)}</span></button>`:`<a href="${actions.esc(link.url)}" target="_blank" rel="noopener noreferrer">${actions.menuIcon("external")}<span>${actions.esc(link.title)}</span></a>`}</div>`).join(""):"<p class='muted'>Noch keine Quicklinks angelegt.</p>";
  const quicklinkTile=state.dashboard.showQuicklinksTile?`<article class="dashboard-tile quicklink-tile"><div class="tile-head"><h3>Quicklinks</h3><div class="tile-head-actions"><button title="Quicklinks verwalten" aria-label="Quicklinks verwalten" onclick="openQuicklinkDialog()">${actions.menuIcon("settings")}</button><button title="Kachel entfernen" aria-label="Quicklink-Kachel entfernen" onclick="removeQuicklinksTile()">×</button></div></div><div class="tile-links">${quicklinkRows}</div></article>`:"";
  const categoryTiles=state.dashboard.dashboardTiles.map(tile=>`<article class="dashboard-tile" data-tile-id="${tile.id}" ondragover="allowDashboardDrop(event)" ondragleave="clearDashboardDrop(event)" ondrop="dropDashboardTile(event,${tile.id})">
    <div class="tile-head"><div class="template-row-content"><span class="drag-handle dashboard-drag-handle" draggable="true" title="Kachel verschieben" aria-label="Kachel verschieben" ondragstart="beginDashboardDrag(event,${tile.id})" ondragend="endDashboardDrag()">⋮⋮</span><h3>${actions.esc(tile.category.name)}</h3></div><button title="Kachel entfernen" onclick="removeDashboardTile(${tile.id})">×</button></div>
    <div class="tile-links">${tileTemplateRows(tile.templates)||"<p class='muted'>Keine freigegebenen Vorlagen.</p>"}</div>
  </article>`).join("");
  state.dashboard.dashboardTilesElement.innerHTML=favoriteTile+quicklinkTile+categoryTiles||( "<div class='card empty-dashboard'><h3>Noch keine Kacheln</h3><p>Wählen Sie oben eine Kategorie und fügen Sie Ihre erste Kachel hinzu oder markieren Sie Vorlagen als Favoriten.</p></div>");
}

export function updateDashboardCategoryOptions(){
  if(!state.dashboard.dashboardCategorySelect)return;const used=new Set(state.dashboard.dashboardTiles.map(tile=>tile.category.id));
  const favoriteOption=state.dashboard.showFavoritesTile?"":'<option value="favorites">★ Favoriten</option>';
  const quicklinksOption=state.dashboard.showQuicklinksTile?"":'<option value="quicklinks">Quicklinks</option>';
  state.dashboard.dashboardCategorySelect.innerHTML=favoriteOption+quicklinksOption+state.library.categories.filter(category=>category.active&&!used.has(category.id)).map(category=>`<option value="${category.id}">${actions.esc(category.name)}</option>`).join("");
}

export async function addDashboardTile(){
  if(!state.dashboard.dashboardCategorySelect.value)return actions.toast("Keine weitere Kategorie verfügbar.");
  try{
    if(state.dashboard.dashboardCategorySelect.value==="favorites")await actions.api("/api/dashboard/favorites",{method:"PUT",body:JSON.stringify({visible:true})});
    else if(state.dashboard.dashboardCategorySelect.value==="quicklinks")await actions.api("/api/dashboard/quicklinks/visibility",{method:"PUT",body:JSON.stringify({visible:true})});
    else await actions.api("/api/dashboard",{method:"POST",body:JSON.stringify({category_id:Number(state.dashboard.dashboardCategorySelect.value)})});
    await actions.loadDashboard()
  }
  catch(error){actions.toast(error.message)}
}

export async function removeFavoriteTile(){try{await actions.api("/api/dashboard/favorites",{method:"PUT",body:JSON.stringify({visible:false})});await actions.loadDashboard()}catch(error){actions.toast(error.message)}}

export async function removeQuicklinksTile(){try{await actions.api("/api/dashboard/quicklinks/visibility",{method:"PUT",body:JSON.stringify({visible:false})});await actions.loadDashboard()}catch(error){actions.toast(error.message)}}

export async function removeDashboardTile(id){try{await actions.api("/api/dashboard/"+id,{method:"DELETE"});await actions.loadDashboard()}catch(error){actions.toast(error.message)}}

export function internalQuicklinkAllowed(item){return !item.permission&&!item.anyPermission||item.permission&&actions.hasPermission(item.permission)||item.anyPermission?.some(actions.hasPermission)}

export function openQuicklinkDialog(){
  state.shared.byId("quicklinkTarget").innerHTML=state.shared.INTERNAL_QUICKLINKS.filter(actions.internalQuicklinkAllowed).map(item=>`<option value="${actions.esc(item.target)}">${actions.esc(item.label)}</option>`).join("");
  actions.toggleQuicklinkType();actions.renderQuicklinkList();state.shared.quicklinkDialog.showModal();
}

export function toggleQuicklinkType(){const internal=state.shared.byId("quicklinkType").value==="internal";state.shared.byId("quicklinkUrlWrap").hidden=internal;state.shared.byId("quicklinkTargetWrap").hidden=!internal}

export function renderQuicklinkList(){
  const target=state.shared.byId("quicklinkList");if(!target)return;
  target.innerHTML=state.dashboard.dashboardQuicklinks.length?state.dashboard.dashboardQuicklinks.map(link=>`<div class="list-item quicklink-admin-row" draggable="true" data-quicklink-id="${link.id}" ondragstart="beginQuicklinkDrag(event,${link.id})" ondragover="allowQuicklinkDrop(event)" ondragleave="event.currentTarget.classList.remove('drag-over')" ondrop="dropQuicklink(event,${link.id})" ondragend="endQuicklinkDrag()"><div class="template-row-content"><span class="drag-handle" aria-hidden="true">⋮⋮</span><div><b>${actions.esc(link.title)}</b><div class="small">${link.link_type==="internal"?"Interne Seite: "+actions.esc(state.shared.INTERNAL_QUICKLINKS.find(item=>item.target===link.target)?.label||link.target):actions.esc(link.url)}</div></div></div><button type="button" class="danger" onclick="deleteQuicklink(${link.id})">${actions.menuIcon("trash")} Entfernen</button></div>`).join(""):"<p class='muted'>Noch keine Quicklinks angelegt.</p>";
}

export async function addQuicklink(){
  try{await actions.api("/api/dashboard/quicklinks",{method:"POST",body:JSON.stringify({title:state.shared.byId("quicklinkTitle").value,url:state.shared.byId("quicklinkUrl").value,link_type:state.shared.byId("quicklinkType").value,target:state.shared.byId("quicklinkTarget").value})});state.shared.byId("quicklinkTitle").value=state.shared.byId("quicklinkUrl").value="";await actions.loadDashboard();actions.renderQuicklinkList();actions.toast("Quicklink hinzugefügt.")}
  catch(error){actions.toast(error.message)}
}

export function openInternalQuicklink(target){const item=state.shared.INTERNAL_QUICKLINKS.find(entry=>entry.target===target);if(!item||!actions.internalQuicklinkAllowed(item))return actions.toast("Für diese Seite fehlt die Berechtigung.");actions.switchTab(target)}

export function beginQuicklinkDrag(event,id){state.dashboard.draggedQuicklinkId=id;event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(id))}

export function allowQuicklinkDrop(event){if(state.dashboard.draggedQuicklinkId){event.preventDefault();event.dataTransfer.dropEffect="move";event.currentTarget.classList.add("drag-over")}}

export function endQuicklinkDrag(){state.dashboard.draggedQuicklinkId=null;document.querySelectorAll(".quicklink-row.drag-over,.quicklink-admin-row.drag-over").forEach(row=>row.classList.remove("drag-over"))}

export async function dropQuicklink(event,targetId){
  event.preventDefault();event.currentTarget.classList.remove("drag-over");if(!state.dashboard.draggedQuicklinkId||state.dashboard.draggedQuicklinkId===targetId)return actions.endQuicklinkDrag();
  const dragged=state.dashboard.dashboardQuicklinks.find(link=>link.id===state.dashboard.draggedQuicklinkId),remaining=state.dashboard.dashboardQuicklinks.filter(link=>link.id!==state.dashboard.draggedQuicklinkId),targetIndex=remaining.findIndex(link=>link.id===targetId),rect=event.currentTarget.getBoundingClientRect();
  remaining.splice(targetIndex+(event.clientY>rect.top+rect.height/2?1:0),0,dragged);state.dashboard.dashboardQuicklinks=remaining;actions.endQuicklinkDrag();actions.renderDashboard();actions.renderQuicklinkList();
  try{await actions.api("/api/dashboard/quicklinks/order",{method:"PUT",body:JSON.stringify({link_ids:state.dashboard.dashboardQuicklinks.map(link=>link.id)})});actions.toast("Quicklink-Reihenfolge gespeichert.")}catch(error){actions.toast(error.message);await actions.loadDashboard();actions.renderQuicklinkList()}
}

export async function deleteQuicklink(id){
  try{await actions.api(`/api/dashboard/quicklinks/${id}`,{method:"DELETE"});await actions.loadDashboard();actions.renderQuicklinkList();actions.toast("Quicklink entfernt.")}
  catch(error){actions.toast(error.message)}
}

export function beginDashboardDrag(event,id){state.dashboard.draggedDashboardTileId=id;event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("text/plain",String(id))}

export function allowDashboardDrop(event){if(state.dashboard.draggedDashboardTileId){event.preventDefault();event.dataTransfer.dropEffect="move";event.currentTarget.classList.add("drag-over")}}

export function clearDashboardDrop(event){event.currentTarget.classList.remove("drag-over")}

export function endDashboardDrag(){document.querySelectorAll(".dashboard-tile.drag-over").forEach(tile=>tile.classList.remove("drag-over"));state.dashboard.draggedDashboardTileId=null}

export async function dropDashboardTile(event,targetTileId){
  event.preventDefault();actions.clearDashboardDrop(event);
  if(!state.dashboard.draggedDashboardTileId||state.dashboard.draggedDashboardTileId===targetTileId)return actions.endDashboardDrag();
  const dragged=state.dashboard.dashboardTiles.find(tile=>tile.id===state.dashboard.draggedDashboardTileId),remaining=state.dashboard.dashboardTiles.filter(tile=>tile.id!==state.dashboard.draggedDashboardTileId);
  const targetIndex=remaining.findIndex(tile=>tile.id===targetTileId),rect=event.currentTarget.getBoundingClientRect();
  const after=event.clientY>rect.top+rect.height/2||event.clientX>rect.left+rect.width/2;
  remaining.splice(targetIndex+(after?1:0),0,dragged);state.dashboard.dashboardTiles=remaining;actions.endDashboardDrag();actions.renderDashboard();
  try{await actions.api("/api/dashboard/order",{method:"PUT",body:JSON.stringify({tile_ids:state.dashboard.dashboardTiles.map(tile=>tile.id)})});actions.toast("Kachelreihenfolge gespeichert.")}
  catch(error){actions.toast(error.message);await actions.loadDashboard()}
}

export function openTemplateFromDashboard(id){actions.openTemplate(id,true)}

export function openDashboardTemplateSearch(){
  state.dashboard.dashboardTemplateDialogSearch.value=state.dashboard.dashboardTemplateSearch.value||"";
  actions.renderDashboardTemplateSearchResults();state.dashboard.dashboardTemplateDialog.showModal();state.dashboard.dashboardTemplateDialogSearch.focus();
}

export function closeDashboardTemplateSearch(){state.dashboard.dashboardTemplateDialog.close();state.dashboard.dashboardTemplateSearch.value=""}

export function renderDashboardTemplateSearchResults(){
  if(!state.dashboard.dashboardTemplateSearchResults)return;
  const filtered=state.library.templates.filter(template=>actions.templateMatches(template,state.dashboard.dashboardTemplateDialogSearch?.value));
  state.dashboard.dashboardTemplateSearchResults.innerHTML=filtered.length?filtered.map(template=>`<div class="dashboard-template-result">
    <div><b>${actions.esc(template.category)}</b><span>${actions.esc(template.name)}${template.archived?" · archiviert":template.active?"":" · inaktiv"}</span></div>
    <div class="actions compact">${template.active&&!template.archived&&actions.hasPermission("email_create")?`<button type="button" onclick="createEmailFromDashboardSearch(${template.id})">E-Mail erstellen</button>`:""}${actions.hasPermission("templates_manage")?`<button type="button" onclick="editTemplateFromDashboardSearch(${template.id})">Vorlage bearbeiten</button>`:""}</div>
  </div>`).join(""):"<p class='muted'>Keine passenden Vorlagen gefunden.</p>";
}

export function createEmailFromDashboardSearch(id){actions.closeDashboardTemplateSearch();actions.openTemplate(id,true)}

export function editTemplateFromDashboardSearch(id){actions.closeDashboardTemplateSearch();actions.editTemplate(id)}

export async function loadFavorites(){
  const data=await actions.api("/api/favorites");state.dashboard.favoriteTemplateIds=new Set(data.template_ids||[]);
  actions.renderTemplatePickerResults();actions.renderDashboard();
}

export async function toggleFavorite(id){
  try{
    if(state.dashboard.favoriteTemplateIds.has(id))await actions.api(`/api/favorites/${id}`,{method:"DELETE"});
    else await actions.api("/api/favorites",{method:"POST",body:JSON.stringify({template_id:id})});
    await actions.loadFavorites();actions.toast(state.dashboard.favoriteTemplateIds.has(id)?"Vorlage als Favorit gespeichert.":"Favorit entfernt.");
  }catch(error){actions.toast(error.message)}
}
