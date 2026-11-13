@echo off
setlocal
node "%~dp0scripts\cli.mjs" uninstall %*
exit /b %errorlevel%
