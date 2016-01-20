[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
$env:ENDPOINT_URL_SOMENAME = 'Some URL'
$env:ENDPOINT_AUTH_SOMENAME = '{ ''SomeProperty'' : ''Some property value'', ''SomeProperty2'' : ''Some property value 2'' }'

# Act.
$actual = Get-VstsEndpoint -Name 'SomeName'

# Assert.
Assert-IsNotNullOrEmpty $actual
Assert-AreEqual 'Some URL' $actual.Url
Assert-AreEqual 'Some property value' $actual.Auth.SomeProperty
Assert-AreEqual 'Some property value 2' $actual.Auth.SomeProperty2
