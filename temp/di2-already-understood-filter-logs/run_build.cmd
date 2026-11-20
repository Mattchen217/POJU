@echo off
echo STARTED> temp\di2-already-understood-filter-logs\build.started.txt
cd /d D:\POJU\pojulife
C:\Users\13306\AppData\Roaming\npm\pnpm.cmd build > temp\di2-already-understood-filter-logs\build.raw.log 2>&1
echo %ERRORLEVEL%> temp\di2-already-understood-filter-logs\build.exit.txt
