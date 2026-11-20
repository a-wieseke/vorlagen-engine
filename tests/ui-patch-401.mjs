/** Regression checks against a disposable server; never use the working DB. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.WVE_TEST_URL;
assert(base,'Set WVE_TEST_URL to the disposable test server.');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(7000);
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const call=(path,method,data)=>page.evaluate(([path,method,data])=>api(path,{method,body:data===undefined?undefined:JSON.stringify(data)}),[path,method,data]);
const active=tab=>page.locator('#tab-'+tab+'.active').waitFor({state:'visible'});
const confirm=()=>page.locator('#actionConfirmation').getByRole('button',{name:'Bestätigen'}).click();
const toast=text=>page.waitForFunction(text=>byId('toast').textContent.includes(text),text);
const projectData=key=>({projekt:{id:key,bezeichnung:key},kontakte:[]});
const project=key=>call('/api/projects','POST',{data:projectData(key)});
const template=async name=>call('/api/templates','POST',{name,category_id:await page.evaluate(()=>categories[0].id),subject:'Projekt {{projekt.id}}',body:'Inhalt für {{projekt.id}}',fields:[],active:true});
const visibleSave=page.locator('#saveProjectEmailButton');

try{
  await page.goto(base);
  await page.locator('#loginPassword').fill('Admin12345!');
  await page.locator('#loginForm button').click();
  await page.waitForFunction(()=>typeof byId==='function'&&!byId('appView').hidden&&byId('bidImportYear').value&&categories.length);
  const a=await project('PATCH-A'),b=await project('PATCH-B');
  const first=await template('Patch Vorlage A'),second=await template('Patch Vorlage B');
  await page.evaluate(async id=>{await loadProjects();await loadTemplates();await openTemplate(id)},first.id);
  await page.evaluate(id=>useProject(id),a.id);
  await page.locator('button[onclick="generateEmail()"]').click();
  assert.equal(await page.locator('#resultSubject').inputValue(),'Projekt PATCH-A');
  assert(await visibleSave.isEnabled());
  await page.locator('#resultBody').fill('Mein bearbeiteter Text zu A');
  await page.locator('#projectPickerButton').click();
  await page.locator('#projectPickerDialog').getByRole('button',{name:/PATCH-B/}).click();
  assert(await visibleSave.isDisabled());
  assert(await page.locator('#saveProjectEmailHint').isVisible());
  assert.equal(await page.locator('#resultBody').innerText(),'Mein bearbeiteter Text zu A');
  // The handler must refuse the save even when called without the UI button.
  await page.evaluate(()=>saveEmailToProject());
  assert.equal((await call('/api/projects/'+b.id+'/workspace','GET')).emails.length,0);
  await page.evaluate(()=>{switchTab('dashboard');switchTab('generator')});
  assert(await visibleSave.isDisabled());
  await page.locator('button[onclick="generateEmail()"]').click();
  await page.locator('#actionConfirmation').getByRole('button',{name:'Abbrechen'}).click();
  assert.equal(await page.locator('#resultBody').innerText(),'Mein bearbeiteter Text zu A');
  await page.locator('button[onclick="generateEmail()"]').click();
  await confirm();
  await page.waitForFunction(()=>byId('resultSubject').value==='Projekt PATCH-B');
  assert.equal(await page.locator('#resultSubject').inputValue(),'Projekt PATCH-B');
  await visibleSave.click();
  await toast('E-Mail wurde im Projekt gespeichert.');
  assert.equal((await call('/api/projects/'+b.id+'/workspace','GET')).emails[0].subject,'Projekt PATCH-B');
  assert.equal((await call('/api/projects/'+a.id+'/workspace','GET')).emails.length,0);
  console.log('PASS: E-Mail-Kontext, Warnhinweis, Entwurf und Projektspeicherung');

  // Hold the HTTP response after the real server accepts the save.
  async function delayedSave(id,duringSave){
    const path=base+'/api/templates/'+id;
    let release,seen,timer;
    const held=new Promise(resolve=>{release=resolve});
    const sent=new Promise((resolve,reject)=>{seen=resolve;timer=setTimeout(()=>reject(Error('Vorlagen-PUT fehlt')),7000)});
    await page.route(path,async route=>{
      if(route.request().method()!=='PUT')return route.continue();
      const response=await route.fetch();seen(response.status());
      await held;await route.fulfill({response});
    });
    try{
      await page.evaluate(()=>{window.patchPendingSave=saveTemplate()});
      assert.equal(await sent,200);
      await duringSave();
    }finally{clearTimeout(timer);release()}
    await page.evaluate(()=>window.patchPendingSave);
    await page.unroute(path);
  }
  await page.evaluate(id=>editTemplate(id),first.id);
  await page.locator('#tplName').fill('Gespeicherte Änderung A');
  await delayedSave(first.id,async()=>{
    await page.evaluate(id=>editTemplate(id),second.id);
    await page.locator('#tplName').fill('Ungespeicherter Entwurf B');
  });
  assert.equal(await page.locator('#tplId').inputValue(),String(second.id));
  await page.evaluate(id=>{switchTab('templates');editTemplate(id)},second.id);
  assert.equal(await page.locator('#tplName').inputValue(),'Ungespeicherter Entwurf B');
  await page.evaluate(id=>editTemplate(id),first.id);
  await page.locator('#tplName').fill('Zwischenstand A');
  await delayedSave(first.id,()=>page.locator('#tplName').fill('Neuerer Entwurf A'));
  await page.evaluate(id=>{switchTab('templates');editTemplate(id)},first.id);
  assert.equal(await page.locator('#tplName').inputValue(),'Neuerer Entwurf A');
  const stored=(await call('/api/templates','GET')).templates;
  assert.equal(stored.find(t=>t.id===first.id).name,'Zwischenstand A');
  assert.equal(stored.find(t=>t.id===second.id).name,'Patch Vorlage B');
  console.log('PASS: verzögerte Speicherung schützt fremde und neuere Entwürfe');

  await page.evaluate(data=>{switchTab('project-create');prepareProjectImport(data,'json')},projectData('PATCH-A'));
  await call('/api/projects/'+a.id,'DELETE',{expected_revision:a.revision});
  const rejected=page.waitForResponse(response=>response.url()===base+'/api/projects'&&response.request().method()==='POST');
  await page.locator('button[onclick="confirmProjectImport()"]').click();
  assert.equal((await rejected).status(),409);
  await confirm();
  await toast('archiviert');
  assert((await call('/api/projects','GET')).projects.find(p=>p.id===a.id).archived);
  await page.evaluate(id=>{switchTab('project-overview');void restoreProject(id)},a.id);
  await confirm();
  await toast('Projekt wiederhergestellt');
  assert.equal((await call('/api/projects','GET')).projects.find(p=>p.id===a.id).revision,3);
  console.log('PASS: veraltete Importvorschau reaktiviert kein archiviertes Projekt');

  await call('/api/bidders','POST',{bidder:'Bestandsbieter',active:true});
  const bidder=(await call('/api/bidders','GET')).bidders.find(item=>item.bidder==='Bestandsbieter');
  await call('/api/bid/questions','POST',{project_id:b.id,question:'Bestandsfrage'});
  await page.evaluate(()=>loadBidModule());
  const question=(await call('/api/bid/questions','GET')).questions.find(item=>item.question==='Bestandsfrage');
  await page.evaluate(()=>switchTab('bidders'));
  await page.getByRole('button',{name:'Neuen Bieter erfassen'}).click();
  await page.locator('#bidderName').click();
  await page.locator('#bidderName').fill('Neuer Bieter aus Entwurf');
  assert.equal(new URL(page.url()).pathname,'/app/bidder-create');
  await page.evaluate(id=>editBidder(id),bidder.id);
  assert.equal(new URL(page.url()).pathname,'/app/bidder-create/'+bidder.id);
  await page.goBack();
  assert.equal(new URL(page.url()).pathname,'/app/bidder-create');
  await active('bidder-create');
  await page.waitForFunction(()=>!editingBidderId);
  assert.equal(await page.locator('#bidderName').inputValue(),'Neuer Bieter aus Entwurf');
  const bidderSave=page.waitForResponse(r=>r.url()===base+'/api/bidders'&&r.request().method()==='POST');
  await page.locator('button[onclick="saveBidder()"]').click();
  assert((await bidderSave).ok());
  await toast('Bieter gespeichert');
  await page.evaluate(()=>switchTab('bid-questions'));
  await page.getByRole('button',{name:'Bieterfragen erfassen'}).click();
  await page.locator('#bidQuestionProjectButton').click();
  await page.locator('dialog[open]').getByRole('button',{name:/PATCH-B/}).click();
  await page.locator('#bidQuestionText').fill('Neue Frage aus Entwurf');
  await page.evaluate(id=>editBidQuestion(id),question.id);
  await page.goBack();await active('bid-question-create');
  await page.waitForFunction(()=>!editingBidQuestionId);
  assert.equal(await page.locator('#bidQuestionText').inputValue(),'Neue Frage aus Entwurf');
  assert.match(await page.locator('#bidQuestionProjectButton').innerText(),/PATCH-B/);
  const questionSave=page.waitForResponse(r=>r.url()===base+'/api/bid/questions'&&r.request().method()==='POST');
  await page.locator('button[onclick="saveBidQuestion()"]').click();
  assert((await questionSave).ok());
  const questions=(await call('/api/bid/questions','GET')).questions;
  assert.equal(questions.find(item=>item.id===question.id).question,'Bestandsfrage');
  assert(questions.some(item=>item.question==='Neue Frage aus Entwurf'));
  assert((await call('/api/bidders','GET')).bidders.some(item=>item.id===bidder.id&&item.bidder==='Bestandsbieter'));
  assert.deepEqual(errors,[]);
  console.log('PASS: Browser-Zurück stellt Neuanlage wieder her, ohne Bestandsdaten zu ändern');
}finally{await browser.close()}
