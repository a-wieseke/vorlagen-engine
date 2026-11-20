"""Preflight and numbered, auditable upgrades. No changes to unknown schemas."""
import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from .projects import validate_project


def inspect_database(path, target):
    if not path.exists() or not path.stat().st_size:
        return 0
    with closing(sqlite3.connect(path)) as conn:
        tables = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        row = conn.execute("SELECT schema_version FROM schema_meta WHERE id=1").fetchone() if "schema_meta" in tables else None
        version = row[0] if row else 0
        if version > target:
            raise RuntimeError(f"Datenbankschema {version} ist neuer als unterstützt ({target}). Keine Änderung durchgeführt.")
        if version < target and "projects" in tables:
            errors = []
            for project in conn.execute("SELECT id,data_json FROM projects"):
                try:
                    validate_project(json.loads(project[1]))
                except (ValueError, TypeError) as error:
                    errors.append(f"Projekt #{project[0]}: {error}")
            if errors:
                raise RuntimeError("Migration abgebrochen. Bestandsdaten unverändert; bitte korrigieren:\n" + "\n".join(errors))
        return version


def migrate(conn, previous, target):
    conn.execute("CREATE TABLE IF NOT EXISTS migration_log (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL, description TEXT NOT NULL)")
    if previous < 12:
        for table, name, declaration in (
            ("projects", "revision", "INTEGER NOT NULL DEFAULT 1"),
            ("users", "failed_recovery_attempts", "INTEGER NOT NULL DEFAULT 0"),
            ("users", "recovery_locked_until", "TEXT"),
        ):
            columns = {r[1] for r in conn.execute(f"PRAGMA table_info({table})")}
            if name not in columns:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {declaration}")
        record(conn, 12, "Projektrevisionen und unabhängige Wiederherstellungssperren")
    if previous < 13 <= target:
        columns = {r[1] for r in conn.execute("PRAGMA table_info(app_settings)")}
        if "navigation_areas_json" not in columns:
            conn.execute("ALTER TABLE app_settings ADD COLUMN navigation_areas_json TEXT NOT NULL DEFAULT '{}'")
        row = conn.execute("SELECT navigation_order_json FROM app_settings WHERE id=1").fetchone()
        order = json.loads(row[0] or '[]') if row else []
        conn.execute("UPDATE app_settings SET navigation_areas_json=? WHERE id=1", (json.dumps(navigation_areas(order)),))
        record(conn,13,"Navigation in Arbeiten, Bibliotheken und Administration aufgeteilt")
    conn.execute("INSERT INTO schema_meta(id,schema_version,migrated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET schema_version=excluded.schema_version,migrated_at=excluded.migrated_at", (target, datetime.now(timezone.utc).isoformat()))


def record(conn, version, description):
    conn.execute("INSERT OR IGNORE INTO migration_log VALUES(?,?,?)", (version, datetime.now(timezone.utc).isoformat(), description))


def navigation_areas(order):
    defaults={'work':['dashboard','projects','email','documents','bidder'], 'library':['email','documents','bidder','bidders','variables'], 'admin':['users','system']}
    return {area: [key for key in order if key in keys]+[key for key in keys if key not in order] for area,keys in defaults.items()}
