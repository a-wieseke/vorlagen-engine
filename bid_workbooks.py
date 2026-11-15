"""Excel round trip for bidder questions, independent of HTTP and authentication.

Every download takes a taxonomy snapshot. The hidden mapping preserves stable
IDs when names change; import always validates those IDs against live records.
No formulas or macros from an uploaded workbook are executed.
"""
import io
import zipfile
from datetime import datetime

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.utils import get_column_letter

HEADERS = ["Fragenkategorie", "Bieter", "Thema", "Bieterfrage",
           "Kommentar Agentur Wieseke", "Entscheidung", "Antwort"]
FIELDS = ["category", "bidder", "subject", "question", "agency_comment", "decision", "answer"]
MAX_ROWS = 500
MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def question_signature(item):
    # Use stable taxonomy IDs so a later rename cannot turn a repeat import
    # into a seemingly new question. Legacy free-text questions keep their text.
    return (item["category_id"] or item["category"], item["topic_id"] or item["subject"],
            *(str(item[field] or "").strip() for field in FIELDS if field not in {"category", "subject"}))


def checked_archive(raw):
    if not raw or len(raw) > 10_000_000:
        raise ValueError("Bitte eine Excel-Datei mit höchstens 10 MB verwenden.")
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            entries = archive.infolist()
            if len(entries) > 2000 or sum(item.file_size for item in entries) > 40_000_000:
                raise ValueError("Die entpackte Datei ist zu groß.")
            if any("vbaproject" in item.filename.lower() for item in entries):
                raise ValueError("Bitte eine XLSX-Datei ohne Makros verwenden.")
    except zipfile.BadZipFile as exc:
        raise ValueError("Die Datei ist keine gültige XLSX-Datei.") from exc


def text_cell(sheet, row, column, value):
    # Catalog names starting with '=' must remain labels, never Excel formulas.
    cell = sheet.cell(row, column, str(value))
    cell.data_type = "s"
    return cell


