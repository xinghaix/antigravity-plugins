@echo off
setlocal
if "%~1"=="" (
  node "%~dp0scripts\cli.mjs" uninstall --all
) else (
  node "%~dp0scripts\cli.mjs" uninstall %*
)
