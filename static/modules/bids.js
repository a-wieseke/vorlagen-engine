/** bids: feature logic; state is scoped by domain in state.js. */
import {state,actions} from './state.js';

export async function loadBidders(){try{const data=await actions.api("/api/bidders");state.bids.bidders=data.bidders||[];actions.updateBidFilterOptions();actions.updateSingleBidderButton();actions.renderBidderDirectory()}catch(error){actions.toast(error.message)}}

export async function loadBidModule(){
  try{
    const requests=[actions.api("/api/bid/categories"),actions.api("/api/bid/topics"),actions.api("/api/bid/answers"),actions.api("/api/bidders")];
    if(actions.hasPermission("bid_questions_view")||actions.hasPermission("bid_questions_manage"))requests.push(actions.api("/api/bid/questions"));
    const [categoryData,topicData,answerData,bidderData,questionData]=await Promise.all(requests);
    state.bids.bidCategories=categoryData.categories||[];state.bids.bidTopics=topicData.topics||[];state.bids.bidAnswers=answerData.answers||[];state.bids.bidders=bidderData.bidders||[];state.bids.bidQuestions=questionData?.questions||[];
    actions.updateBidProjectOptions();actions.updateBidFilterOptions();actions.updateBidTaxonomyOptions();actions.updateSingleBidTaxonomyButtons();actions.updateSingleBidderButton();actions.renderBidQuestionList();actions.renderBidAnswerLibrary();actions.renderBidTaxonomy();actions.renderBidBatchRows();actions.renderBidderDirectory();
  }catch(error){actions.toast(error.message)}
}

