/** accounts: feature logic; state is scoped by domain in state.js. */
import {state,actions} from './state.js';

export function hasPermission(permission){return !!state.auth.me?.permissions?.includes(permission)}

export function applyPermissionVisibility(){
  document.querySelectorAll("[data-permission]").forEach(element=>{
    element.hidden=!actions.hasPermission(element.dataset.permission);
  });
  document.querySelectorAll("[data-any-permission]").forEach(element=>{
    const required=element.dataset.anyPermission.split(",").map(value=>value.trim()).filter(Boolean);
    element.hidden=!required.some(actions.hasPermission);
  });
  // The responsive sidebar mirrors the horizontal function navigation.
  // Keep both representations in sync after permissions become available.
  window.refreshShellPermissions?.();
}

export async function logout(){if(!await confirmAction('Abmelden und ungespeicherte Entwürfe verwerfen?','Abmelden'))return;await actions.api("/api/logout",{method:"POST",body:"{}"});window.WveDrafts?.clear();location.reload()}

export async function recoverPassword(){
  try{
    const data=await actions.api("/api/recover",{method:"POST",body:JSON.stringify({
      username:state.auth.recUsername.value,recovery_code:state.auth.recCode.value,new_password:state.auth.recPassword.value
    })});
    state.shared.recoveryDialog.close();actions.showSecret("Neuer Wiederherstellungscode",data.new_recovery_code);actions.toast("Passwort wurde geändert.");
  }catch(error){actions.toast(error.message)}
}

export async function changePassword(){
  if(state.auth.newPassword.value!==state.auth.newPassword2.value)return actions.toast("Die neuen Passwörter stimmen nicht überein.");
  try{
    const data=await actions.api("/api/change-password",{method:"POST",body:JSON.stringify({
      old_password:state.auth.oldPassword.value,new_password:state.auth.newPassword.value
    })});
    actions.showSecret("Neuer Wiederherstellungscode",data.new_recovery_code);
    state.auth.oldPassword.value=state.auth.newPassword.value=state.auth.newPassword2.value="";
  }catch(error){actions.toast(error.message)}
}

export async function completeForcedPasswordChange(){
  if(state.auth.forcedNewPassword.value!==state.auth.forcedNewPassword2.value)return actions.toast("Die neuen Passwörter stimmen nicht überein.");
  try{
    const data=await actions.api("/api/change-password",{method:"POST",body:JSON.stringify({
      old_password:state.auth.forcedOldPassword.value,new_password:state.auth.forcedNewPassword.value
    })});
    state.auth.me.must_change=false;state.auth.forcedPasswordDialog.close();
    state.auth.forcedOldPassword.value=state.auth.forcedNewPassword.value=state.auth.forcedNewPassword2.value="";
    actions.showSecret("Neuer Wiederherstellungscode",data.new_recovery_code);
    actions.toast("Passwort wurde geändert.");
    await actions.boot();
  }catch(error){actions.toast(error.message)}
}

export async function loadRoles(){
  const data=await actions.api("/api/roles");state.auth.roles=data.roles;state.auth.permissionCatalog=data.permission_catalog||{};
  if(state.auth.uRole){
    const selected=state.auth.uRole.value;
    state.auth.uRole.innerHTML=state.auth.roles.map(role=>`<option value="${role.id}">${actions.esc(role.name)}</option>`).join("");
    const defaultRole=state.auth.roles.find(role=>role.name==="Benutzer")||state.auth.roles[0];
    if(state.auth.roles.some(role=>String(role.id)===selected))state.auth.uRole.value=selected;
    else if(defaultRole)state.auth.uRole.value=String(defaultRole.id);
  }
  actions.renderRoleList();
  if(!state.auth.roleId.value&&!WveDrafts.dirty(state.shared.byId('tab-role-edit')))actions.newRole();
}

export function renderRoleList(){
  if(!state.auth.roleList||!actions.hasPermission("roles_manage"))return;
  state.auth.roleList.innerHTML=state.auth.roles.map(role=>`<div class="list-item">
    <div><button class="text-button" onclick="editRole(${role.id})"><b>${actions.esc(role.name)}</b></button><div class="small">${role.permissions.length} Berechtigungen · ${role.all_categories?"alle Kategorien":role.category_ids.length+" Kategorien"}</div></div>
    <button onclick="editRole(${role.id})">Bearbeiten</button>
  </div>`).join("");
}

export function newRole(){
  state.auth.roleId.value="";state.auth.roleName.value="";state.auth.roleAllCategories.checked=false;
  state.shared.byId("deleteRoleButton").hidden=true;
  actions.renderRolePermissionEditor(["email_create"]);
  actions.renderRoleCategoryEditor([]);
  actions.setRoleEditorLocked(false);
}

