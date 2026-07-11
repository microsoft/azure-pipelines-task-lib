########################################
# Private functions.
########################################
function Get-IsWindowsHost {
    [CmdletBinding()]
    param()

    # $IsWindows is an automatic variable in PowerShell Core (6+). It does not exist in
    # Windows PowerShell (5.1 and earlier), which only ever runs on Windows. Probe for the
    # variable before dereferencing it so this remains safe under Set-StrictMode.
    if (Test-Path -LiteralPath Variable:\IsWindows) {
        return [bool](Get-Variable -Name IsWindows -ValueOnly)
    }

    return $true
}

function Get-DirectoryChildItemNonWindows {
    [CmdletBinding()]
    param(
        [string]$Path,
        [ValidateNotNullOrEmpty()]
        [Parameter()]
        [string]$Filter = "*",
        [switch]$Force,
        [switch]$Recurse)

    # Managed, cross-platform equivalent of the Windows FindFirstFileEx-based enumeration
    # in Get-DirectoryChildItem. Used on macOS/Linux, where the kernel32 P/Invoke methods
    # are unavailable. Emits objects with the same shape (Attributes/FullName/Name) and the
    # same [VstsTaskSdk.FS.Attributes] flag semantics that downstream callers depend on.
    # The Attributes flag enum mirrors the bit values of [System.IO.FileAttributes], so a
    # numeric cast is safe.
    $stack = New-Object System.Collections.Stack
    $stack.Push($Path)
    while ($stack.Count) {
        $currentPath = $stack.Pop()
        $directory = New-Object System.IO.DirectoryInfo($currentPath)
        if (!$directory.Exists) {
            continue
        }

        try {
            $entries = @($directory.EnumerateFileSystemInfos($Filter, [System.IO.SearchOption]::TopDirectoryOnly))
        } catch [System.UnauthorizedAccessException] {
            throw (New-Object -TypeName System.UnauthorizedAccessException -ArgumentList @(
                (Get-LocString -Key PSLIB_EnumeratingSubdirectoriesFailedForPath0 -ArgumentList $currentPath)
                $_.Exception
            ))
        }

        $fileQueue = New-Object System.Collections.Queue
        $directoryQueue = New-Object System.Collections.Queue
        foreach ($entry in $entries) {
            $attributes = [VstsTaskSdk.FS.Attributes][uint32]$entry.Attributes
            # If the item is hidden, check if $Force is specified.
            if (!$Force -and $attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Hidden)) {
                continue
            }

            $item = New-Object -TypeName psobject -Property @{
                'Attributes' = $attributes
                'FullName' = $entry.FullName
                'Name' = $entry.Name
            }
            if ($attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Directory)) {
                # Output directories immediately.
                $item
                # Append to the directory queue if recursive and default filter.
                if ($Recurse -and $Filter -eq '*') {
                    $directoryQueue.Enqueue($item.FullName)
                }
            } else {
                # Hold the files until all directories have been output.
                $fileQueue.Enqueue($item)
            }
        }

        # If recursive and non-default filter, queue all child directories. They are not
        # necessarily matched by the filter, but still need to be traversed.
        if ($Recurse -and $Filter -ne '*') {
            foreach ($subDirectory in $directory.EnumerateDirectories('*', [System.IO.SearchOption]::TopDirectoryOnly)) {
                $attributes = [VstsTaskSdk.FS.Attributes][uint32]$subDirectory.Attributes
                if (!$Force -and $attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Hidden)) {
                    continue
                }

                $directoryQueue.Enqueue($subDirectory.FullName)
            }
        }

        # Output the files.
        while ($fileQueue.Count) {
            $fileQueue.Dequeue()
        }

        # Push child directories onto the stack (reversed so they are processed in order).
        if ($directoryQueue.Count) {
            [object[]]$childDirectories = $directoryQueue.ToArray()
            [System.Array]::Reverse($childDirectories)
            foreach ($childDirectory in $childDirectories) {
                $stack.Push($childDirectory)
            }
        }
    }
}

