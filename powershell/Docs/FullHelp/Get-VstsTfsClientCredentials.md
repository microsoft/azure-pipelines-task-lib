# Get-VstsTfsClientCredentials
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vststfsclientcredentials)
```
NAME
    Get-VstsTfsClientCredentials

SYNOPSIS
    Gets a credentials object that can be used with the TFS extended client SDK.

SYNTAX
    Get-VstsTfsClientCredentials [<CommonParameters>]

DESCRIPTION
    The agent job token is used to construct the credentials object. The identity associated with the token
    depends on the scope selected in the build/release definition (either the project collection
    build/release service identity, or the project build/release service identity).

PARAMETERS
    <CommonParameters>
        This cmdlet supports the common parameters: Verbose, Debug,
        ErrorAction, ErrorVariable, WarningAction, WarningVariable,
        OutBuffer, PipelineVariable, and OutVariable. For more information, see
        about_CommonParameters (https://go.microsoft.com/fwlink/?LinkID=113216).

    -------------------------- EXAMPLE 1 --------------------------

    PS C:\>$serverOMDirectory = Get-VstsTaskVariable -Name 'Agent.ServerOMDirectory' -Require

    Add-Type -LiteralPath ([System.IO.Path]::Combine($serverOMDirectory,
    'Microsoft.TeamFoundation.Client.dll'))
    Add-Type -LiteralPath ([System.IO.Path]::Combine($serverOMDirectory,
    'Microsoft.TeamFoundation.Common.dll'))
    Add-Type -LiteralPath ([System.IO.Path]::Combine($serverOMDirectory,
    'Microsoft.TeamFoundation.VersionControl.Client.dll'))
    $tfsTeamProjectCollection = New-Object Microsoft.TeamFoundation.Client.TfsTeamProjectCollection(
        (Get-VstsTaskVariable -Name 'System.TeamFoundationCollectionUri' -Require),
        (Get-VstsTfsClientCredentials))
    $versionControlServer = $tfsTeamProjectCollection.GetService([Microsoft.TeamFoundation.VersionControl.Clie
    nt.VersionControlServer])
    $versionControlServer.GetItems('$/*').Items | Format-List
```
