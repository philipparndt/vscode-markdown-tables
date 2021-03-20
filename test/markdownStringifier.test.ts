import * as assert from 'assert'
import { MarkdownParser, MarkdownStringifier } from '../src/ttMarkdown'
import * as vscode from 'vscode'
import * as voca from 'voca'

function assertCleaned(actual: string, expected: string) {
    assert.equal(clean(actual), clean(expected))
}

function clean(string: string) {
    return voca.trimLeft(voca.trimRight(string), '\r\n')
}

function assertParseStringify(original: string, expected: string) {
    const parser = new MarkdownParser()
    const table = parser.parse(original)

    const stringifier = new MarkdownStringifier()
    const result = stringifier.stringify(table!, vscode.EndOfLine.LF)
    assertCleaned(result, expected)
}

suite('Markdown stringifier', () => {

    test('stringify alignment', () => {
        const cleaned = `
        | default | left | right | center |
        | ------- |:---- | -----:|:------:|
        |         |      |       |        |
        `

        assertParseStringify(cleaned, cleaned)
    })

    test('stringify alignment - remove whitespaces', () => {
        assertParseStringify(`
        | default |  left | right  | center   |
        | ------- | :---- | -----: | :------: |
        |         |       |        |          |
        `, `
        | default | left | right | center |
        | ------- |:---- | -----:|:------:|
        |         |      |       |        |
        `)
    })
})
