param(
    [Parameter(Mandatory=$true)]
    [string]$NugetApiKey
)

$makePath = Join-Path $PSScriptRoot 'make.js'
& node $makePath build

## Get nuget.exe
$nugetExePath = Join-Path $PSScriptRoot '_download\tools\nuget.exe'
if (-not (Test-Path $nugetExePath)) {
    $toolsDir = Split-Path $nugetExePath
    New-Item -ItemType Directory -Path $toolsDir -Force

    Invoke-WebRequest -Uri 'https://dist.nuget.org/win-x86-commandline/latest/nuget.exe' -OutFile $nugetExePath
}

$buildPath = Join-Path $PSScriptRoot '_build'

$nuspecPath = Join-Path $buildPath "VstsTaskSdk/VstsTaskSdk.nuspec"
& $nugetExePath pack $nuspecPath -OutputDirectory $buildPath

$packagePath = Join-Path $buildPath "VstsTaskSdk*.nupkg"
$nugetFeedUrl = "https://api.nuget.org/v3/index.json"
& $nugetExePath push $packagePath -ApiKey $NugetApiKey -Source $nugetFeedUrl
