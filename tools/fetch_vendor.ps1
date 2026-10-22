# Phase 0: fetch offline frontend deps (CodeMirror 5 / three.js / JetBrains Mono)
# and vendor them into the project. All npm caches and temp dirs point to the D
# drive (no C-drive writes).
# Usage: powershell -ExecutionPolicy Bypass -File .\tools\fetch_vendor.ps1
#
# NOTE: keep this file ASCII-only (PowerShell 5 ANSI codepage issue).

$ErrorActionPreference = 'Stop'

$Root       = Split-Path -Parent $PSScriptRoot
$VendorSrc  = Join-Path $Root '.vendor_src'
$CacheDir   = Join-Path $Root '.cache'
$NpmCache   = Join-Path $CacheDir 'npm'
$TmpDir     = Join-Path $CacheDir 'tmp'
$UiVendor   = Join-Path $Root 'ui\vendor'
$FontDir    = Join-Path $Root 'assets\fonts'

New-Item -ItemType Directory -Force -Path $NpmCache, $TmpDir, $VendorSrc, $UiVendor, $FontDir | Out-Null

$env:TMP    = $TmpDir
$env:TEMP   = $TmpDir
$env:TMPDIR = $TmpDir
$env:npm_config_cache = $NpmCache
$env:npm_config_tmp   = $TmpDir

Write-Host "[1/3] npm install offline deps (cache -> $NpmCache)"
Push-Location $VendorSrc
try {
    npm install --no-audit --no-fund --cache $NpmCache --prefix $VendorSrc `
        codemirror@5.65.16 `
        three@0.169.0 `
        @fontsource/jetbrains-mono@5.0.19
} finally {
    Pop-Location
}

$NM = Join-Path $VendorSrc 'node_modules'

Write-Host "[2/3] Copy CodeMirror / three into ui\vendor"
$cmSrc = Join-Path $NM 'codemirror'
$cmDst = Join-Path $UiVendor 'codemirror'

$cmFiles = @(
    'lib\codemirror.js',
    'lib\codemirror.css',
    'mode\clike\clike.js',
    'mode\python\python.js',
    'mode\javascript\javascript.js',
    'addon\edit\matchbrackets.js',
    'addon\edit\closebrackets.js',
    'addon\selection\active-line.js',
    'addon\comment\comment.js'
)
foreach ($f in $cmFiles) {
    $src = Join-Path $cmSrc $f
    $dst = Join-Path $cmDst $f
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
    Copy-Item -Force $src $dst
}

$threeSrc = Join-Path $NM 'three\build'
$threeDst = Join-Path $UiVendor 'three'
New-Item -ItemType Directory -Force -Path $threeDst | Out-Null
Copy-Item -Force (Join-Path $threeSrc '*.js') $threeDst

$ocSrc = Join-Path $NM 'three\examples\jsm\controls\OrbitControls.js'
$ocDst = Join-Path $UiVendor 'three\examples\jsm\controls\OrbitControls.js'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $ocDst) | Out-Null
Copy-Item -Force $ocSrc $ocDst

Write-Host "[3/3] Copy JetBrains Mono woff2 into assets\fonts"
Get-ChildItem (Join-Path $NM '@fontsource\jetbrains-mono\files') -Filter 'jetbrains-mono-latin-*-normal.woff2' |
    Copy-Item -Destination $FontDir -Force

$cmCount    = (Get-ChildItem $cmDst -Recurse -File | Measure-Object).Count
$threeCount = (Get-ChildItem $threeDst -Recurse -File | Measure-Object).Count
$fontCount  = (Get-ChildItem $FontDir -File | Measure-Object).Count

Write-Host "Done."
Write-Host "  ui\vendor\codemirror : $cmCount files"
Write-Host "  ui\vendor\three      : $threeCount files"
Write-Host "  assets\fonts         : $fontCount files"
