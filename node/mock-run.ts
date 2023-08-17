import { TaskLibAnswers } from './mock-answer';
import { SinonSandbox, createSandbox } from 'sinon';
import im = require('./internal');
import * as taskLib from './task';

export class TaskMockRunner {
    constructor(taskPath: string) {
        this._taskPath = taskPath;
        this._sandbox = createSandbox();
    }

    _taskPath: string;
    _answers: TaskLibAnswers | undefined;
    _exports: {[key: string]: any} = { };
    _moduleCount: number = 0;
    private _sandbox: SinonSandbox;

    public setInput(name: string, val: string) {
        let key: string = im._getVariableKey(name);
        process.env['INPUT_' + key] = val;
    }

    public setVariableName(name: string, val: string, isSecret?: boolean) {
        let key: string = im._getVariableKey(name);
        if (isSecret) {
            process.env['SECRET_' + key] = val;
        }
        else {
            process.env['VSTS_TASKVARIABLE_' + key] = val;
        }
    }

    /**
     * Register answers for the mock "azure-pipelines-task-lib/task" instance.
     *
     * @param answers   Answers to be returned when the task lib functions are called.
     */
    public setAnswers(answers: TaskLibAnswers) {
        this._answers = answers;
    }
    /**
    * Checks if a module name is valid for import, avoiding local module references.
    *
    * @param {string} modName - The name of the module to be checked.
    * @returns {boolean} Returns true if the module name is valid, otherwise false.
    */
    checkModuleName(modName: string): boolean {
        if (modName.includes('.')) {
            console.error(`ERROR: ${modName} is a local module. Cannot import it from task-lib. Please pass full path.`);
            return false;
        }
        return true;
    }

    /**
    * Checks if a method in a new module is mockable based on specified conditions.
    *
    * @param {object} newModule - The new module containing the method.
    * @param {string} methodName - The name of the method to check.
    * @param {object} oldModule - The original module from which the method might be inherited.
    * @returns {boolean} Returns true if the method is mockable, otherwise false.
    */
    checkIsMockable(newModule, methodName, oldModule) {
        // Get the method from the newModule
        const method = newModule[methodName];

        // Check if the method exists and is not undefined
        if (!newModule.hasOwnProperty(methodName) || typeof method === 'undefined') {
            return false;
        }

        // Check if the method is a function
        if (typeof method !== 'function') {
            console.warn(`WARNING: ${methodName} of ${newModule} is not a function. There is no option to replace getter/setter in this implementation. You can consider changing it.`);
            return false;
        }

        // Check if the method is writable
        const descriptor = Object.getOwnPropertyDescriptor(oldModule, methodName);
        return descriptor && descriptor.writable !== false;
    }

    /**
    * Registers a mock module, allowing the replacement of methods with mock implementations.
    *
    * @param {string} modName - The name of the module to be overridden.
    * @param {object} modMock - The mock implementation of the module.
    * @returns {void}
    */
    public registerMock(modName: string, modMock: object): void {
        this._moduleCount++;
        let oldMod: object;

        // Check if the module name is valid and can be imported
        if (this.checkModuleName(modName)) {
            oldMod = require(modName);
        } else {
            console.error(`ERROR: Cannot import ${modName}.`);
            return;
        }

        // Iterate through methods in the old module and replace them with mock implementations
        for (let method in oldMod) {
            if (this.checkIsMockable(modMock, method, oldMod)) {
                const replacement = modMock[method] || oldMod[method];
                try {
                    this._sandbox.replace(oldMod, method, replacement);
                } catch (error) {
                    console.error('ERROR: Cannot replace ${method} in ${oldMod} by ${replacement}. ${error.message}', );
                }
            }
        }
    }

    /**
    * Registers an override for a specific function on the mock "azure-pipelines-task-lib/task" instance.
    * This can be used in conjunction with setAnswers(), for cases where additional runtime
    * control is needed for a specific function.
    *
    * @param key    Function or field to override.
    * @param val    Function or field value.
    * @returns      void
    */
    public registerMockExport(key: string, val: any): void {
        this._exports[key] = val;
    }

    /**
    * Runs a task script.
    *
    * @param noMockTask     Indicates whether to mock "azure-pipelines-task-lib/task". Default is to mock.
    * @returns              void
    */
    public run(noMockTask?: boolean): void {
        // answers and exports not compatible with "noMockTask" mode
        if (noMockTask) {
            if (this._answers || Object.keys(this._exports).length) {
                throw new Error('setAnswers() and registerMockExport() is not compatible with "noMockTask" mode');
            }
        }
        // register mock task lib
        else {
            let tlm = require('azure-pipelines-task-lib/mock-task');
            if (this._answers) {
                tlm.setAnswers(this._answers);
            }

            Object.keys(this._exports)
                .forEach((key: string): void => {
                    tlm[key] = this._exports[key];
                });

            // With sinon we have to iterate through methods in the old module and replace them with mock implementations
            let tlt = require('azure-pipelines-task-lib/task');
            for (let method in tlt) {
                if (tlm.hasOwnProperty(method)) {
                    this._sandbox.replace(tlt, method, tlm[method]);
                }
            }

        }

        // run it
        require(this._taskPath);
    }
    /**
    * Restores the sandboxed environment to its original state.
    *
    * @returns {void}
    */
    public restore() {
        this._sandbox.restore();
    }
}
