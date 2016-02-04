[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $env:INPUT_Some_Name = 'Some value'

    # Act.
    $actual = Get-VstsInput -Name 'Some name'

    # Assert.
    Assert-AreEqual 'Some value' $actual
}