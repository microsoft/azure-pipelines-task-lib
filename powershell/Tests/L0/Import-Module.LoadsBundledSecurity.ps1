[CmdletBinding()]
param()

. $PSScriptRoot\..\lib\Initialize-Test.ps1

# Import in fresh processes because the standard test initializer preloads Security.
$executable = if ($PSVersionTable.PSEdition -eq 'Core') {
    if ($env:OS -eq 'Windows_NT') { Join-Path $PSHOME 'pwsh.exe' } else { Join-Path $PSHOME 'pwsh' }
} else {
    Join-Path $PSHOME 'powershell.exe'
}
$sdkPath = Join-Path (Get-Module VstsTaskSdk).ModuleBase 'VstsTaskSdk.psd1'
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ([guid]::NewGuid().ToString())
$shadowModule = Join-Path $tempRoot 'Microsoft.PowerShell.Security'
$null = New-Item -ItemType Directory -Path $shadowModule -Force
Set-Content -LiteralPath (Join-Path $shadowModule 'Microsoft.PowerShell.Security.psd1') -Value @"
@{ ModuleVersion = '1.0'; RootModule = 'Security.psm1' }
"@
Set-Content -LiteralPath (Join-Path $shadowModule 'Security.psm1') -Value @'
throw 'The shadow security module must not be imported.'
'@

$childScript = @'
param($sdkPath, $shadowPath, $preload)
$ErrorActionPreference = 'Stop'
$PSModuleAutoloadingPreference = 'None'
try {
    Import-Module Microsoft.PowerShell.Management
    Import-Module Microsoft.PowerShell.Utility
    $bundledModule = Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1'
    if ($preload) {
        Import-Module -Name $bundledModule
    } else {
        Remove-Module Microsoft.PowerShell.Security -ErrorAction SilentlyContinue
    }
    $env:PSModulePath = $shadowPath + [System.IO.Path]::PathSeparator + $env:PSModulePath
    Import-Module -Name $sdkPath -ArgumentList @{ NonInteractive = $true }
    $sdk = Get-Module VstsTaskSdk
    $loadedPath = & $sdk { (Get-Module Microsoft.PowerShell.Security).Path }
    if ($loadedPath -ne $bundledModule) {
        throw "Expected bundled Security module, got '$loadedPath'."
    }
    & $sdk {
        $secure = ConvertTo-SecureString -String 'test secret' -AsPlainText -Force
        if ($secure.Length -ne 11) { throw 'SecureString conversion failed.' }
    }
    [Console]::WriteLine('BUNDLED_SECURITY_LOADED')
    exit 0
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
'@

try {
    foreach ($preload in @('$false', '$true')) {
        $command = "& { $childScript } '$($sdkPath.Replace("'", "''"))' '$($tempRoot.Replace("'", "''"))' $preload"
        $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($command))
        $output = & $executable -NoLogo -NoProfile -NonInteractive -EncodedCommand $encoded 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "SDK import failed (preload=$preload): $($output -join [Environment]::NewLine)"
        }
        Assert-AreEqual 'BUNDLED_SECURITY_LOADED' ($output -join [Environment]::NewLine)
    }
} finally {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
}
