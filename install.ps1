<#
.SYNOPSIS
    UYAP Kelime İşlemci & Print to UDF - Tek Komutla Otomatik Kurulum Betiği
.DESCRIPTION
    Bu betik:
    1. Python ortamını ve PyMuPDF kütüphanesini otomatik doğrular / kurar.
    2. Masaüstü ve Başlat Menüsüne "UYAP Kelime İşlemci" kısayollarını ekler.
    3. Windows Dosya Gezgini Sağ Tık Menüsüne "UDF'e Dönüştür" entegrasyonunu ekler (.pdf, .docx, .md, .txt, .png vb.).
    4. "Gönder (SendTo)" menüsüne "UYAP'a Yazdır" kısayolu ekler.
    5. Terminalden doğrudan 'udf' ve 'print-to-udf' komutlarının çalışması için PATH shim ve PowerShell profili ekler.
    6. Yönetici olarak çalıştırıldığında sisteme "UYAP'a Yazdır (Print to UDF)" sanal yazıcısını ekler.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\install.ps1
    irm https://raw.githubusercontent.com/gokhantasci/uyap-kelime-islemci/main/install.ps1 | iex
#>

[CmdletBinding()]
param(
    [switch]$Uninstall,
    [switch]$NoPrinter,
    [string]$InstallDir = ""
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "   UYAP Kelime İşlemci & Print to UDF Kurulum Sihirbazı" -ForegroundColor White -BackgroundColor DarkBlue
Write-Host "   Modern, Bağımsız, Çevrimdışı UYAP Döküman Editörü & Evrensel Çevirici" -ForegroundColor Gray
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------------------------------------------------------
# 0. KALDIRMA MODU (UNINSTALL)
# -----------------------------------------------------------------------------
if ($Uninstall) {
    Write-Host "[*] UYAP Kelime İşlemci sistemden kaldırılıyor..." -ForegroundColor Yellow
    
    # 1. Kısayollar
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    $startMenuPath = [Environment]::GetFolderPath("Programs")
    $shortcutNames = @("UYAP Kelime İşlemci.lnk", "UYAP'a Yazdır.lnk")
    foreach ($sc in $shortcutNames) {
        $f1 = Join-Path $desktopPath $sc
        if (Test-Path $f1) { Remove-Item $f1 -Force -ErrorAction SilentlyContinue; Write-Host "  [-] Masaüstü kısayolu silindi: $sc" -ForegroundColor DarkGray }
        $f2 = Join-Path $startMenuPath $sc
        if (Test-Path $f2) { Remove-Item $f2 -Force -ErrorAction SilentlyContinue; Write-Host "  [-] Başlat menüsü kısayolu silindi: $sc" -ForegroundColor DarkGray }
    }

    # 2. Gönder (SendTo)
    $sendToDir = Join-Path $env:APPDATA "Microsoft\Windows\SendTo"
    $sendToBat = Join-Path $sendToDir "UYAP'a Yazdır (Print to UDF).bat"
    if (Test-Path $sendToBat) { Remove-Item $sendToBat -Force -ErrorAction SilentlyContinue; Write-Host "  [-] SendTo menüsü temizlendi." -ForegroundColor DarkGray }

    # 3. CLI Shims (WindowsApps)
    $appsDir = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps"
    @("udf.cmd", "print-to-udf.cmd") | ForEach-Object {
        $p = Join-Path $appsDir $_
        if (Test-Path $p) { Remove-Item $p -Force -ErrorAction SilentlyContinue; Write-Host "  [-] Komut kaldırıldı: $_" -ForegroundColor DarkGray }
    }

    # 4. Sağ Tık Menüleri (HKCU)
    $exts = @(".pdf", ".docx", ".doc", ".txt", ".md", ".rtf", ".png", ".jpg", ".jpeg", ".xlsx", ".csv")
    foreach ($ext in $exts) {
        $regPath = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\ConvertToUDF"
        if (Test-Path $regPath) {
            Remove-Item -Path $regPath -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
    $udfReg = "HKCU:\Software\Classes\.udf\OpenWithList"
    if (Test-Path $udfReg) { Remove-Item -Path $udfReg -Recurse -Force -ErrorAction SilentlyContinue }
    $udfMenuReg = "HKCU:\Software\Classes\SystemFileAssociations\.udf\shell\OpenInUyapEditor"
    if (Test-Path $udfMenuReg) { Remove-Item -Path $udfMenuReg -Recurse -Force -ErrorAction SilentlyContinue }

    # 5. Sanal Yazıcı (Eğer Yöneticiyse)
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if ($isAdmin) {
        Remove-Printer -Name "UYAP'a Yazdır (Print to UDF)" -ErrorAction SilentlyContinue
        $spoolFile = Join-Path $env:LOCALAPPDATA "PrintToUDF\spool.pdf"
        Remove-PrinterPort -Name $spoolFile -ErrorAction SilentlyContinue
        Write-Host "  [-] Sistem sanal yazıcısı kaldırıldı." -ForegroundColor DarkGray
    }

    # 6. Başlangıç Servisi
    $startupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
    $vbsPath = Join-Path $startupDir "PrintToUDF_Watcher.vbs"
    if (Test-Path $vbsPath) { Remove-Item $vbsPath -Force -ErrorAction SilentlyContinue }

    Write-Host "[✓] Tüm bileşenler başarıyla sistemden kaldırıldı." -ForegroundColor Green
    return
}

# -----------------------------------------------------------------------------
# 1. HEDEF ÇALIŞMA DİZİNİ BELİRLEME
# -----------------------------------------------------------------------------
$scriptDir = $PSScriptRoot
if (-not $scriptDir -or -not (Test-Path (Join-Path $scriptDir "index.html"))) {
    if ($InstallDir -ne "") {
        $targetDir = $InstallDir
    } else {
        $targetDir = Join-Path $env:LOCALAPPDATA "UYAP-Kelime-Islemci"
    }
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    Write-Host "[*] Kurulum dizini: $targetDir" -ForegroundColor Cyan
} else {
    $targetDir = $scriptDir
    Write-Host "[*] Çalışma dizini: $targetDir" -ForegroundColor Cyan
}

# İnternetten tek satır kurulumda kaynak paketi de indirilir.
if (-not (Test-Path -LiteralPath (Join-Path $targetDir 'index.html'))) {
    $archivePath = Join-Path ([IO.Path]::GetTempPath()) ('uyap-' + [guid]::NewGuid().ToString() + '.zip')
    $extractPath = $archivePath + '-files'
    Invoke-WebRequest -Uri 'https://github.com/gokhantasci/uyap-kelime-islemci/archive/refs/heads/main.zip' -OutFile $archivePath -ErrorAction Stop
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath -ErrorAction Stop
    $roots = @(Get-ChildItem -LiteralPath $extractPath -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'index.html') })
    if ($roots.Count -ne 1) { throw 'Kaynak paketi doğrulanamadı.' }
    Get-ChildItem -LiteralPath $roots[0].FullName -Force | Copy-Item -Destination $targetDir -Recurse -Force
}

# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# 2. PYTHON VE GEREKSİNİM KONTROLÜ (PYTHON'SUZ SİSTEM DESTEĞİ DAHİL)
# -----------------------------------------------------------------------------
Write-Host "[*] 1/6: Çalışma ortamı ve gereksinimler denetleniyor..." -ForegroundColor Yellow

$pythonCmd = $null
$embedDir = Join-Path $targetDir "python-embed"
$embedExe = Join-Path $embedDir "python.exe"

if (Test-Path $embedExe) {
    $pythonCmd = $embedExe
} elseif (Get-Command "python" -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command "py" -ErrorAction SilentlyContinue) {
    $pythonCmd = "py"
}

if (-not $pythonCmd) {
    Write-Host "[!] Sistemde kurulu Python tespit edilemedi." -ForegroundColor Yellow
    Write-Host "    Python kurulu olmayan bilgisayarlar için bağımsız yerel çalışma ve sanal yazıcı desteği hazırlanıyor..." -ForegroundColor Cyan

    # 1. winget ile sessiz kurulum denemesi
    if (Get-Command "winget" -ErrorAction SilentlyContinue) {
        Write-Host "  [*] Windows Paket Yöneticisi (winget) tespit edildi; Python 3.11 kontrol ediliyor..." -ForegroundColor DarkGray
        try {
            & winget install Python.Python.3.11 --silent --accept-source-agreements --accept-package-agreements 2>$null | Out-Null
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            if (Get-Command "python" -ErrorAction SilentlyContinue) {
                $pythonCmd = "python"
                Write-Host "  [+] Python 3.11 winget ile başarıyla kuruldu!" -ForegroundColor Green
            }
        } catch {}
    }

    if (-not $pythonCmd) {
        Write-Host "  [i] Bağımsız (Python-Free) mod aktif: Sanal yazıcı, masaüstü kısayolları ve yerel editör doğrudan PowerShell ve yerel tarayıcı üzerinden çalışacaktır." -ForegroundColor Green
    }
}

$pyExeObj = $null
if ($pythonCmd) {
    $pyVer = & $pythonCmd --version 2>&1
    Write-Host "  [+] Tespit edilen Python motoru: $pyVer" -ForegroundColor Green

    # PyMuPDF Kütüphanesini Kur / Güncelle
    Write-Host "  [*] PyMuPDF (PDF -> UDF dönüştürme motoru) kontrol ediliyor..." -ForegroundColor DarkGray
    & $pythonCmd -m pip install --quiet --upgrade pymupdf 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [+] PyMuPDF kütüphanesi hazır." -ForegroundColor Green
    } else {
        Write-Host "  [i] PyMuPDF kurulumu atlandı veya pip çevrimdışı. Temel mod çalışmaya devam edecek." -ForegroundColor DarkGray
    }

    $pyExeObj = Get-Command "pythonw.exe" -ErrorAction SilentlyContinue
    if (-not $pyExeObj) { $pyExeObj = Get-Command $pythonCmd -ErrorAction SilentlyContinue }
}

