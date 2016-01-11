[CmdletBinding()]
param(
    [ValidateNotNull()]
    [Parameter()]
    [hashtable]$ModuleParameters = @{ })

if ($host.Name -ne 'ConsoleHost') {
    Write-Warning "VstsTaskSdk is designed for use with powershell.exe (ConsoleHost). Output may be different when used with other hosts."
}

# Private module variables.
[bool]$script:nonInteractive = "$($ModuleParameters['NonInteractive'])" -eq 'true'
Write-Verbose "NonInteractive: $script:nonInteractive"

# Import/export functions.
. "$PSScriptRoot\InputFunctions.ps1"
. "$PSScriptRoot\LegacyFindFunctions.ps1"
. "$PSScriptRoot\LocalizationFunctions.ps1"
. "$PSScriptRoot\LoggingCommandFunctions.ps1"
. "$PSScriptRoot\LongPathFunctions.ps1"
. "$PSScriptRoot\ServerOMFunctions.ps1"
. "$PSScriptRoot\ToolFunctions.ps1"
. "$PSScriptRoot\TraceFunctions.ps1"
. "$PSScriptRoot\OutFunctions.ps1" # Load the out functions after all of the other functions are loaded.
Export-ModuleMember -Function @(
        # Find functions.
        'Find-Files'
        # Input functions.
        'Get-Endpoint'
        'Get-Input'
        'Get-TaskVariable'
        'Set-TaskVariable'
        # Localization functions.
        'Get-LocString'
        'Import-LocStrings'
        # Logging command functions.
        'Write-AddAttachment'
        'Write-AssociateArtifact'
        'Write-LogDetail'
        'Write-SetProgress'
        'Write-SetResult'
        'Write-SetVariable'
        'Write-TaskDebug'
        'Write-TaskError'
        'Write-TaskVerbose'
        'Write-TaskWarning'
        'Write-UpdateBuildNumber'
        'Write-UploadArtifact'
        'Write-UploadBuildLog'
        # Out functions.
        'Out-Default'
        # Server OM functions.
        'Get-TfsClientCredentials'
        'Get-VssCredentials'
        # Tool functions.
        'Assert-Path'
        'Invoke-TaskScript'
        'Invoke-Tool'
        # Trace functions.
        'Trace-EnteringInvocation'
        'Trace-LeavingInvocation'
        'Trace-Path'
    )

# Special internal exception type to control the flow. Not currently intended
# for public usage and subject to change. If the type has already
# been loaded once, then it is not loaded again.
Write-Verbose "Adding exceptions types."
Add-Type -WarningAction SilentlyContinue -Debug:$false -TypeDefinition @'
namespace VstsTaskSdk
{
    public class TerminationException : System.Exception
    {
        public TerminationException(System.String message) : base(message) { }
    }
}
'@

$null = New-Item -Force -Path "function:\global:Out-Default" -Value (Get-Command -CommandType Function -Name Out-Default -ListImported)
New-Alias -Name Out-Default -Value "global:Out-Default" -Scope global

# Load the SDK resource strings.
Merge-Pipelines -ScriptBlock ([scriptblock]::Create("Import-LocStrings `"$PSScriptRoot\lib.json`"")) -DoNotSetErrorActionPreference
