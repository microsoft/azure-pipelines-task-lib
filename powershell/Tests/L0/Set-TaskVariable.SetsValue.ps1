[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $variableSets = @(
        @{ Path = 'Env:Some_name' ; Name = 'Some.name' ; Expected = 'Some value' ; IsSecret = $false }
        @{ Path = 'Env:Some_name' ; Name = 'Some.name' ; Expected = 'Some value' ; IsSecret = $true }
        @{ Path = 'Env:agent.jobstatus' ; Name = 'agent.jobstatus' ; Expected = 'Some job status' ; IsSecret = $false }
    )
    foreach ($variableSet in $variableSets) {
        Unregister-Mock Write-SetVariable
        Register-Mock Write-SetVariable

        # Act.
        Set-VstsTaskVariable -Name $variableSet.Name -Value $variableSet.Expected -Secret:$variableSet.IsSecret

        # Assert.
        $actual = Get-Content -LiteralPath $variableSet.Path
        Assert-AreEqual $variableSet.Expected $actual
        Assert-WasCalled Write-SetVariable -- -Name $variableSet.Name -Value $variableSet.Expected -Secret: $variableSet.IsSecret
    }
}