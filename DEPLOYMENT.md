# Deployment der Wieseke Vorlagen-Engine 3.4

## Projekt-API ab Version 3.4

`POST /api/integration/projects` verwendet einen persönlichen Bearer-Schlüssel;
Browseranmeldung und CSRF-Token sind für diesen einen Endpunkt nicht erforderlich.
Die Schlüsselverwaltung selbst erfordert weiterhin Sitzung und CSRF-Prüfung.
Details stehen auf der Hilfeseite. Extern nur über HTTPS betreiben. Die API braucht
keine zusätzliche Portfreigabe. Reverse-Proxy-Anfragelimit mindestens 256 KB.

Bei vorgeschaltetem Cloudflare Access muss zusätzlich dessen Dienstzugriff
eingerichtet werden (Service Token und passende Access-Regel). Dafür sendet der
Client zusätzlich `CF-Access-Client-Id` und `CF-Access-Client-Secret`. Der App-Key
bleibt im Authorization-Header. Das VBA-Beispiel unterstützt optional die
Umgebungsvariablen `WVE_CF_CLIENT_ID` und `WVE_CF_CLIENT_SECRET`; ein Browserlogin
allein authentifiziert das Excel-Makro nicht gegenüber Access.

## Grundsätze

Die Anwendung verarbeitet Projekt- und Kontaktdaten. Ein Produktivsystem braucht
daher HTTPS, personengebundene Konten, minimale Rollenrechte, regelmäßige externe
Sicherungen, Protokollkontrolle und einen geregelten Updateprozess. Die Datenbank
und der Ordner `backups` dürfen nie im öffentlich erreichbaren Webverzeichnis liegen.

Die Anwendung verwendet SQLite und speichert Sitzungen im Arbeitsspeicher. Deshalb
darf genau ein Anwendungsprozess auf die Datenbank schreiben. Ein Neustart meldet
alle Benutzer ab, löscht aber keine Nutzdaten.

Ab Version 3.2 enthält die Datenbank außerdem DOCX-Dateiversionen und fertige
Projektdokumente. Diese sind in SQLite-Sicherungen eingeschlossen und vergrößern
die Datenbank entsprechend. Speicherplatz, Sicherungsgröße und Wiederherstellung
regelmäßig prüfen. Der Updateablauf auf Schema 10 steht in README.md.

Ab 3.3 liegen auch E-Mail-Bilder einschließlich ihrer Vorlagenversionen in SQLite.
Pillow ist über `requirements.txt` zu installieren und bei Sicherheitsupdates
mitzupflegen. Es gibt keinen öffentlich zugänglichen Uploadordner. Bilder werden
serverseitig validiert und ohne Metadaten neu kodiert. Die bestehenden 20 MB für
Browser-Backupwiederherstellung können bei vielen Bildern überschritten werden;
dann die Sicherung bei gestoppter Anwendung als Datenbankdatei zurückspielen.

## Szenario 1: interne Applikation

### Empfohlener Aufbau

- dedizierter Windows- oder Linux-Rechner beziehungsweise eine kleine VM
- fester interner DNS-Name, zum Beispiel `vorlagen.intern.example`
- Zugriff nur aus Firmennetz oder über Firmen-VPN
- Reverse Proxy mit intern vertrauenswürdigem TLS-Zertifikat
- Python-Anwendung bindet ausschließlich an `127.0.0.1`
- Daten in einem separaten, nur für das Dienstkonto beschreibbaren Verzeichnis

Beispielhafte Umgebungsvariablen:

```text
WVE_HOST=127.0.0.1
WVE_PORT=8877
WVE_DATA_DIR=D:\WiesekeVorlagenEngine\data
WVE_SECURE_COOKIES=1
WVE_OPEN_BROWSER=0
```

Der Reverse Proxy leitet HTTPS auf `http://127.0.0.1:8877` weiter. Port 8877 darf
nicht in der Host-Firewall für andere Rechner freigegeben werden. Der Prozess wird
als eigenes, nicht administratives Dienstkonto gestartet und automatisch neu
gestartet, falls er beendet wird.

### Sicherer Betrieb

- TLS auch intern erzwingen und HTTP auf HTTPS umleiten
- VPN oder Firewall-Quellnetze statt öffentlicher Erreichbarkeit
- Standardpasswort unmittelbar ändern; ungenutzte Konten deaktivieren
- Administratorrechte nur wenigen Personen geben
- tägliche Anwendungssicherung zusätzlich verschlüsselt auf ein anderes System kopieren
- Wiederherstellung mindestens vierteljährlich in einer Testumgebung prüfen
- Betriebssystem, Python und `argon2-cffi` regelmäßig aktualisieren
- Auditprotokoll und Serverlogs regelmäßig kontrollieren
- Datenschutzkonzept, Löschfristen und Auftrags-/Zugriffsregeln dokumentieren

### Bewertung

Dies ist für die aktuelle Architektur die bevorzugte Variante. Sie ist einfach,
die Daten verlassen das Firmennetz nicht, und Excel kann die feste interne URL
verwenden. Wartung und Fehleranalyse bleiben überschaubar.

## Interner Betrieb mit Cloudflare Tunnel und Access

