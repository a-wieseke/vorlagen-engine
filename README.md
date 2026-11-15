# Wieseke Vorlagen-Engine – Version 3.4

## Neu in Version 3.4

- Projekt-API: `POST /api/integration/projects`, ausschließlich zum Neuanlegen.
  Vorhandene IDs (auch archivierte) liefern HTTP 409 und bleiben unverändert.
- Persönliche Schlüssel unter „Mein Konto“, für Administratoren auch über
  Benutzerverwaltung → API-Schlüssel verwalten erreichbar. Erstellen/Erneuern
  zeigt den zufälligen Schlüssel einmalig an; Sperren wirkt sofort. Die Datenbank
  enthält ausschließlich SHA-256-Hashes der zufälligen 256-Bit-Schlüssel.
- Neue Rollenberechtigung „Projekte über API anlegen / persönliche API-Schlüssel“.
  Aktueller Kontostatus, Passwortwechselpflicht und Berechtigung werden bei jedem
  API-Aufruf geprüft. Schlüssel ermöglichen keine sonstigen App-Funktionen.
- Integrierte API-Dokumentation unter Hilfe: JSON-Beispiel, Fehlercodes, Grenzen,
  HTTPS-/Cloudflare-Hinweise. Ein Windows-Excel-Beispiel liegt in
  `excel/ProjektAPI.bas`; es liest JSON aus dem benannten Bereich `Projekt_JSON`
  und URL/Schlüssel aus Windows-Umgebungsvariablen. Das Makro wurde nicht in einer
  nativen Excel-Installation ausgeführt; die HTTP-Schnittstelle wird getestet.
- Bieternamen öffnen einen Dialog mit vierzeiliger, direkt kopierbarer Anschrift.
  Das Stift-Symbol rechts öffnet die Bearbeitung. Kommentar unter Website,
  zusätzliche Verzeichnisspalte und Suchberücksichtigung; CSV-Spalte 8 bzw.
  JSON-Feld `comment` für Importe.
- Mehr Innenabstand im Bilddialog, auch auf kleinen Bildschirmen.

### Update von 3.3

Datenbank sichern, Anwendung stoppen und Programmdateien einschließlich `static`
und `excel` aktualisieren. Datenbank, eigene Konfiguration und Backups behalten.
Beim nächsten Start wird Schema 11 automatisch ergänzt (API-Schlüssel und
Bieterkommentar). Bestehende Projekte und Bieter bleiben erhalten. Die neue
API-Berechtigung gezielt den gewünschten Rollen zuweisen; Administratoren haben
sie automatisch. Das Testdaten-Resetskript ist für dieses Update nicht erforderlich.

Die API akzeptiert bis 256.000 Bytes je Anfrage und 100 Kontakte. Limits:
60 Aufrufe je Schlüssel/Minute und 300 je Verbindungsadresse/Minute. Bei einem
Reverse Proxy teilen sich Aufrufer gegebenenfalls die Verbindungsadresse.
Rate-Limits liegen im Arbeitsspeicher und werden beim Neustart zurückgesetzt.
Die App bleibt für einen einzelnen Serverprozess ausgelegt.

## Neu in Version 3.3

- Bilder im E-Mail-Vorlageneditor und im bearbeitbaren Ergebnis: PNG/JPG hochladen,
  Anzeigebreite und Bildbeschreibung festlegen; zum Ändern oder Entfernen das Bild anklicken.
- Bilder werden im EML-Export als eingebettete CID-Bildteile mitgeliefert, auch beim
  Einzel- und Sammelexport von Vorlagen. Ein externer Bildserver ist nicht nötig.
- Mailto und Kopieren zeigen bei Bildern zuerst einen Hinweis und übernehmen dann
  nur Klartext mit Bildbeschreibungen. Für vollständig formatierte Mails EML verwenden.
- Bieterverzeichnis als durchsuchbare Tabelle, korrigierte PLZ/Ort-Anordnung und
  kompakte Projektaktionen mit beschrifteten Icons; Projektdaten mit Stift-Symbol.

### Update von 3.2

Anwendung stoppen und Datenbank sichern. Programmdateien einschließlich
`email_images.py`, `requirements.txt` und des gesamten Ordners `static` aktualisieren.
Vorhandene Datenbank, Konfiguration und Sicherungen behalten. Das Startskript
installiert die zusätzliche Abhängigkeit Pillow; bei eigener Installation
`python -m pip install -r requirements.txt` ausführen. Danach starten und Browser
neu laden. Schema 10 bleibt unverändert. Niemals die Testdaten-Resetdatei verwenden,
wenn eigene Daten erhalten bleiben sollen.

