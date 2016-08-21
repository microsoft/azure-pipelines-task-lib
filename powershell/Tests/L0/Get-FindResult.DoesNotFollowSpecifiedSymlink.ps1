[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $tempDirectory = [System.IO.Path]::Combine($env:TMP, [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory |
        ForEach-Object { $_.FullName }
    try {
        # Create the following layout:
        #   realDir
        #   realDir/file
        #   symDir -> realDir
        New-Item -Path "$tempDirectory\realDir" -ItemType Directory
        New-Item -Path "$tempDirectory\realDir\file" -ItemType File
        & cmd.exe /S /C "mklink /J `"$tempDirectory\symDir`" `"$tempDirectory\realDir`""
        Get-Item -LiteralPath "$tempDirectory\symDir\file"
        $options = New-VstsFindOptions

        # Act.
        $actual = & (Get-Module VstsTaskSdk) Get-FindResult -Path "$tempDirectory\symDir" -Options $options

        # Assert.
        $expected = "$tempDirectory\symDir"
        Assert-AreEqual $expected $actual
    } finally {
        Remove-Item $tempDirectory -Recurse -Force
    }
}