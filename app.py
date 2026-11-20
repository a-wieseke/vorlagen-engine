
from __future__ import annotations

import base64
import html as html_lib
import hashlib
import hmac
import io
import json
import math
import mimetypes
import os
import re
import secrets
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import threading
import webbrowser
import zipfile
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http import cookies
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse, parse_qs, quote
import bid_workbooks
import document_tools
import email_images
from core import projects as project_service, security as account_security, migrations
from modules import administration_routes, mail_routes, documents_routes, bids_routes, projects_routes

try:
    from argon2 import PasswordHasher
    from argon2.exceptions import VerifyMismatchError
except ImportError:
    print("Fehlende Abhängigkeit: argon2-cffi. Bitte 'pip install -r requirements.txt' ausführen.")
    raise

try:
    from docxtpl import DocxTemplate
    from jinja2 import Environment, StrictUndefined
except ImportError:
    print("Fehlende Abhängigkeit: docxtpl. Bitte 'pip install -r requirements.txt' ausführen.")
    raise

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_DIR = Path(os.environ.get("WVE_DATA_DIR", str(BASE_DIR))).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "wieseke.db"
HOST = os.environ.get("WVE_HOST", "127.0.0.1")
PORT = int(os.environ.get("WVE_PORT", "8877"))
SESSION_HOURS = 8
SOFTWARE_VERSION = "4.0.1"
VERSION_YEAR = 2026
SCHEMA_VERSION = 13
DEMO_MODE = os.environ.get("WVE_DEMO_MODE", "0") == "1"
SECURE_COOKIES = os.environ.get("WVE_SECURE_COOKIES", "0") == "1"
OPEN_BROWSER = os.environ.get("WVE_OPEN_BROWSER", "1") == "1"
ph = PasswordHasher()
SESSIONS: dict[str, dict] = {}
API_RATE_BUCKETS = {}
API_RATE_LOCK = threading.Lock()


def api_rate_allowed(scope, limit):
    """Bounded, thread-safe one-minute limits; no credentials are retained."""
    minute = int(datetime.now(timezone.utc).timestamp()) // 60
    with API_RATE_LOCK:
        for key in list(API_RATE_BUCKETS):
            if API_RATE_BUCKETS[key][0] != minute:
                del API_RATE_BUCKETS[key]
        if scope not in API_RATE_BUCKETS and len(API_RATE_BUCKETS) >= 2048:
            return False
        bucket = API_RATE_BUCKETS.setdefault(scope, [minute, 0])
        bucket[1] += 1
        return bucket[1] <= limit
STARTED_AT = datetime.now(timezone.utc)

# The rich-text editor intentionally supports only semantic email formatting.
# Fonts, colors, inline styles and executable content are discarded.
# Images are the sole non-text extension, decoded and re-encoded server-side.
ALLOWED_EMAIL_TAGS = {"p", "br", "strong", "em", "ul", "ol", "li", "a", "img"}


class EmailHtmlSanitizer(HTMLParser):
    """Allow the small HTML subset supported by the template editor."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output: list[str] = []
        self.blocked_depth = 0
        self.image_budget = {"count": 0, "bytes": 0}

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in {"script", "style", "iframe", "object", "svg"}:
            self.blocked_depth += 1
            return
        if self.blocked_depth:
            return
        tag = {"b": "strong", "i": "em", "div": "p"}.get(tag, tag)
        if tag not in ALLOWED_EMAIL_TAGS:
            return
        if tag == "img":
            self.output.append(email_images.image_tag(attrs, self.image_budget))
            return
        if tag == "br":
            self.output.append("<br>")
            return
        if tag == "a":
            href = next((str(value or "") for key, value in attrs if key.lower() == "href"), "")
            if re.match(r"^(?:https?://|mailto:)", href, re.IGNORECASE):
                safe_href = html_lib.escape(href, quote=True)
                self.output.append(f'<a href="{safe_href}">')
            else:
                self.output.append("<a>")
            return
        self.output.append(f"<{tag}>")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in {"script", "style", "iframe", "object", "svg"}:
            self.blocked_depth = max(0, self.blocked_depth - 1)
            return
        if self.blocked_depth:
            return
        tag = {"b": "strong", "i": "em", "div": "p"}.get(tag, tag)
        if tag in ALLOWED_EMAIL_TAGS and tag not in {"br", "img"}:
            self.output.append(f"</{tag}>")

    def handle_data(self, data):
        if not self.blocked_depth:
            self.output.append(html_lib.escape(data.replace("\u200b", "")))


class EmailTextExtractor(HTMLParser):
    """Create the plain-text alternative used by mailto and MIME output."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.list_stack: list[dict] = []

    def newline(self):
        if self.parts and not self.parts[-1].endswith("\n"):
            self.parts.append("\n")

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "br":
            self.parts.append("\n")
        elif tag == "img":
            alt = dict(attrs).get("alt") or "Bild"
            self.parts.append(f"[Bild: {alt}]")
        elif tag in {"p", "ul", "ol"}:
            self.newline()
            if tag in {"ul", "ol"}:
                self.list_stack.append({"tag": tag, "counter": 0})
        elif tag == "li":
            self.newline()
            if self.list_stack and self.list_stack[-1]["tag"] == "ol":
                self.list_stack[-1]["counter"] += 1
                self.parts.append(f'{self.list_stack[-1]["counter"]}. ')
            else:
                self.parts.append("• ")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in {"p", "li"}:
            self.newline()
        elif tag in {"ul", "ol"}:
            if self.list_stack:
                self.list_stack.pop()
            self.newline()

    def handle_data(self, data):
        self.parts.append(data)


def plain_text_to_html(value):
    """Convert legacy plain-text templates without introducing font styles."""
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    paragraphs = text.split("\n\n")
    return "".join(f"<p>{html_lib.escape(part).replace(chr(10), '<br>')}</p>" for part in paragraphs)


def sanitize_email_html(value, fallback_text=""):
    source = str(value or plain_text_to_html(fallback_text))
    if len(source) > email_images.MAX_HTML:
        raise ValueError("Der E-Mail-Inhalt ist zu groß (höchstens 10 Bilder / 4 MB Bilddaten).")
    sanitizer = EmailHtmlSanitizer()
    sanitizer.feed(source)
    sanitizer.close()
    return "".join(sanitizer.output).strip()


def html_to_plain_text(value):
    extractor = EmailTextExtractor()
    extractor.feed(str(value or ""))
    extractor.close()
    text = "".join(extractor.parts).replace("\r", "")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

DEFAULT_VARIABLES = [
    ("projekt.id", "Projekt-ID", "text", "project", 1),
    ("projekt.bezeichnung", "Projektbezeichnung", "text", "project", 1),
    ("projekt.fahrzeugtyp", "Fahrzeugtyp", "text", "project", 0),
    ("projekt.status", "Projektstatus", "text", "project", 0),
    ("projekt.phase", "Aktuelle Projektphase", "text", "project", 0),
    ("auftraggeber.name", "Auftraggeber", "text", "client", 0),
    ("auftraggeber.strasse", "Straße", "text", "client", 0),
    ("auftraggeber.plz", "Postleitzahl", "text", "client", 0),
    ("auftraggeber.ort", "Ort", "text", "client", 0),
    ("kontakt.anrede", "Ansprache", "text", "contact", 0),
    ("kontakt.vorname", "Kontakt – Vorname", "text", "contact", 0),
    ("kontakt.nachname", "Kontakt – Nachname", "text", "contact", 0),
    ("kontakt.email", "Kontakt – E-Mail-Adresse", "email", "contact", 0),
    ("kontakt.telefon", "Kontakt – Telefon", "text", "contact", 0),
    ("kontakt.rolle", "Kontakt – Rolle", "text", "contact", 0),
    ("benutzer.vorname", "Absender – Vorname", "text", "user", 0),
    ("benutzer.nachname", "Absender – Nachname", "text", "user", 0),
    ("benutzer.email", "Absender – E-Mail-Adresse", "email", "user", 0),
]

VARIABLE_TYPES = {"text", "textarea", "date", "number", "email"}
VARIABLE_SOURCES = {"project", "client", "contact", "user", "manual"}
NOTICE_MODES = {"display", "dialog", "acknowledge"}
MAIN_NAV_KEYS = ["dashboard", "email", "documents", "bidder", "projects", "users", "system", "help"]
INTERNAL_QUICKLINK_TARGETS = {
    "dashboard", "generator", "project-overview", "project-create", "bidders", "templates",
    "categories", "variables", "users", "roles", "system-status", "audit", "usage",
    "help", "settings", "account", "bid-questions", "bid-question-create", "bid-question-batch", "bid-question-import",
    "bid-answers", "bid-answer-create", "bid-taxonomy", "bidder-create",
    "document-create", "document-templates", "document-blocks", "document-template-edit",
}

PERMISSIONS = {
    "email_create": "E-Mails erstellen",
    "projects_view": "Projektübersicht anzeigen",
    "projects_manage": "Projekte anlegen, importieren und löschen",
    "projects_api_create": "Projekte über API anlegen / persönliche API-Schlüssel",
    "templates_manage": "E-Mail-Vorlagen verwalten",
    "categories_manage": "E-Mail-Kategorien verwalten",
    "variables_manage": "Platzhalter verwalten",
    "users_manage": "Benutzer verwalten",
    "roles_manage": "Rollen und Berechtigungen verwalten",
    "settings_manage": "Anwendungseinstellungen verwalten",
    "system_view": "Systeminformationen und Auswertungen anzeigen",
    "backup_manage": "Sicherungen erstellen und wiederherstellen",
    "template_export": "Einzelne E-Mail-Vorlagen exportieren",
    "templates_export_all": "Alle zugänglichen E-Mail-Vorlagen exportieren",
    "bid_questions_view": "Bieterfragen anzeigen",
    "bid_questions_manage": "Bieterfragen erfassen und bearbeiten",
    "bid_answers_manage": "Standardantworten und deren Struktur verwalten",
    "documents_create": "Dokumente aus Vorlagen erstellen",
    "document_templates_manage": "Dokumentvorlagen und Textbausteine verwalten",
}
ALL_PERMISSIONS = list(PERMISSIONS)

