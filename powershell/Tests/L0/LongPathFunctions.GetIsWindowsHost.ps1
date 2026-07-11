[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = (Get-Module VstsTaskSdk)

    # Get-IsWindowsHost decides whether the native (kernel32) or the managed cross-platform
    # path is used for file enumeration and path normalization. It must be safe under
    # Set-StrictMode on Windows PowerShell, where the automatic $IsWindows variable is absent.

    # Act.
    $actual = & $vstsModule Get-IsWindowsHost

    # Assert - returns a boolean.
    Assert-AreEqual -Expected 'System.Boolean' -Actual $actual.GetType().FullName -Message "Get-IsWindowsHost should return a boolean."

    # Assert - the result agrees with the runtime for the current platform.
    if (Test-Path -LiteralPath Variable:\IsWindows) {
        # PowerShell Core (6+): compare against the automatic variable.
        Assert-AreEqual -Expected ([bool](Get-Variable -Name IsWindows -ValueOnly)) -Actual $actual -Message "On PowerShell Core, Get-IsWindowsHost should match `$IsWindows."
    } else {
        # Windows PowerShell (5.1 and earlier) only ever runs on Windows.
        Assert-AreEqual -Expected $true -Actual $actual -Message "On Windows PowerShell, Get-IsWindowsHost should be true."
    }
}