def make_template(conn):
    categories = conn.execute("SELECT * FROM bid_question_categories WHERE active=1 ORDER BY sort_order,id").fetchall()
    topics = conn.execute("SELECT * FROM bid_question_topics WHERE active=1 ORDER BY sort_order,id").fetchall()
    book = Workbook()
    sheet = book.active
    sheet.title = "Bieterfragen"
    lists = book.create_sheet("_Listen")
    mapping = book.create_sheet("_Zuordnung")
    mapping.append(["WVE-Bieterfragen", "1"])
    mapping.append(["Art", "ID", "Kategorie-ID", "Name"])
    book.defined_names.add(DefinedName("EmptyTopics", attr_text="'_Listen'!$C$1"))
    for row, category in enumerate(categories, 2):
        text_cell(lists, row, 1, category["name"])
        lists.cell(row, 2, f"Topics_{category['id']}")
        mapping.append(["category", category["id"], None, category["name"]])
        mapping.cell(mapping.max_row, 4).data_type = "s"
        column = get_column_letter(row + 2)
        members = [topic for topic in topics if topic["category_id"] == category["id"]]
        for number, topic in enumerate(members, 1):
            text_cell(lists, number, row + 2, topic["name"])
            mapping.append(["topic", topic["id"], category["id"], topic["name"]])
            mapping.cell(mapping.max_row, 4).data_type = "s"
        book.defined_names.add(DefinedName(f"Topics_{category['id']}", attr_text=f"'_Listen'!${column}$1:${column}${max(1,len(members))}"))
    last = max(2, len(categories) + 1)
    book.defined_names.add(DefinedName("Categories", attr_text=f"'_Listen'!$A$2:$A${last}"))
    book.defined_names.add(DefinedName("CategoryTopicMap", attr_text=f"'_Listen'!$A$2:$B${last}"))
    sheet.append(HEADERS)
    for col, width in enumerate([28, 27, 32, 60, 55, 19, 60], 1):
        sheet.column_dimensions[get_column_letter(col)].width = width
        cell = sheet.cell(1, col)
        cell.font = Font(color="FFFFFF", bold=True)
        cell.fill = PatternFill("solid", fgColor="123A63")
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    sheet.row_dimensions[1].height = 32
    for row in range(2, MAX_ROWS + 2):
        for col in range(1, 8):
            cell = sheet.cell(row, col)
            cell.number_format = "@"
            cell.alignment = Alignment(wrap_text=True, vertical="top")
        if row < 22:
            sheet.row_dimensions[row].height = 48
    sheet.freeze_panes = "D2"
    sheet.auto_filter.ref = f"A1:G{MAX_ROWS+1}"
    for column, formula in [("A", "Categories"), ("C", 'INDIRECT(IFERROR(VLOOKUP($A2,CategoryTopicMap,2,FALSE),"EmptyTopics"))'), ("F", '"zugelassen,abgelehnt"')]:
        validation = DataValidation(type="list", formula1=formula, allow_blank=True)
        validation.showErrorMessage = True
        validation.errorTitle = "Bitte einen Listeneintrag wählen"
        validation.error = "Bei einem Kategorienwechsel bitte auch das Thema neu auswählen."
        validation.errorStyle = "stop"
        sheet.add_data_validation(validation)
        validation.add(f"{column}2:{column}{MAX_ROWS+1}")
    guide = book.create_sheet("Anleitung", 0)
    notes = ["Bieterfragen erfassen", f"Kategorienstand: {datetime.now():%d.%m.%Y %H:%M}",
             "1. Im Blatt Bieterfragen bis zu 500 Fragen zeilenweise eintragen.",
             "2. Erst Fragenkategorie, danach ein dazugehöriges Thema auswählen.",
             "3. Bei einem Kategorienwechsel muss das Thema neu gewählt werden.",
             "4. Kategorie, Thema und Fragetext sind erforderlich. Mehrzeilige Inhalte bleiben erhalten.",
             "5. Datei speichern, in der Anwendung Projekt/Jahr wählen und XLSX hochladen.",
             "6. Vorschau prüfen. Fehler verhindern den Import; identische Fragen werden übersprungen.",
             "Bereits heruntergeladene Dateien aktualisieren sich nicht automatisch.",
             "Umbenannte Einträge werden anhand ihrer Kennung zugeordnet. Gelöschte oder deaktivierte Einträge werden gemeldet.",
             "Bitte Spaltenüberschriften und die ausgeblendeten Zuordnungsblätter erhalten.",
             "Projekt und Jahr werden beim Import in der Anwendung festgelegt."]
    for number, value in enumerate(notes, 1):
        guide.cell(number, 1, value).alignment = Alignment(wrap_text=True, vertical="top")
        guide.row_dimensions[number].height = 34
    guide.column_dimensions["A"].width = 110
    guide["A1"].font = Font(size=18, bold=True, color="123A63")
    lists.sheet_state = mapping.sheet_state = "hidden"
    book.active = 1
    stream = io.BytesIO()
    book.save(stream)
    return stream.getvalue()


