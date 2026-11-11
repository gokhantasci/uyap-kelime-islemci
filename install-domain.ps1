<# GPO kullanıcı oturum açma betiği veya tek tıkla kullanıcı kurulumu.
   .\install-domain.ps1 -SourcePath '\\SUNUCU\Yazilim\UYAP-Web' [-PrinterConnection '\\SUNUCU\YAZICI']
   Yerel sanal yazıcı sürücüsü için kurumun yönetici/sürücü politikaları geçerlidir. #>
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$SourcePath,
    [string]$PrinterConnection = '',
    [switch]$InstallLocalPrinter
)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $SourcePath).Path
if (-not (Test-Path -LiteralPath (Join-Path $source 'index.html'))) { throw 'Kaynak dizinde index.html yok.' }
$target = Join-Path $env:LOCALAPPDATA 'UYAP-Kelime-Islemci'
New-Item -ItemType Directory -Path $target -Force | Out-Null
foreach ($name in @('index.html','assets','print_to_udf.py','dictionary_api.py','open_in_editor.py','install.ps1','uninstall.ps1')) {
    $item = Join-Path $source $name
    if (-not (Test-Path -LiteralPath $item)) { throw "Eksik kurulum bileşeni: $name" }
    Copy-Item -LiteralPath $item -Destination $target -Recurse -Force
}
& (Join-Path $target 'install.ps1') -NoPrinter:(-not $InstallLocalPrinter)
if ($PrinterConnection) {
    if ($PrinterConnection -notmatch '^\\\\[^\\]+\\[^\\]+$') { throw 'Yazıcı yolu \\SUNUCU\PAYLASIM biçiminde olmalı.' }
    if (-not (Get-Printer -Name $PrinterConnection -ErrorAction SilentlyContinue)) {
        Add-Printer -ConnectionName $PrinterConnection -ErrorAction Stop
    }
}
Write-Host 'Web editör ve UDF sağ tık menüsü bu kullanıcı için hazır.'
