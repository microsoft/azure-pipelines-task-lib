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
Add-Type -LiteralPath (Assert-VstsPath "$(Get-VstsTaskVariable -Name 'Agent.ServerOMDirectory' -Require)\Microsoft.TeamFoundation.Core.WebApi.dll" -PassThru)
$projectHttpClient = New-Object Microsoft.TeamFoundation.Core.WebApi.ProjectHttpClient(
    (New-Object System.Uri((Get-VstsTaskVariable -Name System.TeamFoundationCollectionUri -Require))),
    $vssCredentials)
$projectHttpClient.GetProjects().GetAwaiter().GetResult()
#>
function Get-VssCredentials {
    [CmdletBinding()]
    param()

    $endpoint = (Get-Endpoint -Name SystemVssConnection -Require)
    Add-Type -LiteralPath (Assert-Path "$(Get-TaskVariable -Name 'Agent.ServerOMDirectory' -Require)\Microsoft.VisualStudio.Services.Common.dll" -PassThru)
    try {
        Add-Type -LiteralPath (Assert-Path "$(Get-TaskVariable -Name 'Agent.ServerOMDirectory' -Require)\Microsoft.VisualStudio.Services.Client.dll" -PassThru)
    } catch [System.Reflection.ReflectionTypeLoadException] {
        if ($_.Exception.LoaderExceptions.Count -eq 1 -and
            $_.Exception.LoaderExceptions[0] -is [System.IO.FileNotFoundException] -and
            $_.Exception.LoaderExceptions[0].FileName -eq 'Microsoft.ServiceBus, Version=2.5.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35') {

            # TODO: Consider bundling Microsoft.ServiceBus.dll with the lib (approx 3.75mb).

            # The 1.x Windows agent did not layout Microsoft.ServiceBus.dll. Fallback to
            # the old way of authenticating. For on-premises TFS, this appears to 401 when
            # attempting to use the "WRAP access_token" and falls back to NTLM.
            return New-Object Microsoft.VisualStudio.Services.Common.VssCredentials(
                (New-Object Microsoft.VisualStudio.Services.Common.WindowsCredential($true)), # Use default credentials.
                (New-Object Microsoft.VisualStudio.Services.Common.VssServiceIdentityCredential(New-Object Microsoft.VisualStudio.Services.Common.VssServiceIdentityToken([string]$endpoint.auth.parameters.AccessToken))),
                [Microsoft.VisualStudio.Services.Common.CredentialPromptType]::DoNotPrompt)
        }

        throw # Rethrow.
    }

    return New-Object Microsoft.VisualStudio.Services.Common.VssCredentials(
        (New-Object Microsoft.VisualStudio.Services.Common.WindowsCredential($false)), # Do not use default credentials.
        (New-Object Microsoft.VisualStudio.Services.Client.VssOAuthCredential($endpoint.auth.parameters.AccessToken)),
        [Microsoft.VisualStudio.Services.Common.CredentialPromptType]::DoNotPrompt)
}