"""Mail routes. Return False only when no route matched.

The adapter owns sessions/CSRF and injects shared database/security services.
"""

def get(self, p, data):
    if p in {"/api/templates/export/json","/api/templates/export/eml"}:
        current = self.require_auth(permission="templates_export_all")
        if not current: return
        with self.services.db() as conn:
            rows = self.services.accessible_template_rows(conn,current)
            self.services.audit_event(conn,current,"export","templates","all",
                        f"{len(rows)} zugängliche Vorlagen exportiert")
        stamp = self.services.datetime.now().strftime("%Y%m%d-%H%M%S")
        if p.endswith("/json"):
            payload = self.services.json.dumps({"schema_version":"1.3","software_version":self.services.SOFTWARE_VERSION,
                "exported_at":self.services.now_iso(),"templates":[self.services.template_export_dict(row) for row in rows]},
                ensure_ascii=False,indent=2).encode("utf-8")
            return self.services.binary_response(self,payload,"application/json; charset=utf-8",
                                   f"Wieseke-Mailvorlagen-{stamp}.json")
        output = self.services.io.BytesIO()
        with self.services.zipfile.ZipFile(output,"w",compression=self.services.zipfile.ZIP_DEFLATED) as archive:
            for position,row in enumerate(rows,1):
                archive.writestr(f"{position:03d}-{self.services.safe_export_filename(row['name'])}.eml",self.services.template_eml_bytes(row))
        return self.services.binary_response(self,output.getvalue(),"application/zip",
                               f"Wieseke-Mailvorlagen-EML-{stamp}.zip")
    m = self.services.re.fullmatch(r"/api/templates/(\d+)/export/(json|eml)",p)
    if m:
        current = self.require_auth(permission="template_export")
        if not current: return
        template_id,export_type = int(m.group(1)),m.group(2)
        with self.services.db() as conn:
            accessible = {row["id"]:row for row in self.services.accessible_template_rows(conn,current)}
            row = accessible.get(template_id)
            if not row: return self.services.json_response(self,404,{"error":"Vorlage wurde nicht gefunden oder ist nicht freigegeben."})
            self.services.audit_event(conn,current,"export","template",template_id,
                        f"Vorlage als {export_type.upper()} exportiert")
        filename = self.services.safe_export_filename(row["name"])
        if export_type == "json":
            payload = self.services.json.dumps({"schema_version":"1.3","software_version":self.services.SOFTWARE_VERSION,
                "exported_at":self.services.now_iso(),"template":self.services.template_export_dict(row)},
                ensure_ascii=False,indent=2).encode("utf-8")
            return self.services.binary_response(self,payload,"application/json; charset=utf-8",f"{filename}.json")
        return self.services.binary_response(self,self.services.template_eml_bytes(row),"message/rfc822",f"{filename}.eml")
    m = self.services.re.fullmatch(r"/api/templates/(\d+)/versions",p)
    if m:
        if not self.require_auth(permission="templates_manage"): return
        with self.services.db() as conn:
            rows = conn.execute("""SELECT v.id,v.template_id,v.version_no,v.created_at,
                v.created_by,u.username FROM template_versions v LEFT JOIN users u ON u.id=v.created_by
                WHERE v.template_id=? ORDER BY v.version_no DESC""",(int(m.group(1)),)).fetchall()
        return self.services.json_response(self,200,{"versions":[dict(row) for row in rows]})
    if p == "/api/variables":
        if not self.require_auth(): return
        with self.services.db() as conn:
            rows = conn.execute("SELECT * FROM variables ORDER BY sort_order,id").fetchall()
        return self.services.json_response(self,200,{"variables":[self.services.variable_dict(r) for r in rows]})
    if p == "/api/categories":
        current = self.require_auth()
        if not current: return
        with self.services.db() as conn:
            rows = self.services.accessible_category_rows(conn,current)
        return self.services.json_response(self,200,{"categories":[self.services.category_dict(row) for row in rows]})
    if p == "/api/templates":
        current = self.require_auth()
        if not current: return
        current_permissions = self.services.permissions_from_row(current)
        if not ({"email_create","templates_manage","roles_manage"} & set(current_permissions)):
            return self.services.json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
        with self.services.db() as conn:
            rows = self.services.accessible_template_rows(conn,current)
        return self.services.json_response(self,200,{"templates":[
            {"id":r["id"],"name":r["name"],"category":r["category"],"category_id":r["category_id"],"subject":r["subject"],
             "body":r["body"],"body_html":r["body_html"] or self.services.plain_text_to_html(r["body"]),
             "fields":self.services.json.loads(r["fields_json"]),"active":bool(r["active"]),
             "notice_text":r["notice_text"],"notice_mode":r["notice_mode"],
             "notice_enabled":bool(r["notice_enabled"]),
             "notice_html":r["notice_html"] or self.services.plain_text_to_html(r["notice_text"]),
             "notice_button_label":r["notice_button_label"] or "Hinweistext gesehen",
             "sort_order":r["sort_order"],"archived":bool(r["archived"])}
            for r in rows]})
    if p == "/api/favorites":
        current = self.require_auth(permission="email_create")
        if not current: return
        with self.services.db() as conn:
            accessible_ids={row["id"] for row in self.services.accessible_template_rows(conn,current)}
            favorite_ids=[row[0] for row in conn.execute(
                "SELECT template_id FROM favorite_templates WHERE user_id=? ORDER BY created_at",
                (current["id"],)).fetchall() if row[0] in accessible_ids]
        return self.services.json_response(self,200,{"template_ids":favorite_ids})
    if p == "/api/dashboard":
        current = self.require_auth(permission="email_create")
        if not current: return
        with self.services.db() as conn:
            category_rows = self.services.accessible_category_rows(conn,current)
            allowed_categories = {row["id"]:self.services.category_dict(row) for row in category_rows}
            template_rows = self.services.accessible_template_rows(conn,current)
            templates_by_category = {}
            for row in template_rows:
                templates_by_category.setdefault(row["category_id"],[]).append({
                    "id":row["id"],"name":row["name"]})
            tile_rows = conn.execute("""SELECT * FROM dashboard_tiles
                WHERE user_id=? ORDER BY sort_order,id""",(current["id"],)).fetchall()
            tiles = [{"id":row["id"],"category":allowed_categories[row["category_id"]],
                      "templates":templates_by_category.get(row["category_id"],[]),
                      "sort_order":row["sort_order"]}
                     for row in tile_rows if row["category_id"] in allowed_categories]
            quicklink_rows = conn.execute("""SELECT id,title,url,link_type,target,sort_order FROM dashboard_quicklinks
                WHERE user_id=? ORDER BY sort_order,id""",(current["id"],)).fetchall()
        return self.services.json_response(self,200,{"tiles":tiles,"show_favorites":bool(current["show_favorites"]),
            "show_quicklinks":bool(current["show_quicklinks"]),
            "quicklinks":[dict(row) for row in quicklink_rows]})
    return False

