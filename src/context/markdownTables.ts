import * as vscode from 'vscode'
import { ContextType, enterContext, exitContext } from './context'

export const enterMarkdownTables = () => {
    const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor
    if (editor) {
        enterContext(editor, ContextType.markdownTables)
    }
}

export const exitMarkdownTables = () => {
    const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor
    if (editor) {
        exitContext(editor, ContextType.markdownTables)
    }
}
