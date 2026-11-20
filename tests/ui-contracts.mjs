/** Behavioral replacements for the former source-string UI assertions.
 * Only run against a disposable test server, never the working database. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({permissions:['clipboard-read','clipboard-write'],viewport:{width:1440,height:1000}});
const page=await context.newPage();page.setDefaultTimeout(6000);const errors=[],results={};
page.on('pageerror',e=>errors.push(e.message));
page.on('dialog',dialog=>{if(dialog.type()==='beforeunload')dialog.accept();else{errors.push('Unexpected native dialog: '+dialog.message());dialog.dismiss();}});
const check=async(name,fn)=>{try{await fn();results[name]='PASS'}catch(e){results[name]=e.message;await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close())).catch(()=>{})}};
const closeDialog=async()=>{await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'))};
try{
 await page.goto(process.env.WVE_TEST_URL||'http://127.0.0.1:9987');
 await page.locator('#loginPassword').fill('Admin12345!');await page.locator('#loginForm button').click();
 await page.waitForFunction(()=>typeof byId==='function'&&!byId('appView').hidden&&byId('bidImportYear').value);
 const ids=await page.evaluate(async()=>{
  const key='UI-'+Date.now();
  const project=await api('/api/projects',{method:'POST',body:JSON.stringify({data:{schema_version:'1.0',projekt:{id:key,bezeichnung:'Suchbares Musterprojekt'},auftraggeber:{name:'Musterstadt'},kontakte:[{vorname:'Anna',nachname:'Test',email:'anna@example.invalid'}]}})});
  const category=categories[0];
  const template=await api('/api/templates',{method:'POST',body:JSON.stringify({name:'UI-Vertrag',category_id:category.id,subject:'{{projekt.id}} – Test',body:'Hallo {{kontakt.vorname}}: {{eingabe.hinweis}}',body_html:'<p>Hallo {{kontakt.vorname}}: {{eingabe.hinweis}}</p>',fields:[],active:true,notice_enabled:false})});
  await loadTemplates();await loadProjects();return {project:project.id,template:template.id};
 });
 await check('defaults',async()=>{
  await page.evaluate(()=>switchTab('generator'));
  assert.equal(await page.locator('#mode').inputValue(),'manual');assert.equal(await page.locator('#projectSelect').inputValue(),'');assert.equal(await page.locator('#templateSelect').inputValue(),'');
  assert.match(await page.locator('#projectPickerButton').innerText(),/Projekt auswählen/);
  assert.match(await page.locator('#templatePickerButton').innerText(),/E-Mailvorlage auswählen/);
  await page.evaluate(()=>newTemplate());assert(await page.locator('#tplActive').isChecked());
  assert.equal(await page.locator('#templateList').isVisible(),false);
  await page.evaluate(()=>switchTab('project-create'));assert(await page.locator('#projectManualFields').isVisible());
 });
 await check('fields',async()=>{
  await page.evaluate(async({project,template})=>{switchTab('generator');await chooseTemplate(template);setMode('project');chooseProject(project)},ids);
  assert(await page.locator('.manual-input[data-key="projekt.id"]').isVisible());
  assert(await page.locator('.manual-input[data-key="kontakt.vorname"]').isVisible());
  assert(await page.locator('.manual-input[data-key="eingabe.hinweis"]').isVisible());
  await page.locator('#contactSelect').selectOption('');assert.equal(await page.locator('.manual-input[data-key="kontakt.vorname"]').inputValue(),'');
  await page.locator('.manual-input[data-key="eingabe.hinweis"]').fill('Manueller Wert');
  await page.evaluate(()=>loadProjects());assert.equal(await page.locator('.manual-input[data-key="eingabe.hinweis"]').inputValue(),'Manueller Wert');
 });
 await check('search',async()=>{
  await page.evaluate(()=>openProjectPicker());await page.locator('#projectPickerSearch').fill('musterpro');
  assert.match(await page.locator('#projectPickerResults').innerText(),/Musterprojekt/);await closeDialog();
  await page.evaluate(()=>openTemplatePicker());await page.locator('#templatePickerSearch').fill('Vertrag');
  assert.match(await page.locator('#templatePickerResults').innerText(),/UI-Vertrag/);await closeDialog();
  await page.evaluate(()=>switchTab('project-overview'));await page.locator('#projectOverviewSearch').fill('musterpro');assert.match(await page.locator('#projectList').innerText(),/Musterprojekt/);
  await page.locator('#projectOverviewSearch').fill('');
 });
 await check('editor',async()=>{
  await page.evaluate(id=>editTemplate(id),ids.template);
  await page.locator('#tplBody').fill('Ausgewählter Text');
  assert.equal(await page.locator('#tplBody').innerText(),'Ausgewählter Text');
  for(const shortcut of ['Control+b','Control+i']){
   await page.locator('#tplBody').focus();await page.keyboard.press('Control+a');
   const before=await page.evaluate(()=>getSelection().toString());
   await page.keyboard.press(shortcut);assert.equal(await page.evaluate(()=>getSelection().toString()),before);
   await page.keyboard.press(shortcut);assert.equal(await page.evaluate(()=>getSelection().toString()),before);
  }
  const html=await page.locator('#tplBody').innerHTML();assert(!/<(?:strong|b|i|em)[ >]/i.test(html));assert.match(html,/Ausgewählter Text/);
  await page.evaluate(()=>openTemplateTest());assert(await page.locator('#templateTestDialog').isVisible());assert.match(await page.locator('#templateTestBody').innerText(),/Ausgewählter Text/);await closeDialog();
 });
 await check('output',async()=>{
  await page.evaluate(()=>{switchTab('generator');resultTo.value='nicht-kopieren@example.invalid';resultSubject.value='NICHT KOPIEREN';setEditorHtml(resultBody,'<p>Nur <strong>dieser Text</strong></p>')});
  await page.evaluate(()=>copyResult());const text=await page.evaluate(()=>navigator.clipboard.readText());assert.match(text,/Nur dieser Text/);assert(!text.includes('NICHT KOPIEREN')&&!text.includes('@'));
  const encoded=await page.evaluate(()=>mailtoEncode('Ein Wort\nNächste Zeile +'));
  assert(!encoded.includes('+'));assert.equal(decodeURIComponent(encoded),'Ein Wort\r\nNächste Zeile +');
 });
 await check('eml',async()=>{
  const download=page.waitForEvent('download');
  await page.evaluate(()=>downloadEml());const file=await download;
  const mime=await fs.readFile(await file.path(),'utf8');assert.match(mime,/X-Unsent: 1/);assert.match(mime,/multipart\/alternative/);assert.match(mime,/text\/html/);
 });
 await check('notice',async()=>{
  await page.evaluate(id=>{const t=templates.find(t=>t.id===id);t.notice_enabled=true;t.notice_text='Bitte Anlagen prüfen';t.notice_html='<p>Bitte Anlagen prüfen</p>';t.notice_mode='acknowledge';noticeAcknowledged=false;renderTemplateNotice(t)},ids.template);
  assert(await page.locator('#templateNotice').isVisible());assert.equal(await page.locator('#downloadEmlButton').getAttribute('aria-disabled'),'true');
  await page.locator('#downloadEmlButton').dispatchEvent('click');assert(await page.locator('#noticeRequiredDialog').isVisible());await closeDialog();
  await page.evaluate(()=>acknowledgeNotice());assert.notEqual(await page.locator('#downloadEmlButton').getAttribute('aria-disabled'),'true');
 });
 await check('dashboard',async()=>{
  await page.evaluate(()=>switchTab('dashboard'));assert.equal(await page.locator('.dashboard-add').isVisible(),false);await page.locator('#dashboardEditButton').click();assert(await page.locator('.dashboard-add').isVisible());
  await page.locator('#dashboardTemplateSearch').click();await page.locator('#dashboardTemplateDialogSearch').fill('Vertrag');assert.match(await page.locator('#dashboardTemplateDialog').innerText(),/UI-Vertrag/);await closeDialog();
  await page.evaluate(()=>switchTab('templates'));const menu=page.locator('.template-actions-menu').first();await menu.locator('summary').click();assert(await menu.getAttribute('open')!==null);await page.locator('#pageTitle').click();assert.equal(await menu.getAttribute('open'),null);
  assert(await page.locator('#templateList [draggable="true"]').count()>0);
 });
 await check('archive',async()=>{
  await page.evaluate(id=>archiveTemplate(id),ids.template);assert(await page.locator('#archiveTemplateDialog').isVisible());await closeDialog();
  await page.evaluate(async id=>{await api(`/api/templates/${id}`,{method:'DELETE'});byId('showArchivedTemplates').checked=true;await loadTemplates()},ids.template);
  assert.match(await page.locator('#templateList').innerText(),/UI-Vertrag/);
  assert(await page.locator('.archived-template-select').count()>0);
  await page.evaluate(()=>{byId('showArchivedTemplates').checked=false;return loadTemplates()});assert(!((await page.locator('#templateList').innerText()).includes('UI-Vertrag')));
 });
 await check('bids',async()=>{
  await page.evaluate(()=>{switchTab('bid-question-create');openBidProjectPicker('single')});assert(await page.locator('#bidProjectPickerDialog').isVisible());await closeDialog();
  await page.evaluate(()=>openBidderPicker('single'));assert(await page.locator('#bidderPickerDialog').isVisible());await closeDialog();
  await page.evaluate(()=>openBidTaxonomyPicker('category','single'));assert(await page.locator('#bidTaxonomyPickerSearch').isVisible());await closeDialog();
  await page.evaluate(()=>{switchTab('bid-question-batch');addBidBatchRow()});assert(await page.locator('#bidBatchRows textarea').count()>0);
  await page.evaluate(()=>newBidAnswer());assert.equal(await page.locator('.bid-answer-variant').count(),2);await page.locator('.bid-answer-variant textarea').first().fill('Variantenentwurf');
  await page.evaluate(()=>switchTab('bid-answers'));await page.evaluate(()=>newBidAnswer());assert.equal(await page.locator('.bid-answer-variant textarea').first().inputValue(),'Variantenentwurf');
  await page.evaluate(()=>switchTab('bidders'));assert.equal(await page.locator('#bidderName').isVisible(),false);
 });
 await check('documents',async()=>{
  await page.evaluate(()=>switchTab('document-create'));assert(await page.locator('#tab-document-create').isVisible());
  await page.evaluate(()=>newDocumentTemplate());assert(await page.locator('#tab-document-template-edit').isVisible());assert.equal(await page.locator('#tab-document-templates').isVisible(),false);
  await page.evaluate(()=>newDocumentBlock());assert(await page.locator('#tab-document-block-edit').isVisible());
 });
 await check('navigation',async()=>{
  await page.evaluate(()=>switchTab('templates'));const path=page.url();
  await page.locator('#primaryNavigation .nav-group-button').filter({hasText:'Dokumente'}).click();assert.equal(page.url(),path);
  await page.locator('#primaryNavigation a').filter({hasText:'Dokumentvorlagen'}).click();assert.equal(new URL(page.url()).pathname,'/app/document-templates');
  assert.equal(await page.locator('#subNav').count(),0);assert.equal(await page.locator('#moduleNav').count(),0);
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  await page.locator('#sidebarOpenButton').click();await page.keyboard.press('Escape');
  assert.equal(await page.locator('#appSidebar').evaluate(el=>Math.round(el.getBoundingClientRect().right)),0);
 });
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results));
}finally{await browser.close()}
