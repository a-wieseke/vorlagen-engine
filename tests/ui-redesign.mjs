import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.WVE_TEST_URL||'http://127.0.0.1:9987';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const output='.artifact-work/v4-acceptance';fs.mkdirSync(output,{recursive:true});
const evidence={widths:[],checks:[]};
try{
 await page.goto(base);await page.locator('#loginPassword').fill('Admin12345!');await page.locator('#loginForm button').click();
 await page.waitForFunction(()=>typeof byId==='function'&&!byId('appView').hidden&&byId('bidImportYear').value);
 await page.evaluate(()=>switchTab('generator'));
 assert.equal(await page.locator('#mode').inputValue(),'manual');assert.equal(await page.locator('#templateSelect').inputValue(),'');assert.equal(await page.locator('#projectSelect').inputValue(),'');
 const template=await page.evaluate(()=>templates[0]);
 await page.evaluate(t=>chooseTemplate(t.id),template);
 const body=await page.locator('#resultBody').innerHTML();
 await page.locator('.manual-input').first().fill('mail@example.invalid');
 assert.equal(await page.locator('#resultBody').innerHTML(),body);
 await page.locator('#resultBody').fill('Mein eigener E-Mail-Entwurf');
 await page.evaluate(id=>editTemplate(id),template.id);await page.locator('#tplName').fill('Vorlagenentwurf');
 assert.equal(new URL(page.url()).pathname,`/app/template-edit/${template.id}`);
 await page.evaluate(()=>switchTab('generator'));assert.equal(await page.locator('#resultBody').innerText(),'Mein eigener E-Mail-Entwurf');
 await page.evaluate(id=>editTemplate(id),template.id);assert.equal(await page.locator('#tplName').inputValue(),'Vorlagenentwurf');
 await page.evaluate(()=>switchTab('templates'));await page.goBack();await page.waitForTimeout(200);assert.equal(await page.locator('#tplName').inputValue(),'Vorlagenentwurf');
 // Group expansion must not navigate; only a leaf link changes the route.
 const old=page.url();await page.locator('#primaryNavigation .nav-group-button').filter({hasText:'Dokumente'}).click();assert.equal(page.url(),old);
 await page.locator('#primaryNavigation a').filter({hasText:'Dokumentvorlagen'}).click();assert.equal(new URL(page.url()).pathname,'/app/document-templates');
 evidence.checks.push('manual defaults','explicit generation','mail+template drafts','URLs/back','group expansion');
 // New record/list surfaces are genuinely separate, not hidden halves of one form.
 await page.evaluate(()=>newCustomVariable());assert(await page.locator('#varKey').isVisible());assert.equal(await page.locator('#variableList').isVisible(),false);
 await page.evaluate(()=>switchTab('variables'));assert(await page.locator('#variableList').isVisible());assert.equal(await page.locator('#varKey').isVisible(),false);
 // All visible views at the requested sizes; table overflow must be local.
 const tabs=await page.evaluate(()=>[...document.querySelectorAll('main>.tab')].map(n=>n.id.slice(4)).filter(id=>!['project-detail','template-edit','document-template-edit','bid-question-detail'].includes(id)));
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(200);
  for(const tab of tabs){
   await page.evaluate(tab=>switchTab(tab),tab);await page.waitForTimeout(20);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   evidence.widths.push({width,tab,overflow});
  }
 }
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>switchTab('generator'));await page.screenshot({path:output+'/email-desktop.png',fullPage:true});
 await page.evaluate(id=>editTemplate(id),template.id);await page.screenshot({path:output+'/template-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:900});await page.waitForTimeout(250);await page.evaluate(()=>switchTab('generator'));await page.screenshot({path:output+'/email-mobile.png',fullPage:true});
 await page.locator('#sidebarOpenButton').click();assert(await page.locator('#areaSelect').isVisible());await page.keyboard.press('Escape');
 assert.equal(await page.locator('#appSidebar').evaluate(el=>Math.round(el.getBoundingClientRect().right)),0);
 // Focus restoration and accessible dialog title.
 await page.locator('#templatePickerButton').click();assert(await page.locator('#templatePickerDialog').getAttribute('aria-labelledby'));await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'templatePickerButton');
 evidence.checks.push('separate forms','mobile navigation','dialog focus');
 evidence.errors=errors;fs.writeFileSync(output+'/evidence.json',JSON.stringify(evidence,null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(evidence.widths.filter(x=>x.overflow>1),[]);
 console.log(`PASS ${evidence.widths.length} responsive page checks; ${evidence.checks.join(', ')}`);
}finally{await browser.close()}
