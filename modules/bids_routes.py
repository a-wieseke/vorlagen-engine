"""Bids routes. Return False only when no route matched.

The adapter owns sessions/CSRF and injects shared database/security services.
"""

def get(self, p, data):
    if p == "/api/bid/import-template":
        if not self.require_auth(permission="bid_questions_manage"): return
        with self.services.db() as conn:
            payload = self.services.bid_workbooks.make_template(conn)
        return self.services.binary_response(self,payload,self.services.bid_workbooks.MIME,"Bieterfragen_Vorlage.xlsx")
    if p == "/api/bid/categories":
        current = self.require_auth()
        if not current: return
        if not ({"bid_questions_view","bid_questions_manage","bid_answers_manage"} & set(self.services.permissions_from_row(current))):
            return self.services.json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
        with self.services.db() as conn:
            rows=conn.execute("SELECT * FROM bid_question_categories ORDER BY sort_order,name").fetchall()
        return self.services.json_response(self,200,{"categories":[self.services.bid_category_dict(row) for row in rows]})
    if p == "/api/bid/topics":
        current = self.require_auth()
        if not current: return
        if not ({"bid_questions_view","bid_questions_manage","bid_answers_manage"} & set(self.services.permissions_from_row(current))):
            return self.services.json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
        with self.services.db() as conn:
            rows=conn.execute("""SELECT * FROM bid_question_topics
                ORDER BY category_id,sort_order,name""").fetchall()
        return self.services.json_response(self,200,{"topics":[self.services.bid_topic_dict(row) for row in rows]})
    if p == "/api/bid/answers":
        current = self.require_auth()
        if not current: return
        if not ({"bid_questions_view","bid_questions_manage","bid_answers_manage"} & set(self.services.permissions_from_row(current))):
            return self.services.json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
        with self.services.db() as conn:
            rows=conn.execute("""SELECT a.*,t.category_id,t.name AS topic_name,c.name AS category_name
                FROM standard_bid_answers a JOIN bid_question_topics t ON t.id=a.topic_id
                JOIN bid_question_categories c ON c.id=t.category_id
                ORDER BY c.sort_order,t.sort_order,a.short_question""").fetchall()
            variant_rows=conn.execute("""SELECT * FROM standard_bid_answer_variants
                ORDER BY standard_answer_id,decision,sort_order,id""").fetchall()
        variants_by_answer={}
        for variant in variant_rows:
            variants_by_answer.setdefault(variant["standard_answer_id"],[]).append({
                "id":variant["id"],"decision":variant["decision"],"answer":variant["answer"],
                "short_description":variant["short_description"],"sort_order":variant["sort_order"]})
        return self.services.json_response(self,200,{"answers":[self.services.bid_answer_dict(
            row,variants_by_answer.get(row["id"],[])) for row in rows]})
    if p == "/api/bidders":
        current=self.require_auth()
        if not current:return
        if not ({"projects_view","bid_questions_view","bid_questions_manage"} & set(self.services.permissions_from_row(current))):
            return self.services.json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
        with self.services.db() as conn:
            rows=conn.execute("SELECT * FROM bidders ORDER BY active DESC,bidder COLLATE NOCASE").fetchall()
        return self.services.json_response(self,200,{"bidders":[self.services.bidder_dict(row) for row in rows]})
    if p == "/api/bidders/example-json":
        current=self.require_auth()
        if not current:return
        if "projects_view" not in self.services.permissions_from_row(current):
            return self.services.json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
        payload=self.services.json.dumps({"schema_version":"1.0","bidders":[{
            "bidder":"Bieter Musterstadt","company_name":"Muster GmbH",
            "street":"Musterstraße 1","postal_code":"12345","city":"Musterstadt",
            "country":"Deutschland","website":"https://example.com","comment":"Optionaler Kommentar"}]},
            ensure_ascii=False,indent=2).encode("utf-8")
        self.send_response(200);self.send_header("Content-Type","application/json; charset=utf-8")
        self.send_header("Content-Disposition",'attachment; filename="bieter-beispiel.json"')
        self.send_header("Content-Length",str(len(payload)));self.end_headers();self.wfile.write(payload);return
    if p == "/api/bid/questions":
        current = self.require_auth()
        if not current: return
        if not ({"bid_questions_view","bid_questions_manage"} & set(self.services.permissions_from_row(current))):
            return self.services.json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
        with self.services.db() as conn:
            rows=conn.execute("""SELECT bq.*,p.project_key,p.name AS project_name
                FROM bid_questions bq JOIN projects p ON p.id=bq.project_id
                ORDER BY bq.id DESC""").fetchall()
        return self.services.json_response(self,200,{"questions":[self.services.bid_question_dict(row) for row in rows]})
    return False

