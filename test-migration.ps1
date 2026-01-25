Write-Host "Testing migration endpoint..." -ForegroundColor Cyan

$headers = @{"x-api-key"="test123"}
$result = Invoke-WebRequest -Uri "https://earn4insights.vercel.app/api/admin/migrate?data=true" -Method POST -Headers $headers
$json = $result.Content | ConvertFrom-Json

Write-Host "`n=== Migration Result ===" -ForegroundColor Green
Write-Host "Version: $($json.version)"
Write-Host "Timestamp: $($json.timestamp)"
Write-Host "Success: $($json.success)"
Write-Host "Message: $($json.message)"
Write-Host "`n=== Data Migrated ===" -ForegroundColor Yellow
Write-Host "Products: $($json.products)"
Write-Host "Surveys: $($json.surveys)"
Write-Host "Responses: $($json.responses)"
Write-Host "`n" -ForegroundColor White
