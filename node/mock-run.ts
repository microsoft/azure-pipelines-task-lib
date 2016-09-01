import ma = require('./mock-answer');
import mockery = require('mockery');

export class TaskMockRunner {
    constructor(taskPath: string) {
        this._taskPath = taskPath;
    }

    _taskPath: string;
    _answers: ma.TaskLibAnswers;
    _mocks: {[key: string]: any};

    public setInput(name: string, val: string) {
        process.env['INPUT_' + name.replace(' ', '_').toUpperCase()] = val;
    }

    public setAnswers(answers: ma.TaskLibAnswers) {
        this._answers = answers;
    }

    public registerMock(modName: string, mod: any) {
        mockery.registerMock(modName, mod);
    }
    
    public run() {
        mockery.enable({warnOnUnregistered: false});
        var tlm = require('vsts-task-lib/mock-task');
        if (this._answers) {
            tlm.setAnswers(this._answers);
        }
        mockery.registerMock('vsts-task-lib/task', tlm);

        // run it
        require(this._taskPath);
    }
}