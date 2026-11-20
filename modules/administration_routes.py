"""Administration routes. Return False only when no route matched.

The adapter owns sessions/CSRF and injects shared database/security services.
"""

def get(self, p, data):
    if p == "/api/admin/backup":
        current = self.require_auth(permission="backup_manage")
        if not current: return
        path = self.services.create_database_backup("manual")
        with self.services.db() as conn:
            self.services.audit_event(conn,current,"download","backup",path.name,"Manuelle Datenbanksicherung erstellt")
        raw = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type","application/vnd.sqlite3")
        self.send_header("Content-Disposition",f'attachment; filename="{path.name}"')
        self.send_header("Content-Length",str(len(raw)))
        self.send_header("Cache-Control","no-store")
        self.services.security_headers(self)
        self.end_headers(); self.wfile.write(raw); return
    if p == "/api/audit":
        if not self.require_auth(permission="system_view"): return
        query = self.services.parse_qs(self.services.urlparse(self.path).query)
        try: limit = min(500,max(1,int(query.get("limit",[200])[0])))
        except ValueError: limit = 200
        with self.services.db() as conn:
            rows = conn.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?",(limit,)).fetchall()
        return self.services.json_response(self,200,{"entries":[dict(row) for row in rows]})
    if p == "/api/system-status":
        if not self.require_auth(permission="system_view"): return
        return self.services.json_response(self,200,{"status":self.services.system_status_dict()})
    if p == "/api/usage":
        if not self.require_auth(permission="system_view"): return
        query = self.services.parse_qs(self.services.urlparse(self.path).query)
        try: days = int(query.get("days",["30"])[0])
        except ValueError: days = 30
        days = days if days in {7,30,90,365} else 30
        since = (self.services.datetime.now(self.services.timezone.utc)-self.services.timedelta(days=days)).isoformat()
        with self.services.db() as conn:
            rows = conn.execute("""SELECT id,template_id,template_name,user_id,username,
                project_id,project_key,output_method,created_at FROM template_usage
                WHERE created_at>=? ORDER BY id DESC LIMIT 5000""",(since,)).fetchall()
        template_counts,method_counts,user_counts = {},{},{}
        for row in rows:
            template_counts[row["template_name"]] = template_counts.get(row["template_name"],0)+1
            method_counts[row["output_method"]] = method_counts.get(row["output_method"],0)+1
            user_counts[row["username"]] = user_counts.get(row["username"],0)+1
        ranked = lambda values: [{"name":name,"count":count} for name,count in sorted(values.items(),key=lambda item:(-item[1],item[0].lower()))]
        return self.services.json_response(self,200,{"days":days,"total":len(rows),
            "by_template":ranked(template_counts),"by_method":ranked(method_counts),
            "by_user":ranked(user_counts),"recent":[dict(row) for row in rows[:100]]})
    if p == "/api/settings":
        if not self.require_auth(): return
        return self.services.json_response(self,200,{"settings":self.services.settings_dict(),"software":self.services.software_info_dict()})
    if p == "/api/users":
        current = self.require_auth(permission="users_manage")
        if not current: return
        with self.services.db() as conn:
            rows = conn.execute("""SELECT u.*,r.name AS role_name,
                r.permissions_json,r.all_templates,r.all_categories FROM users u
                LEFT JOIN roles r ON r.id=u.role_id ORDER BY u.username""").fetchall()
        return self.services.json_response(self,200,{"users":[self.services.user_dict(r) for r in rows]})
    if p == "/api/roles":
        current = self.require_auth()
        if not current: return
        current_permissions = self.services.permissions_from_row(current)
        if not ({"roles_manage","users_manage"} & set(current_permissions)):
            return self.services.json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
        with self.services.db() as conn:
            rows = conn.execute("SELECT * FROM roles ORDER BY name").fetchall()
            roles = []
            for row in rows:
                if ("roles_manage" not in current_permissions
                        and not set(self.services.json.loads(row["permissions_json"] or "[]")).issubset(set(current_permissions))):
                    continue
                category_ids = [item[0] for item in conn.execute(
                    "SELECT category_id FROM role_categories WHERE role_id=? ORDER BY category_id",
                    (row["id"],)).fetchall()]
                roles.append(self.services.role_dict(row,category_ids))
        return self.services.json_response(self,200,{"roles":roles,"permission_catalog":self.services.PERMISSIONS})
    return False

