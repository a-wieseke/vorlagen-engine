/** project-api: feature logic; state is scoped by domain in state.js. */
import {state,actions} from './state.js';

export async function loadProjectApiKeys(){
  const allowed=actions.hasPermission("projects_api_create")||actions.hasPermission("users_manage");
  state.shared.byId("projectApiKeyPanel").hidden=!allowed;if(!allowed)return;
  try{
    const data=await actions.api("/api/integration/keys");
    state.shared.byId("projectApiUser").innerHTML=data.users.map(user=>`<option value="${user.id}">${actions.esc(user.username)}</option>`).join("");
    state.shared.byId("createProjectApiKey").disabled=!data.users.length;
    state.shared.byId("projectApiKeyList").innerHTML=data.keys.map(key=>`<div class="list-item"><div><b>${actions.esc(key.username)}</b><div>${key.revoked_at?"Gesperrt":"Aktiv"} · Erstellt ${new Date(key.created_at).toLocaleString("de-DE")}</div><small>Zuletzt verwendet: ${key.last_used_at?new Date(key.last_used_at).toLocaleString("de-DE"):"Noch nicht"}</small></div>${!key.revoked_at?`<button onclick="confirmProjectApiKey('revoke',${key.user_id})">Sperren</button>`:""}</div>`).join("")||"<p>Noch keine API-Schlüssel erstellt.</p>";
  }catch(error){actions.toast(error.message)}
}

export function confirmProjectApiKey(action,userId=Number(state.shared.byId("projectApiUser").value)){
  if(!userId)return;
  state.shared.pendingApiKeyAction={action,userId};
  state.shared.byId("apiKeyConfirmText").textContent=action==="revoke"?"Der aktuelle Schlüssel dieses Benutzers wird gesperrt. Übertragungen mit ihm sind danach nicht mehr möglich.":"Ein neuer Schlüssel wird erzeugt und einmalig angezeigt. Ein bisheriger Schlüssel dieses Benutzers wird dabei ungültig.";
  state.shared.byId("apiKeyConfirmDialog").showModal();
}

export async function performProjectApiKeyAction(){
  const task=state.shared.pendingApiKeyAction;if(!task)return;state.shared.pendingApiKeyAction=null;state.shared.byId("apiKeyConfirmDialog").close();
  try{
    const result=await actions.api(task.action==="revoke"?"/api/integration/keys/revoke":"/api/integration/keys",{method:"POST",body:JSON.stringify({user_id:task.userId})});
    await actions.loadProjectApiKeys();
    if(result.token){state.shared.byId("apiKeySecret").value=result.token;state.shared.byId("apiKeySecretUser").textContent=result.username;state.shared.byId("apiKeySecretDialog").showModal()}
    else actions.toast("API-Schlüssel gesperrt.");
  }catch(error){actions.toast(error.message)}
}

export async function copyApiKey(){try{await navigator.clipboard.writeText(state.shared.byId("apiKeySecret").value);actions.toast("API-Schlüssel kopiert.")}catch(error){actions.toast("Bitte den markierten Schlüssel manuell kopieren.");state.shared.byId("apiKeySecret").select()}}

export function viewBidder(id){
  window.currentBidDetailId=Number(id);
  const item=state.bids.bidders.find(row=>row.id===Number(id));if(!item)return;
  state.shared.byId("bidderViewTitle").textContent=item.bidder;
  state.shared.byId("bidderAddress").textContent=[item.company_name||"",item.street||"",[item.postal_code,item.city].filter(Boolean).join(" "),item.country||""].join("\n");
  state.shared.byId("bidderViewDialog").showModal();
}

export async function copyBidderAddress(){try{await navigator.clipboard.writeText(state.shared.byId("bidderAddress").textContent);actions.toast("Anschrift kopiert.")}catch(error){actions.toast("Die Anschrift konnte nicht kopiert werden.")}}
