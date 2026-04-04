@echo off
:: Claude Code Kanban - Standalone installer
:: Download this single file and double-click to install everything.
:: It downloads the install.ps1 from GitHub and runs it.
echo.
echo   Claude Code Kanban - Standalone Installer
echo   ==========================================
echo.

set REPO_URL=https://github.com/fl0ws/kanbancode
set PS_URL=%REPO_URL%/raw/main/install.ps1
set TEMP_PS=%TEMP%\kanban-install.ps1

echo   Downloading installer script...
powershell.exe -NoProfile -Command "Invoke-WebRequest -Uri '%PS_URL%' -OutFile '%TEMP_PS%'"

if not exist "%TEMP_PS%" (
    echo.
    echo   Failed to download installer. Check your internet connection.
    echo   URL: %PS_URL%
    pause
    exit /b 1
)

echo   Running installer...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%TEMP_PS%" -RepoUrl "%REPO_URL%.git"

del "%TEMP_PS%" 2>nul
if errorlevel 1 (
    echo.
    echo   Installation encountered errors. See above for details.
    pause
)
