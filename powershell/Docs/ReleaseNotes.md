# Release Notes

## 0.6.3
 * Updated `Find-VstsFiles` to fix `-IncludeDirectories` functionality.

## 0.6.2
 * Updated initialization (`Invoke-VstsTaskScript`) to run within the global session state. Modules imported by the task script will now be imported into the global session state.

## 0.6.1
 * Updated initialization (`Invoke-VstsTaskScript`) to globally set `ErrorActionPreference` to `Stop`.
 * Updated initialization (`Invoke-VstsTaskScript`) to remove input and endpoint variables from the environment drive. The variables are stored within the module as `PSCredential` objects. `Get-VstsInput` and `Get-VstsEndpoint` have been updated to retrieve the internally stored variables and return the plain values.
 * Updated `Invoke-VstsTool`. The command line being invoked is now written to the host stream.
 * Added `Write-VstsSetSecret`.

## 0.6.0
 * Updated `Get-VstsEndpoint`. Added a `Data` property to the endpoint object.
 * Updated `Write-VstsSetVariable`. Added a `Secret` switch.
 * Added `Write-VstsAddBuildTag`.

## 0.5.4
 * Loc string updates for TFS 2015 Update 2.

## 0.5.1
 * Updated `Write-VstsAssociateArtifact`. Added a mandatory `Type` parameter. Added an optional `Properties` parameter so that additional properties can be stored on an artifact.

## 0.5.0
 * Initial release.
