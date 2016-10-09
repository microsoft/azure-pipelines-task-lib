# Errors, warnings, and task result

## Error action preference
The `Invoke-VstsTaskScript` command globally sets the error action preference to stop before running the scriptblock.

This will cause error records to be terminating errors. When errors are written to the error pipeline, it will cause the statement to throw the error record. The `Invoke-VstsTaskScript` command will catch the terminating error record, log it as an error issue on the task, and set the task result to failed.

Alternatively, the global error action preference can be overidden by the task script. For example, `$global:ErrorActionPreference = 'Continue'`. With an error action preference of `Continue`, error records will still be logged as error issues. However, the task result would not automatically be set to failed. In this case, merely creating an error issue would not indicate task failure.

## Error/Warning pipelines
Messages written to the error pipeline (`Write-Error`) are written as error logging commands. This instructs the agent to create an error issue asssociated with the task.

Messages written to the warning pipeline (`Write-Warning`) are written as warning logging commands. This instructs the agent to create a warning issue associated with the task. 

## External commands and STDERR
When the agent invokes the task script, by default STDERR from external commands and will not produce an error record. Many programs treat the STDERR stream simply as an alternate stream. So this behavior is appropriate for many external commands.

This default behavior is consistent with PowerShell.exe (Console Host). Other hosts may differ. For example PowerShell ISE by default converts STDERR from external commands into error records. For this reason, the recommendation is to test the task script using PowerShell.exe.

However, depending upon how the pipelines are manipulated, error records may be produced in some cases.

### These cases do not produce an error record:
* When redirection is not applied to the external command. Example:
```PowerShell
& cmd.exe /c nosuchcommand
```
* When redirection is applied indirectly to the external command and the output is (naturally or directly) piped to `Out-Default`. Examples:
```PowerShell
. { & cmd.exe /c nosuchcommand } 2>&1
. { & cmd.exe /c nosuchcommand } 2>&1 | Out-Default
```

### These cases do produce an error record:
* When redirection is applied directly to the external command. Example:
```PowerShell
& cmd.exe /c nosuchcommand 2>&1
```
* When redirection is applied indirectly to the external command, and the output is piped to any command before it is (naturally or directly) piped to `Out-Default`. Examples:
```PowerShell
. { & cmd.exe /c nosuchcommand } 2>&1 | Foreach-Object { $_ }
. { & cmd.exe /c nosuchcommand } 2>&1 | Foreach-Object { $_ } | Out-Default
. { & cmd.exe /c nosuchcommand } 2>&1 | Out-Host
```
