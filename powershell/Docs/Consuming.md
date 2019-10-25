# Consuming the SDK

## Dependencies
* The SDK requires PowerShell 3 or higher.
* The SDK is designed for use with PowerShell.exe (Console Host).
* A TFS 2015 Update 2 Windows agent (or higher) is required to run a PowerShell3 task end-to-end. However, an agent is not required for interactively testing the task.

## Where to get it

```PowerShell
Save-Module -Name VstsTaskSdk -Path .\
```

or install a specific version:

```PowerShell
Save-Module -Name VstsTaskSdk -Path .\ -RequiredVersion 0.7.0
```

## task.json modifications
Use the `PowerShell3` execution handler and set the target to the entry PS1 script. The entry PS1 script should be located in the root of the task folder.
```JSON
{
    "execution": {
        "PowerShell3": {
            "target": "MyTask.ps1"
        },
    }
}
```

## Package the SDK with the task
The SDK should be packaged with the task in a `ps_modules` folder. The `ps_modules` folder should be in the root of the task folder.

Example layout: Consider the following layout where `MyTask` is the root folder for the task.
```
MyTask
|   MyTask.ps1
│   task.json
└───ps_modules
    └───VstsTaskSdk
            [...]
            VstsTaskSdk.psd1
```

The `task.json` file and task execution target file `MyTask.ps1` must also be in the root of the task folder, otherwise the task will not be able to locate the `ps_modules` directory at runtime. Having the `MyTask.ps1` execution target file in the root directory was not a requirement of the original `PowerShell` task execution handler, but is for `PowerShell3`.
