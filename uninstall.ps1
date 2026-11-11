<#
.SYNOPSIS
    UYAP Kelime İşlemci & Print to UDF Kaldırma Betiği
.DESCRIPTION
    install.ps1 tarafından eklenen kısayolları, sağ tık menülerini, SendTo kısayolunu,
    WindowsApps CLI komutlarını ve varsa sanal yazıcıyı sistemden temizler.
#>

[CmdletBinding()]
param()

$installScript = Join-Path $PSScriptRoot "install.ps1"
if (Test-Path $installScript) {
    & $installScript -Uninstall
} else {
    Write-Host "[*] install.ps1 bulunamadı, doğrudan temizleme yapılıyor..." -ForegroundColor Yellow

    # Kısayollar
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $startMenuPath = [Environment]::GetFolderPath("Programs")
    @("UYAP Kelime İşlemci.lnk", "UYAP'a Yazdır.lnk") | ForEach-Object {
        $p1 = Join-Path $desktopPath $_
        $p2 = Join-Path $startMenuPath $_
        if (Test-Path $p1) { Remove-Item $p1 -Force -ErrorAction SilentlyContinue }
        if (Test-Path $p2) { Remove-Item $p2 -Force -ErrorAction SilentlyContinue }
    }

    # SendTo
    $sendToBat = Join-Path $env:APPDATA "Microsoft\Windows\SendTo\UYAP'a Yazdır (Print to UDF).bat"
    if (Test-Path $sendToBat) { Remove-Item $sendToBat -Force -ErrorAction SilentlyContinue }

    # Shims
    $appsDir = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps"
    @("udf.cmd", "print-to-udf.cmd") | ForEach-Object {
        $p = Join-Path $appsDir $_
        if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue }
    }

    # Registry
    $exts = @(".pdf", ".docx", ".doc", ".txt", ".md", ".rtf", ".png", ".jpg", ".jpeg", ".xlsx", ".csv")
    foreach ($ext in $exts) {
        $regPath = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\ConvertToUDF"
        if (Test-Path $regPath) { Remove-Item -Path $regPath -Recurse -Force -ErrorAction SilentlyContinue }
    }
    $udfReg = "HKCU:\Software\Classes\SystemFileAssociations\.udf\shell\OpenInUyapEditor"
    if (Test-Path $udfReg) { Remove-Item -Path $udfReg -Recurse -Force -ErrorAction SilentlyContinue }

    Write-Host "[✓] Temizlik tamamlandı." -ForegroundColor Green
}