Bilder werden zusammen mit dem HTML in SQLite gespeichert und sind damit auch in
Vorlagenversionen, JSON-Exporten und Projekt-Mails enthalten. Sie vergrößern die
Datenbank und Backups. Der bestehende Browser-Wiederherstellungsweg ist auf 20 MB
begrenzt; größere Sicherungen bei gestoppter Anwendung dateibasiert wiederherstellen.
Bilddateien dürfen beim Upload maximal 8 MB / 20 Millionen Pixel haben. Die App
entfernt Metadaten, erhält das Seitenverhältnis und normalisiert sie auf PNG mit
höchstens 1600 Pixel Kantenlänge / 2 MB. Pro E-Mail maximal 10 Bilder / zusammen 4 MB.
Externe Bild-URLs, SVG, Animationen und freie Bildbearbeitung sind nicht vorgesehen.

Die Bildlogik ist in `email_images.py` und `static/email-images.js` ausgelagert.
`tests/test_email_images.py` prüft Validierung, Berechtigungen, Speicherung und MIME;
`tests/ui-email-images.mjs` prüft den Editor und die geänderten Oberflächen auf einer
isolierten Testinstanz. Das Öffnen in einer nativen Outlook-Installation ist kein
Bestandteil dieser automatisierten Tests; bitte einmal am eigenen Arbeitsplatz prüfen.

Geprüft: 79 Backend-Tests sowie die Browserabläufe für Bildeditor/EML,
Bietertabelle/Projektaktionen, Navigation und XLSX-/Dokumentfunktionen.
Die geänderten Oberflächen wurden auch mit schmalen Bildschirmbreiten geprüft.

## Neu in Version 3.2

- Excel-Batchvorlage für Bieterfragen: aktuelle Kategorien, davon abhängige Themen und Entscheidungen als Dropdowns; bis zu 500 Zeilen.
- XLSX-Upload mit lesbarer Vorschau, zeilenbezogenen Fehlern und Duplikaterkennung. Projekt und Jahr werden einmal für die ganze Datei gewählt.
- Mehrzeilige Fragen, Kommentare und Antworten bleiben erhalten. Beim abschließenden Import werden alle Daten erneut geprüft und gemeinsam gespeichert.
- Dokumentvorlagen als eigene Liste und separate Bearbeitungsseite; Suche für Vorlage, Projekt und Kontakt.
- Platzhalterprüfung einschließlich verwendeter Textbausteine, Warnungen statt Speicherverbot und Testgenerierung ohne Download oder Projektspeicherung.
- Word-Original herunterladen und ersetzen; bisherige DOCX-Dateiversionen bleiben abrufbar. Textbausteine werden nur bei tatsächlicher Verwendung ausgewertet.
- Fertige Word- oder PDF-Dateien als Momentaufnahme im Projekt speichern und auf der Projektseite herunterladen.
- PDF bleibt optional und benötigt LibreOffice auf dem Server.

### Update von 3.1

1. Über Einstellungen eine Datenbanksicherung herunterladen.
2. Die Anwendung beenden.
3. Die Programmdateien aus dieser ZIP aktualisieren, insbesondere auch
   `bid_workbooks.py`, `document_tools.py` und den gesamten Ordner `static`.
   Die vorhandene `wieseke.db`, eigene Startkonfiguration und Backups behalten.
4. Über `start_windows.bat` bzw. das eigene Startskript neu starten. Die neue
   Abhängigkeit `openpyxl` wird über `requirements.txt` installiert.
5. Die vorhandene Datenbank wird automatisch auf Schema 10 ergänzt; vorhandene
   Word-Vorlagen erhalten eine erste Dateiversion. Bestehende Daten bleiben erhalten.
6. Browser neu laden. Bei einem Rückwechsel auf alte Programmdateien auch die
   zugehörige Sicherung zurückspielen, nicht mit einer neueren Datenbank starten.

Die Tests verwenden eigene Datenbanken; die Arbeitsdatenbank wurde bei der
Entwicklung nicht verändert. Ein Umkopieren der produktiven DB ist für das
Update im vorhandenen Ordner nicht erforderlich. Bei einem Ordnerwechsel die
Datenbank nur bei gestoppter Anwendung kopieren (Details in DEPLOYMENT.md).

### Technische Prüfung

`python -m unittest discover -s tests` prüft Backend und Migrationen.
`tests/ui-extensions.mjs` ergänzt die Navigationstests um XLSX- und DOCX-Abläufe
auf einer separaten Testinstanz. Er legt Testdaten an, benötigt Playwright,
Python und die Projektabhängigkeiten. Umgebungsvariablen:
`WVE_TEST_URL`, `PLAYWRIGHT_MODULE`, optional `WVE_TEST_PYTHON`.
Die Testdateien liegen ausschließlich unter `.artifact-work`.
Geprüft wurden 71 automatisierte Backend-Tests und zwei Browser-Testabläufe
einschließlich Mobilansicht. Die erzeugte Excel-Datei wurde strukturell und
visuell geprüft; die native Dropdown-Bedienung in Microsoft Excel wurde nicht
automatisiert getestet. Der PDF-Pfad konnte mangels LibreOffice nicht praktisch
getestet werden und bleibt auf diesem Rechner deaktiviert.

