"""Projects routes. Return False only when no route matched.

The adapter owns sessions/CSRF and injects shared database/security services.
"""

def get(self, p, data):
    m = self.services.re.fullmatch(r"/api/projects/(\d+)/workspace",p)
    if m:
        current = self.require_auth(permission="projects_view")
        if not current: return
        project_id = int(m.group(1))
        permissions = set(self.services.permissions_from_row(current))
        with self.services.db() as conn:
            project = conn.execute("SELECT id,project_key,name FROM projects WHERE id=?",(project_id,)).fetchone()
            if not project: return self.services.json_response(self,404,{"error":"Projekt wurde nicht gefunden."})
            email_rows = conn.execute("""SELECT pe.*,u.username FROM project_emails pe
                LEFT JOIN users u ON u.id=pe.created_by WHERE pe.project_id=?
                ORDER BY pe.id DESC""",(project_id,)).fetchall()
            question_rows = []
            document_rows=[]
            if {"documents_create","document_templates_manage"}&permissions:
                document_rows=conn.execute("""SELECT d.id,d.template_name,d.filename,d.content_type,
                    LENGTH(d.content) AS size,d.created_at,u.username FROM project_documents d
                    LEFT JOIN users u ON u.id=d.created_by WHERE d.project_id=? ORDER BY d.id DESC""",(project_id,)).fetchall()
            if "bid_questions_view" in permissions or "bid_questions_manage" in permissions:
                question_rows = conn.execute("""SELECT bq.*,p.project_key,p.name AS project_name
                    FROM bid_questions bq JOIN projects p ON p.id=bq.project_id
                    WHERE bq.project_id=? ORDER BY bq.id DESC""",(project_id,)).fetchall()
        return self.services.json_response(self,200,{"project":dict(project),
            "emails":[{"id":row["id"],"project_id":row["project_id"],
                "template_id":row["template_id"],"template_name":row["template_name"],
                "recipient":row["recipient"],"cc":row["cc"],"subject":row["subject"],
                "body_text":row["body_text"],"body_html":row["body_html"],
                "created_at":row["created_at"],"username":row["username"] or "System"}
                for row in email_rows],
            "bid_questions":[self.services.bid_question_dict(row) for row in question_rows],
            "documents":[dict(row) for row in document_rows]})
    if p == "/api/projects":
        if not self.require_auth(permission="projects_view"): return
        with self.services.db() as conn:
            rows = conn.execute("SELECT id,project_key,name,data_json,imported_at,archived,revision FROM projects ORDER BY archived,project_key DESC").fetchall()
        return self.services.json_response(self,200,{"projects":[
            {"id":r["id"],"project_key":r["project_key"],"name":r["name"],
             "data":self.services.json.loads(r["data_json"]),"revision":r["revision"],"imported_at":r["imported_at"],"archived":bool(r["archived"])} for r in rows]})
    return False

def post(self, p, data):
    if p == "/api/projects":
        user = self.require_auth(permission="projects_manage")
        if not user: return
        try:
            payload = self.services.project_service.validate_project(data.get("data", data))
        except ValueError as error:
            return self.services.json_response(self,400,{"error":str(error)})
        project_key, name = payload["projekt"]["id"], payload["projekt"]["bezeichnung"]
        with self.services.db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            existing = conn.execute("SELECT id,revision,archived FROM projects WHERE project_key=?",(project_key,)).fetchone()
            if existing and not self.services.project_service.revision_matches(existing,data):
                return self.services.json_response(self,409,self.services.project_service.CONFLICT)
            if existing and existing["archived"]:
                return self.services.json_response(self,409,self.services.project_service.ARCHIVED)
            conn.execute("""INSERT INTO projects(project_key,name,data_json,imported_at,imported_by,archived)
                VALUES(?,?,?,?,?,0)
                ON CONFLICT(project_key) DO UPDATE SET name=excluded.name,data_json=excluded.data_json,
                imported_at=excluded.imported_at,imported_by=excluded.imported_by,revision=projects.revision+1""",
                (project_key,name,self.services.json.dumps(payload,ensure_ascii=False),self.services.now_iso(),user["id"]))
            project_id = (existing["id"] if existing else conn.execute("SELECT id FROM projects WHERE project_key=?",(project_key,)).fetchone()[0])
            self.services.audit_event(conn,user,"update" if existing else "create","project",project_id,
                        f"Projekt {project_key} {'aktualisiert' if existing else 'angelegt'}")
        return self.services.json_response(self,200,{"ok":True,"id":project_id,"project_key":project_key,"revision":existing["revision"]+1 if existing else 1})
    m = self.services.re.fullmatch(r"/api/projects/(\d+)/emails",p)
    if m:
        current = self.require_auth(permission="email_create")
        if not current: return
        if "projects_view" not in self.services.permissions_from_row(current):
            return self.services.json_response(self,403,{"error":"Für die Projektspeicherung fehlt die Projektberechtigung."})
        project_id = int(m.group(1))
        subject = str(data.get("subject","")).strip()
        try: body_html = self.services.sanitize_email_html(data.get("body_html",""),data.get("body_text",""))
        except ValueError as error: return self.services.json_response(self,400,{"error":str(error)})
        body_text = self.services.html_to_plain_text(body_html)
        if not subject or not body_text:
            return self.services.json_response(self,400,{"error":"Betreff und E-Mailtext dürfen nicht leer sein."})
        if len(subject)>1000 or len(body_text)>100000 or len(body_html)>self.services.email_images.MAX_HTML:
            return self.services.json_response(self,400,{"error":"Die E-Mail ist für die Projektspeicherung zu groß."})
        try: template_id = int(data["template_id"]) if data.get("template_id") else None
        except (TypeError,ValueError): template_id = None
        with self.services.db() as conn:
            project=conn.execute("SELECT id,project_key FROM projects WHERE id=? AND archived=0",(project_id,)).fetchone()
            if not project:return self.services.json_response(self,404,{"error":"Das aktive Projekt wurde nicht gefunden."})
            cur=conn.execute("""INSERT INTO project_emails
                (project_id,template_id,template_name,recipient,cc,subject,body_text,body_html,created_by,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)""",(project_id,template_id,
                str(data.get("template_name","")).strip()[:300],str(data.get("recipient","")).strip()[:2000],
                str(data.get("cc","")).strip()[:2000],subject,body_text,body_html,current["id"],self.services.now_iso()))
            self.services.audit_event(conn,current,"create","project-email",cur.lastrowid,
                        f"E-Mail in Projekt {project['project_key']} gespeichert")
        return self.services.json_response(self,201,{"ok":True,"id":cur.lastrowid})
    return False

