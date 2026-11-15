
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
SOFTWARE_VERSION = "3.4"
VERSION_YEAR = 2026
SCHEMA_VERSION = 11
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

        # Die festen Testzugangsdaten werden nur beim erstmaligen Anlegen gesetzt.
        # Spätere Passwortänderungen bleiben dadurch auch nach einem Neustart erhalten.
        password = "Admin12345!"
        recovery = "WIES-2026-TEST"
        admin = conn.execute("SELECT id FROM users WHERE username='admin'").fetchone()
        admin_created = not bool(admin)
        if admin:
            conn.execute("""UPDATE users SET role='admin',active=1,must_change=0
                WHERE username='admin'""")
        else:
            conn.execute("""INSERT INTO users
                (username,first_name,last_name,email,password_hash,recovery_hash,role,active,must_change,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?)""",
                ("admin","System","Administrator","",ph.hash(password),ph.hash(recovery),"admin",1,0,now_iso()))
        conn.execute("UPDATE users SET role_id=? WHERE username='admin'",(admin_role_id,))
        print("\n" + "="*68)
        if admin_created:
            print("TESTZUGANG")
            print("Benutzername: admin")
            print("Passwort: Admin12345!")
            print("Wiederherstellungscode: WIES-2026-TEST")
            print("Diese Zugangsdaten gelten nur bis zu einer späteren Änderung.")
        else:
            print("Administratorkonto vorhanden. Das gespeicherte Passwort bleibt gültig.")
        print(f"Lokale Adresse: http://{HOST}:{PORT}/")
        print("="*68 + "\n")
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
        conn.execute("""INSERT INTO schema_meta(id,schema_version,migrated_at) VALUES (1,?,?)
            ON CONFLICT(id) DO UPDATE SET schema_version=excluded.schema_version,migrated_at=excluded.migrated_at""",
            (SCHEMA_VERSION,now_iso()))

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
    today = datetime.now().strftime("%Y%m%d")
    existing = list(backup_directory().glob(f"daily-{today}-*.db"))
    if not existing and DB_PATH.exists():
        create_database_backup(f"daily-{today}")
    cutoff = datetime.now() - timedelta(days=30)
    for path in backup_directory().glob("daily-*.db"):
        if datetime.fromtimestamp(path.stat().st_mtime) < cutoff:
            path.unlink(missing_ok=True)


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
        r.permissions_json,r.all_templates,r.all_categories
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
        row = conn.execute("SELECT app_name,logo_data,navigation_order_json FROM app_settings WHERE id=1").fetchone()
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

