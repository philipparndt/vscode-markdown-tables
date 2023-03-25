import * as vscode from "vscode"
import * as voca from "voca"

export const tableSizeRe = /^(\d+)x(\d+)$/u

export function convertEOL(eol: vscode.EndOfLine): string {
    if (eol === vscode.EndOfLine.CRLF) {
        return "\r\n"
    }
    else {
        return "\n"
    }
}

export function findTablePrefix(text: string, tableStart: string): string {
    const startIndex = text.indexOf(tableStart)

    if (startIndex > 0) {
        return voca.trim(text.substring(0, startIndex), "\r\n")
    }
    else {
        return ""
    }
}
