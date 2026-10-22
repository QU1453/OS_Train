# Phase 0: create D-drive venv and install deps.
# All pip caches and temp dirs point to the D drive (no C-drive writes).
# Usage: powershell -ExecutionPolicy Bypass -File .\tools\setup_env.ps1
#
# NOTE: keep this file ASCII-only. PowerShell 5 reads .ps1 as the system
# ANSI codepage, so non-ASCII text can corrupt string terminators.

param(
    [string]$IndexUrl = 'https://pypi.org/simple'
)

$ErrorActionPreference = 'Stop'

$Root      = Split-Path -Parent $PSScriptRoot
$VenvDir   = Join-Path $Root '.venv'
$CacheDir  = Join-Path $Root '.cache'
$PipCache  = Join-Path $CacheDir 'pip'
$TmpDir    = Join-Path $CacheDir 'tmp'

New-Item -ItemType Directory -Force -Path $PipCache, $TmpDir | Out-Null

# Process-level temp dirs -> D drive
$env:TMP    = $TmpDir
$env:TEMP   = $TmpDir
$env:TMPDIR = $TmpDir
$env:PIP_CACHE_DIR = $PipCache
$env:PIP_TMPDIR    = $TmpDir

$Py = Join-Path $VenvDir 'Scripts\python.exe'

if (-not (Test-Path $Py)) {
    Write-Host "[1/3] Creating venv -> $VenvDir"
    python -m venv $VenvDir
} else {
    Write-Host "[1/3] venv already exists, skip create"
}

if (-not (Test-Path $Py)) { throw "venv python not found: $Py" }

Write-Host "[2/3] Upgrading pip (index: $IndexUrl)"
& $Py -m pip install --upgrade pip --cache-dir $PipCache -i $IndexUrl

Write-Host "[3/3] Installing requirements.txt"
& $Py -m pip install -r (Join-Path $Root 'requirements.txt') --cache-dir $PipCache -i $IndexUrl

Write-Host "Done. Interpreter: $Py"
& $Py -c "import PySide6, sys; print('PySide6', PySide6.__version__, '| Python', sys.version)"