export function editRole(id){
  const role=state.auth.roles.find(item=>item.id===id);if(!role)return;
  state.auth.roleId.value=role.id;state.auth.roleName.value=role.name;state.auth.roleAllCategories.checked=role.all_categories;
  actions.renderRolePermissionEditor(role.permissions);actions.renderRoleCategoryEditor(role.category_ids);
  state.shared.byId("deleteRoleButton").hidden=role.is_system;
  actions.setRoleEditorLocked(role.name==="Administrator");
  actions.switchTab('role-edit');
}

export function setRoleEditorLocked(locked){
  state.auth.roleLockedNotice.hidden=!locked;state.shared.saveRoleButton.hidden=locked;state.auth.roleName.disabled=locked;state.auth.roleAllCategories.disabled=locked;
  document.querySelectorAll("#rolePermissionEditor input,#roleCategoryEditor input").forEach(input=>input.disabled=locked);
}

export function renderRolePermissionEditor(selected=[]){
  state.auth.rolePermissionEditor.innerHTML=Object.entries(state.auth.permissionCatalog).map(([key,label])=>
    `<label><input type="checkbox" class="role-permission" value="${actions.esc(key)}" ${selected.includes(key)?"checked":""}> ${actions.esc(label)}</label>`
  ).join("");
}

export async function saveRole(){
  const payload={
    name:state.auth.roleName.value,
    permissions:Array.from(document.querySelectorAll(".role-permission:checked")).map(input=>input.value),
    all_categories:state.auth.roleAllCategories.checked,
    category_ids:Array.from(document.querySelectorAll(".role-category:checked")).map(input=>Number(input.value))
  };
  const save=WveDrafts.beginSave(state.shared.byId('tab-role-edit'));
  try{
    if(state.auth.roleId.value)await actions.api("/api/roles/"+state.auth.roleId.value,{method:"PUT",body:JSON.stringify(payload)});
    else await actions.api("/api/roles",{method:"POST",body:JSON.stringify(payload)});
    if(WveDrafts.finishSave(save))actions.newRole();
    actions.toast("Rolle gespeichert.");await actions.loadRoles();if(actions.hasPermission("users_manage"))await actions.loadUsers();
  }catch(error){actions.toast(error.message)}
}

export async function deleteRole(){
  if(!state.auth.roleId.value||!await confirmAction("Rolle wirklich löschen?",'Rolle löschen'))return;
  try{await actions.api("/api/roles/"+state.auth.roleId.value,{method:"DELETE"});actions.toast("Rolle gelöscht.");state.auth.roleId.value="";await actions.loadRoles()}
  catch(error){actions.toast(error.message)}
}

export async function loadUsers(){
  const data=await actions.api("/api/users");state.auth.users=data.users;
  state.auth.userList.innerHTML=state.auth.users.map(user=>`<div class="user-card">
    <div><b>${actions.esc(user.username)}</b> – ${actions.esc(user.first_name+" "+user.last_name)}
      <div class="small">${actions.esc(user.role_name)} · ${user.active?"aktiv":"deaktiviert"}${user.locked_until?` · <span class="lock-status">Login gesperrt bis ${new Date(user.locked_until).toLocaleString()}</span>`:user.failed_login_attempts?` · ${user.failed_login_attempts} Fehlversuche`:""}</div></div>
    <label class="inline-role">Rolle <select onchange="assignUserRole(${user.id},this.value)">${state.auth.roles.map(role=>
      `<option value="${role.id}" ${role.id===user.role_id?"selected":""}>${actions.esc(role.name)}</option>`).join("")}</select></label>
    <label class="inline-role"><input type="checkbox" ${user.password_policy_exempt?"checked":""} onchange="setUserPolicyExemption(${user.id},this.checked)"> Passwortrichtlinie aussetzen</label>
    <div class="actions compact">
      <button onclick="openAdminPassword(${user.id})">Passwort ändern</button>
      <button onclick="generateRecoveryCode(${user.id})">Neuer Wiederherstellungscode</button>
      ${user.recovery_locked_until?`<span class="lock-status">Wiederherstellung gesperrt bis ${new Date(user.recovery_locked_until).toLocaleString()}</span>`:''}
      ${user.locked_until||user.failed_login_attempts||user.failed_recovery_attempts?`<button onclick="unlockUser(${user.id})">Zugangssperren aufheben</button>`:""}
      <button onclick="toggleUser(${user.id},${!user.active})">${user.active?"Deaktivieren":"Aktivieren"}</button>
    </div>
  </div>`).join("");
}

export async function unlockUser(id){
  try{await actions.api(`/api/users/${id}/unlock`,{method:"PUT",body:"{}"});actions.toast("Login-Sperre wurde aufgehoben.");await actions.loadUsers()}
  catch(error){actions.toast(error.message)}
}