def put(self, p, data):
    m = self.services.re.fullmatch(r"/api/projects/(\d+)/restore",p)
    if m:
        return change_archive_state(self,int(m[1]),data,archive=False)
    m = self.services.re.fullmatch(r"/api/projects/(\d+)/contacts",p)
    if m:
        current = self.require_auth(permission="projects_manage")
        if not current: return
        try: contacts = self.services.project_service.validate_contacts(data.get("kontakte"))
        except ValueError as error: return self.services.json_response(self,400,{"error":str(error)})
        with self.services.db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = conn.execute("SELECT * FROM projects WHERE id=?",(int(m[1]),)).fetchone()
            if not row: return self.services.json_response(self,404,{"error":"Projekt wurde nicht gefunden."})
            if not self.services.project_service.revision_matches(row,data): return self.services.json_response(self,409,self.services.project_service.CONFLICT)
            if row["archived"]: return self.services.json_response(self,409,self.services.project_service.ARCHIVED)
            payload = self.services.json.loads(row["data_json"])
            payload["kontakte"] = contacts
            conn.execute("UPDATE projects SET data_json=?,revision=revision+1,imported_at=?,imported_by=? WHERE id=?",(self.services.json.dumps(payload,ensure_ascii=False),self.services.now_iso(),current["id"],row["id"]))
            self.services.audit_event(conn,current,"update","project",row["id"],"Kontakte aktualisiert")
        return self.services.json_response(self,200,{"ok":True,"revision":row["revision"]+1})
    m = self.services.re.fullmatch(r"/api/projects/(\d+)",p)
    if m:
        current = self.require_auth(permission="projects_manage")
        if not current: return
        try:
            payload = self.services.project_service.validate_project(data.get("data"))
        except ValueError as error: return self.services.json_response(self,400,{"error":str(error)})
        project_key, name = payload["projekt"]["id"], payload["projekt"]["bezeichnung"]
        project_id = int(m.group(1))
        with self.services.db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            existing = conn.execute("SELECT id,project_key,revision,archived FROM projects WHERE id=?",(project_id,)).fetchone()
            if not existing:
                return self.services.json_response(self,404,{"error":"Projekt wurde nicht gefunden."})
            if not self.services.project_service.revision_matches(existing,data): return self.services.json_response(self,409,self.services.project_service.CONFLICT)
            if existing["archived"]: return self.services.json_response(self,409,self.services.project_service.ARCHIVED)
            conflict = conn.execute("SELECT id FROM projects WHERE project_key=? AND id<>?",(project_key,project_id)).fetchone()
            if conflict:
                return self.services.json_response(self,409,{"error":"Diese Projekt-ID ist bereits vergeben. Bitte wählen Sie eine andere Projekt-ID."})
            conn.execute("""UPDATE projects SET project_key=?,name=?,data_json=?,imported_at=?,imported_by=?,revision=revision+1
                WHERE id=?""",(project_key,name,self.services.json.dumps(payload,ensure_ascii=False),self.services.now_iso(),current["id"],project_id))
            self.services.audit_event(conn,current,"update","project",project_id,
                        f"Projekt {existing['project_key']} als {project_key} aktualisiert")
        return self.services.json_response(self,200,{"ok":True,"project_key":project_key,"revision":existing["revision"]+1})
    return False

def delete(self, p, data):
    m=self.services.re.fullmatch(r"/api/projects/(\d+)",p)
    if m:
        return change_archive_state(self,int(m[1]),data,archive=True)
    return False


def change_archive_state(self, project_id, data, *, archive):
    current = self.require_auth(permission="projects_manage")
    if not current: return
    # Archive state participates in the same optimistic lock as content changes.
    with self.services.db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT archived,revision FROM projects WHERE id=?",(project_id,)).fetchone()
        if not row: return self.services.json_response(self,404,{"error":"Projekt wurde nicht gefunden."})
        if not self.services.project_service.revision_matches(row,data):
            return self.services.json_response(self,409,self.services.project_service.CONFLICT)
        if bool(row["archived"]) == archive:
            return self.services.json_response(self,200,{"ok":True,"revision":row["revision"]})
        conn.execute("UPDATE projects SET archived=?,revision=revision+1 WHERE id=?",(int(archive),project_id))
        self.services.audit_event(conn,current,"archive" if archive else "restore","project",project_id,
                                  "Projekt archiviert" if archive else "Projekt wiederhergestellt")
    return self.services.json_response(self,200,{"ok":True,"revision":row["revision"]+1})