Die neue Fachlogik ist aus dem Hauptprogramm ausgelagert:
`bid_workbooks.py` / `static/bid-workbooks.js` für Excel und
`document_tools.py` / `static/documents.js` für Dokumente.

## Neu in Version 3.1

- Seitenmenü auf eine Icon-Leiste einklappbar; Einstellung bleibt im Browser gespeichert.
- Getrennte Bedienung: Der Menüname öffnet eine Seite, der Pfeil klappt nur die Unterseiten auf. Es ist höchstens ein Bereich aufgeklappt.
- In der Icon-Leiste öffnen Modulicons ein Untermenü, das auch per Escape oder Klick außerhalb geschlossen werden kann.
- Einheitliche hellblaue Auswahl- und Hoverfarbe wie im LV-Studio.
- E-Mail-Vorlagen als eigenständige, nach Kategorien gruppierte Liste mit Drei-Punkte-Menüs und vorhandener Drag-and-drop-Sortierung.
- Eigene Bearbeitungsseite: E-Mail-Inhalt und Hinweis links, Platzhalter und Vorlageninformationen rechts.
- Kontakte auf der Projektseite als Liste; „Kontakte bearbeiten“ steht direkt neben der Überschrift.
- Gleich hoch beginnende Formularspalten und angepasste Darstellung bei mittleren Fensterbreiten.

Version 3.1 benötigte noch keine Datenbankmigration (Schema 9).
Excel-Batchvorlage und Dokumentenerweiterungen folgten mit Version 3.2.

### Prüfung der Oberfläche

`tests/ui-navigation.mjs` prüft Navigation, Berechtigungsanzeige, Vorlagenbearbeitung,
Speichern/Archivieren, Kontaktliste sowie Desktop-, Tablet- und Mobilansichten.
Nur gegen eine separate Testdatenbank starten: Der Test legt Datensätze an und
bearbeitet eine vorhandene Vorlage. Die Serveradresse ist über `WVE_TEST_URL`
einstellbar. Playwright wird regulär als Node-Paket oder über `PLAYWRIGHT_MODULE`
geladen. Die bestehenden Python-Tests verwenden eigene temporäre Datenbanken.

## Neu in Version 3.0

- vollständig überarbeitete, responsive Benutzeroberfläche mit fester linker Navigation
- ausklappbare Funktionsmodule und zusätzliche horizontale Funktionsnavigation
- kontextabhängige Seitentitel und Breadcrumb-Navigation
- modernes, zentral gepflegtes Designsystem für weitere Module
- tabellarische, responsive Projektübersicht nach dem neuen Listenmuster
- Konto, Einstellungen und Abmeldung dauerhaft am unteren Rand der Navigation

### Aufbau der neuen Oberfläche

Die Präsentationsschicht ist bewusst von der Fachlogik getrennt:

- `static/ui-shell.js` erzeugt aus den vorhandenen Modulen die ausklappbare
  Navigation, Seitentitel und Breadcrumbs.
- `static/modern.css` enthält das zentrale Designsystem und alle responsiven
  Regeln. Die bestehende Fachlogik muss für neue Farben oder Abstände nicht
  verändert werden.
- `static/app.js` enthält weiterhin die fachlichen Module und APIs. Neue Module
  melden ihre Seiten wie bisher über `MODULE_REGISTRY` an und werden dadurch
  automatisch in die gemeinsame Navigation eingebunden.

Diese Trennung ist die Grundlage für weitere Module, ohne die gesamte
Benutzeroberfläche erneut umbauen zu müssen.

## Neu in Version 2.3

- erstes schlankes Dokumentenmodul mit Word-Vorlagen (`.docx`)
- Dokumenterstellung mit gespeichertem Projekt oder vollständig manuellen Angaben
- automatische Erkennung gemeinsamer Projektplatzhalter
- zentrale Textbausteine, einfache Bedingungen und Listen über `docxtpl`/Jinja
- Word-Export als führender Weg; optionaler PDF-Export über LibreOffice
- Dokumentvorlagen bleiben mitsamt ihrer Datei in SQLite und damit im Backup
- Platzhalterverwaltung aus dem E-Mail-Modul in den gemeinsamen Projektbereich verschoben
- getrennte Seiten für Bieterverzeichnis und Bieteranlage/Import
- Jahreszuordnung für Bieterfragen mit vorausgewähltem aktuellem Jahr
- schnelle Bieteranlage direkt im Auswahldialog
- Kurzbeschreibungen für positive und negative Standardantwortvarianten
- kompakte Standardantwortübersicht mit vollständiger Detailansicht
- platzsparendere Batch-Erfassung