def preview_import(conn, raw, project_id, year):
    checked_archive(raw)
    if not 2000 <= year <= 2100:
        raise ValueError("Das Jahr muss zwischen 2000 und 2100 liegen.")
    if not conn.execute("SELECT id FROM projects WHERE id=? AND archived=0", (project_id,)).fetchone():
        raise ValueError("Bitte ein vorhandenes, nicht archiviertes Projekt auswählen.")
    try:
        book = load_workbook(io.BytesIO(raw), read_only=True, data_only=False, keep_links=False)
    except Exception as exc:
        raise ValueError("Die Excel-Datei konnte nicht gelesen werden.") from exc
    try:
        if not {"Bieterfragen", "_Zuordnung"}.issubset(book.sheetnames):
            raise ValueError("Bitte die heruntergeladene Excel-Vorlage verwenden.")
        sheet, mapping = book["Bieterfragen"], book["_Zuordnung"]
        if mapping["A1"].value != "WVE-Bieterfragen" or str(mapping["B1"].value) != "1":
            raise ValueError("Die Version der Excel-Vorlage wird nicht unterstützt.")
        if sheet.max_row > MAX_ROWS + 1 or sheet.max_column > 7 or mapping.max_row > 10000:
            raise ValueError("Die Vorlage unterstützt höchstens 500 Fragen und 7 Spalten.")
        if [cell.value for cell in next(sheet.iter_rows(max_row=1, max_col=7))] != HEADERS:
            raise ValueError("Die Spaltenüberschriften wurden verändert. Bitte die aktuelle Vorlage verwenden.")
        old_categories, old_topics = {}, {}
        for kind, ident, parent, name in mapping.iter_rows(min_row=3, max_col=4, values_only=True):
            if kind == "category": old_categories[str(name)] = int(ident)
            elif kind == "topic": old_topics[(int(parent), str(name))] = int(ident)
        categories = {row["id"]: row for row in conn.execute("SELECT * FROM bid_question_categories WHERE active=1")}
        topics = {row["id"]: row for row in conn.execute("SELECT * FROM bid_question_topics WHERE active=1")}
        bidders = {row["bidder"].casefold(): row["id"] for row in conn.execute("SELECT id,bidder FROM bidders WHERE active=1")}
        existing = {question_signature(row) for row in conn.execute("SELECT * FROM bid_questions WHERE project_id=? AND question_year=?", (project_id, year))}
        result = []
        for number, cells in enumerate(sheet.iter_rows(min_row=2, max_col=7), 2):
            values = [str(cell.value).strip() if cell.value is not None else "" for cell in cells]
            if not any(values): continue
            item = dict(zip(FIELDS, values))
            item.update(row=number, errors=[], warnings=[], project_id=project_id, question_year=year, category_id=None, topic_id=None)
            if any(cell.data_type == "f" for cell in cells): item["errors"].append("Formeln sind nicht erlaubt. Bitte Werte als Text einfügen.")
            if any(len(value) > 32000 for value in values): item["errors"].append("Ein Feld überschreitet 32.000 Zeichen.")
            category = categories.get(old_categories.get(item["category"]))
            if not category: item["errors"].append("Kategorie fehlt, ist unbekannt oder nicht mehr aktiv. Bitte eine neue Vorlage herunterladen.")
            topic = topics.get(old_topics.get((category["id"], item["subject"]))) if category else None
            if not topic or not category or topic["category_id"] != category["id"]:
                item["errors"].append("Thema fehlt, ist nicht mehr aktiv oder passt nicht zur Kategorie.")
            if category:
                item["category_id"] = category["id"]
                if category["name"] != item["category"]: item["warnings"].append(f"Kategorie wurde umbenannt: {category['name']}")
                item["category"] = category["name"]
            if topic:
                item["topic_id"] = topic["id"]
                if topic["name"] != item["subject"]: item["warnings"].append(f"Thema wurde umbenannt: {topic['name']}")
                item["subject"] = topic["name"]
            if not item["question"]: item["errors"].append("Die Bieterfrage fehlt.")
            item["decision"] = item["decision"].lower()
            if item["decision"] not in {"", "zugelassen", "abgelehnt"}: item["errors"].append("Ungültige Entscheidung.")
            item["bidder_id"] = bidders.get(item["bidder"].casefold())
            if item["bidder"] and not item["bidder_id"]: item["warnings"].append("Bieter wird als Text übernommen; kein Eintrag im Bieterverzeichnis gefunden.")
            signature = question_signature(item)
            item["duplicate"] = signature in existing
            if item["duplicate"]: item["warnings"].append("Identische Frage bereits vorhanden oder doppelt in dieser Datei; wird übersprungen.")
            existing.add(signature)
            result.append(item)
        return {"rows": result, "valid": bool(result) and not any(row["errors"] for row in result),
                "importable": sum(not row["errors"] and not row["duplicate"] for row in result),
                "duplicates": sum(row["duplicate"] for row in result)}
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Die Zuordnungsdaten der Datei sind beschädigt. Bitte eine neue Vorlage verwenden.") from exc
    finally:
        book.close()


def commit_import(conn, preview, user_id, timestamp):
    """Called within the same write transaction as a fresh validation."""
    ids = []
    for item in preview["rows"]:
        if item["duplicate"]: continue
        cur = conn.execute("""INSERT INTO bid_questions
            (project_id,question_year,category,bidder,subject,question,agency_comment,decision,answer,
             category_id,topic_id,bidder_id,created_by,created_at,updated_at)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (item["project_id"], item["question_year"],
            *(item[field] for field in FIELDS), item["category_id"], item["topic_id"], item["bidder_id"],
            user_id, timestamp, timestamp))
        ids.append(cur.lastrowid)
    return ids
