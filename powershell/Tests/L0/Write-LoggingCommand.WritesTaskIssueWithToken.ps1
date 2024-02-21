[CmdletBinding()]
param()

$env:TASK_SDK_COMMAND_TOKEN = "test_token123"

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = Get-Module -Name VstsTaskSdk

    # 1
    Assert-AreEqual $null $env:TASK_SDK_COMMAND_TOKEN "SDK removes the token after loading."

    # 2
    $actual = & $vstsModule Get-TaskVariable -Name "TASK_SDK_COMMAND_TOKEN"
    Assert-AreEqual $null $actual "The token is inaccessible using task variables."

    # 3
    $actual = & $vstsModule Write-TaskError -Message "test error" -AsOutput
    $expected = "##vso[task.logissue source=TaskInternal;type=error;token=test_token123]test error"
    Assert-TaskIssueMessagesAreEqual $expected $actual "The default 'TastInternal' source and the token were added for errors."

    # 4
    $actual = & $vstsModule Write-TaskWarning -Message "test warning" -AsOutput
    $expected = "##vso[task.logissue source=TaskInternal;type=warning;token=test_token123]test warning"
    Assert-TaskIssueMessagesAreEqual $expected $actual "The default 'TastInternal' source and the token were added for warnings."

    # 5
    $actual = & $vstsModule Write-TaskError -Message "test error" -IssueSource $IssueSources.CustomerScript -AsOutput
    $expected = "##vso[task.logissue source=CustomerScript;type=error;token=test_token123]test error"
    Assert-TaskIssueMessagesAreEqual $expected $actual "Adds the specified issue source and token for errors."

    # 6
    $actual = & $vstsModule Write-TaskWarning -Message "test warning" -IssueSource $IssueSources.CustomerScript -AsOutput
    $expected = "##vso[task.logissue source=CustomerScript;type=warning;token=test_token123]test warning"
    Assert-TaskIssueMessagesAreEqual $expected $actual "Adds the specified issue source and token for warnings."
}