Eine Beispielvorlage und die Syntaxbeschreibung liegen im Ordner `documents`.

## Neu in Version 2.2

- Bieterverzeichnis unter „Projekte“ mit Formular, CSV- und JSON-Import
- Beispiel-JSON für Bieter direkt aus der Anwendung herunterladen
- Bieter in Einzel- und Batch-Erfassung über einen Suchdialog auswählen
- Filter der Bieterfragen nach Projekt, Kategorie und Bieter
- konfigurierbare Volltextsuche über Frage, Kommentar, Antwort, Thema und Bieter
- Standardantworten als Antwortfälle mit gemeinsamem Kommentar und beliebig vielen
  positiven beziehungsweise negativen Antwortvarianten
- bestehende Standardantworten werden automatisch verlustfrei migriert
- hierarchische, durchsuchbare Themenauswahl
- Kategorien und Themen lassen sich mit Enter speichern

## Neu in Version 2.1

- Gespeicherte Projekt-E-Mails können wieder im E-Mail-Editor geöffnet und angepasst werden.
- Die Einzelerfassung nutzt durchsuchbare Dialoge für Projekte, Fragenkategorien und Themen.
- Neue Fragenkategorien und Themen lassen sich direkt im jeweiligen Auswahldialog anlegen.
- Standardantworten können in eine Bieterfrage übernommen oder durch einen eigenen Antworttext ersetzt werden.
- Eine eigene Batch-Erfassung erlaubt die schnelle zeilenweise Eingabe mehrerer Fragen für ein einmal gewähltes Projekt.
- Der Excel-Import besitzt ebenfalls die durchsuchbare Projektauswahl.
- Entscheidungen werden einheitlich über „zugelassen“ und „abgelehnt“ erfasst.
- Die Bieterfragenübersicht zeigt alle Inhalte vollständig und zeilenweise.
- Der Status unterscheidet zwischen „Antwort erstellt“ und der ausdrücklich quittierten Beantwortung.
- Die Standardantwortbibliothek wurde als aufklappbare Kategorie-/Themenstruktur überarbeitet und bietet Kopiericons für Kurzfrage, Frage und Antwort.
- Alle sechs Projektphasen erstrecken sich über die gesamte verfügbare Breite.

## Neu in Version 2.0

- Projektseiten bilden die sechs Phasen von Akquise bis Auftragsabwicklung als feste Arbeitsbereiche ab.
- Mit einem Projekt erzeugte E-Mails lassen sich als unveränderliche Momentaufnahme im Projekt speichern und später öffnen.
- Das neue Modul **Bieterfragen** verwaltet projektbezogene Fragen und eine getrennte Bibliothek wiederverwendbarer Standardantworten.
- Bieterfragen können einzeln erfasst oder gesammelt aus Excel per Semikolon beziehungsweise Tabulator eingefügt werden.
- Die Gesamtübersicht lässt sich nach Projekt filtern und über alle Textfelder durchsuchen.
- Fragenkategorien und zugehörige Themen lassen sich anlegen und per Drag-and-drop ordnen.
- Standardantworten besitzen Kurzfrage, ausführliche Frage und Antwort; eine Live-Suche filtert während der Eingabe.
- Projektbezogene Bieterfragen erscheinen zusätzlich auf der Projektseite in Phase 3 – Ausschreibung.
- Eigene Rollenrechte trennen das Anzeigen und Bearbeiten von Bieterfragen sowie die Pflege der Standardantworten.
- Systemstatus und integrierte Hilfe wurden um das neue Modul erweitert.

## Neu in Version 1.4

- eigene, übersichtliche Projektseite mit Projektdaten, Kontakten und direkten Aktionen
- Archivansichten zeigen ausschließlich archivierte Projekte beziehungsweise Vorlagen
- eigene Bestätigungsdialoge für Archivierung und endgültiges Löschen ohne Browser-Systemdialog
- Sammelauswahl zum endgültigen Löschen mehrerer archivierter Projekte oder Vorlagen
- Projekt-ID wird beim Bearbeiten am bestehenden Datensatz geändert und vorab auf Doppelvergabe geprüft
- Projektsortierung A–Z und Z–A richtet sich nach der Projekt-ID
- Quicklinks unterstützen externe Webseiten und berechtigte interne Anwendungsseiten
- Quicklinks lassen sich auf der Hauptseite und im Verwaltungsdialog per Drag-and-drop ordnen
- modernisierte Symbole für Einstellungen und Mein Konto

