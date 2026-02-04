# Apply database migrations to production
# Run this script to apply email analytics tables to production database

Write-Host "`n=== Database Migration Script ===" -ForegroundColor Cyan
Write-Host "This will apply email analytics tables to production`n" -ForegroundColor Yellow

# Load environment variables from .env.local
$envPath = Join-Path $PSScriptRoot ".env.local"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^POSTGRES_URL=(.+)$') {
            $env:POSTGRES_URL = $matches[1].Trim('"').Trim("'")
            Write-Host "✅ Loaded POSTGRES_URL from .env.local" -ForegroundColor Green
        }
    }
} else {
    Write-Host "❌ .env.local file not found!" -ForegroundColor Red
    exit 1
}

# Check if URL is set
if (-not $env:POSTGRES_URL) {
    Write-Host "❌ POSTGRES_URL not found in .env.local!" -ForegroundColor Red
    exit 1
}

Write-Host "`nApplying migrations using drizzle-kit push..." -ForegroundColor Yellow
npx drizzle-kit push

Write-Host "`n✅ Migration complete!" -ForegroundColor Green
