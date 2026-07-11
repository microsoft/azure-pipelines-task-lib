[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = (Get-Module VstsTaskSdk)

    function Assert-ColorResolves {
        [CmdletBinding()]
        param(
            [AllowNull()]
            $Value,
            [Parameter(Mandatory = $true)]
            [System.ConsoleColor]$DefaultColor,
            [Parameter(Mandatory = $true)]
            [System.ConsoleColor]$Expected,
            [string]$Message)

        $actual = & $vstsModule Get-ConsoleColorOrDefault -Value $Value -DefaultColor $DefaultColor
        Assert-AreEqual -Expected $Expected -Actual $actual -Message $Message
    }

    # A ConsoleColor-typed value holding an invalid ordinal (-1). This is exactly what
    # $host.PrivateData.*ForegroundColor returns on a non-interactive pwsh host (Linux/macOS).
    # It passes an "-is [ConsoleColor]" type check but is not a defined enum value, which is
    # why the previous type-only guard let it through and Write-Host then threw.
    $invalidColor = [System.Enum]::ToObject([System.ConsoleColor], -1)

    # A valid console color is returned unchanged.
    Assert-ColorResolves -Value ([System.ConsoleColor]::Cyan) -DefaultColor ([System.ConsoleColor]::DarkGray) -Expected ([System.ConsoleColor]::Cyan) -Message "A valid ConsoleColor should be returned unchanged."

    # An invalid ConsoleColor-typed value (-1) falls back to the default. This is the regression fix.
    Assert-ColorResolves -Value $invalidColor -DefaultColor ([System.ConsoleColor]::Yellow) -Expected ([System.ConsoleColor]::Yellow) -Message "An invalid ConsoleColor value (-1) should fall back to the default."

    # A null value falls back to the default.
    Assert-ColorResolves -Value $null -DefaultColor ([System.ConsoleColor]::Red) -Expected ([System.ConsoleColor]::Red) -Message "A null value should fall back to the default."

    # A value of the wrong type falls back to the default.
    Assert-ColorResolves -Value 'not-a-color' -DefaultColor ([System.ConsoleColor]::DarkGray) -Expected ([System.ConsoleColor]::DarkGray) -Message "A non-ConsoleColor value should fall back to the default."

    # An integer (not a ConsoleColor) falls back to the default.
    Assert-ColorResolves -Value 7 -DefaultColor ([System.ConsoleColor]::Black) -Expected ([System.ConsoleColor]::Black) -Message "A raw integer should fall back to the default."

    # Every default used by Write-LogIssue / Write-TaskDebug_Internal is itself a valid color
    # and is preserved when supplied as the value.
    foreach ($color in @(
            [System.ConsoleColor]::Red
            [System.ConsoleColor]::Yellow
            [System.ConsoleColor]::Cyan
            [System.ConsoleColor]::DarkGray
            [System.ConsoleColor]::Black)) {
        Assert-ColorResolves -Value $color -DefaultColor ([System.ConsoleColor]::White) -Expected $color -Message "Valid color '$color' should be preserved."
    }
}