## Neu in Version 1.3

- Funktionsabschluss des E-Mail-Vorlagenmoduls mit eigenem Archivierungsdialog und reiner Archivansicht
- persönliche Quicklink-Kachel auf der Hauptseite
- konfigurierbare Reihenfolge der Hauptnavigation
- zentrale Modulregistrierung als Grundlage für zusätzliche Fachmodule
- A–Z- und Z–A-Sortierung der Projektübersicht
- Systemstatus als erste Seite des Systembereichs

## Neu in Version 1.2

- zweistufige Navigation mit übersichtlichen Fachbereichen und kontextabhängiger Unternavigation
- gemeinsame Bereiche für Projekte sowie Benutzerverwaltung
- gemeinsames Rollenrecht `system_view` für Änderungsprotokoll, Nutzungsauswertung und Systemstatus
- automatische Übernahme bisheriger System-Leserechte bei bestehenden Rollen

## Neu in Version 1.1

- Einzelvorlagen als portables JSON oder editierbaren EML-Entwurf exportieren
- alle zugänglichen Vorlagen als JSON oder EML-ZIP exportieren
- getrennte Rollenrechte für Einzel- und Gesamtexporte
- Nutzungsstatistik mit Vorlage, Benutzer, Projekt-ID, Zeitpunkt und Ausgabeart – ohne Mailinhalte
- integrierte Hilfeseite
- unverbindliche Vorlagenprüfung mit Hinweisen zu fehlenden Inhalten und Platzhaltern
- Systemstatus mit Datenbankgröße, letztem Backup, Benutzer-, Vorlagen- und Projektanzahl
- vorhandene Projekt-Importvorschau, Archivierung und Löschschutz vollständig beibehalten

Der Freigabestatus für Vorlagen ist bewusst nicht Bestandteil dieser Version.

## Neu in Version 1.0

- automatische tägliche SQLite-Sicherung mit 30 Tagen Aufbewahrung
- manueller Sicherungsdownload und geprüfte Wiederherstellung mit Sicherheitssicherung
- unveränderliche Versionshistorie für E-Mail-Vorlagen mit Wiederherstellung
- Änderungsvorschau vor JSON- und Excel-Projektimporten
- administratives Änderungsprotokoll ohne Passwörter oder E-Mail-Inhalte
- Archiv für Projekte und Vorlagen mit Wiederherstellung und geschütztem endgültigem Löschen
- CSRF-Schutz, strikte Sitzungscookies und zusätzliche Browser-Sicherheitsheader
- versionierte, automatische Datenbankmigrationen
- getrenntes Datenverzeichnis über `WVE_DATA_DIR`

Die ausführlichen Empfehlungen für internen Betrieb, Cloudflare Tunnel und netcup-Webhosting stehen
in `DEPLOYMENT.md`.

## Neu in Version 0.19

- Die Vorlagenansicht übernimmt die gespeicherte Reihenfolge der Mailkategorien sofort nach dem Verschieben.
- Der manuelle E-Mail-Modus steht vor dem Modus mit gespeichertem Projekt.
- Beim Start ist kein Projekt vorausgewählt; die Auswahl zeigt „Projekt auswählen...“.
- Überschriften im Vorlageneditor beginnen bündig am oberen Kartenrand.
- Softwareinformationen in den Einstellungen sind optisch auf einer Höhe ausgerichtet.

## Neu in Version 0.18

- E-Mail-Erstellung startet ohne Projekt und ohne vorausgewählte Vorlage.
- Die gewählte Vorlage wird im Auswahlfeld und im Ergebnisbereich deutlich angezeigt.
- Kacheln, Mailkategorien und Vorlagen lassen sich per Drag-and-drop ordnen; alte Pfeilsteuerungen wurden entfernt.
- Dashboard-Vorlagen besitzen einen direkten Bearbeitungszugang für berechtigte Benutzer.
- Vorlagenansicht zeigt Vorlagen-ID und kopierbaren Direktlink.
- Platzhalter werden im Vorlageneditor nur noch aus dem zentralen Platzhalterkatalog verwendet.
- Projekte starten standardmäßig mit dem Formular statt mit dem JSON-Import.
- Neue Benutzer können zum Passwortwechsel bei der ersten Anmeldung verpflichtet werden.
- Die Einstellungen zeigen Versionsnummer, Vorlagenanzahl und Versionsjahr.

Lokaler, datengetriebener E-Mail-Vorlagengenerator mit:

