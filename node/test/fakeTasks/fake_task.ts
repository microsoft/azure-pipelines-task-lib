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
        let { variables, secrets } = mapVariables(tl.getVariables())

        if ((variables['USERNAME'] == 'user_sample') && (secrets['PASSWORD'] == '123')) {
            tl.setResult(tl.TaskResult.Succeeded, 'The variables are set correctly')
        } else {
            tl.setResult(tl.TaskResult.Failed, 'These are not the correct variables')
        }
    } catch (err) {
        console.error(err)
        tl.setResult(tl.TaskResult.Failed, err.message)
    }
}

run()