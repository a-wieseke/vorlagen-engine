"""Integration checks for workbook round trips and document workflows."""
import base64
import io
import json
import unittest
import urllib.error
import urllib.request
from openpyxl import load_workbook
from docx import Document
import test_login as baseline
app = baseline.app


class ExtensionsTest(unittest.TestCase):
    csrf_tokens = {}
    setUpClass = classmethod(baseline.LoginEndToEndTest.setUpClass.__func__)
    tearDownClass = classmethod(baseline.LoginEndToEndTest.tearDownClass.__func__)
    new_client = baseline.LoginEndToEndTest.new_client
    authenticated_client = baseline.LoginEndToEndTest.authenticated_client
    json_request = baseline.LoginEndToEndTest.json_request

    def fixture(self, suffix):
        client, _ = self.authenticated_client()
        self.json_request(client, '/api/projects', 'POST', {'data':{'schema_version':'1.0','projekt':{'id':suffix,'bezeichnung':suffix},'kontakte':[]}})
        project = next(row for row in self.json_request(client,'/api/projects')['projects'] if row['project_key']==suffix)
        category = self.json_request(client,'/api/bid/categories','POST',{'name':suffix,'active':True})['id']
        self.json_request(client,'/api/bid/topics','POST',{'category_id':category,'name':'Fristen','active':True})
        return client, project, category

    def workbook_payload(self, client, project):
        raw=client.open(self.base_url+'/api/bid/import-template').read()
        book=load_workbook(io.BytesIO(raw))
        sheet=book['Bieterfragen']
        self.assertEqual(len(sheet.data_validations.dataValidation),3)
        self.assertIn('INDIRECT',sheet.data_validations.dataValidation[1].formula1)
        self.assertEqual(book['_Listen'].sheet_state,'hidden')
        sheet.append([])
        for column,value in enumerate([project['project_key'],'Anbieter','Fristen','Frage\nmit zweiter Zeile','Kommentar\nmehrzeilig','zugelassen','Antwort'],1):
            sheet.cell(2,column,value)
        return book

    def payload(self, book, project):
        stream=io.BytesIO();book.save(stream)
        return {'project_id':project['id'],'year':2026,'content_base64':base64.b64encode(stream.getvalue()).decode()}

    def test_xlsx_roundtrip_rename_duplicate_and_multiline(self):
        client,project,category=self.fixture('XLSX-Roundtrip')
        book=self.workbook_payload(client,project)
        data=self.payload(book,project)
        self.json_request(client,f'/api/bid/categories/{category}','PUT',{'name':'XLSX umbenannt','active':True})
        preview=self.json_request(client,'/api/bid/xlsx/preview','POST',data)
        self.assertTrue(preview['valid'])
        self.assertTrue(preview['rows'][0]['warnings'])
        result=self.json_request(client,'/api/bid/xlsx/import','POST',data)
        self.assertEqual(result['created'],1)
        question=next(row for row in self.json_request(client,'/api/bid/questions')['questions'] if row['id']==result['ids'][0])
        self.assertEqual(question['category_id'],category)
        self.assertEqual(question['question'],'Frage\nmit zweiter Zeile')
        self.json_request(client,f'/api/bid/categories/{category}','PUT',{'name':'Nochmals umbenannt','active':True})
        self.assertEqual(self.json_request(client,'/api/bid/xlsx/import','POST',data)['created'],0)

    def test_xlsx_invalid_row_is_atomic_and_rechecked(self):
        client,project,category=self.fixture('XLSX-Atomic')
        book=self.workbook_payload(client,project)
        data=self.payload(book,project)
        self.assertTrue(self.json_request(client,'/api/bid/xlsx/preview','POST',data)['valid'])
        self.json_request(client,f'/api/bid/categories/{category}','PUT',{'name':'XLSX-Atomic','active':False})
        with self.assertRaises(urllib.error.HTTPError) as result:
            self.json_request(client,'/api/bid/xlsx/import','POST',data)
        self.assertEqual(result.exception.code,400)
        self.assertFalse(any(row['project_id']==project['id'] for row in self.json_request(client,'/api/bid/questions')['questions']))

    def test_xlsx_rejects_formulas_and_wrong_topic(self):
        client,project,_=self.fixture('XLSX-Invalid')
        book=self.workbook_payload(client,project)
        book['Bieterfragen']['C2']='Unbekannt'
        book['Bieterfragen']['D2']='=1+1'
        result=self.json_request(client,'/api/bid/xlsx/preview','POST',self.payload(book,project))
        self.assertFalse(result['valid'])
        self.assertGreaterEqual(len(result['rows'][0]['errors']),2)

    def upload_document(self, client, text, name="Prüfdokument"):
        stream=io.BytesIO()
        document=Document()
        document.add_paragraph(text)
        document.save(stream)
        raw=stream.getvalue()
        payload={"name":name,"filename":"vorlage.docx","active":True,"content_base64":base64.b64encode(raw).decode()}
        result=self.json_request(client,"/api/document-templates","POST",payload)
        return result["id"],raw,payload

    def generate_bytes(self, client, data):
        request=urllib.request.Request(self.base_url+"/api/documents/generate",method="POST",
            headers={"Content-Type":"application/json","X-CSRF-Token":self.csrf_tokens[id(client)]},
            data=json.dumps(data).encode())
        return client.open(request).read()

    def test_document_lazy_nested_blocks_escape_once(self):
        client,_=self.authenticated_client()
        for key,content in [
            ("unused_broken","{{ does.not.exist }}"),
            ("nested_leaf","Werte: {{ eingabe.text }}"),
            ("nested_parent","Hinweis: {{ baustein.nested_leaf }}")]:
            self.json_request(client,"/api/document-blocks","POST",{"key":key,"name":key,"content":content,"active":True})
        ident,_,_=self.upload_document(client,"{{ baustein.nested_parent }}")
        analysis=self.json_request(client,f"/api/document-templates/{ident}/analysis")
        self.assertEqual(analysis["placeholders"],["eingabe.text"])
        self.assertEqual(len(analysis["blocks"]),2)
        raw=self.generate_bytes(client,{"template_id":ident,"values":{"eingabe.text":"Müller & <Partner>"}})
        text="\n".join(p.text for p in Document(io.BytesIO(raw)).paragraphs)
        self.assertEqual(text,"Hinweis: Werte: Müller & <Partner>")

    def test_document_cycles_and_syntax_are_advisory_on_save(self):
        client,_=self.authenticated_client()
        self.json_request(client,"/api/document-blocks","POST",{"key":"cycle","name":"Kreis","content":"{{ baustein.cycle }}","active":True})
        ident,_,_=self.upload_document(client,"{{ baustein.cycle }}")
        analysis=self.json_request(client,f"/api/document-templates/{ident}/analysis")
        self.assertFalse(analysis["syntax_valid"])
        result=self.json_request(client,"/api/documents/validate","POST",{"template_id":ident})
        self.assertFalse(result["valid"])
        self.assertIn("Kreis",result["error"])
        ident,_,_=self.upload_document(client,"{{ projekt.bezeichnung ")
        result=self.json_request(client,f"/api/document-templates/{ident}/analysis")
        self.assertFalse(result["syntax_valid"])

    def test_document_missing_conditional_and_loop_variables(self):
        client,_=self.authenticated_client()
        ident,_,_=self.upload_document(client,"{% if eingabe.frage %}{{ projekt.bezeichnung }}{% endif %}\n{% for person in kontakte %}{{ person.vorname }}{% endfor %}")
        analysis=self.json_request(client,f"/api/document-templates/{ident}/analysis")
        self.assertEqual(set(analysis["placeholders"]),{"eingabe.frage","projekt.bezeichnung","kontakte"})
        self.assertFalse(self.json_request(client,"/api/documents/validate","POST",{"template_id":ident})["valid"])
        # A missing field in a non-rendered branch is advisory, not a hard gate.
        result=self.json_request(client,"/api/documents/validate","POST",{"template_id":ident,"values":{"eingabe.frage":""}})
        self.assertTrue(result["valid"])
        self.assertTrue(result["warnings"])

    def test_document_versions_and_project_snapshot_survive_template_delete(self):
        client,project,_=self.fixture("DOC-Snapshot")
        ident,original,payload=self.upload_document(client,"Projekt {{ projekt.bezeichnung }}")
        saved=self.json_request(client,"/api/documents/generate","POST",{"template_id":ident,"project_id":project["id"],"save_to_project":True})
        download=f"/api/project-documents/{saved['id']}/download"
        snapshot=client.open(self.base_url+download).read()
        self.assertIn("DOC-Snapshot",Document(io.BytesIO(snapshot)).paragraphs[0].text)
        workspace=self.json_request(client,f"/api/projects/{project['id']}/workspace")
        self.assertEqual(workspace["documents"][0]["id"],saved["id"])
        self.json_request(client,f"/api/document-templates/{ident}","PUT",{"name":"Umbenannt"})
        self.assertEqual(len(self.json_request(client,f"/api/document-templates/{ident}/versions")["versions"]),1)
        self.json_request(client,f"/api/document-templates/{ident}","PUT",payload)
        versions=self.json_request(client,f"/api/document-templates/{ident}/versions")["versions"]
        self.assertEqual(len(versions),2)
        old=client.open(self.base_url+f"/api/document-templates/{ident}/versions/{versions[-1]['id']}/download").read()
        self.assertEqual(old,original)
        self.assertEqual(client.open(self.base_url+f"/api/document-templates/{ident}/download").read(),original)
        self.json_request(client,f"/api/document-templates/{ident}","DELETE")
        self.assertEqual(client.open(self.base_url+download).read(),snapshot)

    def test_document_contacts_and_archived_project_guard(self):
        client,project,_=self.fixture("DOC-Contact")
        with app.db() as conn:
            data=json.loads(conn.execute("SELECT data_json FROM projects WHERE id=?",(project["id"],)).fetchone()[0])
            data["kontakte"]=[{"vorname":"Anna"},{"vorname":"Berta"}]
            conn.execute("UPDATE projects SET data_json=? WHERE id=?",(json.dumps(data),project["id"]))
        ident,_,_=self.upload_document(client,"{{ kontakt.vorname }}")
        args={"template_id":ident,"project_id":project["id"],"contact_index":1}
        self.assertEqual(Document(io.BytesIO(self.generate_bytes(client,args))).paragraphs[0].text,"Berta")
        with self.assertRaises(urllib.error.HTTPError):self.generate_bytes(client,{**args,"contact_index":99})
        self.json_request(client,f"/api/projects/{project['id']}","DELETE")
        with self.assertRaises(urllib.error.HTTPError):self.generate_bytes(client,{**args,"save_to_project":True})

    def test_migration_document_baselines_are_idempotent(self):
        client,_=self.authenticated_client()
        ident,_,_=self.upload_document(client,"Migration")
        with app.db() as conn:conn.execute("DELETE FROM document_template_versions WHERE template_id=?",(ident,))
        app.init_db();app.init_db()
        versions=self.json_request(client,f"/api/document-templates/{ident}/versions")["versions"]
        self.assertEqual(len(versions),1)
        self.assertEqual(versions[0]["version_no"],1)

    def restricted_client(self, admin, permissions, name):
        role=self.json_request(admin,"/api/roles","POST",{"name":name,"permissions":permissions,"all_categories":False,"category_ids":[]})
        user=self.json_request(admin,"/api/users","POST",{"username":name,"first_name":"Test","last_name":"Rechte","role_id":role["id"],"must_change":False})
        client,_=self.new_client()
        body=baseline.urllib.parse.urlencode({"username":name,"password":user["temporary_password"]}).encode()
        client.open(urllib.request.Request(self.base_url+"/login",data=body,headers={"Content-Type":"application/x-www-form-urlencoded"}))
        return client

    def test_extension_endpoints_enforce_role_permissions(self):
        admin,project,_=self.fixture("DOC-Permissions")
        ident,_,_=self.upload_document(admin,"Rechte")
        saved=self.json_request(admin,"/api/documents/generate","POST",{"template_id":ident,"project_id":project["id"],"save_to_project":True})
        reader=self.restricted_client(admin,["projects_view"],"extension_reader")
        for route in [f"/api/document-templates/{ident}/analysis",f"/api/document-templates/{ident}/download",f"/api/project-documents/{saved['id']}/download","/api/bid/import-template"]:
            with self.assertRaises(urllib.error.HTTPError) as error:reader.open(self.base_url+route)
            self.assertEqual(error.exception.code,403)
        workspace=self.json_request(reader,f"/api/projects/{project['id']}/workspace")
        self.assertEqual(workspace["documents"],[])
        manager=self.restricted_client(admin,["document_templates_manage"],"extension_manager")
        self.assertTrue(self.json_request(manager,"/api/document-templates")["templates"])
        self.json_request(manager,"/api/document-blocks")
        self.json_request(manager,"/api/documents/pdf-status")
        with self.assertRaises(urllib.error.HTTPError) as error:
            self.json_request(manager,"/api/documents/generate","POST",{"template_id":ident})
        self.assertEqual(error.exception.code,403)
        generator=self.restricted_client(admin,["documents_create"],"extension_generator")
        self.assertTrue(self.json_request(generator,f"/api/document-templates/{ident}/analysis")["syntax_valid"])
        with self.assertRaises(urllib.error.HTTPError):
            generator.open(self.base_url+f"/api/document-templates/{ident}/versions")
        with self.assertRaises(urllib.error.HTTPError):
            self.json_request(generator,"/api/documents/generate","POST",{"template_id":ident,"project_id":project["id"]})
        anonymous,_=self.new_client()
        with self.assertRaises(urllib.error.HTTPError) as error:anonymous.open(self.base_url+"/api/bid/import-template")
        self.assertEqual(error.exception.code,401)

    def test_empty_and_invalid_workbooks_do_not_import(self):
        client,project,_=self.fixture("XLSX-Empty")
        raw=client.open(self.base_url+"/api/bid/import-template").read()
        payload={"content_base64":base64.b64encode(raw).decode(),"project_id":project["id"],"year":2026}
        result=self.json_request(client,"/api/bid/xlsx/preview","POST",payload)
        self.assertFalse(result["valid"])
        self.assertEqual(result["rows"],[])
        for content in ["invalid-base64",base64.b64encode(b"not an xlsx").decode()]:
            with self.assertRaises(urllib.error.HTTPError) as error:
                self.json_request(client,"/api/bid/xlsx/preview","POST",{**payload,"content_base64":content})
            self.assertEqual(error.exception.code,400)


