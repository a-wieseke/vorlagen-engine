// Run ONLY against an isolated test instance; creates templates/projects/bidders.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const artifacts=path.resolve(".artifact-work/v33-fixtures");fs.mkdirSync(artifacts,{recursive:true});
const fixture=path.join(artifacts,"testbild.png");
execFileSync(process.env.WVE_TEST_PYTHON||"python",["-c","from PIL import Image; import sys; Image.new('RGB',(800,400),(35,110,160)).save(sys.argv[1])",fixture]);
const browser=await chromium.launch({channel:"chrome",headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1100},permissions:["clipboard-read","clipboard-write"]});
const page=await context.newPage();page.setDefaultTimeout(15000);
const errors=[];page.on("pageerror",e=>errors.push(e.message));page.on("dialog",d=>{if(d.type()==='beforeunload')d.accept();else{errors.push("Unexpected system dialog");d.dismiss()}});
const unique=Date.now();
async function api(url,method="GET",body){return page.evaluate(async({url,method,body})=>api(url,{method,body:body?JSON.stringify(body):undefined}),{url,method,body})}
async function tab(name){await page.evaluate(name=>switchTab(name),name);await page.waitForTimeout(230)}
try{
  await page.goto(process.env.WVE_TEST_URL||"http://127.0.0.1:9993",{waitUntil:"domcontentloaded",timeout:45000});
  await page.locator("#loginUsername").fill("admin");await page.locator("#loginPassword").fill("Admin12345!");await page.locator("#loginForm button[type=submit]").click();
  await page.waitForFunction(()=>!document.querySelector("#appView").hidden&&byId("bidImportYear").value!=="");
  await tab("templates");await page.getByRole("button",{name:"Neue Vorlage erstellen",exact:true}).click();
  await page.locator("#tplName").fill(`Bildtest ${unique}`);await page.locator("#tplSubject").fill("Bilder & Umlaute äöü");
  await page.locator("#tplBody").fill("Vorher Nachher");
  await page.evaluate(()=>{
    const editor=byId("tplBody"),range=document.createRange();range.setStart(editor.firstChild,7);range.collapse(true);
    const selection=getSelection();selection.removeAllRanges();selection.addRange(range);rememberEditorSelection(editor);
  });
  await page.locator("#tab-template-edit").getByRole("button",{name:"Bild einfügen oder bearbeiten"}).click();
  await page.locator("#emailImageFile").setInputFiles(fixture);
  await page.waitForFunction(()=>!byId("saveEmailImageButton").disabled);
  await page.locator("#emailImageAlt").fill("Plan & Ansicht");await page.locator("#emailImageWidth").fill("320");await page.locator("#saveEmailImageButton").click();
  assert.equal(await page.locator("#tplBody img").getAttribute("width"),"320");
  assert.equal(await page.locator("#tplBody img").evaluate(el=>el.previousSibling.textContent),"Vorher ");
  assert.equal(await page.locator("#tplBody img").evaluate(el=>el.nextSibling.textContent),"Nachher");
  // Editing/removing is performed in the app dialog, never a native confirm.
  await page.locator("#tplBody img").click();await page.locator("#emailImageWidth").fill("160");await page.locator("#saveEmailImageButton").click();
  assert.equal(await page.locator("#tplBody img").getAttribute("height"),"80");
  await page.locator("#tplBody img").click();await page.locator("#removeEmailImageButton").click();assert.equal(await page.locator("#tplBody img").count(),0);
  await page.locator("#tab-template-edit .rich-editor").first().getByRole("button",{name:"Rückgängig",exact:true}).click();assert.equal(await page.locator("#tplBody img").count(),1);
  await page.locator("#tab-template-edit").getByRole("button",{name:"Speichern",exact:true}).click();
  await page.waitForFunction(()=>!!byId("tplId").value);const templateId=Number(await page.locator("#tplId").inputValue());
  await page.reload();await page.waitForFunction(()=>templates.length>0);
  await page.evaluate(id=>editTemplate(id),templateId);assert.equal(await page.locator("#tplBody img").getAttribute("width"),"160");
  await page.evaluate(id=>openTemplate(id,true),templateId);await page.locator("#resultBody img").waitFor();
  await page.locator("#resultBody img").click();await page.locator("#emailImageWidth").fill("240");await page.locator("#saveEmailImageButton").click();
  await page.screenshot({path:path.join(artifacts,"email-with-image.png"),fullPage:true});
  const download=page.waitForEvent("download");await page.locator("#downloadEmlButton").click();
  const file=path.join(artifacts,"bilder.eml");await (await download).saveAs(file);
  const eml=fs.readFileSync(file,"utf8");assert.match(eml,/X-Unsent: 1/);assert.match(eml,/multipart\/related/);assert.match(eml,/Content-ID: <[a-f0-9]+@wieseke.inline>/);assert(!eml.includes("data:image"));
  await page.locator("#copyResultButton").click();await page.locator("#imageExportDialog").waitFor({state:"visible"});
  await page.locator("#imageExportDialog").getByRole("button",{name:"Nur Text übernehmen"}).click();
  await page.waitForFunction(async()=>(await navigator.clipboard.readText()).includes("[Bild: Plan & Ansicht]"));
  await page.locator("#openMailtoButton").click();await page.locator("#imageExportDialog").waitFor({state:"visible"});
  await page.locator("#imageExportDialog").getByRole("button",{name:"Abbrechen"}).click();
  // Same image-bearing template remains usable in a saved project email.
  await api("/api/projects","POST",{data:{schema_version:"1.0",projekt:{id:`IMG-${unique}`,bezeichnung:"Bildprojekt"},kontakte:[]}});
  const project=(await api("/api/projects")).projects.find(p=>p.project_key===`IMG-${unique}`);
  await page.evaluate(async id=>{await loadProjects();useProject(id)},project.id);
  // Keeping the current result on project change is deliberate in 4.0.
  await page.locator('#tab-generator button[onclick="generateEmail()"] ').click();
  await page.locator('#actionConfirmation button').filter({hasText:'Bestätigen'}).click();
  await page.locator("#saveProjectEmailButton").click();
  await page.waitForFunction(()=>byId("toast").textContent.includes("Projekt gespeichert"));
  const workspace=await api(`/api/projects/${project.id}/workspace`);assert.match(workspace.emails[0].body_html,/data:image\/png/);
  await page.evaluate(id=>openProjectDetail(id),project.id);
  await page.locator('.object-tabs button').filter({hasText:'E-Mails'}).click();
  await page.locator("#projectSavedEmails .project-email-record").first().click();
  assert.equal(await page.locator("#projectEmailDialogBody img").count(),1);
  await page.evaluate(()=>{WveDrafts.clean(byId('tab-generator'));return openSavedEmailInEditor()});
  assert.equal(await page.locator("#resultBody img").count(),1);
  await api("/api/bidders","POST",{bidder:`Bild-Testbieter ${unique}`,company_name:"Muster GmbH",street:"Musterstraße 1",postal_code:"48143",city:"Münster",country:"Deutschland",website:"https://example.com",active:true});
  await page.evaluate(()=>loadBidders());await tab("bidders");
  await page.locator("#bidderDirectorySearch").fill(String(unique));
  assert.equal(await page.locator(".bidder-table tbody tr").count(),1);assert.equal(await page.locator(".bidder-table thead th").count(),10);
  await page.screenshot({path:path.join(artifacts,"bidder-table.png"),fullPage:true});
  await page.locator(".bidder-table").getByRole("button",{name:"Bieter bearbeiten"}).click();assert.equal(await page.locator("#bidderCity").inputValue(),"Münster");
  for(const width of [1440,1024,390]){
    await page.setViewportSize({width,height:1000});
    await page.waitForTimeout(250); // Let the responsive sidebar transition finish before measuring.
    const bounds=await page.locator("#bidderCity").evaluate(el=>({right:el.getBoundingClientRect().right,card:el.closest(".card").getBoundingClientRect().right,page:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert(bounds.right<bounds.card,`Ort overflows card at ${width}`);assert(bounds.page<=bounds.viewport+1,`Page overflow at ${width}`);
    await page.screenshot({path:path.join(artifacts,`bidder-form-${width}.png`),fullPage:true});
  }
  await tab("bidders");assert.equal(await page.locator(".bidder-table tbody tr").count(),1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.setViewportSize({width:1440,height:1100});await tab("project-overview");
  await page.locator("#projectOverviewSearch").fill(`IMG-${unique}`);
  const actions=page.locator(".project-table-actions");assert.equal(await actions.locator("button").count(),4);assert.equal(await actions.locator("svg").count(),4);
  await actions.getByRole("button",{name:"Projektdaten bearbeiten"}).click();await page.locator("#tab-project-edit").waitFor({state:"visible"});
  await tab('project-overview');
  await page.screenshot({path:path.join(artifacts,"project-icons.png"),fullPage:true});
  assert.deepEqual(errors,[]);console.log("Image editor, persistence, EML, warnings, bidder table/layout and project icons: PASS");
}catch(error){console.error("Browser errors:",errors);await page.screenshot({path:path.join(artifacts,"failure.png"),fullPage:true});throw error}
finally{await browser.close()}
