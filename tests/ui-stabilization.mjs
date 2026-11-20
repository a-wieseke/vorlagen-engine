import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const base=process.env.WVE_TEST_URL||'http://127.0.0.1:9987';
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(base);
  await page.locator('#loginPassword').fill('Admin12345!');
  await page.locator('#loginForm button').click();
  await page.waitForFunction(()=>typeof byId==='function'&&!byId('appView').hidden&&byId('bidImportYear').value);
  const id=await page.evaluate(()=>templates[0].id);
  await page.evaluate(id=>editTemplate(id),id);
  await page.locator('#tplName').fill('Mein ungespeicherter Entwurf');
  await page.evaluate(()=>switchTab('project-overview'));
  await page.evaluate(id=>editTemplate(id),id);
  assert.equal(await page.locator('#tplName').inputValue(),'Mein ungespeicherter Entwurf');
  await page.evaluate(async()=>{
    for(const key of ['RACE-A','RACE-B'])await api('/api/projects',{method:'POST',body:JSON.stringify({data:{projekt:{id:key,bezeichnung:key},kontakte:[]}})});
    await loadProjects();
  });
  const ids=await page.evaluate(()=>projects.filter(p=>p.project_key.startsWith('RACE')).map(p=>p.id));
  await page.route(`**/api/projects/${ids[0]}/workspace`,async route=>{const response=await route.fetch();await new Promise(r=>setTimeout(r,600));await route.fulfill({response});});
  await page.evaluate(ids=>{openProjectDetail(ids[0]);openProjectDetail(ids[1]);},ids);
  await page.waitForTimeout(900);
  assert.equal(await page.evaluate(()=>currentProjectWorkspace.project.id),ids[1]);
  // A module failure must remain on the authenticated shell, not the login.
  await page.route('**/api/templates',route=>route.fulfill({status:500,contentType:'application/json',body:'{"error":"Testausfall"}'}));
  await page.evaluate(()=>boot());
  assert.equal(await page.locator('#appView').isVisible(),true);
  assert.match(await page.locator('#moduleLoadErrors').innerText(),/Testausfall/);
  assert.deepEqual(errors,[]);
  console.log('PASS drafts, delayed project responses, module error isolation');
}finally{await browser.close()}