export async function createUser(){
  const save=WveDrafts.beginSave(state.shared.byId('tab-user-create'));
  try{
    const data=await actions.api("/api/users",{method:"POST",body:JSON.stringify({
      username:state.auth.uUsername.value,first_name:state.auth.uFirst.value,last_name:state.auth.uLast.value,email:state.auth.uEmail.value,role_id:Number(state.auth.uRole.value),
      password_policy_exempt:state.auth.uPasswordPolicyExempt.checked,must_change:state.auth.uMustChangePassword.checked
    })});
    actions.showCredentials(data);
    if(WveDrafts.finishSave(save)){
      state.auth.uUsername.value=state.auth.uFirst.value=state.auth.uLast.value=state.auth.uEmail.value="";
      state.auth.uPasswordPolicyExempt.checked=false;state.auth.uMustChangePassword.checked=true;
    }
    await actions.loadUsers();
  }catch(error){actions.toast(error.message)}
}

export async function setUserPolicyExemption(id,password_policy_exempt){
  try{await actions.api("/api/users/"+id,{method:"PUT",body:JSON.stringify({password_policy_exempt})});actions.toast("Passwortrichtlinie aktualisiert.");await actions.loadUsers()}
  catch(error){actions.toast(error.message);await actions.loadUsers()}
}

export function showCredentials(data){
  state.shared.byId("credentialUsername").value=data.username||"";
  state.shared.byId("credentialPassword").value=data.temporary_password||"";
  state.shared.byId("credentialRecovery").value=data.recovery_code||"";
  state.shared.credentialDialog.showModal();
}

export async function copyCredential(id){
  try{await navigator.clipboard.writeText(state.shared.byId(id).value);actions.toast("Angabe wurde kopiert.")}
  catch(error){actions.toast("Die Angabe konnte nicht kopiert werden.")}
}

export async function copyAllCredentials(){
  const text=`Benutzername: ${state.shared.byId("credentialUsername").value}\nPasswort: ${state.shared.byId("credentialPassword").value}\nWiederherstellungscode: ${state.shared.byId("credentialRecovery").value}`;
  try{await navigator.clipboard.writeText(text);actions.toast("Alle Zugangsdaten wurden kopiert.")}
  catch(error){actions.toast("Die Zugangsdaten konnten nicht kopiert werden.")}
}

export async function assignUserRole(id,roleIdValue){
  try{await actions.api("/api/users/"+id,{method:"PUT",body:JSON.stringify({role_id:Number(roleIdValue)})});actions.toast("Rolle zugewiesen.");await actions.loadUsers()}
  catch(error){actions.toast(error.message);await actions.loadUsers()}
}

export async function toggleUser(id,active){
  try{await actions.api("/api/users/"+id,{method:"PUT",body:JSON.stringify({active})});await actions.loadUsers()}
  catch(error){actions.toast(error.message)}
}

export function openAdminPassword(id){
  const user=state.auth.users.find(item=>item.id===id);if(!user)return;
  state.shared.byId("adminPasswordUserId").value=id;state.shared.byId("adminPasswordUserLabel").textContent=`Konto: ${user.username}`;
  state.shared.byId("adminPasswordValue").value=state.shared.byId("adminPasswordValue2").value="";
  state.shared.byId("adminPasswordDialog").showModal();
}

export async function saveAdminPassword(){
  const first=state.shared.byId("adminPasswordValue").value,second=state.shared.byId("adminPasswordValue2").value;
  if(first!==second)return actions.toast("Die Passwörter stimmen nicht überein.");
  try{
    await actions.api(`/api/users/${state.shared.byId("adminPasswordUserId").value}/password`,{method:"PUT",body:JSON.stringify({new_password:first})});
    state.shared.byId("adminPasswordDialog").close();actions.toast("Passwort wurde geändert.");
  }catch(error){actions.toast(error.message)}
}

export async function generateRecoveryCode(id){
  state.auth.pendingRecoveryUserId=id;state.shared.recoveryCodeConfirmDialog.showModal();
}

export function cancelRecoveryCodeGeneration(){state.auth.pendingRecoveryUserId=null;state.shared.recoveryCodeConfirmDialog.close()}

export async function confirmRecoveryCodeGeneration(){
  if(!state.auth.pendingRecoveryUserId)return;
  const id=state.auth.pendingRecoveryUserId;state.auth.pendingRecoveryUserId=null;state.shared.recoveryCodeConfirmDialog.close();
  try{
    const data=await actions.api(`/api/users/${id}/recovery`,{method:"PUT",body:"{}"});
    actions.showSecret("Neuer Wiederherstellungscode",data.recovery_code);
  }catch(error){actions.toast(error.message)}
}
