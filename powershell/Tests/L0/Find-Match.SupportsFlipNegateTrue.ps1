[CmdletBinding()]
param()

# Arrange.
. $PSScriptRoot\..\lib\Initialize-Test.ps1
Invoke-VstsTaskScript -ScriptBlock {
    $tempDirectory = [System.IO.Path]::Combine($env:TMP, [System.IO.Path]::GetRandomFileName())
    New-Item -Path $tempDirectory -ItemType Directory |
        ForEach-Object { $_.FullName }
    try {
<#
    it('supports flipNegate true', (done: MochaDone) => {
        this.timeout(1000);

        // create the following layout:
        //   !hello-world.txt
        //   hello-world.txt
        let root: string = path.join(testutil.getTestTemp(), 'find-and-match_supports-flipNegate-true');
        tl.mkdirP(root);
        fs.writeFileSync(path.join(root, '!hello-world.txt'), '');
        fs.writeFileSync(path.join(root, 'hello-world.txt'), '');
        let patterns: string[] = [
            '!hello-world.txt',
        ];
        let actual: string[] = tl.findMatch(root, patterns, null, <tl.MatchOptions>{ flipNegate: true });
        let expected: string[] = [
            path.join(root, 'hello-world.txt'),
        ];
        assert.deepEqual(actual, expected);

        done();
    });
#>
        # Create the following layout:
        #   {hello,world}.txt
        #   world.txt
        #   world.txt
        New-Item -Path "$tempDirectory\{hello,world}.txt"
        New-Item -Path "$tempDirectory\hello.txt"
        New-Item -Path "$tempDirectory\world.txt"
        $patterns = @(
            '{hello,world}.txt'
        )
        $matchOptions = New-VstsMatchOptions -NoBrace:$false

        # Act.
        $actual = Find-VstsMatch -DefaultRoot $tempDirectory -Pattern $patterns -MatchOptions $matchOptions

        # Assert.
        $expected = @(
            "$tempDirectory\hello.txt"
            "$tempDirectory\world.txt"
        )
        Assert-AreEqual $expected $actual
    } finally {
        Remove-Item $tempDirectory -Recurse
    }
}