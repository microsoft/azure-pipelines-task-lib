[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $vstsModule = (Get-Module VstsTaskSdk)

    # Get-DirectoryChildItemNonWindows is the managed, cross-platform enumerator used on
    # macOS/Linux in place of the kernel32 FindFirstFileEx-based implementation. It relies
    # only on managed [System.IO] APIs, so it is exercised directly here on every platform.

    # Build the following tree using platform-neutral paths:
    #   root/
    #     a.txt   b.log
    #     sub/        c.txt   d.log
    #     sub/nested/ e.txt
    $root = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.IO.Path]::GetRandomFileName())
    $sub = [System.IO.Path]::Combine($root, 'sub')
    $nested = [System.IO.Path]::Combine($sub, 'nested')
    $null = New-Item -ItemType Directory -Path $nested -Force
    Set-Content -LiteralPath ([System.IO.Path]::Combine($root, 'a.txt')) -Value 'a'
    Set-Content -LiteralPath ([System.IO.Path]::Combine($root, 'b.log')) -Value 'b'
    Set-Content -LiteralPath ([System.IO.Path]::Combine($sub, 'c.txt')) -Value 'c'
    Set-Content -LiteralPath ([System.IO.Path]::Combine($sub, 'd.log')) -Value 'd'
    Set-Content -LiteralPath ([System.IO.Path]::Combine($nested, 'e.txt')) -Value 'e'
    try {
        # Top-level enumeration returns immediate files and directories.
        $actual = & $vstsModule Get-DirectoryChildItemNonWindows -Path $root
        Assert-AreEqual -Expected 'a.txt,b.log,sub' -Actual (($actual | ForEach-Object Name | Sort-Object) -join ',') -Message "Top-level enumeration should list immediate children."

        # FullName is an absolute path to the item.
        $aItem = $actual | Where-Object Name -eq 'a.txt'
        Assert-AreEqual -Expected ([System.IO.Path]::Combine($root, 'a.txt')) -Actual $aItem.FullName -Message "FullName should be the absolute path of the item."

        # Directory entries carry the strongly-typed [VstsTaskSdk.FS.Attributes] Directory flag.
        $subItem = $actual | Where-Object Name -eq 'sub'
        Assert-AreEqual -Expected 'VstsTaskSdk.FS.Attributes' -Actual $subItem.Attributes.GetType().FullName -Message "Attributes should be the VstsTaskSdk.FS.Attributes flags enum."
        Assert-AreEqual -Expected $true -Actual $subItem.Attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Directory) -Message "A directory entry should have the Directory attribute flag."
        Assert-AreEqual -Expected $false -Actual $aItem.Attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Directory) -Message "A file entry should not have the Directory attribute flag."

        # A filter restricts files to matches, at the top level only.
        $actual = & $vstsModule Get-DirectoryChildItemNonWindows -Path $root -Filter '*.txt'
        Assert-AreEqual -Expected 'a.txt' -Actual (($actual | Where-Object { -not $_.Attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Directory) } | ForEach-Object Name | Sort-Object) -join ',') -Message "A filter should restrict matched files at the current level."

        # Recursion descends into all subdirectories, applying the filter to files.
        $actual = & $vstsModule Get-DirectoryChildItemNonWindows -Path $root -Filter '*.txt' -Recurse
        $files = $actual | Where-Object { -not $_.Attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Directory) }
        Assert-AreEqual -Expected 'a.txt,c.txt,e.txt' -Actual (($files | ForEach-Object Name | Sort-Object) -join ',') -Message "Recursion with a filter should match files at every level."

        # Recursion with the default filter returns every file and directory.
        $actual = & $vstsModule Get-DirectoryChildItemNonWindows -Path $root -Recurse
        Assert-AreEqual -Expected 'a.txt,b.log,c.txt,d.log,e.txt,nested,sub' -Actual (($actual | ForEach-Object Name | Sort-Object) -join ',') -Message "Unfiltered recursion should return the entire tree."

        # A hidden entry is excluded by default and included with -Force. A dotfile is hidden
        # on Unix; on Windows the Hidden attribute is set explicitly so the case is meaningful
        # on every platform.
        if ([bool](& $vstsModule Get-IsWindowsHost)) {
            $hiddenName = 'hidden.dat'
            $hiddenPath = [System.IO.Path]::Combine($root, $hiddenName)
            Set-Content -LiteralPath $hiddenPath -Value 'h'
            $hiddenItem = Get-Item -LiteralPath $hiddenPath -Force
            $hiddenItem.Attributes = $hiddenItem.Attributes -bor [System.IO.FileAttributes]::Hidden
        } else {
            $hiddenName = '.hidden.dat'
            Set-Content -LiteralPath ([System.IO.Path]::Combine($root, $hiddenName)) -Value 'h'
        }

        $withoutForce = & $vstsModule Get-DirectoryChildItemNonWindows -Path $root
        Assert-AreEqual -Expected $false -Actual ([bool]($withoutForce | Where-Object Name -eq $hiddenName)) -Message "A hidden entry should be excluded without -Force."
        $withForce = & $vstsModule Get-DirectoryChildItemNonWindows -Path $root -Force
        Assert-AreEqual -Expected $true -Actual ([bool]($withForce | Where-Object Name -eq $hiddenName)) -Message "A hidden entry should be included with -Force."

        # A path that does not exist yields no results and does not throw.
        $missing = [System.IO.Path]::Combine($root, 'does-not-exist')
        $actual = @(& $vstsModule Get-DirectoryChildItemNonWindows -Path $missing)
        Assert-AreEqual -Expected 0 -Actual $actual.Count -Message "Enumerating a non-existent path should return nothing without throwing."
    } finally {
        Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
    }
}
