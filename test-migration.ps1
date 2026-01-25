$headers = @{"x-api-key"="test123"}
$result = Invoke-WebRequest -Uri "https://earn4insights.vercel.app/api/admin/migrate?data=true" -Method POST -Headers $headers
$json = $result.Content | ConvertFrom-Json

Write-Host "`nMigration Result:"
Write-Host "Version: $($json.version)"
Write-Host "Success: $($json.success)"
Write-Host "Message: $($json.message)"
Write-Host "Products migrated: $($json.products)"
Write-Host "Surveys migrated: $($json.surveys)"
Write-Host "Responses migrated: $($json.responses)"
