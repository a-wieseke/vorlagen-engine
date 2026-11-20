/** Frontend conflict, draft and deep-link acceptance on a disposable server. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();const errors=[];
page.on('pageerror',error=>errors.push(error.message));page.on('dialog',d=>d.accept());
const base=process.env.WVE_TEST_URL||'http://127.0.0.1:9987';
async function ready(){await page.waitForFunction(()=>window.byId&&byId('bidImportYear').value)}
try{
 await page.goto(base);await page.locator('#loginPassword').fill('Admin12345!');await page.locator('#loginForm button').click();await ready();
 const project=await page.evaluate(async()=>{const p=await api('/api/projects',{method:'POST',body:JSON.stringify({data:{projekt:{id:'CONFLICT-'+Date.now(),bezeichnung:'Gleichzeitig'},kontakte:[{vorname:'Alt'}]}})});await loadProjects();return p});
 await page.evaluate(id=>editProject(id),project.id);assert.equal(new URL(page.url()).pathname,`/app/project-edit/${project.id}`);
 await page.locator('.project-edit-input[data-key="projekt.bezeichnung"]').fill('Meine Änderung');
 await page.evaluate(async id=>{await api(`/api/projects/${id}/contacts`,{method:'PUT',body:JSON.stringify({kontakte:[{vorname:'Neu'}],expected_revision:1})});await saveEditedProject()},project.id);
 assert(await page.locator('#projectEditConflict').isVisible());assert.equal(await page.locator('.project-edit-input[data-key="projekt.bezeichnung"]').inputValue(),'Meine Änderung');
 await page.evaluate(()=>switchTab('templates'));await page.evaluate(id=>editProject(id),project.id);assert.equal(await page.locator('.project-edit-input[data-key="projekt.bezeichnung"]').inputValue(),'Meine Änderung');
 await page.evaluate(async id=>{await loadProjects();openContactDialog(id);editContact(0)},project.id);
 await page.locator('.contact-edit-input[data-key="kontakt.vorname"]').fill('Mein Kontakt');
 await page.evaluate(async id=>{const p=projects.find(p=>p.id===id);await api(`/api/projects/${id}`,{method:'PUT',body:JSON.stringify({data:p.data,expected_revision:p.revision})});await saveContact()},project.id);
 assert(await page.locator('#contactConflict').isVisible());assert.equal(await page.locator('.contact-edit-input[data-key="kontakt.vorname"]').inputValue(),'Mein Kontakt');
 await page.locator('#contactConflict button').click();await page.locator('#actionConfirmation button').filter({hasText:'Abbrechen'}).click();assert.equal(await page.locator('.contact-edit-input[data-key="kontakt.vorname"]').inputValue(),'Mein Kontakt');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
 const template=await page.evaluate(()=>templates.find(t=>t.active&&!t.archived).id);
 await page.evaluate(id=>openTemplate(id),template);assert.equal(new URL(page.url()).pathname,`/app/generator/${template}`);
 await page.reload();await ready();await page.waitForFunction(id=>templateSelect.value===String(id),template);
 assert.equal(await page.locator('#mode').inputValue(),'manual');
 await page.goto(base+`/vorlage/${template}`);await ready();assert.equal(await page.locator('#templateSelect').inputValue(),String(template));
 await page.goto(base+'/excel-import');await ready();assert(await page.locator('#tab-excel-import').isVisible());
 assert.deepEqual(errors,[]);console.log('PASS project/contact conflicts preserve inputs; reload confirmation; generator/direct/Excel URLs');
}finally{await browser.close()}