export function updateBidFilterOptions(){
  if(state.bids.bidQuestionCategoryFilter){const before=state.bids.bidQuestionCategoryFilter.value,names=[...new Set([...state.bids.bidCategories.map(item=>item.name),...state.bids.bidQuestions.map(item=>item.category).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"de"));state.bids.bidQuestionCategoryFilter.innerHTML='<option value="">Alle Kategorien</option>'+names.map(name=>`<option value="${actions.esc(name)}">${actions.esc(name)}</option>`).join("");state.bids.bidQuestionCategoryFilter.value=names.includes(before)?before:""}
  if(state.bids.bidQuestionBidderFilter){const before=state.bids.bidQuestionBidderFilter.value,names=[...new Set([...state.bids.bidders.map(item=>item.bidder),...state.bids.bidQuestions.map(item=>item.bidder).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"de"));state.bids.bidQuestionBidderFilter.innerHTML='<option value="">Alle Bieter</option>'+names.map(name=>`<option value="${actions.esc(name)}">${actions.esc(name)}</option>`).join("");state.bids.bidQuestionBidderFilter.value=names.includes(before)?before:""}
}

export function activeProjects(){return state.projects.projects.filter(project=>!project.archived)}

export function updateBidProjectOptions(){
  const options=actions.activeProjects().map(project=>`<option value="${project.id}">${actions.esc(project.project_key)} – ${actions.esc(project.name)}</option>`).join("");
  if(state.bids.bidQuestionProjectFilter){const before=state.bids.bidQuestionProjectFilter.value;state.bids.bidQuestionProjectFilter.innerHTML='<option value="">Alle Projekte</option>'+options;state.bids.bidQuestionProjectFilter.value=actions.activeProjects().some(project=>String(project.id)===before)?before:""}
  actions.updateBidProjectButton("single");actions.updateBidProjectButton("batch");actions.updateBidProjectButton("import");
}

export function bidProjectTargetElements(target){
  if(target==="batch")return {input:state.bids.bidBatchProject,button:state.bids.bidBatchProjectButton};
  if(target==="import")return {input:state.bids.bidImportProject,button:state.bids.bidImportProjectButton};
  return {input:state.bids.bidQuestionProject,button:state.shared.byId("bidQuestionProjectButton")};
}

export function updateBidProjectButton(target){
  const {input,button}=actions.bidProjectTargetElements(target);if(!input||!button)return;
  const project=state.projects.projects.find(item=>String(item.id)===input.value);
  button.textContent=project?`${project.project_key} – ${project.name}`:"Projekt auswählen...";
  button.classList.toggle("has-selection",!!project);
}

export function openBidProjectPicker(target){
  state.bids.activeBidProjectTarget=target;state.bids.bidProjectPickerSearch.value="";actions.renderBidProjectPickerResults();state.bids.bidProjectPickerDialog.showModal();state.bids.bidProjectPickerSearch.focus();
}

export function renderBidProjectPickerResults(){
  const filtered=actions.activeProjects().filter(project=>actions.projectMatches(project,state.bids.bidProjectPickerSearch.value));
  state.bids.bidProjectPickerResults.innerHTML=filtered.length?filtered.map(project=>`<button type="button" onclick="chooseBidProject(${project.id})"><b>${actions.esc(project.project_key)}</b><span>${actions.esc(project.name)}</span></button>`).join(""):"<p class='muted'>Keine passenden Projekte gefunden.</p>";
}

export function chooseBidProject(id){
  const {input}=actions.bidProjectTargetElements(state.bids.activeBidProjectTarget);if(input)input.value=String(id);
  actions.updateBidProjectButton(state.bids.activeBidProjectTarget);state.bids.bidProjectPickerDialog.close();
}

export function openBidderPicker(target,rowId=null){state.bids.activeBidderTarget=target;state.shared.activeBatchRowId=rowId;state.bids.bidderPickerSearch.value="";actions.renderBidderPickerResults();state.bids.bidderPickerDialog.showModal();state.bids.bidderPickerSearch.focus()}

export function renderBidderPickerResults(){
  const needle=state.bids.bidderPickerSearch.value.trim().toLocaleLowerCase("de");
  const filtered=state.bids.bidders.filter(item=>item.active&&(!needle||[item.bidder,item.company_name,item.street,item.postal_code,item.city,item.country].join(" ").toLocaleLowerCase("de").includes(needle)));
  state.bids.bidderPickerResults.innerHTML=filtered.length?filtered.map(item=>`<button type="button" onclick="chooseBidder(${item.id})"><b>${actions.esc(item.bidder)}</b><span>${actions.esc([item.company_name,item.city].filter(Boolean).join(" · "))}</span></button>`).join(""):"<p class='muted'>Keine passenden Bieter gefunden.</p>";
}

export function chooseBidder(id){
  const bidder=state.bids.bidders.find(item=>item.id===Number(id));if(!bidder)return;
  if(state.bids.activeBidderTarget==="single"){state.shared.byId("bidQuestionBidderId").value=String(bidder.id);actions.updateSingleBidderButton()}
  else{const row=state.bids.bidBatchItems.find(item=>item.id===state.shared.activeBatchRowId);if(row){row.bidder_id=bidder.id;row.bidder=bidder.bidder}actions.renderBidBatchRows()}
  state.bids.bidderPickerDialog.close();
}

export async function createQuickBidder(){const name=state.shared.byId("quickBidderName").value.trim();if(!name)return actions.toast("Bitte einen Bieternamen eingeben.");try{const data=await actions.api("/api/bidders",{method:"POST",body:JSON.stringify({bidder:name,company_name:state.shared.byId("quickBidderCompany").value,active:true})});await actions.loadBidders();state.shared.byId("quickBidderName").value=state.shared.byId("quickBidderCompany").value="";actions.chooseBidder(data.id);actions.toast("Bieter wurde angelegt.")}catch(error){actions.toast(error.message)}}

export function updateSingleBidderButton(){const bidder=state.bids.bidders.find(item=>String(item.id)===state.shared.byId("bidQuestionBidderId")?.value),button=state.shared.byId("bidQuestionBidderButton");if(!button)return;button.textContent=bidder?.bidder||"Bieter auswählen...";button.classList.toggle("has-selection",!!bidder)}

export function renderBidderDirectory(){
  if(!state.bids.bidderDirectoryList)return;const needle=String(state.bids.bidderDirectorySearch?.value||"").trim().toLocaleLowerCase("de");
  const matching=state.bids.bidders.filter(item=>!needle||[item.bidder,item.company_name,item.street,item.postal_code,item.city,item.country,item.website,item.comment].join(" ").toLocaleLowerCase("de").includes(needle));
  state.bids.bidderDirectoryList.classList.remove("bidder-directory-grid");
  state.bids.bidderDirectoryList.classList.add("bidder-table-wrapper");
  state.bids.bidderDirectoryList.innerHTML=matching.length?`<table class="bidder-table"><caption class="visually-hidden">Bieterverzeichnis</caption><thead><tr>${["Bieter","Firmenname","Straße","PLZ","Ort","Land","Website","Kommentar","Status",...(actions.hasPermission("projects_manage")?["Aktionen"]:[])].map(label=>`<th scope="col">${label}</th>`).join("")}</tr></thead><tbody>${matching.map(item=>{
    const url=actions.safeLinkUrl(item.website);
    return `<tr><th scope="row"><button type="button" class="text-button" onclick="viewBidder(${item.id})">${actions.esc(item.bidder)}</button></th>${[item.company_name,item.street,item.postal_code,item.city,item.country].map(value=>`<td>${actions.esc(value||"–")}</td>`).join("")}<td>${/^https?:\/\//i.test(url)?`<a href="${actions.esc(url)}" target="_blank" rel="noopener noreferrer">${actions.esc(item.website)}</a>`:actions.esc(item.website||"–")}</td><td class="bidder-comment">${actions.esc(item.comment||"–")}</td><td><span class="status-pill ${item.active?"active":"inactive"}">${item.active?"aktiv":"inaktiv"}</span></td>${actions.hasPermission("projects_manage")?`<td><button type="button" title="Bieter bearbeiten" aria-label="Bieter bearbeiten" onclick="editBidder(${item.id})">${actions.menuIcon("edit")}</button></td>`:""}</tr>`;
  }).join("")}</tbody></table>`:"<p class='muted'>Keine Bieter gefunden.</p>";
}

export function newBidder(){state.bids.editingBidderId=null;["bidderId","bidderName","bidderCompany","bidderStreet","bidderPostalCode","bidderCity","bidderCountry","bidderWebsite","bidderComment"].forEach(id=>state.shared.byId(id).value="");state.shared.byId("bidderActive").checked=true;state.shared.byId("deleteBidderButton").hidden=true}

export function editBidder(id){const item=state.bids.bidders.find(entry=>entry.id===Number(id));if(!item||!actions.hasPermission("projects_manage"))return;state.bids.editingBidderId=item.id;state.shared.byId("bidderId").value=item.id;state.shared.byId("bidderName").value=item.bidder;state.shared.byId("bidderCompany").value=item.company_name;state.shared.byId("bidderStreet").value=item.street;state.shared.byId("bidderPostalCode").value=item.postal_code;state.shared.byId("bidderCity").value=item.city;state.shared.byId("bidderCountry").value=item.country;state.shared.byId("bidderWebsite").value=item.website;state.shared.byId("bidderComment").value=item.comment||"";state.shared.byId("bidderActive").checked=item.active;state.shared.byId("deleteBidderButton").hidden=false;actions.switchTab("bidder-create")}

export function bidderFormPayload(){return {bidder:state.shared.byId("bidderName").value,company_name:state.shared.byId("bidderCompany").value,street:state.shared.byId("bidderStreet").value,postal_code:state.shared.byId("bidderPostalCode").value,city:state.shared.byId("bidderCity").value,country:state.shared.byId("bidderCountry").value,website:state.shared.byId("bidderWebsite").value,comment:state.shared.byId("bidderComment").value,active:state.shared.byId("bidderActive").checked}}

export function openNewBidder(){actions.newBidder();actions.switchTab("bidder-create")}

export async function saveBidder(){
  const id=state.bids.editingBidderId,save=WveDrafts.beginSave(state.shared.byId('tab-bidder-create'));
  try{
    await actions.api(id?`/api/bidders/${id}`:"/api/bidders",{method:id?"PUT":"POST",body:JSON.stringify(actions.bidderFormPayload())});
    if(WveDrafts.finishSave(save))actions.openNewBidder();
    await actions.loadBidders();actions.toast("Bieter gespeichert.");
  }catch(error){actions.toast(error.message)}
}

export async function deleteBidder(){if(!state.bids.editingBidderId)return;try{await actions.api(`/api/bidders/${state.bids.editingBidderId}`,{method:"DELETE"});actions.newBidder();await actions.loadBidders();actions.toast("Bieter gelöscht.")}catch(error){actions.toast(error.message)}}

export function parseBidderImport(){const raw=state.shared.byId("bidderImportText").value.trim();if(!raw)return [];if(raw.startsWith("{")||raw.startsWith("[")){const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:(parsed.bidders||[parsed])}const lines=raw.replace(/\r/g,"").split("\n").filter(Boolean),delimiter=lines.some(line=>line.includes("\t"))?"\t":";";const rows=lines.map(line=>actions.parseDelimitedLine(line,delimiter));if(rows[0]?.[0]?.toLocaleLowerCase("de").includes("bieter"))rows.shift();return rows.map(row=>({bidder:row[0]||"",company_name:row[1]||"",street:row[2]||"",postal_code:row[3]||"",city:row[4]||"",country:row[5]||"",website:row[6]||"",comment:row[7]||""}))}

export async function importBidders(){try{const items=actions.parseBidderImport();if(!items.length)return actions.toast("Keine Bieter erkannt.");const data=await actions.api("/api/bidders/import",{method:"POST",body:JSON.stringify({bidders:items})});state.shared.byId("bidderImportText").value="";await actions.loadBidders();actions.toast(`${data.saved} Bieter gespeichert.`)}catch(error){actions.toast(error.message)}}

export function downloadBidderExampleJson(){return actions.downloadUrl('/api/bidders/example-json')}

export function bidQuestionMatches(item,needle){
  const search=String(needle||"").trim().toLocaleLowerCase("de");
  if(!search)return true;
  const selected=Array.from(document.querySelectorAll("[data-bid-search-field]:checked")).map(input=>input.dataset.bidSearchField);
  return selected.some(field=>String(item[field]||"").toLocaleLowerCase("de").includes(search));
}

export function bidQuestionStatus(item){
  if(item.answered_at)return "beantwortet";
  if(String(item.answer||"").trim())return "Antwort erstellt";
  const decision=String(item.decision||"").trim().toLocaleLowerCase("de");
  return decision&&!["offen","ausstehend","noch offen","-"].includes(decision)?"entschieden":"offen";
}

export function renderBidQuestionList(){
  if(!state.bids.bidQuestionList)return;
  const projectId=Number(state.bids.bidQuestionProjectFilter?.value)||0;
  const categoryName=state.bids.bidQuestionCategoryFilter?.value||"",bidderName=state.bids.bidQuestionBidderFilter?.value||"";
  const filtered=state.bids.bidQuestions.filter(item=>(!projectId||item.project_id===projectId)&&(!categoryName||item.category===categoryName)&&(!bidderName||item.bidder===bidderName)&&actions.bidQuestionMatches(item,state.bids.bidQuestionSearch?.value));
  state.bids.bidQuestionList.innerHTML=filtered.length?filtered.map(item=>`<article class="bid-question-card">
    <header><button type="button" class="text-button" onclick="openBidQuestion(${item.id})"><b>${actions.esc(item.project_key)} – ${actions.esc(item.project_name)}</b></button><span class="bid-status ${item.answered_at?"done":""}">${actions.bidQuestionStatus(item)}</span></header>
    <div class="bid-question-lines">
      ${actions.bidOverviewLine("Fragenkategorie",item.category||"—")}${actions.bidOverviewLine("Bieter",item.bidder||"—")}${actions.bidOverviewLine("Thema",item.subject||"—")}
      ${actions.bidOverviewLine("Bieterfrage",item.question)}${actions.bidOverviewLine("Kommentar Agentur Wieseke",item.agency_comment||"—")}${actions.bidOverviewLine("Entscheidung",item.decision||"—")}${actions.bidOverviewLine("Antwort",item.answer||"—")}
    </div>
    <footer><button type="button" onclick="openBidQuestion(${item.id})">Öffnen</button>${actions.hasPermission("bid_questions_manage")&&item.answer&&!item.answered_at?`<button type="button" class="success-button" onclick="acknowledgeBidQuestion(${item.id})">Beantwortung quittieren</button>`:""}</footer>
  </article>`).join(""):"<p class='muted'>Keine passenden Bieterfragen gefunden.</p>";
}

export function bidOverviewLine(label,value){return `<div><b>${actions.esc(label)}</b><span>${actions.esc(value).replace(/\n/g,"<br>")}</span></div>`}

export function bidDetailField(label,value){return `<section><h4>${actions.esc(label)}</h4><div>${actions.esc(value||"—").replace(/\n/g,"<br>")}</div></section>`}

export function openBidQuestion(id){
  const item=state.bids.bidQuestions.find(question=>question.id===Number(id))||(state.projects.currentProjectWorkspace.bid_questions||[]).find(question=>question.id===Number(id));if(!item)return;
  state.shared.byId("bidQuestionDialogTitle").textContent=item.subject||"Bieterfrage";
  state.shared.byId("bidQuestionDialogMeta").textContent=`${item.project_key} – ${item.project_name} · ${item.category||"Ohne Kategorie"} · ${item.bidder||"Bieter nicht angegeben"}`;
  state.shared.byId("bidQuestionDialogContent").innerHTML=actions.bidDetailField("Bieterfrage",item.question)+actions.bidDetailField("Kommentar Agentur Wieseke",item.agency_comment)+actions.bidDetailField("Entscheidung",item.decision)+actions.bidDetailField("Antwort",item.answer);
  state.shared.byId("bidQuestionDialogActions").innerHTML=actions.hasPermission("bid_questions_manage")?`${item.answer&&!item.answered_at?`<button type="button" class="success-button" onclick="acknowledgeBidQuestion(${item.id})">Beantwortung quittieren</button>`:""}<button type="button" onclick="editBidQuestion(${item.id})">Bearbeiten</button><button type="button" class="danger" onclick="deleteBidQuestion(${item.id})">Bieterfrage löschen</button>`:"";
  state.shared.byId('tab-bid-question-detail').dataset.record=item.id;
  actions.switchTab('bid-question-detail');
}

export async function acknowledgeBidQuestion(id){
  try{await actions.api(`/api/bid/questions/${id}/acknowledge`,{method:"PUT",body:"{}"});if(state.bids.bidQuestionDialog.open)state.bids.bidQuestionDialog.close();await actions.loadBidModule();if(state.projects.currentProjectDetailId)await actions.loadProjectWorkspace(state.projects.currentProjectDetailId);actions.toast("Beantwortung wurde quittiert.")}catch(error){actions.toast(error.message)}
}

export function clearBidQuestionForm(){
  state.bids.editingBidQuestionId=null;["bidQuestionProject","bidQuestionCategoryId","bidQuestionTopicId","bidQuestionBidderId","bidQuestionStandardAnswerId","bidQuestionStandardVariantId","bidQuestionText","bidQuestionComment","bidQuestionDecision","bidQuestionAnswer"].forEach(id=>state.shared.byId(id).value="");
  actions.setCurrentBidYear("bidQuestionYear");actions.updateBidProjectButton("single");actions.updateSingleBidTaxonomyButtons();actions.updateSingleBidderButton();
}

export function openNewBidQuestion(){actions.clearBidQuestionForm();actions.switchTab("bid-question-create")}

export function setCurrentBidYear(id){const input=state.shared.byId(id);if(input)input.value=String(new Date().getFullYear())}

export async function saveBidQuestion(){
  const categoryId=Number(state.shared.byId("bidQuestionCategoryId").value)||null,topicId=Number(state.shared.byId("bidQuestionTopicId").value)||null;
  const category=state.bids.bidCategories.find(item=>item.id===categoryId),topic=state.bids.bidTopics.find(item=>item.id===topicId);
  const bidderId=Number(state.shared.byId("bidQuestionBidderId").value)||null,bidder=state.bids.bidders.find(item=>item.id===bidderId);
  const payload={project_id:Number(state.bids.bidQuestionProject.value),question_year:Number(state.shared.byId("bidQuestionYear").value),category_id:categoryId,topic_id:topicId,bidder_id:bidderId,standard_answer_id:Number(state.shared.byId("bidQuestionStandardAnswerId").value)||null,standard_variant_id:Number(state.shared.byId("bidQuestionStandardVariantId").value)||null,category:category?.name||"",bidder:bidder?.bidder||"",subject:topic?.name||"",question:state.shared.byId("bidQuestionText").value,agency_comment:state.shared.byId("bidQuestionComment").value,decision:state.shared.byId("bidQuestionDecision").value,answer:state.shared.byId("bidQuestionAnswer").value};
  const id=state.bids.editingBidQuestionId,save=WveDrafts.beginSave(state.shared.byId('tab-bid-question-create'));
  try{
    if(id)await actions.api(`/api/bid/questions/${id}`,{method:"PUT",body:JSON.stringify(payload)});
    else await actions.api("/api/bid/questions",{method:"POST",body:JSON.stringify(payload)});
    if(WveDrafts.finishSave(save))actions.openNewBidQuestion();
    actions.toast(id?"Bieterfrage aktualisiert.":"Bieterfrage gespeichert.");await actions.loadBidModule();
  }catch(error){actions.toast(error.message)}
}

export function editBidQuestion(id){
  const item=state.bids.bidQuestions.find(question=>question.id===Number(id))||(state.projects.currentProjectWorkspace.bid_questions||[]).find(question=>question.id===Number(id));if(!item)return;
  const matchedCategory=state.bids.bidCategories.find(category=>category.id===item.category_id||category.name===item.category),matchedTopic=state.bids.bidTopics.find(topic=>topic.id===item.topic_id||(topic.name===item.subject&&(!matchedCategory||topic.category_id===matchedCategory.id)));
  state.bids.editingBidQuestionId=item.id;state.bids.bidQuestionProject.value=String(item.project_id);state.shared.byId("bidQuestionCategoryId").value=String(matchedCategory?.id||matchedTopic?.category_id||"");state.shared.byId("bidQuestionTopicId").value=String(matchedTopic?.id||"");state.shared.byId("bidQuestionBidderId").value=String(item.bidder_id||state.bids.bidders.find(entry=>entry.bidder===item.bidder)?.id||"");state.shared.byId("bidQuestionStandardAnswerId").value=String(item.standard_answer_id||"");state.shared.byId("bidQuestionStandardVariantId").value=String(item.standard_variant_id||"");state.shared.byId("bidQuestionText").value=item.question;state.shared.byId("bidQuestionComment").value=item.agency_comment;state.shared.byId("bidQuestionDecision").value=["zugelassen","abgelehnt"].includes(item.decision)?item.decision:"";state.shared.byId("bidQuestionAnswer").value=item.answer;
  state.shared.byId("bidQuestionYear").value=String(item.question_year||new Date().getFullYear());
  actions.updateBidProjectButton("single");actions.updateSingleBidTaxonomyButtons();actions.updateSingleBidderButton();
  state.bids.bidQuestionDialog.close();actions.switchTab("bid-question-create");
}

export async function deleteBidQuestion(id){
  try{await actions.api(`/api/bid/questions/${id}`,{method:"DELETE"});state.bids.bidQuestionDialog.close();await actions.loadBidModule();if(state.projects.currentProjectDetailId)await actions.loadProjectWorkspace(state.projects.currentProjectDetailId);actions.toast("Bieterfrage gelöscht.")}catch(error){actions.toast(error.message)}
}

export function updateSingleBidTaxonomyButtons(){
  const category=state.bids.bidCategories.find(item=>String(item.id)===state.shared.byId("bidQuestionCategoryId").value),topic=state.bids.bidTopics.find(item=>String(item.id)===state.shared.byId("bidQuestionTopicId").value);
  const categoryButton=state.shared.byId("bidQuestionCategoryButton"),topicButton=state.shared.byId("bidQuestionTopicButton");
  categoryButton.textContent=category?.name||"Fragenkategorie auswählen...";categoryButton.classList.toggle("has-selection",!!category);
  topicButton.textContent=topic?.name||"Thema auswählen...";topicButton.classList.toggle("has-selection",!!topic);
}

export function openBidTaxonomyPicker(type,target,rowId=null){
  state.bids.activeBidTaxonomyType=type;state.bids.activeBidTaxonomyTarget=target;state.shared.activeBatchRowId=rowId;state.bids.bidTaxonomyPickerSearch.value="";state.shared.byId("bidTaxonomyCreateName").value="";
  state.shared.byId("bidTaxonomyPickerTitle").textContent=type==="category"?"Fragenkategorie auswählen":"Thema auswählen";
  state.shared.byId("bidTaxonomyPickerHint").textContent=type==="category"?"Vorhandene Kategorie auswählen oder direkt eine neue anlegen.":"Vorhandenes Thema auswählen oder direkt ein neues Thema anlegen.";
  state.shared.byId("bidTaxonomyCreateTitle").textContent=type==="category"?"Neue Fragenkategorie":"Neues Thema";
  state.shared.byId("bidTaxonomyCreateCategoryWrap").hidden=type!=="topic";
  const currentCategory=target==="single"?Number(state.shared.byId("bidQuestionCategoryId").value):target==="answer-form"?Number(state.bids.bidTopics.find(item=>String(item.id)===state.bids.bidAnswerTopic.value)?.category_id):Number(state.bids.bidBatchItems.find(item=>item.id===rowId)?.category_id);
  state.shared.byId("bidTaxonomyCreateCategory").innerHTML='<option value="">Kategorie auswählen...</option>'+state.bids.bidCategories.filter(item=>item.active).map(item=>`<option value="${item.id}">${actions.esc(item.name)}</option>`).join("");
  if(currentCategory)state.shared.byId("bidTaxonomyCreateCategory").value=String(currentCategory);
  actions.renderBidTaxonomyPickerResults();state.bids.bidTaxonomyPickerDialog.showModal();state.bids.bidTaxonomyPickerSearch.focus();
}

export function renderBidTaxonomyPickerResults(){
  const needle=state.bids.bidTaxonomyPickerSearch.value.trim().toLocaleLowerCase("de");
  let items=state.bids.activeBidTaxonomyType==="category"?state.bids.bidCategories.filter(item=>item.active):state.bids.bidTopics.filter(item=>item.active);
  if(state.bids.activeBidTaxonomyType==="topic"){
    const categoryId=state.bids.activeBidTaxonomyTarget==="single"?Number(state.shared.byId("bidQuestionCategoryId").value):state.bids.activeBidTaxonomyTarget==="answer-form"?0:Number(state.bids.bidBatchItems.find(item=>item.id===state.shared.activeBatchRowId)?.category_id);
    if(categoryId)items=items.filter(item=>item.category_id===categoryId);
  }
  items=items.filter(item=>!needle||item.name.toLocaleLowerCase("de").includes(needle));
  if(state.bids.activeBidTaxonomyType==="topic"&&state.bids.activeBidTaxonomyTarget==="answer-form")state.bids.bidTaxonomyPickerResults.innerHTML=state.bids.bidCategories.map(category=>{const topics=items.filter(item=>item.category_id===category.id);return topics.length?`<section class="picker-hierarchy"><h3>${actions.esc(category.name)}</h3>${topics.map(item=>`<button type="button" onclick="chooseBidTaxonomy(${item.id})"><b>${actions.esc(item.name)}</b></button>`).join("")}</section>`:""}).join("")||"<p class='muted'>Keine passenden Themen gefunden.</p>";
  else state.bids.bidTaxonomyPickerResults.innerHTML=items.length?items.map(item=>`<button type="button" onclick="chooseBidTaxonomy(${item.id})"><b>${actions.esc(item.name)}</b>${state.bids.activeBidTaxonomyType==="topic"?`<span>${actions.esc(state.bids.bidCategories.find(category=>category.id===item.category_id)?.name||"")}</span>`:""}</button>`).join(""):"<p class='muted'>Keine passenden Einträge gefunden.</p>";
}

export function chooseBidTaxonomy(id){
  const item=(state.bids.activeBidTaxonomyType==="category"?state.bids.bidCategories:state.bids.bidTopics).find(entry=>entry.id===Number(id));if(!item)return;
  if(state.bids.activeBidTaxonomyTarget==="single"){
    if(state.bids.activeBidTaxonomyType==="category"){state.shared.byId("bidQuestionCategoryId").value=String(item.id);const topic=state.bids.bidTopics.find(entry=>String(entry.id)===state.shared.byId("bidQuestionTopicId").value);if(topic&&topic.category_id!==item.id)state.shared.byId("bidQuestionTopicId").value=""}
    else{state.shared.byId("bidQuestionTopicId").value=String(item.id);state.shared.byId("bidQuestionCategoryId").value=String(item.category_id)}
    actions.updateSingleBidTaxonomyButtons();
  }else if(state.bids.activeBidTaxonomyTarget==="answer-form"){
    state.bids.bidAnswerTopic.value=String(item.id);actions.updateBidAnswerTopicButton();
  }else{
    const row=state.bids.bidBatchItems.find(entry=>entry.id===state.shared.activeBatchRowId);if(!row)return;
    if(state.bids.activeBidTaxonomyType==="category"){row.category_id=item.id;if(row.topic_id&&!state.bids.bidTopics.some(topic=>topic.id===row.topic_id&&topic.category_id===item.id))row.topic_id=null}
    else{row.topic_id=item.id;row.category_id=item.category_id}
    actions.renderBidBatchRows();
  }
  state.bids.bidTaxonomyPickerDialog.close();
}

export async function createFromBidTaxonomyPicker(){
  const name=state.shared.byId("bidTaxonomyCreateName").value.trim();if(!name)return actions.toast("Bitte eine Bezeichnung eingeben.");
  try{
    let data;if(state.bids.activeBidTaxonomyType==="category")data=await actions.api("/api/bid/categories",{method:"POST",body:JSON.stringify({name,active:true})});
    else{const categoryId=Number(state.shared.byId("bidTaxonomyCreateCategory").value);if(!categoryId)return actions.toast("Bitte eine Kategorie auswählen.");data=await actions.api("/api/bid/topics",{method:"POST",body:JSON.stringify({category_id:categoryId,name,active:true})})}
    await actions.loadBidModule();actions.chooseBidTaxonomy(data.id);actions.toast(state.bids.activeBidTaxonomyType==="category"?"Kategorie angelegt.":"Thema angelegt.");
  }catch(error){actions.toast(error.message)}
}

export function openStandardAnswerPicker(target,mode="answer",rowId=null){state.shared.activeStandardAnswerTarget=target;state.shared.activeStandardAnswerMode=mode;state.shared.activeBatchRowId=rowId;state.bids.standardAnswerPickerSearch.value="";actions.renderStandardAnswerPickerResults();state.bids.standardAnswerPickerDialog.showModal();state.bids.standardAnswerPickerSearch.focus()}

export function renderStandardAnswerPickerResults(){
  const needle=state.bids.standardAnswerPickerSearch.value,linkedId=state.shared.activeStandardAnswerTarget==="single"?Number(state.shared.byId("bidQuestionStandardAnswerId").value):Number(state.bids.bidBatchItems.find(item=>item.id===state.shared.activeBatchRowId)?.standard_answer_id),matching=state.bids.bidAnswers.filter(answer=>(needle||state.shared.activeStandardAnswerMode==="comment"||!linkedId||answer.id===linkedId)&&actions.answerMatches(answer,needle));
  const decision=state.shared.activeStandardAnswerTarget==="single"?state.shared.byId("bidQuestionDecision").value:(state.bids.bidBatchItems.find(item=>item.id===state.shared.activeBatchRowId)?.decision||"");
  state.bids.standardAnswerPickerResults.innerHTML=matching.length?matching.map(answer=>{const variants=(answer.variants||[]).filter(item=>!decision||item.decision===decision);return `<article class="standard-answer-picker-card"><div><b>${actions.esc(answer.short_question)}</b><small>${actions.esc(answer.category_name)} · ${actions.esc(answer.topic_name)}</small>${answer.agency_comment?`<p><strong>Kommentar:</strong> ${actions.esc(answer.agency_comment).replace(/\n/g,"<br>")}</p>`:""}</div>${state.shared.activeStandardAnswerMode==="comment"?`<button type="button" class="primary" onclick="chooseStandardAnswer(${answer.id},null)">Kommentar übernehmen</button>`:`<div class="variant-picker-list">${variants.map(variant=>`<button type="button" onclick="chooseStandardAnswer(${answer.id},${variant.id})"><span class="decision-chip ${variant.decision}">${actions.esc(variant.decision)}</span>${actions.esc(variant.answer)}</button>`).join("")||"<p class='muted'>Keine Variante für diese Entscheidung.</p>"}</div>`}</article>`}).join(""):"<p class='muted'>Kein passender Antwortfall gefunden.</p>";
}

export function chooseStandardAnswer(id,variantId=null){const answer=state.bids.bidAnswers.find(item=>item.id===Number(id));if(!answer)return;const variant=(answer.variants||[]).find(item=>item.id===Number(variantId));if(state.shared.activeStandardAnswerTarget==="single"){state.shared.byId("bidQuestionStandardAnswerId").value=String(answer.id);state.shared.byId("bidQuestionStandardVariantId").value=variant?String(variant.id):"";state.shared.byId("bidQuestionComment").value=answer.agency_comment||state.shared.byId("bidQuestionComment").value;if(variant){state.shared.byId("bidQuestionAnswer").value=variant.answer;state.shared.byId("bidQuestionDecision").value=variant.decision}state.shared.byId("bidQuestionCategoryId").value=String(answer.category_id);state.shared.byId("bidQuestionTopicId").value=String(answer.topic_id);actions.updateSingleBidTaxonomyButtons()}else{const row=state.bids.bidBatchItems.find(item=>item.id===state.shared.activeBatchRowId);if(row){row.standard_answer_id=answer.id;row.standard_variant_id=variant?.id||null;row.agency_comment=answer.agency_comment||row.agency_comment;if(variant){row.answer=variant.answer;row.decision=variant.decision}row.category_id=answer.category_id;row.topic_id=answer.topic_id}actions.renderBidBatchRows()}state.bids.standardAnswerPickerDialog.close();actions.toast(variant?"Antwortvariante und Verknüpfung übernommen.":"Kommentar und Verknüpfung übernommen.")}

export function bidDecisionChanged(){const variantId=Number(state.shared.byId("bidQuestionStandardVariantId").value),variant=state.bids.bidAnswers.flatMap(item=>item.variants||[]).find(item=>item.id===variantId);if(variant&&variant.decision!==state.shared.byId("bidQuestionDecision").value)state.shared.byId("bidQuestionStandardVariantId").value=""}

export function newBidBatchItem(){return {id:Date.now()+Math.random(),category_id:null,topic_id:null,bidder_id:null,bidder:"",question:"",agency_comment:"",decision:"",answer:"",standard_answer_id:null,standard_variant_id:null}}

export function addBidBatchRow(){state.bids.bidBatchItems.push(actions.newBidBatchItem());actions.renderBidBatchRows()}

export function clearBidBatch(){actions.setCurrentBidYear("bidBatchYear");state.bids.bidBatchItems=[actions.newBidBatchItem(),actions.newBidBatchItem(),actions.newBidBatchItem()];actions.renderBidBatchRows()}

export function removeBidBatchRow(id){state.bids.bidBatchItems=state.bids.bidBatchItems.filter(item=>item.id!==id);if(!state.bids.bidBatchItems.length)actions.addBidBatchRow();else actions.renderBidBatchRows()}

export function updateBidBatch(id,key,value){const row=state.bids.bidBatchItems.find(item=>item.id===id);if(!row)return;row[key]=value;if(key==="decision"&&row.standard_variant_id){const variant=state.bids.bidAnswers.flatMap(item=>item.variants||[]).find(item=>item.id===row.standard_variant_id);if(variant&&variant.decision!==value)row.standard_variant_id=null}}

export function renderBidBatchRows(){
  if(!state.bids.bidBatchRows)return;if(!state.bids.bidBatchItems.length)actions.clearBidBatch();
  state.bids.bidBatchRows.innerHTML=state.bids.bidBatchItems.map((row,index)=>{const category=state.bids.bidCategories.find(item=>item.id===row.category_id),topic=state.bids.bidTopics.find(item=>item.id===row.topic_id);return `<article class="bid-batch-row"><header><b>Zeile ${index+1}</b><button type="button" class="icon-only danger" title="Zeile entfernen" onclick="removeBidBatchRow(${row.id})">×</button></header><div class="bid-batch-grid">
    <label>Kategorie<button type="button" class="select-button ${category?"has-selection":""}" onclick="openBidTaxonomyPicker('category','batch',${row.id})">${actions.esc(category?.name||"Auswählen...")}</button></label>
    <label>Thema<button type="button" class="select-button ${topic?"has-selection":""}" onclick="openBidTaxonomyPicker('topic','batch',${row.id})">${actions.esc(topic?.name||"Auswählen...")}</button></label>
    <label>Bieter<button type="button" class="select-button ${row.bidder_id?"has-selection":""}" onclick="openBidderPicker('batch',${row.id})">${actions.esc(row.bidder||"Bieter auswählen...")}</button></label>
    <label>Entscheidung<select onchange="updateBidBatch(${row.id},'decision',this.value)"><option value="" ${!row.decision?"selected":""}>Noch offen</option><option value="zugelassen" ${row.decision==="zugelassen"?"selected":""}>zugelassen</option><option value="abgelehnt" ${row.decision==="abgelehnt"?"selected":""}>abgelehnt</option></select></label>
    <label class="wide">Bieterfrage<textarea rows="3" oninput="updateBidBatch(${row.id},'question',this.value)">${actions.esc(row.question)}</textarea></label>
    <label class="wide">Kommentar Agentur Wieseke<div class="answer-input-head"><span>Kommentar</span><button type="button" onclick="openStandardAnswerPicker('batch','comment',${row.id})">Kommentar auswählen</button></div><textarea rows="3" oninput="updateBidBatch(${row.id},'agency_comment',this.value)">${actions.esc(row.agency_comment)}</textarea></label>
    <label class="wide">Antwort<div class="answer-input-head"><span>Antworttext</span><button type="button" onclick="openStandardAnswerPicker('batch','answer',${row.id})">Antwortvariante</button></div><textarea rows="4" oninput="updateBidBatch(${row.id},'answer',this.value)">${actions.esc(row.answer)}</textarea></label>
  </div></article>`}).join("");
}

export async function saveBidBatch(){
  const projectId=Number(state.bids.bidBatchProject.value);if(!projectId)return actions.toast("Bitte ein Projekt auswählen.");
  const usable=state.bids.bidBatchItems.filter(item=>item.question.trim()||item.bidder.trim()||item.answer.trim());if(!usable.length)return actions.toast("Bitte mindestens eine Bieterfrage erfassen.");
  if(usable.some(item=>!item.question.trim()))return actions.toast("Jede ausgefüllte Zeile benötigt eine Bieterfrage.");
  const questions=usable.map(item=>{const category=state.bids.bidCategories.find(entry=>entry.id===item.category_id),topic=state.bids.bidTopics.find(entry=>entry.id===item.topic_id);return {project_id:projectId,question_year:Number(state.shared.byId("bidBatchYear").value),category_id:item.category_id,topic_id:item.topic_id,bidder_id:item.bidder_id,standard_answer_id:item.standard_answer_id,standard_variant_id:item.standard_variant_id,category:category?.name||"",subject:topic?.name||"",bidder:item.bidder,question:item.question,agency_comment:item.agency_comment,decision:item.decision,answer:item.answer}});
  try{const data=await actions.api("/api/bid/questions",{method:"POST",body:JSON.stringify({questions})});actions.clearBidBatch();await actions.loadBidModule();actions.toast(`${data.created} Bieterfrage(n) gespeichert.`)}catch(error){actions.toast(error.message)}
}

export function parseDelimitedLine(line,delimiter){
  const values=[];let value="",quoted=false;
  for(let index=0;index<line.length;index++){const char=line[index];if(char==='"'){if(quoted&&line[index+1]==='"'){value+='"';index++}else quoted=!quoted}else if(char===delimiter&&!quoted){values.push(value.trim());value=""}else value+=char}
  values.push(value.trim());return values;
}

export function parsedBidImport(){
  const lines=String(state.bids.bidImportText?.value||"").replace(/\r/g,"").split("\n").filter(line=>line.trim());if(!lines.length)return [];
  const delimiter=lines.some(line=>line.includes("\t"))?"\t":";";
  const rows=lines.map(line=>actions.parseDelimitedLine(line,delimiter));
  if(rows[0]?.join(" ").toLocaleLowerCase("de").includes("bieterfrage"))rows.shift();
  return rows.filter(row=>row.some(Boolean)).map(row=>({category:row[0]||"",bidder:row[1]||"",subject:row[2]||"",question:row[3]||"",agency_comment:row[4]||"",decision:String(row[5]||"").trim().toLocaleLowerCase("de"),answer:row[6]||""}));
}

export function previewBidImport(){
  if(!state.bids.bidImportPreview)return;const rows=actions.parsedBidImport();
  state.bids.bidImportPreview.innerHTML=rows.length?`<p><b>${rows.length} Zeile(n) erkannt</b></p><table><thead><tr><th>Kategorie</th><th>Bieter</th><th>Thema</th><th>Bieterfrage</th></tr></thead><tbody>${rows.slice(0,50).map(row=>`<tr><td>${actions.esc(row.category)}</td><td>${actions.esc(row.bidder)}</td><td>${actions.esc(row.subject)}</td><td>${actions.esc(row.question)}</td></tr>`).join("")}</tbody></table>${rows.length>50?"<p class='muted'>Vorschau auf 50 Zeilen begrenzt.</p>":""}`:"<p class='muted'>Noch keine Zeilen erkannt.</p>";
}

export async function importBidQuestions(){
  const projectId=Number(state.bids.bidImportProject.value),rows=actions.parsedBidImport();if(!projectId)return actions.toast("Bitte ein Projekt auswählen.");if(!rows.length)return actions.toast("Keine importierbaren Zeilen erkannt.");
  if(rows.some(row=>!row.question))return actions.toast("Mindestens eine Zeile enthält keine Bieterfrage.");
  if(rows.some(row=>row.decision&&!['zugelassen','abgelehnt'].includes(row.decision)))return actions.toast("Entscheidungen müssen zugelassen oder abgelehnt sein.");
  try{const data=await actions.api("/api/bid/questions",{method:"POST",body:JSON.stringify({questions:rows.map(row=>({...row,project_id:projectId,question_year:Number(state.shared.byId("bidImportYear").value)}))})});state.bids.bidImportText.value="";actions.previewBidImport();await actions.loadBidModule();actions.toast(`${data.created} Bieterfrage(n) importiert.`)}catch(error){actions.toast(error.message)}
}

export function updateBidTaxonomyOptions(){
  const categoryOptions=state.bids.bidCategories.filter(category=>category.active).map(category=>`<option value="${category.id}">${actions.esc(category.name)}</option>`).join("");
  if(state.bids.bidTopicCategory){const before=state.bids.bidTopicCategory.value;state.bids.bidTopicCategory.innerHTML='<option value="">Kategorie auswählen...</option>'+categoryOptions;state.bids.bidTopicCategory.value=state.bids.bidCategories.some(item=>String(item.id)===before)?before:""}
  actions.updateBidAnswerTopicButton();
}

export function updateBidAnswerTopicButton(){const topic=state.bids.bidTopics.find(item=>String(item.id)===state.bids.bidAnswerTopic?.value),category=topic&&state.bids.bidCategories.find(item=>item.id===topic.category_id),button=state.shared.byId("bidAnswerTopicButton");if(!button)return;button.textContent=topic?`${category?.name||""} · ${topic.name}`:"Thema auswählen...";button.classList.toggle("has-selection",!!topic)}

export function answerMatches(answer,needle){const search=String(needle||"").trim().toLocaleLowerCase("de");return !search||[answer.category_name,answer.topic_name,answer.short_question,answer.question,answer.agency_comment,...(answer.variants||[]).flatMap(item=>[item.short_description,item.answer])].join(" ").toLocaleLowerCase("de").includes(search)}

export function renderBidAnswerLibrary(){
  if(!state.bids.bidAnswerLibrary)return;const matching=state.bids.bidAnswers.filter(answer=>actions.answerMatches(answer,state.bids.bidAnswerSearch?.value));
  state.bids.bidAnswerLibrary.innerHTML=state.bids.bidCategories.map(category=>{const categoryAnswers=matching.filter(answer=>answer.category_id===category.id);if(!categoryAnswers.length)return "";const topics=state.bids.bidTopics.filter(topic=>topic.category_id===category.id).map(topic=>{const answers=categoryAnswers.filter(answer=>answer.topic_id===topic.id);if(!answers.length)return "";return `<details class="bid-topic-group" open><summary><span>${actions.esc(topic.name)}</span><small>${answers.length} Antwortfall/-fälle</small></summary><div class="compact-answer-list">${answers.map(answer=>`<article class="compact-answer-row"><button class="text-button" onclick="openBidAnswerDetail(${answer.id})"><b>${actions.esc(answer.short_question)}</b><small>${actions.esc((answer.agency_comment||answer.question||"Ohne Zusatzinformation").slice(0,150))}</small></button><div class="compact-answer-meta">${(answer.variants||[]).map(variant=>`<span class="decision-chip ${variant.decision}" title="${actions.esc(variant.short_description||"")}">${actions.esc(variant.short_description||variant.decision)}</span>`).join("")}</div><button type="button" onclick="openBidAnswerDetail(${answer.id})">Details</button></article>`).join("")}</div></details>`}).join("");return `<details class="bid-category-group" open><summary><h3>${actions.esc(category.name)}</h3><span>${categoryAnswers.length}</span></summary>${topics}</details>`}).join("")||"<p class='muted'>Keine passenden Standardantworten gefunden.</p>";
}

export function openBidAnswerDetail(id){const answer=state.bids.bidAnswers.find(item=>item.id===Number(id));if(!answer)return;state.shared.byId("bidAnswerDetailTitle").textContent=answer.short_question;state.shared.byId("bidAnswerDetailContent").innerHTML=`<p class="muted">${actions.esc(answer.category_name)} · ${actions.esc(answer.topic_name)}</p>${answer.question?actions.bidAnswerField(answer,"question","Frage"):""}${answer.agency_comment?actions.bidAnswerField(answer,"agency_comment","Kommentar Agentur Wieseke"):""}<section class="bid-answer-variant-list"><h3>Antwortvarianten</h3>${(answer.variants||[]).map(variant=>`<div><span class="decision-chip ${variant.decision}">${actions.esc(variant.decision)}</span>${variant.short_description?`<b>${actions.esc(variant.short_description)}</b>`:""}<p>${actions.esc(variant.answer).replace(/\n/g,"<br>")}</p><button type="button" class="copy-icon-button" onclick="copyBidVariant(${answer.id},${variant.id})" title="Antwort kopieren">${actions.menuIcon("copy")}</button></div>`).join("")}</section>`;state.shared.byId("bidAnswerDetailActions").innerHTML=actions.hasPermission("bid_answers_manage")?`<button onclick="bidAnswerDetailDialog.close();editBidAnswer(${answer.id})">Bearbeiten</button>`:"";bidAnswerDetailDialog.showModal()}

export function bidAnswerField(answer,key,label){return `<section class="bid-answer-field"><div><b>${actions.esc(label)}</b><button type="button" class="copy-icon-button" title="${actions.esc(label)} kopieren" aria-label="${actions.esc(label)} kopieren" onclick="copyBidAnswerField(${answer.id},'${key}')">${actions.menuIcon("copy")}</button></div><p>${actions.esc(answer[key]||"").replace(/\n/g,"<br>")}</p></section>`}

export async function copyBidAnswerField(id,key){const answer=state.bids.bidAnswers.find(item=>item.id===Number(id));if(!answer)return;try{await navigator.clipboard.writeText(answer[key]||"");actions.toast("Text wurde kopiert.")}catch(error){actions.toast("Der Text konnte nicht kopiert werden.")}}

export async function copyBidVariant(answerId,variantId){const answer=state.bids.bidAnswers.find(item=>item.id===Number(answerId)),variant=answer?.variants?.find(item=>item.id===Number(variantId));if(!variant)return;try{await navigator.clipboard.writeText(variant.answer);actions.toast("Antwort kopiert.")}catch(error){actions.toast("Die Antwort konnte nicht kopiert werden.")}}

export function newBidAnswerVariant(decision="zugelassen",answer="",short_description=""){return {local_id:Date.now()+Math.random(),decision,answer,short_description}}

export function addBidAnswerVariant(decision="zugelassen",answer=""){state.bids.editingBidAnswerVariants.push(actions.newBidAnswerVariant(decision,answer));actions.renderBidAnswerVariants()}

export function removeBidAnswerVariant(localId){state.bids.editingBidAnswerVariants=state.bids.editingBidAnswerVariants.filter(item=>item.local_id!==localId);actions.renderBidAnswerVariants()}

export function updateBidAnswerVariant(localId,key,value){const item=state.bids.editingBidAnswerVariants.find(entry=>entry.local_id===localId);if(item)item[key]=value}

export function renderBidAnswerVariants(){if(!state.bids.bidAnswerVariants)return;state.bids.bidAnswerVariants.innerHTML=state.bids.editingBidAnswerVariants.map((variant,index)=>`<article class="bid-answer-variant"><header><b>Variante ${index+1}</b><button type="button" class="icon-only danger" onclick="removeBidAnswerVariant(${variant.local_id})">×</button></header><label>Entscheidung<select onchange="updateBidAnswerVariant(${variant.local_id},'decision',this.value)"><option value="zugelassen" ${variant.decision==="zugelassen"?"selected":""}>zugelassen</option><option value="abgelehnt" ${variant.decision==="abgelehnt"?"selected":""}>abgelehnt</option></select></label><label>Kurzbeschreibung<input maxlength="300" value="${actions.esc(variant.short_description||"")}" oninput="updateBidAnswerVariant(${variant.local_id},'short_description',this.value)" placeholder="z. B. Fristverlängerung um 7 Tage"></label><label>Antwort<textarea rows="5" oninput="updateBidAnswerVariant(${variant.local_id},'answer',this.value)">${actions.esc(variant.answer)}</textarea></label></article>`).join("")||"<p class='muted'>Noch keine Antwortvariante vorhanden.</p>"}

export function newBidAnswer(){state.shared.byId("bidAnswerId").value="";state.bids.bidAnswerTopic.value="";state.shared.byId("bidAnswerShortQuestion").value=state.shared.byId("bidAnswerQuestion").value=state.shared.byId("bidAnswerComment").value="";state.bids.editingBidAnswerVariants=[actions.newBidAnswerVariant("zugelassen"),actions.newBidAnswerVariant("abgelehnt")];actions.renderBidAnswerVariants();actions.updateBidAnswerTopicButton();state.shared.byId("bidAnswerFormTitle").textContent="Standardantwort anlegen";state.shared.byId("deleteBidAnswerButton").hidden=true;actions.switchTab("bid-answer-create")}

export function editBidAnswer(id){const answer=state.bids.bidAnswers.find(item=>item.id===Number(id));if(!answer)return;state.shared.byId("bidAnswerId").value=answer.id;state.bids.bidAnswerTopic.value=answer.topic_id;state.shared.byId("bidAnswerShortQuestion").value=answer.short_question;state.shared.byId("bidAnswerQuestion").value=answer.question;state.shared.byId("bidAnswerComment").value=answer.agency_comment||"";state.bids.editingBidAnswerVariants=(answer.variants||[]).map(item=>({local_id:Date.now()+Math.random(),decision:item.decision,answer:item.answer,short_description:item.short_description||""}));actions.renderBidAnswerVariants();actions.updateBidAnswerTopicButton();state.shared.byId("bidAnswerFormTitle").textContent="Standardantwort bearbeiten";state.shared.byId("deleteBidAnswerButton").hidden=false;actions.switchTab("bid-answer-create")}

export async function saveBidAnswer(){
  const id=state.shared.byId("bidAnswerId").value,payload={topic_id:Number(state.bids.bidAnswerTopic.value),short_question:state.shared.byId("bidAnswerShortQuestion").value,question:state.shared.byId("bidAnswerQuestion").value,agency_comment:state.shared.byId("bidAnswerComment").value,variants:state.bids.editingBidAnswerVariants.filter(item=>item.answer.trim()).map(item=>({decision:item.decision,short_description:item.short_description||"",answer:item.answer}))};
  const save=WveDrafts.beginSave(state.shared.byId('tab-bid-answer-create'));
  try{
    await actions.api(id?`/api/bid/answers/${id}`:"/api/bid/answers",{method:id?"PUT":"POST",body:JSON.stringify(payload)});
    const current=WveDrafts.finishSave(save);
    await actions.loadBidModule();actions.toast("Antwortfall gespeichert.");
    if(current&&WveDrafts.isCurrentSave(save))actions.switchTab("bid-answers");
  }catch(error){actions.toast(error.message)}
}

export async function deleteBidAnswer(){const id=state.shared.byId("bidAnswerId").value;if(!id)return;try{await actions.api(`/api/bid/answers/${id}`,{method:"DELETE"});await actions.loadBidModule();actions.toast("Standardantwort gelöscht.");actions.newBidAnswer()}catch(error){actions.toast(error.message)}}

export function newBidCategory(){state.shared.byId("bidCategoryId").value=state.shared.byId("bidCategoryName").value="";state.shared.byId("bidCategoryActive").checked=true;state.shared.byId("deleteBidCategoryButton").hidden=true}

export function editBidCategory(id){const item=state.bids.bidCategories.find(category=>category.id===Number(id));if(!item)return;state.shared.byId("bidCategoryId").value=item.id;state.shared.byId("bidCategoryName").value=item.name;state.shared.byId("bidCategoryActive").checked=item.active;state.shared.byId("deleteBidCategoryButton").hidden=false}

export async function saveBidCategory(){const id=state.shared.byId("bidCategoryId").value,payload={name:state.shared.byId("bidCategoryName").value,active:state.shared.byId("bidCategoryActive").checked};try{if(id)await actions.api(`/api/bid/categories/${id}`,{method:"PUT",body:JSON.stringify(payload)});else await actions.api("/api/bid/categories",{method:"POST",body:JSON.stringify(payload)});actions.newBidCategory();await actions.loadBidModule();actions.toast("Kategorie gespeichert.")}catch(error){actions.toast(error.message)}}

export async function deleteBidCategory(){const id=state.shared.byId("bidCategoryId").value;if(!id)return;try{await actions.api(`/api/bid/categories/${id}`,{method:"DELETE"});actions.newBidCategory();await actions.loadBidModule();actions.toast("Kategorie gelöscht.")}catch(error){actions.toast(error.message)}}

export function newBidTopic(){state.shared.byId("bidTopicId").value=state.shared.byId("bidTopicName").value="";state.shared.byId("bidTopicActive").checked=true;state.shared.byId("deleteBidTopicButton").hidden=true;actions.updateBidTaxonomyOptions()}

export function editBidTopic(id){const item=state.bids.bidTopics.find(topic=>topic.id===Number(id));if(!item)return;state.shared.byId("bidTopicId").value=item.id;state.bids.bidTopicCategory.value=item.category_id;state.shared.byId("bidTopicName").value=item.name;state.shared.byId("bidTopicActive").checked=item.active;state.shared.byId("deleteBidTopicButton").hidden=false}

export async function saveBidTopic(){const id=state.shared.byId("bidTopicId").value,payload={category_id:Number(state.bids.bidTopicCategory.value),name:state.shared.byId("bidTopicName").value,active:state.shared.byId("bidTopicActive").checked};try{if(id)await actions.api(`/api/bid/topics/${id}`,{method:"PUT",body:JSON.stringify(payload)});else await actions.api("/api/bid/topics",{method:"POST",body:JSON.stringify(payload)});actions.newBidTopic();await actions.loadBidModule();actions.toast("Thema gespeichert.")}catch(error){actions.toast(error.message)}}

export async function deleteBidTopic(){const id=state.shared.byId("bidTopicId").value;if(!id)return;try{await actions.api(`/api/bid/topics/${id}`,{method:"DELETE"});actions.newBidTopic();await actions.loadBidModule();actions.toast("Thema gelöscht.")}catch(error){actions.toast(error.message)}}

export function renderBidTaxonomy(){
  if(state.bids.bidCategoryList)state.bids.bidCategoryList.innerHTML=state.bids.bidCategories.map(category=>`<div class="taxonomy-item" draggable="true" ondragstart="beginBidCategoryDrag(event,${category.id})" ondragover="allowBidTaxonomyDrop(event)" ondragleave="event.currentTarget.classList.remove('drag-over')" ondrop="dropBidCategory(event,${category.id})"><span class="drag-handle">⋮⋮</span><button class="text-button" onclick="editBidCategory(${category.id})"><b>${actions.esc(category.name)}</b><small>${category.active?"aktiv":"inaktiv"}</small></button></div>`).join("")||"<p class='muted'>Noch keine Kategorien vorhanden.</p>";
  if(state.bids.bidTopicList)state.bids.bidTopicList.innerHTML=state.bids.bidCategories.map(category=>{const topics=state.bids.bidTopics.filter(topic=>topic.category_id===category.id);return topics.length?`<section><h3>${actions.esc(category.name)}</h3>${topics.map(topic=>`<div class="taxonomy-item" draggable="true" ondragstart="beginBidTopicDrag(event,${topic.id},${category.id})" ondragover="allowBidTaxonomyDrop(event)" ondragleave="event.currentTarget.classList.remove('drag-over')" ondrop="dropBidTopic(event,${topic.id},${category.id})"><span class="drag-handle">⋮⋮</span><button class="text-button" onclick="editBidTopic(${topic.id})"><b>${actions.esc(topic.name)}</b><small>${topic.active?"aktiv":"inaktiv"}</small></button></div>`).join("")}</section>`:""}).join("")||"<p class='muted'>Noch keine Themen vorhanden.</p>";
}

export function beginBidCategoryDrag(event,id){state.bids.draggedBidCategoryId=id;event.dataTransfer.setData("text/plain",String(id))}

export function beginBidTopicDrag(event,id,categoryId){state.bids.draggedBidTopicId=id;state.bids.draggedBidTopicCategoryId=categoryId;event.dataTransfer.setData("text/plain",String(id))}

export function allowBidTaxonomyDrop(event){if(state.bids.draggedBidCategoryId||state.bids.draggedBidTopicId){event.preventDefault();event.currentTarget.classList.add("drag-over")}}

export async function dropBidCategory(event,targetId){event.preventDefault();event.currentTarget.classList.remove("drag-over");if(!state.bids.draggedBidCategoryId||state.bids.draggedBidCategoryId===targetId)return;const dragged=state.bids.bidCategories.find(item=>item.id===state.bids.draggedBidCategoryId),remaining=state.bids.bidCategories.filter(item=>item.id!==state.bids.draggedBidCategoryId),index=remaining.findIndex(item=>item.id===targetId);remaining.splice(index,0,dragged);state.bids.draggedBidCategoryId=null;state.bids.bidCategories=remaining;actions.renderBidTaxonomy();try{await actions.api("/api/bid/categories/order",{method:"PUT",body:JSON.stringify({ids:remaining.map(item=>item.id)})})}catch(error){actions.toast(error.message);await actions.loadBidModule()}}

export async function dropBidTopic(event,targetId,categoryId){event.preventDefault();event.currentTarget.classList.remove("drag-over");if(!state.bids.draggedBidTopicId||state.bids.draggedBidTopicCategoryId!==categoryId||state.bids.draggedBidTopicId===targetId)return;const ordered=state.bids.bidTopics.filter(item=>item.category_id===categoryId),dragged=ordered.find(item=>item.id===state.bids.draggedBidTopicId),remaining=ordered.filter(item=>item.id!==state.bids.draggedBidTopicId),index=remaining.findIndex(item=>item.id===targetId);remaining.splice(index,0,dragged);state.bids.draggedBidTopicId=null;state.bids.draggedBidTopicCategoryId=null;state.bids.bidTopics=[...state.bids.bidTopics.filter(item=>item.category_id!==categoryId),...remaining];actions.renderBidTaxonomy();try{await actions.api("/api/bid/topics/order",{method:"PUT",body:JSON.stringify({category_id:categoryId,ids:remaining.map(item=>item.id)})})}catch(error){actions.toast(error.message);await actions.loadBidModule()}}
