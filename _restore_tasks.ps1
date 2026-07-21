$gitShow = & git -C "D:\oma2" show "HEAD:src/app/(main)/tasks/page.tsx"
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText("D:\oma2\src\app\(main)\tasks\page.tsx", $gitShow, $utf8)
Write-Host "Restored"
