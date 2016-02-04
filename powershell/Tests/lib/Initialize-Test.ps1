[CmdletBinding()]
param()

Write-Verbose "Initializing test helpers."
$ErrorActionPreference = 'Stop'
$PSModuleAutoloadingPreference = 'None'
Write-Verbose "Importing module: Microsoft.PowerShell.Management"
Import-Module 'Microsoft.PowerShell.Management' -Verbose:$false
Write-Verbose "Importing module: TestHelpersModule"
Import-Module $PSScriptRoot\TestHelpersModule -Verbose:$false
Write-Verbose "Importing module: VstsTaskSdk"
Import-Module $PSScriptRoot\..\..\VstsTaskSdk\VstsTaskSdk.psd1 -ArgumentList @{ NonInteractive = $true } -Verbose:$false