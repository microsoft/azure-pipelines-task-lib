[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $variableSets = @(
        @{ Path = 'Env:MyVar' ; Name = 'MyVar' ; Value = 'MyValue' ; IsSecret = $true ; Expected = "Set Env:MyVar = '********'" }
        @{ Path = 'Env:MyVar' ; Name = 'MyVar' ; Value = 'MyValue' ; IsSecret = $false ; Expected = "Set Env:MyVar = 'MyValue'" }
    )
    foreach ($variableSet in $variableSets) {
        # Act.
        $verboseMessage = Set-VstsTaskVariable -Name $variableSet.Name -Value $variableSet.Value -Secret:$variableSet.IsSecret -Verbose 4>&1 |
            Where-Object { $_ -is [System.Management.Automation.VerboseRecord] } |
            Select-Object -ExpandProperty Message

        # Assert.
        Assert-AreEqual $variableSet.Expected $verboseMessage
    }
}