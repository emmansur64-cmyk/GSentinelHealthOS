#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Automated frontend optimization & build script
.DESCRIPTION
    Cleans, rebuilds, and verifies GSentinelHealthOS dashboard-ui
.PARAMETER Analyze
    Run bundle analysis after build
#>

param(
    [switch]$Analyze
)

$ErrorActionPreference = "Stop"
$ProjectRoot = "e:\GSentinelHealthOS"
$DashboardUI = Join-Path $ProjectRoot "dashboard-ui"

function Write-Status {
    param([string]$Message)
    Write-Host "> $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "OK: $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
}

try {
    Write-Status "GSentinelHealthOS Frontend Optimization Pipeline"
    Write-Host ""

    # ========================================================================
    # STEP 1: Verify environment
    # ========================================================================
    Write-Status "Step 1/5: Verifying environment..."
    
    if (-not (Test-Path $DashboardUI)) {
        throw "Dashboard UI folder not found at $DashboardUI"
    }

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm not found. Install Node.js first."
    }

    $npmVersion = npm --version
    Write-Success "npm v$npmVersion ready"

    # ========================================================================
    # STEP 2: Clean build artifacts
    # ========================================================================
    Write-Status "Step 2/5: Cleaning old build artifacts..."
    
    $toClean = @(
        (Join-Path $DashboardUI "dist"),
        (Join-Path $DashboardUI ".vite"),
        (Join-Path $DashboardUI "node_modules")
    )

    foreach ($path in $toClean) {
        if (Test-Path $path) {
            Write-Host "  Removing: $(Split-Path -Leaf $path)" -ForegroundColor Gray
            Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
        }
    }

    Write-Success "Cleanup complete"

    # ========================================================================
    # STEP 3: Fresh npm install
    # ========================================================================
    Write-Status "Step 3/5: Installing dependencies (fresh)..."
    Push-Location $DashboardUI
    try {
        npm cache clean --force | Out-Null
        npm install
    
        Write-Success "Dependencies installed"

        # ========================================================================
        # STEP 4: Build production
        # ========================================================================
        Write-Status "Step 4/5: Building optimized bundle..."
    
        npm run build
    
    # Analyze output
    $distSize = 0
    $chunks = @()
    
    if (Test-Path (Join-Path $DashboardUI "dist")) {
        Get-ChildItem -Recurse (Join-Path $DashboardUI "dist") -Include "*.js" | ForEach-Object {
            $size = (Get-Item $_).Length / 1KB
            $chunks += @{
                Name = $_.Name
                Size = $size
            }
            $distSize += $size
        }
    }

    Write-Success "Build complete"
    
    # ========================================================================
    # STEP 5: Report
    # ========================================================================
    Write-Status "Step 5/5: Generating report..."
    Write-Host ""
    Write-Host "📊 Bundle Report:" -ForegroundColor Yellow
    Write-Host ""
    
    # Sort and display chunks
    $chunks | Sort-Object -Property Size -Descending | ForEach-Object {
        $sizeStr = "{0:N0} KB" -f $_.Size
        Write-Host "  $($_.Name.PadRight(35)) $sizeStr"
    }
    
    Write-Host ""
    Write-Host "Total JS size: {0:N0} KB" -f $distSize -ForegroundColor Yellow
    Write-Host ""

    # Expected targets
    $warningThreshold = 600
    if ($distSize -lt 400) {
        $status = "Excelente"
    }
    elseif ($distSize -lt 500) {
        $status = "Bueno"
    }
    elseif ($distSize -lt $warningThreshold) {
        $status = "Aceptable"
    }
    else {
        $status = "Revisar"
    }

        Write-Host "Status: $status ($distSize KB)" -ForegroundColor Cyan
    }
    finally {
        Pop-Location
    }

    # ========================================================================
    # OPTIONAL: Bundle Analysis
    # ========================================================================
    if ($Analyze) {
        Write-Status "Generating interactive bundle visualization..."
        Write-Host ""
        Write-Host "This requires: npm install -g rollup-plugin-visualizer" -ForegroundColor Gray
        Write-Host "Skipping for now. Run manually if needed." -ForegroundColor Gray
    }

    # ========================================================================
    # NEXT STEPS
    # ========================================================================
    Write-Host ""
    Write-Success "Optimization pipeline complete!"
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Test locally:     npm run dev"
    Write-Host "  2. Open browser:     http://localhost:5174"
    Write-Host "  3. Open DevTools:    F12 → Network → watch chunk loads"
    Write-Host "  4. Run Lighthouse:   npm install -g lighthouse && lighthouse http://localhost:5174"
    Write-Host ""

} catch {
    Write-Error-Custom $_.Exception.Message
    exit 1
}
