"""One project contract for browser forms, Excel and the integration API."""
import copy
import json


def validate_project(value, *, require_schema=False):
    if not isinstance(value, dict):
        raise ValueError("Projektdaten müssen ein JSON-Objekt sein.")
    data = copy.deepcopy(value)
    if require_schema and data.get("schema_version") != "1.0":
        raise ValueError("schema_version muss 1.0 sein.")
    project = data.get("projekt")
    if not isinstance(project, dict):
        raise ValueError("projekt muss ein Objekt sein.")
    for field, maximum in (("id", 200), ("bezeichnung", 1000)):
        text = project.get(field)
        if not isinstance(text, str) or not text.strip() or len(text) > maximum or any(ord(c) < 32 for c in text):
            raise ValueError(f"projekt.{field} muss ein nichtleerer Text mit höchstens {maximum} Zeichen sein.")
        project[field] = text.strip()
    if "auftraggeber" in data and not isinstance(data["auftraggeber"], dict):
        raise ValueError("auftraggeber muss ein Objekt sein.")
    data["kontakte"] = validate_contacts(data.get("kontakte", []))
    # Unknown fields intentionally survive round trips (custom placeholders).
    if len(json.dumps(data, ensure_ascii=False).encode("utf-8")) > 256_000:
        raise ValueError("Projektdaten dürfen höchstens 256.000 Bytes enthalten.")
    return data


def validate_contacts(contacts):
    if not isinstance(contacts, list) or len(contacts) > 100 or any(not isinstance(c, dict) for c in contacts):
        raise ValueError("kontakte muss eine Liste mit höchstens 100 Kontaktobjekten sein.")
    if any(not isinstance(v, str) for c in contacts for v in c.values()):
        raise ValueError("Kontaktfelder müssen Texte sein.")
    return copy.deepcopy(contacts)


def revision_matches(row, data):
    value = data.get("expected_revision") if isinstance(data, dict) else None
    return type(value) is int and value == row["revision"]


CONFLICT = {"error": "Dieses Projekt wurde inzwischen geändert. Ihre Eingaben bleiben erhalten. Bitte laden Sie den aktuellen Stand neu und übernehmen Sie Ihre Änderungen erneut.", "code": "revision_conflict"}
ARCHIVED = {"error": "Dieses Projekt ist archiviert. Stellen Sie es ausdrücklich wieder her, bevor Sie es ändern.", "code": "project_archived"}
