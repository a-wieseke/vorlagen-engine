// Only use an isolated test server: this test creates projects and templates.
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const base=process.env.WVE_TEST_URL||"http://127.0.0.1:9992";
const python=process.env.WVE_TEST_PYTHON||"python";
const artifacts=path.resolve(".artifact-work/v32-fixtures");
fs.mkdirSync(artifacts,{recursive:true});
const docx=path.join(artifacts,"vorlage.docx"),xlsx=path.join(artifacts,"vorlage.xlsx");
execFileSync(python,["tests/extension_fixtures.py","docx",docx]);
const browser=await chromium.launch({channel:"chrome",headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1100}});
page.setDefaultTimeout(30000);
const errors=[];
page.on("pageerror",error=>errors.push(error.message));
page.on("dialog",d=>{if(d.type()==='beforeunload')d.accept();else{errors.push('Unexpected system dialog');d.dismiss()}});
const token=Date.now(),category=`Browser Kategorie ${token}`,name=`Browser Dokument ${token}`;
async function api(url,method="GET",body){
  return page.evaluate(async ({url,method,body})=>{
    const response=await fetch(url,{method,headers:{"Content-Type":"application/json","X-CSRF-Token":csrfToken},body:body?JSON.stringify(body):undefined});
    const data=await response.json();if(!response.ok)throw Error(data.error);return data;
  },{url,method,body});
}
async function tab(name){await page.evaluate(name=>switchTab(name),name)}
async function picker(target,search,label){
  await page.locator(`#document${target}Button`).click();
  await page.locator("#documentPickerSearch").fill(search);
  await page.locator("#documentPickerResults button").filter({hasText:label}).click();
}
try{
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:45000});await page.locator("#loginUsername").fill("admin");await page.locator("#loginPassword").fill("Admin12345!");
  await page.locator("#loginForm button[type=submit]").click();
  await page.waitForFunction(()=>!document.querySelector("#appView").hidden&&document.querySelector("#bidImportYear").value!=="");
  await api("/api/projects","POST",{data:{schema_version:"1.0",projekt:{id:`BROWSER-${token}`,bezeichnung:"HLF Browser Musterstadt"},kontakte:[{vorname:"Anna",nachname:"Muster",email:"anna@example.com"}]}});
  const project=(await api("/api/projects")).projects.find(p=>p.project_key===`BROWSER-${token}`);
  const cat=await api("/api/bid/categories","POST",{name:category,active:true});
  await api("/api/bid/topics","POST",{category_id:cat.id,name:"Fristen",active:true});
  // The stable block key makes repeated runs independent without collisions.
  const blocks=(await api("/api/document-blocks")).blocks;
  if(!blocks.some(b=>b.key==="browser_hinweis"))await api("/api/document-blocks","POST",{name:"Browser Hinweis",key:"browser_hinweis",content:"Hinweis: {{ eingabe.hinweis }}",active:true});
  await page.evaluate(async()=>{await loadProjects();await loadBidModule();await loadDocumentModule()});
  await tab("bid-question-import");
  await page.locator("#bidImportProjectButton").click();
  await page.locator("#bidProjectPickerSearch").fill(`BROWSER-${token}`);
  await page.locator("#bidProjectPickerResults button").click();
  await page.locator("#bidImportYear").fill("2026");
  const download=page.waitForEvent("download");
  await page.locator("#tab-bid-question-import").getByRole("button",{name:"Excel-Vorlage herunterladen"}).click();
  await (await download).saveAs(xlsx);
  execFileSync(python,["tests/extension_fixtures.py","fill",xlsx,category]);
  await page.locator("#bidWorkbookFile").setInputFiles(path.join(artifacts,"ausgefuellt.xlsx"));
  await page.locator("#bidWorkbookPreviewButton").click();
  await page.waitForFunction(()=>!document.querySelector("#bidWorkbookImportButton").disabled);
  assert.match(await page.locator("#bidWorkbookSummary").innerText(),/1 neue Fragen/);
  assert.match(await page.locator("#bidWorkbookPreview").innerText(),/Kommentar\nmit zwei Zeilen/);
  await page.screenshot({path:path.join(artifacts,"excel-preview.png"),fullPage:true});
  await page.locator("#bidWorkbookImportButton").click();
  await page.waitForFunction(()=>document.querySelector("#bidWorkbookSummary").textContent.includes("1 Fragen importiert"));
  await page.locator("#bidWorkbookFile").setInputFiles(path.join(artifacts,"ausgefuellt.xlsx"));
  await page.locator("#bidWorkbookPreviewButton").click();
  await page.waitForFunction(()=>document.querySelector("#bidWorkbookSummary").textContent.includes("1 Duplikate"));
  assert(await page.locator("#bidWorkbookImportButton").isDisabled());

  await tab("document-templates");
  await page.getByRole("button",{name:"Neue Vorlage",exact:true}).click();
  await page.locator("#documentTemplateName").fill(name);
  await page.locator("#documentTemplateFile").setInputFiles(docx);
  await page.waitForFunction(()=>document.querySelector("#documentTemplateDetected").textContent.includes("eingabe.hinweis"));
  await page.locator("#saveDocumentTemplateButton").click();
  await page.waitForFunction(()=>document.querySelector("#documentTemplateVersions").textContent.includes("Dateiversion 1"));
  await page.screenshot({path:path.join(artifacts,"document-editor.png"),fullPage:true});
  await page.locator("#testDocumentTemplateButton").click();
  await page.waitForFunction(()=>!!document.querySelector('#documentFieldList [data-key="eingabe.hinweis"]'));
  await page.locator('#documentFieldList [data-key="projekt.bezeichnung"]').fill("Manuell geprüft");
  await page.locator('#documentFieldList [data-key="kontakt.vorname"]').fill("Marcel");
  await page.locator('#documentFieldList [data-key="eingabe.hinweis"]').fill("A & B");
  await page.getByRole("button",{name:"Eingaben und Vorlage prüfen"}).click();
  await page.waitForFunction(()=>document.querySelector("#documentValidation").textContent.includes("Test erfolgreich"));
  const word=page.waitForEvent("download");
  await page.getByRole("button",{name:"Word-Datei erzeugen",exact:true}).click();
  await (await word).saveAs(path.join(artifacts,"ergebnis.docx"));
  await page.locator("#documentModeProjectButton").click();
  await picker("Project",String(token),"HLF Browser");
  await picker("Contact","Anna","Anna");
  await page.waitForFunction(()=>document.querySelector('#documentFieldList [data-key="kontakt.vorname"]')?.value==="Anna");
  assert.equal(await page.locator('#documentFieldList [data-key="projekt.bezeichnung"]').inputValue(),"HLF Browser Musterstadt");
  await page.locator('#documentFieldList [data-key="eingabe.hinweis"]').fill("Projekt-Hinweis");
  const savedResponse=page.waitForResponse(r=>r.url().endsWith("/api/documents/generate")&&r.request().method()==="POST");
  await page.getByRole("button",{name:"Im Projekt speichern",exact:true}).click();
  assert.equal((await savedResponse).status(),201);
  await page.evaluate(id=>openProjectDetail(id),project.id);
  await page.locator('.object-tabs button').filter({hasText:'Dokumente'}).click();
  await page.locator("#projectSavedDocuments a").waitFor();
  const saved=page.waitForEvent("download");await page.locator("#projectSavedDocuments a").click();
  await (await saved).saveAs(path.join(artifacts,"projekt-dokument.docx"));
  await tab("document-templates");
  await page.locator("#documentTemplateSearch").fill(name);
  await page.locator("#documentTemplateList button").click();
  await page.locator("#documentTemplateFile").setInputFiles(docx);
  await page.locator("#saveDocumentTemplateButton").click();
  await page.waitForFunction(()=>document.querySelector("#documentTemplateVersions").textContent.includes("Dateiversion 2"));
  await page.locator("#testDocumentTemplateButton").click();
  await page.waitForFunction(()=>documentAnalysis!==null);

  for(const width of [1024,390]){
    await page.setViewportSize({width,height:900});
    for(const name of ["document-create","document-templates","document-template-edit","bid-question-import"]){
      await tab(name);
      await page.waitForTimeout(150);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow at ${width} on ${name}`);
    }
  }
  await tab("document-create");
  await page.waitForTimeout(250);
  await page.screenshot({path:path.join(artifacts,"document-mobile.png"),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log("PASS: XLSX download/preview/import/duplicates, DOCX editor, fields, manual/project/contact, validation/download/save, versions, responsive layouts.");
}finally{await browser.close()}