DEFAULT_TEMPLATES = [
    {
        "name": "Abrechnung erbrachter Leistungen bis zur Vergabe",
        "category": "Abrechnung",
        "subject": "{{projekt.id}} – Abrechnung erbrachter Leistungen bis zur Vergabe",
        "body": "Guten Tag {{kontakt.anrede}},\n\nanbei übermittle ich die Rechnung für die erbrachten Leistungen für das {{projekt.bezeichnung}} bis zur Vergabe.\n\nDie Abschlussrechnung wird nach Auslieferung des Fahrzeuges in Rechnung gestellt.\n\nMit freundlichen Grüßen",
        "fields": []
    },
    {
        "name": "Aktuelle Bieterfragen",
        "category": "Vergabeverfahren",
        "subject": "{{projekt.id}} – Aktuelle Bieterfragen",
        "body": "Guten Tag {{kontakt.anrede}},\n\nanbei sind die aktuellen Bieterfragen.\n\nDiese müssten zeitnah beantwortet werden.\n\nIn der Spalte „Bemerkungen Agentur Wieseke“ geben wir Rückmeldung zur Bieterfrage aus unserer Sicht. Die finale Entscheidung kann in der Antwort zu dieser Mail oder in die Spalte „Entscheidung“ geschrieben werden.\n\nBei Fragen stehen wir gerne jederzeit zur Verfügung.\n\nMit freundlichen Grüßen",
        "fields": []
    },
    {
        "name": "Auftragsschreiben – ohne Beladung",
        "category": "Auftrag",
        "subject": "{{projekt.id}} – Auftragsschreiben {{projekt.bezeichnung}}",
        "body": "Guten Tag {{kontakt.anrede}},\n\nanbei übermittle ich die Auftragsschreiben für das {{projekt.bezeichnung}}.\n\nDiese liegen in 4-facher Ausführung vor:\n\n2x für Sie\n1x für den Auftragnehmer\n1x für die Agentur Wieseke (uns reicht auch ein digitaler Scan)\n\nDiese müssen nun vom Bürgermeister unterschrieben und an die Auftragnehmer verschickt werden. Wir empfehlen für den Versand eine Versandart mit Nachverfolgung oder besser noch mit persönlicher Übergabe.\n\nDie Aufträge können direkt versendet werden.\n\nWenn die Auftragsschreiben unterschrieben zurückkommen, kontaktieren Sie uns bitte. Ab dann können wir in die Abwicklung des Auftrages gehen.\n\nBei Fragen stehe ich gerne zur Verfügung.\n\nMit freundlichen Grüßen",
        "fields": []
    },
    {
        "name": "Auftragsschreiben – mit Beladung",
        "category": "Auftrag",
        "subject": "{{projekt.id}} – Auftragsschreiben {{projekt.bezeichnung}}",
        "body": "Guten Tag {{kontakt.anrede}},\n\nanbei übermittle ich die Auftragsschreiben für das {{projekt.bezeichnung}}.\n\nDiese liegen in 4-facher Ausführung vor:\n\n2x für Sie\n1x für den Auftragnehmer\n1x für die Agentur Wieseke (uns reicht auch ein digitaler Scan)\n\nDiese müssen nun vom Bürgermeister unterschrieben und an die Auftragnehmer verschickt werden. Wir empfehlen für den Versand eine Versandart mit Nachverfolgung oder besser noch mit persönlicher Übergabe.\n\nWenn die Auftragsschreiben unterschrieben zurückkommen, kontaktieren Sie uns bitte. Ab dann können wir in die Abwicklung des Auftrages gehen.\n\nEbenso bitten wir um Kontaktierung im Falle einer Kontaktaufnahme durch einen Auftragnehmer, sodass wir hier in Kontakt treten können. Insbesondere bei den Beladungslieferanten erfolgt häufig eine Kontaktaufnahme inklusive Übersendung der Auftragsbestätigung. Diese muss vor Bestellung aber erst noch auf Richtigkeit überprüft werden.\n\nBei Fragen stehe ich gerne zur Verfügung.\n\nMit freundlichen Grüßen",
        "fields": []
    }
]

def now_iso():
    return datetime.now(timezone.utc).isoformat()