def post(self, p, data):
    if p in {"/api/bid/xlsx/preview", "/api/bid/xlsx/import"}:
        current = self.require_auth(permission="bid_questions_manage")
        if not current: return
        try:
            raw = self.services.base64.b64decode(str(data.get("content_base64", "")), validate=True)
            project_id, year = int(data.get("project_id") or 0), int(data.get("year") or 0)
            with self.services.db() as conn:
                # Validation and insertion share a write lock. A category
                # changed after the preview is rechecked before any insert.
                if p.endswith("/import"): conn.execute("BEGIN IMMEDIATE")
                preview = self.services.bid_workbooks.preview_import(conn, raw, project_id, year)
                if p.endswith("/preview"): return self.services.json_response(self,200,preview)
                if not preview["valid"]:
                    return self.services.json_response(self,400,{"error":"Die Datei enthält Fehler. Bitte die Vorschau erneut prüfen.","preview":preview})
                ids = self.services.bid_workbooks.commit_import(conn,preview,current["id"],self.services.now_iso())
                self.services.audit_event(conn,current,"import","bid-question","xlsx",f"{len(ids)} Bieterfrage(n), {preview['duplicates']} Duplikate übersprungen")
            return self.services.json_response(self,201,{"created":len(ids),"ids":ids,"skipped":preview["duplicates"]})
        except (ValueError, TypeError) as error:
            return self.services.json_response(self,400,{"error":str(error)})
    if p in {"/api/bidders","/api/bidders/import"}:
        current=self.require_auth(permission="projects_manage")
        if not current:return
        items=data.get("bidders",[data]) if isinstance(data,dict) else []
        if not isinstance(items,list) or not items or len(items)>1000:
            return self.services.json_response(self,400,{"error":"Bitte zwischen 1 und 1.000 Bieter übergeben."})
        normalized=[]
        for item in items:
            if not isinstance(item,dict):return self.services.json_response(self,400,{"error":"Ein Bieterdatensatz ist ungültig."})
            bidder=str(item.get("bidder","")).strip()[:300]
            if not bidder:return self.services.json_response(self,400,{"error":"Jeder Datensatz benötigt das Pflichtfeld Bieter."})
            normalized.append((bidder,str(item.get("company_name","")).strip()[:500],
                str(item.get("street","")).strip()[:500],str(item.get("postal_code","")).strip()[:30],
                str(item.get("city","")).strip()[:300],str(item.get("country","")).strip()[:200],
                str(item.get("website","")).strip()[:1000],str(item.get("comment","")).strip()[:10000],1 if item.get("active",True) else 0))
        with self.services.db() as conn:
            for item in normalized:
                conn.execute("""INSERT INTO bidders
                    (bidder,company_name,street,postal_code,city,country,website,comment,active,created_at,updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(bidder) DO UPDATE SET
                    company_name=excluded.company_name,street=excluded.street,
                    postal_code=excluded.postal_code,city=excluded.city,country=excluded.country,
                    website=excluded.website,comment=excluded.comment,active=excluded.active,updated_at=excluded.updated_at""",
                    (*item,self.services.now_iso(),self.services.now_iso()))
            self.services.audit_event(conn,current,"import" if len(normalized)>1 else "create","bidder","batch",
                f"{len(normalized)} Bieter gespeichert")
        return self.services.json_response(self,201,{"ok":True,"saved":len(normalized)})
    if p == "/api/bid/categories":
        current=self.require_auth(permission="bid_answers_manage")
        if not current:return
        name=str(data.get("name","")).strip()
        if not name:return self.services.json_response(self,400,{"error":"Ein Kategoriename ist erforderlich."})
        try:
            with self.services.db() as conn:
                order=conn.execute("SELECT COALESCE(MAX(sort_order),-1)+1 FROM bid_question_categories").fetchone()[0]
                cur=conn.execute("""INSERT INTO bid_question_categories(name,active,sort_order,created_at)
                    VALUES (?,?,?,?)""",(name,1 if data.get("active",True) else 0,order,self.services.now_iso()))
                self.services.audit_event(conn,current,"create","bid-category",cur.lastrowid,f"Bieterfragen-Kategorie {name} angelegt")
        except self.services.sqlite3.IntegrityError:
            return self.services.json_response(self,409,{"error":"Diese Kategorie existiert bereits."})
        return self.services.json_response(self,201,{"ok":True,"id":cur.lastrowid})
    if p == "/api/bid/topics":
        current=self.require_auth(permission="bid_answers_manage")
        if not current:return
        name=str(data.get("name","")).strip()
        try:category_id=int(data.get("category_id",0))
        except (TypeError,ValueError):category_id=0
        if not name or not category_id:return self.services.json_response(self,400,{"error":"Kategorie und Thema sind erforderlich."})
        try:
            with self.services.db() as conn:
                if not conn.execute("SELECT 1 FROM bid_question_categories WHERE id=?",(category_id,)).fetchone():
                    return self.services.json_response(self,400,{"error":"Die Kategorie wurde nicht gefunden."})
                order=conn.execute("SELECT COALESCE(MAX(sort_order),-1)+1 FROM bid_question_topics WHERE category_id=?",(category_id,)).fetchone()[0]
                cur=conn.execute("""INSERT INTO bid_question_topics(category_id,name,active,sort_order,created_at)
                    VALUES (?,?,?,?,?)""",(category_id,name,1 if data.get("active",True) else 0,order,self.services.now_iso()))
                self.services.audit_event(conn,current,"create","bid-topic",cur.lastrowid,f"Bieterfragen-Thema {name} angelegt")
        except self.services.sqlite3.IntegrityError:
            return self.services.json_response(self,409,{"error":"Dieses Thema existiert in der Kategorie bereits."})
        return self.services.json_response(self,201,{"ok":True,"id":cur.lastrowid})
    if p == "/api/bid/answers":
        current=self.require_auth(permission="bid_answers_manage")
        if not current:return
        try:topic_id=int(data.get("topic_id",0))
        except (TypeError,ValueError):topic_id=0
        short_question=str(data.get("short_question","")).strip()
        question=str(data.get("question","")).strip()
        agency_comment=str(data.get("agency_comment","")).strip()
        variants=data.get("variants",[])
        if not isinstance(variants,list):variants=[]
        if not variants and str(data.get("answer","")).strip():
            variants=[{"decision":str(data.get("decision","zugelassen")).strip().lower() or "zugelassen",
                       "answer":str(data.get("answer","")).strip()}]
        normalized_variants=[]
        for index,variant in enumerate(variants):
            if not isinstance(variant,dict):continue
            decision=str(variant.get("decision","")).strip().lower()
            answer=str(variant.get("answer","")).strip()
            if decision not in {"zugelassen","abgelehnt"} or not answer:
                return self.services.json_response(self,400,{"error":"Jede Antwortvariante benötigt eine Entscheidung und einen Antworttext."})
            normalized_variants.append((decision,str(variant.get("short_description","")).strip()[:300],answer,index))
        if not topic_id or not short_question or not normalized_variants:
            return self.services.json_response(self,400,{"error":"Thema, Kurzform der Frage und mindestens eine Antwortvariante sind erforderlich."})
        with self.services.db() as conn:
            if not conn.execute("SELECT 1 FROM bid_question_topics WHERE id=?",(topic_id,)).fetchone():
                return self.services.json_response(self,400,{"error":"Das Thema wurde nicht gefunden."})
            cur=conn.execute("""INSERT INTO standard_bid_answers
                (topic_id,short_question,question,answer,agency_comment,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?)""",
                (topic_id,short_question,question,normalized_variants[0][2],agency_comment,self.services.now_iso(),self.services.now_iso()))
            for decision,short_description,answer,order in normalized_variants:
                conn.execute("""INSERT INTO standard_bid_answer_variants
                    (standard_answer_id,decision,short_description,answer,sort_order,created_at,updated_at)
                    VALUES (?,?,?,?,?,?,?)""",(cur.lastrowid,decision,short_description,answer,order,self.services.now_iso(),self.services.now_iso()))
            self.services.audit_event(conn,current,"create","bid-answer",cur.lastrowid,f"Standardantwort {short_question} angelegt")
        return self.services.json_response(self,201,{"ok":True,"id":cur.lastrowid})
    if p == "/api/bid/questions":
        current=self.require_auth(permission="bid_questions_manage")
        if not current:return
        items=data.get("questions",[data])
        if not isinstance(items,list) or not items or len(items)>500:
            return self.services.json_response(self,400,{"error":"Bitte zwischen 1 und 500 Bieterfragen übergeben."})
        normalized=[]
        for item in items:
            if not isinstance(item,dict):return self.services.json_response(self,400,{"error":"Eine Bieterfrage ist ungültig."})
            try:project_id=int(item.get("project_id",0))
            except (TypeError,ValueError):project_id=0
            try:question_year=int(item.get("question_year",self.services.VERSION_YEAR))
            except (TypeError,ValueError):question_year=self.services.VERSION_YEAR
            if question_year<2000 or question_year>2100:return self.services.json_response(self,400,{"error":"Das Jahr muss zwischen 2000 und 2100 liegen."})
            question=str(item.get("question","")).strip()
            if not project_id or not question:
                return self.services.json_response(self,400,{"error":"Jede Bieterfrage benötigt ein Projekt und einen Fragetext."})
            try: category_id=int(item.get("category_id",0)) or None
            except (TypeError,ValueError): category_id=None
            try: topic_id=int(item.get("topic_id",0)) or None
            except (TypeError,ValueError): topic_id=None
            decision=str(item.get("decision","")).strip().lower()
            if decision not in {"","zugelassen","abgelehnt"}:
                return self.services.json_response(self,400,{"error":"Die Entscheidung muss zugelassen oder abgelehnt sein."})
            try:bidder_id=int(item.get("bidder_id",0)) or None
            except (TypeError,ValueError):bidder_id=None
            try:standard_answer_id=int(item.get("standard_answer_id",0)) or None
            except (TypeError,ValueError):standard_answer_id=None
            try:standard_variant_id=int(item.get("standard_variant_id",0)) or None
            except (TypeError,ValueError):standard_variant_id=None
            normalized.append((project_id,str(item.get("category","")).strip()[:300],
                str(item.get("bidder","")).strip()[:500],str(item.get("subject","")).strip()[:500],
                question,str(item.get("agency_comment","")).strip(),decision,
                str(item.get("answer","")).strip(),category_id,topic_id,bidder_id,
                standard_answer_id,standard_variant_id,question_year))
        with self.services.db() as conn:
            project_ids={row[0] for row in conn.execute("SELECT id FROM projects WHERE archived=0").fetchall()}
            if any(item[0] not in project_ids for item in normalized):
                return self.services.json_response(self,400,{"error":"Mindestens ein Projekt wurde nicht gefunden oder ist archiviert."})
            ids=[]
            for item in normalized:
                category_id,topic_id=item[8],item[9]
                if topic_id:
                    topic=conn.execute("""SELECT t.id,t.name,t.category_id,c.name AS category_name
                        FROM bid_question_topics t JOIN bid_question_categories c ON c.id=t.category_id
                        WHERE t.id=?""",(topic_id,)).fetchone()
                    if not topic:return self.services.json_response(self,400,{"error":"Mindestens ein Thema wurde nicht gefunden."})
                    if category_id and category_id!=topic["category_id"]:
                        return self.services.json_response(self,400,{"error":"Thema und Fragenkategorie passen nicht zusammen."})
                    category_id=topic["category_id"]
                    item=list(item);item[1]=topic["category_name"];item[3]=topic["name"];item[8]=category_id;item=tuple(item)
                elif category_id:
                    category=conn.execute("SELECT name FROM bid_question_categories WHERE id=?",(category_id,)).fetchone()
                    if not category:return self.services.json_response(self,400,{"error":"Mindestens eine Fragenkategorie wurde nicht gefunden."})
                    item=list(item);item[1]=category["name"];item=tuple(item)
                bidder_id,standard_answer_id,standard_variant_id=item[10],item[11],item[12]
                if bidder_id:
                    bidder=conn.execute("SELECT bidder FROM bidders WHERE id=? AND active=1",(bidder_id,)).fetchone()
                    if not bidder:return self.services.json_response(self,400,{"error":"Mindestens ein Bieter wurde nicht gefunden."})
                    item=list(item);item[2]=bidder["bidder"];item=tuple(item)
                if standard_variant_id:
                    variant=conn.execute("""SELECT v.id,v.standard_answer_id,v.decision
                        FROM standard_bid_answer_variants v WHERE v.id=?""",(standard_variant_id,)).fetchone()
                    if not variant or (standard_answer_id and variant["standard_answer_id"]!=standard_answer_id):
                        return self.services.json_response(self,400,{"error":"Die gewählte Antwortvariante ist ungültig."})
                    standard_answer_id=variant["standard_answer_id"]
                    item=list(item);item[11]=standard_answer_id;item=tuple(item)
                cur=conn.execute("""INSERT INTO bid_questions
                    (project_id,category,bidder,subject,question,agency_comment,decision,answer,
                     category_id,topic_id,bidder_id,standard_answer_id,standard_variant_id,question_year,
                     created_by,created_at,updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",(*item,current["id"],self.services.now_iso(),self.services.now_iso()))
                ids.append(cur.lastrowid)
            self.services.audit_event(conn,current,"create","bid-question","batch",f"{len(ids)} Bieterfrage(n) erfasst")
        return self.services.json_response(self,201,{"ok":True,"ids":ids,"created":len(ids)})
    return False

def put(self, p, data):
    m=self.services.re.fullmatch(r"/api/bid/categories/(\d+)",p)
    if m:
        current=self.require_auth(permission="bid_answers_manage")
        if not current:return
        name=str(data.get("name","")).strip()
        if not name:return self.services.json_response(self,400,{"error":"Ein Kategoriename ist erforderlich."})
        try:
            with self.services.db() as conn:
                cur=conn.execute("UPDATE bid_question_categories SET name=?,active=? WHERE id=?",
                    (name,1 if data.get("active",True) else 0,int(m.group(1))))
                if not cur.rowcount:return self.services.json_response(self,404,{"error":"Kategorie wurde nicht gefunden."})
                self.services.audit_event(conn,current,"update","bid-category",m.group(1),f"Bieterfragen-Kategorie {name} geändert")
        except self.services.sqlite3.IntegrityError:return self.services.json_response(self,409,{"error":"Diese Kategorie existiert bereits."})
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/bid/topics/(\d+)",p)
    if m:
        current=self.require_auth(permission="bid_answers_manage")
        if not current:return
        name=str(data.get("name","")).strip()
        try:category_id=int(data.get("category_id",0))
        except (TypeError,ValueError):category_id=0
        if not name or not category_id:return self.services.json_response(self,400,{"error":"Kategorie und Thema sind erforderlich."})
        try:
            with self.services.db() as conn:
                existing=conn.execute("SELECT category_id,sort_order FROM bid_question_topics WHERE id=?",(int(m.group(1)),)).fetchone()
                if not existing:return self.services.json_response(self,404,{"error":"Thema wurde nicht gefunden."})
                order=existing["sort_order"] if existing["category_id"]==category_id else conn.execute(
                    "SELECT COALESCE(MAX(sort_order),-1)+1 FROM bid_question_topics WHERE category_id=?",(category_id,)).fetchone()[0]
                conn.execute("UPDATE bid_question_topics SET category_id=?,name=?,active=?,sort_order=? WHERE id=?",
                    (category_id,name,1 if data.get("active",True) else 0,order,int(m.group(1))))
                self.services.audit_event(conn,current,"update","bid-topic",m.group(1),f"Bieterfragen-Thema {name} geändert")
        except self.services.sqlite3.IntegrityError:return self.services.json_response(self,409,{"error":"Dieses Thema existiert in der Kategorie bereits."})
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/bid/answers/(\d+)",p)
    if m:
        current=self.require_auth(permission="bid_answers_manage")
        if not current:return
        try:topic_id=int(data.get("topic_id",0))
        except (TypeError,ValueError):topic_id=0
        short_question=str(data.get("short_question","")).strip();question=str(data.get("question","")).strip()
        agency_comment=str(data.get("agency_comment","")).strip();variants=data.get("variants",[])
        if not isinstance(variants,list):variants=[]
        if not variants and str(data.get("answer","")).strip():
            variants=[{"decision":str(data.get("decision","zugelassen")).strip().lower() or "zugelassen",
                       "answer":str(data.get("answer","")).strip()}]
        normalized_variants=[]
        for index,variant in enumerate(variants):
            if not isinstance(variant,dict):continue
            decision=str(variant.get("decision","")).strip().lower();answer=str(variant.get("answer","")).strip()
            if decision not in {"zugelassen","abgelehnt"} or not answer:
                return self.services.json_response(self,400,{"error":"Jede Antwortvariante benötigt eine Entscheidung und einen Antworttext."})
            normalized_variants.append((decision,str(variant.get("short_description","")).strip()[:300],answer,index))
        if not topic_id or not short_question or not normalized_variants:
            return self.services.json_response(self,400,{"error":"Thema, Kurzform und mindestens eine Antwortvariante sind erforderlich."})
        with self.services.db() as conn:
            answer_id=int(m.group(1))
            cur=conn.execute("""UPDATE standard_bid_answers SET topic_id=?,short_question=?,question=?,answer=?,agency_comment=?,updated_at=? WHERE id=?""",
                (topic_id,short_question,question,normalized_variants[0][2],agency_comment,self.services.now_iso(),answer_id))
            if not cur.rowcount:return self.services.json_response(self,404,{"error":"Standardantwort wurde nicht gefunden."})
            conn.execute("DELETE FROM standard_bid_answer_variants WHERE standard_answer_id=?",(answer_id,))
            for decision,short_description,answer,order in normalized_variants:
                conn.execute("""INSERT INTO standard_bid_answer_variants
                    (standard_answer_id,decision,short_description,answer,sort_order,created_at,updated_at)
                    VALUES (?,?,?,?,?,?,?)""",(answer_id,decision,short_description,answer,order,self.services.now_iso(),self.services.now_iso()))
            self.services.audit_event(conn,current,"update","bid-answer",m.group(1),f"Standardantwort {short_question} geändert")
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/bidders/(\d+)",p)
    if m:
        current=self.require_auth(permission="projects_manage")
        if not current:return
        bidder=str(data.get("bidder","")).strip()[:300]
        if not bidder:return self.services.json_response(self,400,{"error":"Das Pflichtfeld Bieter darf nicht leer sein."})
        fields=(bidder,str(data.get("company_name","")).strip()[:500],str(data.get("street","")).strip()[:500],
            str(data.get("postal_code","")).strip()[:30],str(data.get("city","")).strip()[:300],
            str(data.get("country","")).strip()[:200],str(data.get("website","")).strip()[:1000],str(data.get("comment","")).strip()[:10000],
            1 if data.get("active",True) else 0,self.services.now_iso(),int(m.group(1)))
        try:
            with self.services.db() as conn:
                cur=conn.execute("""UPDATE bidders SET bidder=?,company_name=?,street=?,postal_code=?,city=?,country=?,website=?,comment=?,active=?,updated_at=? WHERE id=?""",fields)
                if not cur.rowcount:return self.services.json_response(self,404,{"error":"Bieter wurde nicht gefunden."})
                self.services.audit_event(conn,current,"update","bidder",m.group(1),f"Bieter {bidder} geändert")
        except self.services.sqlite3.IntegrityError:return self.services.json_response(self,409,{"error":"Dieser Bieter existiert bereits."})
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/bid/questions/(\d+)",p)
    if m:
        current=self.require_auth(permission="bid_questions_manage")
        if not current:return
        try:project_id=int(data.get("project_id",0))
        except (TypeError,ValueError):project_id=0
        try:question_year=int(data.get("question_year",self.services.VERSION_YEAR))
        except (TypeError,ValueError):question_year=self.services.VERSION_YEAR
        if question_year<2000 or question_year>2100:return self.services.json_response(self,400,{"error":"Das Jahr muss zwischen 2000 und 2100 liegen."})
        question=str(data.get("question","")).strip()
        if not project_id or not question:return self.services.json_response(self,400,{"error":"Projekt und Fragetext sind erforderlich."})
        try:category_id=int(data.get("category_id",0)) or None
        except (TypeError,ValueError):category_id=None
        try:topic_id=int(data.get("topic_id",0)) or None
        except (TypeError,ValueError):topic_id=None
        decision=str(data.get("decision","")).strip().lower()
        if decision not in {"","zugelassen","abgelehnt"}:return self.services.json_response(self,400,{"error":"Die Entscheidung muss zugelassen oder abgelehnt sein."})
        with self.services.db() as conn:
            existing=conn.execute("SELECT answer FROM bid_questions WHERE id=?",(int(m.group(1)),)).fetchone()
            if not existing:return self.services.json_response(self,404,{"error":"Bieterfrage wurde nicht gefunden."})
            category_name=str(data.get("category","")).strip()[:300];topic_name=str(data.get("subject","")).strip()[:500]
            if topic_id:
                topic=conn.execute("""SELECT t.name,t.category_id,c.name AS category_name FROM bid_question_topics t
                    JOIN bid_question_categories c ON c.id=t.category_id WHERE t.id=?""",(topic_id,)).fetchone()
                if not topic:return self.services.json_response(self,400,{"error":"Das Thema wurde nicht gefunden."})
                if category_id and category_id!=topic["category_id"]:return self.services.json_response(self,400,{"error":"Thema und Fragenkategorie passen nicht zusammen."})
                category_id=topic["category_id"];category_name=topic["category_name"];topic_name=topic["name"]
            new_answer=str(data.get("answer","")).strip()
            try:bidder_id=int(data.get("bidder_id",0)) or None
            except (TypeError,ValueError):bidder_id=None
            try:standard_answer_id=int(data.get("standard_answer_id",0)) or None
            except (TypeError,ValueError):standard_answer_id=None
            try:standard_variant_id=int(data.get("standard_variant_id",0)) or None
            except (TypeError,ValueError):standard_variant_id=None
            bidder_name=str(data.get("bidder","")).strip()[:500]
            if bidder_id:
                bidder=conn.execute("SELECT bidder FROM bidders WHERE id=? AND active=1",(bidder_id,)).fetchone()
                if not bidder:return self.services.json_response(self,400,{"error":"Der Bieter wurde nicht gefunden."})
                bidder_name=bidder["bidder"]
            if standard_variant_id:
                variant=conn.execute("SELECT standard_answer_id FROM standard_bid_answer_variants WHERE id=?",(standard_variant_id,)).fetchone()
                if not variant or (standard_answer_id and variant["standard_answer_id"]!=standard_answer_id):
                    return self.services.json_response(self,400,{"error":"Die gewählte Antwortvariante ist ungültig."})
                standard_answer_id=variant["standard_answer_id"]
            clear_ack=existing["answer"]!=new_answer
            cur=conn.execute("""UPDATE bid_questions SET project_id=?,category=?,bidder=?,subject=?,question=?,agency_comment=?,decision=?,answer=?,category_id=?,topic_id=?,bidder_id=?,standard_answer_id=?,standard_variant_id=?,question_year=?,answered_at=CASE WHEN ? THEN NULL ELSE answered_at END,answered_by=CASE WHEN ? THEN NULL ELSE answered_by END,updated_at=? WHERE id=?""",
                (project_id,category_name,bidder_name,topic_name,question,
                 str(data.get("agency_comment","")).strip(),decision,new_answer,category_id,topic_id,
                 bidder_id,standard_answer_id,standard_variant_id,question_year,
                 1 if clear_ack else 0,1 if clear_ack else 0,self.services.now_iso(),int(m.group(1))))
            if not cur.rowcount:return self.services.json_response(self,404,{"error":"Bieterfrage wurde nicht gefunden."})
            self.services.audit_event(conn,current,"update","bid-question",m.group(1),"Bieterfrage geändert")
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/bid/questions/(\d+)/acknowledge",p)
    if m:
        current=self.require_auth(permission="bid_questions_manage")
        if not current:return
        with self.services.db() as conn:
            row=conn.execute("SELECT answer FROM bid_questions WHERE id=?",(int(m.group(1)),)).fetchone()
            if not row:return self.services.json_response(self,404,{"error":"Bieterfrage wurde nicht gefunden."})
            if not str(row["answer"] or "").strip():return self.services.json_response(self,409,{"error":"Vor der Quittierung muss eine Antwort erstellt werden."})
            conn.execute("UPDATE bid_questions SET answered_at=?,answered_by=?,updated_at=? WHERE id=?",
                (self.services.now_iso(),current["id"],self.services.now_iso(),int(m.group(1))))
            self.services.audit_event(conn,current,"acknowledge","bid-question",m.group(1),"Beantwortung quittiert")
        return self.services.json_response(self,200,{"ok":True})
    if p == "/api/bid/categories/order":
        if not self.require_auth(permission="bid_answers_manage"):return
        try:ids=[int(value) for value in data.get("ids",[])]
        except (TypeError,ValueError):return self.services.json_response(self,400,{"error":"Ungültige Reihenfolge."})
        with self.services.db() as conn:
            existing={row[0] for row in conn.execute("SELECT id FROM bid_question_categories").fetchall()}
            if set(ids)!=existing or len(ids)!=len(existing):return self.services.json_response(self,400,{"error":"Die Reihenfolge ist unvollständig."})
            for order,item_id in enumerate(ids):conn.execute("UPDATE bid_question_categories SET sort_order=? WHERE id=?",(order,item_id))
        return self.services.json_response(self,200,{"ok":True})
    if p == "/api/bid/topics/order":
        if not self.require_auth(permission="bid_answers_manage"):return
        try:category_id=int(data.get("category_id",0));ids=[int(value) for value in data.get("ids",[])]
        except (TypeError,ValueError):return self.services.json_response(self,400,{"error":"Ungültige Reihenfolge."})
        with self.services.db() as conn:
            existing={row[0] for row in conn.execute("SELECT id FROM bid_question_topics WHERE category_id=?",(category_id,)).fetchall()}
            if set(ids)!=existing or len(ids)!=len(existing):return self.services.json_response(self,400,{"error":"Die Reihenfolge ist unvollständig."})
            for order,item_id in enumerate(ids):conn.execute("UPDATE bid_question_topics SET sort_order=? WHERE id=? AND category_id=?",(order,item_id,category_id))
        return self.services.json_response(self,200,{"ok":True})
    return False

def delete(self, p, data):
    m=self.services.re.fullmatch(r"/api/bidders/(\d+)",p)
    if m:
        current=self.require_auth(permission="projects_manage")
        if not current:return
        with self.services.db() as conn:
            used=conn.execute("SELECT COUNT(*) FROM bid_questions WHERE bidder_id=?",(int(m.group(1)),)).fetchone()[0]
            if used:return self.services.json_response(self,409,{"error":"Der Bieter wird bereits in Bieterfragen verwendet und kann nur deaktiviert werden."})
            cur=conn.execute("DELETE FROM bidders WHERE id=?",(int(m.group(1)),))
            if not cur.rowcount:return self.services.json_response(self,404,{"error":"Bieter wurde nicht gefunden."})
            self.services.audit_event(conn,current,"delete-permanent","bidder",m.group(1),"Bieter gelöscht")
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/bid/questions/(\d+)",p)
    if m:
        current=self.require_auth(permission="bid_questions_manage")
        if not current:return
        with self.services.db() as conn:
            cur=conn.execute("DELETE FROM bid_questions WHERE id=?",(int(m.group(1)),))
            if not cur.rowcount:return self.services.json_response(self,404,{"error":"Bieterfrage wurde nicht gefunden."})
            self.services.audit_event(conn,current,"delete-permanent","bid-question",m.group(1),"Bieterfrage gelöscht")
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/bid/answers/(\d+)",p)
    if m:
        current=self.require_auth(permission="bid_answers_manage")
        if not current:return
        with self.services.db() as conn:
            cur=conn.execute("DELETE FROM standard_bid_answers WHERE id=?",(int(m.group(1)),))
            if not cur.rowcount:return self.services.json_response(self,404,{"error":"Standardantwort wurde nicht gefunden."})
            self.services.audit_event(conn,current,"delete-permanent","bid-answer",m.group(1),"Standardantwort gelöscht")
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/bid/topics/(\d+)",p)
    if m:
        current=self.require_auth(permission="bid_answers_manage")
        if not current:return
        with self.services.db() as conn:
            count=conn.execute("SELECT COUNT(*) FROM standard_bid_answers WHERE topic_id=?",(int(m.group(1)),)).fetchone()[0]
            if count:return self.services.json_response(self,409,{"error":"Das Thema enthält noch Standardantworten."})
            conn.execute("DELETE FROM bid_question_topics WHERE id=?",(int(m.group(1)),))
            self.services.audit_event(conn,current,"delete-permanent","bid-topic",m.group(1),"Bieterfragen-Thema gelöscht")
        return self.services.json_response(self,200,{"ok":True})
    m=self.services.re.fullmatch(r"/api/bid/categories/(\d+)",p)
    if m:
        current=self.require_auth(permission="bid_answers_manage")
        if not current:return
        with self.services.db() as conn:
            count=conn.execute("SELECT COUNT(*) FROM bid_question_topics WHERE category_id=?",(int(m.group(1)),)).fetchone()[0]
            if count:return self.services.json_response(self,409,{"error":"Die Kategorie enthält noch Themen."})
            conn.execute("DELETE FROM bid_question_categories WHERE id=?",(int(m.group(1)),))
            self.services.audit_event(conn,current,"delete-permanent","bid-category",m.group(1),"Bieterfragen-Kategorie gelöscht")
        return self.services.json_response(self,200,{"ok":True})
    return False
