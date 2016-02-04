[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $variableSets = @(
        @{ Path = 'Env:Some_name' ; Name = 'Some.name' ; Expected = 'Some value' }
        @{ Path = 'Env:agent.jobstatus' ; Name = 'agent.jobstatus' ; Expected = 'Some job status' }
    )
    foreach ($variableSet in $variableSets) {
        Unregister-Mock Write-Host
        Register-Mock Write-Host

        # Act.
        Set-VstsTaskVariable -Name $variableSet.Name -Value $variableSet.Expected

        # Assert.
        $actual = Get-Content -LiteralPath $variableSet.Path
        Assert-AreEqual $variableSet.Expected $actual
        Assert-WasCalled Write-Host -- "##vso[task.setvariable variable=$($variableSet.Name)]$($variableSet.Expected)"
    }
}