@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Create a new database or migrate an existing prototype database in place."""
    previous = migrations.inspect_database(DB_PATH, SCHEMA_VERSION)
    if DB_PATH.exists() and DB_PATH.stat().st_size and previous < SCHEMA_VERSION:
        create_database_backup(f"before-schema-{previous}-to-{SCHEMA_VERSION}")
    with db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            permissions_json TEXT NOT NULL DEFAULT '[]',
            all_templates INTEGER NOT NULL DEFAULT 0,
            all_categories INTEGER NOT NULL DEFAULT 1,
            is_system INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL DEFAULT '',
            password_hash TEXT NOT NULL,
            recovery_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin','user')),
            active INTEGER NOT NULL DEFAULT 1,
            must_change INTEGER NOT NULL DEFAULT 0,
            failed_login_attempts INTEGER NOT NULL DEFAULT 0,
            locked_until TEXT,
            password_policy_exempt INTEGER NOT NULL DEFAULT 0,
            show_favorites INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            role_id INTEGER,
            FOREIGN KEY(role_id) REFERENCES roles(id)
        );
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_key TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            data_json TEXT NOT NULL,
            imported_at TEXT NOT NULL,
            imported_by INTEGER,
            archived INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(imported_by) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            body_html TEXT NOT NULL DEFAULT '',
            fields_json TEXT NOT NULL DEFAULT '[]',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            category_id INTEGER,
            notice_text TEXT NOT NULL DEFAULT '',
            notice_mode TEXT NOT NULL DEFAULT 'display',
            notice_enabled INTEGER NOT NULL DEFAULT 0,
            notice_html TEXT NOT NULL DEFAULT '',
            notice_button_label TEXT NOT NULL DEFAULT 'Hinweistext gesehen',
            sort_order INTEGER NOT NULL DEFAULT 0,
            archived INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(category_id) REFERENCES categories(id)
        );
        CREATE TABLE IF NOT EXISTS variables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            label TEXT NOT NULL,
            field_type TEXT NOT NULL DEFAULT 'text',
            source TEXT NOT NULL DEFAULT 'manual',
            required INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS app_settings (
            id INTEGER PRIMARY KEY CHECK(id=1),
            app_name TEXT NOT NULL,
            logo_data TEXT NOT NULL DEFAULT '',
            navigation_order_json TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS role_templates (
            role_id INTEGER NOT NULL,
            template_id INTEGER NOT NULL,
            PRIMARY KEY(role_id,template_id),
            FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,
            FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS role_categories (
            role_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            PRIMARY KEY(role_id,category_id),
            FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,
            FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS dashboard_tiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            category_id INTEGER NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            UNIQUE(user_id,category_id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS dashboard_quicklinks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            link_type TEXT NOT NULL DEFAULT 'external',
            target TEXT NOT NULL DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS favorite_templates (
            user_id INTEGER NOT NULL,
            template_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY(user_id,template_id),
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS template_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER NOT NULL,
            version_no INTEGER NOT NULL,
            snapshot_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            created_by INTEGER,
            UNIQUE(template_id,version_no),
            FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username TEXT NOT NULL DEFAULT '',
            action TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL DEFAULT '',
            summary TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS template_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER,
            template_name TEXT NOT NULL,
            user_id INTEGER,
            username TEXT NOT NULL,
            project_id INTEGER,
            project_key TEXT NOT NULL DEFAULT '',
            output_method TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE SET NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_template_usage_created_at ON template_usage(created_at);
        CREATE INDEX IF NOT EXISTS idx_template_usage_template_id ON template_usage(template_id);
        CREATE TABLE IF NOT EXISTS project_emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            template_id INTEGER,
            template_name TEXT NOT NULL DEFAULT '',
            recipient TEXT NOT NULL DEFAULT '',
            cc TEXT NOT NULL DEFAULT '',
            subject TEXT NOT NULL,
            body_text TEXT NOT NULL,
            body_html TEXT NOT NULL DEFAULT '',
            created_by INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE SET NULL,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_project_emails_project_id ON project_emails(project_id,created_at);
        CREATE TABLE IF NOT EXISTS bid_question_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS bid_question_topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            UNIQUE(category_id,name),
            FOREIGN KEY(category_id) REFERENCES bid_question_categories(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS standard_bid_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            topic_id INTEGER NOT NULL,
            short_question TEXT NOT NULL,
            question TEXT NOT NULL DEFAULT '',
            answer TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(topic_id) REFERENCES bid_question_topics(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_standard_bid_answers_topic_id ON standard_bid_answers(topic_id);
        CREATE TABLE IF NOT EXISTS standard_bid_answer_variants (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            standard_answer_id INTEGER NOT NULL,
            decision TEXT NOT NULL CHECK(decision IN ('zugelassen','abgelehnt')),
            answer TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(standard_answer_id) REFERENCES standard_bid_answers(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_bid_answer_variants_parent
            ON standard_bid_answer_variants(standard_answer_id,decision,sort_order);
        CREATE TABLE IF NOT EXISTS bidders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bidder TEXT UNIQUE NOT NULL,
            company_name TEXT NOT NULL DEFAULT '',
            street TEXT NOT NULL DEFAULT '',
            postal_code TEXT NOT NULL DEFAULT '',
            city TEXT NOT NULL DEFAULT '',
            country TEXT NOT NULL DEFAULT '',
            website TEXT NOT NULL DEFAULT '',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS project_api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL,
            last_used_at TEXT,
            revoked_at TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS bid_questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            bidder TEXT NOT NULL DEFAULT '',
            subject TEXT NOT NULL DEFAULT '',
            question TEXT NOT NULL,
            agency_comment TEXT NOT NULL DEFAULT '',
            decision TEXT NOT NULL DEFAULT '',
            answer TEXT NOT NULL DEFAULT '',
            category_id INTEGER,
            topic_id INTEGER,
            bidder_id INTEGER,
            standard_answer_id INTEGER,
            standard_variant_id INTEGER,
            answered_at TEXT,
            answered_by INTEGER,
            created_by INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(category_id) REFERENCES bid_question_categories(id) ON DELETE SET NULL,
            FOREIGN KEY(topic_id) REFERENCES bid_question_topics(id) ON DELETE SET NULL,
            FOREIGN KEY(bidder_id) REFERENCES bidders(id) ON DELETE SET NULL,
            FOREIGN KEY(standard_answer_id) REFERENCES standard_bid_answers(id) ON DELETE SET NULL,
            FOREIGN KEY(standard_variant_id) REFERENCES standard_bid_answer_variants(id) ON DELETE SET NULL,
            FOREIGN KEY(answered_by) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_bid_questions_project_id ON bid_questions(project_id,created_at);
        CREATE TABLE IF NOT EXISTS document_templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            original_filename TEXT NOT NULL,
            docx_blob BLOB NOT NULL,
            placeholder_keys_json TEXT NOT NULL DEFAULT '[]',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS document_template_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER NOT NULL,
            version_no INTEGER NOT NULL,
            name TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            docx_blob BLOB NOT NULL,
            created_by INTEGER,
            created_at TEXT NOT NULL,
            UNIQUE(template_id,version_no),
            FOREIGN KEY(template_id) REFERENCES document_templates(id) ON DELETE CASCADE,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS project_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            template_id INTEGER,
            template_name TEXT NOT NULL,
            filename TEXT NOT NULL,
            content_type TEXT NOT NULL,
            content BLOB NOT NULL,
            created_by INTEGER,
            created_at TEXT NOT NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(template_id) REFERENCES document_templates(id) ON DELETE SET NULL,
            FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_project_documents ON project_documents(project_id,id);
        CREATE TABLE IF NOT EXISTS document_text_blocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            block_key TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            active INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS document_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER,
            template_name TEXT NOT NULL,
            user_id INTEGER,
            project_id INTEGER,
            output_method TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY(template_id) REFERENCES document_templates(id) ON DELETE SET NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE SET NULL
        );
        CREATE TABLE IF NOT EXISTS schema_meta (
            id INTEGER PRIMARY KEY CHECK(id=1),
            schema_version INTEGER NOT NULL,
            migrated_at TEXT NOT NULL
        );
        """)
        user_columns = {row["name"] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
        if "role_id" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN role_id INTEGER")
        if "failed_login_attempts" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER NOT NULL DEFAULT 0")
        if "locked_until" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN locked_until TEXT")
        if "password_policy_exempt" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN password_policy_exempt INTEGER NOT NULL DEFAULT 0")
        if "show_favorites" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN show_favorites INTEGER NOT NULL DEFAULT 0")
        if "show_quicklinks" not in user_columns:
            conn.execute("ALTER TABLE users ADD COLUMN show_quicklinks INTEGER NOT NULL DEFAULT 0")
        settings_columns = {row["name"] for row in conn.execute("PRAGMA table_info(app_settings)").fetchall()}
        if "navigation_order_json" not in settings_columns:
            conn.execute("ALTER TABLE app_settings ADD COLUMN navigation_order_json TEXT NOT NULL DEFAULT ''")
        quicklink_columns = {row["name"] for row in conn.execute("PRAGMA table_info(dashboard_quicklinks)").fetchall()}
        if "link_type" not in quicklink_columns:
            conn.execute("ALTER TABLE dashboard_quicklinks ADD COLUMN link_type TEXT NOT NULL DEFAULT 'external'")
        if "target" not in quicklink_columns:
            conn.execute("ALTER TABLE dashboard_quicklinks ADD COLUMN target TEXT NOT NULL DEFAULT ''")
        role_columns = {row["name"] for row in conn.execute("PRAGMA table_info(roles)").fetchall()}
        if "all_categories" not in role_columns:
            conn.execute("ALTER TABLE roles ADD COLUMN all_categories INTEGER NOT NULL DEFAULT 1")
        template_columns = {row["name"] for row in conn.execute("PRAGMA table_info(templates)").fetchall()}
        project_columns = {row["name"] for row in conn.execute("PRAGMA table_info(projects)").fetchall()}
        bid_question_columns = {row["name"] for row in conn.execute("PRAGMA table_info(bid_questions)").fetchall()}
        if "category_id" not in bid_question_columns:
            conn.execute("ALTER TABLE bid_questions ADD COLUMN category_id INTEGER")
        if "topic_id" not in bid_question_columns:
            conn.execute("ALTER TABLE bid_questions ADD COLUMN topic_id INTEGER")
        if "answered_at" not in bid_question_columns:
            conn.execute("ALTER TABLE bid_questions ADD COLUMN answered_at TEXT")
        if "answered_by" not in bid_question_columns:
            conn.execute("ALTER TABLE bid_questions ADD COLUMN answered_by INTEGER")
        if "bidder_id" not in bid_question_columns:
            conn.execute("ALTER TABLE bid_questions ADD COLUMN bidder_id INTEGER")
        if "standard_answer_id" not in bid_question_columns:
            conn.execute("ALTER TABLE bid_questions ADD COLUMN standard_answer_id INTEGER")
        if "standard_variant_id" not in bid_question_columns:
            conn.execute("ALTER TABLE bid_questions ADD COLUMN standard_variant_id INTEGER")
        if "question_year" not in bid_question_columns:
            conn.execute("ALTER TABLE bid_questions ADD COLUMN question_year INTEGER")
            conn.execute("UPDATE bid_questions SET question_year=? WHERE question_year IS NULL",(VERSION_YEAR,))
        bidder_columns = {row["name"] for row in conn.execute("PRAGMA table_info(bidders)")}
        if "comment" not in bidder_columns:
            conn.execute("ALTER TABLE bidders ADD COLUMN comment TEXT NOT NULL DEFAULT ''")
        variant_columns = {row["name"] for row in conn.execute("PRAGMA table_info(standard_bid_answer_variants)").fetchall()}
        if "short_description" not in variant_columns:
            conn.execute("ALTER TABLE standard_bid_answer_variants ADD COLUMN short_description TEXT NOT NULL DEFAULT ''")
        bid_answer_columns = {row["name"] for row in conn.execute("PRAGMA table_info(standard_bid_answers)").fetchall()}
        if "agency_comment" not in bid_answer_columns:
            conn.execute("ALTER TABLE standard_bid_answers ADD COLUMN agency_comment TEXT NOT NULL DEFAULT ''")
        # Every legacy standard answer becomes one reusable answer case with a
        # first variant. The legacy answer column remains as a compatibility
        # fallback for older exports and can be removed in a later major release.
        conn.execute("""INSERT INTO standard_bid_answer_variants
            (standard_answer_id,decision,answer,sort_order,created_at,updated_at)
            SELECT a.id,'zugelassen',a.answer,0,a.created_at,a.updated_at
            FROM standard_bid_answers a
            WHERE TRIM(COALESCE(a.answer,''))<>'' AND NOT EXISTS
              (SELECT 1 FROM standard_bid_answer_variants v WHERE v.standard_answer_id=a.id)""")
        if "archived" not in project_columns:
            conn.execute("ALTER TABLE projects ADD COLUMN archived INTEGER NOT NULL DEFAULT 0")
        if "archived" not in template_columns:
            conn.execute("ALTER TABLE templates ADD COLUMN archived INTEGER NOT NULL DEFAULT 0")
        if "category_id" not in template_columns:
            conn.execute("ALTER TABLE templates ADD COLUMN category_id INTEGER")
        if "notice_text" not in template_columns:
            conn.execute("ALTER TABLE templates ADD COLUMN notice_text TEXT NOT NULL DEFAULT ''")
        if "notice_mode" not in template_columns:
            conn.execute("ALTER TABLE templates ADD COLUMN notice_mode TEXT NOT NULL DEFAULT 'display'")
        if "notice_enabled" not in template_columns:
            conn.execute("ALTER TABLE templates ADD COLUMN notice_enabled INTEGER NOT NULL DEFAULT 0")
            conn.execute("UPDATE templates SET notice_enabled=1 WHERE TRIM(COALESCE(notice_text,''))<>''")
        if "notice_html" not in template_columns:
            conn.execute("ALTER TABLE templates ADD COLUMN notice_html TEXT NOT NULL DEFAULT ''")
            for row in conn.execute("SELECT id,notice_text FROM templates WHERE TRIM(COALESCE(notice_text,''))<>''").fetchall():
                conn.execute("UPDATE templates SET notice_html=? WHERE id=?",
                             (plain_text_to_html(row["notice_text"]),row["id"]))
        if "notice_button_label" not in template_columns:
            conn.execute("ALTER TABLE templates ADD COLUMN notice_button_label TEXT NOT NULL DEFAULT 'Hinweistext gesehen'")
        if "body_html" not in template_columns:
            conn.execute("ALTER TABLE templates ADD COLUMN body_html TEXT NOT NULL DEFAULT ''")
        if "sort_order" not in template_columns:
            conn.execute("ALTER TABLE templates ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
            # Give existing templates a stable order inside every category.
            for category in conn.execute("SELECT DISTINCT category_id FROM templates").fetchall():
                rows = conn.execute(
                    "SELECT id FROM templates WHERE category_id IS ? ORDER BY name,id",
                    (category[0],),
                ).fetchall()
                for position, row in enumerate(rows):
                    conn.execute("UPDATE templates SET sort_order=? WHERE id=?", (position,row[0]))
        # Existing databases keep their text templates and receive equivalent,
        # style-free HTML automatically during the migration.
        legacy_templates = conn.execute(
            "SELECT id,body FROM templates WHERE TRIM(COALESCE(body_html,''))=''"
        ).fetchall()
        for legacy in legacy_templates:
            conn.execute("UPDATE templates SET body_html=? WHERE id=?",
                         (plain_text_to_html(legacy["body"]),legacy["id"]))
        conn.execute("""INSERT OR IGNORE INTO roles
            (name,permissions_json,all_templates,is_system,created_at)
            VALUES (?,?,?,?,?)""",
            ("Administrator",json.dumps(ALL_PERMISSIONS),1,1,now_iso()))
        conn.execute("""INSERT OR IGNORE INTO roles
            (name,permissions_json,all_templates,is_system,created_at)
            VALUES (?,?,?,?,?)""",
            ("Benutzer",json.dumps(["email_create","projects_view","projects_manage"]),1,1,now_iso()))
        # Version 1.2 fasst die drei administrativen Leserechte in einem
        # gemeinsamen Systemrecht zusammen. Bestehende Rollen behalten Zugriff,
        # sobald ihnen zuvor mindestens eines der alten Rechte zugewiesen war.
        legacy_system_permissions = {"audit_view","usage_view","system_status_view"}
        for role_row in conn.execute("SELECT id,permissions_json FROM roles").fetchall():
            try:
                role_permissions = set(json.loads(role_row["permissions_json"] or "[]"))
            except (TypeError, ValueError):
                role_permissions = set()
            had_legacy_system_access = bool(role_permissions & legacy_system_permissions)
            role_permissions -= legacy_system_permissions
            if had_legacy_system_access:
                role_permissions.add("system_view")
            role_permissions &= set(ALL_PERMISSIONS)
            conn.execute("UPDATE roles SET permissions_json=? WHERE id=?",
                         (json.dumps(sorted(role_permissions)),role_row["id"]))
        admin_role_id = conn.execute("SELECT id FROM roles WHERE name='Administrator'").fetchone()[0]
        user_role_id = conn.execute("SELECT id FROM roles WHERE name='Benutzer'").fetchone()[0]
        conn.execute("""UPDATE roles SET permissions_json=?,all_templates=1,all_categories=1
            WHERE id=?""",(json.dumps(ALL_PERMISSIONS),admin_role_id))
        conn.execute("""UPDATE users SET role_id=CASE WHEN role='admin' THEN ? ELSE ? END
            WHERE role_id IS NULL""",(admin_role_id,user_role_id))

        # Bootstrap only an empty installation. Never repair/reactivate an
        # existing account implicitly, regardless of its username.
        if not conn.execute("SELECT 1 FROM users LIMIT 1").fetchone():
            if DEMO_MODE:
                username, password, recovery = "admin", "Admin12345!", "WIES-2026-TEST"
            else:
                import getpass
                if not sys.stdin.isatty():
                    raise RuntimeError("Ersteinrichtung benötigt eine lokale Konsole. Für isolierte Tests WVE_DEMO_MODE=1 setzen.")
                username = input("Erster Administrator – Benutzername [admin]: ").strip() or "admin"
                while True:
                    password = getpass.getpass("Passwort (mindestens 10 Zeichen, Groß-/Kleinbuchstaben und Zahl): ")
                    error = validate_password(password)
                    if error:
                        print(error); continue
                    if password == getpass.getpass("Passwort wiederholen: "): break
                    print("Die Passwörter stimmen nicht überein.")
                recovery = secrets.token_urlsafe(24)
            conn.execute("""INSERT INTO users
                (username,first_name,last_name,email,password_hash,recovery_hash,role,active,must_change,created_at,role_id)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (username,"System","Administrator","",ph.hash(password),ph.hash(recovery),"admin",1,0,now_iso(),admin_role_id))
            print(f"Administrator {username} angelegt. Wiederherstellungscode (einmalig): {recovery}")
            if DEMO_MODE: print("DEMO-MODUS: admin / Admin12345! – nicht öffentlich betreiben!")
        tcount = conn.execute("SELECT COUNT(*) FROM templates").fetchone()[0]
        if tcount == 0:
            for t in DEFAULT_TEMPLATES:
                conn.execute("""INSERT INTO templates
                    (name,category,subject,body,fields_json,active,created_at,updated_at)
                    VALUES (?,?,?,?,?,1,?,?)""",
                    (t["name"],t["category"],t["subject"],t["body"],json.dumps(t["fields"],ensure_ascii=False),now_iso(),now_iso()))
            for row in conn.execute(
                    "SELECT id,body FROM templates WHERE TRIM(COALESCE(body_html,''))=''"
            ).fetchall():
                conn.execute("UPDATE templates SET body_html=? WHERE id=?",
                             (plain_text_to_html(row["body"]),row["id"]))
        conn.execute("UPDATE templates SET category='Allgemein' WHERE TRIM(category)='' OR category IS NULL")
        category_names = [row[0] for row in conn.execute(
            "SELECT DISTINCT category FROM templates ORDER BY category").fetchall()]
        for order, category_name in enumerate(category_names):
            conn.execute("""INSERT OR IGNORE INTO categories(name,active,sort_order,created_at)
                VALUES (?,1,?,?)""",(category_name,order,now_iso()))
        conn.execute("""UPDATE templates SET category_id=(
            SELECT id FROM categories WHERE categories.name=templates.category)
            WHERE category_id IS NULL""")
        vcount = conn.execute("SELECT COUNT(*) FROM variables").fetchone()[0]
        if vcount == 0:
            for order, variable in enumerate(DEFAULT_VARIABLES):
                key, label, field_type, source, required = variable
                conn.execute("""INSERT INTO variables
                    (key,label,field_type,source,required,active,sort_order)
                    VALUES (?,?,?,?,?,1,?)""",
                    (key,label,field_type,source,required,order))
        conn.execute("""INSERT OR IGNORE INTO app_settings(id,app_name,logo_data)
            VALUES (1,'Wieseke Vorlagen-Engine','')""")
        if previous < SCHEMA_VERSION:
            migrations.migrate(conn, previous, SCHEMA_VERSION)

        # Every existing template receives a baseline version once. Later saves
        # append immutable snapshots, which can be inspected and restored.
        for template in conn.execute("SELECT * FROM templates ORDER BY id").fetchall():
            if not conn.execute("SELECT 1 FROM template_versions WHERE template_id=? LIMIT 1",(template["id"],)).fetchone():
                save_template_version(conn,template["id"],None)
        for template in conn.execute("SELECT id FROM document_templates").fetchall():
            if not conn.execute("SELECT 1 FROM document_template_versions WHERE template_id=?",(template["id"],)).fetchone():
                save_document_version(conn,template["id"],None)

def save_document_version(conn, template_id, user_id):
    """Keep original DOCX files so replacing a template remains reversible."""
    row=conn.execute("SELECT * FROM document_templates WHERE id=?",(template_id,)).fetchone()
    number=conn.execute("SELECT COALESCE(MAX(version_no),0)+1 FROM document_template_versions WHERE template_id=?",(template_id,)).fetchone()[0]
    conn.execute("""INSERT INTO document_template_versions(template_id,version_no,name,original_filename,docx_blob,created_by,created_at)
        VALUES(?,?,?,?,?,?,?)""",(template_id,number,row["name"],row["original_filename"],row["docx_blob"],user_id,now_iso()))

def document_analysis(conn, raw):
    return document_tools.inspect_template(raw,
        conn.execute("SELECT * FROM document_text_blocks").fetchall(),
        conn.execute("SELECT key,active FROM variables").fetchall())

def template_snapshot(row):
    """Return the complete editable template state for versioning."""
    keys = ("name","category","category_id","subject","body","body_html","fields_json",
            "active","notice_text","notice_mode","notice_enabled","notice_html",
            "notice_button_label","sort_order","archived")
    return {key: row[key] for key in keys}


def save_template_version(conn, template_id, user_id):
    row = conn.execute("SELECT * FROM templates WHERE id=?",(template_id,)).fetchone()
    if not row:
        return None
    version_no = conn.execute(
        "SELECT COALESCE(MAX(version_no),0)+1 FROM template_versions WHERE template_id=?",
        (template_id,),
    ).fetchone()[0]
    conn.execute("""INSERT INTO template_versions
        (template_id,version_no,snapshot_json,created_at,created_by) VALUES (?,?,?,?,?)""",
        (template_id,version_no,json.dumps(template_snapshot(row),ensure_ascii=False),now_iso(),user_id))
    return version_no


def audit_event(conn, current, action, entity_type, entity_id="", summary=""):
    """Record administrative metadata, never secrets or generated email bodies."""
    conn.execute("""INSERT INTO audit_log
        (user_id,username,action,entity_type,entity_id,summary,created_at)
        VALUES (?,?,?,?,?,?,?)""",(
        current["id"] if current else None,
        current["username"] if current else "System",
        action,entity_type,str(entity_id or ""),str(summary or "")[:500],now_iso()
    ))


def template_export_dict(row):
    """Return a portable, content-only representation of one mail template."""
    return {
        "id": row["id"],
        "name": row["name"],
        "category": row["category"],
        "category_id": row["category_id"],
        "subject": row["subject"],
        "body": row["body"],
        "body_html": row["body_html"] or plain_text_to_html(row["body"]),
        "fields": json.loads(row["fields_json"] or "[]"),
        "active": bool(row["active"]),
        "archived": bool(row["archived"]),
        "notice": {
            "enabled": bool(row["notice_enabled"]),
            "mode": row["notice_mode"],
            "text": row["notice_text"],
            "html": row["notice_html"] or plain_text_to_html(row["notice_text"]),
            "button_label": row["notice_button_label"] or "Hinweistext gesehen",
        },
        "sort_order": row["sort_order"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def safe_export_filename(value, fallback="vorlage"):
    """Create a portable file name without path separators or control characters."""
    cleaned = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "_", str(value or "")).strip(" ._")
    return (cleaned[:120] or fallback)


def template_eml_bytes(row):
    """All EML exports share the same CID image representation."""
    body_html = sanitize_email_html(row["body_html"], row["body"])
    return email_images.build_eml(row["subject"], html_to_plain_text(body_html), body_html)

def binary_response(handler, payload, content_type, filename):
    """Send a non-cacheable download with a Unicode-safe file name."""
    fallback = re.sub(r"[^A-Za-z0-9._-]+", "_", filename).strip("._") or "download"
    handler.send_response(200)
    handler.send_header("Content-Type", content_type)
    handler.send_header(
        "Content-Disposition",
        f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(filename)}",
    )
    handler.send_header("Content-Length", str(len(payload)))
    handler.send_header("Cache-Control", "no-store")
    security_headers(handler)
    handler.end_headers()
    handler.wfile.write(payload)


def system_status_dict():
    """Collect operational metadata without exposing paths or confidential content."""
    with db() as conn:
        counts = {
            "users_total": conn.execute("SELECT COUNT(*) FROM users").fetchone()[0],
            "users_active": conn.execute("SELECT COUNT(*) FROM users WHERE active=1").fetchone()[0],
            "templates_total": conn.execute("SELECT COUNT(*) FROM templates").fetchone()[0],
            "templates_active": conn.execute("SELECT COUNT(*) FROM templates WHERE active=1 AND archived=0").fetchone()[0],
            "projects_total": conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0],
            "projects_active": conn.execute("SELECT COUNT(*) FROM projects WHERE archived=0").fetchone()[0],
            "project_emails": conn.execute("SELECT COUNT(*) FROM project_emails").fetchone()[0],
            "bid_questions": conn.execute("SELECT COUNT(*) FROM bid_questions").fetchone()[0],
            "bid_answers": conn.execute("SELECT COUNT(*) FROM standard_bid_answers").fetchone()[0],
            "usage_events": conn.execute("SELECT COUNT(*) FROM template_usage").fetchone()[0],
        }
    backups = [path for path in backup_directory().glob("*.db") if path.is_file()]
    latest = max(backups, key=lambda path: path.stat().st_mtime) if backups else None
    return {
        "version": SOFTWARE_VERSION,
        "version_year": VERSION_YEAR,
        "schema_version": SCHEMA_VERSION,
        "database_size_bytes": DB_PATH.stat().st_size if DB_PATH.exists() else 0,
        "last_backup_at": datetime.fromtimestamp(latest.stat().st_mtime, timezone.utc).isoformat() if latest else None,
        "last_backup_name": latest.name if latest else "",
        "started_at": STARTED_AT.isoformat(),
        "sessions_active": len(SESSIONS),
        **{key: int(value) for key, value in counts.items()},
    }


def backup_directory():
    path = DB_PATH.parent / "backups"
    path.mkdir(parents=True,exist_ok=True)
    return path


def create_database_backup(prefix="wieseke"):
    """Create a consistent SQLite backup without copying a live database file."""
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    target = backup_directory() / f"{prefix}-{stamp}.db"
    source = sqlite3.connect(DB_PATH)
    destination = sqlite3.connect(target)
    try:
        source.backup(destination)
    finally:
        destination.close()
        source.close()
    return target


def create_daily_backup():
    today = datetime.now(timezone.utc).strftime("%Y%m%d")
    existing = list(backup_directory().glob(f"daily-{today}-*.db"))
    if not existing and DB_PATH.exists():
        create_database_backup(f"daily-{today}")
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    for path in backup_directory().glob("daily-*.db"):
        if datetime.fromtimestamp(path.stat().st_mtime, timezone.utc) < cutoff:
            path.unlink(missing_ok=True)


def backup_worker(stop):
    """Periodic service, also protects long-running installations."""
    while not stop.wait(3600):
        try: create_daily_backup()
        except Exception as error: print(f"WARNUNG: tägliche Sicherung fehlgeschlagen: {error}")


def revoke_credentials(conn, user_id, *, keys=True):
    for token, session in list(SESSIONS.items()):
        if session["user_id"] == user_id:
            SESSIONS.pop(token, None)
    if keys:
        conn.execute("UPDATE project_api_keys SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL", (now_iso(),user_id))


def security_headers(handler):
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.send_header("X-Frame-Options", "DENY")
    handler.send_header("Referrer-Policy", "no-referrer")
    handler.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    handler.send_header("Content-Security-Policy",
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; "
        "script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")


def json_response(handler, status, payload, extra_headers=None):
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(raw)))
    handler.send_header("Cache-Control", "no-store")
    security_headers(handler)
    if extra_headers:
        for k,v in extra_headers.items(): handler.send_header(k,v)
    handler.end_headers()
    handler.wfile.write(raw)

def read_json(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    path = urlparse(handler.path).path
    image_request = path.startswith(("/api/email/", "/api/templates")) or bool(re.fullmatch(r"/api/projects/\d+/emails",path))
    maximum = 30_000_000 if path == "/api/admin/restore" else (15_000_000 if image_request or path.startswith(("/api/document-templates", "/api/bid/xlsx/")) else 2_000_000)
    if length > maximum:
        raise ValueError("Anfrage ist zu groß.")
    raw = handler.rfile.read(length)
    return json.loads(raw.decode("utf-8") or "{}")

def cookie_session(handler):
    raw = handler.headers.get("Cookie", "")
    c = cookies.SimpleCookie()
    c.load(raw)
    token = c.get("wve_session")
    if not token: return None
    session = SESSIONS.get(token.value)
    if not session: return None
    if session["expires"] < datetime.now(timezone.utc):
        SESSIONS.pop(token.value, None)
        return None
    session["expires"] = datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS)
    return session


def csrf_valid(handler):
    session = cookie_session(handler)
    supplied = handler.headers.get("X-CSRF-Token", "")
    return bool(session and supplied and hmac.compare_digest(supplied,session.get("csrf_token", "")))

def user_with_role(conn, *, user_id=None, username=None, active_only=False):
    where = "u.id=?" if user_id is not None else "u.username=?"
    value = user_id if user_id is not None else username
    if active_only: where += " AND u.active=1"
    return conn.execute(f"""SELECT u.*,r.name AS role_name,
        r.permissions_json,r.all_templates,r.all_categories,r.is_system AS role_system
        FROM users u LEFT JOIN roles r ON r.id=u.role_id WHERE {where}""",(value,)).fetchone()

def permissions_from_row(row):
    if not row: return []
    try:
        return [permission for permission in json.loads(row["permissions_json"] or "[]")
                if permission in PERMISSIONS]
    except (KeyError, TypeError, json.JSONDecodeError):
        return ALL_PERMISSIONS if row["role"] == "admin" else ["email_create","projects_view","projects_manage"]

def user_dict(row):
    permissions = permissions_from_row(row)
    return {
        "id": row["id"], "username": row["username"], "first_name": row["first_name"],
        "last_name": row["last_name"], "email": row["email"],
        "role": "admin" if "roles_manage" in permissions else "user",
        "role_id": row["role_id"], "role_name": row["role_name"] or row["role"],
        "permissions": permissions,
        "active": bool(row["active"]), "must_change": bool(row["must_change"]),
        "failed_login_attempts": int(row["failed_login_attempts"] or 0),
        "locked_until": row["locked_until"],
        "failed_recovery_attempts": row["failed_recovery_attempts"],
        "recovery_locked_until": row["recovery_locked_until"],
        "password_policy_exempt": bool(row["password_policy_exempt"])
    }

def role_dict(row, category_ids=None):
    return {
        "id": row["id"], "name": row["name"],
        "permissions": [permission for permission in json.loads(row["permissions_json"] or "[]")
                        if permission in PERMISSIONS],
        "all_categories": bool(row["all_categories"]),
        "is_system": bool(row["is_system"]),
        "category_ids": category_ids or []
    }

def category_dict(row):
    return {"id":row["id"],"name":row["name"],"active":bool(row["active"]),
            "sort_order":row["sort_order"]}

def bid_category_dict(row):
    return {"id":row["id"],"name":row["name"],"active":bool(row["active"]),
            "sort_order":row["sort_order"]}

def bid_topic_dict(row):
    return {"id":row["id"],"category_id":row["category_id"],"name":row["name"],
            "active":bool(row["active"]),"sort_order":row["sort_order"]}

def bid_answer_dict(row, variants=None):
    return {"id":row["id"],"topic_id":row["topic_id"],
            "category_id":row["category_id"],"category_name":row["category_name"],
            "topic_name":row["topic_name"],"short_question":row["short_question"],
            "question":row["question"],"agency_comment":row["agency_comment"],
            "answer":row["answer"],"variants":variants or [],
            "created_at":row["created_at"],"updated_at":row["updated_at"]}

def document_template_dict(row):
    try:
        placeholders = json.loads(row["placeholder_keys_json"] or "[]")
    except (TypeError, json.JSONDecodeError):
        placeholders = []
    return {"id":row["id"],"name":row["name"],"description":row["description"],
            "original_filename":row["original_filename"],"placeholders":placeholders,
            "active":bool(row["active"]),"created_at":row["created_at"],"updated_at":row["updated_at"]}

def document_block_dict(row):
    return {"id":row["id"],"key":row["block_key"],"name":row["name"],
            "category":row["category"],"content":row["content"],"active":bool(row["active"]),
            "sort_order":row["sort_order"],"created_at":row["created_at"],"updated_at":row["updated_at"]}

def extract_docx_placeholders(raw):
    source=document_tools.docx_source(raw)
    # Syntax mistakes are shown as advice in the editor, not a save barrier.
    try: return document_tools.expression_keys(source)
    except Exception: return []

def set_nested_value(target, dotted_key, value):
    parts = str(dotted_key).split(".")
    current = target
    for part in parts[:-1]:
        if not isinstance(current.get(part),dict): current[part] = {}
        current = current[part]
    current[parts[-1]] = value

def office_converter_path():
    candidates = [shutil.which("soffice"),shutil.which("libreoffice"),
                  r"C:\Program Files\LibreOffice\program\soffice.exe",
                  r"C:\Program Files (x86)\LibreOffice\program\soffice.exe"]
    return next((str(path) for path in candidates if path and Path(path).exists()),None)

def render_document(template_row, values, project_data, user_row):
    context = json.loads(json.dumps(project_data or {}))
    for key,value in (values or {}).items():
        if isinstance(key,str) and key and not isinstance(value,(dict,list)):
            set_nested_value(context,key,value)
    context["benutzer"] = {"vorname":user_row["first_name"],"nachname":user_row["last_name"],
                            "email":user_row["email"],"benutzername":user_row["username"]}
    context.setdefault("kontakte",[])
    environment = document_tools.template_environment(autoescape=True)
    with db() as conn:
        block_rows = conn.execute("SELECT * FROM document_text_blocks WHERE active=1 ORDER BY sort_order,id").fetchall()
    context["baustein"] = document_tools.LazyBlocks(block_rows,context)
    try:
        template = DocxTemplate(io.BytesIO(template_row["docx_blob"]))
        template.render(context,jinja_env=environment)
        output = io.BytesIO(); template.save(output)
        return output.getvalue()
    except Exception as error:
        raise ValueError(f"Dokument konnte nicht erzeugt werden: {error}")

def bidder_dict(row):
    return {"id":row["id"],"bidder":row["bidder"],"company_name":row["company_name"],
            "street":row["street"],"postal_code":row["postal_code"],"city":row["city"],
            "country":row["country"],"website":row["website"],"comment":row["comment"],"active":bool(row["active"]),
            "created_at":row["created_at"],"updated_at":row["updated_at"]}

def bid_question_dict(row):
    return {"id":row["id"],"project_id":row["project_id"],
            "project_key":row["project_key"],"project_name":row["project_name"],
            "category":row["category"],"bidder":row["bidder"],"subject":row["subject"],
            "question_year":row["question_year"] or VERSION_YEAR,
            "question":row["question"],"agency_comment":row["agency_comment"],
            "decision":row["decision"],"answer":row["answer"],
            "category_id":row["category_id"],"topic_id":row["topic_id"],
            "bidder_id":row["bidder_id"],"standard_answer_id":row["standard_answer_id"],
            "standard_variant_id":row["standard_variant_id"],
            "answered_at":row["answered_at"],"answered_by":row["answered_by"],
            "created_at":row["created_at"],"updated_at":row["updated_at"]}

def variable_dict(row):
    return {
        "id": row["id"], "key": row["key"], "label": row["label"],
        "type": row["field_type"], "source": row["source"],
        "required": bool(row["required"]), "active": bool(row["active"]),
        "sort_order": row["sort_order"]
    }

def settings_dict():
    with db() as conn:
        row = conn.execute("SELECT app_name,logo_data,navigation_order_json,navigation_areas_json FROM app_settings WHERE id=1").fetchone()
    try:
        navigation_order = json.loads(row["navigation_order_json"] or "[]") if row else []
    except (TypeError, ValueError):
        navigation_order = []
    if set(navigation_order) != set(MAIN_NAV_KEYS) or len(navigation_order) != len(MAIN_NAV_KEYS):
        navigation_order = list(MAIN_NAV_KEYS)
    return {
        "app_name": row["app_name"] if row else "Wieseke Vorlagen-Engine",
        "logo_data": row["logo_data"] if row else "",
        "navigation_order": navigation_order,
        "navigation_areas": json.loads(row["navigation_areas_json"] or '{}') if row else {},
    }

def software_info_dict():
    """Return read-only release information for the settings page."""
    with db() as conn:
        template_count = conn.execute("SELECT COUNT(*) FROM templates").fetchone()[0]
    return {
        "version": SOFTWARE_VERSION,
        "template_count": int(template_count),
        "version_year": VERSION_YEAR,
    }

def valid_variable_payload(data):
    key = str(data.get("key", "")).strip()
    label = str(data.get("label", "")).strip()
    field_type = str(data.get("type", "text")).strip()
    source = str(data.get("source", "manual")).strip()
    if not re.fullmatch(r"[a-zA-Z0-9_äöüÄÖÜß-]+(?:\.[a-zA-Z0-9_äöüÄÖÜß-]+)+", key):
        return None, "Der Schlüssel muss mindestens einen Punkt enthalten und darf keine Leerzeichen enthalten."
    if not label:
        return None, "Eine Beschriftung ist erforderlich."
    if field_type not in VARIABLE_TYPES or source not in VARIABLE_SOURCES:
        return None, "Feldtyp oder Datenquelle ist ungültig."
    return {
        "key": key, "label": label, "field_type": field_type,
        "source": source, "required": 1 if data.get("required") else 0,
        "active": 1 if data.get("active", True) else 0
    }, None

def normalize_template_fields(fields):
    """Validate template-defined fields and turn them into reusable manual variables."""
    if not isinstance(fields,list):
        return None, "Die benutzerdefinierten Platzhalter sind ungültig."
    normalized = []
    for field in fields:
        if not isinstance(field,dict):
            return None, "Ein benutzerdefinierter Platzhalter ist ungültig."
        key = str(field.get("key","")).strip()
        if "." not in key: key = "eingabe." + key
        label = str(field.get("label",key)).strip()
        field_type = str(field.get("type","text"))
        if (not re.fullmatch(r"[a-zA-Z0-9_äöüÄÖÜß-]+(?:\.[a-zA-Z0-9_äöüÄÖÜß-]+)+",key)
                or not label or field_type not in VARIABLE_TYPES):
            return None, f"Der Platzhalter '{key}' ist ungültig."
        normalized.append({"key":key,"label":label,"type":field_type,
                           "required":bool(field.get("required"))})
    return normalized, None

def sync_custom_variables(conn, fields):
    """Add new template fields to the central catalog without overwriting edited catalog entries."""
    next_order = conn.execute("SELECT COALESCE(MAX(sort_order),-1)+1 FROM variables").fetchone()[0]
    for field in fields:
        exists = conn.execute("SELECT id FROM variables WHERE key=?",(field["key"],)).fetchone()
        if exists: continue
        conn.execute("""INSERT INTO variables
            (key,label,field_type,source,required,active,sort_order)
            VALUES (?,?,?,?,?,1,?)""",
            (field["key"],field["label"],field["type"],"manual",
             1 if field["required"] else 0,next_order))
        next_order += 1

def valid_role_payload(data):
    name = str(data.get("name", "")).strip()
    if not name:
        return None, "Ein Rollenname ist erforderlich."
    permissions = data.get("permissions", [])
    category_ids = data.get("category_ids", [])
    if not isinstance(permissions,list) or not isinstance(category_ids,list):
        return None, "Berechtigungen oder Kategoriezugriffe sind ungültig."
    permissions = list(dict.fromkeys(
        permission for permission in permissions if permission in PERMISSIONS
    ))
    if "projects_manage" in permissions and "projects_view" not in permissions:
        permissions.append("projects_view")
    try:
        category_ids = list(dict.fromkeys(int(category_id) for category_id in category_ids))
    except (TypeError, ValueError):
        return None, "Kategoriezugriffe sind ungültig."
    return {
        "name": name, "permissions": permissions,
        "all_categories": 1 if data.get("all_categories",True) else 0,
        "category_ids": category_ids
    }, None

def save_role_categories(conn, role_id, payload):
    conn.execute("DELETE FROM role_categories WHERE role_id=?",(role_id,))
    if not payload["all_categories"]:
        for category_id in payload["category_ids"]:
            conn.execute("""INSERT OR IGNORE INTO role_categories(role_id,category_id)
                SELECT ?,id FROM categories WHERE id=?""",(role_id,category_id))

def accessible_category_rows(conn, current):
    """Return only categories granted to the current role."""
    permissions = set(permissions_from_row(current))
    if {"categories_manage","templates_manage","roles_manage"} & permissions:
        return conn.execute("SELECT * FROM categories ORDER BY sort_order,name").fetchall()
    if bool(current["all_categories"]):
        return conn.execute("SELECT * FROM categories WHERE active=1 ORDER BY sort_order,name").fetchall()
    return conn.execute("""SELECT c.* FROM categories c
        JOIN role_categories rc ON rc.category_id=c.id
        WHERE rc.role_id=? AND c.active=1 ORDER BY c.sort_order,c.name""",
        (current["role_id"],)).fetchall()

def accessible_template_rows(conn, current):
    """Template access is derived exclusively from the accessible categories."""
    permissions = set(permissions_from_row(current))
    if {"templates_manage","roles_manage"} & permissions:
        return conn.execute("""SELECT t.* FROM templates t
            LEFT JOIN categories c ON c.id=t.category_id
            ORDER BY COALESCE(c.sort_order,999999),t.sort_order,t.name,t.id""").fetchall()
    category_ids = [row["id"] for row in accessible_category_rows(conn,current)]
    if not category_ids: return []
    placeholders = ",".join("?" for _ in category_ids)
    return conn.execute(f"""SELECT t.* FROM templates t
        LEFT JOIN categories c ON c.id=t.category_id
        WHERE t.active=1 AND t.archived=0 AND t.category_id IN ({placeholders})
        ORDER BY COALESCE(c.sort_order,999999),t.sort_order,t.name,t.id""",category_ids).fetchall()

def validate_password(p):
    if len(p) < 10: return "Das Passwort muss mindestens 10 Zeichen lang sein."
    if not re.search(r"[A-ZÄÖÜ]", p): return "Mindestens ein Großbuchstabe ist erforderlich."
    if not re.search(r"[a-zäöüß]", p): return "Mindestens ein Kleinbuchstabe ist erforderlich."
    if not re.search(r"\d", p): return "Mindestens eine Zahl ist erforderlich."
    return None

def validate_user_password(password, policy_exempt=False):
    """Apply the configured policy, while never accepting an empty password."""
    if not password:
        return "Das Passwort darf nicht leer sein."
    return None if policy_exempt else validate_password(password)

# Progressive login throttling. After the ninth consecutive failure the
# account stays locked for 30 minutes until the time expires or an admin unlocks it.
LOGIN_LOCK_SECONDS = {3: 1, 4: 3, 5: 5, 6: 10, 7: 15, 8: 30}

def authenticate_user(conn, username, password):
    row = user_with_role(conn,username=username,active_only=True)
    if not row:
        return None, "invalid", 0

    now = datetime.now(timezone.utc)
    if row["locked_until"]:
        try:
            locked_until = datetime.fromisoformat(row["locked_until"])
            remaining = math.ceil((locked_until-now).total_seconds())
            if remaining > 0:
                return None, "locked", remaining
        except ValueError:
            pass

    try:
        valid = ph.verify(row["password_hash"], password)
    except VerifyMismatchError:
        valid = False
    if valid:
        conn.execute("UPDATE users SET failed_login_attempts=0,locked_until=NULL WHERE id=?",(row["id"],))
        return user_with_role(conn,user_id=row["id"],active_only=True), "ok", 0

    attempts = int(row["failed_login_attempts"] or 0) + 1
    duration = LOGIN_LOCK_SECONDS.get(attempts, 1800 if attempts >= 9 else 0)
    locked_until = (now+timedelta(seconds=duration)).isoformat() if duration else None
    conn.execute("UPDATE users SET failed_login_attempts=?,locked_until=? WHERE id=?",
                 (attempts,locked_until,row["id"]))
    return None, "locked" if duration else "invalid", duration

def redirect(handler, location, set_cookie=None):
    handler.send_response(303)
    handler.send_header("Location", location)
    handler.send_header("Cache-Control", "no-store")
    security_headers(handler)
    if set_cookie:
        handler.send_header("Set-Cookie", set_cookie)
    handler.end_headers()

def read_form(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    raw = handler.rfile.read(length).decode("utf-8", errors="replace")
    return {k: v[-1] for k, v in parse_qs(raw).items()}

class ApplicationServices:
    """Late-bound services keep test databases and runtime configuration injectable."""
    def __getattr__(self, name):
        return globals()[name]


class Handler(BaseHTTPRequestHandler):
    services = ApplicationServices()
    """Small JSON/HTML HTTP application used by the local prototype."""
    server_version = f"WiesekeVorlagenEngine/{SOFTWARE_VERSION}"

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")

    def serve_file(self, rel):
        path = (STATIC_DIR / rel).resolve()
        if not path.is_relative_to(STATIC_DIR.resolve()) or not path.exists() or not path.is_file():
            self.send_error(404); return
        data = path.read_bytes()
        mime = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        security_headers(self)
        self.end_headers()
        self.wfile.write(data)

    def require_auth(self, admin=False, permission=None):
        # Defense in depth: a newly extracted route cannot accidentally bypass
        # the adapter's CSRF gate by dispatching before a verb-specific check.
        if self.command not in {'GET','HEAD','OPTIONS'} and not csrf_valid(self):
            json_response(self,403,{"error":"Sicherheitsprüfung fehlgeschlagen. Bitte die Seite neu laden."});return None
        session = cookie_session(self)
        if not session:
            json_response(self, 401, {"error":"Nicht angemeldet."}); return None
        with db() as conn:
            row = user_with_role(conn,user_id=session["user_id"],active_only=True)
        if not row:
            json_response(self, 401, {"error":"Konto nicht verfügbar."}); return None
        if row["must_change"] and urlparse(self.path).path not in {"/api/me", "/api/change-password", "/api/logout"}:
            json_response(self, 403, {"error":"Bitte ändern Sie zuerst Ihr Passwort.", "code":"password_change_required"}); return None
        required_permission = permission or ("roles_manage" if admin else None)
        if required_permission and required_permission not in permissions_from_row(row):
            json_response(self, 403, {"error":"Für diese Funktion fehlt die erforderliche Berechtigung."}); return None
        target_match = re.fullmatch(r"/api/users/(\d+)(?:/(?:password|recovery|reset|unlock))?", urlparse(self.path).path)
        if target_match:
            with db() as conn:
                error = self.target_account_error(conn, row, int(target_match[1]))
            if error:
                json_response(self, 403, {"error":error}); return None
        return row

    def target_account_error(self, conn, actor, target_id):
        target = user_with_role(conn, user_id=target_id)
        error = account_security.target_error(actor, target, permissions_from_row)
        if error or account_security.is_system_admin(actor): return error
        if not actor["all_categories"]:
            grants = lambda uid: {r[0] for r in conn.execute("SELECT category_id FROM role_categories WHERE role_id=?", (uid,))}
            if not grants(target["role_id"]).issubset(grants(actor["role_id"])):
                return "Das Zielkonto besitzt weitergehenden Zugriff auf Mailkategorien."
        return None

    def do_GET(self):
        p = urlparse(self.path).path
        if p == "/api/integration/keys":
            current=self.require_auth()
            if not current:return
            admin="users_manage" in permissions_from_row(current)
            if not admin and "projects_api_create" not in permissions_from_row(current):
                return json_response(self,403,{"error":"Keine Berechtigung für API-Schlüssel."})
            with db() as conn:
                rows=conn.execute("""SELECT k.id,k.user_id,u.username,k.created_at,k.last_used_at,k.revoked_at
                    FROM project_api_keys k JOIN users u ON u.id=k.user_id
                    WHERE (? OR k.user_id=?) ORDER BY k.id DESC""",(admin,current["id"])).fetchall()
                candidates=conn.execute("SELECT id FROM users WHERE active=1" + ("" if admin else " AND id=?"),() if admin else (current["id"],)).fetchall()
                targets=[user_with_role(conn,user_id=row["id"]) for row in candidates]
            return json_response(self,200,{"keys":[dict(row) for row in rows],"users":[{"id":row["id"],"username":row["username"]} for row in targets if "projects_api_create" in permissions_from_row(row)]})
        if p in {"/", "/excel-import"} or re.fullmatch(r"/vorlage/\d+",p) or re.fullmatch(r"/app/[a-z-]+(?:/\d+)?",p): return self.serve_file("index.html")
        if p == "/health": return json_response(self,200,{"ok":True,"version":SOFTWARE_VERSION,"schema_version":SCHEMA_VERSION})
        if p.startswith("/static/"): return self.serve_file(p[len("/static/"):])
        if p == "/api/public-settings":
            return json_response(self,200,{"settings":settings_dict(),"version":SOFTWARE_VERSION})
        if p == "/api/me":
            row = self.require_auth()
            session = cookie_session(self)
            if row: json_response(self,200,{"user":user_dict(row),"csrf_token":session["csrf_token"]})
            return
        if administration_routes.get(self, p, None) is not False: return
        if mail_routes.get(self, p, None) is not False: return
        if documents_routes.get(self, p, None) is not False: return
        if bids_routes.get(self, p, None) is not False: return
        if projects_routes.get(self, p, None) is not False: return
        self.send_error(404)

    def create_project_via_api(self):
        """Create-only integration, with live role checks and atomic uniqueness."""
        def fail(status, message):
            return json_response(self,status,{"error":message}, {"Retry-After":"60"} if status==429 else None)
        if not api_rate_allowed("ip:"+self.client_address[0],300):
            return fail(429,"Zu viele Anfragen. Bitte nach 60 Sekunden erneut versuchen.")
        authorization = self.headers.get("Authorization","")
        match = re.fullmatch(r"Bearer (wve_[A-Za-z0-9_-]{43})",authorization)
        if not match:return fail(401,"Ein gültiger Bearer-API-Schlüssel ist erforderlich.")
        digest = hashlib.sha256(match.group(1).encode()).hexdigest()
        if not api_rate_allowed("key:"+digest,60):return fail(429,"Höchstens 60 Anfragen pro Minute je Schlüssel.")
        # Authenticate before reading a potentially large request body.
        with db() as conn:
            key = conn.execute("SELECT * FROM project_api_keys WHERE token_hash=? AND revoked_at IS NULL",(digest,)).fetchone()
            user = user_with_role(conn,user_id=key["user_id"],active_only=True) if key else None
        if not user:return fail(401,"API-Schlüssel ungültig oder Konto deaktiviert.")
        if user["must_change"] or "projects_api_create" not in permissions_from_row(user):
            return fail(403,"Das Konto ist für die Projekt-API nicht freigegeben.")
        if self.headers.get_content_type() != "application/json":return fail(415,"Content-Type muss application/json sein.")
        try:length=int(self.headers.get("Content-Length","0"))
        except ValueError:return fail(400,"Ungültige Inhaltslänge.")
        if length>256_000:return fail(413,"Die Anfrage darf höchstens 256.000 Bytes enthalten.")
        if length<=0:return fail(400,"Ein JSON-Projekt ist erforderlich.")
        try:
            payload=json.loads(self.rfile.read(length).decode("utf-8-sig"))
            payload = project_service.validate_project(payload, require_schema=True)
            project=payload.get("projekt")
            if not isinstance(project,dict):raise ValueError("projekt muss ein Objekt sein.")
            for field,maximum in [("id",200),("bezeichnung",1000)]:
                value=project.get(field)
                if not isinstance(value,str) or not value.strip() or len(value)>maximum or any(ord(c)<32 for c in value):
                    raise ValueError(f"projekt.{field} muss ein nichtleerer Text mit höchstens {maximum} Zeichen sein.")
                project[field]=value.strip()
            if "auftraggeber" in payload and not isinstance(payload["auftraggeber"],dict):raise ValueError("auftraggeber muss ein Objekt sein.")
            contacts=payload.get("kontakte",[])
            if not isinstance(contacts,list) or len(contacts)>100 or any(not isinstance(item,dict) for item in contacts):
                raise ValueError("kontakte muss eine Liste mit höchstens 100 Kontaktobjekten sein.")
            if any(not isinstance(value,str) for item in contacts for value in item.values()):
                raise ValueError("Kontaktfelder müssen Texte sein.")
            payload["kontakte"]=contacts
        except (ValueError,TypeError,RecursionError) as error:return fail(400,str(error))
        try:
            with db() as conn:
                conn.execute("BEGIN IMMEDIATE")
                # Recheck after taking the write lock so revocation wins against
                # concurrent calls and duplicate IDs can never update a project.
                key=conn.execute("SELECT * FROM project_api_keys WHERE token_hash=? AND revoked_at IS NULL",(digest,)).fetchone()
                user=user_with_role(conn,user_id=key["user_id"],active_only=True) if key else None
                if not user:return fail(401,"API-Schlüssel wurde gesperrt.")
                if user["must_change"] or "projects_api_create" not in permissions_from_row(user):return fail(403,"API-Berechtigung fehlt.")
                cur=conn.execute("INSERT INTO projects(project_key,name,data_json,imported_at,imported_by,archived) VALUES(?,?,?,?,?,0)",
                    (project["id"],project["bezeichnung"],json.dumps(payload,ensure_ascii=False),now_iso(),user["id"]))
                conn.execute("UPDATE project_api_keys SET last_used_at=? WHERE id=?",(now_iso(),key["id"]))
                audit_event(conn,user,"create","project",cur.lastrowid,f"Projekt {project['id']} über API angelegt")
                project_id=cur.lastrowid
        except sqlite3.IntegrityError:return fail(409,"Diese Projekt-ID existiert bereits, gegebenenfalls im Archiv.")
        return json_response(self,201,{"ok":True,"id":project_id,"project_key":project["id"]})

    def do_POST(self):
        p = urlparse(self.path).path
        # Only this isolated integration endpoint accepts a bearer key. Browser
        # endpoints keep their session + CSRF checks, and never accept that key.
        if p == "/api/integration/projects":
            return self.create_project_via_api()

        # Klassischer HTML-Formular-Login: funktioniert ohne JavaScript.
        if p == "/login":
            data = read_form(self)
            username = str(data.get("username", "")).strip()
            password = str(data.get("password", ""))
            next_path = str(data.get("next", "/"))
            if not (re.fullmatch(r"/(?:vorlage/\d+|app/[a-z-]+(?:/\d+)?)",next_path) or next_path == "/excel-import"):
                next_path = "/"
            with db() as conn:
                row, status, retry_after = authenticate_user(conn,username,password)
            if not row:
                error_value = f"locked&retry={retry_after}" if status == "locked" else "1"
                error_location = next_path + ("?" if "?" not in next_path else "&") + "login_error=" + error_value
                return redirect(self, error_location)
            token = secrets.token_urlsafe(32)
            SESSIONS[token] = {"user_id": row["id"], "expires": datetime.now(timezone.utc)+timedelta(hours=SESSION_HOURS),
                               "csrf_token":secrets.token_urlsafe(32)}
            secure = "; Secure" if SECURE_COOKIES else ""
            return redirect(self, next_path, f"wve_session={token}; HttpOnly; SameSite=Strict; Path=/{secure}")

        if p not in {"/api/login","/api/recover"} and p.startswith("/api/") and not csrf_valid(self):
            return json_response(self,403,{"error":"Sicherheitsprüfung fehlgeschlagen. Bitte die Seite neu laden."})

        try:
            data = read_json(self)
        except Exception as e:
            return json_response(self,400,{"error":f"Ungültige Anfrage: {e}"})

        if p in {"/api/integration/keys", "/api/integration/keys/revoke"}:
            current = self.require_auth()
            if not current:return
            try: target_id = int(data.get("user_id",current["id"]))
            except (TypeError,ValueError):return json_response(self,400,{"error":"Ungültiger Benutzer."})
            permissions = permissions_from_row(current)
            if target_id != current["id"] and "users_manage" not in permissions:
                return json_response(self,403,{"error":"Keine Berechtigung für diesen Benutzer."})
            if "projects_api_create" not in permissions and "users_manage" not in permissions:
                return json_response(self,403,{"error":"Keine Berechtigung für API-Schlüssel."})
            with db() as conn:
                conn.execute("BEGIN IMMEDIATE")
                target = user_with_role(conn,user_id=target_id,active_only=True)
                error = self.target_account_error(conn, current, target_id)
                if error: return json_response(self,403,{"error":error})
                if p.endswith("/revoke"):
                    conn.execute("UPDATE project_api_keys SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",(now_iso(),target_id))
                    audit_event(conn,current,"revoke","api-key",target_id,"Projekt-API-Schlüssel gesperrt")
                    return json_response(self,200,{"ok":True})
                if not target or "projects_api_create" not in permissions_from_row(target):
                    return json_response(self,403,{"error":"Der Benutzer benötigt die Rollenberechtigung Projekte über API anlegen."})
                if target["must_change"]:
                    return json_response(self,403,{"error":"Der Benutzer muss zuerst sein Passwort ändern."})
                token = "wve_" + secrets.token_urlsafe(32)
                # High-entropy random tokens use SHA-256; unlike passwords they
                # cannot be guessed from a human-selected dictionary.
                digest = hashlib.sha256(token.encode()).hexdigest()
                conn.execute("UPDATE project_api_keys SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL",(now_iso(),target_id))
                conn.execute("INSERT INTO project_api_keys(user_id,token_hash,created_at) VALUES(?,?,?)",(target_id,digest,now_iso()))
                audit_event(conn,current,"create","api-key",target_id,"Projekt-API-Schlüssel erstellt/erneuert")
            return json_response(self,201,{"token":token,"username":target["username"]})

        if p == "/api/login":
            username = str(data.get("username","")).strip()
            password = str(data.get("password",""))
            with db() as conn:
                row, status, retry_after = authenticate_user(conn,username,password)
            if not row:
                message = (f"Das Konto ist noch {retry_after} Sekunden gesperrt."
                           if status == "locked" else "Benutzername oder Passwort ist falsch.")
                return json_response(self,429 if status == "locked" else 401,
                                     {"error":message,"retry_after":retry_after})
            token = secrets.token_urlsafe(32)
            csrf_token = secrets.token_urlsafe(32)
            SESSIONS[token] = {"user_id":row["id"],"expires":datetime.now(timezone.utc)+timedelta(hours=SESSION_HOURS),
                               "csrf_token":csrf_token}
            secure = "; Secure" if SECURE_COOKIES else ""
            header = {"Set-Cookie":f"wve_session={token}; HttpOnly; SameSite=Strict; Path=/{secure}"}
            return json_response(self,200,{"user":user_dict(row),"csrf_token":csrf_token},header)

        if p == "/api/logout":
            raw = self.headers.get("Cookie","")
            c = cookies.SimpleCookie(); c.load(raw)
            if c.get("wve_session"): SESSIONS.pop(c["wve_session"].value,None)
            return json_response(self,200,{"ok":True},{"Set-Cookie":"wve_session=; Max-Age=0; Path=/; SameSite=Strict"})

        if administration_routes.post(self, p, data) is not False: return
        if mail_routes.post(self, p, data) is not False: return
        if projects_routes.post(self, p, data) is not False: return
        if bids_routes.post(self, p, data) is not False: return
        if documents_routes.post(self, p, data) is not False: return

        if p == "/api/admin/restore":
            current = self.require_auth(permission="backup_manage")
            if not current: return
            encoded = str(data.get("database_base64", ""))
            try: raw = base64.b64decode(encoded,validate=True)
            except Exception: return json_response(self,400,{"error":"Die Sicherungsdatei ist ungültig."})
            if len(raw) > 20_000_000:
                return json_response(self,400,{"error":"Die Sicherungsdatei ist größer als 20 MB."})
            safety = create_database_backup("before-restore")
            temp_path = None
            try:
                handle,temp_name = tempfile.mkstemp(suffix=".db",dir=str(DB_PATH.parent)); os.close(handle)
                temp_path = Path(temp_name); temp_path.write_bytes(raw)
                source = sqlite3.connect(temp_path)
                integrity = source.execute("PRAGMA integrity_check").fetchone()[0]
                required = {"users","projects","templates","app_settings"}
                found = {row[0] for row in source.execute("SELECT name FROM sqlite_master WHERE type='table'")}
                if integrity != "ok" or not required.issubset(found):
                    source.close(); return json_response(self,400,{"error":"Die Datei ist keine gültige Sicherung dieser Anwendung."})
                try: migrations.inspect_database(temp_path, SCHEMA_VERSION)
                except RuntimeError as error:
                    source.close(); return json_response(self,400,{"error":str(error)})
                target = sqlite3.connect(DB_PATH)
                try: source.backup(target)
                finally: target.close(); source.close()
                SESSIONS.clear()
                init_db()
            finally:
                if temp_path: temp_path.unlink(missing_ok=True)
            return json_response(self,200,{"ok":True,"safety_backup":safety.name})


        if p == "/api/recover":
            username = str(data.get("username","")).strip()
            code = str(data.get("recovery_code","")).strip()
            password = str(data.get("new_password",""))
            with db() as conn:
                conn.execute("BEGIN IMMEDIATE")
                row = conn.execute("SELECT * FROM users WHERE username=? AND active=1",(username,)).fetchone()
                if not api_rate_allowed("recover:"+self.client_address[0],30):
                    return json_response(self,429,{"error":"Zu viele Versuche. Bitte später erneut versuchen."})
                if row and row["recovery_locked_until"] and datetime.fromisoformat(row["recovery_locked_until"]) > datetime.now(timezone.utc):
                    return json_response(self,429,{"error":"Wiederherstellung vorübergehend gesperrt. Bitte später erneut versuchen."})
                err = validate_user_password(password, bool(row and row["password_policy_exempt"]))
                if err: return json_response(self,400,{"error":err})
                ok = False
                if row:
                    try: ok = ph.verify(row["recovery_hash"], code)
                    except VerifyMismatchError: ok = False
                if not ok:
                    if row:
                        attempts = row["failed_recovery_attempts"] + 1
                        duration = LOGIN_LOCK_SECONDS.get(attempts, 1800 if attempts >= 9 else 0)
                        until = (datetime.now(timezone.utc)+timedelta(seconds=duration)).isoformat() if duration else None
                        conn.execute("UPDATE users SET failed_recovery_attempts=?,recovery_locked_until=? WHERE id=?",(attempts,until,row["id"]))
                    return json_response(self,400,{"error":"Wiederherstellungsdaten sind ungültig."})
                new_code = "-".join([secrets.token_hex(2).upper() for _ in range(4)])
                conn.execute("""UPDATE users SET password_hash=?,recovery_hash=?,must_change=0,
                    failed_login_attempts=0,locked_until=NULL,failed_recovery_attempts=0,recovery_locked_until=NULL WHERE id=?""",
                    (ph.hash(password),ph.hash(new_code),row["id"]))
                revoke_credentials(conn, row["id"])
            return json_response(self,200,{"ok":True,"new_recovery_code":new_code})

        if p == "/api/change-password":
            row = self.require_auth()
            if not row: return
            old = str(data.get("old_password",""))
            new = str(data.get("new_password",""))
            err = validate_user_password(new, bool(row["password_policy_exempt"]))
            if err: return json_response(self,400,{"error":err})
            try: ph.verify(row["password_hash"], old)
            except VerifyMismatchError: return json_response(self,400,{"error":"Das bisherige Passwort ist falsch."})
            new_code = "-".join([secrets.token_hex(2).upper() for _ in range(4)])
            with db() as conn:
                conn.execute("UPDATE users SET password_hash=?,recovery_hash=?,must_change=0 WHERE id=?",
                             (ph.hash(new),ph.hash(new_code),row["id"]))
                revoke_credentials(conn, row["id"], keys=False)
                token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
                SESSIONS[token] = {"user_id":row["id"],"expires":datetime.now(timezone.utc)+timedelta(hours=SESSION_HOURS),"csrf_token":csrf}
            secure = "; Secure" if SECURE_COOKIES else ""
            return json_response(self,200,{"ok":True,"new_recovery_code":new_code,"csrf_token":csrf},
                                 {"Set-Cookie":f"wve_session={token}; HttpOnly; SameSite=Strict; Path=/{secure}"})


















        self.send_error(404)

    def do_PUT(self):
        p = urlparse(self.path).path
        if p.startswith("/api/") and not csrf_valid(self):
            return json_response(self,403,{"error":"Sicherheitsprüfung fehlgeschlagen. Bitte die Seite neu laden."})
        try: data = read_json(self)
        except Exception as e: return json_response(self,400,{"error":str(e)})

        if projects_routes.put(self, p, data) is not False: return
        if documents_routes.put(self, p, data) is not False: return
        if bids_routes.put(self, p, data) is not False: return
        if administration_routes.put(self, p, data) is not False: return
        if mail_routes.put(self, p, data) is not False: return



















        m = re.fullmatch(r"/api/templates/(\d+)/restore",p)
        if m:
            entity_id = int(m.group(1))
            current = self.require_auth(permission="templates_manage")
            if not current: return
            with db() as conn:
                cur = conn.execute("UPDATE templates SET archived=0 WHERE id=?",(entity_id,))
                if not cur.rowcount: return json_response(self,404,{"error":"Eintrag wurde nicht gefunden."})
                save_template_version(conn,entity_id,current["id"])
                audit_event(conn,current,"restore","template",entity_id,"Aus Archiv wiederhergestellt")
            return json_response(self,200,{"ok":True})








        self.send_error(404)

    def do_DELETE(self):
        p=urlparse(self.path).path
        if p.startswith("/api/") and not csrf_valid(self):
            return json_response(self,403,{"error":"Sicherheitsprüfung fehlgeschlagen. Bitte die Seite neu laden."})
        # Document assets are stored in SQLite, so deletion remains part of normal backups.
        if documents_routes.delete(self, p, None) is not False: return
        if bids_routes.delete(self, p, None) is not False: return
        if mail_routes.delete(self, p, None) is not False: return
        if re.fullmatch(r"/api/projects/\d+",p):
            try: data = read_json(self)
            except Exception as e: return json_response(self,400,{"error":str(e)})
            return projects_routes.delete(self,p,data)
        if administration_routes.delete(self, p, None) is not False: return
        m=re.fullmatch(r"/api/(projects|templates)/(\d+)/permanent",p)
        if m:
            current = self.require_auth(permission="roles_manage")
            if not current:return
            entity,entity_id=m.group(1),int(m.group(2))
            table="projects" if entity=="projects" else "templates"
            with db() as conn:
                row=conn.execute(f"SELECT archived FROM {table} WHERE id=?",(entity_id,)).fetchone()
                if not row:return json_response(self,404,{"error":"Eintrag wurde nicht gefunden."})
                if not row["archived"]:return json_response(self,409,{"error":"Nur archivierte Einträge können endgültig gelöscht werden."})
                audit_event(conn,current,"delete-permanent","project" if entity=="projects" else "template",entity_id,
                            "Archivierter Eintrag endgültig gelöscht")
                conn.execute(f"DELETE FROM {table} WHERE id=?",(entity_id,))
            return json_response(self,200,{"ok":True})
        self.send_error(404)

if __name__ == "__main__":
    init_db()
    create_daily_backup()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    actual_port = server.server_address[1]
    url = f"http://{HOST}:{actual_port}/"
    print(f"Wieseke Vorlagen-Engine v{SOFTWARE_VERSION} läuft unter {url}")
    print("Dieses Fenster muss geöffnet bleiben. Beenden mit Strg+C.")
    if OPEN_BROWSER:
        threading.Timer(1.0, lambda: webbrowser.open(url, new=1)).start()
    backup_stop = threading.Event()
    threading.Thread(target=backup_worker,args=(backup_stop,),daemon=True).start()
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally:
        backup_stop.set()
        server.server_close()