# -----------------------------------------------------------------------------
# 3. KULLANICI MASAÜSTÜ & BAŞLAT MENÜSÜ KISAYOLLARI
# -----------------------------------------------------------------------------
Write-Host "[*] 2/6: Masaüstü ve Başlat Menüsü kısayolları oluşturuluyor..." -ForegroundColor Yellow

$indexFile = Join-Path $targetDir "index.html"
$desktopPath = [Environment]::GetFolderPath("Desktop")
$startMenuPath = [Environment]::GetFolderPath("Programs")

$wshShell = New-Object -ComObject WScript.Shell

# Masaüstü Kısayolu
$desktopShortcutPath = Join-Path $desktopPath "UYAP Kelime İşlemci.lnk"
$shortcut = $wshShell.CreateShortcut($desktopShortcutPath)
if ($pyExeObj) {
    $shortcut.TargetPath = $pyExeObj.Source
    $shortcut.Arguments = '"' + (Join-Path $targetDir "open_in_editor.py") + '"'
} else {
    $shortcut.TargetPath = $indexFile
    $shortcut.Arguments = ""
}
$shortcut.WorkingDirectory = $targetDir
$shortcut.Description = "UYAP Kelime İşlemci - Modern Web Editörü"
$shortcut.Save()
Write-Host "  [+] Masaüstü Kısayolu: $desktopShortcutPath" -ForegroundColor Green

