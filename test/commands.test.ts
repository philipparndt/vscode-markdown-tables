import * as vscode from 'vscode'
import * as assert from 'assert'
import * as cfg from '../src/configuration'

import * as cmd from '../src/commands'
import { MarkdownStringifier } from '../src/ttMarkdown'

async function inTextEditor(options: { language?: string; content?: string; },
    cb: (editor: vscode.TextEditor, document: vscode.TextDocument) => void) {
    const d = await vscode.workspace.openTextDocument(options)
    await vscode.window.showTextDocument(d)
    await cb(vscode.window.activeTextEditor!, d)
}

function move(editor: vscode.TextEditor, line: number, col: number) {
    const pos = new vscode.Position(line, col)
    editor.selection = new vscode.Selection(pos, pos)
}

function clean(text: string) {
    return text.replace(/\r\n/g, '\n')
    .replace(/^\n+/g, '')
}


function assertDocumentText(document: vscode.TextDocument, expected: string) {
    assert.equal(clean(document.getText()), clean(expected))
}

suite('Commands', () => {

    test('Enable', async () => {
        await inTextEditor({language: 'markdown'}, async () => {
            await cfg.override({showStatus: true})
        })
    })

    test('Keep indent', async () => {
        const testCase =
        `        | first | second |
        |  blah blah | this is some text |`
        const expected =
        `        | first     | second            |
        | blah blah | this is some text |`
        
        await inTextEditor({language: 'markdown', content: testCase}, async (editor, document) => {
            move(editor, 0, 10)
            await vscode.commands.executeCommand('text-tables.gotoNextCell')

            assertDocumentText(document, expected)
        })
    })

    test('Regression: Format under cursor causes loss of data.', async () => {
        const testCase =
        `| A| B|
| -1| -1|`
        const expected =
        `| A  | B  |
| -1 | -1 |`
        
        await inTextEditor({language: 'markdown', content: testCase}, async (editor, document) => {
            move(editor, 0, 1)
            await vscode.commands.executeCommand('text-tables.gotoNextCell')

            assertDocumentText(document, expected)
        })
    })

    test('Test "Create table" for markdown', async () => {
        const expectedResult = `|     |     |
| --- | --- |
|     |     |`

        await inTextEditor({language: 'markdown'}, async (editor, document) => {
            await cmd.createTable(2, 2, editor, new MarkdownStringifier())
            assertDocumentText(document, expectedResult)
        })
    }).timeout(10000)

    test('Test "Clear cell"', async () => {
        const testCase =
`| Hello | World | Some other text
| ----- | ----- |`
        const expectedResult =
'|       | World |                \n' +
'| ----- | ----- |'

        await inTextEditor({language: 'markdown', content: testCase}, async (editor, document) => {
            
            await vscode.commands.executeCommand('text-tables.clearCell')
            move(editor, 0, 2)
            await vscode.commands.executeCommand('text-tables.clearCell')
            move(editor, 0, 17)
            await vscode.commands.executeCommand('text-tables.clearCell')
            move(editor, 1, 2)
            await vscode.commands.executeCommand('text-tables.clearCell')
            assertDocumentText(document, expectedResult)
        })
    })

    test('Test "Go to next cell"', async () => {
        const input = `|        |            |
|--|--|
|  |  |`
        const expected = `
|     |     |
| --- | --- |
|     |     |
|     |     |`

        const testCases = [
            new vscode.Position(0, 2),
            new vscode.Position(0, 8),
            new vscode.Position(1, 2),
            new vscode.Position(1, 8),
            new vscode.Position(2, 2),
            new vscode.Position(2, 8),
            new vscode.Position(3, 2),
            new vscode.Position(3, 8),
        ]

        await inTextEditor({language: 'markdown', content: input}, async (editor, document) => {
            
            for (const t of testCases) {
                await vscode.commands.executeCommand('text-tables.gotoNextCell')
                assert.deepEqual(editor.selection.start, t)
            }

            assertDocumentText(document, expected)
        })
    })

    test('Test "Go to previous cell"', async () => {
        const input = `|        |            |
|--|--|
|  |  |`

        const testCases = [
            new vscode.Position(1, 8),
            new vscode.Position(1, 2),
            new vscode.Position(0, 8),
            new vscode.Position(0, 2),
            // Repeated intentionally to check that it won't jump outside
            new vscode.Position(0, 2),
        ]

        await inTextEditor({language: 'markdown', content: input}, async (editor, _) => {
            move(editor, 2, 5)
            for (const t of testCases) {
                console.log(t)
                await vscode.commands.executeCommand('text-tables.gotoPreviousCell')
                assert.deepEqual(editor.selection.start, t)
            }
        })
    })

    test('Test "Move row down"', async () => {
        const input = `| 1 | 2 |
|---|---|
| 3 | 4 |`

        const steps = [
`
| --- | --- |
| 1   | 2   |
| 3   | 4   |`
,
`
| --- | --- |
| 3   | 4   |
| 1   | 2   |`,
`
| --- | --- |
| 3   | 4   |
| 1   | 2   |`
        ]

        await inTextEditor({language: 'markdown', content: input}, async (_, document) => {

            for (const expected of steps) {
                await vscode.commands.executeCommand('text-tables.moveRowDown')
                assertDocumentText(document, expected)
            }
        })
    })

    test('Test "Move row up"', async () => {
        const input =
`|---|---|
| 3 | 4 |
| 1 | 2 |`

        const steps = [
`
| --- | --- |
| 1   | 2   |
| 3   | 4   |`
,
`
| 1   | 2   |
| --- | --- |
| 3   | 4   |`
,
`
| 1   | 2   |
| --- | --- |
| 3   | 4   |`

        ]

        await inTextEditor({language: 'markdown', content: input}, async (editor, document) => {
            move(editor, 2, 0)
            for (const expected of steps) {
                await vscode.commands.executeCommand('text-tables.moveRowUp')
                assertDocumentText(document, expected)
            }
        })
    })

    test('Test "Move col right"', async () => {
        const input =
`| 1 | 2 | 3 |
| 4 | 5 | 6 |`

        const steps = [
`| 2 | 1 | 3 |
| 5 | 4 | 6 |`
,
`| 2 | 3 | 1 |
| 5 | 6 | 4 |`
,
`| 2 | 3 | 1 |
| 5 | 6 | 4 |`

        ]

        await inTextEditor({language: 'markdown', content: input}, async (editor, document) => {
            
            move(editor, 0, 2)
            for (const expected of steps) {
                await vscode.commands.executeCommand('text-tables.moveColRight')
                assertDocumentText(document, expected)
            }
        })
    })

    test('Test "Move col left"', async () => {
        const input =
`| 1 | 2 | 3 |
| 4 | 5 | 6 |`

        const steps = [
`| 1 | 3 | 2 |
| 4 | 6 | 5 |`
,
`| 3 | 1 | 2 |
| 6 | 4 | 5 |`
,
`| 3 | 1 | 2 |
| 6 | 4 | 5 |`
        ]

        await inTextEditor({language: 'markdown', content: input}, async (editor, document) => {
            
            move(editor, 0, 10)
            for (const expected of steps) {
                await vscode.commands.executeCommand('text-tables.moveColLeft')
                assertDocumentText(document, expected)
            }
        })
    })

    test('Test "Format under cursor"', async () => {
        const input =
`| 1   |   2     |        3     |
| 4    | 5       |        6 |`

        const expected =
`| 1 | 2 | 3 |
| 4 | 5 | 6 |`

        await inTextEditor({language: 'markdown', content: input}, async (_, document) => {
            

            await vscode.commands.executeCommand('text-tables.formatUnderCursor')
            assertDocumentText(document, expected)
        })
    })

    test('Test "Format under cursor" for markdown', async () => {
        const input =
`| 1   |   2     |
| --- |
| 4    | 5       |        6 |`

        const expected =
`| 1   | 2   |     |
| --- | --- | --- |
| 4   | 5   | 6   |`

        await inTextEditor({language: 'markdown', content: input}, async (_, document) => {
            

            await vscode.commands.executeCommand('text-tables.formatUnderCursor')
            assertDocumentText(document, expected)
        })
    })

    test('Test "Next Row"', async () => {
        const input =
`| Row  |
| Row2 |`

        const steps = [
`| Row  |
| Row2 |`
,
`| Row  |
| Row2 |
|      |`
,
`| Row  |
| Row2 |
|      |
|      |`
        ]

        await inTextEditor({language: 'markdown', content: input}, async (editor, document) => {
            
            move(editor, 0, 2)
            for (const expected of steps) {
                await vscode.commands.executeCommand('text-tables.nextRow')
                assertDocumentText(document, expected)
            }
        })
    })
})
