[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
$vstsModule = Get-Module -Name VstsTaskSdk
$variableSets = @(
    @{
        Expected = '##vso[SomeArea.SomeEvent P1=V1;P2=V2]Some data'
        AlternateExpected = '##vso[SomeArea.SomeEvent P2=V2;P1=V1]Some data'
        Command = @{
            Area = 'SomeArea'
            Event = 'SomeEvent'
            Data = 'Some data'
            Properties = @{ P1 = 'V1' ; P2 = 'V2' }
        }
    }
    @{
        Expected = '##vso[SomeArea.SomeEvent P1=V1]Some data'
        Command = @{
            Area = 'SomeArea'
            Event = 'SomeEvent'
            Data = 'Some data'
            Properties = @{ P1 = 'V1' }
        }
    }
    @{
        Expected = '##vso[SomeArea.SomeEvent P1=Value with %3B, %0D, and %0A.]Some data with %3B, %0D, and %0A.'
        Command = @{
            Area = 'SomeArea'
            Event = 'SomeEvent'
            Data = "Some data with ;, `r, and `n."
            Properties = @{ P1 = "Value with ;, `r, and `n." }
        }
    }
    @{
        Expected = '##vso[SomeArea.SomeEvent]Some data'
        Command = @{
            Area = 'SomeArea'
            Event = 'SomeEvent'
            Data = 'Some data'
            Properties = @{ }
        }
    }
    @{
        Expected = '##vso[SomeArea.SomeEvent]Some data'
        Command = @{
            Area = 'SomeArea'
            Event = 'SomeEvent'
            Data = 'Some data'
        }
    }
    @{
        Expected = '##vso[SomeArea.SomeEvent]'
        Command = @{
            Area = 'SomeArea'
            Event = 'SomeEvent'
        }
    }
)
try {
    foreach ($variableSet in $variableSets) {
        $command = $variableSet.Command
        Unregister-Mock Write-Host
        Register-Mock Write-Host

        # Act/Assert - Verify using as output switch.
        $actual = & $vstsModule Write-LoggingCommand @command -AsOutput
        Assert-WasCalled Write-Host -Times 0
        if (!$variableSet.AlternateExpected -or $variableSet.AlternateExpected -ne $actual) {
            Assert-AreEqual $variableSet.Expected $actual
        }

        # Act/Assert - Verify using "Object" parameter set and as output switch.
        $actual = & $vstsModule Write-LoggingCommand -Command $command -AsOutput
        Assert-WasCalled Write-Host -Times 0
        if (!$variableSet.AlternateExpected -or $variableSet.AlternateExpected -ne $actual) {
            Assert-AreEqual $variableSet.Expected $actual
        }

        # Act/Assert - Verify without using as output switch.
        $actual = & $vstsModule Write-LoggingCommand @command
        Assert-AreEqual $null $actual
        try {
            Assert-WasCalled Write-Host -- $variableSet.Expected
        } catch {
            if (!$variableSet.AlternateExpected) {
                throw
            }

            Assert-WasCalled Write-Host -- $variableSet.AlternateExpected
        }

        # Act/Assert - Verify using "Object" parameter set and without using as output switch.
        Unregister-Mock Write-Host
        Register-Mock Write-Host
        $actual = & $vstsModule Write-LoggingCommand -Command $command
        Assert-AreEqual $null $actual
        try {
            Assert-WasCalled Write-Host -- $variableSet.Expected
        } catch {
            if (!$variableSet.AlternateExpected) {
                throw
            }

            Assert-WasCalled Write-Host -- $variableSet.AlternateExpected
        }
    }
} catch {
    Unregister-Mock Write-Host
    throw
}