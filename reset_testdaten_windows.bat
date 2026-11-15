@echo off
cd /d "%~dp0"
echo ACHTUNG: Alle Testdaten, Projekte, Benutzer und Vorlagenaenderungen werden geloescht.
choice /M "Testdatenbank wirklich zuruecksetzen"
if errorlevel 2 exit /b
if exist wieseke.db del /f /q wieseke.db
echo.
echo Datenbank wurde geloescht.
echo Danach start_windows.bat ausfuehren.
echo Zugangsdaten:
echo Benutzername: admin
echo Passwort: Admin12345!
echo Wiederherstellungscode: WIES-2026-TEST
pause
