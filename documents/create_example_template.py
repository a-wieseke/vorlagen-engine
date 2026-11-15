"""Create the bundled example document template.

The example uses the ``standard_business_brief`` visual preset with a
``memo_masthead`` header. Jinja tokens are written as single Word runs because
Word must not split a token across differently formatted runs.
"""

from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor


OUTPUT = Path(__file__).with_name("beispiel-dokumentvorlage.docx")
RED = RGBColor(225, 37, 27)
DARK = RGBColor(35, 35, 35)


def add_field(document, label, token):
    paragraph = document.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(5)
    label_run = paragraph.add_run(f"{label}: ")
    label_run.bold = True
    paragraph.add_run(token)


document = Document()
section = document.sections[0]
section.top_margin = Cm(2.0)
section.bottom_margin = Cm(1.8)
section.left_margin = Cm(2.2)
section.right_margin = Cm(2.2)

styles = document.styles
styles["Normal"].font.name = "Arial"
styles["Normal"].font.size = Pt(10.5)
styles["Title"].font.name = "Arial"
styles["Title"].font.size = Pt(22)
styles["Title"].font.color.rgb = DARK

header = section.header.paragraphs[0]
header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
brand = header.add_run("AGENTUR WIESEKE")
brand.bold = True
brand.font.name = "Arial"
brand.font.size = Pt(11)
brand.font.color.rgb = RED

document.add_heading("Projektinformation", level=0)
subtitle = document.add_paragraph("Automatisch aus der Wieseke Vorlagen-Engine erzeugt")
subtitle.style = document.styles["Subtitle"]

add_field(document, "Projekt-ID", "{{ projekt.id }}")
add_field(document, "Projekt", "{{ projekt.bezeichnung }}")
add_field(document, "Auftraggeber", "{{ auftraggeber.name }}")

document.add_paragraph("{%p if projekt.fahrzeugtyp %}")
add_field(document, "Fahrzeugtyp", "{{ projekt.fahrzeugtyp }}")
document.add_paragraph("{%p endif %}")

document.add_heading("Hinweis", level=1)
document.add_paragraph("{{ baustein.standardhinweis }}")

document.add_heading("Projektkontakte", level=1)
document.add_paragraph("{%p for kontakt in kontakte %}")
contact = document.add_paragraph(style="List Bullet")
contact.add_run("{{ kontakt.vorname }} {{ kontakt.nachname }} – {{ kontakt.email }}")
document.add_paragraph("{%p endfor %}")

document.add_paragraph()
closing = document.add_paragraph("Erstellt durch {{ benutzer.vorname }} {{ benutzer.nachname }}")
closing.paragraph_format.space_before = Pt(18)
closing.runs[0].italic = True

footer = section.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = footer.add_run("Wieseke Vorlagen-Engine · Beispieldokument")
run.font.name = "Arial"
run.font.size = Pt(8)
run.font.color.rgb = RGBColor(100, 100, 100)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
document.save(OUTPUT)
print(OUTPUT)