function ConvertFrom-LongFormPath {
    [CmdletBinding()]
    param([string]$Path)

    if ($Path) {
        if ($Path.StartsWith('\\?\UNC')) {
            # E.g. \\?\UNC\server\share -> \\server\share
            return $Path.Substring(1, '\?\UNC'.Length)
        } elseif ($Path.StartsWith('\\?\')) {
            # E.g. \\?\C:\directory -> C:\directory
            return $Path.Substring('\\?\'.Length)
        }
    }

    return $Path
}
function ConvertTo-LongFormPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path)

    if (!(Get-IsWindowsHost)) {
        # Long-form ("\\?\") paths are a Windows-only concept. Return the normalized full path.
        return (Get-FullNormalizedPath -Path $Path)
    }

    [string]$longFormPath = Get-FullNormalizedPath -Path $Path
    if ($longFormPath -and !$longFormPath.StartsWith('\\?')) {
        if ($longFormPath.StartsWith('\\')) {
            # E.g. \\server\share -> \\?\UNC\server\share
            return "\\?\UNC$($longFormPath.Substring(1))"
        } else {
            # E.g. C:\directory -> \\?\C:\directory
            return "\\?\$longFormPath"
        }
    }

    return $longFormPath
}

# TODO: ADD A SWITCH TO EXCLUDE FILES, A SWITCH TO EXCLUDE DIRECTORIES, AND A SWITCH NOT TO FOLLOW REPARSE POINTS.
function Get-DirectoryChildItem {
    [CmdletBinding()]
    param(
        [string]$Path,
        [ValidateNotNullOrEmpty()]
        [Parameter()]
        [string]$Filter = "*",
        [switch]$Force,
        [VstsTaskSdk.FS.FindFlags]$Flags = [VstsTaskSdk.FS.FindFlags]::LargeFetch,
        [VstsTaskSdk.FS.FindInfoLevel]$InfoLevel = [VstsTaskSdk.FS.FindInfoLevel]::Basic,
        [switch]$Recurse)

    if (!(Get-IsWindowsHost)) {
        Get-DirectoryChildItemNonWindows -Path $Path -Filter $Filter -Force:$Force -Recurse:$Recurse
        return
    }

    $stackOfDirectoryQueues = New-Object System.Collections.Stack
    while ($true) {
        $directoryQueue = New-Object System.Collections.Queue
        $fileQueue = New-Object System.Collections.Queue
        $findData = New-Object VstsTaskSdk.FS.FindData
        $longFormPath = (ConvertTo-LongFormPath $Path)
        $handle = $null
        try {
            $handle = [VstsTaskSdk.FS.NativeMethods]::FindFirstFileEx(
                [System.IO.Path]::Combine($longFormPath, $Filter),
                $InfoLevel,
                $findData,
                [VstsTaskSdk.FS.FindSearchOps]::NameMatch,
                [System.IntPtr]::Zero,
                $Flags)
            if (!$handle.IsInvalid) {
                while ($true) {
                    if ($findData.fileName -notin '.', '..') {
                        $attributes = [VstsTaskSdk.FS.Attributes]$findData.fileAttributes
                        # If the item is hidden, check if $Force is specified.
                        if ($Force -or !$attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Hidden)) {
                            # Create the item.
                            $item = New-Object -TypeName psobject -Property @{
                                'Attributes' = $attributes
                                'FullName' = (ConvertFrom-LongFormPath -Path ([System.IO.Path]::Combine($Path, $findData.fileName)))
                                'Name' = $findData.fileName
                            }
                            # Output directories immediately.
                            if ($item.Attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Directory)) {
                                $item
                                # Append to the directory queue if recursive and default filter.
                                if ($Recurse -and $Filter -eq '*') {
                                    $directoryQueue.Enqueue($item)
                                }
                            } else {
                                # Hold the files until all directories have been output.
                                $fileQueue.Enqueue($item)
                            }
                        }
                    }

                    if (!([VstsTaskSdk.FS.NativeMethods]::FindNextFile($handle, $findData))) { break }

                    if ($handle.IsInvalid) {
                        throw (New-Object -TypeName System.ComponentModel.Win32Exception -ArgumentList @(
                            [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
                            Get-LocString -Key PSLIB_EnumeratingSubdirectoriesFailedForPath0 -ArgumentList $Path
                        ))
                    }
                }
            }
        } finally {
            if ($handle -ne $null) { $handle.Dispose() }
        }

        # If recursive and non-default filter, queue child directories.
        if ($Recurse -and $Filter -ne '*') {
            $findData = New-Object VstsTaskSdk.FS.FindData
            $handle = $null
            try {
                $handle = [VstsTaskSdk.FS.NativeMethods]::FindFirstFileEx(
                    [System.IO.Path]::Combine($longFormPath, '*'),
                    [VstsTaskSdk.FS.FindInfoLevel]::Basic,
                    $findData,
                    [VstsTaskSdk.FS.FindSearchOps]::NameMatch,
                    [System.IntPtr]::Zero,
                    $Flags)
                if (!$handle.IsInvalid) {
                    while ($true) {
                        if ($findData.fileName -notin '.', '..') {
                            $attributes = [VstsTaskSdk.FS.Attributes]$findData.fileAttributes
                            # If the item is hidden, check if $Force is specified.
                            if ($Force -or !$attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Hidden)) {
                                # Collect directories only.
                                if ($attributes.HasFlag([VstsTaskSdk.FS.Attributes]::Directory)) {
                                    # Create the item.
                                    $item = New-Object -TypeName psobject -Property @{
                                        'Attributes' = $attributes
                                        'FullName' = (ConvertFrom-LongFormPath -Path ([System.IO.Path]::Combine($Path, $findData.fileName)))
                                        'Name' = $findData.fileName
                                    }
                                    $directoryQueue.Enqueue($item)
                                }
                            }
                        }

                        if (!([VstsTaskSdk.FS.NativeMethods]::FindNextFile($handle, $findData))) { break }

                        if ($handle.IsInvalid) {
                            throw (New-Object -TypeName System.ComponentModel.Win32Exception -ArgumentList @(
                                [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
                                Get-LocString -Key PSLIB_EnumeratingSubdirectoriesFailedForPath0 -ArgumentList $Path
                            ))
                        }
                    }
                }
            } finally {
                if ($handle -ne $null) { $handle.Dispose() }
            }
        }

        # Output the files.
        $fileQueue

        # Push the directory queue onto the stack if any directories were found.
        if ($directoryQueue.Count) { $stackOfDirectoryQueues.Push($directoryQueue) }

        # Break out of the loop if no more directory queues to process.
        if (!$stackOfDirectoryQueues.Count) { break }

        # Get the next path.
        $directoryQueue = $stackOfDirectoryQueues.Peek()
        $Path = $directoryQueue.Dequeue().FullName

        # Pop the directory queue if it's empty.
        if (!$directoryQueue.Count) { $null = $stackOfDirectoryQueues.Pop() }
    }
}

