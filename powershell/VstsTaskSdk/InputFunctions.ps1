########################################
# Public functions.
########################################
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

    if ($url -or $auth) {
        New-Object -TypeName psobject -Property @{
            Url = $url
            Auth = $auth
        }
    }
}

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

function Set-TaskVariable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [string]$Value)

    # Set the environment variable.
    $path = "Env:$(Format-VariableName $Name)"
    Write-Verbose "Set $path = '$Value'"
    Set-Item -LiteralPath $path -Value $Value

    # Persist the variable in the task context.
    # TODO: Should this be called with the formatted name?
    Write-SetVariable -Name $Name -Value $Value
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