# Başlat Menüsü Kısayolu
$startShortcutPath = Join-Path $startMenuPath "UYAP Kelime İşlemci.lnk"
$scStart = $wshShell.CreateShortcut($startShortcutPath)
if ($pyExeObj) {
    $scStart.TargetPath = $pyExeObj.Source
    $scStart.Arguments = '"' + (Join-Path $targetDir "open_in_editor.py") + '"'
} else {
    $scStart.TargetPath = $indexFile
    $scStart.Arguments = ""
}
$scStart.WorkingDirectory = $targetDir
$scStart.Description = "UYAP Kelime İşlemci - Modern Web Editörü"
$scStart.Save()
Write-Host "  [+] Başlat Menüsü Kısayolu: $startShortcutPath" -ForegroundColor Green

# -----------------------------------------------------------------------------
# 4. DOSYA GEZGİNİ SAĞ TIK MENÜLERİ (HKCU - YÖNETİCİ HAKKI GEREKTİRMEZ)
# -----------------------------------------------------------------------------
Write-Host "[*] 3/6: Windows Gezgini sağ tık dönüştürme menüsü ekleniyor..." -ForegroundColor Yellow

$pyScript = Join-Path $targetDir "print_to_udf.py"
$exts = @(".pdf", ".docx", ".doc", ".txt", ".md", ".rtf", ".png", ".jpg", ".jpeg", ".bmp", ".xlsx", ".csv")