Die Anwendung bleibt auf `127.0.0.1:8877` gebunden. Ein auf demselben Rechner
laufender `cloudflared`-Dienst baut ausschließlich ausgehend einen Tunnel auf und
ordnet beispielsweise `https://vorlagen.firma.de` dem lokalen Dienst
`http://127.0.0.1:8877` zu. Am Router wird kein eingehender Port geöffnet.

Vor dem Anlegen der öffentlichen Route muss in Cloudflare Zero Trust eine
Self-hosted-Access-Anwendung für den vollständigen Hostnamen erstellt werden.
Die Regel sollte standardmäßig verweigern und nur persönliche Firmenkonten oder
definierte Gruppen erlauben. MFA und „Protect with Access“ sind zu aktivieren.

Für den Tunnelbetrieb gelten zusätzlich:

- `WVE_SECURE_COOKIES=1` und `WVE_OPEN_BROWSER=0`
- Anwendung und `cloudflared` als automatisch startende Dienste
- keine direkte Firewallfreigabe für Port 8877
- Cloudflare-Caching für den Anwendungs-Hostnamen umgehen
- Cloudflare-Access-Anmeldung und interne App-Anmeldung als zwei Schutzschichten
- externen Hostnamen im Excel-Makro für `/excel-import` eintragen
- Cloudflare- und Anwendungsprotokolle sowie externe Backups regelmäßig prüfen

Optional kann später eine vollständige Abmeldung ergänzt werden, die neben der
App-Sitzung auch `/cdn-cgi/access/logout` bei Cloudflare aufruft.

## Szenario 2: netcup-Webspace

### Technische Voraussetzung

Bei netcup ist Python laut aktueller Produktdokumentation nur in Webhosting 4000
und 8000 enthalten. Python-Anwendungen laufen dort über Phusion Passenger und
müssen ein WSGI-Interface bereitstellen. Python kann im Webhosting weder per CLI
noch per Cron ausgeführt werden.

Die mitgelieferte lokale Version basiert auf `ThreadingHTTPServer` und ist daher
nicht unmittelbar WSGI-kompatibel. Für den netcup-Webspace ist vor dem Upload ein
separater Deployment-Umbau auf eine WSGI-Anwendung (beispielsweise Flask) nötig.
Die Geschäftslogik und die Oberfläche können dabei erhalten bleiben; Routing,
Sitzungsablage und Startmechanismus müssen angepasst werden. Ein bloßes Hochladen
der ZIP und Starten von `app.py` reicht nicht.

### Zielaufbau nach dem WSGI-Umbau

- Webhosting 4000 oder 8000
- eigene Subdomain ausschließlich für die Anwendung
- App Root außerhalb des Document Root
- Passenger im Produktivmodus mit WSGI-Startdatei
- kostenfreies Let's-Encrypt-Zertifikat und erzwungene HTTPS-Weiterleitung
- `WVE_SECURE_COOKIES=1`
- Datenbank und Sicherungen außerhalb des Document Root
- Dateirechte so eng wie im Webhosting möglich

### Sicherer Betrieb

- netcup-/Plesk-Zugang mit starkem Passwort und Zwei-Faktor-Authentifizierung schützen
- SFTP/SSH statt unverschlüsseltem FTP verwenden
- Entwicklungsmodus und detaillierte Fehlermeldungen öffentlich deaktivieren
- eigene externe Sicherungen erstellen: netcup weist darauf hin, dass freiwillige
  Hosting-Sicherungen nur eine Kulanzleistung und nicht garantiert sind
- Sicherungen verschlüsselt außerhalb des Webspaces ablegen und Restore testen
- Datenschutz/AV-Vertrag prüfen, weil Projekt- und Kontaktdaten extern verarbeitet werden
- öffentliche Angriffsfläche regelmäßig kontrollieren; Audit- und Webserverlogs prüfen
- Updates zuerst in einer getrennten Subdomain testen

### Einschränkungen

- kein Python-Cron: die in Version 3.0 beim Anwendungsstart erzeugte tägliche
  Sicherung läuft nur, wenn Passenger die Anwendung an diesem Tag startet
- Passenger kann Prozesse neu starten; In-Memory-Sitzungen gehen dabei verloren
- SQLite und mehrere Passenger-Prozesse sind keine gute Kombination
- netcup-spezifische Python-Versionen und installierbare Abhängigkeiten müssen vorab
  mit einem kleinen WSGI-Test geprüft werden

Für einen zuverlässig öffentlich erreichbaren Mehrbenutzerbetrieb wäre ein
netcup-VPS/Root-Server technisch passender als Shared Webhosting, erfordert aber
vollständige Serveradministration. Bleibt es beim Webspace, sollte der WSGI-Umbau
zusätzlich eine serverseitige Sitzungsspeicherung und einen klaren Backupjob über
eine vom Webhosting unterstützte Methode enthalten.

## Quellenstand

- netcup Python: https://www.netcup.com/de/helpcenter/dokumentation/webhosting/python
- netcup Webhosting: https://www.netcup.com/en/hosting
- netcup Webhosting-Oberfläche/SSL/Cron: https://www.netcup.com/de/helpcenter/dokumentation/webhosting/interface
- netcup freiwillige Backups: https://helpcenter.netcup.com/en/wiki/web-hosting/backup-restore/
