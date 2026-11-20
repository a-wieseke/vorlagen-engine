"""Documents routes. Return False only when no route matched.

The adapter owns sessions/CSRF and injects shared database/security services.
"""

def get(self, p, data):
    m=self.services.re.fullmatch(r"/api/document-templates/(\d+)/(analysis|download|versions)(?:/(\d+)/download)?",p)
    if m:
        current=self.require_auth()
        if not current:return
        permissions=set(self.services.permissions_from_row(current))
        if not {"documents_create","document_templates_manage"}&permissions or (m.group(2)!="analysis" and "document_templates_manage" not in permissions):
            return self.services.json_response(self,403,{"error":"Für diese Funktion fehlt die Berechtigung."})
        with self.services.db() as conn:
            template=conn.execute("SELECT * FROM document_templates WHERE id=?",(int(m.group(1)),)).fetchone()
            if not template or (not template["active"] and "document_templates_manage" not in permissions):
                return self.services.json_response(self,404,{"error":"Vorlage wurde nicht gefunden."})
            if m.group(2)=="analysis":return self.services.json_response(self,200,self.services.document_analysis(conn,template["docx_blob"]))
            if m.group(2)=="versions":
                if m.group(3):
                    template=conn.execute("SELECT original_filename,docx_blob FROM document_template_versions WHERE id=? AND template_id=?",(int(m.group(3)),template["id"])).fetchone()
                    if not template:return self.services.json_response(self,404,{"error":"Version wurde nicht gefunden."})
                else:
                    rows=conn.execute("SELECT id,version_no,original_filename,created_at FROM document_template_versions WHERE template_id=? ORDER BY version_no DESC",(template["id"],)).fetchall()
                    return self.services.json_response(self,200,{"versions":[dict(row) for row in rows]})
        return self.services.binary_response(self,template["docx_blob"],"application/vnd.openxmlformats-officedocument.wordprocessingml.document",template["original_filename"])
    m=self.services.re.fullmatch(r"/api/project-documents/(\d+)/download",p)
    if m:
        current=self.require_auth(permission="projects_view")
        if not current:return
        if not {"documents_create","document_templates_manage"}&set(self.services.permissions_from_row(current)):
            return self.services.json_response(self,403,{"error":"Für Dokumente fehlt die Berechtigung."})
        with self.services.db() as conn:row=conn.execute("SELECT * FROM project_documents WHERE id=?",(int(m.group(1)),)).fetchone()
        if not row:return self.services.json_response(self,404,{"error":"Dokument wurde nicht gefunden."})
        return self.services.binary_response(self,row["content"],row["content_type"],row["filename"])
    if p in {"/api/document-templates","/api/document-blocks","/api/documents/pdf-status"}:
        current=self.require_auth()
        if not current:return
        if not {"documents_create","document_templates_manage"}&set(self.services.permissions_from_row(current)):
            return self.services.json_response(self,403,{"error":"Für Dokumente fehlt die Berechtigung."})
    if p == "/api/document-templates":
        with self.services.db() as conn:
            rows=conn.execute("SELECT id,name,description,original_filename,placeholder_keys_json,active,created_at,updated_at FROM document_templates ORDER BY name,id").fetchall()
        return self.services.json_response(self,200,{"templates":[self.services.document_template_dict(row) for row in rows]})
    if p == "/api/document-blocks":
        with self.services.db() as conn:
            rows=conn.execute("SELECT * FROM document_text_blocks ORDER BY sort_order,id").fetchall()
        return self.services.json_response(self,200,{"blocks":[self.services.document_block_dict(row) for row in rows]})
    if p == "/api/documents/pdf-status":
        return self.services.json_response(self,200,{"available":bool(self.services.office_converter_path()),
            "message":"PDF-Export ist verfügbar." if self.services.office_converter_path() else "PDF-Export benötigt LibreOffice auf dem Server."})
    return False