foreach ($ext in $exts) {
    $menuKey = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\ConvertToUDF"
    $cmdKey = "$menuKey\command"

    New-Item -Path $menuKey -Force | Out-Null
    Set-ItemProperty -Path $menuKey -Name "(Default)" -Value "UDF'e Dönüştür (Print to UDF)"
    Set-ItemProperty -Path $menuKey -Name "Icon" -Value "shell32.dll,54"

    New-Item -Path $cmdKey -Force | Out-Null
    if ($pyExeObj) {
        $cmdVal = "powershell.exe -WindowStyle Hidden -NoProfile -Command `"Start-Process '$($pyExeObj.Source)' -ArgumentList '`\`"$pyScript`\`"', '`\`"%1`\`"' -WindowStyle Hidden`""
    } else {
        $cmdVal = "powershell.exe -WindowStyle Hidden -NoProfile -Command `"Start-Process 'https://udf.657.com.tr/?welcome=0'`""
    }
    Set-ItemProperty -Path $cmdKey -Name "(Default)" -Value $cmdVal
}
Write-Host "  [+] Desteklenen formatlara (PDF, Word, Markdown, Metin, Resim) sağ tık menüsü eklendi." -ForegroundColor Green

# .udf dosyaları için doğrudan Editörde Aç menüsü
$udfMenuKey = "HKCU:\Software\Classes\SystemFileAssociations\.udf\shell\OpenInUyapEditor"
New-Item -Path $udfMenuKey -Force | Out-Null
Set-ItemProperty -Path $udfMenuKey -Name "(Default)" -Value "UYAP Editöründe Aç"
Set-ItemProperty -Path $udfMenuKey -Name "Icon" -Value "imageres.dll,2"

$udfCmdKey = "$udfMenuKey\command"
New-Item -Path $udfCmdKey -Force | Out-Null

$localOpener = Join-Path $targetDir "open_in_editor.py"
if ($pyExeObj -and (Test-Path $localOpener)) {
    $browserCmd = '"' + $pyExeObj.Source + '" "' + $localOpener + '" "%1"'
} else {
    $browserCmd = 'powershell.exe -WindowStyle Hidden -NoProfile -Command "Start-Process ''https://udf.657.com.tr/?welcome=0''"'
}
Set-ItemProperty -Path $udfCmdKey -Name "(Default)" -Value $browserCmd
Write-Host "  [+] .UDF dosyaları için 'UYAP Editöründe Aç' menüsü eklendi." -ForegroundColor Green

# -----------------------------------------------------------------------------
# 5. GÖNDER (SENDTO) MENÜSÜ ENTEGRASYONU
# -----------------------------------------------------------------------------
Write-Host "[*] 4/6: Windows 'Gönder' (SendTo) menüsü yapılandırılıyor..." -ForegroundColor Yellow
$sendToDir = Join-Path $env:APPDATA "Microsoft\Windows\SendTo"
if (Test-Path $sendToDir) {
    $sendToBat = Join-Path $sendToDir "UYAP'a Yazdır (Print to UDF).bat"
    if ($pyExeObj) {
        $batContent = "@echo off`r`n`"$($pyExeObj.Source)`" `"$pyScript`" %*`r`npause"
    } else {
        $batContent = "@echo off`r`nstart https://udf.657.com.tr/?welcome=0"
    }
    Set-Content -Path $sendToBat -Value $batContent -Encoding Ascii
    Write-Host "  [+] Gönder Menüsü: $sendToBat" -ForegroundColor Green
}

