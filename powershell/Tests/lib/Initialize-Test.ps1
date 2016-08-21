[CmdletBinding()]
param()

Write-Verbose "Initializing test helpers."
$ErrorActionPreference = 'Stop'
$PSModuleAutoloadingPreference = 'None'

Write-Verbose "Importing module: Microsoft.PowerShell.Management"
Import-Module 'Microsoft.PowerShell.Management' -Verbose:$false

Write-Verbose "Importing module: Microsoft.PowerShell.Utility"
Import-Module 'Microsoft.PowerShell.Utility' -Verbose:$false

Write-Verbose "Importing module: Microsoft.PowerShell.Security"
Import-Module 'Microsoft.PowerShell.Security' -Verbose:$false

Write-Verbose "Importing module: TestHelpersModule"
Import-Module $PSScriptRoot\TestHelpersModule -Verbose:$false

Write-Verbose "Importing module: VstsTaskSdk"
Import-Module $PSScriptRoot\..\..\_build\VstsTaskSdk\VstsTaskSdk.psd1 -ArgumentList @{ NonInteractive = $true } -Verbose:$false