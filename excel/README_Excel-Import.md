# Excel-Direktimport

Die Datei `Wieseke_Projektimport.bas` kann im VBA-Editor über **Datei → Datei importieren** in die zentrale Projektarbeitsmappe übernommen werden.

Das Makro erwartet folgende benannte Bereiche:

- `Projekt_ID`
- `Projekt_Bezeichnung`
- `Projekt_Fahrzeugtyp`
- `Projekt_Status`
- `Auftraggeber_Name`
- `Auftraggeber_Strasse`
- `Auftraggeber_PLZ`
- `Auftraggeber_Ort`

Mehrere Kontakte werden optional aus der Excel-Tabelle `tblKontakte` gelesen. Erwartete Spalten: `Rolle`, `Anrede`, `Vorname`, `Nachname`, `E-Mail`, `Telefon`.

Die Schaltfläche in Excel wird mit dem Makro `ProjektAnVorlagenEngine` verknüpft. Das Makro kopiert JSON in die Zwischenablage und öffnet `http://127.0.0.1:8877/excel-import`. Ist noch keine Sitzung aktiv, erscheint zuerst die Anmeldung; danach wird die Importseite geöffnet. Aus Sicherheitsgründen muss das Einlesen der Zwischenablage dort mit einem Klick bestätigt werden.

Die Anwendung muss zuvor über `start_windows.bat` laufen. Bestehende Projekte werden anhand ihrer Projekt-ID aktualisiert.
