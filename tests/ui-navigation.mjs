// Run against a separate WVE_DATA_DIR: this browser test creates test records.
// WVE_TEST_URL selects the isolated server; PLAYWRIGHT_MODULE can override the
// standard package resolution on developer machines.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.WVE_TEST_URL || 'http://127.0.0.1:9991';
const browser = await chromium.launch({channel:'chrome', headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors = [];
const testTemplateName = `Neue Browser-Testvorlage ${Date.now()}`;
page.on('pageerror', error => errors.push(error.message));
const activePage = () => page.locator('main > .tab.active').getAttribute('id');
const pauseAnimation = () => page.waitForTimeout(210);
try {
  await page.goto(base);
  await page.locator('#loginUsername').fill('admin');
  await page.locator('#loginPassword').fill('Admin12345!');
  await page.locator('#loginForm button[type=submit]').click();
  await page.waitForFunction(() => document.querySelector('#tab-dashboard').classList.contains('active') && !document.querySelector('#appView').hidden);

  // Expanding a group must not navigate, and choosing another closes it.
  await page.locator('[data-expand-module="email"]').click();
  assert.equal(await activePage(), 'tab-dashboard');
  await page.locator('[data-expand-module="projects"]').click();
  assert.equal(await page.locator('.sidebar-submenu:not([hidden])').count(),1);
  assert.equal(await page.locator('.sidebar-submenu:not([hidden])').getAttribute('data-sidebar-module'),'projects');
  await page.locator('#moduleNav [data-module="email"]').click();
  assert.equal(await activePage(),'tab-generator');
  assert.equal(await page.locator('.sidebar-submenu:not([hidden])').getAttribute('data-sidebar-module'),'email');
  await pauseAnimation();
  const cards = await page.locator('#tab-generator > .grid > .card').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().top));
  assert(Math.abs(cards[0]-cards[1])<1, 'Generator cards must start at the same height');
  assert.equal(await page.locator('#moduleNav [data-module="email"]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(231, 240, 248)');

  // Collapsed icons expose accessible subpage navigation; reload remembers it.
  await page.locator('#sidebarCollapseButton').click();
  assert.equal(await page.locator('#appSidebar').evaluate(el=>el.getBoundingClientRect().width),76);
  await page.locator('#moduleNav [data-module="email"]').click();
  await page.locator('#navigationFlyout button', {hasText:'Vorlagen'}).click();
  assert.equal(await activePage(),'tab-templates');
  assert.equal(await page.locator('#tab-templates #tplBody').count(),0);
  await page.reload();
  await page.waitForFunction(()=>!document.querySelector('#appView').hidden && document.querySelector('#tab-dashboard').classList.contains('active'));
  assert.equal(await page.locator('#appSidebar').evaluate(el=>el.getBoundingClientRect().width),76);
  await page.locator('#sidebarCollapseButton').click();
  await page.locator('#moduleNav [data-module="email"]').click();
  await page.locator('#subNav [data-tab="templates"]').click();
  await page.locator('.sidebar-submenu [data-shell-tab="templates"]').hover();
  await pauseAnimation();
  assert.equal(await page.locator('.sidebar-submenu [data-shell-tab="templates"]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(231, 240, 248)');

  // Existing list actions still work, and editing/saving happens on its own page.
  const first = page.locator('.template-list-item').first();
  const id = await first.getAttribute('data-template-id');
  await first.locator('summary').click();
  await page.locator('#pageTitle').click();
  assert.equal(await first.locator('details').getAttribute('open'),null);
  await first.locator('.text-button').click();
  assert.equal(await activePage(),'tab-template-edit');
  assert.equal(await page.locator('#tplId').inputValue(),id);
  const left = await page.locator('#tplBody').boundingBox();
  const right = await page.locator('.template-placeholder-panel').boundingBox();
  assert(right.x > left.x+left.width, 'Placeholder panel must be right of editor');
  await page.locator('#tplSubject').fill('Prüfung {{projekt.id}}');
  await page.locator('#tplBody').fill('Text der Browserprüfung.');
  await page.locator('#tab-template-edit button', {hasText:'Speichern'}).click();
  await page.waitForFunction(id=>templates.find(item=>String(item.id)===id)?.subject==='Prüfung {{projekt.id}}', id);
  await page.locator('#tab-template-edit .back-link').click();
  assert.equal(await activePage(),'tab-templates');
  await page.locator('#tab-templates button', {hasText:'Neue Vorlage erstellen'}).click();
  assert.equal(await activePage(),'tab-template-edit');
  assert.equal(await page.locator('#tplId').inputValue(),'');
  assert.equal(await page.locator('#tplActive').isChecked(),true);
  await page.locator('#tplName').fill(testTemplateName);
  await page.locator('#tplSubject').fill('Testbetreff');
  await page.locator('#tplBody').fill('Hallo Test');
  await page.locator('#tab-template-edit button', {hasText:'Speichern'}).click();
  await page.waitForFunction(()=>!!document.querySelector('#tplId').value);
  await page.locator('#tab-template-edit .back-link').click();
  const createdRow = page.locator('.template-list-item', {hasText:testTemplateName});
  await createdRow.locator('summary').click();
  await createdRow.getByRole('button',{name:'Archivieren',exact:true}).click();
  await page.locator('#archiveTemplateDialog').getByRole('button',{name:'Vorlage archivieren',exact:true}).click();
  await page.waitForFunction(name=>!Array.from(document.querySelectorAll('#templateList .text-button')).some(el=>el.textContent.includes(name)),testTemplateName);
  assert.equal(await activePage(),'tab-templates');

  const projectId = await page.evaluate(async()=>{
    const data=await api('/api/projects',{method:'POST',body:JSON.stringify({data:{schema_version:'1.0',projekt:{id:'UI-CONTACTS',bezeichnung:'Projekt mit Kontakten'},kontakte:[{id:'test-1',vorname:'Anna',nachname:'Beispiel',rolle:'Projektleitung',anrede:'Frau Beispiel',email:'anna@example.com',telefon:'01234'},{id:'test-2',vorname:'Max',nachname:'Muster',rolle:'Technik',anrede:'Herr Muster',email:'max@example.com'}]}})});
    await loadProjects();return projects.find(p=>p.project_key==='UI-CONTACTS').id;
  });
  await page.evaluate(id=>openProjectDetail(id),projectId);
  assert.equal(await page.locator('.project-contact-row').count(),2);
  assert.equal(await page.locator('#projectDetailContacts .project-contact-card').count(),0);
  assert.equal(await page.locator('.contact-section-head #projectContactsEditButton').isVisible(),true);
  await page.locator('#projectContactsEditButton').click();
  assert.equal(await page.locator('#contactDialog').isVisible(),true);
  await page.keyboard.press('Escape');

  // Sidebar order moves complete rows; permission checks include expand arrows.
  await page.evaluate(()=>applyMainNavigationOrder(['help','projects','email','dashboard','documents','bidder','users','system']));
  assert.equal(await page.locator('.nav-main-row').first().locator('[data-nav-key]').getAttribute('data-nav-key'),'help');
  await page.evaluate(()=>{window.uiTestPermissions=me.permissions;me.permissions=['email_create','projects_view'];applyPermissionVisibility();});
  assert.equal(await page.locator('[data-expand-module="system"]').isVisible(),false);
  await page.locator('[data-expand-module="email"]').click();
  assert.equal(await page.locator('.sidebar-submenu [data-shell-tab="templates"]').isVisible(),false);
  await page.evaluate(()=>{me.permissions=window.uiTestPermissions;applyPermissionVisibility();});
  await page.evaluate(()=>switchTab('project-detail'));

  fs.mkdirSync('.artifact-work',{recursive:true});
  await pauseAnimation();
  await page.screenshot({path:'.artifact-work/ui-project-contacts.png',fullPage:true});
  await page.evaluate(id=>editTemplate(Number(id)),id);
  await pauseAnimation();
  await page.screenshot({path:'.artifact-work/ui-template-editor.png',fullPage:true});

  // All changed pages must remain usable at intermediate and phone widths.
  for(const width of [1024,768,390]) {
    await page.setViewportSize({width,height:900});
    for(const tab of ['templates','template-edit','generator','project-detail']) {
      await page.evaluate(tab=>switchTab(tab),tab);
      await pauseAnimation();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false,`${tab} overflows at ${width}px`);
    }
  }
  await page.evaluate(()=>editTemplate(Number(document.querySelector('#tplId').value)));
  await pauseAnimation();
  await page.screenshot({path:'.artifact-work/ui-template-mobile.png',fullPage:true});
  await page.locator('#sidebarOpenButton').click();
  await page.locator('[data-expand-module="projects"]').click();
  assert.equal(await activePage(),'tab-template-edit');
  await page.locator('.sidebar-submenu [data-shell-tab="project-overview"]').click();
  assert.equal(await activePage(),'tab-project-overview');
  assert.equal(await page.evaluate(()=>document.body.classList.contains('sidebar-open')),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: navigation, permissions, collapse persistence, template edit/save/archive, contact list and responsive layouts');
} finally { await browser.close(); }
