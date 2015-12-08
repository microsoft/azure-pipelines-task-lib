[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\..\lib\Initialize-Test.ps1
$tempDirectory = [System.IO.Path]::Combine($env:TMP, [System.IO.Path]::GetRandomFileName())
New-Item -Path $tempDirectory -ItemType Directory | ForEach-Object { $_.FullName }
try {
    New-Item -Path $tempDirectory\my.json -ItemType File -Value @'
{
  messages: {
    "Found0Files": "Found {0:#,0.00} files.",
    "ThisIsNull0": "This is null: '{0}'.",
    "Two0Tokens1InThisString": "Two {0} tokens {1} in this string.",
    "JustAString": "Just a string. {Not a format string.}",
    "Localized0String": {
      "loc": "Some fancy localized {0} string.",
      "fallback": "Should not be this value."
    },
    "ThisString0FallsBack": {
      "loc": "",
      "fallback": "Some fallback {0} string."
    },
    "ThisString0FallsBackToo": {
      "fallback": "Some other fallback {0} string."
    }
  }
}
'@ | ForEach-Object { $_.FullName }

    # Act/Assert.
    Import-VstsLocStrings -LiteralPath $tempDirectory\my.json
    Assert-AreEqual 'Found 123,456.00 files.' (Get-VstsLocString -Key Found0Files -ArgumentList 123456)
    Assert-AreEqual 'This is null: ''''.' (Get-VstsLocString -Key ThisIsNull0 -ArgumentList $null)
    Assert-AreEqual 'Two REPLACEMENT1 tokens REPLACEMENT2 in this string.' (Get-VstsLocString -Key Two0Tokens1InThisString -ArgumentList REPLACEMENT1, REPLACEMENT2)
    Assert-AreEqual 'Just a string. {Not a format string.}' (Get-VstsLocString -Key JustAString)
    Assert-AreEqual 'Some fancy localized REPLACEMENT1 string.' (Get-VstsLocString -Key Localized0String -ArgumentList REPLACEMENT1)
    Assert-AreEqual 'Some fallback REPLACEMENT1 string.' (Get-VstsLocString -Key ThisString0FallsBack -ArgumentList REPLACEMENT1)
    Assert-AreEqual 'Some other fallback REPLACEMENT1 string.' (Get-VstsLocString -Key ThisString0FallsBackToo -ArgumentList REPLACEMENT1)
} finally {
    Remove-Item $tempDirectory -Recurse
}