# -----------------------------------------------------------------------------
# 6. CLI ENTEGRASYONU (TERMINALDE 'udf' VE 'print-to-udf' ÇALIŞTIRMA)
# -----------------------------------------------------------------------------
Write-Host "[*] 5/6: Komut satırı (CLI) kısayolları (udf & print-to-udf) yapılandırılıyor..." -ForegroundColor Yellow

$appsDir = Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps"
if (Test-Path $appsDir) {
    $udfShim = Join-Path $appsDir "udf.cmd"
    if ($pyExeObj) {
        $udfContent = "@echo off`r`n`"$($pyExeObj.Source)`" `"$pyScript`" %*"
    } else {
        $udfContent = "@echo off`r`necho UYAP Kelime Islemci tarayicida aciliyor...`r`nstart https://udf.657.com.tr/"
    }
    Set-Content -Path $udfShim -Value $udfContent -Encoding Ascii

    $pShim = Join-Path $appsDir "print-to-udf.cmd"
    Set-Content -Path $pShim -Value $udfContent -Encoding Ascii

    Write-Host "  [+] Windows PATH üzerine eklendi: 'udf' ve 'print-to-udf' komutları tüm terminallerde geçerli." -ForegroundColor Green
}

# PowerShell Profil Entegrasyonu
if ($PROFILE) {
    $profDir = Split-Path $PROFILE
    if (-not (Test-Path $profDir)) {
        New-Item -ItemType Directory -Path $profDir -Force | Out-Null
    }
    $profContent = ""
    if (Test-Path $PROFILE) {
        $profContent = Get-Content $PROFILE -Raw
    }
    if ($profContent -notmatch "UYAP Kelime Islemci CLI") {
        if ($pyExeObj) {
            $aliasBlock = @"

# >>> UYAP Kelime Islemci CLI >>>
function udf { & "$($pyExeObj.Source)" "$pyScript" `$args }
function print-to-udf { & "$($pyExeObj.Source)" "$pyScript" `$args }
# <<< UYAP Kelime Islemci CLI <<<
"@
        } else {
            $aliasBlock = @"

# >>> UYAP Kelime Islemci CLI >>>
function udf { Start-Process "https://udf.657.com.tr/" }
function print-to-udf { Start-Process "https://udf.657.com.tr/" }
# <<< UYAP Kelime Islemci CLI <<<
"@
        }
        Add-Content -Path $PROFILE -Value $aliasBlock
        Write-Host "  [+] PowerShell profiline 'udf' fonksiyonu eklendi ($PROFILE)" -ForegroundColor Green
    }
}

