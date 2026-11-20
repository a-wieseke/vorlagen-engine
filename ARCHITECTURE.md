# Architektur und Weiterentwicklung ab 4.0

## Grenzen und Verantwortlichkeiten

Die Anwendung bleibt ein Python-Prozess mit `ThreadingHTTPServer` und SQLite.
`app.py` ist der HTTP-/Sitzungsadapter und enthält außerdem die bestehende Initialisierung,
Serialisierung und gemeinsamen Domänenhilfen. Ein Frameworkwechsel wurde nicht vorgenommen.

| Pfad | Aufgabe |
|---|---|
| `core/security.py` | Systemadministratoren, Zielkontoschutz, delegierte Rechte-/Kategorienvergabe |
| `core/projects.py` | Gemeinsame Projektstrukturprüfung und Revisionsvergleich |
| `core/migrations.py` | Vorprüfung, Schema 12/13 und Migrationsprotokoll |
| `modules/*_routes.py` | Fachrouten für Administration, Projekte, Mail, Bieterfragen, Dokumente |
| `document_tools.py`, `email_images.py`, `bid_workbooks.py` | DOCX/PDF, MIME/Bilder und Excel |
| `static/app.js` | Einmalige Zusammensetzung der Frontendmodule, Elementbindungen und Start |
| `static/navigation.js`, `shell.js` | Einzige Seitendefinition, Rechteanzeige, Sidebar und History-Router |
| `static/modules/` | Fachlogik mit getrennten Zustandsbereichen in `state.js` |
| `static/drafts.js` | Entwürfe nur im Arbeitsspeicher, kein Storage und kein automatisches Speichern |
| `static/dialogs.js`, `workspace.js` | Gemeinsame Dialogregeln und Zusammensetzung der Arbeitsansichten |
| `static/design/`, `workspace.css` | Designpaket-Tokens, Icons und neue Oberflächenregeln |

Die Routen erhalten gemeinsame Dienste über `Handler.services`; die späte Bindung erlaubt
Testdatenbanken und vermeidet zirkuläre Modulimporte. Fachregeln nicht in HTML oder CSS
verschieben. Weitere Dienste können aus dem Adapter herausgezogen werden, ohne die
externen URLs zu verändern. Es gibt noch keinen Dependency-Injection-Framework-Bedarf.

Das Frontend benötigt keinen Buildschritt und keine CDN-Abhängigkeit. Native ES-Module
werden direkt ausgeliefert. Bestehende Inline-Aktionen nutzen einen dünnen `window`-Adapter;
dieser ist kein zweiter Datenspeicher. Neue Zustände in den fachlichen Namensraum aufnehmen,
nicht als unverbundene globale Variablen. `style.css` enthält weiterhin ältere fachliche
Komponenten; `workspace.css` ersetzt deren Layout schrittweise. Unbenutzte alte Shell-/JS-
Dateien werden nicht mehr ausgeliefert. Demo-JavaScript aus dem Designpaket wird nicht geladen.

## Navigation, Formulare und Entwürfe

Eine Seite in `navigation.js` mit Titel, Bereich, Gruppe und erforderlichen Rechten
anmelden. `listed=false` kennzeichnet eine Bearbeitungs-/Detailseite, die aus einer Liste
geöffnet wird. Neue Datensatzseiten in `recordFor`/`restoreRoute` ergänzen und deren
Direktlink, Zurück-Navigation, Neuladen und fehlende Rechte prüfen. Serverseitige
Berechtigungsprüfungen bleiben zwingend; versteckte Navigation ist kein Zugriffsschutz.

Entwürfe werden nach Seite und unveränderlicher Datensatz-ID abgelegt. Passwortfelder,
Dateieingaben und einmalige Geheimnisse sind ausgeschlossen. Dynamische Formzustände
(z. B. Antwortvarianten) registrieren einen `get`/`set`-Adapter. Nach erfolgreichem Speichern
den betreffenden Entwurf bereinigen. Programmgesteuerte Benutzereingaben müssen ebenfalls
erfasst werden. Die Warnung vor Neuladen ist eine browserseitige Warnung, keine Sicherung;
ein Absturz oder zwangsweises Beenden kann ungespeicherte Inhalte verlieren.

E-Mail-Kontext und Ergebnis sind getrennt: Variablen-/Kontakt-/Projektwechsel ändern das
Ergebnis nicht automatisch. Eine neue Vorlage oder eine gespeicherte Mail darf einen
bearbeiteten Text erst nach Bestätigung ersetzen. Beim Abmelden werden Entwürfe verworfen.

## Datenänderungen

Alle Projektquellen verwenden denselben Validator. Benutzerdefinierte Felder bleiben
erhalten. Updates benötigen `expected_revision`; der Vergleich und die Änderung erfolgen
in derselben SQLite-Schreibtransaktion. Kontakte ändern nur ihre Liste über die interne
Projekt-ID. Ein neuer API-Aufrufer darf die öffentliche Projektkennung nicht als interne
Datensatz-ID behandeln. Die Integrations-API bleibt ausschließlich zum Neuanlegen.

Migrationen werden vor Veränderungen auf unbekannte neuere Schemata und ungültige
Bestandsprojekte geprüft. Vor einem Upgrade entsteht eine konsistente Sicherung. Keine
Rückwärtsmigration: alter Programmstand plus passende alte Sicherung. Backups und
Entwicklungstests niemals über die produktive Datenbank laufen lassen.

## Prüfbefehle

Python-Abhängigkeiten aus `requirements.txt`; für Browserprüfungen Node.js, Playwright
und Chrome installieren. `PLAYWRIGHT_MODULE` kann auf eine vorhandene Playwright-Installation
zeigen. Das ist nur ein Testwerkzeug, keine Laufzeitabhängigkeit der Anwendung.

```text
python -m unittest discover -s tests -v
python tests/serve_test.py
node tests/ui-stabilization.mjs
node tests/ui-contracts.mjs
node tests/ui-integrity.mjs
node tests/ui-redesign.mjs
node tests/ui-extensions.mjs
node tests/ui-email-images.mjs
node tests/ui-project-api.mjs
python tools/check_upgrade.py --source PFAD_ZUR_DATENBANK
python tools/package_release.py
python tools/check_release.py release/Wieseke_Vorlagen-Engine_v4.0.1.zip
```

`serve_test.py` verwendet eine temporäre Datenbank und Port 9987. Vor wiederholten
Stabilisierungsläufen neu starten, da die Tests absichtlich Datensätze anlegen.
Die unittest-Suite startet eigene isolierte Server auf freien Ports. UI-Verträge
prüfen unter anderem Editor-Auswahl, Nur-Text-Kopie, den echten EML-Download, Hinweis-
sperren, Archivfilter, Bibliotheken und Dialoge. Responsive-Prüfungen verwenden
320, 390, 768, 1024 und 1440 Pixel. Office-Programme selbst sind nicht Teil dieser Tests.

`package_release.py` verwendet eine Dateifreigabeliste. Keine Arbeitsdatenbanken,
Backups, API-Schlüssel, Testausgaben oder gespeicherten Browserprofile gehören in ein Release.
