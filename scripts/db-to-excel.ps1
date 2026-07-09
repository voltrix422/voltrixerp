# Voltrix ERP — export all database tables as CSV files (open in Excel)
#
# Run from the project folder on your PC:
#   npm run db:excel
#
# Downloads and extracts to Desktop\erp-backups\db-excel-<date>\ with one
# .csv file per table (purchase ledger, suppliers, orders, users, ...).

param(
    [string]$VpsHost = "",
    [string]$Destination = "$env:USERPROFILE\Desktop\erp-backups"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$hostFile = Join-Path $scriptDir ".vps-host"

if (-not $VpsHost) {
    if (Test-Path $hostFile) { $VpsHost = (Get-Content $hostFile -Raw).Trim() }
    if (-not $VpsHost) {
        $VpsHost = Read-Host "Enter VPS SSH address (e.g. root@203.0.113.10)"
        if (-not $VpsHost) { Write-Error "No VPS address given."; exit 1 }
        Set-Content -Path $hostFile -Value $VpsHost
    }
}

Write-Host ""
Write-Host "==> Step 1/3: Exporting all tables to CSV on $VpsHost ..." -ForegroundColor Cyan
scp (Join-Path $scriptDir "export-db-csv.sh") "${VpsHost}:/tmp/export-db-csv.sh" | Out-Null
$output = ssh $VpsHost "bash /tmp/export-db-csv.sh"
if ($LASTEXITCODE -ne 0) { Write-Error "Export failed on the VPS."; exit 1 }
$output | ForEach-Object { Write-Host $_ }
$remoteArchive = ($output | Select-Object -Last 1).Trim()
$archiveName = Split-Path -Leaf $remoteArchive

Write-Host ""
Write-Host "==> Step 2/3: Downloading $archiveName ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $Destination | Out-Null
$localArchive = Join-Path $Destination $archiveName
scp "${VpsHost}:$remoteArchive" $localArchive
if ($LASTEXITCODE -ne 0) { Write-Error "Download failed."; exit 1 }

Write-Host ""
Write-Host "==> Step 3/3: Extracting..." -ForegroundColor Cyan
tar -xzf $localArchive -C $Destination

$extractedFolder = Join-Path $Destination ($archiveName -replace "\.tar\.gz$", "")
Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  CSV files: $extractedFolder"
Write-Host "  Double-click any .csv to open it in Excel." -ForegroundColor Yellow