# -----------------------------------------------------------------------------
# 7. SİSTEM SANAL YAZICISI ("UYAP'a Yazdır" - PYTHON BAĞIMSIZ NATIVE KURULUM)
# -----------------------------------------------------------------------------
Write-Host "[*] 6/6: Sistem Sanal Yazıcısı denetleniyor..." -ForegroundColor Yellow

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $NoPrinter) {
    if ($isAdmin) {
        Write-Host "  [*] Yönetici yetkisi onaylandı. 'UYAP'a Yazdır (Print to UDF)' sanal yazıcısı ekleniyor..." -ForegroundColor Cyan

        # 1. Spool Klasörü ve Dosyası
        $spoolDir = Join-Path $env:LOCALAPPDATA "PrintToUDF"
        if (-not (Test-Path $spoolDir)) {
            New-Item -ItemType Directory -Path $spoolDir -Force | Out-Null
        }
        $spoolFile = Join-Path $spoolDir "spool.pdf"
        if (-not (Test-Path $spoolFile)) {
            [System.IO.File]::WriteAllBytes($spoolFile, @())
        }

        # 2. Windows Printer Port
        try {
            if (-not (Get-PrinterPort -Name $spoolFile -ErrorAction SilentlyContinue)) {
                Add-PrinterPort -Name $spoolFile -ErrorAction Stop
                Write-Host "  [+] Yazıcı portu oluşturuldu: $spoolFile" -ForegroundColor Green
            }
        } catch {
            Write-Host "  [i] Port bilgisi: $_" -ForegroundColor DarkGray
        }

        # 3. Windows Virtual Printer Aygıtı
        try {
            $existingPrinter = Get-Printer -Name "UYAP'a Yazdır (Print to UDF)" -ErrorAction SilentlyContinue
            if (-not $existingPrinter) {
                Add-Printer -Name "UYAP'a Yazdır (Print to UDF)" -DriverName "Microsoft Print To PDF" -PortName $spoolFile -ErrorAction Stop
                Write-Host "  [+] 'UYAP'a Yazdır (Print to UDF)' sistem yazıcılarına eklendi!" -ForegroundColor Green
            } else {
                Write-Host "  [+] Sanal yazıcı zaten sistemde mevcut ve aktif." -ForegroundColor Green
            }
        } catch {
            Write-Host "  [!] Yazıcı ekleme uyarısı: $_" -ForegroundColor DarkGray
        }

        # 4. Arka Plan Yazdırma İzleyicisi (Python varsa Pythonw, yoksa PowerShell Watcher)
        $startupDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
        if (Test-Path $startupDir) {
            $vbsPath = Join-Path $startupDir "PrintToUDF_Watcher.vbs"
            $watcherPs1 = Join-Path $targetDir "PrintToUDF_Watcher.ps1"

            if ($pyExeObj -and (Test-Path $pyScript)) {
                $vbsContent = "CreateObject(`"Wscript.Shell`").Run `"`"`"$($pyExeObj.Source)`"`" `"`"$pyScript`"`" --daemon`", 0, False`r`n"
            } else {
                $vbsContent = "CreateObject(`"Wscript.Shell`").Run `"powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File `"`"$watcherPs1`"`" -TargetDir `"`"$targetDir`"`" `", 0, False`r`n"
            }
            Set-Content -Path $vbsPath -Value $vbsContent -Encoding Ascii
            Write-Host "  [+] Windows Başlangıcına eklendi (Sessiz servis): $vbsPath" -ForegroundColor Green
        }
    } else {
        Write-Host "  [i] Sanal yazıcı kurulumu için Yönetici hakları gerekir." -ForegroundColor Gray
        Write-Host "      Tüm diğer özellikler (Sağ Tık, Masaüstü Editör, CLI, SendTo) başarıyla kuruldu." -ForegroundColor Green
        Write-Host "      'UYAP'a Yazdır' sanal yazıcısını da eklemek isterseniz PowerShell'i 'Yönetici Olarak Çalıştır'ıp" -ForegroundColor Yellow
        Write-Host "      .\install.ps1 komutunu tekrar çalıştırabilirsiniz." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "   KURULUM BAŞARIYLA TAMAMLANDI!" -ForegroundColor White -BackgroundColor DarkGreen
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host " • Masaüstündeki 'UYAP Kelime İşlemci' simgesine tıklayarak editörü açabilirsiniz." -ForegroundColor White
Write-Host " • Herhangi bir PDF, DOCX, Markdown veya Metin dosyasına SAĞ TIKLAYIP 'UDF'e Dönüştür' seçebilirsiniz." -ForegroundColor White
Write-Host " • Terminalden doğrudan şu komutları kullanabilirsiniz:" -ForegroundColor White
Write-Host "     udf dosya.pdf                (PDF'i UDF'e çevirir)" -ForegroundColor Cyan
Write-Host "     udf --to-md karar.udf        (UDF'i Markdown'a çevirir)" -ForegroundColor Cyan
Write-Host "     udf --serve 8080             (Yerel Web & REST API sunucusunu başlatır)" -ForegroundColor Cyan
Write-Host "     udf --gui                    (Masaüstü Grafik Arayüzünü açar)" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host ""