- Benutzeranmeldung mit frei verwaltbaren Rollen und Berechtigungen
- ausschließlich kategoriebasierter Zugriff auf E-Mail-Vorlagen
- eigene, sortierbare Mailkategorien mit rollenbezogener Freigabe
- persönliche, frei sortierbare Dashboard-Kacheln je Mailkategorie
- höchstens drei Dashboard-Kacheln je Zeile
- suchbare Projektauswahl und Projektübersicht mit Wortteilsuche
- eigener, nach Anmeldung fortgesetzter Direktlink für jede Vorlage
- Argon2id-Hashing für Passwörter und Wiederherstellungscodes
- Projektanlage per JSON-Datei oder dynamischem Formular
- zentral verwaltbaren Projekt-, Kontakt-, Benutzer- und manuellen Platzhaltern
- stets sichtbaren und änderbaren Vorlagenfeldern im manuellen und Projektmodus
- bearbeitbarem E-Mail-Ergebnis
- Outlook-Übergabe per `mailto:` und Erzeugung einer `.eml`-Datei
- konfigurierbarem Anwendungsnamen und Logo
- responsive Darstellung für Desktop, Tablet und Smartphone
- optionalen, dreistufig konfigurierbaren Hinweisen je E-Mail-Vorlage
- separater Kontaktverwaltung mit mehreren Kontakten pro Projekt
- abgestufter Login-Sperre und Entsperrung durch Administratoren
- begrenztem Rich-Text-Editor für Vorlagen und erzeugte E-Mails
- bearbeitbarer Multipart-EML-Ausgabe mit `X-Unsent: 1`

## Start unter Windows

1. Python 3.11 oder neuer installieren.
2. ZIP-Datei in einen neuen Ordner entpacken.
3. `start_windows.bat` doppelklicken.
4. Das schwarze Fenster während der Nutzung geöffnet lassen.

Beim ersten Start wird eine lokale Python-Umgebung eingerichtet und der Browser
automatisch unter `http://127.0.0.1:8877` geöffnet. Die feste Adresse ermöglicht
den direkten Aufruf aus dem mitgelieferten Excel-Makro.

Standardzugang bei einer neuen Datenbank:

```text
Benutzername: admin
Passwort: Admin12345!
Wiederherstellungscode: WIES-2026-TEST
```

Ein initialer Passwortwechsel ist nicht erforderlich. Wird das Passwort später
in der Anwendung geändert, bleibt die Änderung auch nach einem Neustart erhalten.

## Projekte

Projekte können auf zwei Wegen angelegt oder aktualisiert werden:

1. JSON-Datei auswählen beziehungsweise JSON-Text einfügen.
2. Auf der Projektseite das dynamische Formular ausfüllen.

Das manuelle Projektformular enthält ausschließlich Projekt- und
Auftraggeberdaten. Mehrere Kontakte werden anschließend in der Projektübersicht
über „Kontakte bearbeiten“ gepflegt. Ein JSON-Import darf weiterhin beliebig
viele Einträge im Array `kontakte` enthalten.

Bei gleicher `projekt.id` wird der gespeicherte Projektstand aktualisiert.
Die Schaltfläche „Leere Projekt-JSON herunterladen“ erzeugt eine Datei aus allen
aktiven Projekt-, Auftraggeber- und Kontaktplatzhaltern.

Die Projektübersicht und die Projektanlage sind zwei getrennte Seiten in der
Navigation. In der Übersicht können berechtigte Nutzer sämtliche gespeicherten
Projektvariablen anzeigen und ändern. Über Rollen kann unabhängig festgelegt
werden, wer die Übersicht sehen und wer Projekte verwalten darf.

## Rollen und Berechtigungen

Administratoren können auf der Seite „Rollen“ beliebig viele eigene Rollen
anlegen. Pro Rolle werden ausgewählt:

- die erlaubten Funktionen,
- Zugriff auf alle aktiven oder ausgewählte Mailkategorien.

Die Freigabe einzelner Vorlagen entfällt. Eine freigegebene Kategorie gibt
automatisch alle aktiven Vorlagen dieser Kategorie für die Rolle frei.

Die Systemrolle „Administrator“ behält stets alle Berechtigungen, damit der
Zugang zur Verwaltung nicht versehentlich verloren geht. Eigene Rollen können
gelöscht werden, sofern sie keinem Benutzer mehr zugewiesen sind.

## Platzhalter

Administratoren verwalten Platzhalter auf der Seite „Platzhalter“. Dort können
Beschriftung, Feldtyp, Datenquelle, Pflichtfeldstatus und Aktivierung geändert
werden. Neue Platzhalter können hinzugefügt und ungenutzte Platzhalter gelöscht
werden. Die technischen Pflichtfelder `projekt.id` und
`projekt.bezeichnung` können nicht gelöscht werden.