def post(self, p, data):
    if p == "/api/usage":
        current = self.require_auth(permission="email_create")
        if not current: return
        try:
            template_id = int(data.get("template_id",0))
            project_id = int(data["project_id"]) if data.get("project_id") else None
        except (TypeError,ValueError):
            return self.services.json_response(self,400,{"error":"Vorlage oder Projekt ist ungültig."})
        output_method = str(data.get("output_method","")).strip().lower()
        if output_method not in {"eml","mailto","copy"}:
            return self.services.json_response(self,400,{"error":"Die Ausgabeart ist ungültig."})
        with self.services.db() as conn:
            accessible = {row["id"]:row for row in self.services.accessible_template_rows(conn,current)}
            template = accessible.get(template_id)
            if not template:
                return self.services.json_response(self,404,{"error":"Vorlage wurde nicht gefunden oder ist nicht freigegeben."})
            project = conn.execute("SELECT id,project_key FROM projects WHERE id=?",(project_id,)).fetchone() if project_id else None
            conn.execute("""INSERT INTO template_usage
                (template_id,template_name,user_id,username,project_id,project_key,output_method,created_at)
                VALUES (?,?,?,?,?,?,?,?)""",(
                template["id"],template["name"],current["id"],current["username"],
                project["id"] if project else None,project["project_key"] if project else "",
                output_method,self.services.now_iso()))
        return self.services.json_response(self,201,{"ok":True})
    if p == "/api/users":
        current = self.require_auth(permission="users_manage")
        if not current: return
        username = str(data.get("username","")).strip()
        first = str(data.get("first_name","")).strip()
        last = str(data.get("last_name","")).strip()
        email = str(data.get("email","")).strip()
        policy_exempt = 1 if data.get("password_policy_exempt") else 0
        must_change = 1 if data.get("must_change", True) else 0
        try: role_id = int(data.get("role_id",0))
        except (TypeError,ValueError): role_id = 0
        with self.services.db() as conn:
            selected_role = conn.execute("SELECT * FROM roles WHERE id=?",(role_id,)).fetchone()
        if not username or not first or not last or not selected_role:
            return self.services.json_response(self,400,{"error":"Bitte alle Pflichtfelder korrekt ausfüllen."})
        selected_permissions = set(self.services.json.loads(selected_role["permissions_json"]))
        with self.services.db() as conn:
            error = self.services.account_security.role_error(current, selected_role, self.services.permissions_from_row, conn)
        if error: return self.services.json_response(self,403,{"error":error})
        if not selected_permissions.issubset(set(self.services.permissions_from_row(current))):
            return self.services.json_response(self,403,{"error":"Sie dürfen keine Rolle mit weitergehenden Berechtigungen zuweisen."})
        legacy_role = "admin" if "roles_manage" in selected_permissions else "user"
        password = self.services.secrets.token_urlsafe(10) + "A1"
        recovery = "-".join([self.services.secrets.token_hex(2).upper() for _ in range(4)])
        try:
            with self.services.db() as conn:
                cur = conn.execute("""INSERT INTO users
                (username,first_name,last_name,email,password_hash,recovery_hash,role,active,must_change,created_at,role_id,password_policy_exempt)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (username,first,last,email,self.services.ph.hash(password),self.services.ph.hash(recovery),legacy_role,1,must_change,self.services.now_iso(),role_id,policy_exempt))
                self.services.audit_event(conn,current,"create","user",cur.lastrowid,f"Benutzer {username} angelegt")
        except self.services.sqlite3.IntegrityError:
            return self.services.json_response(self,409,{"error":"Der Benutzername ist bereits vergeben."})
        return self.services.json_response(self,201,{"ok":True,"username":username,"temporary_password":password,"recovery_code":recovery})
    if p == "/api/roles":
        current = self.require_auth(permission="roles_manage")
        if not current: return
        payload, error = self.services.valid_role_payload(data)
        if error: return self.services.json_response(self,400,{"error":error})
        try:
            with self.services.db() as conn:
                error=self.services.account_security.grant_error(conn,current,payload,self.services.permissions_from_row)
                if error:return self.services.json_response(self,403,{"error":error})
                cur = conn.execute("""INSERT INTO roles
                    (name,permissions_json,all_templates,all_categories,is_system,created_at)
                    VALUES (?,?,?,?,0,?)""",
                    (payload["name"],self.services.json.dumps(payload["permissions"]),
                     1,payload["all_categories"],self.services.now_iso()))
                self.services.save_role_categories(conn,cur.lastrowid,payload)
                self.services.audit_event(conn,current,"create","role",cur.lastrowid,f"Rolle {payload['name']} angelegt")
        except self.services.sqlite3.IntegrityError:
            return self.services.json_response(self,409,{"error":"Dieser Rollenname existiert bereits."})
        return self.services.json_response(self,201,{"ok":True,"id":cur.lastrowid})
    return False

def put(self, p, data):
    if p == "/api/settings":
        current = self.require_auth(permission="settings_manage")
        if not current: return
        app_name = str(data.get("app_name", "")).strip()
        logo_data = str(data.get("logo_data", ""))
        if not app_name:
            return self.services.json_response(self,400,{"error":"Der Anwendungsname darf nicht leer sein."})
        if logo_data and (
            len(logo_data) > 1_500_000
            or not self.services.re.match(r"^data:image/(png|jpeg|webp|gif);base64,", logo_data)
        ):
            return self.services.json_response(self,400,{"error":"Bitte ein PNG-, JPG-, WEBP- oder GIF-Logo bis ca. 1 MB verwenden."})
        navigation_order = data.get("navigation_order",self.services.MAIN_NAV_KEYS)
        if not isinstance(navigation_order,list) or set(navigation_order) != set(self.services.MAIN_NAV_KEYS) or len(navigation_order) != len(self.services.MAIN_NAV_KEYS):
            return self.services.json_response(self,400,{"error":"Die Reihenfolge der Hauptnavigation ist unvollständig."})
        areas=data.get('navigation_areas',self.services.migrations.navigation_areas(navigation_order))
        expected=self.services.migrations.navigation_areas([])
        if not isinstance(areas,dict) or set(areas)!=set(expected) or any(not isinstance(areas[key],list) or len(areas[key])!=len(values) or set(areas[key])!=set(values) for key,values in expected.items()):
            return self.services.json_response(self,400,{"error":"Die Reihenfolge der Arbeitsbereiche ist unvollständig."})
        with self.services.db() as conn:
            conn.execute("""UPDATE app_settings SET app_name=?,logo_data=?,navigation_order_json=?,navigation_areas_json=? WHERE id=1""",
                         (app_name,logo_data,self.services.json.dumps(navigation_order),self.services.json.dumps(areas)))
            self.services.audit_event(conn,current,"update","settings","1","Anwendungsname, Logo oder Navigation geändert")
        return self.services.json_response(self,200,{"ok":True,"settings":self.services.settings_dict(),"software":self.services.software_info_dict()})
    m = self.services.re.fullmatch(r"/api/users/(\d+)/password", p)
    if m:
        current = self.require_auth(permission="users_manage")
        if not current: return
        password = str(data.get("new_password", ""))
        with self.services.db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            error = self.target_account_error(conn,current,int(m[1]))
            if error:return self.services.json_response(self,403,{"error":error})
            target = conn.execute("SELECT password_policy_exempt FROM users WHERE id=?",(int(m.group(1)),)).fetchone()
            if not target: return self.services.json_response(self,404,{"error":"Benutzer wurde nicht gefunden."})
            error = self.services.validate_user_password(password,bool(target["password_policy_exempt"]))
            if error: return self.services.json_response(self,400,{"error":error})
            conn.execute("UPDATE users SET password_hash=?,must_change=0 WHERE id=?",
                         (self.services.ph.hash(password),int(m.group(1))))
            self.services.revoke_credentials(conn,int(m[1]))
            self.services.audit_event(conn,current,"update","user",m.group(1),"Passwort durch Administration geändert")
        return self.services.json_response(self,200,{"ok":True})
    m = self.services.re.fullmatch(r"/api/users/(\d+)/recovery", p)
    if m:
        current = self.require_auth(permission="users_manage")
        if not current: return
        recovery = "-".join([self.services.secrets.token_hex(2).upper() for _ in range(4)])
        with self.services.db() as conn:
            conn.execute("UPDATE users SET recovery_hash=? WHERE id=?",
                         (self.services.ph.hash(recovery),int(m.group(1))))
            self.services.audit_event(conn,current,"update","user",m.group(1),"Wiederherstellungscode neu erzeugt")
        return self.services.json_response(self,200,{"ok":True,"recovery_code":recovery})
    m = self.services.re.fullmatch(r"/api/users/(\d+)/unlock", p)
    if m:
        if not self.require_auth(permission="users_manage"): return
        with self.services.db() as conn:
            conn.execute("UPDATE users SET failed_login_attempts=0,locked_until=NULL,failed_recovery_attempts=0,recovery_locked_until=NULL WHERE id=?",
                         (int(m.group(1)),))
        return self.services.json_response(self,200,{"ok":True})
    m = self.services.re.fullmatch(r"/api/users/(\d+)", p)
    if m:
        current = self.require_auth(permission="users_manage")
        if not current: return
        uid = int(m.group(1))
        allowed = {"first_name","last_name","email","active","password_policy_exempt"}
        sets=[]; vals=[]
        for k in allowed:
            if k in data:
                v=data[k]
                if k in {"active","password_policy_exempt"}: v=1 if v else 0
                sets.append(f"{k}=?"); vals.append(v)
        if "role_id" in data:
            try: role_id = int(data["role_id"])
            except (TypeError,ValueError): role_id = 0
            with self.services.db() as conn:
                role_row = conn.execute("SELECT * FROM roles WHERE id=?",(role_id,)).fetchone()
            if not role_row:
                return self.services.json_response(self,400,{"error":"Die ausgewählte Rolle existiert nicht."})
            with self.services.db() as conn:
                error = self.services.account_security.role_error(current,role_row,self.services.permissions_from_row,conn)
            if error: return self.services.json_response(self,403,{"error":error})
            selected_permissions = set(self.services.json.loads(role_row["permissions_json"]))
            if not selected_permissions.issubset(set(self.services.permissions_from_row(current))):
                return self.services.json_response(self,403,{"error":"Sie dürfen keine Rolle mit weitergehenden Berechtigungen zuweisen."})
            legacy_role = "admin" if "roles_manage" in selected_permissions else "user"
            sets.extend(["role_id=?","role=?"]); vals.extend([role_id,legacy_role])
        if not sets: return self.services.json_response(self,400,{"error":"Keine Änderungen übergeben."})
        vals.append(uid)
        with self.services.db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            error = self.target_account_error(conn,current,uid)
            if error: return self.services.json_response(self,403,{"error":error})
            target = self.services.user_with_role(conn,user_id=uid)
            if self.services.account_security.is_system_admin(target) and target["active"] and (("active" in data and not data["active"]) or ("role_id" in data and int(data["role_id"]) != target["role_id"])):
                count = conn.execute("SELECT COUNT(*) FROM users WHERE active=1 AND role_id=?",(target["role_id"],)).fetchone()[0]
                if count <= 1: return self.services.json_response(self,409,{"error":"Der letzte aktive Systemadministrator muss erhalten bleiben."})
            conn.execute(f"UPDATE users SET {','.join(sets)} WHERE id=?", vals)
            if "active" in data or "role_id" in data: self.services.revoke_credentials(conn,uid)
            self.services.audit_event(conn,current,"update","user",uid,"Benutzerkonto oder Rollenzuweisung geändert")
        return self.services.json_response(self,200,{"ok":True})
    m = self.services.re.fullmatch(r"/api/users/(\d+)/reset", p)
    if m:
        current = self.require_auth(permission="users_manage")
        if not current: return
        uid=int(m.group(1))
        password=self.services.secrets.token_urlsafe(10)+"A1"
        recovery="-".join([self.services.secrets.token_hex(2).upper() for _ in range(4)])
        with self.services.db() as conn:
            conn.execute("BEGIN IMMEDIATE")
            error = self.target_account_error(conn,current,uid)
            if error:return self.services.json_response(self,403,{"error":error})
            conn.execute("UPDATE users SET password_hash=?,recovery_hash=?,must_change=0 WHERE id=?",
                         (self.services.ph.hash(password),self.services.ph.hash(recovery),uid))
            self.services.revoke_credentials(conn,uid)
        return self.services.json_response(self,200,{"temporary_password":password,"recovery_code":recovery})
    m = self.services.re.fullmatch(r"/api/roles/(\d+)", p)
    if m:
        current = self.require_auth(permission="roles_manage")
        if not current: return
        role_id = int(m.group(1))
        payload, error = self.services.valid_role_payload(data)
        if error: return self.services.json_response(self,400,{"error":error})
        with self.services.db() as conn:
            existing = conn.execute("SELECT * FROM roles WHERE id=?",(role_id,)).fetchone()
            if not existing: return self.services.json_response(self,404,{"error":"Rolle nicht gefunden."})
            if existing["name"] == "Administrator":
                return self.services.json_response(self,409,{"error":"Die Administratorrolle ist fest geschützt und kann nicht bearbeitet werden."})
            error=self.services.account_security.grant_error(conn,current,payload,self.services.permissions_from_row,existing)
            if error:return self.services.json_response(self,403,{"error":error})
            try:
                conn.execute("""UPDATE roles SET name=?,permissions_json=?,all_templates=?,all_categories=?
                    WHERE id=?""",(payload["name"],self.services.json.dumps(payload["permissions"]),
                                 1,payload["all_categories"],role_id))
                self.services.save_role_categories(conn,role_id,payload)
                self.services.audit_event(conn,current,"update","role",role_id,f"Rolle {payload['name']} geändert")
            except self.services.sqlite3.IntegrityError:
                return self.services.json_response(self,409,{"error":"Dieser Rollenname existiert bereits."})
        return self.services.json_response(self,200,{"ok":True})
    return False

def delete(self, p, data):
    m=self.services.re.fullmatch(r"/api/roles/(\d+)",p)
    if m:
        current = self.require_auth(permission="roles_manage")
        if not current: return
        role_id = int(m.group(1))
        with self.services.db() as conn:
            role = conn.execute("SELECT * FROM roles WHERE id=?",(role_id,)).fetchone()
            if not role: return self.services.json_response(self,404,{"error":"Rolle nicht gefunden."})
            if role["is_system"]:
                return self.services.json_response(self,409,{"error":"Systemrollen können nicht gelöscht werden."})
            assigned = conn.execute("SELECT COUNT(*) FROM users WHERE role_id=?",(role_id,)).fetchone()[0]
            if assigned:
                return self.services.json_response(self,409,{"error":"Die Rolle ist noch Benutzern zugewiesen."})
            self.services.audit_event(conn,current,"delete-permanent","role",role_id,f"Rolle {role['name']} gelöscht")
            conn.execute("DELETE FROM roles WHERE id=?",(role_id,))
        return self.services.json_response(self,200,{"ok":True})
    return False
