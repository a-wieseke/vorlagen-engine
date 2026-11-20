@echo off
cd /d "%~dp0"
title Wieseke Vorlagen-Engine v4.0
echo.
echo Richte die lokale Python-Umgebung ein ...
if not exist ".venv\Scripts\python.exe" (
  py -m venv .venv
)
if errorlevel 1 (
  echo.
  echo FEHLER: Python konnte nicht gestartet werden.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo FEHLER: Python oder die Abhaengigkeit konnte nicht gestartet werden.
  pause
  exit /b 1
)
echo.
echo Die Anwendung wird unter http://127.0.0.1:8877 geoeffnet.
echo Bei einer neuen Datenbank folgt die lokale Administrator-Einrichtung.
echo Dieses Fenster waehrend der Nutzung nicht schliessen.
echo.
".venv\Scripts\python.exe" app.py
echo.
echo Die Anwendung wurde beendet.
pause
