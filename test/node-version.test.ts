import * as assert from 'assert'
import * as fs from 'fs'
import * as path from 'path'
import * as yaml from 'js-yaml'

const loadWorkflow = (file: string) => {
    return yaml.load(fs.readFileSync(path.join(__dirname, `../../.github/workflows/${file}`)).toString('utf8')) as any
}

const findNodeVersion = (file: string) => {
    const wf = loadWorkflow(file)
    for (const [, value] of Object.entries(wf.jobs)) {
        const steps = (value as any).steps

        const setupNode = steps.filter((e: any) => e.uses != null && e.uses.startsWith('actions/setup-node'))
        if (setupNode.length === 1) {
            return setupNode[0].with['node-version'].split('.')[0]
        }
    }

    throw new Error(`Node version not found for ${file}`)
}

suite('Same version for build and vscode', () => {
    test('build.yml', () => {
        assert.equal(process.version.split('.')[0].substring(1), findNodeVersion('build.yml'))
    })

    test('build-release.yml', () => {
        assert.equal(process.version.split('.')[0].substring(1), findNodeVersion('build-release.yml'))
    })

    test('check.yml', () => {
        assert.equal(process.version.split('.')[0].substring(1), findNodeVersion('check.yml'))
    })

    test('package.json', () => {
        const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json')).toString('utf8'))
        const nodeTypes = packageJson.devDependencies['@types/node'].split('.')[0]
        assert.equal(process.version.split('.')[0].substring(1), nodeTypes)
    })

})
