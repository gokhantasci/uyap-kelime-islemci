<#
.SYNOPSIS
    Print to UDF - Bağımsız Windows Yazıcı İzleyicisi (Python Bağımsız / Fallback Watcher)
.DESCRIPTION
    "UYAP'a Yazdır (Print to UDF)" sanal yazıcısından gelen yazdırma işlerini arka planda
    sessizce yakalar.
    - Sistemde veya klasörde Python varsa: print_to_udf.py üzerinden tam otomatik UDF'e çevirir.
    - Python kurulu değilse: Belgeyi Kullanıcı Belgelerim/UYAP_Yazdirilan klasörüne PDF olarak
      kaydeder ve udf.657.com.tr (veya yerel editörü) tarayıcıda açarak kullanıcının anında
      açıp UDF olarak indirebilmesini sağlar.
#>

param(
    [string]$TargetDir = ""
)

if (-not $TargetDir) {
    $TargetDir = $PSScriptRoot
}
if (-not $TargetDir) {
    $TargetDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$spoolDir = Join-Path $env:LOCALAPPDATA "PrintToUDF"
if (-not (Test-Path $spoolDir)) {
    New-Item -ItemType Directory -Path $spoolDir -Force | Out-Null
}
$spoolFile = Join-Path $spoolDir "spool.pdf"
if (-not (Test-Path $spoolFile)) {
    [System.IO.File]::WriteAllBytes($spoolFile, @())
}

$lastSize = 0
$lastMtime = [DateTime]::MinValue

while ($true) {
    try {
        if (Test-Path $spoolFile) {
            $item = Get-Item $spoolFile -ErrorAction SilentlyContinue
            if ($item) {
                $size = $item.Length
                $mtime = $item.LastWriteTime

                if ($size -gt 500 -and ($size -ne $lastSize -or $mtime -ne $lastMtime)) {
                    # Yazdırma işleminin (spooling) tamamlanması için bekle
                    Start-Sleep -Milliseconds 700

                    # 1. Python kontrolü (Sistem, pythonw veya python-embed)
                    $pythonExe = $null
                    $pyEmbed = Join-Path $TargetDir "python-embed\python.exe"
                    $pyScript = Join-Path $TargetDir "print_to_udf.py"

                    if (Test-Path $pyEmbed) {
                        $pythonExe = $pyEmbed
                    } elseif (Get-Command "pythonw.exe" -ErrorAction SilentlyContinue) {
                        $pythonExe = (Get-Command "pythonw.exe").Source
                    } elseif (Get-Command "python.exe" -ErrorAction SilentlyContinue) {
                        $pythonExe = (Get-Command "python.exe").Source
                    } elseif (Get-Command "py.exe" -ErrorAction SilentlyContinue) {
                        $pythonExe = (Get-Command "py.exe").Source
                    }

                    if ($pythonExe -and (Test-Path $pyScript)) {
                        # Python mevcut: Tam otomatik yerel UDF dönüştürücüyü çalıştır
                        Start-Process -FilePath $pythonExe -ArgumentList "`"$pyScript`"", "`"$spoolFile`"" -WindowStyle Hidden
                    } else {
                        # Python kurulu değil: Yerel Windows Fallback mekanizması
                        Add-Type -AssemblyName System.Windows.Forms
                        Add-Type -AssemblyName System.Drawing

                        $docsDir = [Environment]::GetFolderPath("MyDocuments")
                        $outputDir = Join-Path $docsDir "UYAP_Yazdirilan"
                        if (-not (Test-Path $outputDir)) {
                            New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
                        }

                        $timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
                        $targetPdf = Join-Path $outputDir "Yazdirilan_Belge_$timestamp.pdf"
                        Copy-Item -LiteralPath $spoolFile -Destination $targetPdf -Force

                        # Yerel index.html varsa onu, yoksa canlı web editörünü aç
                        $localIndex = Join-Path $TargetDir "index.html"
                        if (Test-Path $localIndex) {
                            Start-Process $localIndex
                        } else {
                            Start-Process "https://udf.657.com.tr/?welcome=0"
                        }

                        # Kullanıcıya bilgilendirme bildirimi göster
                        $notifyMsg = "UYAP'a Yazdır: Yazdırma işlemi başarıyla yakalandı!`n`nDosya kaydedildi:`n$targetPdf`n`nUYAP Web Editörü tarayıcınızda açıldı. Belgeyi ekrana sürükleyip bırakarak görüntüleyebilir veya UDF olarak kaydedebilirsiniz."
                        [System.Windows.Forms.MessageBox]::Show($notifyMsg, "UYAP'a Yazdır (Print to UDF)", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
                    }

                    # Dosya durumunu güncelle
                    $item = Get-Item $spoolFile -ErrorAction SilentlyContinue
                    if ($item) {
                        $lastSize = $item.Length
                        $lastMtime = $item.LastWriteTime
                    }
                }
            }
        }
        Start-Sleep -Seconds 1
    } catch {
        Start-Sleep -Seconds 2
    }
}