function Get-FullNormalizedPath {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path)

    if (!(Get-IsWindowsHost)) {
        # kernel32!GetFullPathName is unavailable off Windows. The managed equivalent
        # normalizes separators and resolves the path against the current directory.
        [string]$outPath = [System.IO.Path]::GetFullPath($Path)
        if ($outPath.EndsWith('/') -and $outPath -ne '/') {
            $outPath = $outPath.TrimEnd('/')
        }

        return $outPath
    }

    [string]$outPath = $Path
    [uint32]$bufferSize = [VstsTaskSdk.FS.NativeMethods]::GetFullPathName($Path, 0, $null, $null)
    [int]$lastWin32Error = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($bufferSize -gt 0) {
        $absolutePath = New-Object System.Text.StringBuilder([int]$bufferSize)
        [uint32]$length = [VstsTaskSdk.FS.NativeMethods]::GetFullPathName($Path, $bufferSize, $absolutePath, $null)
        $lastWin32Error = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        if ($length -gt 0) {
            $outPath = $absolutePath.ToString()
        } else  {
            throw (New-Object -TypeName System.ComponentModel.Win32Exception -ArgumentList @(
                $lastWin32Error
                Get-LocString -Key PSLIB_PathLengthNotReturnedFor0 -ArgumentList $Path
            ))
        }
    } else {
        throw (New-Object -TypeName System.ComponentModel.Win32Exception -ArgumentList @(
            $lastWin32Error
            Get-LocString -Key PSLIB_PathLengthNotReturnedFor0 -ArgumentList $Path
        ))
    }

    if ($outPath.EndsWith('\') -and !$outPath.EndsWith(':\')) {
        $outPath = $outPath.TrimEnd('\')
    }

    $outPath
}