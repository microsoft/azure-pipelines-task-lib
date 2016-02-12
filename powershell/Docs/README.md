# VSTS Task SDK for PowerShell

## Overview
The VSTS Task SDK for PowerShell is designed to work with the agent's new PowerShell handler. Highlights of the new model are:

 * __Breaks coupling with agent:__  This lib is decoupled and ships with the task and the agent is just an engine to run tasks.
 * __Testability:__ Aims to offer the ability to actually run your task scripts under all scenarios without a server or an agent.
 * __Localization:__ The lib provides a mechanism for storing your localized strings with your task, and loading the correct set at run-time.
 * __Consistent API:__ The TypeScript and PowerShell libs are largely consistent. They only differ where it makes sense (being true to the platform).
 * __Tracing for free:__ Tracing has been built-in to many of the commands. Use the SDK and get some debug tracing for free.

### [Consuming the SDK](Consuming.md)
### [Errors, warnings, and task result](ErrorsWarningsAndTaskResult.md)
### [Testing and debugging](TestingAndDebugging.md)
### [Commands](Commands.md)
### [Release notes](ReleaseNotes.md)
