# Commands (v0.6.4)
## <a name="toc" />Table of Contents
 * [Find](#find)
  * [Find-VstsFiles](#find-vstsfiles)
 * [Input](#input)
  * [Get-VstsEndpoint](#get-vstsendpoint)
  * [Get-VstsInput](#get-vstsinput)
  * [Get-VstsTaskVariable](#get-vststaskvariable)
  * [Set-VstsTaskVariable](#set-vststaskvariable)
 * [Localization](#localization)
  * [Get-VstsLocString](#get-vstslocstring)
  * [Import-VstsLocStrings](#import-vstslocstrings)
 * [Logging Command](#loggingcommand)
  * [Write-VstsAddAttachment](#write-vstsaddattachment)
  * [Write-VstsAddBuildTag](#write-vstsaddbuildtag)
  * [Write-VstsAssociateArtifact](#write-vstsassociateartifact)
  * [Write-VstsLogDetail](#write-vstslogdetail)
  * [Write-VstsSetProgress](#write-vstssetprogress)
  * [Write-VstsSetResult](#write-vstssetresult)
  * [Write-VstsSetSecret](#write-vstssetsecret)
  * [Write-VstsSetVariable](#write-vstssetvariable)
  * [Write-VstsTaskDebug](#write-vststaskdebug)
  * [Write-VstsTaskError](#write-vststaskerror)
  * [Write-VstsTaskVerbose](#write-vststaskverbose)
  * [Write-VstsTaskWarning](#write-vststaskwarning)
  * [Write-VstsUpdateBuildNumber](#write-vstsupdatebuildnumber)
  * [Write-VstsUploadArtifact](#write-vstsuploadartifact)
  * [Write-VstsUploadBuildLog](#write-vstsuploadbuildlog)
 * [Server OM](#serverom)
  * [Get-VstsTfsClientCredentials](#get-vststfsclientcredentials)
  * [Get-VstsVssCredentials](#get-vstsvsscredentials)
 * [Tool](#tool)
  * [Assert-VstsPath](#assert-vstspath)
  * [Invoke-VstsTool](#invoke-vststool)
 * [Trace](#trace)
  * [Trace-VstsEnteringInvocation](#trace-vstsenteringinvocation)
  * [Trace-VstsLeavingInvocation](#trace-vstsleavinginvocation)
  * [Trace-VstsPath](#trace-vstspath)

## <a name="find" />Find
### <a name="find-vstsfiles" />Find-VstsFiles
[table of contents](#toc) | [full](FullHelp/Find-VstsFiles.md)
```
NAME
    Find-VstsFiles

SYNOPSIS
    Finds files or directories.

SYNTAX
    Find-VstsFiles [[-LiteralDirectory] <String>] [-LegacyPattern] <String> [-IncludeFiles]
    [-IncludeDirectories] [-Force] [<CommonParameters>]

DESCRIPTION
    Finds files or directories using advanced pattern matching.
```
## <a name="input" />Input
### <a name="get-vstsendpoint" />Get-VstsEndpoint
[table of contents](#toc) | [full](FullHelp/Get-VstsEndpoint.md)
```
NAME
    Get-VstsEndpoint

SYNOPSIS
    Gets an endpoint.

SYNTAX
    Get-VstsEndpoint [-Name] <String> [-Require] [<CommonParameters>]

DESCRIPTION
    Gets an endpoint object for the specified endpoint name. The endpoint is returned as an object with three
    properties: Auth, Data, and Url.

    The Data property requires a 1.97 agent or higher.
```
### <a name="get-vstsinput" />Get-VstsInput
[table of contents](#toc) | [full](FullHelp/Get-VstsInput.md)
```
NAME
    Get-VstsInput

SYNOPSIS
    Gets an input.

SYNTAX
    Get-VstsInput -Name <String> [-Require] [-AsBool] [-AsInt] [<CommonParameters>]

    Get-VstsInput -Name <String> [-Default <Object>] [-AsBool] [-AsInt] [<CommonParameters>]

DESCRIPTION
    Gets the value for the specified input name.
```
### <a name="get-vststaskvariable" />Get-VstsTaskVariable
[table of contents](#toc) | [full](FullHelp/Get-VstsTaskVariable.md)
```
NAME
    Get-VstsTaskVariable

SYNOPSIS
    Gets a task variable.

SYNTAX
    Get-VstsTaskVariable -Name <String> [-Require] [-AsBool] [-AsInt] [<CommonParameters>]

    Get-VstsTaskVariable -Name <String> [-Default <Object>] [-AsBool] [-AsInt] [<CommonParameters>]

DESCRIPTION
    Gets the value for the specified task variable.
```
### <a name="set-vststaskvariable" />Set-VstsTaskVariable
[table of contents](#toc) | [full](FullHelp/Set-VstsTaskVariable.md)
```
NAME
    Set-VstsTaskVariable

SYNOPSIS
    Sets a task variable.

SYNTAX
    Set-VstsTaskVariable [-Name] <String> [[-Value] <String>] [-Secret] [<CommonParameters>]

DESCRIPTION
    Sets a task variable in the current task context as well as in the current job context. This allows the
    task variable to retrieved by subsequent tasks within the same job.
```
## <a name="localization" />Localization
### <a name="get-vstslocstring" />Get-VstsLocString
[table of contents](#toc) | [full](FullHelp/Get-VstsLocString.md)
```
NAME
    Get-VstsLocString

SYNOPSIS
    Gets a localized resource string.

SYNTAX
    Get-VstsLocString [-Key] <String> [[-ArgumentList] <Object[]>] [<CommonParameters>]

DESCRIPTION
    Gets a localized resource string and optionally formats the string with arguments.

    If the format fails (due to a bad format string or incorrect expected arguments in the format string),
    then the format string is returned followed by each of the arguments (delimited by a space).

    If the lookup key is not found, then the lookup key is returned followed by each of the arguments
    (delimited by a space).
```
### <a name="import-vstslocstrings" />Import-VstsLocStrings
[table of contents](#toc) | [full](FullHelp/Import-VstsLocStrings.md)
```
NAME
    Import-VstsLocStrings

SYNOPSIS
    Imports resource strings for use with Get-VstsLocString.

SYNTAX
    Import-VstsLocStrings [-LiteralPath] <String> [<CommonParameters>]

DESCRIPTION
    Imports resource strings for use with Get-VstsLocString. The imported strings are stored in an internal
    resource string dictionary. Optionally, if a separate resource file for the current culture exists, then
    the localized strings from that file then imported (overlaid) into the same internal resource string
    dictionary.

    Resource strings from the SDK are prefixed with "PSLIB_". This prefix should be avoided for custom
    resource strings.
```
## <a name="loggingcommand" />Logging Command
### <a name="write-vstsaddattachment" />Write-VstsAddAttachment
[table of contents](#toc) | [full](FullHelp/Write-VstsAddAttachment.md)
```
NAME
    Write-VstsAddAttachment

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsAddAttachment [-Type] <String> [-Name] <String> [-Path] <String> [-AsOutput]
    [<CommonParameters>]
```
### <a name="write-vstsaddbuildtag" />Write-VstsAddBuildTag
[table of contents](#toc) | [full](FullHelp/Write-VstsAddBuildTag.md)
```
NAME
    Write-VstsAddBuildTag

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsAddBuildTag [-Value] <String> [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstsassociateartifact" />Write-VstsAssociateArtifact
[table of contents](#toc) | [full](FullHelp/Write-VstsAssociateArtifact.md)
```
NAME
    Write-VstsAssociateArtifact

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsAssociateArtifact [-Name] <String> [-Path] <String> [-Type] <String> [[-Properties]
    <Hashtable>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstslogdetail" />Write-VstsLogDetail
[table of contents](#toc) | [full](FullHelp/Write-VstsLogDetail.md)
```
NAME
    Write-VstsLogDetail

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsLogDetail [-Id] <Guid> [[-ParentId] <Object>] [[-Type] <String>] [[-Name] <String>] [[-Order]
    <Object>] [[-StartTime] <Object>] [[-FinishTime] <Object>] [[-Progress] <Object>] [[-State] <Object>]
    [[-Result] <Object>] [[-Message] <String>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstssetprogress" />Write-VstsSetProgress
[table of contents](#toc) | [full](FullHelp/Write-VstsSetProgress.md)
```
NAME
    Write-VstsSetProgress

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsSetProgress [-Percent] <Int32> [[-CurrentOperation] <String>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstssetresult" />Write-VstsSetResult
[table of contents](#toc) | [full](FullHelp/Write-VstsSetResult.md)
```
NAME
    Write-VstsSetResult

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsSetResult -Result <String> [-Message <String>] [-AsOutput] [<CommonParameters>]

    Write-VstsSetResult -Result <String> [-Message <String>] [-DoNotThrow] [<CommonParameters>]
```
### <a name="write-vstssetsecret" />Write-VstsSetSecret
[table of contents](#toc) | [full](FullHelp/Write-VstsSetSecret.md)
```
NAME
    Write-VstsSetSecret

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsSetSecret [-Value] <String> [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstssetvariable" />Write-VstsSetVariable
[table of contents](#toc) | [full](FullHelp/Write-VstsSetVariable.md)
```
NAME
    Write-VstsSetVariable

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsSetVariable [-Name] <String> [[-Value] <String>] [-Secret] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vststaskdebug" />Write-VstsTaskDebug
[table of contents](#toc) | [full](FullHelp/Write-VstsTaskDebug.md)
```
NAME
    Write-VstsTaskDebug

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsTaskDebug [[-Message] <String>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vststaskerror" />Write-VstsTaskError
[table of contents](#toc) | [full](FullHelp/Write-VstsTaskError.md)
```
NAME
    Write-VstsTaskError

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsTaskError [[-Message] <String>] [[-ErrCode] <String>] [[-SourcePath] <String>] [[-LineNumber]
    <String>] [[-ColumnNumber] <String>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vststaskverbose" />Write-VstsTaskVerbose
[table of contents](#toc) | [full](FullHelp/Write-VstsTaskVerbose.md)
```
NAME
    Write-VstsTaskVerbose

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsTaskVerbose [[-Message] <String>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vststaskwarning" />Write-VstsTaskWarning
[table of contents](#toc) | [full](FullHelp/Write-VstsTaskWarning.md)
```
NAME
    Write-VstsTaskWarning

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsTaskWarning [[-Message] <String>] [[-ErrCode] <String>] [[-SourcePath] <String>] [[-LineNumber]
    <String>] [[-ColumnNumber] <String>] [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstsupdatebuildnumber" />Write-VstsUpdateBuildNumber
[table of contents](#toc) | [full](FullHelp/Write-VstsUpdateBuildNumber.md)
```
NAME
    Write-VstsUpdateBuildNumber

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsUpdateBuildNumber [-Value] <String> [-AsOutput] [<CommonParameters>]
```
### <a name="write-vstsuploadartifact" />Write-VstsUploadArtifact
[table of contents](#toc) | [full](FullHelp/Write-VstsUploadArtifact.md)
```
NAME
    Write-VstsUploadArtifact

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsUploadArtifact [-ContainerFolder] <String> [-Name] <String> [-Path] <String> [-AsOutput]
    [<CommonParameters>]
```
### <a name="write-vstsuploadbuildlog" />Write-VstsUploadBuildLog
[table of contents](#toc) | [full](FullHelp/Write-VstsUploadBuildLog.md)
```
NAME
    Write-VstsUploadBuildLog

SYNOPSIS
    See https://github.com/Microsoft/vsts-tasks/blob/master/docs/authoring/commands.md

SYNTAX
    Write-VstsUploadBuildLog [-Path] <String> [-AsOutput] [<CommonParameters>]
```
## <a name="serverom" />Server OM
### <a name="get-vststfsclientcredentials" />Get-VstsTfsClientCredentials
[table of contents](#toc) | [full](FullHelp/Get-VstsTfsClientCredentials.md)
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
```
### <a name="get-vstsvsscredentials" />Get-VstsVssCredentials
[table of contents](#toc) | [full](FullHelp/Get-VstsVssCredentials.md)
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
```
## <a name="tool" />Tool
### <a name="assert-vstspath" />Assert-VstsPath
[table of contents](#toc) | [full](FullHelp/Assert-VstsPath.md)
```
NAME
    Assert-VstsPath

SYNOPSIS
    Asserts that a path exists. Throws if the path does not exist.

SYNTAX
    Assert-VstsPath [-LiteralPath] <String> [[-PathType] {Any | Container | Leaf}] [-PassThru]
    [<CommonParameters>]
```
### <a name="invoke-vststool" />Invoke-VstsTool
[table of contents](#toc) | [full](FullHelp/Invoke-VstsTool.md)
```
NAME
    Invoke-VstsTool

SYNOPSIS
    Executes an external program.

SYNTAX
    Invoke-VstsTool [-FileName] <String> [[-Arguments] <String>] [[-WorkingDirectory] <String>] [[-Encoding]
    <Encoding>] [-RequireExitCodeZero] [<CommonParameters>]

DESCRIPTION
    Executes an external program and waits for the process to exit.

    After calling this command, the exit code of the process can be retrieved from the variable $LASTEXITCODE.
```
## <a name="trace" />Trace
### <a name="trace-vstsenteringinvocation" />Trace-VstsEnteringInvocation
[table of contents](#toc) | [full](FullHelp/Trace-VstsEnteringInvocation.md)
```
NAME
    Trace-VstsEnteringInvocation

SYNOPSIS
    Writes verbose information about the invocation being entered.

SYNTAX
    Trace-VstsEnteringInvocation [-InvocationInfo] <InvocationInfo> [[-Parameter] <String[]>]
    [<CommonParameters>]

DESCRIPTION
    Used to trace verbose information when entering a function/script. Writes an entering message followed by
    a short description of the invocation. Additionally each bound parameter and unbound argument is also
    traced.
```
### <a name="trace-vstsleavinginvocation" />Trace-VstsLeavingInvocation
[table of contents](#toc) | [full](FullHelp/Trace-VstsLeavingInvocation.md)
```
NAME
    Trace-VstsLeavingInvocation

SYNOPSIS
    Writes verbose information about the invocation being left.

SYNTAX
    Trace-VstsLeavingInvocation [-InvocationInfo] <InvocationInfo> [<CommonParameters>]

DESCRIPTION
    Used to trace verbose information when leaving a function/script. Writes a leaving message followed by a
    short description of the invocation.
```
### <a name="trace-vstspath" />Trace-VstsPath
[table of contents](#toc) | [full](FullHelp/Trace-VstsPath.md)
```
NAME
    Trace-VstsPath

SYNOPSIS
    Writes verbose information about paths.

SYNTAX
    Trace-VstsPath [[-Path] <String[]>] [-PassThru] [<CommonParameters>]

DESCRIPTION
    Writes verbose information about the paths. The paths are sorted and a the common root is written only
    once, followed by each relative path.
```

