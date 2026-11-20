# Installation und Upgrade

## Sicher aktualisieren

1. Anwendung stoppen; Datenbank und Programmstand zusammen sichern.
2. Neue ZIP in einen neuen Ordner entpacken. Keine Datenbank aus einem Release übernehmen.
3. Vorhandene `wieseke.db` in den neuen Ordner kopieren oder `WVE_DATA_DIR` auf das bestehende Datenverzeichnis setzen.
4. `start_windows.bat` starten (Python 3.12 empfohlen). Abhängigkeiten werden installiert.
5. Vor einem Schemawechsel erstellt die Anwendung eine konsistente Sicherung unter
   `backups/before-schema-…db`. Unbekannte neuere Schemata und ungültige Projektstrukturen
   stoppen den Start vor Änderungen; die Meldung nennt betroffene interne Projekt-IDs.
6. Mit vorhandenen Zugangsdaten anmelden; Projekte, Kontakte und Vorlagen prüfen.

Version 3.5 verwendet Schema 12, Version 4.0 und 4.0.1 verwenden Schema 13. Der Wechsel
von 4.0 auf 4.0.1 benötigt keine Migration. Ein direktes Upgrade von einem Stand vor
3.5 auf 4.0.1 führt beide Migrationen aus. Beim ersten Versuch eine **Kopie** der Datenbank in einen
separaten Testordner legen; nicht die laufende Arbeitsdatei austauschen. Eine konsistente
Live-Kopie über „System → Sicherungen“ erzeugen oder den Server vor dem Kopieren stoppen.

Ein Downgrade benötigt **immer den passenden alten
Programmstand und dessen Datenbanksicherung**. Eine migrierte Datenbank darf nicht mit
einer älteren Version geöffnet werden. Niemals das Testdaten-Resetskript zum Update nutzen.

## Neue Installation

Eine leere Datenbank wird lokal eingerichtet: Benutzername und Passwort an der Konsole
eingeben; Wiederherstellungscode einmalig sicher ablegen. Für einen unbeaufsichtigten
Server zuerst diese Einrichtung interaktiv ausführen. Keine festen Zugangsdaten im Normalbetrieb.
Für ausschließlich lokale, wegwerfbare Tests kann `WVE_DEMO_MODE=1` gesetzt werden
(admin / Admin12345!). Vor Veröffentlichung deaktivieren und echte Konten verwenden.

## Betrieb und Grenzen

Ein Serverprozess, SQLite, HTTPS über vorgeschalteten sicheren Proxy/Cloudflare Access.
Die App-Anmeldung bleibt zusätzlich erforderlich. `WVE_SECURE_COOKIES=1` bei HTTPS setzen;
Origin-Port nicht öffentlich freigeben. Backups enthalten vertrauliche Daten, separat
geschützt aufbewahren und regelmäßig Wiederherstellung prüfen. Tägliche Backups werden
beim Start und stündlich geprüft, nach 30 Tagen entfernt; Upgrade-/manuelle Backups bleiben.

Entwürfe werden ausschließlich im Arbeitsspeicher des Tabs gehalten. Navigation innerhalb
der App erhält sie; Neuladen/Schließen kann sie verlieren (Browserwarnung). Passwortfelder,
einmalige Zugangsdaten und API-Schlüssel werden davon ausgeschlossen.

Die Tests prüfen MIME/EML, CID-Bilder, DOCX und XLSX technisch. Native Outlook-/Word-
Darstellung und PDF-Konvertierung benötigen zusätzlich einen Arbeitsplatztest mit der
verwendeten Office-/LibreOffice-Version. Die Anwendung versendet keine E-Mails selbst.

## Orientierung nach dem Upgrade auf 4.0

- **Arbeiten:** Start, Projekte, E-Mail erstellen, Dokument erstellen, Bieterfragen.
- **Bibliotheken:** E-Mail-Vorlagen/Kategorien, Dokumentvorlagen/Textbausteine,
  Standardantworten/Kategorien/Themen, Bieter und gemeinsame Platzhalter.
- **Administration:** Benutzer/Rollen und System (Status, Sicherungen, Protokoll, Nutzung).
- Einstellungen, Hilfe und Mein Konto bleiben unten. Nur freigegebene Seiten werden gezeigt.
- „Neu anlegen“ steht in der jeweiligen Liste. Eine Gruppe mit Unterseiten klappt nur auf;
  erst eine Unterseite öffnet den Arbeitsbereich. Projektansichten haben eigene Reiter.

## Geänderte Browser-Schnittstelle (nicht die externe Projektanlage)

Projektantworten enthalten `revision`. Beim Ändern eines bestehenden Projekts ist
`expected_revision` erforderlich. Fehlende/veraltete Revisionen ergeben HTTP 409;
die Oberfläche behält Eingaben und bietet ein bestätigtes Neuladen an.
`PUT /api/projects/{interne_id}/contacts` ändert nur `kontakte` und benötigt ebenfalls
`expected_revision`. Die bestehende externe **create-only**-API
`POST /api/integration/projects` benötigt keine Revision und bleibt unverändert.

Seit 4.0.1 benötigen auch Archivieren und Wiederherstellen eine geladene
Projektrevision im JSON-Feld `expected_revision`. Beide Statuswechsel erhöhen
die Revision. Archivierte Projekte müssen vor einem neuen Import ausdrücklich
wiederhergestellt werden.

## Nachweis vor der Freigabe

Die vorhandene Datenbank wurde nur lesend für eine isolierte SQLite-Sicherung geöffnet.
An der Kopie wurden Schema 12, Schema 13, wiederholter Start, Integritätsprüfung und
Wiederherstellung des passenden Sicherungsstands geprüft. Sie enthält bislang nur
wenige Datensätze; deshalb decken zusätzliche synthetische Tests Projekte, Kontakte,
Rechte, Vorlagenversionen und Exporte ab. Vor produktiver Verwendung außerdem eigene
umfangreichere Beispieldaten und die konkrete Outlook-/Word-Installation testen.
