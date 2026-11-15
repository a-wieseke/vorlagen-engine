import base64
import http.cookiejar
import importlib.util
import json
import io
import tempfile
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from docx import Document
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("wve_app", ROOT / "app.py")
app = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(app)


class LoginEndToEndTest(unittest.TestCase):
    csrf_tokens = {}
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        app.DB_PATH = Path(cls.temp_dir.name) / "test.db"
        app.SESSIONS.clear()
        app.init_db()
        cls.server = app.ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
        cls.base_url = f"http://127.0.0.1:{cls.server.server_address[1]}"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)
        cls.temp_dir.cleanup()

    def new_client(self):
        jar = http.cookiejar.CookieJar()
        return urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(jar)
        ), jar

    def authenticated_client(self):
        client, jar = self.new_client()
        form = urllib.parse.urlencode(
            {"username": "admin", "password": "Admin12345!"}
        ).encode()
        client.open(
            urllib.request.Request(
                self.base_url + "/login",
                data=form,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        )
        me = json.load(client.open(self.base_url + "/api/me"))
        self.csrf_tokens[id(client)] = me["csrf_token"]
        return client, jar

    def json_request(self, client, path, method="GET", payload=None):
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        headers={"Content-Type": "application/json"}
        if method not in {"GET","HEAD","OPTIONS"}:
            token=self.csrf_tokens.get(id(client))
            if not token:
                token=json.load(client.open(self.base_url + "/api/me"))["csrf_token"]
                self.csrf_tokens[id(client)]=token
            headers["X-CSRF-Token"]=token
        request = urllib.request.Request(
            self.base_url + path,
            data=body,
            method=method,
            headers=headers,
        )
        return json.load(client.open(request))

    def test_valid_login_sets_session_and_opens_protected_start(self):
        client, jar = self.new_client()
        form = urllib.parse.urlencode(
            {"username": "admin", "password": "Admin12345!"}
        ).encode()
        response = client.open(
            urllib.request.Request(
                self.base_url + "/login",
                data=form,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        )

        self.assertEqual(response.status, 200)
        self.assertEqual(response.geturl(), self.base_url + "/")
        self.assertTrue(any(cookie.name == "wve_session" for cookie in jar))

        me = json.load(client.open(self.base_url + "/api/me"))
        self.assertEqual(me["user"]["username"], "admin")
        self.assertEqual(me["user"]["role"], "admin")
        self.assertFalse(me["user"]["must_change"])

    def test_invalid_login_is_rejected(self):
        client, jar = self.new_client()
        form = urllib.parse.urlencode(
            {"username": "admin", "password": "falsch"}
        ).encode()
        response = client.open(
            urllib.request.Request(
                self.base_url + "/login",
                data=form,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        )

        self.assertIn("login_error=1", response.geturl())
        self.assertFalse(any(cookie.name == "wve_session" for cookie in jar))

    def test_login_view_can_really_be_hidden(self):
        css = (ROOT / "static" / "style.css").read_text(encoding="utf-8")
        self.assertIn("[hidden]{display:none!important}", css)

    def test_variable_catalog_can_be_created_changed_and_deleted(self):
        client, _ = self.authenticated_client()
        created = self.json_request(client, "/api/variables", "POST", {
            "key": "eingabe.testwert", "label": "Testwert", "type": "text",
            "source": "manual", "required": True, "active": True,
        })
        variable_id = created["id"]
        self.json_request(client, f"/api/variables/{variable_id}", "PUT", {
            "key": "eingabe.testwert", "label": "Geänderter Testwert",
            "type": "textarea", "source": "manual",
            "required": False, "active": True,
        })
        variables = self.json_request(client, "/api/variables")["variables"]
        changed = next(item for item in variables if item["id"] == variable_id)
        self.assertEqual(changed["label"], "Geänderter Testwert")
        self.assertEqual(changed["type"], "textarea")
        self.json_request(client, f"/api/variables/{variable_id}", "DELETE")

    def test_excel_import_route_survives_login(self):
        client, jar = self.new_client()
        self.assertIn("Projekt aus Excel", client.open(self.base_url + "/excel-import").read().decode("utf-8"))
        form = urllib.parse.urlencode({
            "username": "admin", "password": "Admin12345!", "next": "/excel-import"
        }).encode()
        response = client.open(urllib.request.Request(
            self.base_url + "/login", data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        ))
        self.assertEqual(response.geturl(), self.base_url + "/excel-import")
        self.assertTrue(any(cookie.name == "wve_session" for cookie in jar))

    def test_password_policy_can_be_exempted_per_user(self):
        client, _ = self.authenticated_client()
        role_id = next(role["id"] for role in self.json_request(client, "/api/roles")["roles"]
                       if role["name"] == "Benutzer")
        created = self.json_request(client, "/api/users", "POST", {
            "username": "ausnahme", "first_name": "Policy", "last_name": "Ausnahme",
            "email": "", "role_id": role_id, "password_policy_exempt": True,
        })
        self.assertEqual(created["username"], "ausnahme")
        user = next(item for item in self.json_request(client, "/api/users")["users"]
                    if item["username"] == "ausnahme")
        self.assertTrue(user["password_policy_exempt"])
        self.json_request(client, f'/api/users/{user["id"]}/password', "PUT", {
            "new_password": "kurz"
        })

    def test_manual_project_payload_is_persisted(self):
        client, _ = self.authenticated_client()
        payload = {
            "schema_version": "1.0",
            "projekt": {"id": "TEST-001", "bezeichnung": "Manuelles Projekt"},
            "auftraggeber": {"name": "Beispielstadt"},
            "kontakte": [{"anrede": "Guten Tag Frau Beispiel", "email": "test@example.de"}],
        }
        self.json_request(client, "/api/projects", "POST", {"data": payload})
        projects = self.json_request(client, "/api/projects")["projects"]
        project = next(item for item in projects if item["project_key"] == "TEST-001")
        self.assertEqual(project["data"]["kontakte"][0]["email"], "test@example.de")

    def test_admin_can_set_password_and_regenerate_recovery_code(self):
        client, _ = self.authenticated_client()
        username = "funktionstest"
        roles = self.json_request(client, "/api/roles")["roles"]
        user_role_id = next(role["id"] for role in roles if role["name"] == "Benutzer")
        self.json_request(client, "/api/users", "POST", {
            "username": username, "first_name": "Funktions", "last_name": "Test",
            "email": "", "role_id": user_role_id,
        })
        users = self.json_request(client, "/api/users")["users"]
        user_id = next(item["id"] for item in users if item["username"] == username)
        self.json_request(client, f"/api/users/{user_id}/password", "PUT", {
            "new_password": "NeuesPasswort123!"
        })
        recovery = self.json_request(client, f"/api/users/{user_id}/recovery", "PUT", {})
        self.assertRegex(recovery["recovery_code"], r"^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$")

        user_client, _ = self.new_client()
        form = urllib.parse.urlencode({
            "username": username, "password": "NeuesPasswort123!"
        }).encode()
        response = user_client.open(urllib.request.Request(
            self.base_url + "/login", data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        ))
        self.assertEqual(response.geturl(), self.base_url + "/")

    def test_settings_are_saved_and_publicly_available(self):
        client, _ = self.authenticated_client()
        changed = self.json_request(client, "/api/settings", "PUT", {
            "app_name": "Test Vorlagen-Engine", "logo_data": ""
        })
        self.assertEqual(changed["settings"]["app_name"], "Test Vorlagen-Engine")
        public_client, _ = self.new_client()
        public = self.json_request(public_client, "/api/public-settings")
        self.assertEqual(public["settings"]["app_name"], "Test Vorlagen-Engine")

    def test_frontend_uses_percent_encoding_and_copies_only_body(self):
        script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        mailto_section = script.split("function openMailto()", 1)[1].split(
            "function downloadEml()", 1
        )[0]
        copy_section = script.split("async function copyResult()", 1)[1].split(
            "function newTemplate(", 1
        )[0]
        self.assertIn("mailtoEncode", mailto_section)
        self.assertNotIn("URLSearchParams", mailto_section)
        self.assertIn("getEditorHtml(resultBody)", copy_section)
        self.assertIn('"text/html"', copy_section)
        self.assertIn('"text/plain"', copy_section)
        self.assertNotIn("resultTo.value", copy_section)
        self.assertNotIn("resultSubject.value", copy_section)

    def test_custom_role_controls_permissions_and_category_access(self):
        admin, _ = self.authenticated_client()
        templates = self.json_request(admin, "/api/templates")["templates"]
        allowed_template = templates[0]
        allowed_category_id = allowed_template["category_id"]
        created_role = self.json_request(admin, "/api/roles", "POST", {
            "name": "Nur eine Kategorie",
            "permissions": ["email_create"],
            "all_categories": False,
            "category_ids": [allowed_category_id],
        })
        role_id = created_role["id"]
        created_user = self.json_request(admin, "/api/users", "POST", {
            "username": "rollen_test", "first_name": "Rollen", "last_name": "Test",
            "email": "", "role_id": role_id,
        })

        role_client, _ = self.new_client()
        form = urllib.parse.urlencode({
            "username": "rollen_test",
            "password": created_user["temporary_password"],
        }).encode()
        role_client.open(urllib.request.Request(
            self.base_url + "/login", data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        ))
        me = self.json_request(role_client, "/api/me")["user"]
        self.assertEqual(me["permissions"], ["email_create"])
        visible_templates = self.json_request(role_client, "/api/templates")["templates"]
        self.assertTrue(visible_templates)
        self.assertTrue(all(item["category_id"] == allowed_category_id for item in visible_templates))
        with self.assertRaises(urllib.error.HTTPError) as denied:
            self.json_request(role_client, "/api/projects")
        self.assertEqual(denied.exception.code, 403)

        self.json_request(admin, f"/api/roles/{role_id}", "PUT", {
            "name": "Eine Kategorie mit Projekten",
            "permissions": ["email_create", "projects_view"],
            "all_categories": False,
            "category_ids": [allowed_category_id],
        })
        projects = self.json_request(role_client, "/api/projects")
        self.assertIn("projects", projects)

    def test_project_overview_and_project_creation_are_separate_pages(self):
        html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        self.assertIn('id="tab-project-overview"', html)
        self.assertIn('id="tab-project-create"', html)
        overview = html.split('id="tab-project-overview"', 1)[1].split(
            'id="tab-project-create"', 1
        )[0]
        self.assertIn('id="projectList"', overview)
        self.assertNotIn('id="jsonPaste"', overview)

    def test_template_fields_are_always_rendered_for_stored_projects(self):
        script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        section = script.split("function renderManualFields()", 1)[1].split(
            "function renderText", 1
        )[0]
        self.assertIn('input.value=existing||""', section)
        self.assertNotIn("mustEnter", section)
        self.assertNotIn('definition.source==="user"', section)

    def test_category_access_filters_templates_and_dashboard(self):
        admin, _ = self.authenticated_client()
        categories = self.json_request(admin, "/api/categories")["categories"]
        self.assertGreaterEqual(len(categories), 2)
        allowed_category = categories[0]
        templates = self.json_request(admin, "/api/templates")["templates"]
        self.assertTrue(all(item["category_id"] for item in templates))

        role = self.json_request(admin, "/api/roles", "POST", {
            "name": "Kategorie eingeschränkt",
            "permissions": ["email_create"],
            "all_categories": False,
            "category_ids": [allowed_category["id"]],
        })
        user = self.json_request(admin, "/api/users", "POST", {
            "username": "kategorie_test", "first_name": "Kategorie",
            "last_name": "Test", "email": "", "role_id": role["id"],
        })
        client, _ = self.new_client()
        form = urllib.parse.urlencode({
            "username": "kategorie_test", "password": user["temporary_password"]
        }).encode()
        client.open(urllib.request.Request(
            self.base_url + "/login", data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        ))
        visible_categories = self.json_request(client, "/api/categories")["categories"]
        self.assertEqual([item["id"] for item in visible_categories], [allowed_category["id"]])
        visible_templates = self.json_request(client, "/api/templates")["templates"]
        self.assertTrue(visible_templates)
        self.assertTrue(all(item["category_id"] == allowed_category["id"] for item in visible_templates))

        tile = self.json_request(client, "/api/dashboard", "POST", {
            "category_id": allowed_category["id"]
        })
        dashboard = self.json_request(client, "/api/dashboard")["tiles"]
        self.assertEqual(dashboard[0]["id"], tile["id"])
        self.assertEqual(dashboard[0]["category"]["id"], allowed_category["id"])

    def test_project_can_be_updated_from_overview(self):
        client, _ = self.authenticated_client()
        original = {
            "schema_version": "1.0",
            "projekt": {"id": "EDIT-001", "bezeichnung": "Vorher"},
            "auftraggeber": {"name": "Alt"},
            "kontakte": [{"email": "alt@example.de"}],
        }
        changed = json.loads(json.dumps(original))
        changed["projekt"]["bezeichnung"] = "Nachher"
        changed["kontakte"][0]["email"] = "neu@example.de"
        self.json_request(client, "/api/projects", "POST", {"data": original})
        self.json_request(client, "/api/projects", "POST", {"data": changed})
        project = next(item for item in self.json_request(client, "/api/projects")["projects"]
                       if item["project_key"] == "EDIT-001")
        self.assertEqual(project["data"]["projekt"]["bezeichnung"], "Nachher")
        self.assertEqual(project["data"]["kontakte"][0]["email"], "neu@example.de")

    def test_direct_template_link_survives_login(self):
        admin, _ = self.authenticated_client()
        template_id = self.json_request(admin, "/api/templates")["templates"][0]["id"]
        client, jar = self.new_client()
        direct_path = f"/vorlage/{template_id}"
        page = client.open(self.base_url + direct_path)
        self.assertEqual(page.status, 200)
        self.assertIn(b'id="loginNext"', page.read())
        form = urllib.parse.urlencode({
            "username": "admin", "password": "Admin12345!", "next": direct_path
        }).encode()
        response = client.open(urllib.request.Request(
            self.base_url + "/login", data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        ))
        self.assertEqual(response.geturl(), self.base_url + direct_path)
        self.assertTrue(any(cookie.name == "wve_session" for cookie in jar))

    def test_category_order_can_be_changed(self):
        client, _ = self.authenticated_client()
        before = self.json_request(client, "/api/categories")["categories"]
        reversed_ids = [item["id"] for item in reversed(before)]
        self.json_request(client, "/api/categories/order", "PUT", {
            "category_ids": reversed_ids
        })
        after = self.json_request(client, "/api/categories")["categories"]
        self.assertEqual([item["id"] for item in after], reversed_ids)
        template_category_order = []
        for template in self.json_request(client, "/api/templates")["templates"]:
            if template["category_id"] not in template_category_order:
                template_category_order.append(template["category_id"])
        expected_template_order = [
            category_id for category_id in reversed_ids
            if category_id in template_category_order
        ]
        self.assertEqual(template_category_order, expected_template_order)

    def test_frontend_has_project_search_mode_buttons_and_three_column_dashboard(self):
        html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "static" / "style.css").read_text(encoding="utf-8")
        self.assertIn('id="modeProjectButton"', html)
        self.assertIn('id="modeManualButton"', html)
        self.assertIn('id="projectPickerSearch"', html)
        self.assertIn('id="projectOverviewSearch"', html)
        self.assertIn(".includes(needle)", script)
        self.assertIn("grid-template-columns:repeat(3,minmax(0,1fr))", css)
        self.assertNotIn('id="roleTemplateEditor"', html)

    def test_template_notice_and_custom_placeholder_are_persisted(self):
        client, _ = self.authenticated_client()
        category_id = self.json_request(client, "/api/categories")["categories"][0]["id"]
        created = self.json_request(client, "/api/templates", "POST", {
            "name": "Hinweis-Funktionstest",
            "category_id": category_id,
            "subject": "Test {{eingabe.freigabecode}}",
            "body": "Bitte {{eingabe.freigabecode}} beachten.",
            "notice_text": "Vor dem Versand die Freigabe prüfen.",
            "notice_html": "<p><strong>Vor dem Versand</strong></p><ul><li>Anlage prüfen</li></ul>",
            "notice_mode": "dialog",
            "notice_enabled": True,
            "notice_button_label": "Anlagen geprüft",
            "active": True,
            "fields": [{
                "key": "freigabecode", "label": "Freigabecode",
                "type": "text", "required": True,
            }],
        })
        template = next(item for item in self.json_request(client, "/api/templates")["templates"]
                        if item["id"] == created["id"])
        self.assertEqual(template["notice_mode"], "dialog")
        self.assertIn("Vor dem Versand", template["notice_text"])
        self.assertIn("Anlage prüfen", template["notice_text"])
        self.assertIn("<ul><li>Anlage prüfen</li></ul>", template["notice_html"])
        self.assertEqual(template["notice_button_label"], "Anlagen geprüft")
        self.assertTrue(template["notice_enabled"])
        self.assertEqual(template["fields"][0]["key"], "eingabe.freigabecode")

        variables = self.json_request(client, "/api/variables")["variables"]
        custom = next(item for item in variables if item["key"] == "eingabe.freigabecode")
        self.assertEqual(custom["source"], "manual")
        self.assertTrue(custom["required"])

    def test_templates_can_be_favorited_and_duplicated(self):
        client, _ = self.authenticated_client()
        source = self.json_request(client, "/api/templates")["templates"][0]
        self.json_request(client, "/api/favorites", "POST", {"template_id": source["id"]})
        self.assertIn(source["id"], self.json_request(client, "/api/favorites")["template_ids"])
        self.json_request(client, f'/api/favorites/{source["id"]}', "DELETE")
        self.assertNotIn(source["id"], self.json_request(client, "/api/favorites")["template_ids"])

        duplicated = self.json_request(client, f'/api/templates/{source["id"]}/duplicate', "POST", {})
        copy = next(item for item in self.json_request(client, "/api/templates")["templates"]
                    if item["id"] == duplicated["id"])
        self.assertEqual(copy["name"], "Kopie von " + source["name"])
        self.assertFalse(copy["active"])
        self.assertEqual(copy["body_html"], source["body_html"])

    def test_template_order_and_favorites_tile_are_persisted(self):
        client, _ = self.authenticated_client()
        templates = self.json_request(client, "/api/templates")["templates"]
        category_id = templates[0]["category_id"]
        grouped = [item for item in templates if item["category_id"] == category_id]
        if len(grouped) < 2:
            duplicate = self.json_request(client, f'/api/templates/{grouped[0]["id"]}/duplicate', "POST", {})
            templates = self.json_request(client, "/api/templates")["templates"]
            grouped = [item for item in templates if item["category_id"] == category_id]
            self.assertTrue(any(item["id"] == duplicate["id"] for item in grouped))
        requested_ids = list(reversed([item["id"] for item in grouped]))
        self.json_request(client, "/api/templates/order", "PUT", {
            "category_id": category_id, "template_ids": requested_ids,
        })
        reordered = [item["id"] for item in self.json_request(client, "/api/templates")["templates"]
                     if item["category_id"] == category_id]
        self.assertEqual(reordered, requested_ids)

        self.assertFalse(self.json_request(client, "/api/dashboard")["show_favorites"])
        self.json_request(client, "/api/dashboard/favorites", "PUT", {"visible": True})
        self.assertTrue(self.json_request(client, "/api/dashboard")["show_favorites"])
        self.json_request(client, "/api/dashboard/favorites", "PUT", {"visible": False})
        self.assertFalse(self.json_request(client, "/api/dashboard")["show_favorites"])

    def test_frontend_contains_unsaved_template_test_and_editor_shortcuts(self):
        html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        style = (ROOT / "static" / "style.css").read_text(encoding="utf-8")
        self.assertIn('id="templateTestDialog"', html)
        self.assertIn('onclick="openTemplateTest()"', html)
        self.assertIn("function updateTemplateTestPreview()", script)
        self.assertIn('(event.ctrlKey||event.metaKey)', script)
        self.assertIn('key==="b"?"bold":"italic"', script)
        self.assertIn('class="template-actions-menu"', script)
        self.assertNotIn('transform:translateY(-1px)', style)

    def test_frontend_has_dashboard_search_drag_drop_and_closing_action_menu(self):
        html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        style = (ROOT / "static" / "style.css").read_text(encoding="utf-8")
        self.assertIn('id="dashboardTemplateSearch"', html)
        self.assertIn('id="dashboardTemplateDialog"', html)
        self.assertIn("function renderDashboardTemplateSearchResults()", script)
        self.assertIn("function createEmailFromDashboardSearch(id)", script)
        self.assertIn("function editTemplateFromDashboardSearch(id)", script)
        self.assertIn('document.querySelectorAll(".template-actions-menu[open]")', script)
        self.assertIn("function beginTemplateDrag", script)
        self.assertIn("function dropTemplate", script)
        self.assertIn('draggable="true"', script)
        self.assertIn("#variableChips{display:block}", style)
        self.assertIn("#tab-variables .section-head .actions", style)

    def test_inline_format_removal_preserves_the_selected_text(self):
        script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        unwrap = script.split("function unwrapEditorElement", 1)[1].split(
            "function applyInlineFormat", 1
        )[0]
        inline = script.split("function applyInlineFormat", 1)[1].split(
            "function applyListFormat", 1
        )[0]
        self.assertIn("preserveSelection", unwrap)
        self.assertIn("range.setStartBefore(first)", unwrap)
        self.assertIn("range.setEndAfter(last)", unwrap)
        self.assertIn("unwrapEditorElement(existing,editor,true)", inline)

    def test_project_json_accepts_multiple_contacts(self):
        client, _ = self.authenticated_client()
        payload = {
            "schema_version": "1.0",
            "projekt": {"id": "CONTACT-002", "bezeichnung": "Mehrere Kontakte"},
            "auftraggeber": {"name": "Kontaktstadt"},
            "kontakte": [
                {"vorname": "Anna", "nachname": "Beispiel", "email": "anna@example.de"},
                {"vorname": "Max", "nachname": "Muster", "email": "max@example.de"},
            ],
        }
        self.json_request(client, "/api/projects", "POST", {"data": payload})
        project = next(item for item in self.json_request(client, "/api/projects")["projects"]
                       if item["project_key"] == "CONTACT-002")
        self.assertEqual(len(project["data"]["kontakte"]), 2)
        self.assertEqual(project["data"]["kontakte"][1]["email"], "max@example.de")

    def test_administrator_role_cannot_be_edited(self):
        client, _ = self.authenticated_client()
        admin_role = next(role for role in self.json_request(client, "/api/roles")["roles"]
                          if role["name"] == "Administrator")
        with self.assertRaises(urllib.error.HTTPError) as rejected:
            self.json_request(client, f'/api/roles/{admin_role["id"]}', "PUT", {
                "name": "Eingeschränkt", "permissions": [],
                "all_categories": False, "category_ids": [],
            })
        self.assertEqual(rejected.exception.code, 409)

    def test_progressive_login_lock_and_admin_unlock(self):
        admin, _ = self.authenticated_client()
        role_id = next(role["id"] for role in self.json_request(admin, "/api/roles")["roles"]
                       if role["name"] == "Benutzer")
        self.json_request(admin, "/api/users", "POST", {
            "username": "sperrtest", "first_name": "Sperr", "last_name": "Test",
            "email": "", "role_id": role_id,
        })
        user_id = next(user["id"] for user in self.json_request(admin, "/api/users")["users"]
                       if user["username"] == "sperrtest")
        self.json_request(admin, f"/api/users/{user_id}/password", "PUT", {
            "new_password": "RichtigesPasswort123!"
        })

        durations = []
        with app.db() as conn:
            for attempt in range(1, 10):
                user, status, retry_after = app.authenticate_user(conn, "sperrtest", "falsch")
                self.assertIsNone(user)
                if attempt >= 3:
                    self.assertEqual(status, "locked")
                    durations.append(retry_after)
                    conn.execute("UPDATE users SET locked_until=? WHERE id=?", (
                        (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat(), user_id
                    ))
        self.assertEqual(durations, [1, 3, 5, 10, 15, 30, 1800])

        locked_user = next(user for user in self.json_request(admin, "/api/users")["users"]
                           if user["id"] == user_id)
        self.assertEqual(locked_user["failed_login_attempts"], 9)
        self.assertTrue(locked_user["locked_until"])
        self.json_request(admin, f"/api/users/{user_id}/unlock", "PUT", {})
        unlocked_user = next(user for user in self.json_request(admin, "/api/users")["users"]
                             if user["id"] == user_id)
        self.assertEqual(unlocked_user["failed_login_attempts"], 0)
        self.assertIsNone(unlocked_user["locked_until"])

    def test_frontend_contains_new_notice_contact_and_responsive_controls(self):
        html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "static" / "style.css").read_text(encoding="utf-8")
        self.assertIn('id="templatePickerDialog"', html)
        self.assertIn('id="templateNotice"', html)
        self.assertIn('id="noticeAcknowledgeButton"', html)
        self.assertIn('id="contactDialog"', html)
        self.assertIn('id="placeholderWarning"', html)
        self.assertIn('id="tplNoticeEnabled"', html)
        self.assertIn('id="recoveryCodeConfirmDialog"', html)
        self.assertIn('id="linkEditorDialog"', html)
        self.assertIn("Keinen Kontakt auswählen", script)
        self.assertIn('command==="removeList"', script)
        self.assertIn("function updatePlaceholderWarning()", script)
        self.assertIn("function runOutputAction(action)", script)
        self.assertIn("function openContactDialog(id)", script)
        self.assertIn("projectRecordVariables()", script)
        self.assertIn('input[type="checkbox"]', css)
        self.assertIn("@media(max-width:700px)", css)
        self.assertIn("@media(max-width:420px)", css)

    def test_limited_rich_text_is_sanitized_and_persisted(self):
        client, _ = self.authenticated_client()
        category_id = self.json_request(client, "/api/categories")["categories"][0]["id"]
        created = self.json_request(client, "/api/templates", "POST", {
            "name": "Formatierter Funktionstest",
            "category_id": category_id,
            "subject": "Formatierung",
            "body": "Fallback",
            "body_html": (
                '<p style="font: 20px Arial"><strong>Hallo</strong> '
                '<span style="color:red">Welt</span><script>alarm()</script></p>'
                '<ol><li>Erstens</li><li><a href="https://example.com">Link</a></li></ol>'
            ),
            "active": True,
            "fields": [],
        })
        template = next(item for item in self.json_request(client, "/api/templates")["templates"]
                        if item["id"] == created["id"])
        self.assertIn("<strong>Hallo</strong>", template["body_html"])
        self.assertIn('<a href="https://example.com">Link</a>', template["body_html"])
        self.assertNotIn("style=", template["body_html"])
        self.assertNotIn("script", template["body_html"])
        self.assertNotIn("alarm", template["body_html"])
        self.assertIn("1. Erstens", template["body"])
        self.assertIn("2. Link", template["body"])

    def test_frontend_requests_editable_multipart_eml(self):
        html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        eml_section = script.split("async function downloadEml()", 1)[1].split(
            "function downloadBlob", 1
        )[0]
        self.assertIn('contenteditable="true"', html)
        self.assertIn('id="tplBody"', html)
        self.assertIn('id="resultBody"', html)
        self.assertIn('"/api/email/eml"', eml_section)
        self.assertIn('"X-CSRF-Token":csrfToken', eml_section)
        self.assertIn("body_html:getEditorHtml(resultBody)", eml_section)
        # MIME structure is now checked end-to-end in test_email_images.py.
        self.assertIn("function sanitizeEmailHtml", script)
        self.assertIn("function applyInlineFormat", script)
        self.assertNotIn("document.execCommand", script)

    def test_settings_expose_release_information(self):
        client, _ = self.authenticated_client()
        data = self.json_request(client, "/api/settings")
        self.assertEqual(data["software"]["version"], app.SOFTWARE_VERSION)
        self.assertEqual(data["software"]["version_year"], 2026)
        self.assertEqual(
            data["software"]["template_count"],
            len(self.json_request(client, "/api/templates")["templates"]),
        )

    def test_new_user_can_be_forced_to_change_password(self):
        admin, _ = self.authenticated_client()
        role_id = next(
            role["id"] for role in self.json_request(admin, "/api/roles")["roles"]
            if role["name"] == "Benutzer"
        )
        created = self.json_request(admin, "/api/users", "POST", {
            "username": "wechselpflicht-v018", "first_name": "Passwort",
            "last_name": "Wechsel", "email": "wechsel-v018@example.test",
            "role_id": role_id, "must_change": True,
        })
        created_user = next(
            user for user in self.json_request(admin, "/api/users")["users"]
            if user["username"] == "wechselpflicht-v018"
        )
        self.assertTrue(created_user["must_change"])

        client, _ = self.new_client()
        form = urllib.parse.urlencode({
            "username": created["username"],
            "password": created["temporary_password"],
        }).encode()
        client.open(urllib.request.Request(
            self.base_url + "/login", data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        ))
        self.assertTrue(self.json_request(client, "/api/me")["user"]["must_change"])
        self.json_request(client, "/api/change-password", "POST", {
            "old_password": created["temporary_password"],
            "new_password": "NeuesPasswort123!",
        })
        self.assertFalse(self.json_request(client, "/api/me")["user"]["must_change"])

    def test_frontend_defaults_and_drag_drop_controls_match_v018(self):
        html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        self.assertIn('id="mode" type="hidden" value="manual"', html)
        self.assertIn('id="projectFormTabButton" class="active"', html)
        self.assertIn('E-Mailvorlage auswählen...', html)
        self.assertIn('id="resultTemplateName" readonly', html)
        self.assertIn('id="templateIdentity"', html)
        self.assertIn('id="uMustChangePassword" type="checkbox" checked', html)
        self.assertNotIn('id="fieldEditor"', html)
        self.assertNotIn('onclick="moveTemplate(', script)
        self.assertNotIn('onclick="moveCategory(', script)
        self.assertNotIn('onclick="moveDashboardTile(', script)
        self.assertIn("function dropCategory(", script)
        self.assertIn("function dropDashboardTile(", script)
        self.assertIn("function openTemplateEditor(", script)

    def test_v019_project_and_category_ui_defaults(self):
        html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        css = (ROOT / "static" / "style.css").read_text(encoding="utf-8")
        manual_position = html.index('id="modeManualButton"')
        project_position = html.index('id="modeProjectButton"')
        self.assertLess(manual_position, project_position)
        self.assertIn('<option value="">Projekt auswählen...</option>', script)
        self.assertIn('await loadTemplates();', script.split("async function dropCategory", 1)[1].split("function newCategory", 1)[0])
        self.assertNotIn('id="settingsSoftwareVersion"', html)
        self.assertIn(".template-identity h3{margin-top:0}", css)
        self.assertIn(".card>h2:first-child{margin-top:0}", css)

    def test_v1_template_history_archive_and_restore(self):
        client, _ = self.authenticated_client()
        template = next(item for item in self.json_request(client, "/api/templates")["templates"] if not item.get("archived"))
        payload = dict(template)
        payload["name"] = template["name"] + " Historientest"
        self.json_request(client, f'/api/templates/{template["id"]}', "PUT", payload)
        versions = self.json_request(client, f'/api/templates/{template["id"]}/versions')["versions"]
        self.assertGreaterEqual(len(versions), 2)
        self.json_request(client, f'/api/templates/{template["id"]}', "DELETE")
        archived = next(item for item in self.json_request(client, "/api/templates")["templates"] if item["id"] == template["id"])
        self.assertTrue(archived["archived"])
        self.json_request(client, f'/api/templates/{template["id"]}/restore', "PUT", {})
        restored = next(item for item in self.json_request(client, "/api/templates")["templates"] if item["id"] == template["id"])
        self.assertFalse(restored["archived"])

    def test_v1_project_archive_and_audit_log(self):
        client, _ = self.authenticated_client()
        payload = {"schema_version":"1.0","projekt":{"id":"ARCH-001","bezeichnung":"Archivtest"},"kontakte":[]}
        self.json_request(client, "/api/projects", "POST", {"data":payload})
        project = next(item for item in self.json_request(client, "/api/projects")["projects"] if item["project_key"] == "ARCH-001")
        self.json_request(client, f'/api/projects/{project["id"]}', "DELETE")
        archived = next(item for item in self.json_request(client, "/api/projects")["projects"] if item["id"] == project["id"])
        self.assertTrue(archived["archived"])
        audit = self.json_request(client, "/api/audit")["entries"]
        self.assertTrue(any(item["entity_type"] == "project" and item["action"] == "archive" for item in audit))

    def test_v1_csrf_blocks_unsafe_request_without_token(self):
        client, _ = self.authenticated_client()
        request = urllib.request.Request(self.base_url + "/api/dashboard/favorites",
            data=b'{"visible":true}',method="PUT",headers={"Content-Type":"application/json"})
        with self.assertRaises(urllib.error.HTTPError) as denied:
            client.open(request)
        self.assertEqual(denied.exception.code,403)

    def test_v1_manual_database_backup_is_downloadable(self):
        client, _ = self.authenticated_client()
        response = client.open(self.base_url + "/api/admin/backup")
        raw = response.read()
        self.assertTrue(raw.startswith(b"SQLite format 3"))
        self.assertIn("attachment",response.headers.get("Content-Disposition",""))

    def test_v11_individual_and_bulk_template_exports(self):
        client, _ = self.authenticated_client()
        template = next(item for item in self.json_request(client, "/api/templates")["templates"] if not item["archived"])

        single_json = json.load(client.open(self.base_url + f'/api/templates/{template["id"]}/export/json'))
        self.assertEqual(single_json["software_version"], app.SOFTWARE_VERSION)
        self.assertEqual(single_json["template"]["name"], template["name"])
        self.assertIn("body_html", single_json["template"])

        single_eml = client.open(self.base_url + f'/api/templates/{template["id"]}/export/eml').read()
        self.assertIn(b"X-Unsent: 1", single_eml)
        self.assertIn(b"multipart/alternative", single_eml)

        bulk_json = json.load(client.open(self.base_url + "/api/templates/export/json"))
        self.assertGreaterEqual(len(bulk_json["templates"]), 1)
        bulk_eml = client.open(self.base_url + "/api/templates/export/eml").read()
        with zipfile.ZipFile(io.BytesIO(bulk_eml)) as archive:
            names = archive.namelist()
            self.assertTrue(names)
            self.assertTrue(all(name.endswith(".eml") for name in names))
            self.assertIn(b"X-Unsent: 1", archive.read(names[0]))

    def test_v11_export_permissions_are_assignable_and_enforced(self):
        admin, _ = self.authenticated_client()
        roles_data = self.json_request(admin, "/api/roles")
        self.assertIn("template_export", roles_data["permission_catalog"])
        self.assertIn("templates_export_all", roles_data["permission_catalog"])
        category_id = self.json_request(admin, "/api/categories")["categories"][0]["id"]
        role = self.json_request(admin, "/api/roles", "POST", {
            "name":"Ohne Export","permissions":["email_create"],
            "all_categories":False,"category_ids":[category_id],
        })
        user = self.json_request(admin, "/api/users", "POST", {
            "username":"kein-export-v11","first_name":"Kein","last_name":"Export",
            "email":"kein-export@example.test","role_id":role["id"],
            "must_change":False,
        })
        client, _ = self.new_client()
        form = urllib.parse.urlencode({"username":user["username"],"password":user["temporary_password"]}).encode()
        client.open(urllib.request.Request(self.base_url+"/login",data=form,
            headers={"Content-Type":"application/x-www-form-urlencoded"}))
        template_id = self.json_request(client, "/api/templates")["templates"][0]["id"]
        with self.assertRaises(urllib.error.HTTPError) as denied:
            client.open(self.base_url + f"/api/templates/{template_id}/export/json")
        self.assertEqual(denied.exception.code,403)

    def test_v11_usage_report_stores_metadata_without_mail_content(self):
        client, _ = self.authenticated_client()
        template = next(item for item in self.json_request(client, "/api/templates")["templates"] if not item["archived"])
        self.json_request(client, "/api/usage", "POST", {
            "template_id":template["id"],"project_id":None,"output_method":"eml",
            "subject":"DARF NICHT GESPEICHERT WERDEN","body":"GEHEIMER MAILTEXT",
        })
        report = self.json_request(client, "/api/usage?days=30")
        self.assertGreaterEqual(report["total"],1)
        entry = report["recent"][0]
        self.assertEqual(entry["template_name"],template["name"])
        self.assertEqual(entry["output_method"],"eml")
        self.assertNotIn("body",entry)
        self.assertNotIn("subject",entry)
        with app.db() as conn:
            columns = {row["name"] for row in conn.execute("PRAGMA table_info(template_usage)").fetchall()}
        self.assertNotIn("body",columns)
        self.assertNotIn("subject",columns)

    def test_v11_system_status_and_help_are_available(self):
        client, _ = self.authenticated_client()
        status = self.json_request(client, "/api/system-status")["status"]
        self.assertEqual(status["version"],app.SOFTWARE_VERSION)
        self.assertGreater(status["database_size_bytes"],0)
        self.assertGreaterEqual(status["users_active"],1)
        html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        self.assertIn('id="tab-help"',html)
        self.assertIn('id="tab-usage"',html)
        self.assertIn('id="tab-system-status"',html)
        self.assertIn("Die Vorlagenprüfung gibt ausschließlich Hinweise",html)

    def test_v12_unified_system_permission_and_module_navigation(self):
        admin, _ = self.authenticated_client()
        roles_data = self.json_request(admin, "/api/roles")
        catalog = roles_data["permission_catalog"]
        self.assertIn("system_view", catalog)
        self.assertNotIn("audit_view", catalog)
        self.assertNotIn("usage_view", catalog)
        self.assertNotIn("system_status_view", catalog)

        role = self.json_request(admin, "/api/roles", "POST", {
            "name":"Systemleser v12", "permissions":["system_view"],
            "all_categories":False, "category_ids":[],
        })
        user = self.json_request(admin, "/api/users", "POST", {
            "username":"systemleser-v12", "first_name":"System", "last_name":"Leser",
            "email":"systemleser-v12@example.test", "role_id":role["id"],
            "must_change":False,
        })
        client, _ = self.new_client()
        form = urllib.parse.urlencode({
            "username":user["username"], "password":user["temporary_password"],
        }).encode()
        client.open(urllib.request.Request(
            self.base_url+"/login", data=form,
            headers={"Content-Type":"application/x-www-form-urlencoded"},
        ))
        self.assertIn("entries", self.json_request(client, "/api/audit"))
        self.assertIn("total", self.json_request(client, "/api/usage?days=30"))
        self.assertIn("status", self.json_request(client, "/api/system-status"))

        html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        self.assertIn('id="moduleNav"', html)
        self.assertIn('id="subNav"', html)
        self.assertIn('data-module="projects"', html)
        self.assertIn('>Projekte</button>', html)
        self.assertIn('data-module="users"', html)
        self.assertIn('>Benutzerverwaltung</button>', html)
        self.assertEqual(html.count('data-permission="system_view"'), 4)
        self.assertIn('function openModule(module)', script)
        self.assertIn('system:{label:"System",tabs:["system-status","audit","usage"]}', script)

    def test_v13_quicklinks_navigation_order_and_archive_ui(self):
        client, _ = self.authenticated_client()
        dashboard = self.json_request(client, "/api/dashboard")
        self.assertFalse(dashboard["show_quicklinks"])
        self.json_request(client, "/api/dashboard/quicklinks/visibility", "PUT", {"visible":True})
        created = self.json_request(client, "/api/dashboard/quicklinks", "POST", {
            "title":"Zenkit", "url":"https://zenkit.com/",
        })
        dashboard = self.json_request(client, "/api/dashboard")
        self.assertTrue(dashboard["show_quicklinks"])
        self.assertEqual(dashboard["quicklinks"][0]["title"], "Zenkit")
        self.json_request(client, f'/api/dashboard/quicklinks/{created["id"]}', "DELETE")
        self.assertEqual(self.json_request(client, "/api/dashboard")["quicklinks"], [])

        current = self.json_request(client, "/api/settings")["settings"]
        reversed_order = list(reversed(current["navigation_order"]))
        changed = self.json_request(client, "/api/settings", "PUT", {
            "app_name":current["app_name"], "logo_data":current["logo_data"],
            "navigation_order":reversed_order,
        })
        self.assertEqual(changed["settings"]["navigation_order"], reversed_order)

        html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        self.assertIn('id="archiveTemplateDialog"', html)
        self.assertIn('id="quicklinkDialog"', html)
        self.assertIn('id="projectSortOrder"', html)
        self.assertIn('id="navigationOrderList"', html)
        self.assertNotIn('id="settingsSoftwareVersion"', html)
        archive_function = script.split("async function archiveTemplate(id)",1)[1].split("async function restoreTemplate",1)[0]
        self.assertNotIn("confirm(", archive_function)
        self.assertIn("archiveTemplateDialog.showModal()", archive_function)
        self.assertIn("template.archived===archivedOnly", script)
        self.assertIn("function menuIcon(name)", script)

    def test_v14_project_identity_is_updated_without_creating_a_duplicate(self):
        client, _ = self.authenticated_client()
        before = self.json_request(client, "/api/projects")["projects"]
        self.json_request(client, "/api/projects", "POST", {"data":{
            "schema_version":"1.0",
            "projekt":{"id":"V14-UPDATE-A","bezeichnung":"Projekt Alpha"},
            "kontakte":[],
        }})
        self.json_request(client, "/api/projects", "POST", {"data":{
            "schema_version":"1.0",
            "projekt":{"id":"V14-UPDATE-B","bezeichnung":"Projekt Beta"},
            "kontakte":[],
        }})
        created = self.json_request(client, "/api/projects")["projects"]
        alpha = next(project for project in created if project["project_key"] == "V14-UPDATE-A")
        count_before_update = len(created)
        changed_data = dict(alpha["data"])
        changed_data["projekt"] = dict(changed_data["projekt"], id="V14-UPDATE-C", bezeichnung="Projekt Gamma")
        self.json_request(client, f'/api/projects/{alpha["id"]}', "PUT", {"data":changed_data})
        after = self.json_request(client, "/api/projects")["projects"]
        self.assertEqual(len(after), count_before_update)
        updated = next(project for project in after if project["id"] == alpha["id"])
        self.assertEqual(updated["project_key"], "V14-UPDATE-C")
        self.assertEqual(updated["name"], "Projekt Gamma")
        conflict_data = dict(updated["data"])
        conflict_data["projekt"] = dict(conflict_data["projekt"], id="V14-UPDATE-B")
        with self.assertRaises(urllib.error.HTTPError) as conflict:
            self.json_request(client, f'/api/projects/{alpha["id"]}', "PUT", {"data":conflict_data})
        self.assertEqual(conflict.exception.code, 409)
        self.assertEqual(len(self.json_request(client, "/api/projects")["projects"]), count_before_update)
        self.assertGreaterEqual(count_before_update, len(before) + 2)

    def test_v14_internal_quicklinks_can_be_reordered(self):
        client, _ = self.authenticated_client()
        first = self.json_request(client, "/api/dashboard/quicklinks", "POST", {
            "title":"Projektübersicht", "link_type":"internal", "target":"project-overview",
        })
        second = self.json_request(client, "/api/dashboard/quicklinks", "POST", {
            "title":"Hilfeseite", "link_type":"internal", "target":"help",
        })
        current = self.json_request(client, "/api/dashboard")["quicklinks"]
        existing_ids = [link["id"] for link in current if link["id"] not in {first["id"],second["id"]}]
        ordered = [second["id"],first["id"],*existing_ids]
        self.json_request(client, "/api/dashboard/quicklinks/order", "PUT", {"link_ids":ordered})
        links = self.json_request(client, "/api/dashboard")["quicklinks"]
        self.assertEqual([link["id"] for link in links], ordered)
        self.assertEqual(links[0]["link_type"], "internal")
        self.assertEqual(links[0]["target"], "help")

    def test_v14_bulk_delete_and_custom_dialog_frontend(self):
        client, _ = self.authenticated_client()
        project_ids = []
        for suffix in ("A","B"):
            self.json_request(client, "/api/projects", "POST", {"data":{
                "schema_version":"1.0",
                "projekt":{"id":f"V14-DELETE-{suffix}","bezeichnung":f"Löschprojekt {suffix}"},
                "kontakte":[],
            }})
        project_rows = self.json_request(client, "/api/projects")["projects"]
        for project in project_rows:
            if project["project_key"].startswith("V14-DELETE-"):
                project_ids.append(project["id"])
                self.json_request(client, f'/api/projects/{project["id"]}', "DELETE")
        deleted = self.json_request(client, "/api/projects/delete-archived", "POST", {"ids":project_ids})
        self.assertEqual(deleted["deleted"], 2)
        remaining_ids = {project["id"] for project in self.json_request(client, "/api/projects")["projects"]}
        self.assertTrue(set(project_ids).isdisjoint(remaining_ids))

        templates = self.json_request(client, "/api/templates")["templates"]
        duplicate_ids = []
        for template in templates[:2]:
            duplicate = self.json_request(client, f'/api/templates/{template["id"]}/duplicate', "POST", {})
            duplicate_ids.append(duplicate["id"])
            self.json_request(client, f'/api/templates/{duplicate["id"]}', "DELETE")
        removed = self.json_request(client, "/api/templates/delete-archived", "POST", {"ids":duplicate_ids})
        self.assertEqual(removed["deleted"], 2)

        html = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "static" / "app.js").read_text(encoding="utf-8")
        self.assertIn('id="archiveProjectDialog"', html)
        self.assertIn('id="permanentDeleteDialog"', html)
        self.assertIn('id="tab-project-detail"', html)
        self.assertIn('id="projectEditConflict"', html)
        self.assertIn("project.archived===showArchived", script)
        self.assertIn("String(left.project_key).localeCompare", script)
        self.assertIn('link.link_type==="internal"', script)
        permanent_delete_function = script.split("async function permanentlyDeleteTemplate",1)[1].split("async function openTemplateHistory",1)[0]
        self.assertNotIn("confirm(", permanent_delete_function)

    def test_v20_project_email_is_saved_as_snapshot(self):
        client, _ = self.authenticated_client()
        self.json_request(client, "/api/projects", "POST", {"data":{
            "schema_version":"1.0",
            "projekt":{"id":"V20-MAIL","bezeichnung":"Projektmail-Test","phase":"3"},
            "kontakte":[],
        }})
        project = next(item for item in self.json_request(client,"/api/projects")["projects"] if item["project_key"]=="V20-MAIL")
        template = next(item for item in self.json_request(client,"/api/templates")["templates"] if not item["archived"])
        saved = self.json_request(client,f'/api/projects/{project["id"]}/emails',"POST",{
            "template_id":template["id"],"template_name":template["name"],
            "recipient":"kunde@example.test","cc":"kopie@example.test","subject":"Gespeicherter Betreff",
            "body_text":"Nur Text","body_html":"<p><strong>Formatierter</strong> Inhalt</p>",
        })
        workspace = self.json_request(client,f'/api/projects/{project["id"]}/workspace')
        email = next(item for item in workspace["emails"] if item["id"]==saved["id"])
        self.assertEqual(email["subject"],"Gespeicherter Betreff")
        self.assertEqual(email["recipient"],"kunde@example.test")
        self.assertIn("<strong>Formatierter</strong>",email["body_html"])
        self.assertEqual(email["body_text"],"Formatierter Inhalt")

    def test_v20_bid_question_library_and_project_phase_data(self):
        client, _ = self.authenticated_client()
        category = self.json_request(client,"/api/bid/categories","POST",{"name":"Fahrgestell V20","active":True})
        topic = self.json_request(client,"/api/bid/topics","POST",{"category_id":category["id"],"name":"Fristverlängerung V20","active":True})
        answer = self.json_request(client,"/api/bid/answers","POST",{
            "topic_id":topic["id"],"short_question":"Frist verlängern?",
            "question":"Kann die Angebotsfrist verlängert werden?","answer":"Die Angebotsfrist wird verlängert.",
        })
        library = self.json_request(client,"/api/bid/answers")["answers"]
        stored_answer = next(item for item in library if item["id"]==answer["id"])
        self.assertEqual(stored_answer["category_name"],"Fahrgestell V20")
        self.assertEqual(stored_answer["topic_name"],"Fristverlängerung V20")

        self.json_request(client,"/api/projects","POST",{"data":{
            "schema_version":"1.0","projekt":{"id":"V20-BID","bezeichnung":"Bieterfragen-Test"},"kontakte":[],
        }})
        project = next(item for item in self.json_request(client,"/api/projects")["projects"] if item["project_key"]=="V20-BID")
        created = self.json_request(client,"/api/bid/questions","POST",{"questions":[
            {"project_id":project["id"],"category":"Fahrgestell","bidder":"Bieter A","subject":"Frist","question":"Frage A","agency_comment":"Kommentar A","decision":"","answer":""},
            {"project_id":project["id"],"category":"Beladung","bidder":"Bieter B","subject":"Menge","question":"Frage B","agency_comment":"Kommentar B","decision":"zugelassen","answer":"Antwort B"},
        ]})
        self.assertEqual(created["created"],2)
        workspace = self.json_request(client,f'/api/projects/{project["id"]}/workspace')
        self.assertEqual(len([item for item in workspace["bid_questions"] if item["id"] in created["ids"]]),2)
        overview = self.json_request(client,"/api/bid/questions")["questions"]
        self.assertTrue(all(any(item["id"]==question_id for item in overview) for question_id in created["ids"]))

    def test_v20_frontend_contains_modular_bidder_workflow(self):
        html=(ROOT/"static"/"index.html").read_text(encoding="utf-8")
        script=(ROOT/"static"/"app.js").read_text(encoding="utf-8")
        self.assertIn('data-module="bidder"',html)
        self.assertIn('id="tab-bid-questions"',html)
        self.assertIn('id="tab-bid-question-create"',html)
        self.assertIn('id="tab-bid-answers"',html)
        self.assertIn('id="tab-bid-taxonomy"',html)
        self.assertIn('id="saveProjectEmailButton"',html)
        self.assertIn('3 – Ausschreibung',html)
        self.assertIn('bidder:{label:"Bieterfragen"',script)
        self.assertIn('function parsedBidImport()',script)
        self.assertIn('function saveEmailToProject()',script)

    def test_v21_bid_question_answer_status_can_be_acknowledged(self):
        client, _ = self.authenticated_client()
        category = self.json_request(client,"/api/bid/categories","POST",{"name":"Aufbau V21","active":True})
        topic = self.json_request(client,"/api/bid/topics","POST",{
            "category_id":category["id"],"name":"Abmessungen V21","active":True,
        })
        self.json_request(client,"/api/projects","POST",{"data":{
            "schema_version":"1.0","projekt":{"id":"V21-ACK","bezeichnung":"Quittierung"},"kontakte":[],
        }})
        project = next(item for item in self.json_request(client,"/api/projects")["projects"] if item["project_key"]=="V21-ACK")
        created = self.json_request(client,"/api/bid/questions","POST",{
            "project_id":project["id"],"category_id":category["id"],"topic_id":topic["id"],
            "bidder":"Bieter C","question":"Wie breit ist der Aufbau?","decision":"zugelassen",
            "answer":"Der Aufbau entspricht der Zeichnung.",
        })
        question_id = created["ids"][0]
        before = next(item for item in self.json_request(client,"/api/bid/questions")["questions"] if item["id"]==question_id)
        self.assertEqual(before["category"],"Aufbau V21")
        self.assertEqual(before["subject"],"Abmessungen V21")
        self.assertIsNone(before["answered_at"])
        self.json_request(client,f"/api/bid/questions/{question_id}/acknowledge","PUT",{})
        answered = next(item for item in self.json_request(client,"/api/bid/questions")["questions"] if item["id"]==question_id)
        self.assertTrue(answered["answered_at"])
        self.json_request(client,f"/api/bid/questions/{question_id}","PUT",{
            "project_id":project["id"],"category_id":category["id"],"topic_id":topic["id"],
            "bidder":"Bieter C","question":"Wie breit ist der Aufbau?","decision":"abgelehnt",
            "answer":"Überarbeitete Antwort",
        })
        changed = next(item for item in self.json_request(client,"/api/bid/questions")["questions"] if item["id"]==question_id)
        self.assertIsNone(changed["answered_at"])

    def test_v21_frontend_has_search_pickers_batch_and_saved_email_editor(self):
        html=(ROOT/"static"/"index.html").read_text(encoding="utf-8")
        script=(ROOT/"static"/"app.js").read_text(encoding="utf-8")
        self.assertIn('id="tab-bid-question-batch"',html)
        self.assertIn('id="tab-bid-question-import"',html)
        self.assertIn('id="bidProjectPickerDialog"',html)
        self.assertIn('id="bidTaxonomyPickerDialog"',html)
        self.assertIn('id="standardAnswerPickerDialog"',html)
        self.assertIn('id="openSavedEmailEditorButton"',html)
        self.assertIn('function openSavedEmailInEditor()',script)
        self.assertIn('function saveBidBatch()',script)
        self.assertIn('function acknowledgeBidQuestion(id)',script)
        self.assertIn('function copyBidAnswerField(id,key)',script)

    def test_v22_bidders_answer_cases_and_linked_question(self):
        client, _ = self.authenticated_client()
        self.json_request(client,"/api/bidders","POST",{
            "bidder":"Bieter V22","company_name":"Beispiel GmbH","city":"Musterstadt",
        })
        bidder=next(item for item in self.json_request(client,"/api/bidders")["bidders"] if item["bidder"]=="Bieter V22")
        category=self.json_request(client,"/api/bid/categories","POST",{"name":"Kategorie V22","active":True})
        topic=self.json_request(client,"/api/bid/topics","POST",{
            "category_id":category["id"],"name":"Thema V22","active":True,
        })
        created_answer=self.json_request(client,"/api/bid/answers","POST",{
            "topic_id":topic["id"],"short_question":"Frist V22","question":"Wird verlängert?",
            "agency_comment":"Eine Verlängerung ist vertretbar.","variants":[
                {"decision":"zugelassen","answer":"Die Frist wird verlängert."},
                {"decision":"abgelehnt","answer":"Die Frist wird nicht verlängert."},
            ],
        })
        answer=next(item for item in self.json_request(client,"/api/bid/answers")["answers"] if item["id"]==created_answer["id"])
        self.assertEqual(answer["agency_comment"],"Eine Verlängerung ist vertretbar.")
        self.assertEqual({item["decision"] for item in answer["variants"]},{"zugelassen","abgelehnt"})
        allowed=next(item for item in answer["variants"] if item["decision"]=="zugelassen")
        self.json_request(client,"/api/projects","POST",{"data":{
            "schema_version":"1.0","projekt":{"id":"V22-BID","bezeichnung":"Bieter V22"},"kontakte":[],
        }})
        project=next(item for item in self.json_request(client,"/api/projects")["projects"] if item["project_key"]=="V22-BID")
        created_question=self.json_request(client,"/api/bid/questions","POST",{
            "project_id":project["id"],"category_id":category["id"],"topic_id":topic["id"],
            "bidder_id":bidder["id"],"standard_answer_id":answer["id"],"standard_variant_id":allowed["id"],
            "question":"Bitte um Verlängerung","agency_comment":answer["agency_comment"],
            "decision":"zugelassen","answer":allowed["answer"],
        })
        question=next(item for item in self.json_request(client,"/api/bid/questions")["questions"] if item["id"]==created_question["ids"][0])
        self.assertEqual(question["bidder"],"Bieter V22")
        self.assertEqual(question["bidder_id"],bidder["id"])
        self.assertEqual(question["standard_answer_id"],answer["id"])
        self.assertEqual(question["standard_variant_id"],allowed["id"])

    def test_v22_frontend_has_bidder_directory_filters_and_answer_variants(self):
        html=(ROOT/"static"/"index.html").read_text(encoding="utf-8")
        script=(ROOT/"static"/"app.js").read_text(encoding="utf-8")
        for marker in ['id="tab-bidders"','id="bidderPickerDialog"','id="bidQuestionCategoryFilter"',
                       'id="bidQuestionBidderFilter"','id="bidAnswerVariants"']:
            self.assertIn(marker,html)
        for marker in ['function importBidders()','function renderBidderPickerResults()',
                       'function addBidAnswerVariant(','function updateBidFilterOptions()']:
            self.assertIn(marker,script)

    def test_v23_document_template_upload_block_and_docx_generation(self):
        client, _ = self.authenticated_client()
        source = io.BytesIO()
        document = Document()
        document.add_paragraph("Projekt: {{ projekt.bezeichnung }}")
        document.add_paragraph("{{ baustein.testhinweis }}")
        document.save(source)
        created = self.json_request(client, "/api/document-templates", "POST", {
            "name":"Testdokument", "description":"Automatischer Test", "filename":"test.docx",
            "content_base64":base64.b64encode(source.getvalue()).decode("ascii"), "active":True,
        })
        self.assertIn("projekt.bezeichnung", created["placeholders"])
        self.assertIn("baustein.testhinweis", created["placeholders"])
        block = self.json_request(client, "/api/document-blocks", "POST", {
            "key":"testhinweis", "name":"Testhinweis", "category":"Test",
            "content":"Hinweis für {{ projekt.bezeichnung }}", "active":True,
        })
        token = self.csrf_tokens[id(client)]
        request = urllib.request.Request(
            self.base_url + "/api/documents/generate",
            data=json.dumps({"template_id":created["id"],"values":{"projekt.bezeichnung":"HLF 20 Test"},"output":"docx"}).encode("utf-8"),
            method="POST", headers={"Content-Type":"application/json","X-CSRF-Token":token},
        )
        response = client.open(request)
        self.assertIn("wordprocessingml.document",response.headers["Content-Type"])
        with zipfile.ZipFile(io.BytesIO(response.read())) as archive:
            xml = archive.read("word/document.xml").decode("utf-8")
        self.assertIn("HLF 20 Test",xml)
        self.assertIn("Hinweis für",xml)
        self.json_request(client,f"/api/document-blocks/{block['id']}","DELETE")
        self.json_request(client,f"/api/document-templates/{created['id']}","DELETE")

    def test_v23_bid_question_year_and_variant_short_description(self):
        client, _ = self.authenticated_client()
        category = self.json_request(client,"/api/bid/categories","POST",{"name":"v23 Kategorie","active":True})
        topic = self.json_request(client,"/api/bid/topics","POST",{"category_id":category["id"],"name":"v23 Thema","active":True})
        answer = self.json_request(client,"/api/bid/answers","POST",{
            "topic_id":topic["id"],"short_question":"v23 Frage","question":"Frage",
            "agency_comment":"Kommentar", "variants":[{"decision":"zugelassen","short_description":"kurze positive Variante","answer":"Ja"}],
        })
        loaded = next(item for item in self.json_request(client,"/api/bid/answers")["answers"] if item["id"]==answer["id"])
        self.assertEqual(loaded["variants"][0]["short_description"],"kurze positive Variante")
        project = self.json_request(client,"/api/projects","POST",{"data":{"schema_version":"1.0","projekt":{"id":"V23-TEST","bezeichnung":"Jahrestest"},"kontakte":[]}})
        projects = self.json_request(client,"/api/projects")["projects"]
        project_id = next(item["id"] for item in projects if item["project_key"]=="V23-TEST")
        question = self.json_request(client,"/api/bid/questions","POST",{"project_id":project_id,"question_year":2024,"question":"Wann?"})
        loaded_question = next(item for item in self.json_request(client,"/api/bid/questions")["questions"] if item["id"]==question["ids"][0])
        self.assertEqual(loaded_question["question_year"],2024)

    def test_v23_frontend_contains_document_module_and_split_bidder_pages(self):
        html=(ROOT/"static"/"index.html").read_text(encoding="utf-8")
        script=(ROOT/"static"/"app.js").read_text(encoding="utf-8")
        for marker in ['data-nav-key="documents"','id="tab-document-create"','id="tab-document-templates"',
                       'id="tab-document-blocks"','id="tab-bidder-create"','id="bidQuestionYear"']:
            self.assertIn(marker,html)
        script += (ROOT/"static"/"documents.js").read_text(encoding="utf-8")
        for marker in ['function generateDocument(','function createQuickBidder(','function openBidAnswerDetail(']:
            self.assertIn(marker,script)

    def test_v30_frontend_uses_modular_responsive_application_shell(self):
        html=(ROOT/"static"/"index.html").read_text(encoding="utf-8")
        shell=(ROOT/"static"/"ui-shell.js").read_text(encoding="utf-8")
        styles=(ROOT/"static"/"modern.css").read_text(encoding="utf-8")
        for marker in ['id="appSidebar"','id="pageTitle"','id="pageBreadcrumb"',
                       'id="sidebarOpenButton"','/static/modern.css','/static/ui-shell.js']:
            self.assertIn(marker,html)
        for marker in ['function decorateNavigation()','function updateAppShell(','window.refreshShellPermissions']:
            self.assertIn(marker,shell)
        for marker in ['--sidebar-width: 286px','.sidebar-submenu','.project-table-shell',
                       '@media (max-width: 980px)']:
            self.assertIn(marker,styles)

    def test_v12_legacy_system_permissions_are_migrated(self):
        with app.db() as conn:
            conn.execute(
                """INSERT INTO roles(name,permissions_json,all_templates,all_categories,is_system,created_at)
                   VALUES (?,?,?,?,?,?)""",
                ("Altes Systemrecht v12", json.dumps(["usage_view"]), 0, 0, 0,
                 datetime.now(timezone.utc).isoformat()),
            )
        app.init_db()
        with app.db() as conn:
            row = conn.execute(
                "SELECT permissions_json FROM roles WHERE name=?",
                ("Altes Systemrecht v12",),
            ).fetchone()
        migrated = json.loads(row["permissions_json"])
        self.assertIn("system_view", migrated)
        self.assertNotIn("usage_view", migrated)

    def test_zzz_v1_database_restore_replaces_state_and_requires_new_login(self):
        client, _ = self.authenticated_client()
        original_name = self.json_request(client, "/api/settings")["settings"]["app_name"]
        raw = client.open(self.base_url + "/api/admin/backup").read()
        self.json_request(client, "/api/settings", "PUT", {"app_name":"Nicht behalten","logo_data":""})
        restored = self.json_request(client, "/api/admin/restore", "POST", {
            "database_base64":base64.b64encode(raw).decode("ascii")
        })
        self.assertTrue(restored["ok"])
        fresh, _ = self.authenticated_client()
        self.assertEqual(self.json_request(fresh, "/api/settings")["settings"]["app_name"],original_name)


if __name__ == "__main__":
    unittest.main()
