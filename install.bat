@echo off
setlocal
if "%~1"=="" (
  node "%~dp0scripts\cli.mjs" install --all --link
) else (
  node "%~dp0scripts\cli.mjs" install %*
)
