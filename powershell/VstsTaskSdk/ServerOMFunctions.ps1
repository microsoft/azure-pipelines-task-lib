function Get-TfsClientCredentials {
    [CmdletBinding()]
    param()

    Add-Type -LiteralPath (Assert-Path "$(Get-TaskVariable -Name 'Agent.ServerOMDirectory' -Require)\Microsoft.TeamFoundation.Client.dll" -PassThru)
    $endpoint = (Get-Endpoint -Name SystemVssConnection -Require)
    New-Object Microsoft.TeamFoundation.Client.OAuthTokenCredential([string]$endpoint.auth.parameters.AccessToken)
<#
Example:
    $serverOMDirectory = Get-VstsTaskVariable -Name 'Agent.ServerOMDirectory' -Require
    Add-Type -LiteralPath ([System.IO.Path]::Combine($serverOMDirectory, 'Microsoft.TeamFoundation.Client.dll'))
    Add-Type -LiteralPath ([System.IO.Path]::Combine($serverOMDirectory, 'Microsoft.TeamFoundation.Common.dll'))
    Add-Type -LiteralPath ([System.IO.Path]::Combine($serverOMDirectory, 'Microsoft.TeamFoundation.VersionControl.Client.dll'))
    $tfsTeamProjectCollection = New-Object Microsoft.TeamFoundation.Client.TfsTeamProjectCollection(
        (Get-VstsTaskVariable -Name 'System.TeamFoundationCollectionUri' -Require),
        (Get-VstsTfsClientCredentials))
    $versionControlServer = $tfsTeamProjectCollection.GetService([Microsoft.TeamFoundation.VersionControl.Client.VersionControlServer])
    $versionControlServer.GetItems('$/*').Items | Format-List
#>
}

function Get-VssCredentials {
    [CmdletBinding()]
    param()

    Add-Type -LiteralPath (Assert-Path "$(Get-TaskVariable -Name 'Agent.ServerOMDirectory' -Require)\Microsoft.VisualStudio.Services.Common.dll" -PassThru)
    $endpoint = (Get-Endpoint -Name SystemVssConnection -Require)
    New-Object Microsoft.VisualStudio.Services.Common.VssServiceIdentityCredential(
        New-Object Microsoft.VisualStudio.Services.Common.VssServiceIdentityToken([string]$endpoint.auth.parameters.AccessToken))

<#
Example:
    $vssCredentials = Get-VstsVssCredentials
    Add-Type -LiteralPath (Assert-Path "$(Get-TaskVariable -Name 'Agent.ServerOMDirectory' -Require)\Microsoft.TeamFoundation.Common.dll" -PassThru)
    Add-Type -LiteralPath (Assert-Path "$(Get-TaskVariable -Name 'Agent.ServerOMDirectory' -Require)\Microsoft.VisualStudio.Services.WebApi.dll" -PassThru)
    # This is a bad example. All of the Server OM DLLs should be in one folder.
    Add-Type -LiteralPath (Assert-Path "$(Get-TaskVariable -Name 'Agent.ServerOMDirectory' -Require)\Modules\Microsoft.TeamFoundation.DistributedTask.Task.Internal\Microsoft.TeamFoundation.Core.WebApi.dll" -PassThru)
    $projectHttpClient = New-Object Microsoft.TeamFoundation.Core.WebApi.ProjectHttpClient(
        (New-Object System.Uri($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)),
        $vssCredentials)
    $projectHttpClient.GetProjects().Result
#>
}