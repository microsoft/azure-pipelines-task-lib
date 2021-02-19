import tl = require("../../_build/task")

function mapVariables(pipelineVariables: tl.VariableInfo[]) {
    let variables: { [name: string]: string } = {}
    let secrets: { [name: string]: string } = {}
    pipelineVariables.map((variable) => {

        if (variable.secret) {
            secrets[variable.name] = variable.value
        } else {
            variables[variable.name] = variable.value
        }

    });
    return { variables, secrets }
}

async function run() {
    try {
        let { variables } = mapVariables(tl.getVariables())

        if (!(variables['foo'] == 'bar')) {
            tl.setResult(tl.TaskResult.Failed, 'Invalid value for foo variable');
        }
    } catch (err) {
        console.error(err)
        tl.setResult(tl.TaskResult.Failed, err.message)
    }
}

run()
