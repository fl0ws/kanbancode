@echo off
:: Claude Code Kanban - One-click installer
:: Double-click this file to install.
echo.
echo   Claude Code Kanban - Installer
echo   ==============================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 (
    echo.
    echo   Installation encountered errors. See above for details.
    echo.
    pause
)