def post(self, p, data):
    if p == "/api/document-templates/inspect":
        if not self.require_auth(permission="document_templates_manage"):return
        try:
            raw=self.services.base64.b64decode(str(data.get("content_base64","")),validate=True)
            with self.services.db() as conn:analysis=self.services.document_analysis(conn,raw)
            return self.services.json_response(self,200,analysis)
        except (ValueError,TypeError) as error:return self.services.json_response(self,400,{"error":str(error)})
    if p == "/api/document-templates":
        current=self.require_auth(permission="document_templates_manage")
        if not current:return
        name=str(data.get("name","")).strip(); filename=str(data.get("filename","")).strip()
        try: raw=self.services.base64.b64decode(str(data.get("content_base64","")).split(",")[-1],validate=True)
        except Exception:return self.services.json_response(self,400,{"error":"Die DOCX-Datei konnte nicht gelesen werden."})
        if not name:return self.services.json_response(self,400,{"error":"Ein Vorlagenname ist erforderlich."})
        if not filename.lower().endswith(".docx") or not raw or len(raw)>10_000_000:
            return self.services.json_response(self,400,{"error":"Bitte eine DOCX-Datei mit höchstens 10 MB auswählen."})
        try: placeholders=self.services.extract_docx_placeholders(raw)
        except ValueError as error:return self.services.json_response(self,400,{"error":str(error)})
        with self.services.db() as conn:
            cur=conn.execute("""INSERT INTO document_templates(name,description,original_filename,docx_blob,placeholder_keys_json,active,created_at,updated_at)
                VALUES(?,?,?,?,?,?,?,?)""",(name,str(data.get("description","")).strip(),filename,raw,self.services.json.dumps(placeholders),1 if data.get("active",True) else 0,self.services.now_iso(),self.services.now_iso()))
            self.services.audit_event(conn,current,"create","document_template",cur.lastrowid,name)
            self.services.save_document_version(conn,cur.lastrowid,current["id"])
        return self.services.json_response(self,201,{"id":cur.lastrowid,"placeholders":placeholders})
    if p == "/api/document-blocks":
        current=self.require_auth(permission="document_templates_manage")
        if not current:return
        key=str(data.get("key","")).strip(); name=str(data.get("name","")).strip()
        if not self.services.re.fullmatch(r"[a-z][a-z0-9_]*",key) or not name:
            return self.services.json_response(self,400,{"error":"Schlüssel (klein, ohne Leerzeichen) und Name sind erforderlich."})
        try:
            with self.services.db() as conn:
                order=conn.execute("SELECT COALESCE(MAX(sort_order),-1)+1 FROM document_text_blocks").fetchone()[0]
                cur=conn.execute("""INSERT INTO document_text_blocks(block_key,name,category,content,active,sort_order,created_at,updated_at)
                    VALUES(?,?,?,?,?,?,?,?)""",(key,name,str(data.get("category","")).strip(),str(data.get("content","")),1 if data.get("active",True) else 0,order,self.services.now_iso(),self.services.now_iso()))
                self.services.audit_event(conn,current,"create","document_block",cur.lastrowid,name)
        except self.services.sqlite3.IntegrityError:return self.services.json_response(self,409,{"error":"Dieser Textbaustein-Schlüssel ist bereits vorhanden."})
        return self.services.json_response(self,201,{"id":cur.lastrowid})
    if p in {"/api/documents/generate","/api/documents/validate"}:
        current=self.require_auth(permission="documents_create")
        if not current:return
        try:
            template_id=int(data.get("template_id") or 0); project_id=int(data.get("project_id") or 0) or None
        except (ValueError,TypeError):return self.services.json_response(self,400,{"error":"Vorlage oder Projekt ist ungültig."})
        if project_id and "projects_view" not in self.services.permissions_from_row(current):
            return self.services.json_response(self,403,{"error":"Für Projektdaten fehlt die Berechtigung."})
        output_type=str(data.get("output","docx")); values=data.get("values",{})
        if output_type not in {"docx","pdf"} or not isinstance(values,dict):
            return self.services.json_response(self,400,{"error":"Ausgabeformat oder Eingabedaten sind ungültig."})
        with self.services.db() as conn:
            template=conn.execute("SELECT * FROM document_templates WHERE id=? AND active=1",(template_id,)).fetchone()
            project=conn.execute("SELECT data_json FROM projects WHERE id=? AND archived=0",(project_id,)).fetchone() if project_id else None
        if not template:return self.services.json_response(self,404,{"error":"Dokumentvorlage wurde nicht gefunden."})
        if project_id and not project:return self.services.json_response(self,404,{"error":"Projekt wurde nicht gefunden."})
        project_data=self.services.json.loads(project["data_json"]) if project else {}
        project_data["kontakt"]={}
        contact_index=data.get("contact_index")
        if project and contact_index is not None:
            try:
                contact_index=int(contact_index)
                if contact_index<0:raise ValueError()
                project_data["kontakt"]=project_data.get("kontakte",[])[contact_index]
            except (ValueError,TypeError,IndexError):return self.services.json_response(self,400,{"error":"Kontakt wurde nicht gefunden. Bitte neu auswählen."})
        if data.get("save_to_project") and not project_id:
            return self.services.json_response(self,400,{"error":"Zum Speichern bitte ein Projekt auswählen."})
        warnings=[]
        if p.endswith("/validate"):
            with self.services.db() as conn:analysis=self.services.document_analysis(conn,template["docx_blob"])
            warnings=list(analysis["warnings"])
            for key in analysis["placeholders"]:
                if key.startswith("benutzer.") or key=="kontakte":continue
                value=values.get(key)
                if key not in values:
                    value=project_data
                    for part in key.split('.'):
                        value=value.get(part) if isinstance(value,dict) else None
                if value is None or value=="":warnings.append(f"Nicht ausgefüllt: {key}")
        try: docx=self.services.render_document(template,values,project_data,current)
        except ValueError as error:
            if p.endswith("/validate"):return self.services.json_response(self,200,{"valid":False,"warnings":warnings,"error":str(error)})
            return self.services.json_response(self,400,{"error":str(error)})
        if p.endswith("/validate"):return self.services.json_response(self,200,{"valid":True,"warnings":warnings,"message":"Die Word-Datei konnte testweise erzeugt werden."})
        safe_name=self.services.safe_export_filename(template["name"],"Dokument")
        payload=docx; content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"; filename=f"{safe_name}.docx"
        if output_type=="pdf":
            converter=self.services.office_converter_path()
            if not converter:return self.services.json_response(self,409,{"error":"PDF-Export ist auf diesem Server nicht verfügbar. Installieren Sie LibreOffice oder verwenden Sie den Word-Export."})
            with self.services.tempfile.TemporaryDirectory() as directory:
                source=self.services.Path(directory)/filename; source.write_bytes(docx)
                try:
                    result=self.services.subprocess.run([converter,f"-env:UserInstallation={(self.services.Path(directory)/'profile').as_uri()}","--headless","--convert-to","pdf","--outdir",directory,str(source)],capture_output=True,timeout=60)
                except (OSError,self.services.subprocess.TimeoutExpired):return self.services.json_response(self,500,{"error":"PDF-Konvertierung konnte nicht abgeschlossen werden. Bitte Word-Export verwenden."})
                pdf_path=source.with_suffix(".pdf")
                if result.returncode or not pdf_path.exists():return self.services.json_response(self,500,{"error":"Die PDF-Konvertierung ist fehlgeschlagen."})
                payload=pdf_path.read_bytes()
            content_type="application/pdf";filename=f"{safe_name}.pdf"
        with self.services.db() as conn:
            conn.execute("INSERT INTO document_usage(template_id,template_name,user_id,project_id,output_method,created_at) VALUES(?,?,?,?,?,?)",(template_id,template["name"],current["id"],project_id,output_type,self.services.now_iso()))
            if data.get("save_to_project"):
                # Check again after rendering/conversion; archiving may have
                # happened in another window while the file was generated.
                conn.execute("UPDATE projects SET imported_at=imported_at WHERE id=? AND archived=0",(project_id,))
                if not conn.execute("SELECT id FROM projects WHERE id=? AND archived=0",(project_id,)).fetchone():
                    return self.services.json_response(self,409,{"error":"Projekt ist nicht mehr verfügbar. Bitte erneut auswählen."})
                cur=conn.execute("""INSERT INTO project_documents(project_id,template_id,template_name,filename,content_type,content,created_by,created_at)
                    VALUES(?,?,?,?,?,?,?,?)""",(project_id,template_id,template["name"],filename,content_type,payload,current["id"],self.services.now_iso()))
                self.services.audit_event(conn,current,"create","project_document",cur.lastrowid,f"{filename} in Projekt {project_id}")
                return self.services.json_response(self,201,{"id":cur.lastrowid,"filename":filename,"project_id":project_id})
        return self.services.binary_response(self,payload,content_type,filename)
    return False

