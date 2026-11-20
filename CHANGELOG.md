# Änderungen

## 4.0.1 – Korrekturen für Projektzuordnung und Entwürfe

- Ein E-Mail-Ergebnis bleibt seinem Erzeugungskontext zugeordnet. Nach einem
  Projektwechsel muss es für die Projektspeicherung erneut erzeugt werden.
- Verzögerte Speicherantworten löschen keine fremden oder neueren Entwürfe
  und öffnen nicht ungefragt wieder den gesendeten Datensatz.
- Archivierung und Wiederherstellung erhöhen die Projektrevision. Ein Import
  kann ein archiviertes Projekt nicht mehr versehentlich reaktivieren.
- Die Neuanlage von Bietern und Bieterfragen übernimmt beim Zurücknavigieren
  keine Bearbeitungs-ID mehr. Schema 13 und externe Projektanlage unverändert.

## 4.0 – Getrennte Arbeitsbereiche und modularer Aufbau

- Wieseke-Designwerte und Icon-Sprite; responsive Navigation, einheitliche Dialoge,
  Fokusrückgabe und Escape-Verhalten auch in Suchfeldern.
- Zentrale Navigation mit Rechten, eigenen URLs, Browser-Zurück und Direktlinks.
- Getrennte Listen, Details und Bearbeitung; E-Mail-Ergebnis breiter als der Kontext.
- Durchsuchbare Bibliotheken/Platzhalter; Systemwerkzeuge und Sammel-Exporte neu verortet.
- Projektansichten mit sechs Phasen und objektbezogenen Reitern.
- Speicherbasierte Entwürfe nach Seite/Datensatz, ausdrückliches Verwerfen und Schutz
  vor unbeabsichtigtem Ersetzen eines E-Mail-Ergebnisses.
- Gemeinsame Strukturprüfung, Projekt-/Kontaktkonflikte mit erhaltenen Eingaben.
- Native JavaScript-Fachmodule, getrennte Backend-Routen, HTTP-Adapter unverändert.
- Schema 13 mit übernommener Navigationsreihenfolge; getrennte Reihenfolge pro Bereich.
- Zusätzliche Absicherung delegierter Rollenvergabe gegen Kategorie- und Rechteausweitung.
- Quelltextgebundene UI-Prüfungen durch Browser-Verhaltensprüfungen ersetzt.

## 3.5 – Stabilisierung

- Neun bestätigte Review-Befunde behoben: Versionswiederherstellung, Zielkontoschutz,
  konkurrierende Projektspeicherung, Sitzungswiderruf, serverseitige Passwortwechselpflicht,
  unveränderte Bestandsadministratoren, Projektwechsel-Rennen, Importstrukturprüfung,
  Entwurfserhalt beim Navigieren.
- Schema 12 und protokollierte Migration mit vorgeschalteter Sicherung.
- Getrennte progressive Sperren für Kontowiederherstellung; administrativ aufhebbar.
- Lokale Ersteinrichtung und expliziter Demo-Modus.
- Periodische Sicherungsprüfung, Modulfehler getrennt von Authentifizierungsfehlern.
