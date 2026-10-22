# Build the OS_Train desktop app (PyInstaller onedir).
#
# Output: <project root>\dist\OS_Train\OS_Train.exe
# Rules:
#   * All outputs and build-time temp files stay inside the project dir (D drive);
#     nothing is written to the C drive.
#   * Only one version is kept -- the old dist/ is deleted and overwritten,
#     no copy of the previous build is made.
#   * Overwrite failures are usually caused by a still-running exe, so we kill
#     leftover processes first and retry.
#
# Usage (from the project root):
#     powershell -ExecutionPolicy Bypass -File build\build.ps1

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot            # project root
$Venv = Join-Path $Root ".venv\Scripts"
$Pi   = Join-Path $Venv "pyinstaller.exe"
$Py   = Join-Path $Venv "python.exe"

if (-not (Test-Path $Pi)) {
    Write-Host "[ERROR] PyInstaller not found: $Pi" -ForegroundColor Red
    Write-Host "        Run tools\setup_env.ps1 first and pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

# 1) Redirect build-time temp files to the D drive (avoid writing to C:\...\Temp).
$TmpRoot = Join-Path $Root "build\_tmp"
New-Item -ItemType Directory -Force -Path $TmpRoot | Out-Null
$env:TMP    = $TmpRoot
$env:TEMP   = $TmpRoot
$env:TMPDIR = $TmpRoot

# PyInstaller otherwise keeps its cache in %LOCALAPPDATA%\pyinstaller (C drive).
# Redirect it to the project dir so nothing is written to the C drive.
$env:PYINSTALLER_CONFIG_DIR = Join-Path $Root "build\_pyi_cache"
New-Item -ItemType Directory -Force -Path $env:PYINSTALLER_CONFIG_DIR | Out-Null

# 2) Kill leftover processes (a running exe blocks the overwrite).
foreach ($name in @("OS_Train", "QtWebEngineProcess")) {
    Get-Process -Name $name -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 500

# 3) Clean the previous build (single version, overwrite in place).
$Dist = Join-Path $Root "dist"
$Work = Join-Path $Root "build\_work"
Remove-Item -Recurse -Force $Dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $Work -ErrorAction SilentlyContinue

# 4) Package.
Write-Host "[1/2] Running PyInstaller (onedir, flat layout)..." -ForegroundColor Cyan
Push-Location $Root
try {
    & $Pi "build\os_train.spec" --noconfirm --clean --distpath $Dist --workpath $Work
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller exit code: $LASTEXITCODE" }
}
finally {
    Pop-Location
}

# 5) Verify that the key runtime files exist.
$AppDir = Join-Path $Dist "OS_Train"
$exe    = Join-Path $AppDir "OS_Train.exe"

$missing = @()
foreach ($rel in @(
    "lessons\catalog.json",
    "ui\index.html",
    "assets\fonts\jetbrains-mono-latin-400-normal.woff2",
    "app\judge\problems\sched-algorithms\spec.json",
    "app\judge\problems\pc-bounded-buffer\reference.py"
)) {
    if (-not (Test-Path (Join-Path $AppDir $rel))) { $missing += $rel }
}
if (-not (Test-Path $exe)) { $missing += "OS_Train.exe" }

# The QtWebEngine helper and locale files may land in different subdirs across
# PyInstaller versions, so search recursively.
$hasHelper = [bool](Get-ChildItem -Path $AppDir -Recurse -Filter "QtWebEngineProcess.exe" -ErrorAction SilentlyContinue | Select-Object -First 1)
$hasLocale = [bool](Get-ChildItem -Path $AppDir -Recurse -Filter "en-US.pak" -ErrorAction SilentlyContinue | Select-Object -First 1)

Write-Host "[2/2] Verifying build output..." -ForegroundColor Cyan
if ($missing.Count -gt 0) {
    Write-Host "[FAIL] Missing files:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "        - $_" -ForegroundColor Red }
    exit 2
}
if (-not $hasHelper) {
    Write-Host "[FAIL] QtWebEngineProcess.exe not found (QtWebEngine cannot run)." -ForegroundColor Red
    exit 2
}
if (-not $hasLocale) {
    Write-Host "[FAIL] qtwebengine_locales\en-US.pak not found (Chromium will refuse to start)." -ForegroundColor Red
    exit 2
}

$size = (Get-ChildItem -Path $AppDir -Recurse -File | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host ""
Write-Host "[DONE] Output dir:  $AppDir" -ForegroundColor Green
Write-Host "       Executable:  $exe" -ForegroundColor Green
Write-Host ("       Size:        {0:N1} MB" -f $size) -ForegroundColor Green