def put(self, p, data):
    m=self.services.re.fullmatch(r"/api/document-templates/(\d+)",p)
    if m:
        current=self.require_auth(permission="document_templates_manage")
        if not current:return
        with self.services.db() as conn:
            row=conn.execute("SELECT * FROM document_templates WHERE id=?",(int(m.group(1)),)).fetchone()
            if not row:return self.services.json_response(self,404,{"error":"Dokumentvorlage wurde nicht gefunden."})
            raw=row["docx_blob"]; filename=row["original_filename"]; placeholders=self.services.json.loads(row["placeholder_keys_json"] or "[]")
            if data.get("content_base64"):
                try: raw=self.services.base64.b64decode(str(data["content_base64"]).split(",")[-1],validate=True); placeholders=self.services.extract_docx_placeholders(raw)
                except Exception as error:return self.services.json_response(self,400,{"error":str(error)})
                filename=str(data.get("filename") or filename)
                if not filename.lower().endswith(".docx"):return self.services.json_response(self,400,{"error":"Bitte eine DOCX-Datei auswählen."})
            name=str(data.get("name",row["name"])).strip()
            if not name:return self.services.json_response(self,400,{"error":"Ein Vorlagenname ist erforderlich."})
            conn.execute("UPDATE document_templates SET name=?,description=?,original_filename=?,docx_blob=?,placeholder_keys_json=?,active=?,updated_at=? WHERE id=?",
                (name,str(data.get("description",row["description"])),filename,raw,self.services.json.dumps(placeholders),1 if data.get("active",True) else 0,self.services.now_iso(),int(m.group(1))))
            self.services.audit_event(conn,current,"update","document_template",m.group(1),name)
            if data.get("content_base64"):self.services.save_document_version(conn,int(m.group(1)),current["id"])
        return self.services.json_response(self,200,{"ok":True,"placeholders":placeholders})
    m=self.services.re.fullmatch(r"/api/document-blocks/(\d+)",p)
    if m:
        current=self.require_auth(permission="document_templates_manage")
        if not current:return
        key=str(data.get("key","")).strip(); name=str(data.get("name","")).strip()
        if not self.services.re.fullmatch(r"[a-z][a-z0-9_]*",key) or not name:return self.services.json_response(self,400,{"error":"Schlüssel und Name sind erforderlich."})
        try:
            with self.services.db() as conn:
                cur=conn.execute("UPDATE document_text_blocks SET block_key=?,name=?,category=?,content=?,active=?,updated_at=? WHERE id=?",
                    (key,name,str(data.get("category","")).strip(),str(data.get("content","")),1 if data.get("active",True) else 0,self.services.now_iso(),int(m.group(1))))
                if not cur.rowcount:return self.services.json_response(self,404,{"error":"Textbaustein wurde nicht gefunden."})
                self.services.audit_event(conn,current,"update","document_block",m.group(1),name)
        except self.services.sqlite3.IntegrityError:return self.services.json_response(self,409,{"error":"Dieser Schlüssel ist bereits vorhanden."})
        return self.services.json_response(self,200,{"ok":True})
    return False

