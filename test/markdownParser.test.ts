import { IToken } from "ebnf"

import * as assert from 'assert';
import { markdownTableParser as parser} from "../src/markdownParser";

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


});
