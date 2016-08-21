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
        #   hello/hello.txt
        #   world -> hello
        New-Item -Path "$tempDirectory\hello" -ItemType Directory
        New-Item -Path "$tempDirectory\hello\hello.txt" -ItemType File
        & cmd.exe /S /C "mklink /J `"$tempDirectory\world`" `"$tempDirectory\hello`""
        $null = Get-Item -LiteralPath "$tempDirectory\world\hello.txt"
        $patterns = @(
            '**\*'
        )
        $findOptions = New-VstsFindOptions

        # Act.
        $actual = Find-VstsMatch -DefaultRoot $tempDirectory -Pattern $patterns -FindOptions $findOptions

        # Assert.
        $expected = @(
            "$tempDirectory\hello"
            "$tempDirectory\hello\hello.txt"
            "$tempDirectory\world"
        )
        Assert-AreEqual ($expected | Sort-Object) $actual
    } finally {
        Remove-Item $tempDirectory -Recurse -Force
    }
}