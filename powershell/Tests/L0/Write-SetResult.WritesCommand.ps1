[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = Get-Module -Name VstsTaskSdk
    $variableSets = @(
        @{
            Expected = '##vso[task.complete result=Succeeded;done=true]Some data'
            AlternateExpected = '##vso[task.complete done=true;result=Succeeded]Some data'
            Command = @{
                Result = 'Succeeded'
                Done = 1
                Message = 'Some data'
            }
        }
        @{
            Expected = '##vso[task.complete result=Succeeded;done=true]Some data'
            AlternateExpected = '##vso[task.complete done=true;result=Succeeded]Some data'
            Command = @{
                Result = 'Succeeded'
                Done = $true
                Message = 'Some data'
            }
        }
        @{
            Expected = '##vso[task.complete result=Succeeded]Some data'
            Command = @{
                Result = 'Succeeded'
                Done = 0
                Message = 'Some data'
            }
        }
        @{
            Expected = '##vso[task.complete result=Succeeded]Some data'
            Command = @{
                Result = 'Succeeded'
                Message = 'Some data'
            }
        }
        @{
            Expected = '##vso[task.complete result=Succeeded]Some data'
            Command = @{
                Result = 'Succeeded'
                Done = $false
                Message = 'Some data'
            }
        }
    )
    try {
        foreach ($variableSet in $variableSets) {
            $command = $variableSet.Command

            # Verify commands are correct
            # Act.
            $actual = & $vstsModule Write-SetResult @command -AsOutput
            # Assert.
            if (!$variableSet.AlternateExpected -or $variableSet.AlternateExpected -ne $actual) {
                Assert-AreEqual $variableSet.Expected $actual
            }
        }
    } catch {
        throw
    }
}