def post(self, p, data):
    m = self.services.re.fullmatch(r"/api/templates/(\d+)/versions/(\d+)/restore",p)
    if m:
        current = self.require_auth(permission="templates_manage")
        if not current: return
        template_id,version_id = map(int,m.groups())
        with self.services.db() as conn:
            version = conn.execute("SELECT * FROM template_versions WHERE id=? AND template_id=?",
                                   (version_id,template_id)).fetchone()
            if not version: return self.services.json_response(self,404,{"error":"Vorlagenversion wurde nicht gefunden."})
            snapshot = self.services.json.loads(version["snapshot_json"])
            category_id = snapshot.get("category_id")
            if category_id and not conn.execute("SELECT 1 FROM categories WHERE id=?", (category_id,)).fetchone():
                return self.services.json_response(self,409,{"error":"Die in dieser Version verwendete Mailkategorie existiert nicht mehr."})
            columns = ["name","category","category_id","subject","body","body_html","fields_json","active",
                       "notice_text","notice_mode","notice_enabled","notice_html","notice_button_label","sort_order","archived"]
            conn.execute(f"UPDATE templates SET {','.join(column+'=?' for column in columns)},updated_at=? WHERE id=?",
                         [snapshot.get(column) for column in columns]+[self.services.now_iso(),template_id])
            new_version = self.services.save_template_version(conn,template_id,current["id"])
            self.services.audit_event(conn,current,"restore","template",template_id,
                        f"Version {version['version_no']} als Version {new_version} wiederhergestellt")
        return self.services.json_response(self,200,{"ok":True,"version_no":new_version})
    if p == "/api/email/images":
        current=self.require_auth()
        if not current:return
        if not {"email_create","templates_manage"} & set(self.services.permissions_from_row(current)):
            return self.services.json_response(self,403,{"error":"Für diese Funktion fehlt die Berechtigung."})
        try:
            raw=self.services.base64.b64decode(str(data.get("content_base64","")),validate=True)
            content,subtype,width,height=self.services.email_images.normalize_image(raw)
            return self.services.json_response(self,200,{"src":self.services.email_images.data_url(content,subtype),"width":width,"height":height,"size":len(content)})
        except (ValueError,TypeError) as error:return self.services.json_response(self,400,{"error":str(error)})
    if p == "/api/email/eml":
        if not self.require_auth(permission="email_create"):return
        try:
            body_html=self.services.sanitize_email_html(data.get("body_html",""),data.get("body_text",""))
            subject=str(data.get("subject",""))[:1000]
            content=self.services.email_images.build_eml(subject,self.services.html_to_plain_text(body_html),body_html,
                str(data.get("recipient",""))[:4000],str(data.get("cc",""))[:4000])
            return self.services.binary_response(self,content,"message/rfc822",self.services.safe_export_filename(subject,"E-Mail")+".eml")
        except ValueError as error:return self.services.json_response(self,400,{"error":str(error)})
    if p == "/api/variables":
        if not self.require_auth(permission="variables_manage"): return
        payload, error = self.services.valid_variable_payload(data)
        if error: return self.services.json_response(self,400,{"error":error})
        try:
            with self.services.db() as conn:
                next_order = conn.execute(
                    "SELECT COALESCE(MAX(sort_order),-1)+1 FROM variables"
                ).fetchone()[0]
                cur = conn.execute("""INSERT INTO variables
                    (key,label,field_type,source,required,active,sort_order)
                    VALUES (?,?,?,?,?,?,?)""",
                    (payload["key"],payload["label"],payload["field_type"],
                     payload["source"],payload["required"],payload["active"],next_order))
        except self.services.sqlite3.IntegrityError:
            return self.services.json_response(self,409,{"error":"Dieser Platzhalterschlüssel existiert bereits."})
        return self.services.json_response(self,201,{"ok":True,"id":cur.lastrowid})
    m = self.services.re.fullmatch(r"/api/templates/(\d+)/duplicate", p)
    if m:
        current = self.require_auth(permission="templates_manage")
        if not current: return
        with self.services.db() as conn:
            source=conn.execute("SELECT * FROM templates WHERE id=?",(int(m.group(1)),)).fetchone()
            if not source:return self.services.json_response(self,404,{"error":"Vorlage wurde nicht gefunden."})
            next_order=conn.execute("""SELECT COALESCE(MAX(sort_order),-1)+1 FROM templates
                WHERE category_id IS ?""",(source["category_id"],)).fetchone()[0]
            cur=conn.execute("""INSERT INTO templates
                (name,category,subject,body,body_html,fields_json,active,created_at,updated_at,
                 category_id,notice_text,notice_mode,notice_enabled,notice_html,notice_button_label,sort_order)
                VALUES (?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?)""",
                ("Kopie von "+source["name"],source["category"],source["subject"],source["body"],
                 source["body_html"],source["fields_json"],self.services.now_iso(),self.services.now_iso(),source["category_id"],
                 source["notice_text"],source["notice_mode"],source["notice_enabled"],
                 source["notice_html"],source["notice_button_label"],next_order))
            self.services.save_template_version(conn,cur.lastrowid,current["id"])
            self.services.audit_event(conn,current,"duplicate","template",cur.lastrowid,"Vorlage dupliziert")
        return self.services.json_response(self,201,{"ok":True,"id":cur.lastrowid})
    if p == "/api/favorites":
        current=self.require_auth(permission="email_create")
        if not current:return
        try:template_id=int(data.get("template_id",0))
        except (TypeError,ValueError):template_id=0
        with self.services.db() as conn:
            accessible_ids={row["id"] for row in self.services.accessible_template_rows(conn,current)}
            if template_id not in accessible_ids:
                return self.services.json_response(self,404,{"error":"Vorlage wurde nicht gefunden oder ist nicht freigegeben."})
            conn.execute("INSERT OR IGNORE INTO favorite_templates(user_id,template_id,created_at) VALUES (?,?,?)",
                         (current["id"],template_id,self.services.now_iso()))
        return self.services.json_response(self,201,{"ok":True})
    if p == "/api/templates":
        current = self.require_auth(permission="templates_manage")
        if not current: return
        name = str(data.get("name","")).strip()
        subject = str(data.get("subject","")).strip()
        submitted_body = str(data.get("body","")).strip()
        try: body_html = self.services.sanitize_email_html(data.get("body_html",""), submitted_body)
        except ValueError as error: return self.services.json_response(self,400,{"error":str(error)})
        body = self.services.html_to_plain_text(body_html)
        try: category_id = int(data.get("category_id",0))
        except (TypeError,ValueError): category_id = 0
        with self.services.db() as conn:
            category_row = conn.execute("SELECT * FROM categories WHERE id=?",(category_id,)).fetchone()
        category = category_row["name"] if category_row else ""
        fields, fields_error = self.services.normalize_template_fields(data.get("fields",[]))
        notice_text = str(data.get("notice_text","")).strip()
        notice_mode = str(data.get("notice_mode","display"))
        notice_enabled = 1 if data.get("notice_enabled") else 0
        submitted_notice = str(data.get("notice_text","")).strip()
        try: notice_html = self.services.sanitize_email_html(data.get("notice_html",""),submitted_notice)
        except ValueError as error: return self.services.json_response(self,400,{"error":str(error)})
        notice_text = self.services.html_to_plain_text(notice_html)
        notice_button_label = str(data.get("notice_button_label","Hinweistext gesehen")).strip() or "Hinweistext gesehen"
        if fields_error: return self.services.json_response(self,400,{"error":fields_error})
        if notice_mode not in self.services.NOTICE_MODES:
            return self.services.json_response(self,400,{"error":"Die Hinweisbehandlung ist ungültig."})
        if not name or not subject or not body or not category_row:
            return self.services.json_response(self,400,{"error":"Name, Kategorie, Betreff und Text sind erforderlich."})
        with self.services.db() as conn:
            next_order=conn.execute("""SELECT COALESCE(MAX(sort_order),-1)+1 FROM templates
                WHERE category_id=?""",(category_id,)).fetchone()[0]
            cur = conn.execute("""INSERT INTO templates
                (name,category,subject,body,body_html,fields_json,active,created_at,updated_at,notice_text,notice_mode,notice_enabled,notice_html,notice_button_label,category_id,sort_order)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (name,category,subject,body,body_html,self.services.json.dumps(fields,ensure_ascii=False),
                 1 if data.get("active",True) else 0,self.services.now_iso(),self.services.now_iso(),notice_text,notice_mode,notice_enabled,
                 notice_html,notice_button_label,category_id,next_order))
            self.services.sync_custom_variables(conn,fields)
            self.services.save_template_version(conn,cur.lastrowid,current["id"])
            self.services.audit_event(conn,current,"create","template",cur.lastrowid,f"Vorlage {name} angelegt")
        return self.services.json_response(self,201,{"ok":True,"id":cur.lastrowid})
    if p == "/api/categories":
        if not self.require_auth(permission="categories_manage"): return
        name = str(data.get("name","")).strip()
        if not name: return self.services.json_response(self,400,{"error":"Ein Kategoriename ist erforderlich."})
        try:
            with self.services.db() as conn:
                order = conn.execute("SELECT COALESCE(MAX(sort_order),-1)+1 FROM categories").fetchone()[0]
                cur = conn.execute("""INSERT INTO categories(name,active,sort_order,created_at)
                    VALUES (?,?,?,?)""",(name,1 if data.get("active",True) else 0,order,self.services.now_iso()))
        except self.services.sqlite3.IntegrityError:
            return self.services.json_response(self,409,{"error":"Diese Kategorie existiert bereits."})
        return self.services.json_response(self,201,{"ok":True,"id":cur.lastrowid})
    if p == "/api/dashboard":
        current = self.require_auth(permission="email_create")
        if not current: return
        try: category_id = int(data.get("category_id",0))
        except (TypeError,ValueError): category_id = 0
        with self.services.db() as conn:
            allowed_ids = {row["id"] for row in self.services.accessible_category_rows(conn,current)}
            if category_id not in allowed_ids:
                return self.services.json_response(self,403,{"error":"Auf diese Kategorie besteht kein Zugriff."})
            order = conn.execute("""SELECT COALESCE(MAX(sort_order),-1)+1 FROM dashboard_tiles
                WHERE user_id=?""",(current["id"],)).fetchone()[0]
            try:
                cur = conn.execute("""INSERT INTO dashboard_tiles(user_id,category_id,sort_order)
                    VALUES (?,?,?)""",(current["id"],category_id,order))
            except self.services.sqlite3.IntegrityError:
                return self.services.json_response(self,409,{"error":"Diese Kategorie ist bereits als Kachel vorhanden."})
        return self.services.json_response(self,201,{"ok":True,"id":cur.lastrowid})
    if p == "/api/dashboard/quicklinks":
        current = self.require_auth(permission="email_create")
        if not current: return
        title = str(data.get("title","")).strip()
        url = str(data.get("url","")).strip()
        link_type = str(data.get("link_type","external")).strip()
        target = str(data.get("target","")).strip()
        parsed = self.services.urlparse(url)
        if not title or len(title) > 100:
            return self.services.json_response(self,400,{"error":"Bitte eine Bezeichnung mit höchstens 100 Zeichen eingeben."})
        if link_type not in {"external","internal"}:
            return self.services.json_response(self,400,{"error":"Ungültiger Quicklink-Typ."})
        if link_type == "external" and (len(url) > 2000 or parsed.scheme not in {"http","https"} or not parsed.netloc):
            return self.services.json_response(self,400,{"error":"Bitte eine vollständige HTTP- oder HTTPS-Adresse eingeben."})
        if link_type == "internal" and target not in self.services.INTERNAL_QUICKLINK_TARGETS:
            return self.services.json_response(self,400,{"error":"Bitte eine gültige interne Seite auswählen."})
        if link_type == "internal": url = ""
        else: target = ""
        with self.services.db() as conn:
            order = conn.execute("""SELECT COALESCE(MAX(sort_order),-1)+1 FROM dashboard_quicklinks
                WHERE user_id=?""",(current["id"],)).fetchone()[0]
            cur = conn.execute("""INSERT INTO dashboard_quicklinks
                (user_id,title,url,link_type,target,sort_order,created_at) VALUES (?,?,?,?,?,?,?)""",
                (current["id"],title,url,link_type,target,order,self.services.now_iso()))
            conn.execute("UPDATE users SET show_quicklinks=1 WHERE id=?",(current["id"],))
        return self.services.json_response(self,201,{"ok":True,"id":cur.lastrowid})
    if p in {"/api/projects/delete-archived","/api/templates/delete-archived"}:
        current = self.require_auth(permission="roles_manage")
        if not current: return
        try: entity_ids = sorted({int(value) for value in data.get("ids",[])})
        except (TypeError,ValueError):
            return self.services.json_response(self,400,{"error":"Ungültige Auswahl."})
        if not entity_ids:
            return self.services.json_response(self,400,{"error":"Bitte mindestens einen archivierten Eintrag auswählen."})
        table = "projects" if p.startswith("/api/projects") else "templates"
        entity_type = "project" if table == "projects" else "template"
        placeholders = ",".join("?" for _ in entity_ids)
        with self.services.db() as conn:
            rows = conn.execute(f"SELECT id,archived FROM {table} WHERE id IN ({placeholders})",entity_ids).fetchall()
            if len(rows) != len(entity_ids) or any(not row["archived"] for row in rows):
                return self.services.json_response(self,409,{"error":"Nur vollständig archivierte Einträge können endgültig gelöscht werden."})
            for entity_id in entity_ids:
                self.services.audit_event(conn,current,"delete-permanent",entity_type,entity_id,"Archivierten Eintrag endgültig gelöscht")
            conn.execute(f"DELETE FROM {table} WHERE id IN ({placeholders})",entity_ids)
        return self.services.json_response(self,200,{"ok":True,"deleted":len(entity_ids)})
    return False

def put(self, p, data):
    m = self.services.re.fullmatch(r"/api/variables/(\d+)", p)
    if m:
        if not self.require_auth(permission="variables_manage"): return
        payload, error = self.services.valid_variable_payload(data)
        if error: return self.services.json_response(self,400,{"error":error})
        try:
            with self.services.db() as conn:
                conn.execute("""UPDATE variables
                    SET key=?,label=?,field_type=?,source=?,required=?,active=?
                    WHERE id=?""",
                    (payload["key"],payload["label"],payload["field_type"],
                     payload["source"],payload["required"],payload["active"],
                     int(m.group(1))))
        except self.services.sqlite3.IntegrityError:
            return self.services.json_response(self,409,{"error":"Dieser Platzhalterschlüssel existiert bereits."})
        return self.services.json_response(self,200,{"ok":True})
    m = self.services.re.fullmatch(r"/api/templates/(\d+)", p)
    if m:
        current = self.require_auth(permission="templates_manage")
        if not current: return
        tid=int(m.group(1))
        fields, fields_error=self.services.normalize_template_fields(data.get("fields",[]))
        if fields_error:return self.services.json_response(self,400,{"error":fields_error})
        notice_text=str(data.get("notice_text","")).strip()
        notice_mode=str(data.get("notice_mode","display"))
        notice_enabled=1 if data.get("notice_enabled") else 0
        submitted_notice=str(data.get("notice_text","")).strip()
        try: notice_html=self.services.sanitize_email_html(data.get("notice_html",""),submitted_notice)
        except ValueError as error: return self.services.json_response(self,400,{"error":str(error)})
        notice_text=self.services.html_to_plain_text(notice_html)
        notice_button_label=str(data.get("notice_button_label","Hinweistext gesehen")).strip() or "Hinweistext gesehen"
        if notice_mode not in self.services.NOTICE_MODES:
            return self.services.json_response(self,400,{"error":"Die Hinweisbehandlung ist ungültig."})
        try: category_id=int(data.get("category_id",0))
        except (TypeError,ValueError): category_id=0
        with self.services.db() as conn:
            category_row=conn.execute("SELECT * FROM categories WHERE id=?",(category_id,)).fetchone()
            if not category_row: return self.services.json_response(self,400,{"error":"Die ausgewählte Kategorie existiert nicht."})
            existing_template=conn.execute("SELECT category_id,sort_order FROM templates WHERE id=?",(tid,)).fetchone()
            if not existing_template:return self.services.json_response(self,404,{"error":"Vorlage wurde nicht gefunden."})
            sort_order=existing_template["sort_order"]
            if existing_template["category_id"] != category_id:
                sort_order=conn.execute("""SELECT COALESCE(MAX(sort_order),-1)+1 FROM templates
                    WHERE category_id=?""",(category_id,)).fetchone()[0]
            submitted_body=str(data.get("body","")).strip()
            try: body_html=self.services.sanitize_email_html(data.get("body_html",""),submitted_body)
            except ValueError as error: return self.services.json_response(self,400,{"error":str(error)})
            body=self.services.html_to_plain_text(body_html)
            conn.execute("""UPDATE templates SET name=?,category=?,category_id=?,subject=?,body=?,body_html=?,fields_json=?,active=?,updated_at=?,notice_text=?,notice_mode=?,notice_enabled=?,notice_html=?,notice_button_label=?,sort_order=?
                WHERE id=?""",
                (str(data.get("name","")).strip(),category_row["name"],category_id,
                 str(data.get("subject","")).strip(),body,body_html,self.services.json.dumps(fields,ensure_ascii=False),
                 1 if data.get("active",True) else 0,
                 self.services.now_iso(),notice_text,notice_mode,notice_enabled,notice_html,notice_button_label,sort_order,tid))
            self.services.sync_custom_variables(conn,fields)
            version_no = self.services.save_template_version(conn,tid,current["id"])
            self.services.audit_event(conn,current,"update","template",tid,f"Vorlage gespeichert (Version {version_no})")
        return self.services.json_response(self,200,{"ok":True})
    if p == "/api/templates/order":
        if not self.require_auth(permission="templates_manage"): return
        try:
            category_id=int(data.get("category_id",0))
            template_ids=[int(value) for value in data.get("template_ids",[])]
        except (TypeError,ValueError):
            return self.services.json_response(self,400,{"error":"Ungültige Vorlagenreihenfolge."})
        with self.services.db() as conn:
            existing=[row[0] for row in conn.execute(
                "SELECT id FROM templates WHERE category_id=?",(category_id,)).fetchall()]
            if set(template_ids)!=set(existing) or len(template_ids)!=len(existing):
                return self.services.json_response(self,400,{"error":"Die Vorlagenreihenfolge ist unvollständig."})
            for position,template_id in enumerate(template_ids):
                conn.execute("UPDATE templates SET sort_order=? WHERE id=? AND category_id=?",
                             (position,template_id,category_id))
        return self.services.json_response(self,200,{"ok":True})
    m = self.services.re.fullmatch(r"/api/categories/(\d+)", p)
    if m:
        if not self.require_auth(permission="categories_manage"): return
        category_id=int(m.group(1));name=str(data.get("name","")).strip()
        if not name:return self.services.json_response(self,400,{"error":"Ein Kategoriename ist erforderlich."})
        try:
            with self.services.db() as conn:
                conn.execute("UPDATE categories SET name=?,active=? WHERE id=?",
                             (name,1 if data.get("active",True) else 0,category_id))
                conn.execute("UPDATE templates SET category=? WHERE category_id=?",(name,category_id))
        except self.services.sqlite3.IntegrityError:
            return self.services.json_response(self,409,{"error":"Diese Kategorie existiert bereits."})
        return self.services.json_response(self,200,{"ok":True})
    if p == "/api/categories/order":
        if not self.require_auth(permission="categories_manage"): return
        try: category_ids=[int(value) for value in data.get("category_ids",[])]
        except (TypeError,ValueError):
            return self.services.json_response(self,400,{"error":"Ungültige Kategorienreihenfolge."})
        with self.services.db() as conn:
            existing={row[0] for row in conn.execute("SELECT id FROM categories").fetchall()}
            if set(category_ids)!=existing or len(category_ids)!=len(existing):
                return self.services.json_response(self,400,{"error":"Die Kategorienreihenfolge ist unvollständig."})
            for order,category_id in enumerate(category_ids):
                conn.execute("UPDATE categories SET sort_order=? WHERE id=?",(order,category_id))
        return self.services.json_response(self,200,{"ok":True})
    if p == "/api/dashboard/order":
        current=self.require_auth(permission="email_create")
        if not current:return
        try:tile_ids=[int(value) for value in data.get("tile_ids",[])]
        except (TypeError,ValueError):return self.services.json_response(self,400,{"error":"Ungültige Reihenfolge."})
        with self.services.db() as conn:
            owned={row[0] for row in conn.execute("SELECT id FROM dashboard_tiles WHERE user_id=?",(current["id"],)).fetchall()}
            if set(tile_ids)!=owned:return self.services.json_response(self,400,{"error":"Die Kachelreihenfolge ist unvollständig."})
            for order,tile_id in enumerate(tile_ids):
                conn.execute("UPDATE dashboard_tiles SET sort_order=? WHERE id=? AND user_id=?",
                             (order,tile_id,current["id"]))
        return self.services.json_response(self,200,{"ok":True})
    if p == "/api/dashboard/favorites":
        current=self.require_auth(permission="email_create")
        if not current:return
        with self.services.db() as conn:
            conn.execute("UPDATE users SET show_favorites=? WHERE id=?",
                         (1 if data.get("visible") else 0,current["id"]))
        return self.services.json_response(self,200,{"ok":True})
    if p == "/api/dashboard/quicklinks/visibility":
        current=self.require_auth(permission="email_create")
        if not current:return
        with self.services.db() as conn:
            conn.execute("UPDATE users SET show_quicklinks=? WHERE id=?",
                         (1 if data.get("visible") else 0,current["id"]))
        return self.services.json_response(self,200,{"ok":True})
    if p == "/api/dashboard/quicklinks/order":
        current=self.require_auth(permission="email_create")
        if not current:return
        try:link_ids=[int(value) for value in data.get("link_ids",[])]
        except (TypeError,ValueError):return self.services.json_response(self,400,{"error":"Ungültige Quicklink-Reihenfolge."})
        with self.services.db() as conn:
            owned={row[0] for row in conn.execute("SELECT id FROM dashboard_quicklinks WHERE user_id=?",(current["id"],)).fetchall()}
            if set(link_ids)!=owned or len(link_ids)!=len(owned):
                return self.services.json_response(self,400,{"error":"Die Quicklink-Reihenfolge ist unvollständig."})
            for order,link_id in enumerate(link_ids):
                conn.execute("UPDATE dashboard_quicklinks SET sort_order=? WHERE id=? AND user_id=?",(order,link_id,current["id"]))
        return self.services.json_response(self,200,{"ok":True})
    return False

def delete(self, p, data):
    m=self.services.re.fullmatch(r"/api/favorites/(\d+)",p)
    if m:
        current=self.require_auth(permission="email_create")
        if not current:return
        with self.services.db() as conn:
            conn.execute("DELETE FROM favorite_templates WHERE user_id=? AND template_id=?",
                         (current["id"],int(m.group(1))))
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/variables/(\d+)",p)
    if m:
        if not self.require_auth(permission="variables_manage"): return
        variable_id = int(m.group(1))
        with self.services.db() as conn:
            row = conn.execute("SELECT key FROM variables WHERE id=?",(variable_id,)).fetchone()
            if not row: return self.services.json_response(self,404,{"error":"Platzhalter nicht gefunden."})
            if row["key"] in {"projekt.id","projekt.bezeichnung"}:
                return self.services.json_response(self,409,{"error":"Projekt-ID und Projektbezeichnung sind technische Pflichtfelder und können nicht gelöscht werden."})
            needle = "{{" + row["key"] + "}}"
            used = conn.execute(
                "SELECT COUNT(*) FROM templates WHERE subject LIKE ? OR body LIKE ?",
                (f"%{needle}%",f"%{needle}%")
            ).fetchone()[0]
            if used:
                return self.services.json_response(self,409,{"error":"Der Platzhalter wird noch in einer Vorlage verwendet und kann nicht gelöscht werden."})
            conn.execute("DELETE FROM variables WHERE id=?",(variable_id,))
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/templates/(\d+)",p)
    if m:
        current = self.require_auth(permission="templates_manage")
        if not current:return
        template_id=int(m.group(1))
        with self.services.db() as conn:
            conn.execute("UPDATE templates SET archived=1 WHERE id=?",(template_id,))
            self.services.save_template_version(conn,template_id,current["id"])
            self.services.audit_event(conn,current,"archive","template",template_id,"Vorlage archiviert")
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/categories/(\d+)",p)
    if m:
        if not self.require_auth(permission="categories_manage"):return
        category_id=int(m.group(1))
        with self.services.db() as conn:
            used=conn.execute("SELECT COUNT(*) FROM templates WHERE category_id=?",(category_id,)).fetchone()[0]
            if used:return self.services.json_response(self,409,{"error":"Die Kategorie wird noch von E-Mail-Vorlagen verwendet."})
            conn.execute("DELETE FROM categories WHERE id=?",(category_id,))
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/dashboard/(\d+)",p)
    if m:
        current=self.require_auth(permission="email_create")
        if not current:return
        with self.services.db() as conn:
            conn.execute("DELETE FROM dashboard_tiles WHERE id=? AND user_id=?",
                         (int(m.group(1)),current["id"]))
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/dashboard/quicklinks/(\d+)",p)
    if m:
        current=self.require_auth(permission="email_create")
        if not current:return
        with self.services.db() as conn:
            conn.execute("DELETE FROM dashboard_quicklinks WHERE id=? AND user_id=?",
                         (int(m.group(1)),current["id"]))
        return self.services.json_response(self,200,{"ok":True})
    return False
