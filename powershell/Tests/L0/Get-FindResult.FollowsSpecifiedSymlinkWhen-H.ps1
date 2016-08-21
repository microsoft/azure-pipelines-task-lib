[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $tempDirectory = [System.IO.Path]::Combine($env:TMP, [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory |
        ForEach-Object { $_.FullName }
    try {
<#QQQ
    it('follows specified symlink when -H', (done: MochaDone) => {
        this.timeout(1000);

        // create the following layout:
        //   realDir
        //   realDir/file
        //   symDir -> realDir
        let root: string = path.join(testutil.getTestTemp(), 'find_follow_specified_symlink_when_-H');
        tl.mkdirP(path.join(root, 'realDir'));
        fs.writeFileSync(path.join(root, 'realDir', 'file'), 'test file content');
        testutil.createSymlinkDir(path.join(root, 'realDir'), path.join(root, 'symDir'));

        let options: tl.FindOptions = {} as tl.FindOptions;
        options.followSpecifiedSymbolicLink = true; // equivalent to "find -H"
        let itemPaths: string[] = tl.find(path.join(root, 'symDir'), options);
        assert.equal(itemPaths.length, 2);
        assert.equal(itemPaths[0], path.join(root, 'symDir'));
        assert.equal(itemPaths[1], path.join(root, 'symDir', 'file'));

        done();
    });
#>
        # Create the following layout:
        #   realDir
        #   realDir/file
        #   symDir -> realDir
        New-Item -Path "$tempDirectory\realDir" -ItemType Directory
        New-Item -Path "$tempDirectory\realDir\file" -ItemType File
        & cmd.exe /S /C "mklink /J `"$tempDirectory\symDir`" `"$tempDirectory\realDir`""
        Get-Item -LiteralPath "$tempDirectory\symDir\file"
        $options = New-VstsFindOptions -FollowSpecifiedSymbolicLink # equivalent to "find -H"

        # Act.
        $actual = & (Get-Module VstsTaskSdk) Get-FindResult -Path "$tempDirectory\symDir" -Options $options

        # Assert.
        $expected = @(
            "$tempDirectory\symDir"
            "$tempDirectory\symDir\file"
        )
        Assert-AreEqual ($expected | Sort-Object) ($actual | Sort-Object)
    } finally {
        Remove-Item $tempDirectory -Recurse -Force
    }
}