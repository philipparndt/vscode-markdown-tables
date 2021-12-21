import * as tt from './ttTable'
import { RowType, Table } from './ttTable'
import * as vscode from 'vscode'
import { convertEOL, findTablePrefix } from './utils'
import { relaxedTableParser as relaxedParser } from '../src/markdownParser'
import { IToken, Parser } from 'ebnf'

const verticalSeparator = '|'
const horizontalSeparator = '-'

type StringReducer = (previous: string, current: string, index: number) => string

const ALIGN_BEGIN_SPACE = ' -'
const ALIGN_BEGIN_COLON = ':-'
const ALIGN_END_SPACE = '- ' + verticalSeparator
const ALIGN_END_COLON = '-:' + verticalSeparator

export class MarkdownParser implements tt.Parser {
    parse(text: string): tt.Table | undefined {
        if (!text || text.length === 0) {
            return undefined
        }

        const result = new tt.Table()
        result.prefix = findTablePrefix(text, verticalSeparator)

        const lines = text.split('\n').map(x => x.trim()) // .filter(x => x.startsWith(verticalSeparator))
        if (lines.length === 0) {
            return undefined
        }

        for (const line of lines) {
            parseRelaxed(line, result)
        }

        if (result.rows.some(x => x.type === RowType.separator)) {
            result.cols.forEach(x => x.width = Math.max(x.width, 3))
        }

        this._parseAlignment(result)

        return result
    }

    private _parseAlignment(result: Table) {
        for (let i = 0; i < result.rows.length; ++i) {
            if (result.rows[i].type === RowType.separator) {
                const rowData = result.getRow(i)

                rowData.forEach((column, index) => {
                    result.cols[index].alignment = this._getAlignment(column)
                })

                return
            }
        }
    }

    isSeparatorRow(text: string): boolean {
        return isSeparatorRow(text)
    }

    private _getAlignment(column: string): tt.Alignment {
        const trimmed = column.trim()

        const end = trimmed.endsWith(':')
        const start = trimmed.startsWith(':')

        if (end && start) {
            return tt.Alignment.center
        }
        else if (end) {
            return tt.Alignment.right
        }
        else if (start) {
            return tt.Alignment.left
        }
        else {
            return tt.Alignment.default
        }
    }
}

export class MarkdownStringifier implements tt.Stringifier {
    private _reducers = new Map([
        [tt.RowType.data, this._dataRowReducer],
        [tt.RowType.separator, this._separatorReducer],
    ])

    stringify(table: tt.Table, eol: vscode.EndOfLine): string {
        const result = []

        if (table.rows.some(x => x.type === RowType.separator)) {
            table.cols.forEach(x => x.width = Math.max(x.width, 3))
        }

        for (let i = 0; i < table.rows.length; ++i) {
            let rowString = table.prefix
            const rowData = table.getRow(i)
            const reducer = this._reducers.get(table.rows[i].type)
            if (reducer) {
                rowString += rowData.reduce(reducer(table.cols), verticalSeparator)
            }
            result.push(rowString)
        }

        return result.join(convertEOL(eol))
    }

    private _dataRowReducer(cols: tt.ColDef[]): StringReducer {
        return (prev, cur, idx) => {
            const amount = cols[idx].width - cur.length

            const padl = ' '.repeat(Math.ceil(amount / 2))
            const padr = ' '.repeat(Math.floor(amount / 2))

            switch (cols[idx].alignment) {
                case tt.Alignment.right:
                    return prev + ' ' + padl + padr + cur + ' ' + verticalSeparator
                case tt.Alignment.center:
                    return prev + ' ' + padl + cur + padr + ' ' + verticalSeparator
                default:
                    return prev + ' ' + cur + padl + padr + ' ' + verticalSeparator
            }
        }
    }
    
    private _separatorReducer(cols: tt.ColDef[]): StringReducer {
        return (prev, _, idx) => {
            let begin = ALIGN_BEGIN_SPACE
            let ending = ALIGN_END_SPACE
            switch (cols[idx].alignment) {
                case tt.Alignment.left:
                    begin = ALIGN_BEGIN_COLON
                    break
                case tt.Alignment.right:
                    ending = ALIGN_END_COLON
                    break
                case tt.Alignment.center:
                    begin = ALIGN_BEGIN_COLON
                    ending = ALIGN_END_COLON
                    break
                default:
            }
            const middle = horizontalSeparator.repeat(cols[idx].width - 2)

            return prev + begin + middle + ending
        }
    }
}

export class MarkdownLocator implements tt.Locator {
    locate(reader: tt.LineReader, lineNr: number): vscode.Range | undefined {
        const isTableLikeString = (ln: number) => {
            if (ln < 0 || ln >= reader.lineCount) {
                return false
            }

            const token = relaxedParser.getAST(reader.lineAt(ln).text)
            return token !== null && token.errors.length === 0
        }

        let start = lineNr
        while (isTableLikeString(start)) {
            start--
        }

        let end = lineNr
        while (isTableLikeString(end)) {
            end++
        }

        if (start === end) {
            return undefined
        }

        const startPos = reader.lineAt(start + 1).range.start
        const endPos = reader.lineAt(end - 1).range.end

        return new vscode.Range(startPos, endPos)
    }
}

function isSeparatorRowForColumns(columns: string[]): boolean {
    return columns.every(column => isSeparatorColumn(column))
}

function isSeparatorColumn(column: string): boolean {
    return !!column.trim().match(/^[:]?-+[:]?$/)
}

function isSeparatorRow(text: string): boolean {
    const cleaned = text.replace(/\s+/g, '')
    return (cleaned.startsWith('|-') || cleaned.startsWith('|:-'))
        && !!cleaned.match(/^[:|\-\s]+$/)
}

function parseRelaxed(text: string, table: tt.Table): boolean {
    return parse(relaxedParser, text, table)
}

function parse(parser: Parser, textLine: string, table: tt.Table): boolean {
    const ast = parser.getAST(textLine)
    if (!ast || !ast.errors || ast.errors.length !== 0) {
        return false
    }

    for (const line of ast.children) {
        const row = line.children.filter(child => child.type === 'Row')[0]

        const cells = getCellContent(row)

        if (isSeparatorRowForColumns(cells)) {
            table.addRow(tt.RowType.separator, cells)
        }
        else {
            table.addRow(tt.RowType.data, cells)
        }
    }

    return true
}

function getCellContent(row: IToken) {
    const cells: string[] = []
    for (const cell of row.children) {
        if (cell.type === 'EmptyCell') {
            cells.push('')
        }
        else if (cell.type === 'Cell') {
            cells.push(cell.children[0].text.trim())
        }
    }

    const borders = row.children
        .filter(child => child.type === 'CellBorder')
        .length

    for (let i = cells.length; i < borders; i++) {
        cells.push('')
    }

    return cells
}
