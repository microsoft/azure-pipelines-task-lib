$script:secureInputs = @{ }

<#
.SYNOPSIS
Gets an endpoint.

.DESCRIPTION
Gets an endpoint object for the specified endpoint name. The endpoint is returned as an object with three properties: Auth, Data, and Url.

The Data property requires a 1.97 agent or higher.

.PARAMETER Require
Writes an error to the error pipeline if the endpoint is not found.
#>
function Get-Endpoint {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [switch]$Require)

    # Get the URL.
    $url = (Get-SecureInput -Name (Get-LocString -Key PSLIB_EndpointUrl0 -ArgumentList $Name) -Path "Env:ENDPOINT_URL_$Name" -Require:$Require)

    # Short-circuit if not found.
    if ($Require -and !$url) { return }

    # Get the auth object.
    if ($auth = (Get-SecureInput -Name (Get-LocString -Key PSLIB_EndpointAuth0 -ArgumentList $Name) -Path "Env:ENDPOINT_AUTH_$Name" -Require:$Require)) {
        $auth = ConvertFrom-Json -InputObject $auth
    }

    # Short-circuit if not found.
    if ($Require -and !$auth) { return }

    # Get the data.
    if ($data = (Get-SecureInput -Name "'$Name' service endpoint data" -Path "Env:ENDPOINT_DATA_$Name")) {
        $data = ConvertFrom-Json -InputObject $data
    }

    # Return the endpoint.
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

    # Update the Name in the bound parameters hashtable for downstream user facing
    # messages (i.e. required error message or interactive prompt).
    $PSBoundParameters['Name'] = (Get-LocString -Key PSLIB_Input0 -ArgumentList $Name)

    # Get the secure input. Splat the bound parameters hashtable. Splatting is required
    # in order to concisely invoke the correct parameter set.
    Get-SecureInput @PSBoundParameters -Path "Env:INPUT_$($Name.Replace(' ', '_').ToUpperInvariant())"
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

    # Update the Name in the bound parameters hashtable for downstream user facing
    # messages (i.e. required error message or interactive prompt).
    $PSBoundParameters['Name'] = Get-LocString -Key PSLIB_TaskVariable0 -ArgumentList $Name

    # Attempt to get the secret variable.
    $value = $null
    $path = "Env:SECRET_$(Format-VariableName $Name)"
    if ($psCredential = $script:secureInputs[$path]) {
        # The secret variable was found.
        $value = $psCredential.GetNetworkCredential().Password
        Get-FinalValue @PSBoundParameters -Path $path -Value $value
    } else {
        # Attempt to get the environment variable.
        $item = $null
        $path = "Env:$(Format-VariableName $Name)"
        if ((Test-Path -LiteralPath $path) -and ($item = Get-Item -LiteralPath $path).Value) {
            # Intentionally empty.
        } elseif (!$script:nonInteractive) {
            # The value wasn't found. Prompt for the value if running in interactive dev mode.
            Set-Item -LiteralPath $path -Value (Read-Host -Prompt $Name)
            if (Test-Path -LiteralPath $path) {
                $item = Get-Item -LiteralPath $path
            }
        }

        # Get the converted value. Splat the bound parameters hashtable. Splatting is required
        # in order to concisely invoke the correct parameter set.
        Get-FinalValue @PSBoundParameters -Path $path -Value $item.Value
    }
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
function Get-SecureInput {
    [CmdletBinding(DefaultParameterSetName = 'Require')]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(ParameterSetName = 'Require')]
        [switch]$Require,
        [Parameter(ParameterSetName = 'Default')]
        [object]$Default,
        [switch]$AsBool,
        [switch]$AsInt)

    # Attempt to get the secure variable.
    $value = $null
    if ($psCredential = $script:secureInputs[$Path]) {
        $value = $psCredential.GetNetworkCredential().Password
    } elseif (!$script:nonInteractive) {
        # The value wasn't found. Prompt for the value if running in interactive dev mode.
        $value = Read-Host -Prompt $Name
        if ($value) {
            $script:secureInputs[$Path] = New-Object System.Management.Automation.PSCredential(
                $Path,
                (ConvertTo-SecureString -String $value -AsPlainText -Force))
        }
    }

    Get-FinalValue -Value $value @PSBoundParameters
}

function Get-FinalValue {
    [CmdletBinding(DefaultParameterSetName = 'Require')]
    param(
        [string]$Value,
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(ParameterSetName = 'Require')]
        [switch]$Require,
        [Parameter(ParameterSetName = 'Default')]
        [object]$Default,
        [switch]$AsBool,
        [switch]$AsInt)

    $result = $Value
    if ($result) {
        if ($Path -like 'Env:ENDPOINT_AUTH_*') {
            Write-Verbose "$($Path): '********'"
        } else {
            Write-Verbose "$($Path): '$result'"
        }
    } else {
        Write-Verbose "$Path (empty)"

        # Write error if required.
        if ($Require) {
            Write-Error "$(Get-LocString -Key PSLIB_Required0 $Name)"
            return
        }

        # Fallback to the default if provided.
        if ($PSCmdlet.ParameterSetName -eq 'Default') {
            $result = $Default
            Write-Verbose " Defaulted to: '$result'"
        } else {
            $result = ''
        }
    }

    # Convert to bool if specified.
    if ($AsBool) {
        if ($result -isnot [bool]) {
            $result = "$result" -in '1', 'true'
            Write-Verbose " Converted to bool: $result"
        }

        return $result
    }

    # Convert to int if specified.
    if ($AsInt) {
        if ($result -isnot [int]) {
            try {
                $result = [int]"$result"
            } catch {
                $result = 0
            }

            Write-Verbose " Converted to int: $result"
        }

        return $result
    }

    return $result
}

function Initialize-SecureInputs {
    # Store endpoints/inputs in a secure fashion.
    foreach ($variable in (Get-ChildItem -Path Env:ENDPOINT_*, Env:INPUT_*, Env:SECRET_*)) {
        $path = "Env:$($variable.Name)"
        if ($variable.Value) {
            $script:secureInputs[$path] = New-Object System.Management.Automation.PSCredential(
                $path,
                (ConvertTo-SecureString -String $variable.Value -AsPlainText -Force))
        }

        # Clear the environment variable.
        Remove-Item -LiteralPath $path
    }
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
