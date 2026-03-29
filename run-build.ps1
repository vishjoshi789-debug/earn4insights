Set-Location "C:\Users\Hp\Documents\studio"
$output = & npx next build 2>&1 | Out-String
$output | Out-File -FilePath "C:\Users\Hp\Documents\studio\build-final-output.txt" -Encoding utf8
"EXIT_CODE: $LASTEXITCODE" | Out-File -FilePath "C:\Users\Hp\Documents\studio\build-final-output.txt" -Append -Encoding utf8
"BUILD_COMPLETE" | Out-File -FilePath "C:\Users\Hp\Documents\studio\build-done.flag" -Encoding utf8
