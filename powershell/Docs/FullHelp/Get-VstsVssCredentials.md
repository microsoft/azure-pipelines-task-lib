# Get-VstsVssCredentials
[table of contents](../Commands.md#toc) | [brief](../Commands.md#get-vstsvsscredentials)
```
NAME
    Get-VstsVssCredentials

SYNOPSIS
    Gets a credentials object that can be used with the REST SDK.

SYNTAX
    Get-VstsVssCredentials [<CommonParameters>]

DESCRIPTION
    The agent job token is used to construct the credentials object. The identity associated with the token
    depends on the scope selected in the build/release definition (either the project collection
    build/release service identity, or the project service build/release identity).

PARAMETERS
    <CommonParameters>
        This cmdlet supports the common parameters: Verbose, Debug,
        ErrorAction, ErrorVariable, WarningAction, WarningVariable,
        OutBuffer, PipelineVariable, and OutVariable. For more information, see
        about_CommonParameters (http://go.microsoft.com/fwlink/?LinkID=113216).

INPUTS

OUTPUTS

    -------------------------- EXAMPLE 1 --------------------------

    PS C:\>$vssCredentials = Get-VstsVssCredentials

    Add-Type -LiteralPath (Assert-Path "$(Get-TaskVariable -Name 'Agent.ServerOMDirectory'
    -Require)\Microsoft.TeamFoundation.Common.dll" -PassThru)
    Add-Type -LiteralPath (Assert-Path "$(Get-TaskVariable -Name 'Agent.ServerOMDirectory'
    -Require)\Microsoft.VisualStudio.Services.WebApi.dll" -PassThru)
    # This is a bad example. All of the Server OM DLLs should be in one folder.
    Add-Type -LiteralPath (Assert-Path "$(Get-TaskVariable -Name 'Agent.ServerOMDirectory' -Require)\Modules\M
    icrosoft.TeamFoundation.DistributedTask.Task.Internal\Microsoft.TeamFoundation.Core.WebApi.dll" -PassThru)
    $projectHttpClient = New-Object Microsoft.TeamFoundation.Core.WebApi.ProjectHttpClient(
        (New-Object System.Uri($env:SYSTEM_TEAMFOUNDATIONCOLLECTIONURI)),
        $vssCredentials)
    $projectHttpClient.GetProjects().Result
```
