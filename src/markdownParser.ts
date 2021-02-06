import { Grammars, Parser } from 'ebnf';

const cellContentGrammar = `
    CellContent  ::= CHAR*
    CHAR         ::= UNESCAPED | ESCAPE ESCAPABLE
    ESCAPABLE    ::= CellBorder
    CellBorder   ::= '|'
    ESCAPE       ::= #x5C /* \\ */
    UNESCAPED    ::= [#x09] | [#x20-#x5B] | [#x5D-#x7B] | [#x7D-#xFFFF]
    `;
    
const rowGrammar = `
    Row           ::= CellBorder Cell+
    Cell          ::= CellContent CellBorder
    ${cellContentGrammar}
    `;

const relaxedRowGrammar = `
    Row           ::= CellBorder (Cell|EmptyCell)*
    Cell          ::= CellContent CellBorder*
    EmptyCell     ::= CellBorder
    ${cellContentGrammar}
    `;

const strictTableGrammar = `
    Table         ::= Line+
    Line          ::= WS* Row WS*
    WS            ::= [#x20#x09#x0A#x0D]+   /* Space | Tab | \\n | \\r */
    ${rowGrammar}
    `;

const relaxedTableGrammar = `
    Table         ::= Line+
    Line          ::= WS* Row WS*
    WS            ::= [#x20#x09#x0A#x0D]+   /* Space | Tab | \\n | \\r */
    ${relaxedRowGrammar}
    `;

export const markdownTableParser = new Parser(Grammars.W3C.getRules(strictTableGrammar), {});
export const relaxedTableParser = new Parser(Grammars.W3C.getRules(relaxedTableGrammar), {});