class Handler(BaseHTTPRequestHandler):
    """Small JSON/HTML HTTP application used by the local prototype."""
    server_version = f"WiesekeVorlagenEngine/{SOFTWARE_VERSION}"

    def log_message(self, fmt, *args):
        print(f"[{self.log_date_time_string()}] {fmt % args}")

    def serve_file(self, rel):
        path = (STATIC_DIR / rel).resolve()
        if not str(path).startswith(str(STATIC_DIR.resolve())) or not path.exists() or not path.is_file():
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
        session = cookie_session(self)
        if not session:
            json_response(self, 401, {"error":"Nicht angemeldet."}); return None
        with db() as conn:
            row = user_with_role(conn,user_id=session["user_id"],active_only=True)
        if not row:
            json_response(self, 401, {"error":"Konto nicht verfügbar."}); return None
        required_permission = permission or ("roles_manage" if admin else None)
        if required_permission and required_permission not in permissions_from_row(row):
            json_response(self, 403, {"error":"Für diese Funktion fehlt die erforderliche Berechtigung."}); return None
        return row

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
        if p in {"/", "/excel-import"} or re.fullmatch(r"/vorlage/\d+",p): return self.serve_file("index.html")
        if p == "/health": return json_response(self,200,{"ok":True,"version":SOFTWARE_VERSION,"schema_version":SCHEMA_VERSION})
        if p.startswith("/static/"): return self.serve_file(p[len("/static/"):])
        if p == "/api/public-settings":
            return json_response(self,200,{"settings":settings_dict()})
        if p == "/api/me":
            row = self.require_auth()
            session = cookie_session(self)
            if row: json_response(self,200,{"user":user_dict(row),"csrf_token":session["csrf_token"]})
            return
        if p == "/api/admin/backup":
            current = self.require_auth(permission="backup_manage")
            if not current: return
            path = create_database_backup("manual")
            with db() as conn:
                audit_event(conn,current,"download","backup",path.name,"Manuelle Datenbanksicherung erstellt")
            raw = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type","application/vnd.sqlite3")
            self.send_header("Content-Disposition",f'attachment; filename="{path.name}"')
            self.send_header("Content-Length",str(len(raw)))
            self.send_header("Cache-Control","no-store")
            security_headers(self)
            self.end_headers(); self.wfile.write(raw); return
        if p == "/api/audit":
            if not self.require_auth(permission="system_view"): return
            query = parse_qs(urlparse(self.path).query)
            try: limit = min(500,max(1,int(query.get("limit",[200])[0])))
            except ValueError: limit = 200
            with db() as conn:
                rows = conn.execute("SELECT * FROM audit_log ORDER BY id DESC LIMIT ?",(limit,)).fetchall()
            return json_response(self,200,{"entries":[dict(row) for row in rows]})
        if p == "/api/system-status":
            if not self.require_auth(permission="system_view"): return
            return json_response(self,200,{"status":system_status_dict()})
        if p == "/api/usage":
            if not self.require_auth(permission="system_view"): return
            query = parse_qs(urlparse(self.path).query)
            try: days = int(query.get("days",["30"])[0])
            except ValueError: days = 30
            days = days if days in {7,30,90,365} else 30
            since = (datetime.now(timezone.utc)-timedelta(days=days)).isoformat()
            with db() as conn:
                rows = conn.execute("""SELECT id,template_id,template_name,user_id,username,
                    project_id,project_key,output_method,created_at FROM template_usage
                    WHERE created_at>=? ORDER BY id DESC LIMIT 5000""",(since,)).fetchall()
            template_counts,method_counts,user_counts = {},{},{}
            for row in rows:
                template_counts[row["template_name"]] = template_counts.get(row["template_name"],0)+1
                method_counts[row["output_method"]] = method_counts.get(row["output_method"],0)+1
                user_counts[row["username"]] = user_counts.get(row["username"],0)+1
            ranked = lambda values: [{"name":name,"count":count} for name,count in sorted(values.items(),key=lambda item:(-item[1],item[0].lower()))]
            return json_response(self,200,{"days":days,"total":len(rows),
                "by_template":ranked(template_counts),"by_method":ranked(method_counts),
                "by_user":ranked(user_counts),"recent":[dict(row) for row in rows[:100]]})
        if p in {"/api/templates/export/json","/api/templates/export/eml"}:
            current = self.require_auth(permission="templates_export_all")
            if not current: return
            with db() as conn:
                rows = accessible_template_rows(conn,current)
                audit_event(conn,current,"export","templates","all",
                            f"{len(rows)} zugängliche Vorlagen exportiert")
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            if p.endswith("/json"):
                payload = json.dumps({"schema_version":"1.3","software_version":SOFTWARE_VERSION,
                    "exported_at":now_iso(),"templates":[template_export_dict(row) for row in rows]},
                    ensure_ascii=False,indent=2).encode("utf-8")
                return binary_response(self,payload,"application/json; charset=utf-8",
                                       f"Wieseke-Mailvorlagen-{stamp}.json")
            output = io.BytesIO()
            with zipfile.ZipFile(output,"w",compression=zipfile.ZIP_DEFLATED) as archive:
                for position,row in enumerate(rows,1):
                    archive.writestr(f"{position:03d}-{safe_export_filename(row['name'])}.eml",template_eml_bytes(row))
            return binary_response(self,output.getvalue(),"application/zip",
                                   f"Wieseke-Mailvorlagen-EML-{stamp}.zip")
        m = re.fullmatch(r"/api/templates/(\d+)/export/(json|eml)",p)
        if m:
            current = self.require_auth(permission="template_export")
            if not current: return
            template_id,export_type = int(m.group(1)),m.group(2)
            with db() as conn:
                accessible = {row["id"]:row for row in accessible_template_rows(conn,current)}
                row = accessible.get(template_id)
                if not row: return json_response(self,404,{"error":"Vorlage wurde nicht gefunden oder ist nicht freigegeben."})
                audit_event(conn,current,"export","template",template_id,
                            f"Vorlage als {export_type.upper()} exportiert")
            filename = safe_export_filename(row["name"])
            if export_type == "json":
                payload = json.dumps({"schema_version":"1.3","software_version":SOFTWARE_VERSION,
                    "exported_at":now_iso(),"template":template_export_dict(row)},
                    ensure_ascii=False,indent=2).encode("utf-8")
                return binary_response(self,payload,"application/json; charset=utf-8",f"{filename}.json")
            return binary_response(self,template_eml_bytes(row),"message/rfc822",f"{filename}.eml")
        m = re.fullmatch(r"/api/templates/(\d+)/versions",p)
        if m:
            if not self.require_auth(permission="templates_manage"): return
            with db() as conn:
                rows = conn.execute("""SELECT v.id,v.template_id,v.version_no,v.created_at,
                    v.created_by,u.username FROM template_versions v LEFT JOIN users u ON u.id=v.created_by
                    WHERE v.template_id=? ORDER BY v.version_no DESC""",(int(m.group(1)),)).fetchall()
            return json_response(self,200,{"versions":[dict(row) for row in rows]})
        if p == "/api/settings":
            if not self.require_auth(): return
            return json_response(self,200,{"settings":settings_dict(),"software":software_info_dict()})
        if p == "/api/variables":
            if not self.require_auth(): return
            with db() as conn:
                rows = conn.execute("SELECT * FROM variables ORDER BY sort_order,id").fetchall()
            return json_response(self,200,{"variables":[variable_dict(r) for r in rows]})
        m=re.fullmatch(r"/api/document-templates/(\d+)/(analysis|download|versions)(?:/(\d+)/download)?",p)
        if m:
            current=self.require_auth()
            if not current:return
            permissions=set(permissions_from_row(current))
            if not {"documents_create","document_templates_manage"}&permissions or (m.group(2)!="analysis" and "document_templates_manage" not in permissions):
                return json_response(self,403,{"error":"Für diese Funktion fehlt die Berechtigung."})
            with db() as conn:
                template=conn.execute("SELECT * FROM document_templates WHERE id=?",(int(m.group(1)),)).fetchone()
                if not template or (not template["active"] and "document_templates_manage" not in permissions):
                    return json_response(self,404,{"error":"Vorlage wurde nicht gefunden."})
                if m.group(2)=="analysis":return json_response(self,200,document_analysis(conn,template["docx_blob"]))
                if m.group(2)=="versions":
                    if m.group(3):
                        template=conn.execute("SELECT original_filename,docx_blob FROM document_template_versions WHERE id=? AND template_id=?",(int(m.group(3)),template["id"])).fetchone()
                        if not template:return json_response(self,404,{"error":"Version wurde nicht gefunden."})
                    else:
                        rows=conn.execute("SELECT id,version_no,original_filename,created_at FROM document_template_versions WHERE template_id=? ORDER BY version_no DESC",(template["id"],)).fetchall()
                        return json_response(self,200,{"versions":[dict(row) for row in rows]})
            return binary_response(self,template["docx_blob"],"application/vnd.openxmlformats-officedocument.wordprocessingml.document",template["original_filename"])
        m=re.fullmatch(r"/api/project-documents/(\d+)/download",p)
        if m:
            current=self.require_auth(permission="projects_view")
            if not current:return
            if not {"documents_create","document_templates_manage"}&set(permissions_from_row(current)):
                return json_response(self,403,{"error":"Für Dokumente fehlt die Berechtigung."})
            with db() as conn:row=conn.execute("SELECT * FROM project_documents WHERE id=?",(int(m.group(1)),)).fetchone()
            if not row:return json_response(self,404,{"error":"Dokument wurde nicht gefunden."})
            return binary_response(self,row["content"],row["content_type"],row["filename"])
        if p in {"/api/document-templates","/api/document-blocks","/api/documents/pdf-status"}:
            current=self.require_auth()
            if not current:return
            if not {"documents_create","document_templates_manage"}&set(permissions_from_row(current)):
                return json_response(self,403,{"error":"Für Dokumente fehlt die Berechtigung."})
        if p == "/api/document-templates":
            with db() as conn:
                rows=conn.execute("SELECT id,name,description,original_filename,placeholder_keys_json,active,created_at,updated_at FROM document_templates ORDER BY name,id").fetchall()
            return json_response(self,200,{"templates":[document_template_dict(row) for row in rows]})
        if p == "/api/bid/import-template":
            if not self.require_auth(permission="bid_questions_manage"): return
            with db() as conn:
                payload = bid_workbooks.make_template(conn)
            return binary_response(self,payload,bid_workbooks.MIME,"Bieterfragen_Vorlage.xlsx")
        if p == "/api/document-blocks":
            with db() as conn:
                rows=conn.execute("SELECT * FROM document_text_blocks ORDER BY sort_order,id").fetchall()
            return json_response(self,200,{"blocks":[document_block_dict(row) for row in rows]})
        if p == "/api/documents/pdf-status":
            return json_response(self,200,{"available":bool(office_converter_path()),
                "message":"PDF-Export ist verfügbar." if office_converter_path() else "PDF-Export benötigt LibreOffice auf dem Server."})
        if p == "/api/users":
            current = self.require_auth(permission="users_manage")
            if not current: return
            with db() as conn:
                rows = conn.execute("""SELECT u.*,r.name AS role_name,
                    r.permissions_json,r.all_templates,r.all_categories FROM users u
                    LEFT JOIN roles r ON r.id=u.role_id ORDER BY u.username""").fetchall()
            return json_response(self,200,{"users":[user_dict(r) for r in rows]})
        if p == "/api/roles":
            current = self.require_auth()
            if not current: return
            current_permissions = permissions_from_row(current)
            if not ({"roles_manage","users_manage"} & set(current_permissions)):
                return json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
            with db() as conn:
                rows = conn.execute("SELECT * FROM roles ORDER BY name").fetchall()
                roles = []
                for row in rows:
                    if ("roles_manage" not in current_permissions
                            and not set(json.loads(row["permissions_json"] or "[]")).issubset(set(current_permissions))):
                        continue
                    category_ids = [item[0] for item in conn.execute(
                        "SELECT category_id FROM role_categories WHERE role_id=? ORDER BY category_id",
                        (row["id"],)).fetchall()]
                    roles.append(role_dict(row,category_ids))
            return json_response(self,200,{"roles":roles,"permission_catalog":PERMISSIONS})
        m = re.fullmatch(r"/api/projects/(\d+)/workspace",p)
        if m:
            current = self.require_auth(permission="projects_view")
            if not current: return
            project_id = int(m.group(1))
            permissions = set(permissions_from_row(current))
            with db() as conn:
                project = conn.execute("SELECT id,project_key,name FROM projects WHERE id=?",(project_id,)).fetchone()
                if not project: return json_response(self,404,{"error":"Projekt wurde nicht gefunden."})
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
            return json_response(self,200,{"project":dict(project),
                "emails":[{"id":row["id"],"project_id":row["project_id"],
                    "template_id":row["template_id"],"template_name":row["template_name"],
                    "recipient":row["recipient"],"cc":row["cc"],"subject":row["subject"],
                    "body_text":row["body_text"],"body_html":row["body_html"],
                    "created_at":row["created_at"],"username":row["username"] or "System"}
                    for row in email_rows],
                "bid_questions":[bid_question_dict(row) for row in question_rows],
                "documents":[dict(row) for row in document_rows]})
        if p == "/api/bid/categories":
            current = self.require_auth()
            if not current: return
            if not ({"bid_questions_view","bid_questions_manage","bid_answers_manage"} & set(permissions_from_row(current))):
                return json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
            with db() as conn:
                rows=conn.execute("SELECT * FROM bid_question_categories ORDER BY sort_order,name").fetchall()
            return json_response(self,200,{"categories":[bid_category_dict(row) for row in rows]})
        if p == "/api/bid/topics":
            current = self.require_auth()
            if not current: return
            if not ({"bid_questions_view","bid_questions_manage","bid_answers_manage"} & set(permissions_from_row(current))):
                return json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
            with db() as conn:
                rows=conn.execute("""SELECT * FROM bid_question_topics
                    ORDER BY category_id,sort_order,name""").fetchall()
            return json_response(self,200,{"topics":[bid_topic_dict(row) for row in rows]})
        if p == "/api/bid/answers":
            current = self.require_auth()
            if not current: return
            if not ({"bid_questions_view","bid_questions_manage","bid_answers_manage"} & set(permissions_from_row(current))):
                return json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
            with db() as conn:
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
            return json_response(self,200,{"answers":[bid_answer_dict(
                row,variants_by_answer.get(row["id"],[])) for row in rows]})
        if p == "/api/bidders":
            current=self.require_auth()
            if not current:return
            if not ({"projects_view","bid_questions_view","bid_questions_manage"} & set(permissions_from_row(current))):
                return json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
            with db() as conn:
                rows=conn.execute("SELECT * FROM bidders ORDER BY active DESC,bidder COLLATE NOCASE").fetchall()
            return json_response(self,200,{"bidders":[bidder_dict(row) for row in rows]})
        if p == "/api/bidders/example-json":
            current=self.require_auth()
            if not current:return
            if "projects_view" not in permissions_from_row(current):
                return json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
            payload=json.dumps({"schema_version":"1.0","bidders":[{
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
            if not ({"bid_questions_view","bid_questions_manage"} & set(permissions_from_row(current))):
                return json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
            with db() as conn:
                rows=conn.execute("""SELECT bq.*,p.project_key,p.name AS project_name
                    FROM bid_questions bq JOIN projects p ON p.id=bq.project_id
                    ORDER BY bq.id DESC""").fetchall()
            return json_response(self,200,{"questions":[bid_question_dict(row) for row in rows]})
        if p == "/api/projects":
            if not self.require_auth(permission="projects_view"): return
            with db() as conn:
                rows = conn.execute("SELECT id,project_key,name,data_json,imported_at,archived FROM projects ORDER BY archived,project_key DESC").fetchall()
            return json_response(self,200,{"projects":[
                {"id":r["id"],"project_key":r["project_key"],"name":r["name"],
                 "data":json.loads(r["data_json"]),"imported_at":r["imported_at"],"archived":bool(r["archived"])} for r in rows]})
        if p == "/api/categories":
            current = self.require_auth()
            if not current: return
            with db() as conn:
                rows = accessible_category_rows(conn,current)
            return json_response(self,200,{"categories":[category_dict(row) for row in rows]})
        if p == "/api/templates":
            current = self.require_auth()
            if not current: return
            current_permissions = permissions_from_row(current)
            if not ({"email_create","templates_manage","roles_manage"} & set(current_permissions)):
                return json_response(self,403,{"error":"Für diese Funktion fehlt die erforderliche Berechtigung."})
            with db() as conn:
                rows = accessible_template_rows(conn,current)
            return json_response(self,200,{"templates":[
                {"id":r["id"],"name":r["name"],"category":r["category"],"category_id":r["category_id"],"subject":r["subject"],
                 "body":r["body"],"body_html":r["body_html"] or plain_text_to_html(r["body"]),
                 "fields":json.loads(r["fields_json"]),"active":bool(r["active"]),
                 "notice_text":r["notice_text"],"notice_mode":r["notice_mode"],
                 "notice_enabled":bool(r["notice_enabled"]),
                 "notice_html":r["notice_html"] or plain_text_to_html(r["notice_text"]),
                 "notice_button_label":r["notice_button_label"] or "Hinweistext gesehen",
                 "sort_order":r["sort_order"],"archived":bool(r["archived"])}
                for r in rows]})
        if p == "/api/favorites":
            current = self.require_auth(permission="email_create")
            if not current: return
            with db() as conn:
                accessible_ids={row["id"] for row in accessible_template_rows(conn,current)}
                favorite_ids=[row[0] for row in conn.execute(
                    "SELECT template_id FROM favorite_templates WHERE user_id=? ORDER BY created_at",
                    (current["id"],)).fetchall() if row[0] in accessible_ids]
            return json_response(self,200,{"template_ids":favorite_ids})
        if p == "/api/dashboard":
            current = self.require_auth(permission="email_create")
            if not current: return
            with db() as conn:
                category_rows = accessible_category_rows(conn,current)
                allowed_categories = {row["id"]:category_dict(row) for row in category_rows}
                template_rows = accessible_template_rows(conn,current)
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
            return json_response(self,200,{"tiles":tiles,"show_favorites":bool(current["show_favorites"]),
                "show_quicklinks":bool(current["show_quicklinks"]),
                "quicklinks":[dict(row) for row in quicklink_rows]})
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
            if not isinstance(payload,dict) or payload.get("schema_version")!="1.0":raise ValueError("schema_version muss 1.0 sein.")
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
            if not (re.fullmatch(r"/vorlage/\d+",next_path) or next_path == "/excel-import"):
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

        if p == "/api/usage":
            current = self.require_auth(permission="email_create")
            if not current: return
            try:
                template_id = int(data.get("template_id",0))
                project_id = int(data["project_id"]) if data.get("project_id") else None
            except (TypeError,ValueError):
                return json_response(self,400,{"error":"Vorlage oder Projekt ist ungültig."})
            output_method = str(data.get("output_method","")).strip().lower()
            if output_method not in {"eml","mailto","copy"}:
                return json_response(self,400,{"error":"Die Ausgabeart ist ungültig."})
            with db() as conn:
                accessible = {row["id"]:row for row in accessible_template_rows(conn,current)}
                template = accessible.get(template_id)
                if not template:
                    return json_response(self,404,{"error":"Vorlage wurde nicht gefunden oder ist nicht freigegeben."})
                project = conn.execute("SELECT id,project_key FROM projects WHERE id=?",(project_id,)).fetchone() if project_id else None
                conn.execute("""INSERT INTO template_usage
                    (template_id,template_name,user_id,username,project_id,project_key,output_method,created_at)
                    VALUES (?,?,?,?,?,?,?,?)""",(
                    template["id"],template["name"],current["id"],current["username"],
                    project["id"] if project else None,project["project_key"] if project else "",
                    output_method,now_iso()))
            return json_response(self,201,{"ok":True})

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
                target = sqlite3.connect(DB_PATH)
                try: source.backup(target)
                finally: target.close(); source.close()
                SESSIONS.clear()
                init_db()
            finally:
                if temp_path: temp_path.unlink(missing_ok=True)
            return json_response(self,200,{"ok":True,"safety_backup":safety.name})

        m = re.fullmatch(r"/api/templates/(\d+)/versions/(\d+)/restore",p)
        if m:
            current = self.require_auth(permission="templates_manage")
            if not current: return
            template_id,version_id = map(int,m.groups())
            with db() as conn:
                version = conn.execute("SELECT * FROM template_versions WHERE id=? AND template_id=?",
                                       (version_id,template_id)).fetchone()
                if not version: return json_response(self,404,{"error":"Vorlagenversion wurde nicht gefunden."})
                snapshot = json.loads(version["snapshot_json"])
                category_id = snapshot.get("category_id")
                if category_id and not conn.execute("SELECT 1 FROM mail_categories WHERE id=?", (category_id,)).fetchone():
                    return json_response(self,409,{"error":"Die in dieser Version verwendete Mailkategorie existiert nicht mehr."})
                columns = ["name","category","category_id","subject","body","body_html","fields_json","active",
                           "notice_text","notice_mode","notice_enabled","notice_html","notice_button_label","sort_order","archived"]
                conn.execute(f"UPDATE templates SET {','.join(column+'=?' for column in columns)},updated_at=? WHERE id=?",
                             [snapshot.get(column) for column in columns]+[now_iso(),template_id])
                new_version = save_template_version(conn,template_id,current["id"])
                audit_event(conn,current,"restore","template",template_id,
                            f"Version {version['version_no']} als Version {new_version} wiederhergestellt")
            return json_response(self,200,{"ok":True,"version_no":new_version})

        if p == "/api/recover":
            username = str(data.get("username","")).strip()
            code = str(data.get("recovery_code","")).strip()
            password = str(data.get("new_password",""))
            with db() as conn:
                row = conn.execute("SELECT * FROM users WHERE username=? AND active=1",(username,)).fetchone()
                err = validate_user_password(password, bool(row and row["password_policy_exempt"]))
                if err: return json_response(self,400,{"error":err})
                ok = False
                if row:
                    try: ok = ph.verify(row["recovery_hash"], code)
                    except VerifyMismatchError: ok = False
                if not ok: return json_response(self,400,{"error":"Wiederherstellungsdaten sind ungültig."})
                new_code = "-".join([secrets.token_hex(2).upper() for _ in range(4)])
                conn.execute("""UPDATE users SET password_hash=?,recovery_hash=?,must_change=0,
                    failed_login_attempts=0,locked_until=NULL WHERE id=?""",
                    (ph.hash(password),ph.hash(new_code),row["id"]))
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
            return json_response(self,200,{"ok":True,"new_recovery_code":new_code})

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
            with db() as conn:
                selected_role = conn.execute("SELECT * FROM roles WHERE id=?",(role_id,)).fetchone()
            if not username or not first or not last or not selected_role:
                return json_response(self,400,{"error":"Bitte alle Pflichtfelder korrekt ausfüllen."})
            selected_permissions = set(json.loads(selected_role["permissions_json"]))
            if not selected_permissions.issubset(set(permissions_from_row(current))):
                return json_response(self,403,{"error":"Sie dürfen keine Rolle mit weitergehenden Berechtigungen zuweisen."})
            legacy_role = "admin" if "roles_manage" in selected_permissions else "user"
            password = secrets.token_urlsafe(10) + "A1"
            recovery = "-".join([secrets.token_hex(2).upper() for _ in range(4)])
            try:
                with db() as conn:
                    cur = conn.execute("""INSERT INTO users
                    (username,first_name,last_name,email,password_hash,recovery_hash,role,active,must_change,created_at,role_id,password_policy_exempt)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (username,first,last,email,ph.hash(password),ph.hash(recovery),legacy_role,1,must_change,now_iso(),role_id,policy_exempt))
                    audit_event(conn,current,"create","user",cur.lastrowid,f"Benutzer {username} angelegt")
            except sqlite3.IntegrityError:
                return json_response(self,409,{"error":"Der Benutzername ist bereits vergeben."})
            return json_response(self,201,{"ok":True,"username":username,"temporary_password":password,"recovery_code":recovery})

        if p == "/api/projects":
            user = self.require_auth(permission="projects_manage")
            if not user: return
            payload = data.get("data", data)
            try:
                project_key = str(payload["projekt"]["id"]).strip()
                name = str(payload["projekt"]["bezeichnung"]).strip()
            except Exception:
                return json_response(self,400,{"error":"JSON benötigt projekt.id und projekt.bezeichnung."})
            if not project_key or not name:
                return json_response(self,400,{"error":"Projekt-ID und Projektbezeichnung dürfen nicht leer sein."})
            with db() as conn:
                existing = conn.execute("SELECT id FROM projects WHERE project_key=?",(project_key,)).fetchone()
                conn.execute("""INSERT INTO projects(project_key,name,data_json,imported_at,imported_by,archived)
                    VALUES(?,?,?,?,?,0)
                    ON CONFLICT(project_key) DO UPDATE SET name=excluded.name,data_json=excluded.data_json,
                    imported_at=excluded.imported_at,imported_by=excluded.imported_by,archived=0""",
                    (project_key,name,json.dumps(payload,ensure_ascii=False),now_iso(),user["id"]))
                project_id = (existing["id"] if existing else conn.execute("SELECT id FROM projects WHERE project_key=?",(project_key,)).fetchone()[0])
                audit_event(conn,user,"update" if existing else "create","project",project_id,
                            f"Projekt {project_key} {'aktualisiert' if existing else 'angelegt'}")
            return json_response(self,200,{"ok":True,"project_key":project_key})

        m = re.fullmatch(r"/api/projects/(\d+)/emails",p)
        if m:
            current = self.require_auth(permission="email_create")
            if not current: return
            if "projects_view" not in permissions_from_row(current):
                return json_response(self,403,{"error":"Für die Projektspeicherung fehlt die Projektberechtigung."})
            project_id = int(m.group(1))
            subject = str(data.get("subject","")).strip()
            try: body_html = sanitize_email_html(data.get("body_html",""),data.get("body_text",""))
            except ValueError as error: return json_response(self,400,{"error":str(error)})
            body_text = html_to_plain_text(body_html)
            if not subject or not body_text:
                return json_response(self,400,{"error":"Betreff und E-Mailtext dürfen nicht leer sein."})
            if len(subject)>1000 or len(body_text)>100000 or len(body_html)>email_images.MAX_HTML:
                return json_response(self,400,{"error":"Die E-Mail ist für die Projektspeicherung zu groß."})
            try: template_id = int(data["template_id"]) if data.get("template_id") else None
            except (TypeError,ValueError): template_id = None
            with db() as conn:
                project=conn.execute("SELECT id,project_key FROM projects WHERE id=? AND archived=0",(project_id,)).fetchone()
                if not project:return json_response(self,404,{"error":"Das aktive Projekt wurde nicht gefunden."})
                cur=conn.execute("""INSERT INTO project_emails
                    (project_id,template_id,template_name,recipient,cc,subject,body_text,body_html,created_by,created_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?)""",(project_id,template_id,
                    str(data.get("template_name","")).strip()[:300],str(data.get("recipient","")).strip()[:2000],
                    str(data.get("cc","")).strip()[:2000],subject,body_text,body_html,current["id"],now_iso()))
                audit_event(conn,current,"create","project-email",cur.lastrowid,
                            f"E-Mail in Projekt {project['project_key']} gespeichert")
            return json_response(self,201,{"ok":True,"id":cur.lastrowid})

        if p in {"/api/bid/xlsx/preview", "/api/bid/xlsx/import"}:
            current = self.require_auth(permission="bid_questions_manage")
            if not current: return
            try:
                raw = base64.b64decode(str(data.get("content_base64", "")), validate=True)
                project_id, year = int(data.get("project_id") or 0), int(data.get("year") or 0)
                with db() as conn:
                    # Validation and insertion share a write lock. A category
                    # changed after the preview is rechecked before any insert.
                    if p.endswith("/import"): conn.execute("BEGIN IMMEDIATE")
                    preview = bid_workbooks.preview_import(conn, raw, project_id, year)
                    if p.endswith("/preview"): return json_response(self,200,preview)
                    if not preview["valid"]:
                        return json_response(self,400,{"error":"Die Datei enthält Fehler. Bitte die Vorschau erneut prüfen.","preview":preview})
                    ids = bid_workbooks.commit_import(conn,preview,current["id"],now_iso())
                    audit_event(conn,current,"import","bid-question","xlsx",f"{len(ids)} Bieterfrage(n), {preview['duplicates']} Duplikate übersprungen")
                return json_response(self,201,{"created":len(ids),"ids":ids,"skipped":preview["duplicates"]})
            except (ValueError, TypeError) as error:
                return json_response(self,400,{"error":str(error)})
        if p == "/api/email/images":
            current=self.require_auth()
            if not current:return
            if not {"email_create","templates_manage"} & set(permissions_from_row(current)):
                return json_response(self,403,{"error":"Für diese Funktion fehlt die Berechtigung."})
            try:
                raw=base64.b64decode(str(data.get("content_base64","")),validate=True)
                content,subtype,width,height=email_images.normalize_image(raw)
                return json_response(self,200,{"src":email_images.data_url(content,subtype),"width":width,"height":height,"size":len(content)})
            except (ValueError,TypeError) as error:return json_response(self,400,{"error":str(error)})
        if p == "/api/email/eml":
            if not self.require_auth(permission="email_create"):return
            try:
                body_html=sanitize_email_html(data.get("body_html",""),data.get("body_text",""))
                subject=str(data.get("subject",""))[:1000]
                content=email_images.build_eml(subject,html_to_plain_text(body_html),body_html,
                    str(data.get("recipient",""))[:4000],str(data.get("cc",""))[:4000])
                return binary_response(self,content,"message/rfc822",safe_export_filename(subject,"E-Mail")+".eml")
            except ValueError as error:return json_response(self,400,{"error":str(error)})
        if p == "/api/document-templates/inspect":
            if not self.require_auth(permission="document_templates_manage"):return
            try:
                raw=base64.b64decode(str(data.get("content_base64","")),validate=True)
                with db() as conn:analysis=document_analysis(conn,raw)
                return json_response(self,200,analysis)
            except (ValueError,TypeError) as error:return json_response(self,400,{"error":str(error)})
        if p == "/api/document-templates":
            current=self.require_auth(permission="document_templates_manage")
            if not current:return
            name=str(data.get("name","")).strip(); filename=str(data.get("filename","")).strip()
            try: raw=base64.b64decode(str(data.get("content_base64","")).split(",")[-1],validate=True)
            except Exception:return json_response(self,400,{"error":"Die DOCX-Datei konnte nicht gelesen werden."})
            if not name:return json_response(self,400,{"error":"Ein Vorlagenname ist erforderlich."})
            if not filename.lower().endswith(".docx") or not raw or len(raw)>10_000_000:
                return json_response(self,400,{"error":"Bitte eine DOCX-Datei mit höchstens 10 MB auswählen."})
            try: placeholders=extract_docx_placeholders(raw)
            except ValueError as error:return json_response(self,400,{"error":str(error)})
            with db() as conn:
                cur=conn.execute("""INSERT INTO document_templates(name,description,original_filename,docx_blob,placeholder_keys_json,active,created_at,updated_at)
                    VALUES(?,?,?,?,?,?,?,?)""",(name,str(data.get("description","")).strip(),filename,raw,json.dumps(placeholders),1 if data.get("active",True) else 0,now_iso(),now_iso()))
                audit_event(conn,current,"create","document_template",cur.lastrowid,name)
                save_document_version(conn,cur.lastrowid,current["id"])
            return json_response(self,201,{"id":cur.lastrowid,"placeholders":placeholders})
        if p == "/api/document-blocks":
            current=self.require_auth(permission="document_templates_manage")
            if not current:return
            key=str(data.get("key","")).strip(); name=str(data.get("name","")).strip()
            if not re.fullmatch(r"[a-z][a-z0-9_]*",key) or not name:
                return json_response(self,400,{"error":"Schlüssel (klein, ohne Leerzeichen) und Name sind erforderlich."})
            try:
                with db() as conn:
                    order=conn.execute("SELECT COALESCE(MAX(sort_order),-1)+1 FROM document_text_blocks").fetchone()[0]
                    cur=conn.execute("""INSERT INTO document_text_blocks(block_key,name,category,content,active,sort_order,created_at,updated_at)
                        VALUES(?,?,?,?,?,?,?,?)""",(key,name,str(data.get("category","")).strip(),str(data.get("content","")),1 if data.get("active",True) else 0,order,now_iso(),now_iso()))
                    audit_event(conn,current,"create","document_block",cur.lastrowid,name)
            except sqlite3.IntegrityError:return json_response(self,409,{"error":"Dieser Textbaustein-Schlüssel ist bereits vorhanden."})
            return json_response(self,201,{"id":cur.lastrowid})
        if p in {"/api/documents/generate","/api/documents/validate"}:
            current=self.require_auth(permission="documents_create")
            if not current:return
            try:
                template_id=int(data.get("template_id") or 0); project_id=int(data.get("project_id") or 0) or None
            except (ValueError,TypeError):return json_response(self,400,{"error":"Vorlage oder Projekt ist ungültig."})
            if project_id and "projects_view" not in permissions_from_row(current):
                return json_response(self,403,{"error":"Für Projektdaten fehlt die Berechtigung."})
            output_type=str(data.get("output","docx")); values=data.get("values",{})
            if output_type not in {"docx","pdf"} or not isinstance(values,dict):
                return json_response(self,400,{"error":"Ausgabeformat oder Eingabedaten sind ungültig."})
            with db() as conn:
                template=conn.execute("SELECT * FROM document_templates WHERE id=? AND active=1",(template_id,)).fetchone()
                project=conn.execute("SELECT data_json FROM projects WHERE id=? AND archived=0",(project_id,)).fetchone() if project_id else None
            if not template:return json_response(self,404,{"error":"Dokumentvorlage wurde nicht gefunden."})
            if project_id and not project:return json_response(self,404,{"error":"Projekt wurde nicht gefunden."})
            project_data=json.loads(project["data_json"]) if project else {}
            project_data["kontakt"]={}
            contact_index=data.get("contact_index")
            if project and contact_index is not None:
                try:
                    contact_index=int(contact_index)
                    if contact_index<0:raise ValueError()
                    project_data["kontakt"]=project_data.get("kontakte",[])[contact_index]
                except (ValueError,TypeError,IndexError):return json_response(self,400,{"error":"Kontakt wurde nicht gefunden. Bitte neu auswählen."})
            if data.get("save_to_project") and not project_id:
                return json_response(self,400,{"error":"Zum Speichern bitte ein Projekt auswählen."})
            warnings=[]
            if p.endswith("/validate"):
                with db() as conn:analysis=document_analysis(conn,template["docx_blob"])
                warnings=list(analysis["warnings"])
                for key in analysis["placeholders"]:
                    if key.startswith("benutzer.") or key=="kontakte":continue
                    value=values.get(key)
                    if key not in values:
                        value=project_data
                        for part in key.split('.'):
                            value=value.get(part) if isinstance(value,dict) else None
                    if value is None or value=="":warnings.append(f"Nicht ausgefüllt: {key}")
            try: docx=render_document(template,values,project_data,current)
            except ValueError as error:
                if p.endswith("/validate"):return json_response(self,200,{"valid":False,"warnings":warnings,"error":str(error)})
                return json_response(self,400,{"error":str(error)})
            if p.endswith("/validate"):return json_response(self,200,{"valid":True,"warnings":warnings,"message":"Die Word-Datei konnte testweise erzeugt werden."})
            safe_name=safe_export_filename(template["name"],"Dokument")
            payload=docx; content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document"; filename=f"{safe_name}.docx"
            if output_type=="pdf":
                converter=office_converter_path()
                if not converter:return json_response(self,409,{"error":"PDF-Export ist auf diesem Server nicht verfügbar. Installieren Sie LibreOffice oder verwenden Sie den Word-Export."})
                with tempfile.TemporaryDirectory() as directory:
                    source=Path(directory)/filename; source.write_bytes(docx)
                    try:
                        result=subprocess.run([converter,f"-env:UserInstallation={(Path(directory)/'profile').as_uri()}","--headless","--convert-to","pdf","--outdir",directory,str(source)],capture_output=True,timeout=60)
                    except (OSError,subprocess.TimeoutExpired):return json_response(self,500,{"error":"PDF-Konvertierung konnte nicht abgeschlossen werden. Bitte Word-Export verwenden."})
                    pdf_path=source.with_suffix(".pdf")
                    if result.returncode or not pdf_path.exists():return json_response(self,500,{"error":"Die PDF-Konvertierung ist fehlgeschlagen."})
                    payload=pdf_path.read_bytes()
                content_type="application/pdf";filename=f"{safe_name}.pdf"
            with db() as conn:
                conn.execute("INSERT INTO document_usage(template_id,template_name,user_id,project_id,output_method,created_at) VALUES(?,?,?,?,?,?)",(template_id,template["name"],current["id"],project_id,output_type,now_iso()))
                if data.get("save_to_project"):
                    # Check again after rendering/conversion; archiving may have
                    # happened in another window while the file was generated.
                    conn.execute("UPDATE projects SET imported_at=imported_at WHERE id=? AND archived=0",(project_id,))
                    if not conn.execute("SELECT id FROM projects WHERE id=? AND archived=0",(project_id,)).fetchone():
                        return json_response(self,409,{"error":"Projekt ist nicht mehr verfügbar. Bitte erneut auswählen."})
                    cur=conn.execute("""INSERT INTO project_documents(project_id,template_id,template_name,filename,content_type,content,created_by,created_at)
                        VALUES(?,?,?,?,?,?,?,?)""",(project_id,template_id,template["name"],filename,content_type,payload,current["id"],now_iso()))
                    audit_event(conn,current,"create","project_document",cur.lastrowid,f"{filename} in Projekt {project_id}")
                    return json_response(self,201,{"id":cur.lastrowid,"filename":filename,"project_id":project_id})
            return binary_response(self,payload,content_type,filename)
        if p in {"/api/bidders","/api/bidders/import"}:
            current=self.require_auth(permission="projects_manage")
            if not current:return
            items=data.get("bidders",[data]) if isinstance(data,dict) else []
            if not isinstance(items,list) or not items or len(items)>1000:
                return json_response(self,400,{"error":"Bitte zwischen 1 und 1.000 Bieter übergeben."})
            normalized=[]
            for item in items:
                if not isinstance(item,dict):return json_response(self,400,{"error":"Ein Bieterdatensatz ist ungültig."})
                bidder=str(item.get("bidder","")).strip()[:300]
                if not bidder:return json_response(self,400,{"error":"Jeder Datensatz benötigt das Pflichtfeld Bieter."})
                normalized.append((bidder,str(item.get("company_name","")).strip()[:500],
                    str(item.get("street","")).strip()[:500],str(item.get("postal_code","")).strip()[:30],
                    str(item.get("city","")).strip()[:300],str(item.get("country","")).strip()[:200],
                    str(item.get("website","")).strip()[:1000],str(item.get("comment","")).strip()[:10000],1 if item.get("active",True) else 0))
            with db() as conn:
                for item in normalized:
                    conn.execute("""INSERT INTO bidders
                        (bidder,company_name,street,postal_code,city,country,website,comment,active,created_at,updated_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(bidder) DO UPDATE SET
                        company_name=excluded.company_name,street=excluded.street,
                        postal_code=excluded.postal_code,city=excluded.city,country=excluded.country,
                        website=excluded.website,comment=excluded.comment,active=excluded.active,updated_at=excluded.updated_at""",
                        (*item,now_iso(),now_iso()))
                audit_event(conn,current,"import" if len(normalized)>1 else "create","bidder","batch",
                    f"{len(normalized)} Bieter gespeichert")
            return json_response(self,201,{"ok":True,"saved":len(normalized)})

        if p == "/api/bid/categories":
            current=self.require_auth(permission="bid_answers_manage")
            if not current:return
            name=str(data.get("name","")).strip()
            if not name:return json_response(self,400,{"error":"Ein Kategoriename ist erforderlich."})
            try:
                with db() as conn:
                    order=conn.execute("SELECT COALESCE(MAX(sort_order),-1)+1 FROM bid_question_categories").fetchone()[0]
                    cur=conn.execute("""INSERT INTO bid_question_categories(name,active,sort_order,created_at)
                        VALUES (?,?,?,?)""",(name,1 if data.get("active",True) else 0,order,now_iso()))
                    audit_event(conn,current,"create","bid-category",cur.lastrowid,f"Bieterfragen-Kategorie {name} angelegt")
            except sqlite3.IntegrityError:
                return json_response(self,409,{"error":"Diese Kategorie existiert bereits."})
            return json_response(self,201,{"ok":True,"id":cur.lastrowid})

        if p == "/api/bid/topics":
            current=self.require_auth(permission="bid_answers_manage")
            if not current:return
            name=str(data.get("name","")).strip()
            try:category_id=int(data.get("category_id",0))
            except (TypeError,ValueError):category_id=0
            if not name or not category_id:return json_response(self,400,{"error":"Kategorie und Thema sind erforderlich."})
            try:
                with db() as conn:
                    if not conn.execute("SELECT 1 FROM bid_question_categories WHERE id=?",(category_id,)).fetchone():
                        return json_response(self,400,{"error":"Die Kategorie wurde nicht gefunden."})
                    order=conn.execute("SELECT COALESCE(MAX(sort_order),-1)+1 FROM bid_question_topics WHERE category_id=?",(category_id,)).fetchone()[0]
                    cur=conn.execute("""INSERT INTO bid_question_topics(category_id,name,active,sort_order,created_at)
                        VALUES (?,?,?,?,?)""",(category_id,name,1 if data.get("active",True) else 0,order,now_iso()))
                    audit_event(conn,current,"create","bid-topic",cur.lastrowid,f"Bieterfragen-Thema {name} angelegt")
            except sqlite3.IntegrityError:
                return json_response(self,409,{"error":"Dieses Thema existiert in der Kategorie bereits."})
            return json_response(self,201,{"ok":True,"id":cur.lastrowid})

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
                    return json_response(self,400,{"error":"Jede Antwortvariante benötigt eine Entscheidung und einen Antworttext."})
                normalized_variants.append((decision,str(variant.get("short_description","")).strip()[:300],answer,index))
            if not topic_id or not short_question or not normalized_variants:
                return json_response(self,400,{"error":"Thema, Kurzform der Frage und mindestens eine Antwortvariante sind erforderlich."})
            with db() as conn:
                if not conn.execute("SELECT 1 FROM bid_question_topics WHERE id=?",(topic_id,)).fetchone():
                    return json_response(self,400,{"error":"Das Thema wurde nicht gefunden."})
                cur=conn.execute("""INSERT INTO standard_bid_answers
                    (topic_id,short_question,question,answer,agency_comment,created_at,updated_at)
                    VALUES (?,?,?,?,?,?,?)""",
                    (topic_id,short_question,question,normalized_variants[0][2],agency_comment,now_iso(),now_iso()))
                for decision,short_description,answer,order in normalized_variants:
                    conn.execute("""INSERT INTO standard_bid_answer_variants
                        (standard_answer_id,decision,short_description,answer,sort_order,created_at,updated_at)
                        VALUES (?,?,?,?,?,?,?)""",(cur.lastrowid,decision,short_description,answer,order,now_iso(),now_iso()))
                audit_event(conn,current,"create","bid-answer",cur.lastrowid,f"Standardantwort {short_question} angelegt")
            return json_response(self,201,{"ok":True,"id":cur.lastrowid})

        if p == "/api/bid/questions":
            current=self.require_auth(permission="bid_questions_manage")
            if not current:return
            items=data.get("questions",[data])
            if not isinstance(items,list) or not items or len(items)>500:
                return json_response(self,400,{"error":"Bitte zwischen 1 und 500 Bieterfragen übergeben."})
            normalized=[]
            for item in items:
                if not isinstance(item,dict):return json_response(self,400,{"error":"Eine Bieterfrage ist ungültig."})
                try:project_id=int(item.get("project_id",0))
                except (TypeError,ValueError):project_id=0
                try:question_year=int(item.get("question_year",VERSION_YEAR))
                except (TypeError,ValueError):question_year=VERSION_YEAR
                if question_year<2000 or question_year>2100:return json_response(self,400,{"error":"Das Jahr muss zwischen 2000 und 2100 liegen."})
                question=str(item.get("question","")).strip()
                if not project_id or not question:
                    return json_response(self,400,{"error":"Jede Bieterfrage benötigt ein Projekt und einen Fragetext."})
                try: category_id=int(item.get("category_id",0)) or None
                except (TypeError,ValueError): category_id=None
                try: topic_id=int(item.get("topic_id",0)) or None
                except (TypeError,ValueError): topic_id=None
                decision=str(item.get("decision","")).strip().lower()
                if decision not in {"","zugelassen","abgelehnt"}:
                    return json_response(self,400,{"error":"Die Entscheidung muss zugelassen oder abgelehnt sein."})
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
            with db() as conn:
                project_ids={row[0] for row in conn.execute("SELECT id FROM projects WHERE archived=0").fetchall()}
                if any(item[0] not in project_ids for item in normalized):
                    return json_response(self,400,{"error":"Mindestens ein Projekt wurde nicht gefunden oder ist archiviert."})
                ids=[]
                for item in normalized:
                    category_id,topic_id=item[8],item[9]
                    if topic_id:
                        topic=conn.execute("""SELECT t.id,t.name,t.category_id,c.name AS category_name
                            FROM bid_question_topics t JOIN bid_question_categories c ON c.id=t.category_id
                            WHERE t.id=?""",(topic_id,)).fetchone()
                        if not topic:return json_response(self,400,{"error":"Mindestens ein Thema wurde nicht gefunden."})
                        if category_id and category_id!=topic["category_id"]:
                            return json_response(self,400,{"error":"Thema und Fragenkategorie passen nicht zusammen."})
                        category_id=topic["category_id"]
                        item=list(item);item[1]=topic["category_name"];item[3]=topic["name"];item[8]=category_id;item=tuple(item)
                    elif category_id:
                        category=conn.execute("SELECT name FROM bid_question_categories WHERE id=?",(category_id,)).fetchone()
                        if not category:return json_response(self,400,{"error":"Mindestens eine Fragenkategorie wurde nicht gefunden."})
                        item=list(item);item[1]=category["name"];item=tuple(item)
                    bidder_id,standard_answer_id,standard_variant_id=item[10],item[11],item[12]
                    if bidder_id:
                        bidder=conn.execute("SELECT bidder FROM bidders WHERE id=? AND active=1",(bidder_id,)).fetchone()
                        if not bidder:return json_response(self,400,{"error":"Mindestens ein Bieter wurde nicht gefunden."})
                        item=list(item);item[2]=bidder["bidder"];item=tuple(item)
                    if standard_variant_id:
                        variant=conn.execute("""SELECT v.id,v.standard_answer_id,v.decision
                            FROM standard_bid_answer_variants v WHERE v.id=?""",(standard_variant_id,)).fetchone()
                        if not variant or (standard_answer_id and variant["standard_answer_id"]!=standard_answer_id):
                            return json_response(self,400,{"error":"Die gewählte Antwortvariante ist ungültig."})
                        standard_answer_id=variant["standard_answer_id"]
                        item=list(item);item[11]=standard_answer_id;item=tuple(item)
                    cur=conn.execute("""INSERT INTO bid_questions
                        (project_id,category,bidder,subject,question,agency_comment,decision,answer,
                         category_id,topic_id,bidder_id,standard_answer_id,standard_variant_id,question_year,
                         created_by,created_at,updated_at)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",(*item,current["id"],now_iso(),now_iso()))
                    ids.append(cur.lastrowid)
                audit_event(conn,current,"create","bid-question","batch",f"{len(ids)} Bieterfrage(n) erfasst")
            return json_response(self,201,{"ok":True,"ids":ids,"created":len(ids)})

        if p == "/api/variables":
            if not self.require_auth(permission="variables_manage"): return
            payload, error = valid_variable_payload(data)
            if error: return json_response(self,400,{"error":error})
            try:
                with db() as conn:
                    next_order = conn.execute(
                        "SELECT COALESCE(MAX(sort_order),-1)+1 FROM variables"
                    ).fetchone()[0]
                    cur = conn.execute("""INSERT INTO variables
                        (key,label,field_type,source,required,active,sort_order)
                        VALUES (?,?,?,?,?,?,?)""",
                        (payload["key"],payload["label"],payload["field_type"],
                         payload["source"],payload["required"],payload["active"],next_order))
            except sqlite3.IntegrityError:
                return json_response(self,409,{"error":"Dieser Platzhalterschlüssel existiert bereits."})
            return json_response(self,201,{"ok":True,"id":cur.lastrowid})

        m = re.fullmatch(r"/api/templates/(\d+)/duplicate", p)
        if m:
            current = self.require_auth(permission="templates_manage")
            if not current: return
            with db() as conn:
                source=conn.execute("SELECT * FROM templates WHERE id=?",(int(m.group(1)),)).fetchone()
                if not source:return json_response(self,404,{"error":"Vorlage wurde nicht gefunden."})
                next_order=conn.execute("""SELECT COALESCE(MAX(sort_order),-1)+1 FROM templates
                    WHERE category_id IS ?""",(source["category_id"],)).fetchone()[0]
                cur=conn.execute("""INSERT INTO templates
                    (name,category,subject,body,body_html,fields_json,active,created_at,updated_at,
                     category_id,notice_text,notice_mode,notice_enabled,notice_html,notice_button_label,sort_order)
                    VALUES (?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?)""",
                    ("Kopie von "+source["name"],source["category"],source["subject"],source["body"],
                     source["body_html"],source["fields_json"],now_iso(),now_iso(),source["category_id"],
                     source["notice_text"],source["notice_mode"],source["notice_enabled"],
                     source["notice_html"],source["notice_button_label"],next_order))
                save_template_version(conn,cur.lastrowid,current["id"])
                audit_event(conn,current,"duplicate","template",cur.lastrowid,"Vorlage dupliziert")
            return json_response(self,201,{"ok":True,"id":cur.lastrowid})

        if p == "/api/favorites":
            current=self.require_auth(permission="email_create")
            if not current:return
            try:template_id=int(data.get("template_id",0))
            except (TypeError,ValueError):template_id=0
            with db() as conn:
                accessible_ids={row["id"] for row in accessible_template_rows(conn,current)}
                if template_id not in accessible_ids:
                    return json_response(self,404,{"error":"Vorlage wurde nicht gefunden oder ist nicht freigegeben."})
                conn.execute("INSERT OR IGNORE INTO favorite_templates(user_id,template_id,created_at) VALUES (?,?,?)",
                             (current["id"],template_id,now_iso()))
            return json_response(self,201,{"ok":True})

        if p == "/api/templates":
            current = self.require_auth(permission="templates_manage")
            if not current: return
            name = str(data.get("name","")).strip()
            subject = str(data.get("subject","")).strip()
            submitted_body = str(data.get("body","")).strip()
            try: body_html = sanitize_email_html(data.get("body_html",""), submitted_body)
            except ValueError as error: return json_response(self,400,{"error":str(error)})
            body = html_to_plain_text(body_html)
            try: category_id = int(data.get("category_id",0))
            except (TypeError,ValueError): category_id = 0
            with db() as conn:
                category_row = conn.execute("SELECT * FROM categories WHERE id=?",(category_id,)).fetchone()
            category = category_row["name"] if category_row else ""
            fields, fields_error = normalize_template_fields(data.get("fields",[]))
            notice_text = str(data.get("notice_text","")).strip()
            notice_mode = str(data.get("notice_mode","display"))
            notice_enabled = 1 if data.get("notice_enabled") else 0
            submitted_notice = str(data.get("notice_text","")).strip()
            try: notice_html = sanitize_email_html(data.get("notice_html",""),submitted_notice)
            except ValueError as error: return json_response(self,400,{"error":str(error)})
            notice_text = html_to_plain_text(notice_html)
            notice_button_label = str(data.get("notice_button_label","Hinweistext gesehen")).strip() or "Hinweistext gesehen"
            if fields_error: return json_response(self,400,{"error":fields_error})
            if notice_mode not in NOTICE_MODES:
                return json_response(self,400,{"error":"Die Hinweisbehandlung ist ungültig."})
            if not name or not subject or not body or not category_row:
                return json_response(self,400,{"error":"Name, Kategorie, Betreff und Text sind erforderlich."})
            with db() as conn:
                next_order=conn.execute("""SELECT COALESCE(MAX(sort_order),-1)+1 FROM templates
                    WHERE category_id=?""",(category_id,)).fetchone()[0]
                cur = conn.execute("""INSERT INTO templates
                    (name,category,subject,body,body_html,fields_json,active,created_at,updated_at,notice_text,notice_mode,notice_enabled,notice_html,notice_button_label,category_id,sort_order)
                    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (name,category,subject,body,body_html,json.dumps(fields,ensure_ascii=False),
                     1 if data.get("active",True) else 0,now_iso(),now_iso(),notice_text,notice_mode,notice_enabled,
                     notice_html,notice_button_label,category_id,next_order))
                sync_custom_variables(conn,fields)
                save_template_version(conn,cur.lastrowid,current["id"])
                audit_event(conn,current,"create","template",cur.lastrowid,f"Vorlage {name} angelegt")
            return json_response(self,201,{"ok":True,"id":cur.lastrowid})

        if p == "/api/categories":
            if not self.require_auth(permission="categories_manage"): return
            name = str(data.get("name","")).strip()
            if not name: return json_response(self,400,{"error":"Ein Kategoriename ist erforderlich."})
            try:
                with db() as conn:
                    order = conn.execute("SELECT COALESCE(MAX(sort_order),-1)+1 FROM categories").fetchone()[0]
                    cur = conn.execute("""INSERT INTO categories(name,active,sort_order,created_at)
                        VALUES (?,?,?,?)""",(name,1 if data.get("active",True) else 0,order,now_iso()))
            except sqlite3.IntegrityError:
                return json_response(self,409,{"error":"Diese Kategorie existiert bereits."})
            return json_response(self,201,{"ok":True,"id":cur.lastrowid})

        if p == "/api/dashboard":
            current = self.require_auth(permission="email_create")
            if not current: return
            try: category_id = int(data.get("category_id",0))
            except (TypeError,ValueError): category_id = 0
            with db() as conn:
                allowed_ids = {row["id"] for row in accessible_category_rows(conn,current)}
                if category_id not in allowed_ids:
                    return json_response(self,403,{"error":"Auf diese Kategorie besteht kein Zugriff."})
                order = conn.execute("""SELECT COALESCE(MAX(sort_order),-1)+1 FROM dashboard_tiles
                    WHERE user_id=?""",(current["id"],)).fetchone()[0]
                try:
                    cur = conn.execute("""INSERT INTO dashboard_tiles(user_id,category_id,sort_order)
                        VALUES (?,?,?)""",(current["id"],category_id,order))
                except sqlite3.IntegrityError:
                    return json_response(self,409,{"error":"Diese Kategorie ist bereits als Kachel vorhanden."})
            return json_response(self,201,{"ok":True,"id":cur.lastrowid})

        if p == "/api/dashboard/quicklinks":
            current = self.require_auth(permission="email_create")
            if not current: return
            title = str(data.get("title","")).strip()
            url = str(data.get("url","")).strip()
            link_type = str(data.get("link_type","external")).strip()
            target = str(data.get("target","")).strip()
            parsed = urlparse(url)
            if not title or len(title) > 100:
                return json_response(self,400,{"error":"Bitte eine Bezeichnung mit höchstens 100 Zeichen eingeben."})
            if link_type not in {"external","internal"}:
                return json_response(self,400,{"error":"Ungültiger Quicklink-Typ."})
            if link_type == "external" and (len(url) > 2000 or parsed.scheme not in {"http","https"} or not parsed.netloc):
                return json_response(self,400,{"error":"Bitte eine vollständige HTTP- oder HTTPS-Adresse eingeben."})
            if link_type == "internal" and target not in INTERNAL_QUICKLINK_TARGETS:
                return json_response(self,400,{"error":"Bitte eine gültige interne Seite auswählen."})
            if link_type == "internal": url = ""
            else: target = ""
            with db() as conn:
                order = conn.execute("""SELECT COALESCE(MAX(sort_order),-1)+1 FROM dashboard_quicklinks
                    WHERE user_id=?""",(current["id"],)).fetchone()[0]
                cur = conn.execute("""INSERT INTO dashboard_quicklinks
                    (user_id,title,url,link_type,target,sort_order,created_at) VALUES (?,?,?,?,?,?,?)""",
                    (current["id"],title,url,link_type,target,order,now_iso()))
                conn.execute("UPDATE users SET show_quicklinks=1 WHERE id=?",(current["id"],))
            return json_response(self,201,{"ok":True,"id":cur.lastrowid})

        if p in {"/api/projects/delete-archived","/api/templates/delete-archived"}:
            current = self.require_auth(permission="roles_manage")
            if not current: return
            try: entity_ids = sorted({int(value) for value in data.get("ids",[])})
            except (TypeError,ValueError):
                return json_response(self,400,{"error":"Ungültige Auswahl."})
            if not entity_ids:
                return json_response(self,400,{"error":"Bitte mindestens einen archivierten Eintrag auswählen."})
            table = "projects" if p.startswith("/api/projects") else "templates"
            entity_type = "project" if table == "projects" else "template"
            placeholders = ",".join("?" for _ in entity_ids)
            with db() as conn:
                rows = conn.execute(f"SELECT id,archived FROM {table} WHERE id IN ({placeholders})",entity_ids).fetchall()
                if len(rows) != len(entity_ids) or any(not row["archived"] for row in rows):
                    return json_response(self,409,{"error":"Nur vollständig archivierte Einträge können endgültig gelöscht werden."})
                for entity_id in entity_ids:
                    audit_event(conn,current,"delete-permanent",entity_type,entity_id,"Archivierten Eintrag endgültig gelöscht")
                conn.execute(f"DELETE FROM {table} WHERE id IN ({placeholders})",entity_ids)
            return json_response(self,200,{"ok":True,"deleted":len(entity_ids)})

        if p == "/api/roles":
            current = self.require_auth(permission="roles_manage")
            if not current: return
            payload, error = valid_role_payload(data)
            if error: return json_response(self,400,{"error":error})
            try:
                with db() as conn:
                    cur = conn.execute("""INSERT INTO roles
                        (name,permissions_json,all_templates,all_categories,is_system,created_at)
                        VALUES (?,?,?,?,0,?)""",
                        (payload["name"],json.dumps(payload["permissions"]),
                         1,payload["all_categories"],now_iso()))
                    save_role_categories(conn,cur.lastrowid,payload)
                    audit_event(conn,current,"create","role",cur.lastrowid,f"Rolle {payload['name']} angelegt")
            except sqlite3.IntegrityError:
                return json_response(self,409,{"error":"Dieser Rollenname existiert bereits."})
            return json_response(self,201,{"ok":True,"id":cur.lastrowid})

        self.send_error(404)

    def do_PUT(self):
        p = urlparse(self.path).path
        if p.startswith("/api/") and not csrf_valid(self):
            return json_response(self,403,{"error":"Sicherheitsprüfung fehlgeschlagen. Bitte die Seite neu laden."})
        try: data = read_json(self)
        except Exception as e: return json_response(self,400,{"error":str(e)})

        m=re.fullmatch(r"/api/document-templates/(\d+)",p)
        if m:
            current=self.require_auth(permission="document_templates_manage")
            if not current:return
            with db() as conn:
                row=conn.execute("SELECT * FROM document_templates WHERE id=?",(int(m.group(1)),)).fetchone()
                if not row:return json_response(self,404,{"error":"Dokumentvorlage wurde nicht gefunden."})
                raw=row["docx_blob"]; filename=row["original_filename"]; placeholders=json.loads(row["placeholder_keys_json"] or "[]")
                if data.get("content_base64"):
                    try: raw=base64.b64decode(str(data["content_base64"]).split(",")[-1],validate=True); placeholders=extract_docx_placeholders(raw)
                    except Exception as error:return json_response(self,400,{"error":str(error)})
                    filename=str(data.get("filename") or filename)
                    if not filename.lower().endswith(".docx"):return json_response(self,400,{"error":"Bitte eine DOCX-Datei auswählen."})
                name=str(data.get("name",row["name"])).strip()
                if not name:return json_response(self,400,{"error":"Ein Vorlagenname ist erforderlich."})
                conn.execute("UPDATE document_templates SET name=?,description=?,original_filename=?,docx_blob=?,placeholder_keys_json=?,active=?,updated_at=? WHERE id=?",
                    (name,str(data.get("description",row["description"])),filename,raw,json.dumps(placeholders),1 if data.get("active",True) else 0,now_iso(),int(m.group(1))))
                audit_event(conn,current,"update","document_template",m.group(1),name)
                if data.get("content_base64"):save_document_version(conn,int(m.group(1)),current["id"])
            return json_response(self,200,{"ok":True,"placeholders":placeholders})
        m=re.fullmatch(r"/api/document-blocks/(\d+)",p)
        if m:
            current=self.require_auth(permission="document_templates_manage")
            if not current:return
            key=str(data.get("key","")).strip(); name=str(data.get("name","")).strip()
            if not re.fullmatch(r"[a-z][a-z0-9_]*",key) or not name:return json_response(self,400,{"error":"Schlüssel und Name sind erforderlich."})
            try:
                with db() as conn:
                    cur=conn.execute("UPDATE document_text_blocks SET block_key=?,name=?,category=?,content=?,active=?,updated_at=? WHERE id=?",
                        (key,name,str(data.get("category","")).strip(),str(data.get("content","")),1 if data.get("active",True) else 0,now_iso(),int(m.group(1))))
                    if not cur.rowcount:return json_response(self,404,{"error":"Textbaustein wurde nicht gefunden."})
                    audit_event(conn,current,"update","document_block",m.group(1),name)
            except sqlite3.IntegrityError:return json_response(self,409,{"error":"Dieser Schlüssel ist bereits vorhanden."})
            return json_response(self,200,{"ok":True})

        m = re.fullmatch(r"/api/projects/(\d+)",p)
        if m:
            current = self.require_auth(permission="projects_manage")
            if not current: return
            payload = data.get("data")
            if not isinstance(payload,dict):
                return json_response(self,400,{"error":"Ungültige Projektdaten."})
            try:
                project_key = str(payload["projekt"]["id"]).strip()
                name = str(payload["projekt"]["bezeichnung"]).strip()
            except (KeyError,TypeError):
                return json_response(self,400,{"error":"Projekt-ID und Projektbezeichnung fehlen."})
            if not project_key or not name:
                return json_response(self,400,{"error":"Projekt-ID und Projektbezeichnung dürfen nicht leer sein."})
            project_id = int(m.group(1))
            with db() as conn:
                existing = conn.execute("SELECT id,project_key FROM projects WHERE id=?",(project_id,)).fetchone()
                if not existing:
                    return json_response(self,404,{"error":"Projekt wurde nicht gefunden."})
                conflict = conn.execute("SELECT id FROM projects WHERE project_key=? AND id<>?",(project_key,project_id)).fetchone()
                if conflict:
                    return json_response(self,409,{"error":"Diese Projekt-ID ist bereits vergeben. Bitte wählen Sie eine andere Projekt-ID."})
                conn.execute("""UPDATE projects SET project_key=?,name=?,data_json=?,imported_at=?,imported_by=?
                    WHERE id=?""",(project_key,name,json.dumps(payload,ensure_ascii=False),now_iso(),current["id"],project_id))
                audit_event(conn,current,"update","project",project_id,
                            f"Projekt {existing['project_key']} als {project_key} aktualisiert")
            return json_response(self,200,{"ok":True,"project_key":project_key})

        m=re.fullmatch(r"/api/bid/categories/(\d+)",p)
        if m:
            current=self.require_auth(permission="bid_answers_manage")
            if not current:return
            name=str(data.get("name","")).strip()
            if not name:return json_response(self,400,{"error":"Ein Kategoriename ist erforderlich."})
            try:
                with db() as conn:
                    cur=conn.execute("UPDATE bid_question_categories SET name=?,active=? WHERE id=?",
                        (name,1 if data.get("active",True) else 0,int(m.group(1))))
                    if not cur.rowcount:return json_response(self,404,{"error":"Kategorie wurde nicht gefunden."})
                    audit_event(conn,current,"update","bid-category",m.group(1),f"Bieterfragen-Kategorie {name} geändert")
            except sqlite3.IntegrityError:return json_response(self,409,{"error":"Diese Kategorie existiert bereits."})
            return json_response(self,200,{"ok":True})

        m=re.fullmatch(r"/api/bid/topics/(\d+)",p)
        if m:
            current=self.require_auth(permission="bid_answers_manage")
            if not current:return
            name=str(data.get("name","")).strip()
            try:category_id=int(data.get("category_id",0))
            except (TypeError,ValueError):category_id=0
            if not name or not category_id:return json_response(self,400,{"error":"Kategorie und Thema sind erforderlich."})
            try:
                with db() as conn:
                    existing=conn.execute("SELECT category_id,sort_order FROM bid_question_topics WHERE id=?",(int(m.group(1)),)).fetchone()
                    if not existing:return json_response(self,404,{"error":"Thema wurde nicht gefunden."})
                    order=existing["sort_order"] if existing["category_id"]==category_id else conn.execute(
                        "SELECT COALESCE(MAX(sort_order),-1)+1 FROM bid_question_topics WHERE category_id=?",(category_id,)).fetchone()[0]
                    conn.execute("UPDATE bid_question_topics SET category_id=?,name=?,active=?,sort_order=? WHERE id=?",
                        (category_id,name,1 if data.get("active",True) else 0,order,int(m.group(1))))
                    audit_event(conn,current,"update","bid-topic",m.group(1),f"Bieterfragen-Thema {name} geändert")
            except sqlite3.IntegrityError:return json_response(self,409,{"error":"Dieses Thema existiert in der Kategorie bereits."})
            return json_response(self,200,{"ok":True})

        m=re.fullmatch(r"/api/bid/answers/(\d+)",p)
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
                    return json_response(self,400,{"error":"Jede Antwortvariante benötigt eine Entscheidung und einen Antworttext."})
                normalized_variants.append((decision,str(variant.get("short_description","")).strip()[:300],answer,index))
            if not topic_id or not short_question or not normalized_variants:
                return json_response(self,400,{"error":"Thema, Kurzform und mindestens eine Antwortvariante sind erforderlich."})
            with db() as conn:
                answer_id=int(m.group(1))
                cur=conn.execute("""UPDATE standard_bid_answers SET topic_id=?,short_question=?,question=?,answer=?,agency_comment=?,updated_at=? WHERE id=?""",
                    (topic_id,short_question,question,normalized_variants[0][2],agency_comment,now_iso(),answer_id))
                if not cur.rowcount:return json_response(self,404,{"error":"Standardantwort wurde nicht gefunden."})
                conn.execute("DELETE FROM standard_bid_answer_variants WHERE standard_answer_id=?",(answer_id,))
                for decision,short_description,answer,order in normalized_variants:
                    conn.execute("""INSERT INTO standard_bid_answer_variants
                        (standard_answer_id,decision,short_description,answer,sort_order,created_at,updated_at)
                        VALUES (?,?,?,?,?,?,?)""",(answer_id,decision,short_description,answer,order,now_iso(),now_iso()))
                audit_event(conn,current,"update","bid-answer",m.group(1),f"Standardantwort {short_question} geändert")
            return json_response(self,200,{"ok":True})

        m=re.fullmatch(r"/api/bidders/(\d+)",p)
        if m:
            current=self.require_auth(permission="projects_manage")
            if not current:return
            bidder=str(data.get("bidder","")).strip()[:300]
            if not bidder:return json_response(self,400,{"error":"Das Pflichtfeld Bieter darf nicht leer sein."})
            fields=(bidder,str(data.get("company_name","")).strip()[:500],str(data.get("street","")).strip()[:500],
                str(data.get("postal_code","")).strip()[:30],str(data.get("city","")).strip()[:300],
                str(data.get("country","")).strip()[:200],str(data.get("website","")).strip()[:1000],str(data.get("comment","")).strip()[:10000],
                1 if data.get("active",True) else 0,now_iso(),int(m.group(1)))
            try:
                with db() as conn:
                    cur=conn.execute("""UPDATE bidders SET bidder=?,company_name=?,street=?,postal_code=?,city=?,country=?,website=?,comment=?,active=?,updated_at=? WHERE id=?""",fields)
                    if not cur.rowcount:return json_response(self,404,{"error":"Bieter wurde nicht gefunden."})
                    audit_event(conn,current,"update","bidder",m.group(1),f"Bieter {bidder} geändert")
            except sqlite3.IntegrityError:return json_response(self,409,{"error":"Dieser Bieter existiert bereits."})
            return json_response(self,200,{"ok":True})

        m=re.fullmatch(r"/api/bid/questions/(\d+)",p)
        if m:
            current=self.require_auth(permission="bid_questions_manage")
            if not current:return
            try:project_id=int(data.get("project_id",0))
            except (TypeError,ValueError):project_id=0
            try:question_year=int(data.get("question_year",VERSION_YEAR))
            except (TypeError,ValueError):question_year=VERSION_YEAR
            if question_year<2000 or question_year>2100:return json_response(self,400,{"error":"Das Jahr muss zwischen 2000 und 2100 liegen."})
            question=str(data.get("question","")).strip()
            if not project_id or not question:return json_response(self,400,{"error":"Projekt und Fragetext sind erforderlich."})
            try:category_id=int(data.get("category_id",0)) or None
            except (TypeError,ValueError):category_id=None
            try:topic_id=int(data.get("topic_id",0)) or None
            except (TypeError,ValueError):topic_id=None
            decision=str(data.get("decision","")).strip().lower()
            if decision not in {"","zugelassen","abgelehnt"}:return json_response(self,400,{"error":"Die Entscheidung muss zugelassen oder abgelehnt sein."})
            with db() as conn:
                existing=conn.execute("SELECT answer FROM bid_questions WHERE id=?",(int(m.group(1)),)).fetchone()
                if not existing:return json_response(self,404,{"error":"Bieterfrage wurde nicht gefunden."})
                category_name=str(data.get("category","")).strip()[:300];topic_name=str(data.get("subject","")).strip()[:500]
                if topic_id:
                    topic=conn.execute("""SELECT t.name,t.category_id,c.name AS category_name FROM bid_question_topics t
                        JOIN bid_question_categories c ON c.id=t.category_id WHERE t.id=?""",(topic_id,)).fetchone()
                    if not topic:return json_response(self,400,{"error":"Das Thema wurde nicht gefunden."})
                    if category_id and category_id!=topic["category_id"]:return json_response(self,400,{"error":"Thema und Fragenkategorie passen nicht zusammen."})
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
                    if not bidder:return json_response(self,400,{"error":"Der Bieter wurde nicht gefunden."})
                    bidder_name=bidder["bidder"]
                if standard_variant_id:
                    variant=conn.execute("SELECT standard_answer_id FROM standard_bid_answer_variants WHERE id=?",(standard_variant_id,)).fetchone()
                    if not variant or (standard_answer_id and variant["standard_answer_id"]!=standard_answer_id):
                        return json_response(self,400,{"error":"Die gewählte Antwortvariante ist ungültig."})
                    standard_answer_id=variant["standard_answer_id"]
                clear_ack=existing["answer"]!=new_answer
                cur=conn.execute("""UPDATE bid_questions SET project_id=?,category=?,bidder=?,subject=?,question=?,agency_comment=?,decision=?,answer=?,category_id=?,topic_id=?,bidder_id=?,standard_answer_id=?,standard_variant_id=?,question_year=?,answered_at=CASE WHEN ? THEN NULL ELSE answered_at END,answered_by=CASE WHEN ? THEN NULL ELSE answered_by END,updated_at=? WHERE id=?""",
                    (project_id,category_name,bidder_name,topic_name,question,
                     str(data.get("agency_comment","")).strip(),decision,new_answer,category_id,topic_id,
                     bidder_id,standard_answer_id,standard_variant_id,question_year,
                     1 if clear_ack else 0,1 if clear_ack else 0,now_iso(),int(m.group(1))))
                if not cur.rowcount:return json_response(self,404,{"error":"Bieterfrage wurde nicht gefunden."})
                audit_event(conn,current,"update","bid-question",m.group(1),"Bieterfrage geändert")
            return json_response(self,200,{"ok":True})

        m=re.fullmatch(r"/api/bid/questions/(\d+)/acknowledge",p)
        if m:
            current=self.require_auth(permission="bid_questions_manage")
            if not current:return
            with db() as conn:
                row=conn.execute("SELECT answer FROM bid_questions WHERE id=?",(int(m.group(1)),)).fetchone()
                if not row:return json_response(self,404,{"error":"Bieterfrage wurde nicht gefunden."})
                if not str(row["answer"] or "").strip():return json_response(self,409,{"error":"Vor der Quittierung muss eine Antwort erstellt werden."})
                conn.execute("UPDATE bid_questions SET answered_at=?,answered_by=?,updated_at=? WHERE id=?",
                    (now_iso(),current["id"],now_iso(),int(m.group(1))))
                audit_event(conn,current,"acknowledge","bid-question",m.group(1),"Beantwortung quittiert")
            return json_response(self,200,{"ok":True})

        if p == "/api/bid/categories/order":
            if not self.require_auth(permission="bid_answers_manage"):return
            try:ids=[int(value) for value in data.get("ids",[])]
            except (TypeError,ValueError):return json_response(self,400,{"error":"Ungültige Reihenfolge."})
            with db() as conn:
                existing={row[0] for row in conn.execute("SELECT id FROM bid_question_categories").fetchall()}
                if set(ids)!=existing or len(ids)!=len(existing):return json_response(self,400,{"error":"Die Reihenfolge ist unvollständig."})
                for order,item_id in enumerate(ids):conn.execute("UPDATE bid_question_categories SET sort_order=? WHERE id=?",(order,item_id))
            return json_response(self,200,{"ok":True})

        if p == "/api/bid/topics/order":
            if not self.require_auth(permission="bid_answers_manage"):return
            try:category_id=int(data.get("category_id",0));ids=[int(value) for value in data.get("ids",[])]
            except (TypeError,ValueError):return json_response(self,400,{"error":"Ungültige Reihenfolge."})
            with db() as conn:
                existing={row[0] for row in conn.execute("SELECT id FROM bid_question_topics WHERE category_id=?",(category_id,)).fetchall()}
                if set(ids)!=existing or len(ids)!=len(existing):return json_response(self,400,{"error":"Die Reihenfolge ist unvollständig."})
                for order,item_id in enumerate(ids):conn.execute("UPDATE bid_question_topics SET sort_order=? WHERE id=? AND category_id=?",(order,item_id,category_id))
            return json_response(self,200,{"ok":True})

        if p == "/api/settings":
            current = self.require_auth(permission="settings_manage")
            if not current: return
            app_name = str(data.get("app_name", "")).strip()
            logo_data = str(data.get("logo_data", ""))
            if not app_name:
                return json_response(self,400,{"error":"Der Anwendungsname darf nicht leer sein."})
            if logo_data and (
                len(logo_data) > 1_500_000
                or not re.match(r"^data:image/(png|jpeg|webp|gif);base64,", logo_data)
            ):
                return json_response(self,400,{"error":"Bitte ein PNG-, JPG-, WEBP- oder GIF-Logo bis ca. 1 MB verwenden."})
            navigation_order = data.get("navigation_order",MAIN_NAV_KEYS)
            if not isinstance(navigation_order,list) or set(navigation_order) != set(MAIN_NAV_KEYS) or len(navigation_order) != len(MAIN_NAV_KEYS):
                return json_response(self,400,{"error":"Die Reihenfolge der Hauptnavigation ist unvollständig."})
            with db() as conn:
                conn.execute("""UPDATE app_settings SET app_name=?,logo_data=?,navigation_order_json=? WHERE id=1""",
                             (app_name,logo_data,json.dumps(navigation_order)))
                audit_event(conn,current,"update","settings","1","Anwendungsname, Logo oder Navigation geändert")
            return json_response(self,200,{"ok":True,"settings":settings_dict(),"software":software_info_dict()})

        m = re.fullmatch(r"/api/variables/(\d+)", p)
        if m:
            if not self.require_auth(permission="variables_manage"): return
            payload, error = valid_variable_payload(data)
            if error: return json_response(self,400,{"error":error})
            try:
                with db() as conn:
                    conn.execute("""UPDATE variables
                        SET key=?,label=?,field_type=?,source=?,required=?,active=?
                        WHERE id=?""",
                        (payload["key"],payload["label"],payload["field_type"],
                         payload["source"],payload["required"],payload["active"],
                         int(m.group(1))))
            except sqlite3.IntegrityError:
                return json_response(self,409,{"error":"Dieser Platzhalterschlüssel existiert bereits."})
            return json_response(self,200,{"ok":True})

        m = re.fullmatch(r"/api/users/(\d+)/password", p)
        if m:
            current = self.require_auth(permission="users_manage")
            if not current: return
            password = str(data.get("new_password", ""))
            with db() as conn:
                target = conn.execute("SELECT password_policy_exempt FROM users WHERE id=?",(int(m.group(1)),)).fetchone()
                if not target: return json_response(self,404,{"error":"Benutzer wurde nicht gefunden."})
                error = validate_user_password(password,bool(target["password_policy_exempt"]))
                if error: return json_response(self,400,{"error":error})
                conn.execute("UPDATE users SET password_hash=?,must_change=0 WHERE id=?",
                             (ph.hash(password),int(m.group(1))))
                audit_event(conn,current,"update","user",m.group(1),"Passwort durch Administration geändert")
            return json_response(self,200,{"ok":True})

        m = re.fullmatch(r"/api/users/(\d+)/recovery", p)
        if m:
            current = self.require_auth(permission="users_manage")
            if not current: return
            recovery = "-".join([secrets.token_hex(2).upper() for _ in range(4)])
            with db() as conn:
                conn.execute("UPDATE users SET recovery_hash=? WHERE id=?",
                             (ph.hash(recovery),int(m.group(1))))
                audit_event(conn,current,"update","user",m.group(1),"Wiederherstellungscode neu erzeugt")
            return json_response(self,200,{"ok":True,"recovery_code":recovery})

        m = re.fullmatch(r"/api/users/(\d+)/unlock", p)
        if m:
            if not self.require_auth(permission="users_manage"): return
            with db() as conn:
                conn.execute("UPDATE users SET failed_login_attempts=0,locked_until=NULL WHERE id=?",
                             (int(m.group(1)),))
            return json_response(self,200,{"ok":True})

        m = re.fullmatch(r"/api/users/(\d+)", p)
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
                with db() as conn:
                    role_row = conn.execute("SELECT permissions_json FROM roles WHERE id=?",(role_id,)).fetchone()
                if not role_row:
                    return json_response(self,400,{"error":"Die ausgewählte Rolle existiert nicht."})
                selected_permissions = set(json.loads(role_row["permissions_json"]))
                if not selected_permissions.issubset(set(permissions_from_row(current))):
                    return json_response(self,403,{"error":"Sie dürfen keine Rolle mit weitergehenden Berechtigungen zuweisen."})
                legacy_role = "admin" if "roles_manage" in selected_permissions else "user"
                sets.extend(["role_id=?","role=?"]); vals.extend([role_id,legacy_role])
            if not sets: return json_response(self,400,{"error":"Keine Änderungen übergeben."})
            vals.append(uid)
            with db() as conn:
                conn.execute(f"UPDATE users SET {','.join(sets)} WHERE id=?", vals)
                audit_event(conn,current,"update","user",uid,"Benutzerkonto oder Rollenzuweisung geändert")
            return json_response(self,200,{"ok":True})

        m = re.fullmatch(r"/api/users/(\d+)/reset", p)
        if m:
            if not self.require_auth(permission="users_manage"): return
            uid=int(m.group(1))
            password=secrets.token_urlsafe(10)+"A1"
            recovery="-".join([secrets.token_hex(2).upper() for _ in range(4)])
            with db() as conn:
                conn.execute("UPDATE users SET password_hash=?,recovery_hash=?,must_change=0 WHERE id=?",
                             (ph.hash(password),ph.hash(recovery),uid))
            return json_response(self,200,{"temporary_password":password,"recovery_code":recovery})

        m = re.fullmatch(r"/api/templates/(\d+)", p)
        if m:
            current = self.require_auth(permission="templates_manage")
            if not current: return
            tid=int(m.group(1))
            fields, fields_error=normalize_template_fields(data.get("fields",[]))
            if fields_error:return json_response(self,400,{"error":fields_error})
            notice_text=str(data.get("notice_text","")).strip()
            notice_mode=str(data.get("notice_mode","display"))
            notice_enabled=1 if data.get("notice_enabled") else 0
            submitted_notice=str(data.get("notice_text","")).strip()
            try: notice_html=sanitize_email_html(data.get("notice_html",""),submitted_notice)
            except ValueError as error: return json_response(self,400,{"error":str(error)})
            notice_text=html_to_plain_text(notice_html)
            notice_button_label=str(data.get("notice_button_label","Hinweistext gesehen")).strip() or "Hinweistext gesehen"
            if notice_mode not in NOTICE_MODES:
                return json_response(self,400,{"error":"Die Hinweisbehandlung ist ungültig."})
            try: category_id=int(data.get("category_id",0))
            except (TypeError,ValueError): category_id=0
            with db() as conn:
                category_row=conn.execute("SELECT * FROM categories WHERE id=?",(category_id,)).fetchone()
                if not category_row: return json_response(self,400,{"error":"Die ausgewählte Kategorie existiert nicht."})
                existing_template=conn.execute("SELECT category_id,sort_order FROM templates WHERE id=?",(tid,)).fetchone()
                if not existing_template:return json_response(self,404,{"error":"Vorlage wurde nicht gefunden."})
                sort_order=existing_template["sort_order"]
                if existing_template["category_id"] != category_id:
                    sort_order=conn.execute("""SELECT COALESCE(MAX(sort_order),-1)+1 FROM templates
                        WHERE category_id=?""",(category_id,)).fetchone()[0]
                submitted_body=str(data.get("body","")).strip()
                try: body_html=sanitize_email_html(data.get("body_html",""),submitted_body)
                except ValueError as error: return json_response(self,400,{"error":str(error)})
                body=html_to_plain_text(body_html)
                conn.execute("""UPDATE templates SET name=?,category=?,category_id=?,subject=?,body=?,body_html=?,fields_json=?,active=?,updated_at=?,notice_text=?,notice_mode=?,notice_enabled=?,notice_html=?,notice_button_label=?,sort_order=?
                    WHERE id=?""",
                    (str(data.get("name","")).strip(),category_row["name"],category_id,
                     str(data.get("subject","")).strip(),body,body_html,json.dumps(fields,ensure_ascii=False),
                     1 if data.get("active",True) else 0,
                     now_iso(),notice_text,notice_mode,notice_enabled,notice_html,notice_button_label,sort_order,tid))
                sync_custom_variables(conn,fields)
                version_no = save_template_version(conn,tid,current["id"])
                audit_event(conn,current,"update","template",tid,f"Vorlage gespeichert (Version {version_no})")
            return json_response(self,200,{"ok":True})

        m = re.fullmatch(r"/api/(projects|templates)/(\d+)/restore",p)
        if m:
            entity,entity_id = m.group(1),int(m.group(2))
            permission = "projects_manage" if entity == "projects" else "templates_manage"
            current = self.require_auth(permission=permission)
            if not current: return
            table = "projects" if entity == "projects" else "templates"
            entity_type = "project" if entity == "projects" else "template"
            with db() as conn:
                cur = conn.execute(f"UPDATE {table} SET archived=0 WHERE id=?",(entity_id,))
                if not cur.rowcount: return json_response(self,404,{"error":"Eintrag wurde nicht gefunden."})
                if table == "templates": save_template_version(conn,entity_id,current["id"])
                audit_event(conn,current,"restore",entity_type,entity_id,"Aus Archiv wiederhergestellt")
            return json_response(self,200,{"ok":True})

        if p == "/api/templates/order":
            if not self.require_auth(permission="templates_manage"): return
            try:
                category_id=int(data.get("category_id",0))
                template_ids=[int(value) for value in data.get("template_ids",[])]
            except (TypeError,ValueError):
                return json_response(self,400,{"error":"Ungültige Vorlagenreihenfolge."})
            with db() as conn:
                existing=[row[0] for row in conn.execute(
                    "SELECT id FROM templates WHERE category_id=?",(category_id,)).fetchall()]
                if set(template_ids)!=set(existing) or len(template_ids)!=len(existing):
                    return json_response(self,400,{"error":"Die Vorlagenreihenfolge ist unvollständig."})
                for position,template_id in enumerate(template_ids):
                    conn.execute("UPDATE templates SET sort_order=? WHERE id=? AND category_id=?",
                                 (position,template_id,category_id))
            return json_response(self,200,{"ok":True})

        m = re.fullmatch(r"/api/categories/(\d+)", p)
        if m:
            if not self.require_auth(permission="categories_manage"): return
            category_id=int(m.group(1));name=str(data.get("name","")).strip()
            if not name:return json_response(self,400,{"error":"Ein Kategoriename ist erforderlich."})
            try:
                with db() as conn:
                    conn.execute("UPDATE categories SET name=?,active=? WHERE id=?",
                                 (name,1 if data.get("active",True) else 0,category_id))
                    conn.execute("UPDATE templates SET category=? WHERE category_id=?",(name,category_id))
            except sqlite3.IntegrityError:
                return json_response(self,409,{"error":"Diese Kategorie existiert bereits."})
            return json_response(self,200,{"ok":True})

        if p == "/api/categories/order":
            if not self.require_auth(permission="categories_manage"): return
            try: category_ids=[int(value) for value in data.get("category_ids",[])]
            except (TypeError,ValueError):
                return json_response(self,400,{"error":"Ungültige Kategorienreihenfolge."})
            with db() as conn:
                existing={row[0] for row in conn.execute("SELECT id FROM categories").fetchall()}
                if set(category_ids)!=existing or len(category_ids)!=len(existing):
                    return json_response(self,400,{"error":"Die Kategorienreihenfolge ist unvollständig."})
                for order,category_id in enumerate(category_ids):
                    conn.execute("UPDATE categories SET sort_order=? WHERE id=?",(order,category_id))
            return json_response(self,200,{"ok":True})

        if p == "/api/dashboard/order":
            current=self.require_auth(permission="email_create")
            if not current:return
            try:tile_ids=[int(value) for value in data.get("tile_ids",[])]
            except (TypeError,ValueError):return json_response(self,400,{"error":"Ungültige Reihenfolge."})
            with db() as conn:
                owned={row[0] for row in conn.execute("SELECT id FROM dashboard_tiles WHERE user_id=?",(current["id"],)).fetchall()}
                if set(tile_ids)!=owned:return json_response(self,400,{"error":"Die Kachelreihenfolge ist unvollständig."})
                for order,tile_id in enumerate(tile_ids):
                    conn.execute("UPDATE dashboard_tiles SET sort_order=? WHERE id=? AND user_id=?",
                                 (order,tile_id,current["id"]))
            return json_response(self,200,{"ok":True})

        if p == "/api/dashboard/favorites":
            current=self.require_auth(permission="email_create")
            if not current:return
            with db() as conn:
                conn.execute("UPDATE users SET show_favorites=? WHERE id=?",
                             (1 if data.get("visible") else 0,current["id"]))
            return json_response(self,200,{"ok":True})

        if p == "/api/dashboard/quicklinks/visibility":
            current=self.require_auth(permission="email_create")
            if not current:return
            with db() as conn:
                conn.execute("UPDATE users SET show_quicklinks=? WHERE id=?",
                             (1 if data.get("visible") else 0,current["id"]))
            return json_response(self,200,{"ok":True})

        if p == "/api/dashboard/quicklinks/order":
            current=self.require_auth(permission="email_create")
            if not current:return
            try:link_ids=[int(value) for value in data.get("link_ids",[])]
            except (TypeError,ValueError):return json_response(self,400,{"error":"Ungültige Quicklink-Reihenfolge."})
            with db() as conn:
                owned={row[0] for row in conn.execute("SELECT id FROM dashboard_quicklinks WHERE user_id=?",(current["id"],)).fetchall()}
                if set(link_ids)!=owned or len(link_ids)!=len(owned):
                    return json_response(self,400,{"error":"Die Quicklink-Reihenfolge ist unvollständig."})
                for order,link_id in enumerate(link_ids):
                    conn.execute("UPDATE dashboard_quicklinks SET sort_order=? WHERE id=? AND user_id=?",(order,link_id,current["id"]))
            return json_response(self,200,{"ok":True})

        m = re.fullmatch(r"/api/roles/(\d+)", p)
        if m:
            current = self.require_auth(permission="roles_manage")
            if not current: return
            role_id = int(m.group(1))
            payload, error = valid_role_payload(data)
            if error: return json_response(self,400,{"error":error})
            with db() as conn:
                existing = conn.execute("SELECT * FROM roles WHERE id=?",(role_id,)).fetchone()
                if not existing: return json_response(self,404,{"error":"Rolle nicht gefunden."})
                if existing["name"] == "Administrator":
                    return json_response(self,409,{"error":"Die Administratorrolle ist fest geschützt und kann nicht bearbeitet werden."})
                try:
                    conn.execute("""UPDATE roles SET name=?,permissions_json=?,all_templates=?,all_categories=?
                        WHERE id=?""",(payload["name"],json.dumps(payload["permissions"]),
                                     1,payload["all_categories"],role_id))
                    save_role_categories(conn,role_id,payload)
                    audit_event(conn,current,"update","role",role_id,f"Rolle {payload['name']} geändert")
                except sqlite3.IntegrityError:
                    return json_response(self,409,{"error":"Dieser Rollenname existiert bereits."})
            return json_response(self,200,{"ok":True})
        self.send_error(404)

    def do_DELETE(self):
        p=urlparse(self.path).path
        # Document assets are stored in SQLite, so deletion remains part of normal backups.
        m=re.fullmatch(r"/api/document-templates/(\d+)",p)
        if m:
            if not csrf_valid(self):return json_response(self,403,{"error":"Sicherheitsprüfung fehlgeschlagen."})
            current=self.require_auth(permission="document_templates_manage")
            if not current:return
            with db() as conn:
                cur=conn.execute("DELETE FROM document_templates WHERE id=?",(int(m.group(1)),))
                if not cur.rowcount:return json_response(self,404,{"error":"Dokumentvorlage wurde nicht gefunden."})
                audit_event(conn,current,"delete-permanent","document_template",m.group(1),"Dokumentvorlage gelöscht")
            return json_response(self,200,{"ok":True})
        m=re.fullmatch(r"/api/document-blocks/(\d+)",p)
        if m:
            if not csrf_valid(self):return json_response(self,403,{"error":"Sicherheitsprüfung fehlgeschlagen."})
            current=self.require_auth(permission="document_templates_manage")
            if not current:return
            with db() as conn:
                cur=conn.execute("DELETE FROM document_text_blocks WHERE id=?",(int(m.group(1)),))
                if not cur.rowcount:return json_response(self,404,{"error":"Textbaustein wurde nicht gefunden."})
                audit_event(conn,current,"delete-permanent","document_block",m.group(1),"Textbaustein gelöscht")
            return json_response(self,200,{"ok":True})
        if p.startswith("/api/") and not csrf_valid(self):
            return json_response(self,403,{"error":"Sicherheitsprüfung fehlgeschlagen. Bitte die Seite neu laden."})
        m=re.fullmatch(r"/api/bidders/(\d+)",p)
        if m:
            current=self.require_auth(permission="projects_manage")
            if not current:return
            with db() as conn:
                used=conn.execute("SELECT COUNT(*) FROM bid_questions WHERE bidder_id=?",(int(m.group(1)),)).fetchone()[0]
                if used:return json_response(self,409,{"error":"Der Bieter wird bereits in Bieterfragen verwendet und kann nur deaktiviert werden."})
                cur=conn.execute("DELETE FROM bidders WHERE id=?",(int(m.group(1)),))
                if not cur.rowcount:return json_response(self,404,{"error":"Bieter wurde nicht gefunden."})
                audit_event(conn,current,"delete-permanent","bidder",m.group(1),"Bieter gelöscht")
            return json_response(self,200,{"ok":True})
        m=re.fullmatch(r"/api/bid/questions/(\d+)",p)
        if m:
            current=self.require_auth(permission="bid_questions_manage")
            if not current:return
            with db() as conn:
                cur=conn.execute("DELETE FROM bid_questions WHERE id=?",(int(m.group(1)),))
                if not cur.rowcount:return json_response(self,404,{"error":"Bieterfrage wurde nicht gefunden."})
                audit_event(conn,current,"delete-permanent","bid-question",m.group(1),"Bieterfrage gelöscht")
            return json_response(self,200,{"ok":True})
        m=re.fullmatch(r"/api/bid/answers/(\d+)",p)
        if m:
            current=self.require_auth(permission="bid_answers_manage")
            if not current:return
            with db() as conn:
                cur=conn.execute("DELETE FROM standard_bid_answers WHERE id=?",(int(m.group(1)),))
                if not cur.rowcount:return json_response(self,404,{"error":"Standardantwort wurde nicht gefunden."})
                audit_event(conn,current,"delete-permanent","bid-answer",m.group(1),"Standardantwort gelöscht")
            return json_response(self,200,{"ok":True})
        m=re.fullmatch(r"/api/bid/topics/(\d+)",p)
        if m:
            current=self.require_auth(permission="bid_answers_manage")
            if not current:return
            with db() as conn:
                count=conn.execute("SELECT COUNT(*) FROM standard_bid_answers WHERE topic_id=?",(int(m.group(1)),)).fetchone()[0]
                if count:return json_response(self,409,{"error":"Das Thema enthält noch Standardantworten."})
                conn.execute("DELETE FROM bid_question_topics WHERE id=?",(int(m.group(1)),))
                audit_event(conn,current,"delete-permanent","bid-topic",m.group(1),"Bieterfragen-Thema gelöscht")
            return json_response(self,200,{"ok":True})
        m=re.fullmatch(r"/api/bid/categories/(\d+)",p)
        if m:
            current=self.require_auth(permission="bid_answers_manage")
            if not current:return
            with db() as conn:
                count=conn.execute("SELECT COUNT(*) FROM bid_question_topics WHERE category_id=?",(int(m.group(1)),)).fetchone()[0]
                if count:return json_response(self,409,{"error":"Die Kategorie enthält noch Themen."})
                conn.execute("DELETE FROM bid_question_categories WHERE id=?",(int(m.group(1)),))
                audit_event(conn,current,"delete-permanent","bid-category",m.group(1),"Bieterfragen-Kategorie gelöscht")
            return json_response(self,200,{"ok":True})
        m=re.fullmatch(r"/api/favorites/(\d+)",p)
        if m:
            current=self.require_auth(permission="email_create")
            if not current:return
            with db() as conn:
                conn.execute("DELETE FROM favorite_templates WHERE user_id=? AND template_id=?",
                             (current["id"],int(m.group(1))))
            return json_response(self,200,{"ok":True})
        m=re.fullmatch(r"/api/variables/(\d+)",p)
        if m:
            if not self.require_auth(permission="variables_manage"): return
            variable_id = int(m.group(1))
            with db() as conn:
                row = conn.execute("SELECT key FROM variables WHERE id=?",(variable_id,)).fetchone()
                if not row: return json_response(self,404,{"error":"Platzhalter nicht gefunden."})
                if row["key"] in {"projekt.id","projekt.bezeichnung"}:
                    return json_response(self,409,{"error":"Projekt-ID und Projektbezeichnung sind technische Pflichtfelder und können nicht gelöscht werden."})
                needle = "{{" + row["key"] + "}}"
                used = conn.execute(
                    "SELECT COUNT(*) FROM templates WHERE subject LIKE ? OR body LIKE ?",
                    (f"%{needle}%",f"%{needle}%")
                ).fetchone()[0]
                if used:
                    return json_response(self,409,{"error":"Der Platzhalter wird noch in einer Vorlage verwendet und kann nicht gelöscht werden."})
                conn.execute("DELETE FROM variables WHERE id=?",(variable_id,))
            return json_response(self,200,{"ok":True})
        m=re.fullmatch(r"/api/projects/(\d+)",p)
        if m:
            current = self.require_auth(permission="projects_manage")
            if not current: return
            with db() as conn:
                conn.execute("UPDATE projects SET archived=1 WHERE id=?",(int(m.group(1)),))
                audit_event(conn,current,"archive","project",m.group(1),"Projekt archiviert")
            return json_response(self,200,{"ok":True})
        m=re.fullmatch(r"/api/templates/(\d+)",p)
        if m:
            current = self.require_auth(permission="templates_manage")
            if not current:return
            template_id=int(m.group(1))
            with db() as conn:
                conn.execute("UPDATE templates SET archived=1 WHERE id=?",(template_id,))
                save_template_version(conn,template_id,current["id"])
                audit_event(conn,current,"archive","template",template_id,"Vorlage archiviert")
            return json_response(self,200,{"ok":True})
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
        m=re.fullmatch(r"/api/categories/(\d+)",p)
        if m:
            if not self.require_auth(permission="categories_manage"):return
            category_id=int(m.group(1))
            with db() as conn:
                used=conn.execute("SELECT COUNT(*) FROM templates WHERE category_id=?",(category_id,)).fetchone()[0]
                if used:return json_response(self,409,{"error":"Die Kategorie wird noch von E-Mail-Vorlagen verwendet."})
                conn.execute("DELETE FROM categories WHERE id=?",(category_id,))
            return json_response(self,200,{"ok":True})
        m=re.fullmatch(r"/api/dashboard/(\d+)",p)
        if m:
            current=self.require_auth(permission="email_create")
            if not current:return
            with db() as conn:
                conn.execute("DELETE FROM dashboard_tiles WHERE id=? AND user_id=?",
                             (int(m.group(1)),current["id"]))
            return json_response(self,200,{"ok":True})
        m=re.fullmatch(r"/api/dashboard/quicklinks/(\d+)",p)
        if m:
            current=self.require_auth(permission="email_create")
            if not current:return
            with db() as conn:
                conn.execute("DELETE FROM dashboard_quicklinks WHERE id=? AND user_id=?",
                             (int(m.group(1)),current["id"]))
            return json_response(self,200,{"ok":True})
        m=re.fullmatch(r"/api/roles/(\d+)",p)
        if m:
            current = self.require_auth(permission="roles_manage")
            if not current: return
            role_id = int(m.group(1))
            with db() as conn:
                role = conn.execute("SELECT * FROM roles WHERE id=?",(role_id,)).fetchone()
                if not role: return json_response(self,404,{"error":"Rolle nicht gefunden."})
                if role["is_system"]:
                    return json_response(self,409,{"error":"Systemrollen können nicht gelöscht werden."})
                assigned = conn.execute("SELECT COUNT(*) FROM users WHERE role_id=?",(role_id,)).fetchone()[0]
                if assigned:
                    return json_response(self,409,{"error":"Die Rolle ist noch Benutzern zugewiesen."})
                audit_event(conn,current,"delete-permanent","role",role_id,f"Rolle {role['name']} gelöscht")
                conn.execute("DELETE FROM roles WHERE id=?",(role_id,))
            return json_response(self,200,{"ok":True})
        self.send_error(404)

if __name__ == "__main__":
    init_db()
    create_daily_backup()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    actual_port = server.server_address[1]
    url = f"http://{HOST}:{actual_port}/"
    print(f"Wieseke Vorlagen-Engine v{SOFTWARE_VERSION} läuft unter {url}")
    print("Standardzugang bei neuer Datenbank: admin / Admin12345!")
    print("Dieses Fenster muss geöffnet bleiben. Beenden mit Strg+C.")
    if OPEN_BROWSER:
        threading.Timer(1.0, lambda: webbrowser.open(url, new=1)).start()
    server.serve_forever()
