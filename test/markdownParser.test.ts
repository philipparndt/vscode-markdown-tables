import { IToken } from "ebnf"

import * as assert from 'assert';
import { relaxedTableParser as parser} from "../src/markdownParser";
import { MarkdownParser } from "../src/ttMarkdown";
import { Table } from "../src/ttTable";

const cellContentOfTable = (ast: IToken) => {
    const result = []
    for (const line of ast.children) {
        const row = line.children.filter(child => child.type === "Row")[0]
        const cells = row.children
            .filter(child => child.type === "Cell")
            .map(cell => cell.children[0])
            .map(cellContent => cellContent.text)

        result.push(cells)
    }
    return result
}

const cellContentOfttTable = (table: Table | undefined) => {
    const result: string[][] = []

    if (!table) {
        return result;
    }

    for (let i = 0; i < table.rows.length; i++) {
        result.push(table.getRow(i));
    }
    return result
}

suite('Markdown parser', () => {

    test('parse table - one line', () => {
        const cleaned = "| A | B |\n"
        const ast = parser.getAST(cleaned)

        assert.deepStrictEqual(cellContentOfTable(ast), [[" A ", " B "]]);
    });

    test('parse table', () => {
        const cleaned = "| A | B |\n| C | D |"
        const ast = parser.getAST(cleaned)

        assert.deepStrictEqual(cellContentOfTable(ast), [[" A ", " B "], [" C ", " D "]]);
    });

    test('parse table - with escaped content', () => {
        const cleaned = "| A\\|B | C |\n| D | E |"
        const ast = parser.getAST(cleaned)

        assert.deepStrictEqual(cellContentOfTable(ast), [[" A\\|B ", " C "], [" D ", " E "]]);
    });

    test('parse incomplete table', () => {
        const cleaned = `
        | A\\|B | C | D |
        |
        | E | F | G |
        `

        const parser = new MarkdownParser();
        const table = parser.parse(cleaned);
        assert.deepStrictEqual(cellContentOfttTable(table), [
            ["A\\|B", "C", "D"], 
            ["", "", ""], 
            ["E", "F", "G"]
        ]);
    });

    test('parse incomplete table', () => {
        const cleaned = `
        | hi   | there    |
        | 4   | \\|
        `

        const parser = new MarkdownParser();
        const table = parser.parse(cleaned);
        assert.deepStrictEqual(cellContentOfttTable(table), [
            ["hi", "there"], 
            ["4", "\\|"], 
        ]);
    });

    test('parse empty cells', () => {
        const cleaned = `
        | a | b |
        |||
        | c | d |
        `

        const parser = new MarkdownParser();
        const table = parser.parse(cleaned);
        assert.deepStrictEqual(cellContentOfttTable(table), [
            ["a", "b"],
            ["", ""],
            ["c", "d"], 
        ]);
    });

    test('parse additional cell', () => {
        const cleaned = `
        | a | b ||
        |||
        | c | d |
        `

        const parser = new MarkdownParser();
        const table = parser.parse(cleaned);
        assert.deepStrictEqual(cellContentOfttTable(table), [
            ["a", "b", ""],
            ["", "", ""],
            ["c", "d", ""], 
        ]);
    });
});

    test('parse alignment', () => {
        const cleaned = `
        | default | left | right | center |
        | ------- |:---- | -----:|:------:|
        |         |      |       |        |
        `

        const parser = new MarkdownParser()
        const table = parser.parse(cleaned)

        assert.equal(table!.cols[0].alignment, Alignment.default)
        assert.equal(table!.cols[1].alignment, Alignment.left)
        assert.equal(table!.cols[2].alignment, Alignment.right)
        assert.equal(table!.cols[3].alignment, Alignment.center)
    })
})
