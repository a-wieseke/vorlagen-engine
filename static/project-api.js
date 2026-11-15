// Token management always uses the browser session and CSRF protection.
// The external project endpoint accepts only the separately generated token.
let pendingApiKeyAction=null;
async function loadProjectApiKeys(){
  const allowed=hasPermission("projects_api_create")||hasPermission("users_manage");
  byId("projectApiKeyPanel").hidden=!allowed;if(!allowed)return;
  try{
    const data=await api("/api/integration/keys");
    byId("projectApiUser").innerHTML=data.users.map(user=>`<option value="${user.id}">${esc(user.username)}</option>`).join("");
    byId("createProjectApiKey").disabled=!data.users.length;
    byId("projectApiKeyList").innerHTML=data.keys.map(key=>`<div class="list-item"><div><b>${esc(key.username)}</b><div>${key.revoked_at?"Gesperrt":"Aktiv"} · Erstellt ${new Date(key.created_at).toLocaleString("de-DE")}</div><small>Zuletzt verwendet: ${key.last_used_at?new Date(key.last_used_at).toLocaleString("de-DE"):"Noch nicht"}</small></div>${!key.revoked_at?`<button onclick="confirmProjectApiKey('revoke',${key.user_id})">Sperren</button>`:""}</div>`).join("")||"<p>Noch keine API-Schlüssel erstellt.</p>";
  }catch(error){toast(error.message)}
}
function confirmProjectApiKey(action,userId=Number(byId("projectApiUser").value)){
  if(!userId)return;
  pendingApiKeyAction={action,userId};
  byId("apiKeyConfirmText").textContent=action==="revoke"?"Der aktuelle Schlüssel dieses Benutzers wird gesperrt. Übertragungen mit ihm sind danach nicht mehr möglich.":"Ein neuer Schlüssel wird erzeugt und einmalig angezeigt. Ein bisheriger Schlüssel dieses Benutzers wird dabei ungültig.";
  byId("apiKeyConfirmDialog").showModal();
}
async function performProjectApiKeyAction(){
  const task=pendingApiKeyAction;if(!task)return;pendingApiKeyAction=null;byId("apiKeyConfirmDialog").close();
  try{
    const result=await api(task.action==="revoke"?"/api/integration/keys/revoke":"/api/integration/keys",{method:"POST",body:JSON.stringify({user_id:task.userId})});
    await loadProjectApiKeys();
    if(result.token){byId("apiKeySecret").value=result.token;byId("apiKeySecretUser").textContent=result.username;byId("apiKeySecretDialog").showModal()}
    else toast("API-Schlüssel gesperrt.");
  }catch(error){toast(error.message)}
}
async function copyApiKey(){try{await navigator.clipboard.writeText(byId("apiKeySecret").value);toast("API-Schlüssel kopiert.")}catch(error){toast("Bitte den markierten Schlüssel manuell kopieren.");byId("apiKeySecret").select()}}

// The displayed address and clipboard text share one source, including empty
// lines. Website/comment belong to the directory, not the four-line address.
function viewBidder(id){
  const item=bidders.find(row=>row.id===Number(id));if(!item)return;
  byId("bidderViewTitle").textContent=item.bidder;
  byId("bidderAddress").textContent=[item.company_name||"",item.street||"",[item.postal_code,item.city].filter(Boolean).join(" "),item.country||""].join("\n");
  byId("bidderViewDialog").showModal();
}
async function copyBidderAddress(){try{await navigator.clipboard.writeText(byId("bidderAddress").textContent);toast("Anschrift kopiert.")}catch(error){toast("Die Anschrift konnte nicht kopiert werden.")}}
