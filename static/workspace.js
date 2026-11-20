/** Structural view composition. Existing form IDs remain stable for feature
 * modules; list, detail and editing surfaces no longer share a crowded page. */
const byId=id=>document.getElementById(id);
function page(id,title,back){
  const section=document.createElement('section');section.className='tab';section.id='tab-'+id;
  const head=document.createElement('div');head.className='section-head';
  const button=document.createElement('button');button.className='back-link';button.textContent='← Zur Übersicht';button.onclick=()=>window.switchTab(back);
  head.append(button);section.append(head);document.querySelector('main').append(section);return section;
}
function separate(source,child,target,back=source){
  const card=document.querySelector(`#tab-${source} .grid.two > .card:nth-child(${child})`);
  if(!card)return;
  page(target,'',back).append(card);
  const grid=document.querySelector(`#tab-${source} .grid.two`);if(grid)grid.classList.add('single');
}
function action(container,label,callback){const button=document.createElement('button');button.className='primary';button.textContent=label;button.onclick=callback;container.append(button);return button;}
export function initializeWorkspace(){
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link||event.ctrlKey||event.metaKey||event.button!==0)return;
    const url=new URL(link.href,location.href);
    if(url.origin===location.origin&&/^\/api\/.*\/(?:download|original)$/.test(url.pathname)){
      event.preventDefault();window.downloadUrl(url.pathname+url.search);
    }
  });
  const discard=document.createElement('button');discard.id='discardDraftButton';discard.className='draft-discard';discard.textContent='Entwurf verwerfen';discard.hidden=true;
  document.querySelector('.workspace-header').append(discard);
  const active=()=>document.querySelector('.tab.active');
  window.updateDraftIndicator=()=>{discard.hidden=!window.WveDrafts?.dirty(active())};
  discard.onclick=async()=>{if(await window.confirmAction('Die ungespeicherten Änderungen dieser Seite verwerfen?'))window.WveDrafts.discard(active())};
  separate('variables',2,'variable-edit');separate('roles',2,'role-edit');
  separate('document-blocks',2,'document-block-edit');separate('users',1,'user-create');
  const projectForm=byId('projectEditDialog').firstElementChild;
  projectForm.removeAttribute('method');projectForm.className='card';
  projectForm.querySelector('button[onclick*="closest"]').onclick=()=>window.openProjectDetail(Number(byId('projectEditId').value));
  projectForm.querySelector('button[onclick*="closest"]').textContent='Zur Projektansicht';
  page('project-edit','','project-overview').append(projectForm);byId('projectEditDialog').remove();
  for(const [dialogId,target,back] of [['bidAnswerDetailDialog','bid-answer-detail','bid-answers'],['bidderViewDialog','bidder-detail','bidders']]){
    const dialog=byId(dialogId);if(!dialog)continue;
    const form=document.createElement('div');while(dialog.firstChild)form.append(dialog.firstChild);form.classList.add('card');
    const close=form.querySelector('button[onclick*="close()"]');if(close){close.textContent='Zur Übersicht';close.onclick=()=>window.switchTab(back)}
    page(target,'',back).append(form);
    dialog.showModal=()=>window.switchTab(target);
  }
  const search=document.createElement('input');search.type='search';search.id='templateLibrarySearch';search.placeholder='Vorlagen durchsuchen';search.setAttribute('aria-label','Vorlagen durchsuchen');
  search.oninput=()=>{document.querySelectorAll('.template-category-group').forEach(group=>{group.querySelectorAll('.template-list-item').forEach(row=>{row.hidden=!(group.querySelector('h3').textContent+' '+row.textContent).toLocaleLowerCase('de').includes(search.value.toLocaleLowerCase('de'))});group.hidden=![...group.querySelectorAll('.template-list-item')].some(row=>!row.hidden)})};byId('templateList').before(search);
  const usersHead=document.createElement('div');usersHead.className='section-head';usersHead.innerHTML='<h2>Benutzerverwaltung</h2>';action(usersHead,'Benutzer anlegen',()=>window.switchTab('user-create'));byId('tab-users').prepend(usersHead);
  const roleButton=document.querySelector('#tab-roles button[onclick="newRole()"]');if(roleButton)roleButton.onclick=()=>{window.newRole();window.switchTab('role-edit')};
  // Technical operations belong to System, exports to the matching library.
  const backup=document.querySelector('#tab-settings [data-permission="backup_manage"]');if(backup){backup.classList.add('card');page('backups','','system-status').append(backup);backup.querySelector('.hint').textContent='Tägliche Sicherung: beim Start und stündliche Prüfung, 30 Tage Aufbewahrung. Vor jeder Wiederherstellung wird zusätzlich gesichert.';}
  const exports=document.querySelector('#tab-settings [data-permission="templates_export_all"]');if(exports){exports.classList.add('card');const details=document.createElement('details');details.innerHTML='<summary>Sammel-Export</summary>';while(exports.firstChild)details.append(exports.firstChild);exports.append(details);byId('tab-templates').append(exports);}
  // Template properties are separate from the writing surface.
  const panel=document.querySelector('.template-placeholder-panel');
  const title=document.createElement('h2');title.textContent='Eigenschaften';panel.prepend(title);
  for(const id of ['tplActive','tplCategory','tplName'])panel.insertBefore(byId(id).closest('label'),title.nextSibling);
  const placeholderSearch=document.createElement('input');placeholderSearch.type='search';placeholderSearch.id='placeholderSearch';placeholderSearch.placeholder='Platzhalter suchen';placeholderSearch.setAttribute('aria-label','Platzhalter suchen');placeholderSearch.oninput=()=>{document.querySelectorAll('#variableChips .chip').forEach(chip=>chip.hidden=!chip.textContent.toLocaleLowerCase('de').includes(placeholderSearch.value.toLocaleLowerCase('de')))};
  byId('variableChips').before(placeholderSearch);
  const extra=document.createElement('details');extra.className='secondary-actions';extra.innerHTML='<summary>Weitere Aktionen</summary>';const extraBody=document.createElement('div');extraBody.className='actions';extra.append(extraBody);
  const templateActions=byId('templateHistoryButton').parentElement;
  ['templateHistoryButton','templateExportActions'].forEach(id=>extraBody.append(byId(id)));templateActions.append(extra);
  const newTemplateButton=templateActions.querySelector('button[onclick="newTemplate()"]');if(newTemplateButton)extraBody.append(newTemplateButton);
  const tools=document.createElement('button');tools.id='dashboardEditButton';tools.textContent='Dashboard bearbeiten';tools.onclick=()=>{const active=byId('tab-dashboard').classList.toggle('dashboard-editing');tools.textContent=active?'Bearbeitung beenden':'Dashboard bearbeiten';tools.setAttribute('aria-pressed',String(active));document.querySelectorAll('.quicklink-row').forEach(row=>row.draggable=active);};document.querySelector('.dashboard-tools').append(tools);
  // Object tabs: only this level has horizontal navigation.
  const layout=document.querySelector('.project-detail-layout'),overview=layout.children[0],contacts=layout.children[1],phases=document.querySelector('#tab-project-detail .project-workspace');
  const emails=byId('projectSavedEmails').closest('section'),docs=byId('projectDocumentSection');
  const tabs=document.createElement('div');tabs.className='object-tabs';tabs.setAttribute('aria-label','Projektansichten');tabs.setAttribute('role','tablist');layout.before(tabs);
  const views=[['Übersicht',[overview,phases]],['Kontakte',[contacts]],['E-Mails',[emails]],['Dokumente',[docs]],['Bieterfragen',[phases]]];
  const all=[overview,contacts,phases,emails,docs];
  views.forEach(([label,panels],index)=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('role','tab');button.onclick=()=>{all.forEach(panel=>panel.hidden=!panels.includes(panel));tabs.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-selected',String(b===button));});};tabs.append(button);if(index===0)button.click();});
  // Bieterfragen use a real detail page instead of a full-screen modal.
  const detail=page('bid-question-detail','','bid-questions'),card=document.createElement('div');card.className='card';
  ['bidQuestionDialogTitle','bidQuestionDialogMeta','bidQuestionDialogContent','bidQuestionDialogActions'].forEach(id=>card.append(byId(id)));detail.append(card);
  document.querySelector('#tab-generator button[onclick="generateEmail()"]')?.replaceChildren(document.createTextNode('In E-Mail übernehmen'));
  const hint=document.createElement('p');hint.className='hint';hint.textContent='Variablen ändern das Ergebnis erst nach „In E-Mail übernehmen“. Ihr bearbeiteter Text bleibt bis dahin unverändert.';document.querySelector('#tab-generator .card').append(hint);
  byId('toast').setAttribute('role','status');byId('toast').setAttribute('aria-live','polite');
  // Generated form views expose an explicit route action without duplicating
  // the underlying save/validation implementation.
  for(const [fn,target] of [['newDocumentBlock','document-block-edit'],['editDocumentBlock','document-block-edit']]){
    const original=window[fn];window[fn]=(...args)=>{original(...args);window.switchTab(target)};
  }
  const answerDetail=window.openBidAnswerDetail;
  window.openBidAnswerDetail=id=>{window.currentBidDetailId=Number(id);answerDetail(id)};
  document.querySelectorAll('dialog').forEach(dialog=>{const heading=dialog.querySelector('h2');if(heading){heading.id||=dialog.id+'-heading';dialog.setAttribute('aria-labelledby',heading.id);}});
}
