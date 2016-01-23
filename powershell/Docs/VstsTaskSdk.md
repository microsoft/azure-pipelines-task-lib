# VSTS Task SDK for PowerShell

## Consuming the SDK

### Dependencies
* The SDK requires PowerShell 3 or higher.
* The SDK is designed for use with PowerShell.exe (Console Host).

### Where to get it

```Batchfile
npm install vsts-task-sdk
```

or install a specific version:

```Batchfile
npm install vsts-task-sdk@0.5.0
```

### task.json modifications
Use the PowerShell3 execution handler and set the target to the entry PS1 script. The entry PS1 script should be located in the root of the task folder.
```JSON
{
    "execution": {
        "PowerShell3": {
            "target": "MyTask.ps1"
        },
    }
}
```

### Package the SDK with the task
The SDK should be packaged with the task in a ps_modules folder. The ps_modules folder should be in the root of the task folder.

Example layout: Consider the following layout where "MyTask" is the root folder for the task.
```
MyTask
|   MyTask.ps1
│   task.json
└───ps_modules
    └───VstsTaskSdk
            [...]
            VstsTaskSdk.psd1
```

## Testing a task script
A task script can be tested interactively without running the agent. From PowerShell.exe run:
```PowerShell
Import-Module .\ps_modules\VstsTaskSdk
Invoke-VstsTaskScript -ScriptBlock { . .\MyTask.ps1 }
```

For PowerShell 3 and 4, a different scriptblock syntax is required:
```PowerShell
Invoke-VstsTaskScript -ScriptBlock ([scriptblock]::Create('. .\MyTask.ps1'))
```

For the convenience of interactive testing, the module will prompt for undefined task variables and inputs. For example, `Get-VstsTaskInput -Name SomeVariable` will prompt for the value if the task variable is not defined. If a value is entered, then it will be stored so that subsequent calls will return the same value. The value is stored at the process level, so it will remain until the host process is exited (e.g. PowerShell.exe).

To disable interactive prompting, a non-interactive flag can be specified when the module is imported:
```PowerShell
Import-Module .\ps_modules\VstsTaskSdk -ArgumentList @{ NonInteractive = $true }
```

## Errors, warnings, and task result

### Error action preference
The Invoke-VstsTaskScript command sets the error action preference to stop before running the scriptblock.

This will cause error records in the task script's scope to be terminating errors. When errors are written to the error pipeline, it will cause the statement to throw the error record. The Invoke-VstsTaskScript command will catch the terminating error record, log it as an error issue on the task, and set the task result to failed.

Alternatively, the error action preference can be overidden by the task script. For example it can be set to Continue. With an error action preference of Continue, error records will still be logged as error issues. However, the task result would not automatically be set to failed. In this case, merely creating an error issue would not indicate task failure.

### Write-Error/Warning/Verbose/Debug
* Write-Error
 * The message is written as an error issue logging command. This instructs the agent to create an error issue associated with the task.
* Write-Warning
 * The message is written as a warning issue logging command. This instructs the agent to create a warning issue associated with the task.
* Write-Verbose and Write-Debug
 * The message is written as a task debug logging command.

The PowerShell preference variables still apply. When a job is queued with the System.Debug variable set to True, the agent will set the verbose preference and debug preference to Continue before running the script.

### External commands and STDERR

When the distributed task agent invokes the task script, by default STDERR from external commands and will not produce an error record. Many programs treat the STDERR stream simply as an alternate stream. So this behavior is appropriate for many external commands.

This default behavior is consistent with PowerShell.exe (Console Host). Other hosts may differ. For example PowerShell ISE by default converts STDERR from external commands into error records. For this reason, the recommendation is to test the task script using PowerShell.exe.

Note, depending upon how the pipelines are manipulated, error records may be produced in some cases.

#### These cases do not produce an error record:
* When redirection is not applied to the external command. Example:
```PowerShell
& cmd.exe /c nosuchcommand
```
* When redirection is applied indirectly to the external command and the output is (naturally or directly) piped to Out-Default. Examples:
```PowerShell
. { & cmd.exe /c nosuchcommand } 2>&1
. { & cmd.exe /c nosuchcommand } 2>&1 | Out-Default
```

#### These cases do produce an error record:
* When redirection is applied directly to the external command. Example:
```PowerShell
& cmd.exe /c nosuchcommand 2>&1
```
* When redirection is applied indirectly to the external command, and the output is piped to any command before it is (naturally or directly) piped to Out-Default. Examples:
```PowerShell
. { & cmd.exe /c nosuchcommand } 2>&1 | Foreach-Object { $_ }
. { & cmd.exe /c nosuchcommand } 2>&1 | Foreach-Object { $_ } | Out-Default
. { & cmd.exe /c nosuchcommand } 2>&1 | Out-Host
```

### Debug tracing
Many of the commands in the SDK have verbose tracing built in. By using the commands provided by the SDK, tracing is provided for free.

## Commands
Command descriptions coming soon.

### Find
#### Find-VstsFiles

### Input
#### Get-VstsEndpoint
#### Get-VstsInput
#### Get-VstsTaskVariable
#### Set-VstsTaskVariable

### Localization
#### Get-VstsLocString
#### Import-VstsLocStrings

### Logging commands
#### Write-VstsAddAttachment
#### Write-VstsAssociateArtifact
#### Write-VstsLogDetail
#### Write-VstsSetProgress
#### Write-VstsSetResult
#### Write-VstsSetVariable
#### Write-VstsTaskDebug
#### Write-VstsTaskError
#### Write-VstsTaskVerbose
#### Write-VstsTaskWarning
#### Write-VstsUpdateBuildNumber
#### Write-VstsUploadArtifact

### Server OM
#### Get-VstsTfsClientCredentials
#### Get-VstsVssCredentials

### Tool
#### Assert-VstsPath
#### Invoke-VstsTaskScript
#### Invoke-VstsTool

### Tracing
#### Trace-VstsEnteringInvocation
#### Trace-VstsLeavingInvocation
#### Trace-VstsPath
