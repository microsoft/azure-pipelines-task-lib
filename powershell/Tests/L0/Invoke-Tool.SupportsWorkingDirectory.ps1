[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
$originalLocation = $PWD
$tempDirectory = [System.IO.Path]::Combine($env:TMP, [System.IO.Path]::GetRandomFileName())
New-Item -Path $tempDirectory -ItemType Directory | ForEach-Object { $_.FullName }
try {
    Set-Location $env:TMP
    $variableSets = @(
        @{ Expected = $env:TMP ; Splat = @{ } }
        @{ Expected = $env:TMP ; Splat = @{ WorkingDirectory = $env:TMP } }
        @{ Expected = $tempDirectory ; Splat = @{ WorkingDirectory = $tempDirectory } }
    )
    foreach ($variableSet in $variableSets) {
        $splat = $variableSet.Splat

        # Act.
        $actual = Invoke-VstsTool -FileName 'cmd.exe' -Arguments '/c "CD"' @splat

        # Assert.
        Assert-AreEqual $variableSet.Expected $actual
        Assert-AreEqual $env:TMP (Get-Location).Path
    }
} finally {
    Set-Location $originalLocation
    Remove-Item $tempDirectory -Recurse
}
