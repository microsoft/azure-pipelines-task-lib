# Invoke-VstsTaskScript
[table of contents](../Commands.md#toc) | [brief](../Commands.md#invoke-vststaskscript)
```
NAME
    Invoke-VstsTaskScript

SYNOPSIS
    Invokes a task script for testing purposes only.

SYNTAX
    Invoke-VstsTaskScript [-ScriptBlock] <ScriptBlock> [<CommonParameters>]

DESCRIPTION
    This command is for testing purposes only. Use this command to invoke a task script and test how it would
    behave if it were run by the agent.

PARAMETERS
    -ScriptBlock <ScriptBlock>

        Required?                    true
        Position?                    1
        Default value
        Accept pipeline input?       false
        Accept wildcard characters?  false

    <CommonParameters>
        This cmdlet supports the common parameters: Verbose, Debug,
        ErrorAction, ErrorVariable, WarningAction, WarningVariable,
        OutBuffer, PipelineVariable, and OutVariable. For more information, see
        about_CommonParameters (http://go.microsoft.com/fwlink/?LinkID=113216).

    -------------------------- EXAMPLE 1 --------------------------

    PS C:\>For testing from within PowerShell 5 or higher:

    Invoke-VstsTaskScript -ScriptBlock { .\MyTaskScript.ps1 }

    From PowerShell 3 or 4:
      Invoke-VstsTaskScript -ScriptBlock ([scriptblock]::Create(' .\MyTaskScript.ps1 '))

    -------------------------- EXAMPLE 2 --------------------------

    PS C:\>For testing an ad-hoc command:

    Invoke-VstsTaskScript -ScriptBlock { Write-Warning 'Some fancy warning.' }
```
