[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $variableSets = @(
        @{ Name = 'MyVar1' ; Value = 'MyValue1' ; IsSecret = $true ; Expected = "Set MyVar1 = '********'" }
        @{ Name = 'MyVar2' ; Value = 'MyValue2' ; IsSecret = $false ; Expected = "Set MyVar2 = 'MyValue2'" }
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