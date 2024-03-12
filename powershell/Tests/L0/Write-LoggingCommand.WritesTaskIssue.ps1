[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = Get-Module -Name VstsTaskSdk

    # 1
    $actual = & $vstsModule Write-TaskError -Message "test error" -AsOutput
    $expected = "##vso[task.logissue source=TaskInternal;type=error]test error"
    Assert-TaskIssueMessagesAreEqual $expected $actual "The default 'TastInternal' source was added for errors."

    # 2
    $actual = & $vstsModule Write-TaskWarning -Message "test warning" -AsOutput
    $expected = "##vso[task.logissue source=TaskInternal;type=warning]test warning"
    Assert-TaskIssueMessagesAreEqual $expected $actual "The default 'TastInternal' source was added for warnings."

    #3
    $actual = & $vstsModule Write-TaskError -Message "test error" -IssueSource $IssueSources.CustomerScript -AsOutput
    $expected = "##vso[task.logissue source=CustomerScript;type=error]test error"
    Assert-TaskIssueMessagesAreEqual $expected $actual "Adds the specified issue source for errors."

    #4
    $actual = & $vstsModule Write-TaskWarning -Message "test warning" -IssueSource $IssueSources.CustomerScript -AsOutput
    $expected = "##vso[task.logissue source=CustomerScript;type=warning]test warning"
    Assert-TaskIssueMessagesAreEqual $expected $actual "Adds the specified issue source for warnings."
}