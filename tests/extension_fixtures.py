"""Synthetic file fixtures for the isolated browser test; never reads live data."""
import sys
from pathlib import Path
from docx import Document
from openpyxl import load_workbook

action, filename = sys.argv[1:3]
path = Path(filename)
path.parent.mkdir(parents=True, exist_ok=True)
if action == "docx":
    document = Document()
    document.add_heading("Projektunterlage", 0)
    document.add_paragraph("Projekt: {{ projekt.bezeichnung }}")
    document.add_paragraph("Kontakt: {{ kontakt.vorname }}")
    document.add_paragraph("{{ baustein.browser_hinweis }}")
    document.save(path)
elif action == "fill":
    workbook = load_workbook(path)
    for column, value in enumerate([sys.argv[3], "Musterbieter", "Fristen", "Ist eine Verlängerung möglich?\nBitte prüfen.", "Kommentar\nmit zwei Zeilen", "zugelassen", "Die Frist wird verlängert."], 1):
        workbook["Bieterfragen"].cell(2, column, value)
    workbook.save(path.with_name("ausgefuellt.xlsx"))
else:
    raise ValueError(action)
