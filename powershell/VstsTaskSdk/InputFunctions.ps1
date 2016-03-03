<#
.SYNOPSIS
Gets an endpoint.

.DESCRIPTION
Gets an endpoint object for the specified endpoint name. The endpoint is returned as an object with three properties: Auth, Data, and Url.

.PARAMETER Require
Writes an error to the error pipeline if the endpoint is not found.
#>
function Get-Endpoint {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [switch]$Require)

    $url = (Get-EnvVariable -Name (Get-LocString -Key PSLIB_EndpointUrl0 -ArgumentList $Name) -Path "Env:ENDPOINT_URL_$Name" -Require:$Require)
    if ($Require -and !$url) { return }
    if ($auth = (Get-EnvVariable -Name (Get-LocString -Key PSLIB_EndpointAuth0 -ArgumentList $Name) -Path "Env:ENDPOINT_AUTH_$Name" -Require:$Require)) {
        $auth = ConvertFrom-Json -InputObject $auth
    }

    if ($Require -and !$auth) { return }
    if ($data = (Get-EnvVariable -Name "'$Name' service endpoint data" -Path "Env:ENDPOINT_DATA_$Name")) {
        $data = ConvertFrom-Json -InputObject $data
    }

    if ($url -or $auth -or $data) {
        New-Object -TypeName psobject -Property @{
            Url = $url
            Auth = $auth
            Data = $data
        }
    }
}

<#
.SYNOPSIS
Gets an input.

.DESCRIPTION
Gets the value for the specified input name.

.PARAMETER AsBool
Returns the value as a bool. Returns true if the value converted to a string is "1" or "true" (case insensitive); otherwise false.

.PARAMETER AsInt
Returns the value as an int. Returns the value converted to an int. Returns 0 if the conversion fails.

.PARAMETER Default
Default value to use if the input is null or empty.

.PARAMETER Require
Writes an error to the error pipeline if the input is null or empty.
#>
function Get-Input {
    [CmdletBinding(DefaultParameterSetName = 'Require')]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(ParameterSetName = 'Default')]
        $Default,
        [Parameter(ParameterSetName = 'Require')]
        [switch]$Require,
        [switch]$AsBool,
        [switch]$AsInt)

    $PSBoundParameters['Name'] = (Get-LocString -Key PSLIB_Input0 -ArgumentList $Name)
    Get-EnvVariable @PSBoundParameters -Path "Env:INPUT_$($Name.Replace(' ', '_').ToUpperInvariant())"
}

<#
.SYNOPSIS
Gets a task variable.

.DESCRIPTION
Gets the value for the specified task variable.

.PARAMETER AsBool
Returns the value as a bool. Returns true if the value converted to a string is "1" or "true" (case insensitive); otherwise false.

.PARAMETER AsInt
Returns the value as an int. Returns the value converted to an int. Returns 0 if the conversion fails.

.PARAMETER Default
Default value to use if the input is null or empty.

.PARAMETER Require
Writes an error to the error pipeline if the input is null or empty.
#>
function Get-TaskVariable {
    [CmdletBinding(DefaultParameterSetName = 'Require')]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(ParameterSetName = 'Default')]
        $Default,
        [Parameter(ParameterSetName = 'Require')]
        [switch]$Require,
        [switch]$AsBool,
        [switch]$AsInt)

    $PSBoundParameters['Name'] = Get-LocString -Key PSLIB_TaskVariable0 -ArgumentList $Name
    Get-EnvVariable @PSBoundParameters -Path "Env:$(Format-VariableName $Name)"
}

<#
.SYNOPSIS
Sets a task variable.

.DESCRIPTION
Sets a task variable in the current task context as well as in the current job context. This allows the task variable to retrieved by subsequent tasks within the same job.
#>
function Set-TaskVariable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [string]$Value,
        [switch]$Secret)

    # Set the environment variable.
    $path = "Env:$(Format-VariableName $Name)"
    Write-Verbose "Set $path = '$(if ($Secret) { '********' } else { $Value })'"
    Set-Item -LiteralPath $path -Value $Value

    # Persist the variable in the task context.
    Write-SetVariable -Name $Name -Value $Value -Secret:$Secret
}

########################################
# Private functions.
########################################
function Get-EnvVariable {
    [CmdletBinding(DefaultParameterSetName = 'Require')]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(ParameterSetName = 'Require')]
        [switch]$Require,
        [Parameter(ParameterSetName = 'Default')]
        $Default,
        [switch]$AsBool,
        [switch]$AsInt)

    # Attempt to get the env var.
    $item = $null
    if ((Test-Path -LiteralPath $Path) -and ($item = Get-Item -LiteralPath $Path).Value) {
        # Intentionally empty.
    } elseif (!$script:nonInteractive) {
        # The value wasn't found. Prompt for the value if running in interactive dev mode.
        Set-Item -LiteralPath $path -Value (Read-Host -Prompt $Name)
        if (Test-Path -LiteralPath $path) {
            $item = Get-Item -LiteralPath $path
        }
    }

    if ($item -and $item.value) {
        $value = $item.value
        Write-Verbose "$($path): '$value'"
    } else {
        Write-Verbose "$path (empty)"

        # Write error if required.
        if ($Require) {
            # TODO: This is technically wrong for loc. It would be best to grab the
            # localized description from the json. However, this might be OK since
            # this type of validation is typically performed up-front by the UI. So
            # the likely scenario for encountering this error would be if someone
            # (a developer) uploaded a definition themselves. At that point it should
            # be upon them to validate what they are doing. And since we don't localize
            # for developers, this may not matter after all.
            Write-Error "$(Get-LocString -Key PSLIB_Required0 $Name)"
            return
        }

        # Fallback to the default if provided.
        if ($PSCmdlet.ParameterSetName -eq 'Default') {
            $value = $Default
            Write-Verbose " Defaulted to: '$value'"
        } else {
            $value = ''
        }
    }

    # Convert to bool if specified.
    if ($AsBool) {
        if ($value -isnot [bool]) {
            $value = "$value" -in '1', 'true'
            Write-Verbose " Converted to bool: $value"
        }

        return $value
    }

    # Convert to int if specified.
    if ($AsInt) {
        if ($value -isnot [int]) {
            try {
                $value = [int]"$value"
            } catch {
                $value = 0
            }

            Write-Verbose " Converted to int: $value"
        }

        return $value
    }

    return $value
}

function Format-VariableName {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name)

    if ($Name -ne 'agent.jobstatus') {
        $Name = $Name.Replace('.', '_')
    }

    $Name.ToUpperInvariant()
}
