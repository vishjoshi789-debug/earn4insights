Write-Host "Waiting for deployment..." -ForegroundColor Cyan
Start-Sleep -Seconds 150

Write-Host "`n========== RUNNING DATA MIGRATION ==========" -ForegroundColor Green

$headers = @{"x-api-key"="test123"}

try {
    $response = Invoke-WebRequest -Uri "https://earn4insights.vercel.app/api/admin/run-data-migration" -Method POST -Headers $headers
    $json = $response.Content | ConvertFrom-Json
    
    Write-Host "`nSUCCESS!" -ForegroundColor Green
    Write-Host "Version: $($json.version)"
    Write-Host "Endpoint: $($json.endpoint)"
    Write-Host "Timestamp: $($json.timestamp)"
    Write-Host "`nMigrated Data:" -ForegroundColor Yellow
    Write-Host "  Products: $($json.products)"
    Write-Host "  Surveys: $($json.surveys)"
    Write-Host "  Responses: $($json.responses)"
} catch {
    Write-Host "`nERROR:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

Write-Host "`nDone!" -ForegroundColor White
