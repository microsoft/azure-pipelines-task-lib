# TODO: It would be better if the Out-Default function resolved the underlying Out-Default
# command in the begin block. This would allow for supporting other modules that override
# Out-Default.
$script:outDefaultCmdlet = $ExecutionContext.InvokeCommand.GetCmdlet("Microsoft.PowerShell.Core\Out-Default")

########################################
# Public functions.
########################################
function Out-Default {
    [CmdletBinding(ConfirmImpact = "Medium")]
    param(
        [Parameter(ValueFromPipeline = $true)]
        [System.Management.Automation.PSObject]$InputObject)

    begin {
        #Write-Host '[Entering Begin Out-Default]'
        $__sp = { & $script:outDefaultCmdlet @PSBoundParameters }.GetSteppablePipeline()
        $__sp.Begin($pscmdlet)
        #Write-Host '[Leaving Begin Out-Default]'
    }

    process {
        #Write-Host '[Entering Process Out-Default]'
        if ($_ -is [System.Management.Automation.ErrorRecord]) {
            Write-Verbose -Message 'Error record:' 4>&1 | Out-Default
            Write-Verbose -Message (Format-ErrorRecord -ErrorRecord $_) 4>&1 | Out-Default
            Write-Verbose -Message 'Script stack trace:' 4>&1 | Out-Default
            Write-Verbose -Message "$($_.ScriptStackTrace)" 4>&1 | Out-Default
            Write-Verbose -Message 'Exception:' 4>&1 | Out-Default
            Write-Verbose -Message $_.Exception.ToString() 4>&1 | Out-Default
            Write-TaskError -Message $_.Exception.Message
        } elseif ($_ -is [System.Management.Automation.WarningRecord]) {
            Write-TaskWarning -Message (Remove-TrailingNewLine (Out-String -InputObject $_ -Width 2147483647))
        } elseif ($_ -is [System.Management.Automation.VerboseRecord]) {
            foreach ($private:str in (Format-DebugMessage -Object $_)) {
                Write-TaskVerbose -Message $private:str
            }
        } elseif ($_ -is [System.Management.Automation.DebugRecord]) {
            foreach ($private:str in (Format-DebugMessage -Object $_)) {
                Write-TaskDebug -Message $private:str
            }
        } else {
            $__sp.Process($_)
        }

        #Write-Host '[Leaving Process Out-Default]'
    }

    end {
        #Write-Host '[Entering End Out-Default]'
        $__sp.End()
        #Write-Host '[Leaving End Out-Default]'
    }
}

########################################
# Private functions.
########################################
function Get-SafeBoundarySubstring {
    [CmdletBinding()]
    param(
        [string]$Str,
        [int]$StartIndex,
        [int]$DesiredLength,
        [switch]$NoEllipsis)

    # Short-circuit if at the end of the string.
    $private:availableLength = $Str.Length - $StartIndex
    if ($private:availableLength -eq 0) {
        return ''
    }

    # Adjust the desired length to prevent going beyond the available length.
    $DesiredLength = [System.Math]::Min(
        $private:availableLength,
        $DesiredLength)

    # Check if the end index is not a whitespace character.
    $private:endIndex = $StartIndex + $DesiredLength - 1
    if (![char]::IsWhiteSpace($Str[$private:endIndex])) {
        # Stop when the end of the string is reached
        # or when a following whitespace character is reached.
        while ($private:endIndex + 1 -lt $Str.Length -and
            ![char]::IsWhiteSpace($Str[$private:endIndex + 1])) {

            $private:endIndex++
        }
    }

    # Extract the substring.
    $private:substr = $Str.Substring(
        $StartIndex, # startIndex
        $private:endIndex - $StartIndex + 1) # length

    # Add ellipsis if desired is less than available.
    if ($DesiredLength -lt $private:availableLength -and !$NoEllipsis) {
        $private:substr = "$private:substr ..."
    }

    return $private:substr
}

