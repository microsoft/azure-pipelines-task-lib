<#
.SYNOPSIS
Asserts that a path exists. Throws if the path does not exist.

.PARAMETER PassThru
True to return the path.
#>
function Assert-Path {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$LiteralPath,
        [Microsoft.PowerShell.Commands.TestPathType]$PathType = [Microsoft.PowerShell.Commands.TestPathType]::Any,
        [switch]$PassThru)

    if ($PathType -eq [Microsoft.PowerShell.Commands.TestPathType]::Any) {
        Write-Verbose "Asserting path exists: '$LiteralPath'"
    } else {
        Write-Verbose "Asserting $("$PathType".ToLowerInvariant()) path exists: '$LiteralPath'"
    }

    if (Test-Path -LiteralPath $LiteralPath -PathType $PathType) {
        if ($PassThru) {
            return $LiteralPath
        }

        return
    }

    $resourceKey = switch ($PathType) {
        ([Microsoft.PowerShell.Commands.TestPathType]::Container) { "PSLIB_ContainerPathNotFound0" ; break }
        ([Microsoft.PowerShell.Commands.TestPathType]::Leaf) { "PSLIB_LeafPathNotFound0" ; break }
        default { "PSLIB_PathNotFound0" }
    }

    throw (Get-LocString -Key $resourceKey -ArgumentList $LiteralPath)
}

<#
.SYNOPSIS
Invokes a task script for testing purposes only.

.DESCRIPTION
This command is for testing purposes only. Use this command to invoke a task script and test how it would behave if it were run by the agent.

.EXAMPLE
For testing from within PowerShell 5 or higher:
  Invoke-VstsTaskScript -ScriptBlock { .\MyTaskScript.ps1 }

From PowerShell 3 or 4:
  Invoke-VstsTaskScript -ScriptBlock ([scriptblock]::Create(' .\MyTaskScript.ps1 '))

.EXAMPLE
For testing an ad-hoc command:
  Invoke-VstsTaskScript -ScriptBlock { Write-Warning 'Some fancy warning.' }
#>
function Invoke-TaskScript {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$ScriptBlock)

    try {
        Write-Verbose "$($MyInvocation.MyCommand.Module.Name) $($MyInvocation.MyCommand.Module.Version)" 4>&1 | Out-Default
        Merge-Pipelines -ScriptBlock $ScriptBlock
    } catch [VstsTaskSdk.TerminationException] {
        # Special internal exception type to control the flow. Not currently intended
        # for public usage and subject to change.
        Write-Verbose "Task script terminated." 4>&1 | Out-Default
    } catch {
        Write-Verbose "Caught exception from task script." 4>&1 | Out-Default
        $_ | Out-Default
        Write-SetResult -Result Failed -DoNotThrow
    }
}

<#
.SYNOPSIS
Executes an external program.

.DESCRIPTION
Executes an external program and waits for the process to exit.

After calling this command, the exit code of the process can be retrieved from the variable $LASTEXITCODE.

.PARAMETER Encoding
This parameter not required for most scenarios. Indicates how to interpret the encoding from the external program. An example use case would be if an external program outputs UTF-16 XML and the output needs to be parsed.

.PARAMETER RequireExitCodeZero
Indicates whether to write an error to the error pipeline if the exit code is not zero.
#>
function Invoke-Tool { # TODO: RENAME TO INVOKE-PROCESS?
    [CmdletBinding()]
    param(
        [ValidatePattern('^[^\r\n]*$')]
        [Parameter(Mandatory = $true)]
        [string]$FileName,
        [ValidatePattern('^[^\r\n]*$')]
        [Parameter()]
        [string]$Arguments,
        [string]$WorkingDirectory,
        [System.Text.Encoding]$Encoding,
        [switch]$RequireExitCodeZero)

    Trace-EnteringInvocation $MyInvocation
    $isPushed = $false
    $originalEncoding = $null
    try {
        if ($Encoding) {
            $originalEncoding = [System.Console]::OutputEncoding
            [System.Console]::OutputEncoding = $Encoding
        }

        if ($WorkingDirectory) {
            Push-Location -LiteralPath $WorkingDirectory -ErrorAction Stop
            $isPushed = $true
        }

        $FileName = $FileName.Replace('"', '').Replace("'", "''")
        $expression = "& '$FileName' --% $Arguments"
        Invoke-Expression $expression
        Write-Verbose "Exit code: $LASTEXITCODE"
        if ($RequireExitCodeZero -and $LASTEXITCODE -ne 0) {
            Write-Error (Get-LocString -Key PSLIB_Process0ExitedWithCode1 -ArgumentList ([System.IO.Path]::GetFileName($FileName)), $LASTEXITCODE)
        }
    } finally {
        if ($originalEncoding) {
            [System.Console]::OutputEncoding = $originalEncoding
        }

        if ($isPushed) {
            Pop-Location
        }

        Trace-LeavingInvocation $MyInvocation
    }
}

########################################
# Private functions.
########################################
function Merge-Pipelines {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$ScriptBlock,
        [switch]$DoNotSetErrorActionPreference)

    if ($DoNotSetErrorActionPreference) {
        . $ScriptBlock 2>&1 3>&1 4>&1 5>&1 | Out-Default
    } else {
        $ErrorActionPreference = 'Stop'
        Remove-Item -LiteralPath variable:ScriptBlock
        Remove-Item -LiteralPath variable:DoNotSetErrorActionPreference
        & $ScriptBlock.GetNewClosure() 2>&1 3>&1 4>&1 5>&1 | Out-Default
    }
}
