# Dokumentvorlagen

## Ablauf ab Version 3.2

1. Unter Dokumentvorlagen eine Vorlage anlegen und die DOCX-Datei hochladen.
2. Die rechte Seite zeigt erkannte Datenfelder, verwendete Textbausteine und
   Hinweise zu unbekannten Feldern oder fehlerhaften Bedingungen.
3. Speichern ist auch bei Hinweisen möglich. Über „Mit Vorlage testen“ die
   Erstellungsseite öffnen, Daten ausfüllen und „Eingaben und Vorlage prüfen“
   wählen. Erst eine erfolgreiche Testgenerierung bestätigt die Verarbeitbarkeit.
4. Wahlweise manuell arbeiten oder ein Projekt und optional einen Kontakt über
   die Suchdialoge wählen. Fehlende Werte können in den Feldern ergänzt werden.
5. Word herunterladen; im Projektmodus alternativ „Im Projekt speichern“ wählen.
   Gespeicherte Dateien erscheinen auf der Projektseite. Spätere Änderungen an
   Vorlagen oder Textbausteinen verändern diese Dateien nicht.

Das Word-Original und frühere Dateiversionen sind auf der Bearbeitungsseite
herunterladbar. Zum Wiederherstellen eine frühere Version herunterladen und
wieder als DOCX hochladen. Änderungen nur am Namen oder der Beschreibung
erzeugen keine zusätzliche Dateikopie. Dateiversionen enthalten ausschließlich
die DOCX-Vorlage; aktuelle zentrale Textbausteine sind nicht darin eingefroren.

Die Vorlagenprüfung weist auch auf leere Felder hin. Ein optionaler, leerer Wert
kann trotzdem korrekt sein; deshalb ist die Prüfung kein Freigabeprozess.
Word-Layout, Umbrüche und Schriften bitte zusätzlich in der erzeugten Datei
kontrollieren. PDF benötigt weiterhin eine lokale LibreOffice-Installation.
Kontaktschleifen verwenden die Kontaktliste des Projekts; im manuellen Modus
ist diese Liste leer. Der separat ausgewählte Kontakt ist als `kontakt` verfügbar.

Die Anwendung verwendet normale `.docx`-Dateien als Layoutvorlagen. Kopf- und
Fußzeilen, Tabellen, Schriften und Absatzformatierungen werden direkt in Word
gepflegt. Ein vollständiger Word-Editor im Browser ist bewusst nicht enthalten.

## Platzhalter

Einfache Werte:

```text
{{ projekt.id }}
{{ projekt.bezeichnung }}
{{ auftraggeber.name }}
{{ benutzer.vorname }}
```

Textbausteine werden in der Anwendung gepflegt und so eingefügt:

```text
{{ baustein.standardhinweis }}
```

## Einfache Bedingungen und Listen

Ein optionaler Absatz verwendet in Word jeweils eine eigene Steuerzeile:

```text
{%p if projekt.fahrzeugtyp %}
Fahrzeugtyp: {{ projekt.fahrzeugtyp }}
{%p endif %}
```

Eine Liste kann über Kontakte laufen:

```text
{%p for kontakt in kontakte %}
{{ kontakt.vorname }} {{ kontakt.nachname }}
{%p endfor %}
```

Wichtig: Jeder Platzhalter sollte in Word innerhalb eines einzigen formatierten
Textlaufs stehen. Am einfachsten wird er vollständig am Stück eingegeben oder
aus der Platzhalterübersicht kopiert.

Der Word-Export ist immer verfügbar. Der PDF-Export wird automatisch aktiviert,
wenn auf dem Server LibreOffice (`soffice`) installiert ist.
