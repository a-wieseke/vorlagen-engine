# Bieterfragen über Excel erfassen

Unter Bieterfragen → Excel-Import oder Batch-Erfassung die aktuelle Excel-Vorlage
herunterladen. Jede Datei enthält den Kategorien- und Themenstand zum Zeitpunkt
des Downloads. Vorhandene Excel-Dateien aktualisieren sich nicht automatisch.

Im Blatt „Bieterfragen“ bis zu 500 Zeilen ausfüllen:

- Fragenkategorie: Dropdown aus aktiven Kategorien.
- Bieter: freier Text; bekannte aktive Bieter werden beim Import zugeordnet.
- Thema: Dropdown mit Themen der ausgewählten Kategorie.
- Bieterfrage, Kommentar Agentur Wieseke, Antwort: Text, auch mehrzeilig.
- Entscheidung: leer, zugelassen oder abgelehnt.

Kategorie, Thema und Fragetext sind Pflichtangaben. Nach einem Kategorienwechsel
das Thema erneut auswählen. Excel leert einen bereits gewählten Themenwert nicht
automatisch; die Anwendung prüft diese Zuordnung beim Import nochmals.

In der Anwendung Projekt und Jahr wählen, Datei hochladen, Vorschau prüfen und
bestätigen. Fehler verhindern den gesamten Import. Identische Fragen im selben
Projekt und Jahr werden übersprungen, auch bei wiederholtem Dateiimport.
Geänderte Texte sind neue Datensätze; dies ist kein Abgleich bestehender Fragen.
Umbenannte Kategorien und Themen werden anhand gespeicherter IDs erkannt.
Gelöschte oder deaktivierte Einträge erfordern eine korrigierte neue Datei.

Die ausgeblendeten Blätter „_Listen“ und „_Zuordnung“ und die Spaltenüberschriften
nicht ändern. Keine Makros erforderlich; Formeln in Eingabezeilen werden
abgewiesen. Maximale Dateigröße: 10 MB. Excel kann Dropdown-Prüfungen beim
Einfügen umgehen – deshalb ist die serverseitige Prüfung maßgeblich.

Alternativ bleibt „Text aus Excel einfügen“ verfügbar. Für mehrzeilige Zelltexte
und sichere Kategorie-/Themenzuordnung wird der XLSX-Import empfohlen.
