# Voltrix ERP — one-command backup to PC
#
# Run from the project folder on your PC:
#   npm run backup:pc
#
# What it does:
#   1. Connects to the VPS and runs the full backup (database + uploads + catalog + env)
#   2. Downloads the archive into a dated folder on your PC
#   3. Extracts it so you get properly structured folders:
#        database.dump, uploads\purchase-bills, uploads\payment-proofs, products.json, ...
#
# The VPS address is asked once and remembered in scripts\.vps-host

param(
    [string]$VpsHost = "",
    [string]$Destination = "$env:USERPROFILE\Desktop\erp-backups",
    [switch]$KeepArchiveOnly
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$hostFile = Join-Path $scriptDir ".vps-host"

if (-not $VpsHost) {
    if (Test-Path $hostFile) {
        $VpsHost = (Get-Content $hostFile -Raw).Trim()
    }
    if (-not $VpsHost) {
        $VpsHost = Read-Host "Enter VPS SSH address (e.g. root@203.0.113.10)"
        if (-not $VpsHost) { Write-Error "No VPS address given."; exit 1 }
        Set-Content -Path $hostFile -Value $VpsHost
        Write-Host "Saved to scripts\.vps-host - you won't be asked again." -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "==> Step 1/3: Creating fresh backup on $VpsHost (this can take a minute)..." -ForegroundColor Cyan
ssh $VpsHost "cd /var/www/erpvoltrix && bash scripts/weekly-backup.sh"
if ($LASTEXITCODE -ne 0) { Write-Error "Backup failed on the VPS."; exit 1 }

$remoteArchive = (ssh $VpsHost "ls -t /var/backups/erpvoltrix/erp-weekly-*.tar.gz | head -1").Trim()
if (-not $remoteArchive) { Write-Error "Could not find the backup archive on the VPS."; exit 1 }
$archiveName = Split-Path -Leaf $remoteArchive

Write-Host ""
Write-Host "==> Step 2/3: Downloading $archiveName ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$localArchive = Join-Path $Destination $archiveName
scp "${VpsHost}:$remoteArchive" $localArchive
if ($LASTEXITCODE -ne 0) { Write-Error "Download failed."; exit 1 }

if (-not $KeepArchiveOnly) {
    Write-Host ""
    Write-Host "==> Step 3/3: Extracting into structured folders..." -ForegroundColor Cyan
    tar -xzf $localArchive -C $Destination
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Extraction failed - the .tar.gz archive itself is fine, open it with 7-Zip."
    }
}

$extractedFolder = Join-Path $Destination ($archiveName -replace "\.tar\.gz$", "")

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  Archive : $localArchive"
if ((-not $KeepArchiveOnly) -and (Test-Path $extractedFolder)) {
    Write-Host "  Folders : $extractedFolder"
    Write-Host ""
    Write-Host "  Inside you'll find:"
    Write-Host "    database.dump       - full PostgreSQL database"
    Write-Host "    uploads\            - all bills, receipts, proofs, photos (by folder)"
    Write-Host "    products.json       - website product catalog"
    Write-Host "    env.backup          - server settings (contains passwords - keep safe)"
    Write-Host "    BACKUP-REPORT.txt   - summary of what was backed up"
}
Write-Host ""
Write-Host "Copy the folder or the .tar.gz to your external hard drive." -ForegroundColor Yellow
