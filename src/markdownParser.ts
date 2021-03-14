import { Grammars, Parser } from 'ebnf'

const cellContentGrammar = `
    CellContent  ::= CHAR*
    CHAR         ::= UNESCAPED | ESCAPE ESCAPABLE
    ESCAPABLE    ::= CellBorder
    CellBorder   ::= '|'
    ESCAPE       ::= #x5C /* \\ */
    UNESCAPED    ::= [#x09] | [#x20-#x5B] | [#x5D-#x7B] | [#x7D-#xFFFF]
    `

const relaxedRowGrammar = `
    Row            ::= CellBorder (EmptyCell|Cell)*
    Cell           ::= CellContent (CellBorder)?
    EmptyCell      ::= CellBorder
    ${cellContentGrammar}
    `

const relaxedTableGrammar = `
    Table         ::= Line+
    Line          ::= WS* Row WS*
    WS            ::= [#x20#x09#x0A#x0D]+   /* Space | Tab | \\n | \\r */
    ${relaxedRowGrammar}
    `

export const relaxedTableParser = new Parser(Grammars.W3C.getRules(relaxedTableGrammar), {})
