#Requires -Version 5.1
<#
.SYNOPSIS
    Claude Code Kanban Board - One-click installer for Windows
.DESCRIPTION
    Checks prerequisites (Node.js, Claude Code), installs missing ones,
    clones the repo, installs dependencies, builds, and creates a desktop shortcut.
#>

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\ClaudeKanban",
    [string]$RepoUrl = "https://github.com/fl0ws/kanbancode.git"
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) {
    Write-Host ""
    Write-Host "  >> $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
    Write-Host "     $msg" -ForegroundColor Green
}

function Write-Warn($msg) {
    Write-Host "     $msg" -ForegroundColor Yellow
}

function Write-Err($msg) {
    Write-Host "     $msg" -ForegroundColor Red
}

# ── Header ──────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "  ║   Claude Code Kanban - Installer     ║" -ForegroundColor Magenta
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Install directory: $InstallDir"
Write-Host "  Repository:        $RepoUrl"
Write-Host ""

# ── 1. Check / Install Node.js ──────────────────────────
Write-Step "Checking Node.js..."

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $nodeVersion = & node --version 2>$null
    Write-Ok "Node.js $nodeVersion found"
} else {
    Write-Warn "Node.js not found. Installing via winget..."
    try {
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
        # Refresh PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        $nodeVersion = & node --version 2>$null
        if ($nodeVersion) {
            Write-Ok "Node.js $nodeVersion installed"
        } else {
            Write-Err "Node.js installed but not in PATH. Please restart this script after reopening your terminal."
            exit 1
        }
    } catch {
        Write-Err "Failed to install Node.js. Please install it manually from https://nodejs.org"
        exit 1
    }
}

# ── 2. Check / Install Git ──────────────────────────────
Write-Step "Checking Git..."

$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
    $gitVersion = & git --version 2>$null
    Write-Ok "$gitVersion found"
} else {
    Write-Warn "Git not found. Installing via winget..."
    try {
        winget install Git.Git --accept-package-agreements --accept-source-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        $gitVersion = & git --version 2>$null
        if ($gitVersion) {
            Write-Ok "$gitVersion installed"
        } else {
            Write-Err "Git installed but not in PATH. Please restart this script after reopening your terminal."
            exit 1
        }
    } catch {
        Write-Err "Failed to install Git. Please install it manually from https://git-scm.com"
        exit 1
    }
}

# ── 3. Check / Install Claude Code ──────────────────────
Write-Step "Checking Claude Code..."

$claude = Get-Command claude -ErrorAction SilentlyContinue
if ($claude) {
    Write-Ok "Claude Code found"
} else {
    Write-Warn "Claude Code not found. Installing via npm..."
    try {
        & npm install -g @anthropic-ai/claude-code 2>&1 | Out-Null
        $claude = Get-Command claude -ErrorAction SilentlyContinue
        if ($claude) {
            Write-Ok "Claude Code installed"
        } else {
            Write-Warn "Claude Code installed but not in PATH. You may need to restart your terminal."
        }
    } catch {
        Write-Warn "Could not install Claude Code automatically. Install it later with: npm install -g @anthropic-ai/claude-code"
    }
}

# ── 4. Clone or update repository ────────────────────────
Write-Step "Setting up project..."

if (Test-Path "$InstallDir\.git") {
    Write-Ok "Existing installation found. Pulling latest..."
    Push-Location $InstallDir
    & git pull --ff-only 2>&1
    Pop-Location
} else {
    if (Test-Path $InstallDir) {
        Write-Warn "Directory exists but is not a git repo. Removing and re-cloning..."
        Remove-Item -Recurse -Force $InstallDir
    }
    Write-Ok "Cloning repository..."
    & git clone $RepoUrl $InstallDir 2>&1
}

if (-not (Test-Path "$InstallDir\package.json")) {
    Write-Err "Clone failed - package.json not found in $InstallDir"
    exit 1
}

Write-Ok "Project ready at $InstallDir"

# ── 5. Install dependencies ─────────────────────────────
Write-Step "Installing dependencies..."

Push-Location $InstallDir
& npm install 2>&1 | Select-Object -Last 3
Write-Ok "Dependencies installed"

# ── 6. Build production client ───────────────────────────
Write-Step "Building client..."

& npx vite build 2>&1 | Select-Object -Last 3
Write-Ok "Client built"
Pop-Location

# ── 7. Create start script ──────────────────────────────
Write-Step "Creating start script..."

$startScript = @"
@echo off
title Claude Code Kanban
cd /d "$InstallDir"
echo Starting Claude Code Kanban...
echo.
echo   Open http://localhost:3001 in your browser
echo   Press Ctrl+C to stop
echo.
start "" "http://localhost:3001"
node server/index.js
"@

$startScriptPath = "$InstallDir\start-kanban.bat"
Set-Content -Path $startScriptPath -Value $startScript -Encoding ASCII
Write-Ok "Start script created"

# ── 8. Create desktop shortcut ───────────────────────────
Write-Step "Creating desktop shortcut..."

$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktopPath\Claude Kanban.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $startScriptPath
$shortcut.WorkingDirectory = $InstallDir
$shortcut.Description = "Claude Code Kanban Board"
$shortcut.IconLocation = "cmd.exe,0"
$shortcut.Save()

Write-Ok "Desktop shortcut created: Claude Kanban"

# ── Done ─────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║   Installation complete!              ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  To start:  Double-click 'Claude Kanban' on your desktop"
Write-Host "             or run: $startScriptPath"
Write-Host ""
Write-Host "  To update: Run this script again (it will pull latest changes)"
Write-Host ""

# Ask to start now
$start = Read-Host "  Start the kanban board now? (Y/n)"
if ($start -ne "n" -and $start -ne "N") {
    Start-Process -FilePath $startScriptPath
}