def delete(self, p, data):
    m=self.services.re.fullmatch(r"/api/document-templates/(\d+)",p)
    if m:
        if not self.services.csrf_valid(self):return self.services.json_response(self,403,{"error":"Sicherheitsprüfung fehlgeschlagen."})
        current=self.require_auth(permission="document_templates_manage")
        if not current:return
        with self.services.db() as conn:
            cur=conn.execute("DELETE FROM document_templates WHERE id=?",(int(m.group(1)),))
            if not cur.rowcount:return self.services.json_response(self,404,{"error":"Dokumentvorlage wurde nicht gefunden."})
            self.services.audit_event(conn,current,"delete-permanent","document_template",m.group(1),"Dokumentvorlage gelöscht")
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/document-blocks/(\d+)",p)
    if m:
        if not self.services.csrf_valid(self):return self.services.json_response(self,403,{"error":"Sicherheitsprüfung fehlgeschlagen."})
        current=self.require_auth(permission="document_templates_manage")
        if not current:return
        with self.services.db() as conn:
            cur=conn.execute("DELETE FROM document_text_blocks WHERE id=?",(int(m.group(1)),))
            if not cur.rowcount:return self.services.json_response(self,404,{"error":"Textbaustein wurde nicht gefunden."})
            self.services.audit_event(conn,current,"delete-permanent","document_block",m.group(1),"Textbaustein gelöscht")
        return self.services.json_response(self,200,{"ok":True})
    return False
