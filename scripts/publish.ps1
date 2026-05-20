# Create or update the GitHub remote and push main.
# Requires: GitHub CLI (gh) logged in — run: gh auth login

param(
    [string]$Org = "AlexanderKiyingi",
    [switch]$Private
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$remote = "https://github.com/$Org/iag-api-gateway.git"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Error "Install GitHub CLI: https://cli.github.com/ — then run: gh auth login"
}

$exists = $false
try {
    gh repo view "$Org/iag-api-gateway" 2>$null | Out-Null
    $exists = $true
} catch {
    $exists = $false
}

if (-not $exists) {
    $visibility = if ($Private) { "--private" } else { "--public" }
    gh repo create "$Org/iag-api-gateway" $visibility `
        --description "IAG platform API gateway — JWT verification, route policies, upstream proxy" `
        --source . `
        --remote origin `
        --push
    Write-Host "Created and pushed: $remote"
    exit 0
}

git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    git remote add origin $remote
} else {
    git remote set-url origin $remote
}

git push -u origin main
Write-Host "Pushed to: $remote"
