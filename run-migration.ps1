Write-Host "`nWaiting for Vercel deployment..." -ForegroundColor Cyan
Start-Sleep -Seconds 120

Write-Host "`nRunning data migration..." -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod "https://earn4insights.vercel.app/api/migrate-all-data?key=test123"
    
    Write-Host "`n================================" -ForegroundColor Green
    Write-Host "     MIGRATION COMPLETE!" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host "Products migrated: $($result.products)"
    Write-Host "Surveys migrated: $($result.surveys)"
    Write-Host "Responses migrated: $($result.responses)"
    Write-Host "Message: $($result.message)"
    Write-Host "Timestamp: $($result.timestamp)"
    Write-Host "================================`n" -ForegroundColor Green
} catch {
    Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
}
