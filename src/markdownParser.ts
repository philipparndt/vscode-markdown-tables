import { Grammars, Parser } from 'ebnf';

const rowGrammar = `
    Row          ::= CellBorder Cell+
    Cell         ::= CellContent CellBorder
    CellContent  ::= CHAR*
    CHAR         ::= UNESCAPED | ESCAPE ESCAPABLE
    ESCAPABLE    ::= CellBorder
    CellBorder   ::= '|'
    ESCAPE       ::= #x5C /* \\ */
    UNESCAPED    ::= [#x09] | [#x20-#x5B] | [#x5D-#x7B] | [#x7D-#xFFFF]
    `;
    
const tableGrammar = `
    Table         ::= Line+
    Line          ::= WS* Row WS*
    WS            ::= [#x20#x09#x0A#x0D]+   /* Space | Tab | \\n | \\r */
    ${rowGrammar}
    `;

export const markdownTableParser = new Parser(Grammars.W3C.getRules(tableGrammar), {});
