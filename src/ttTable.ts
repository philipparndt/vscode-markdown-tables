import * as vscode from 'vscode'

export enum RowType {
    unknown,
    separator,
    data
}

export enum Alignment {
    left,
    center,
    right
}

export interface RowDef {
    type: RowType
}

export interface ColDef {
    alignment: Alignment
    width: number
}

export class Table {
    /**
     * Line where the table starts
     */
    startLine = 0

    /**
     * The table prefix to keep the current indentation
     */
    prefix = ''

    rows: RowDef[] = []
    cols: ColDef[] = []

    private _data: string[][] = []

    addRow(type: RowType, values: string[]) {
        let adjustCount = values.length - this.cols.length
        while (adjustCount-- > 0) {
            this.cols.push({ alignment: Alignment.left, width: 0 })
        }

        for (const row of this._data) {
            const adjustee = row.length < values.length ? row : values
            adjustCount = Math.abs(row.length - values.length)

            while (adjustCount-- > 0) {
                adjustee.push('')
            }
        }

        this.cols.forEach((col, i) => col.width = Math.max(col.width, values[i].length))

        this.rows.push({ type })
        this._data.push(values)
    }

    deleteCol(index: number) {
        this.cols.splice(index, 1)

        for (const row of this._data) {
            row.splice(index, 1)
        }
    }

    addCol(index: number) {
        const newColumn = {
            alignment: Alignment.left,
            width: 0
        }

        this.cols.splice(index, 0, newColumn)

        for (const row of this._data) {
            row.splice(index, 0, '')
        }
    }

    getAt(row: number, col: number): string {
        return this._data[row][col]
    }

    getRow(row: number): string[] {
        return this._data[row]
    }

    setAt(row: number, col: number, value: string) {
        if (this.cols[col].width < value.length) {
            this.cols[col].width = value.length
        }

        this._data[row][col] = value
    }
}

export interface Parser {
    parse(text: string): Table | undefined

    isSeparatorRow(text: string): boolean
}

export interface Stringifier {
    stringify(table: Table, eol: vscode.EndOfLine): string
}

export interface Locator {
    locate(reader: LineReader, lineNr: number): vscode.Range | undefined
}

export interface LineReader {
    lineCount: number

    lineAt(line: number): vscode.TextLine
}

class JumpPosition {
    range: vscode.Range
    next?: JumpPosition
    prev?: JumpPosition

    constructor(start: vscode.Position, end: vscode.Position, public rowType: RowType, prev?: JumpPosition) {
        this.range = new vscode.Range(start, end)

        if (prev) {
            prev.next = this
            this.prev = prev
        }
    }
}

export class TableNavigator {
    private _jumpPositions: JumpPosition[] = []

    constructor(public table: Table) {
        this._jumpPositions = this._buildJumpPositions()
    }

    position(row: number, column: number): vscode.Position | undefined {
        const jumPosition = row * this.table.cols.length + column

        if (jumPosition >= this._jumpPositions.length) {
            return undefined
        }
        else {
            return this._jumpPositions[jumPosition].range.start.translate(0, 1)
        }
    }

    nextCell(cursorPosition: vscode.Position): vscode.Position | undefined {
        return this._jump(cursorPosition, x => x.next!)
    }

    previousCell(cursorPosition: vscode.Position): vscode.Position | undefined {
        return this._jump(cursorPosition, x => x.prev!)
    }

    nextRow(cursorPosition: vscode.Position): vscode.Position | undefined {
        const nextRowJump = this._jumpPositions.find(x => x.range.contains(cursorPosition.translate(1)))
        if (!nextRowJump) {
            return undefined
        }

        return nextRowJump.range.start.translate(0, 1)
    }

    private _jump(currentPosition: vscode.Position, transform: (x: JumpPosition) => JumpPosition): vscode.Position | undefined {
        let jmp = this._jumpPositions.find(x => x.range.contains(currentPosition))
        if (jmp) {
            jmp = transform(jmp)
            if (jmp) {
                return jmp.range.start.translate(0, 1)
            }
        }

        // Maybe we're just outside left part of table? Let's move cursor a bit...
        if (currentPosition.character === 0) {
            return currentPosition.translate(0, 2)
        }
        else {
            return undefined
        }
    }

    private _buildJumpPositions(): JumpPosition[] {
        const result: JumpPosition[] = []

        const tableOffset = this.table.prefix.length
        const cellPadding = 2
        let lastAnchor = 0
        const anchors = this.table.cols.reduce((accum, col) => {
            lastAnchor += col.width + cellPadding + 1
            accum.push(lastAnchor)
            return accum
        }, [lastAnchor])
        // extend last point to "infinity"
        anchors[anchors.length - 1] = 999

        for (let i = 0; i < this.table.rows.length; ++i) {
            const row = this.table.rows[i]
            const rowLine = this.table.startLine + i

            for (let j = 0; j < anchors.length - 1; ++j) {
                const prevJmpPos = result[result.length - 1]
                const start = new vscode.Position(rowLine, anchors[j] + 1 + tableOffset)
                const end = new vscode.Position(rowLine, anchors[j + 1] + tableOffset)
                const jmpPos = new JumpPosition(start, end, row.type, prevJmpPos)
                result.push(jmpPos)
            }
        }
        return result
    }
}
