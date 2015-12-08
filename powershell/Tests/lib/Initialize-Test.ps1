[CmdletBinding()]
param()

Write-Verbose "Initializing test helpers."
$PSModuleAutoloadingPreference = 'None'
if (!(Get-Module | Where-Object { $_.Name -eq 'Microsoft.PowerShell.Management' })) {
    Write-Verbose "Importing module: Microsoft.PowerShell.Management"
    Import-Module 'Microsoft.PowerShell.Management' -Verbose:$false
}

Import-Module $PSScriptRoot\TestHelpersModule -Verbose:$false
Import-Module $PSScriptRoot\..\..\VstsTaskSdk\VstsTaskSdk.psd1 -ArgumentList @{ NonInteractive = $true } -Verbose:$false
