[CmdletBinding()]
param()

function global:DecodeString {
    param (
        [Parameter(Mandatory = $true)]
        [string]$str
    )
    
    return [System.Web.HttpUtility]::UrlDecode($str)
}

$env:TASK_SDK_COMMAND_TOKEN = "test_token123"

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = Get-Module -Name VstsTaskSdk
    $script:hostMessage = $null
    Register-Mock Write-Host { $OFS = " " ; $script:hostMessage = "$args" }

    # 1
    Assert-AreEqual $null $env:TASK_SDK_COMMAND_TOKEN "SDK removes the token after loading."

    # 2
    & $vstsModule Write-TaskError -Message "test error"
    $expected = "##vso[task.logissue source=TaskInternal;type=error;token=test_token123]test error"
    Assert-AreEqual $expected $hostMessage "The default 'TastInternal' source and the token were added for an error."

    # 3
    #& $vstsModule Write-TaskWarning -Message "test warning"
    #$expected = "##vso[task.issue source=TaskInternal;type=warning;token=test_token123;]test warning"
    #Assert-AreEqual $expected $hostMessage "The default 'TastInternal' source and the token were added for an warning."
}