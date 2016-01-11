########################################
# Public functions.
########################################
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

# TODO: RENAME TO INVOKE-PROCESS?
function Invoke-Tool {
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
        [switch]$RequireExitCodeZero) # TODO: THIS SHOULD PROBABLY BE FLIPPED, i.e. [switch]$AllowNonZeroExitCode

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