Beim Erstellen einer E-Mail erzeugt die Anwendung für alle in der ausgewählten
Vorlage verwendeten Platzhalter passende Formularfelder. Im Projektmodus werden
sie mit den gespeicherten Werten vorausgefüllt und bleiben vollständig änderbar.
Zusätzliche manuelle Variablen einer Vorlage werden automatisch als
„Benutzerdefinierte Platzhalter“ in den zentralen Katalog aufgenommen und stehen
danach auch in weiteren Vorlagen zur Verfügung.

## Vorlagenhinweise

Jede Vorlage kann optional einen gelb hervorgehobenen Hinweis enthalten. Der
Administrator wählt eines von drei Verhalten aus:

- den Hinweis nur anzeigen,
- vor Outlook-, EML- oder Kopierausgabe einen Warndialog bestätigen lassen,
- alle drei Ausgabeschaltflächen sperren, bis „Hinweistext gesehen“ angeklickt wurde.

## Formatierte E-Mail-Texte und EML

Der integrierte Editor unterstützt bewusst nur Absätze, Fett, Kursiv,
Aufzählungen, Nummerierungen, Links und PNG/JPG-Bilder sowie Rückgängig/Wiederholen. Beim
Einfügen werden Schriftarten, Textgrößen, Farben, externe Bildverweise, Skripte und sonstiges HTML
entfernt. Dadurch bleiben die Vorlagen übersichtlich und unabhängig von einem
externen Editorpaket.

Vorlagen speichern eine bereinigte HTML-Version und eine automatisch erzeugte
Klartextversion. Bestehende Klartextvorlagen werden bei der ersten Verwendung
der neuen Version automatisch in das neue Format übernommen.

Die EML-Ausgabe enthält:

- `X-Unsent: 1`, damit Outlook die Datei als ungesendeten Entwurf behandeln kann,
- einen formatierten HTML-Teil,
- eine Klartextalternative,
- eingebettete Bilder als `multipart/related` mit CID-Verweisen,
- keine fest vorgegebene Schriftart.

Die Schaltfläche „Nur E-Mailtext kopieren“ schreibt ebenfalls HTML und Klartext
in die Zwischenablage, aber weiterhin keine Empfänger oder Betreffzeile.
Enthält die Mail Bilder, wird nach Bestätigung ausschließlich Klartext mit
Bildbeschreibungen kopiert. Die Bilder selbst bleiben dem EML-Export vorbehalten.

## Mailkategorien und Hauptseite

Administratoren verwalten und sortieren Kategorien auf der eigenen Seite
„Mailkategorien“.
Jede E-Mail-Vorlage wird genau einer Kategorie zugeordnet. Nutzer können auf
der Hauptseite persönliche Kacheln für die freigegebenen Kategorien hinzufügen,
entfernen und mit Pfeiltasten umordnen. Ein Klick auf eine Vorlage in der Kachel
öffnet den E-Mail-Generator und wählt diese Vorlage bereits aus.

Auf größeren Bildschirmen werden höchstens drei Kacheln nebeneinander angezeigt.
Das Logo führt jederzeit zur Hauptseite zurück.

## Projektsuche und Vorlagenlinks

Im E-Mail-Generator wird der Modus über zwei Schaltflächen gewählt. Die
Projektauswahl öffnet einen Dialog mit allen Projekten und einer Live-Suche.
Die Projektübersicht besitzt dieselbe Wortteilsuche. Gesucht wird gleichzeitig
in Projektnummer und Projektbezeichnung, unabhängig davon, an welcher Stelle
der Suchbegriff vorkommt.

Jede Vorlage ist unter `/vorlage/<ID>` direkt erreichbar. Ist noch keine Sitzung
vorhanden, erscheint zuerst die Anmeldung; anschließend wird genau diese Vorlage
im E-Mail-Generator geöffnet. Die Vorlagenverwaltung zeigt und verlinkt die
Vorlagen gruppiert nach der festgelegten Kategorienreihenfolge.

## Benutzer

Administratoren können:

- Benutzer anlegen, aktivieren und deaktivieren,
- ein neues Passwort festlegen,
- separat einen neuen Wiederherstellungscode erzeugen.
- eine frei definierte Rolle zuweisen oder später wechseln.
- Fehlversuche und aktive Login-Sperren sehen sowie die Sperre aufheben.

Passwörter und Wiederherstellungscodes werden ausschließlich als Hash gespeichert.
Ab dem dritten falschen Passwort wird der nächste Versuch zunächst für 1, 3, 5,
10, 15 und 30 Sekunden verzögert. Nach einem weiteren Fehlversuch gilt eine
30-minütige Sperre.

## Datensicherung und Updates

Alle gespeicherten Benutzer, Projekte, Vorlagen, Platzhalter und Einstellungen
liegen in:

```text
wieseke.db
```

