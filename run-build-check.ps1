Set-Location $PSScriptRoot
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Start-Sleep 2
$result = & npx next build 2>&1
$exitCode = $LASTEXITCODE
$errors = $result | Where-Object { $_ -match 'error|Error|Failed' -and $_ -notmatch 'Restoring failed|cache' }
$lastLines = $result | Select-Object -Last 10
$output = @"
=== BUILD EXIT CODE: $exitCode ===
=== ERRORS ===
$($errors -join "`n")
=== LAST 10 LINES ===
$($lastLines -join "`n")
"@
[System.IO.File]::WriteAllText("$PSScriptRoot\build-output-mar28.txt", $output)
Write-Host "BUILD DONE - exit code: $exitCode"
