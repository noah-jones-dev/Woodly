@echo off
rem Runs woodly.ps1 even when PowerShell script execution is restricted.
rem Usage: woodly <command> [options]    e.g.  woodly start
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0woodly.ps1" %*
exit /b %ERRORLEVEL%
