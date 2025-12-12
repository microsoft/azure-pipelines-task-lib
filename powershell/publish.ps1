param(
    [Parameter(Mandatory = $true)]
    [string]$ApiKey
)

# Install or update to the latest version of powershell management api
$moduleName = 'Microsoft.PowerShell.PSResourceGet'
$installedModule = Get-Module -ListAvailable -Name $moduleName | Sort-Object Version -Descending | Select-Object -First 1
$latestModule = Find-Module -Name $moduleName -Repository PSGallery -ErrorAction SilentlyContinue

if (-not $installedModule) {
    Write-Host "Installing $moduleName..."
    Install-Module -Name $moduleName -Force -Scope CurrentUser
} elseif ($latestModule -and $installedModule.Version -lt $latestModule.Version) {
    Write-Host "Updating $moduleName from version $($installedModule.Version) to $($latestModule.Version)..."
    Update-Module -Name $moduleName -Force
} else {
    Write-Host "$moduleName is already up to date (Version: $($installedModule.Version))"
}

$makePath = Join-Path $PSScriptRoot 'make.js'
& node $makePath build

$buildPath = Join-Path $PSScriptRoot '_build'
$moduleBuildPath = Join-Path $buildPath "VstsTaskSdk"

$publishOptions = @{
    Path       = $moduleBuildPath
    ApiKey     = $ApiKey
    Repository = 'PSGallery'
    Verbose    = $true
}
Write-Host "Publishing module from $moduleBuildPath to PSGallery..."
Publish-PSResource @publishOptions
