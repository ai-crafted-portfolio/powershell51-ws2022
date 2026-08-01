@echo off
setlocal
set "ROOT=%~1"
if "%ROOT%"=="" set "ROOT=C:\KnowledgeMgr"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_powershell51_knowledge.ps1" -KnowledgeRoot "%ROOT%" -check
exit /b %errorlevel%
