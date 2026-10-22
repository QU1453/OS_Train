# One-click push: OS_Train -> https://github.com/QU1453/OS_Train
# Usage: right-click this file -> "Run with PowerShell"
$ErrorActionPreference = 'Continue'
Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Path)

$Remote = 'https://github.com/QU1453/OS_Train.git'
$Name   = 'QU1453'
$Mail   = '13310883039@163.com'
$Msg    = 'chore: OS_Train operating-system review app'

Write-Host '== [1/6] clean leftovers ==' -ForegroundColor Cyan
foreach ($p in @('_gitdir', '.gitrepo', 'var\gittest', 'build\gittest')) {
    if (Test-Path $p) { Remove-Item -Recurse -Force $p -ErrorAction SilentlyContinue }
}

Write-Host '== [2/6] init repo ==' -ForegroundColor Cyan
if (-not (Test-Path '.git')) { git init -b main | Out-Null }
git config --local user.name  $Name
git config --local user.email $Mail
git config --local core.quotepath false
git config --local core.autocrlf false
if (Get-Command git-credential-manager -ErrorAction SilentlyContinue) {
    git config --local credential.helper manager
}

Write-Host '== [3/6] stage files ==' -ForegroundColor Cyan
git add -A

Write-Host '== [4/6] commit ==' -ForegroundColor Cyan
git commit -m $Msg
if ($LASTEXITCODE -ne 0) { Write-Host '   (nothing new to commit, continue)' -ForegroundColor DarkGray }

Write-Host '== [5/6] remote ==' -ForegroundColor Cyan
git remote remove origin 2>&1 | Out-Null
git remote add origin $Remote
git branch -M main

Write-Host '== [6/6] push (a GitHub login window may pop up) ==' -ForegroundColor Cyan
git push -u origin main

Write-Host ''
if ($LASTEXITCODE -eq 0) {
    Write-Host 'DONE -> https://github.com/QU1453/OS_Train' -ForegroundColor Green
} else {
    Write-Host 'PUSH FAILED. If it is an authentication error, run:' -ForegroundColor Red
    Write-Host '   git config --global credential.helper manager' -ForegroundColor Yellow
    Write-Host '   then run this script again.' -ForegroundColor Yellow
}
