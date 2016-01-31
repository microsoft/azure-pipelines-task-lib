# Testing and debugging

## Interactive testing
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

## Verbose/Debug pipelines
Messages written to the verbose pipeline (Write-Verbose) and debug pipeline (Write-Debug) are written as task debug logging commands.

The PowerShell preference variables still apply. When a job is queued with the System.Debug variable set to True, the agent will set the verbose preference and debug preference to Continue before running the script.

## Tracing for free
Many of the commands in the SDK have verbose tracing built in. By using the commands provided by the SDK, some tracing is provided for free.

## Interactive debugging
All tracing in the SDK is written to the verbose pipeline. This leaves the debug pipeline free for the task author to use for interactive debugging. For example, when interactively debugging a script, the Debug common parameter can be passed to effectively hit a break point on any messages written to the debug pipeline.

To view the verbose output when testing locally:
```PowerShell
Import-Module .\ps_modules\VstsTaskSdk
Invoke-VstsTaskScript -ScriptBlock { . .\MyTask.ps1 } -Verbose
```