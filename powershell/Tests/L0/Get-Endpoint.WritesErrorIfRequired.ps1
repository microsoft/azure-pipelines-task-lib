[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $variableSets = @(
        @{ Url = '' ; Auth = '{}' ; ExpectedMessage = "Required: 'SomeName' service endpoint URL" }
        @{ Url = 'http://bing.com' ; Auth = '' ; ExpectedMessage = "Required: 'SomeName' service endpoint credentials" }
        @{ Url = '' ; Auth = '' ; ExpectedMessage = "Required: 'SomeName' service endpoint URL" }
    )
    foreach ($variableSet in $variableSets) {
        $env:ENDPOINT_URL_SOMENAME = $variableSet.Url
        $env:ENDPOINT_AUTH_SOMENAME = $variableSet.Auth

        # Act.
        $actual = Get-VstsEndpoint -Name 'SomeName' -Require 2>&1

        # Assert.
        Assert-IsNotNullOrEmpty $actual
        Assert-AreEqual -Expected ([System.Management.Automation.ErrorRecord]) -Actual $actual.GetType()
        Assert-AreEqual -Expected $variableSet.ExpectedMessage -Actual $actual.Exception.Message
    }
}