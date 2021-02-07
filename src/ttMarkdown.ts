import * as tt from './ttTable';
import * as vscode from 'vscode';
import { RowType } from './ttTable';
import { convertEOL, findTablePrefix } from './utils';
import { relaxedTableParser as relaxedParser} from '../src/markdownParser';
import { IToken, Parser } from 'ebnf';

const verticalSeparator = '|';
const horizontalSeparator = '-';

type StringReducer = (previous: string, current: string, index: number) => string;

export class MarkdownParser implements tt.Parser {
    parse(text: string): tt.Table | undefined {
        if (!text || text.length === 0) {
            return undefined;
        }

        const result = new tt.Table();
        result.prefix = findTablePrefix(text, verticalSeparator);

        const lines = text.split('\n').map(x => x.trim()).filter(x => x.startsWith(verticalSeparator));
    
        for (const line of lines) {
            parseRelaxed(line, result);
        }

        if (result.rows.some(x => x.type === RowType.Separator)) {
            result.cols.forEach(x => x.width = Math.max(x.width, 3));
        }

        return result;
    }

    isSeparatorRow(text: string): boolean {
        return isSeparatorRow(text);
    }

    getAlignment(column: string): tt.Alignment {
        const trimmed = column.trim();
        
        const end = trimmed.endsWith(':');
        const start = trimmed.startsWith(':');

        if (end && start) {
            return tt.Alignment.Center;
        } else if (end) {
            return tt.Alignment.Right;
        } else if (start) {
            return tt.Alignment.Left;
        } else {
            return tt.Alignment.Left; // Should be default
        }
    }
}

export class MarkdownStringifier implements tt.Stringifier {
    private reducers = new Map([
        [tt.RowType.Data, this.dataRowReducer],
        [tt.RowType.Separator, this.separatorReducer],
    ]);

    stringify(table: tt.Table, eol: vscode.EndOfLine): string {
        const result = [];

        if (table.rows.some(x => x.type === RowType.Separator)) {
            table.cols.forEach(x => x.width = Math.max(x.width, 3));
        }

        for (let i = 0; i < table.rows.length; ++i) {
            let rowString = table.prefix;
            const rowData = table.getRow(i);
            const reducer = this.reducers.get(table.rows[i].type);
            if (reducer) {
                rowString += rowData.reduce(reducer(table.cols), verticalSeparator);
            }
            result.push(rowString);
        }

        return result.join(convertEOL(eol));
    }

    private dataRowReducer(cols: tt.ColDef[]): StringReducer {
        return (prev, cur, idx) => {
            const pad = ' '.repeat(cols[idx].width - cur.length + 1);
            return prev + ' ' + cur + pad + verticalSeparator;
        };
    }

    private separatorReducer(cols: tt.ColDef[]): StringReducer {
        return (prev, _, idx) => {
            const begin = cols[idx].alignment === tt.Alignment.Center
                ? ':-'
                : ' -';
            const ending = cols[idx].alignment !== tt.Alignment.Left
                ? '-:' + verticalSeparator
                : '- ' + verticalSeparator;

            const middle = horizontalSeparator.repeat(cols[idx].width - 2);

            return prev + begin + middle + ending;
        };
    }
}

export class MarkdownLocator implements tt.Locator {
    locate(reader: tt.LineReader, lineNr: number): vscode.Range | undefined {
        const isTableLikeString = (ln: number) => {
            if (ln < 0 || ln >= reader.lineCount) {
                return false;
            }
            const firstCharIdx = reader.lineAt(ln).firstNonWhitespaceCharacterIndex;
            const firstChar = reader.lineAt(ln).text[firstCharIdx];
            return firstChar === '|';
        };

        let start = lineNr;
        while (isTableLikeString(start)) {
            start--;
        }

        let end = lineNr;
        while (isTableLikeString(end)) {
            end++;
        }

        if (start === end) {
            return undefined;
        }

        const startPos = reader.lineAt(start + 1).range.start;
        const endPos = reader.lineAt(end - 1).range.end;

        return new vscode.Range(startPos, endPos);
    }
}

function isSeparatorRowForColumns(columns: string[]): boolean {
    return columns.every(column => isSeparatorColumn(column));
}

function isSeparatorColumn(column: string): boolean {
    return column.trim().match(/^[:]{0,1}-+[:]{0,1}$/) ? true : false;
}

function isSeparatorRow(text: string): boolean {
    const cleaned = text.replace(/\s+/g, '');
    return (cleaned.startsWith('|-') || cleaned.startsWith('|:-')) && cleaned.match(/^[:|-\s]+$/) ? true : false;
}

function parseRelaxed(text: string, table: tt.Table): boolean {
    return parse(relaxedParser, text, table);
}

function parse(parser: Parser, textLine: string, table: tt.Table): boolean {
    const ast = parser.getAST(textLine);
    if (!ast || !ast.errors || ast.errors.length !== 0) {
        return false;
    }

    for (const line of ast.children) {
        const row = line.children.filter(child => child.type === 'Row')[0];

        const cells = getCellContent(row);

        if (isSeparatorRowForColumns(cells)) {
            table.addRow(tt.RowType.Separator, cells);
        } else {
            table.addRow(tt.RowType.Data, cells);
        }
    }

    return true;
}

function getCellContent(row: IToken) {
    const cells: string[] = [];
    for (const cell of row.children) {
        if (cell.type === 'EmptyCell') {
            cells.push('');
        } else if (cell.type === 'Cell') {
            cells.push(cell.children[0].text.trim());
        }
    }

    const borders = row.children
    .filter(child => child.type === 'CellBorder')
    .length;

    for (let i = cells.length; i < borders; i++) {
        cells.push('');
    }

    return cells;
}
