# Release Notes

## 0.6.1
 * Updated initialization (`Invoke-TaskScript`) to globally set `ErrorActionPreference` to `Stop`.
 * Updated initialization (`Invoke-TaskScript`) to remove input and endpoint variables from the environment drive. The variables are stored within the module as `PSCredential` objects. `Get-Input` and `Get-Endpoint` have been updated to retrieve the internally stored variables and return the plain values.
 * Updated `Invoke-Tool`. The command line being invoked is now written to the host stream.
 * Added `Write-SetSecret`.

## 0.6.0
 * Updated `Get-Endpoint`. Added a `Data` property to the endpoint object.
 * Updated `Write-SetVariable`. Added a `Secret` switch.
 * Added `Write-AddBuildTag`.

## 0.5.4
 * Loc string updates for TFS 2015 Update 2.

## 0.5.1
 * Updated `Write-AssociateArtifact`. Added a mandatory `Type` parameter. Added an optional `Properties` parameter so that additional properties can be stored on an artifact.

## 0.5.0
 * Initial release.
