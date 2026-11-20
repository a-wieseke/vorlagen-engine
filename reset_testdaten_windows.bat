@echo off
cd /d "%~dp0"
echo ACHTUNG: Alle Testdaten, Projekte, Benutzer und Vorlagenaenderungen werden geloescht.
choice /M "Testdatenbank wirklich zuruecksetzen"
if errorlevel 2 exit /b
if exist wieseke.db del /f /q wieseke.db
echo.
echo Datenbank wurde geloescht.
echo Danach start_windows.bat ausfuehren.
echo Beim naechsten Start wird ein Administrator lokal eingerichtet.
echo Feste Testdaten gibt es ausschliesslich mit WVE_DEMO_MODE=1.
pause