Unter „Einstellungen“ kann ein Administrator eine konsistente Sicherung
herunterladen und wiederherstellen. Zusätzlich wird beim Programmstart pro Tag
eine Sicherung im Unterordner `backups` erstellt. Automatische Sicherungen werden
30 Tage aufbewahrt; vor jeder Wiederherstellung entsteht eine zusätzliche
Sicherheitssicherung.

Vor einem Update:

1. Sicherung in den Einstellungen herunterladen.
2. Anwendung beenden.
3. Programmdateien aktualisieren, aber das Datenverzeichnis nicht überschreiben.
4. Anwendung starten; notwendige Schemaänderungen laufen automatisch.
5. Anmeldung, Vorlagen und Projektübersicht stichprobenartig prüfen.

`reset_testdaten_windows.bat` löscht die gesamte Testdatenbank. Dabei gehen alle
gespeicherten Änderungen verloren.

## Wichtiger Hinweis

Für Mehrbenutzerbetrieb muss die Anwendung hinter einem HTTPS-Reverse-Proxy
laufen. Setzen Sie in diesem Fall `WVE_SECURE_COOKIES=1`, binden Sie den
Python-Prozess nur an localhost und schützen Sie Datenverzeichnis und Backups
mit Betriebssystemrechten. Die In-Memory-Sitzungen machen einen einzelnen
Anwendungsprozess erforderlich. Für einen Dienstbetrieb verhindert
`WVE_OPEN_BROWSER=0` das automatische Öffnen eines Browsers. Weitere Einzelheiten
enthält `DEPLOYMENT.md`.
## Neu in Version 0.17

- Vorlagenaktionen schließen sich bei einem Klick außerhalb des Drei-Punkte-Menüs
- Fett- und Kursivformatierung kann bei erhaltener Auswahl wieder ein- und ausgeschaltet werden
- Vorlagensuche auf der Hauptseite mit direkter E-Mail-Erstellung und Vorlagenbearbeitung
- Drag-and-drop-Sortierung innerhalb einer Mailkategorie
- rechtsbündige Hauptaktionen in der Vorlagen- und Platzhalterübersicht
- benutzerdefinierte Platzhalter beginnen im Vorlageneditor in einem eigenen Abschnitt

## Neu in Version 0.16

- Testmodus im Vorlageneditor für die noch nicht gespeicherte Fassung
- Testwerte und Vorschau für Betreff, formatierten Text und Hinweisfeld
- Vorlagenreihenfolge je Mailkategorie mit durchgängiger Anzeige im Generator und Dashboard
- Favoritenkachel kann dem persönlichen Dashboard hinzugefügt oder daraus entfernt werden
- Vorlagenaktionen in einem übersichtlichen Drei-Punkte-Menü
- Strg+B und Strg+I für Fett und Kursiv im Editor
- Navigations-Hover beschränkt sich auf eine Farbänderung

## Neu in Version 0.15

- Vorlagen können als inaktive Kopie dupliziert werden
- Live-Prüfung auf unbekannte, inaktive und ungenutzte Platzhalter
- persönliche Vorlagenfavoriten im Suchdialog und auf der Hauptseite
- formatierter Hinweisbereich mit Fett, Kursiv, Listen und Links
- frei benennbare Bestätigungsschaltfläche für Hinweisfelder
- EML-Export als hervorgehobene Standardmethode mit Erläuterung

## Neu in Version 0.14

- Hover-Effekt in der Hauptnavigation
- umschaltbare Fett- und Kursivformatierung ohne Größenänderung
- Listen können gezielt entfernt werden
- Links können eingefügt, bearbeitet und entfernt werden
- anwendungseigener Bestätigungsdialog für neue Wiederherstellungscodes
- Warnhinweis bei nicht ausgefüllten Vorlagenplatzhaltern
- ausdrückliche Auswahl „Keinen Kontakt auswählen“
- Hinweisfelder lassen sich je Vorlage aktivieren oder deaktivieren
- sichtbar gesperrte Ausgabeaktionen mit erklärendem Dialog

## Neu in Version 0.13

- Direkter Excel-Übergabeweg über Zwischenablage und `/excel-import`
- fester lokaler Port `8877` für stabile Excel-Verknüpfungen
- einmalige, einzeln und gesammelt kopierbare Zugangsdaten nach Benutzeranlage
- optionale Ausnahme von der Passwortrichtlinie pro Benutzerkonto
- schneller Kontaktimport mit Semikolon- oder Tabulator-Trennung
- sofortige Vorlagenvorschau im E-Mail-Editor
- überarbeitete Platzhalterverwaltung und Position des Hinweisfeldes

Die Excel-Anleitung und das importierbare VBA-Modul liegen im Ordner `excel`.
