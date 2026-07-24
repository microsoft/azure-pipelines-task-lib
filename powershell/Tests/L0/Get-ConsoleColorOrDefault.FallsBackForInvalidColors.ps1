[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = Get-Module -Name VstsTaskSdk

    $variableSets = @(
        # Valid ConsoleColor values are preserved.
        @{
            Value = [System.ConsoleColor]::Green
            DefaultColor = [System.ConsoleColor]::Red
            Expected = [System.ConsoleColor]::Green
            Message = "A valid ConsoleColor value should be preserved."
        }
        @{
            Value = [System.ConsoleColor]::Black
            DefaultColor = [System.ConsoleColor]::Red
            Expected = [System.ConsoleColor]::Black
            Message = "The 'Black' ConsoleColor (underlying value 0) should be preserved."
        }
        # Null falls back to the default.
        @{
            Value = $null
            DefaultColor = [System.ConsoleColor]::Red
            Expected = [System.ConsoleColor]::Red
            Message = "A null value should fall back to the default color."
        }
        # A non-ConsoleColor type falls back to the default.
        @{
            Value = 'NotAColor'
            DefaultColor = [System.ConsoleColor]::Yellow
            Expected = [System.ConsoleColor]::Yellow
            Message = "A string value should fall back to the default color."
        }
        @{
            Value = [int]-1
            DefaultColor = [System.ConsoleColor]::Cyan
            Expected = [System.ConsoleColor]::Cyan
            Message = "An Int32 value should fall back to the default color."
        }
        # An out-of-range value typed as ConsoleColor falls back to the default.
        # A C# host can return a ConsoleColor whose underlying value is undefined
        # (for example -1); the previous '-isnot [System.ConsoleColor]' check treated
        # these as valid and passed them to Write-Host, causing a failure.
        @{
            Value = [System.Enum]::ToObject([System.ConsoleColor], -1)
            DefaultColor = [System.ConsoleColor]::DarkGray
            Expected = [System.ConsoleColor]::DarkGray
            Message = "An undefined negative ConsoleColor value should fall back to the default color."
        }
        @{
            Value = [System.Enum]::ToObject([System.ConsoleColor], 99)
            DefaultColor = [System.ConsoleColor]::Red
            Expected = [System.ConsoleColor]::Red
            Message = "An undefined out-of-range ConsoleColor value should fall back to the default color."
        }
    )

    foreach ($variableSet in $variableSets) {
        # Act.
        $actual = & $vstsModule Get-ConsoleColorOrDefault -Value $variableSet.Value -DefaultColor $variableSet.DefaultColor

        # Assert.
        Assert-AreEqual $variableSet.Expected $actual $variableSet.Message
    }
}
