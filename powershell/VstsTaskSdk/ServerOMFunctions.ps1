<#
.SYNOPSIS
Gets a credentials object that can be used with the TFS extended client SDK.

.DESCRIPTION
The agent job token is used to construct the credentials object. The identity associated with the token depends on the scope selected in the build/release definition (either the project collection build/release service identity, or the project build/release service identity).

.EXAMPLE
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
function Get-TfsClientCredentials {
    [CmdletBinding()]
    param()

    Add-Type -LiteralPath (Assert-Path "$(Get-TaskVariable -Name 'Agent.ServerOMDirectory' -Require)\Microsoft.TeamFoundation.Client.dll" -PassThru)
    $endpoint = (Get-Endpoint -Name SystemVssConnection -Require)
    $credentials = New-Object Microsoft.TeamFoundation.Client.TfsClientCredentials($false) # Do not use default credentials.
    $credentials.AllowInteractive = $false
    $credentials.Federated = New-Object Microsoft.TeamFoundation.Client.OAuthTokenCredential([string]$endpoint.auth.parameters.AccessToken)
    $credentials
}

<#
.SYNOPSIS
Gets a credentials object that can be used with the REST SDK.

.DESCRIPTION
The agent job token is used to construct the credentials object. The identity associated with the token depends on the scope selected in the build/release definition (either the project collection build/release service identity, or the project service build/release identity).

.EXAMPLE
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
function Get-VssCredentials {
    [CmdletBinding()]
    param()

    Add-Type -LiteralPath (Assert-Path "$(Get-TaskVariable -Name 'Agent.ServerOMDirectory' -Require)\Microsoft.VisualStudio.Services.Common.dll" -PassThru)
    $endpoint = (Get-Endpoint -Name SystemVssConnection -Require)
    New-Object Microsoft.VisualStudio.Services.Common.VssServiceIdentityCredential(
        New-Object Microsoft.VisualStudio.Services.Common.VssServiceIdentityToken([string]$endpoint.auth.parameters.AccessToken))
}