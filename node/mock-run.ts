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

    checkModuleName(modName: any): boolean {
        if (typeof modName !== 'string') {
            return false;
        }

        if (modName.includes('.')) {
            console.log(`WARNING: ${modName} is a local module. Cannot require it from task-lib. Please pass an already imported module.`);
            return false;
        }

        return true;
    }


    checkIsMockable(newModule, methodName, oldModule) {
        const method = newModule[methodName];

        if (!newModule.hasOwnProperty(methodName) || typeof method === 'undefined') {
            return false;
        }

        if (typeof method !== 'function') {
            console.log(`WARNING: ${methodName} of ${newModule} is not a function. There is no option to replace getter/setter in this implementation. You can consider changing it.`);
            return false;
        }

        const descriptor = Object.getOwnPropertyDescriptor(oldModule, methodName);

        return descriptor && descriptor.writable !== false;
    }



    /**
    * Register a mock module. When require() is called for the module name,
    * the mock implementation will be returned instead.
    *
    * @param modName    Module name to override.
    * @param val        Mock implementation of the module.
    * @returns          void
    */
    public registerMock(modName: any, mod: any): void {
        this._moduleCount++;
        let oldMod: object;

        if (this.checkModuleName(modName)) {
            oldMod = require(modName);
        } else {
            oldMod = modName;
        }

        for (let method in oldMod) {
            if (this.checkIsMockable(mod, method, oldMod)) {
                const replacement = mod[method] || oldMod[method];
                this._sandbox.replace(oldMod, method, replacement);
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
            var tlm = require('azure-pipelines-task-lib/mock-task');
            if (this._answers) {
                tlm.setAnswers(this._answers);
            }

            Object.keys(this._exports)
                .forEach((key: string): void => {
                    tlm[key] = this._exports[key];
                });


            var tlt = require('azure-pipelines-task-lib/task');
            for (let method in tlt) {
                if (tlm.hasOwnProperty(method)) {
                    this._sandbox.replace(tlt, method, tlm[method]);
                }
            }

        }

        // run it
        require(this._taskPath);
    }

    public restore() {
        this._sandbox.restore();
    }
}