function Get-SafeBoundaryTail {
    [CmdletBinding()]
    param(
        [string]$Str,
        [int]$DesiredLength)

    # Short-circuit if at the end of the string.
    $private:availableLength = $Str.Length
    if ($private:availableLength -eq 0) {
        return ''
    }

    # Adjust the desired length to prevent going beyond the available length.
    $DesiredLength = [System.Math]::Min(
        $private:availableLength,
        $DesiredLength)

    # Check if the start index is not a whitespace character.
    $private:startIndex = $Str.Length - $DesiredLength
    if (![char]::IsWhiteSpace($Str[$private:startIndex])) {
        # Stop when the beginning of the string is reached
        # or when a preceeding whitespace character is reached.
        while ($private:startIndex - 1 -gt 0 -and
            ![char]::IsWhiteSpace($Str[$private:startIndex - 1])) {

            $private:startIndex--
        }
    }

    # Extract the substring.
    $private:substr = $Str.Substring($private:StartIndex) # startIndex

    # Add ellipsis if desired is less than available.
    if ($DesiredLength -lt $private:availableLength) {
        $private:substr = "... $private:substr"
    }

    return $private:substr
}

function Format-DebugMessage {
    [CmdletBinding()]
    param([psobject]$Object)

    $private:str = Out-String -InputObject $Object -Width 2147483647
    $private:str = Remove-TrailingNewLine $private:str
    "$private:str".Replace("`r`n", "`n").Replace("`r", "`n").Split("`n"[0])
}

function Format-ErrorRecord {
    [CmdletBinding()]
    param([System.Management.Automation.ErrorRecord]$ErrorRecord)

    $private:str = (Remove-TrailingNewLine (Out-String -InputObject $_ -Width 2147483647))
    $private:split = "$private:str".Replace("`r`n", "`n").Replace("`r", "`n").Split("`n"[0])
    if ($ErrorView -eq 'NormalView' -and # Fallback to the default stringified ErrorRecord if the ErrorView is overridden,
        $private:split.Length -ge 6 -and # if anything on the ErrorRecord is unexpected, or if the stringified ErrorRecord
        $_.InvocationInfo -and           # is in an unexpected form.
        $_.InvocationInfo.Line -and
        $_.InvocationInfo.OffsetInLine -is [int] -and
        $_.InvocationInfo.OffsetInLine -ge 0 -and
        "$($private:split[-3])" -cmatch '^\+ +~+$' -and
        $_.CategoryInfo -and
        ($private:categoryMessage = $_.CategoryInfo.GetMessage()) -and
        "$($private:split[-2])".Contains($private:categoryMessage) -and
        $_.FullyQualifiedErrorId -and
        "$($private:split[-1])".Contains($_.FullyQualifiedErrorId)) {

        try {
            # Customize the Line portion of the PositionMessage in order avoid leaking truncated secrets.
            # For each segment of the Line - leading, invocation, trailing - do not stop until the
            # beginning/end of the Line or a whitespace character is reached.

            # Determine the maximum prefix portion of the Line message.
            $private:prefix = $_.InvocationInfo.Line.Substring(
                0, # startIndex
                $_.InvocationInfo.OffsetInLine) # length

            # Determine the invocation portion of the Line message.
            $private:tildeCount = $private:split[-3].Length - $private:split[-3].IndexOf('~'[0])
            $private:invocation = Get-SafeBoundarySubstring -Str $_.InvocationInfo.Line -StartIndex $_.InvocationInfo.OffsetInLine -DesiredLength $private:tildeCount -NoEllipsis

            # Determine the maximum suffix portion of the Line message.
            $private:suffix = $_.InvocationInfo.Line.Substring(
                $_.Invocation.OffsetInLine + $private:invocation.Length) # startIndex - It is OK if the startIndex exceeds the actual last index by 1.

            # Trim the suffix.
            $private:desiredLineLength = 78
            $private:desiredSuffixLength = [System.Math]::Max(
                8, # At least 8 characters.
                $private:desiredLineLength - $private:prefix.Length - $private:invocation.Length)
            $private:suffix = Get-SafeBoundarySubstring -Str $private:suffix -StartIndex 0 -DesiredLength $private:desiredSuffixLength

            # Trim the prefix.
            $private:desiredPrefixLength = [System.Math]::Max(
                12, # At least 12 characters.
                $private:desiredLineLength - $private:invocation.Length - $private:suffix.Length)
            $private:prefix = Get-SafeBoundaryTail -Str $private:prefix -StartIndex 0 -DesiredLength $private:desiredPrefixLength
        } catch {
        }
    }

    return $private:str
}

function Remove-TrailingNewLine {
    [CmdletBinding()]
    param($Str)
    if ([object]::ReferenceEquals($Str, $null)) {
        return $Str
    } elseif ($Str.EndsWith("`r`n")) {
        return $Str.Substring(0, $Str.Length - 2)
    } else  {
        return $Str
    }
}
