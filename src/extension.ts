"use strict"

import * as vscode from "vscode"
import * as utils from "./utils"
import * as cmd from "./commands"
import { Locator, Parser, Stringifier, Table } from "./ttTable"
import { MarkdownLocator, MarkdownParser, MarkdownStringifier } from "./ttMarkdown"
import { registerContext, ContextType, enterContext, exitContext, restoreContext, toggleContext, updateSelectionContext } from "./context/context"
import * as cfg from "./configuration"
import { enterMarkdownTables, exitMarkdownTables } from "./context/markdownTables"

let locator: Locator
let parser: Parser
let stringifier: Stringifier
let configuration: cfg.Configuration

function loadConfiguration() {
    configuration = cfg.build()

    locator = new MarkdownLocator()
    parser = new MarkdownParser()
    stringifier = new MarkdownStringifier()
}

export function activate(ctx: vscode.ExtensionContext) {
    loadConfiguration()
    registerContext(ContextType.inTable, "Cursor in table")
    registerContext(ContextType.potentiallyInTable, "Cursor potentially in table")
    registerContext(ContextType.markdownTables, "Markdown tables")

    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left)

    registerContext(ContextType.tableMode, "Table", statusItem)
    statusItem.command = "text-tables.tableModeToggle"

    enterMarkdownTables()

    if (configuration.showStatus) {
        statusItem.show()
    }

    vscode.workspace.onDidChangeConfiguration(() => {
        loadConfiguration()

        if (configuration.showStatus) {
            statusItem.show()
        }
        else {
            statusItem.hide()
        }
    })

    vscode.window.onDidChangeActiveTextEditor(e => {
        if (e) {
            restoreContext(e)
        }
    })

    ctx.subscriptions.push(vscode.commands.registerCommand("text-tables.enable", () => {
        if (configuration.showStatus) {
            statusItem.show()
        }
        enterMarkdownTables()

        vscode.window.showInformationMessage("Markdown tables enabled!")
    }))

    ctx.subscriptions.push(vscode.commands.registerCommand("text-tables.disable", () => {
        statusItem.hide()

        const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor
        if (editor) {
            exitContext(editor, ContextType.tableMode)
        }
        exitMarkdownTables()

        vscode.window.showInformationMessage("Markdown tables disabled!")
    }))

    ctx.subscriptions.push(vscode.commands.registerTextEditorCommand("text-tables.tableModeOn",
        (e) => enterContext(e, ContextType.tableMode)))
    ctx.subscriptions.push(vscode.commands.registerTextEditorCommand("text-tables.tableModeOff",
        (e) => exitContext(e, ContextType.tableMode)))
    ctx.subscriptions.push(vscode.commands.registerTextEditorCommand("text-tables.tableModeToggle",
        (e) => toggleContext(e, ContextType.tableMode)))
    
    ctx.subscriptions.push(registerTableCommand("text-tables.moveRowDown", cmd.moveRowDown, {format: true}))
    ctx.subscriptions.push(registerTableCommand("text-tables.moveRowUp", cmd.moveRowUp, {format: true}))
    ctx.subscriptions.push(registerTableCommand("text-tables.createSeparator", async (editor, range, table) => {
        await cmd.createSeparator(editor, range, table, stringifier)
    }))
    ctx.subscriptions.push(registerTableCommand("text-tables.moveColRight", async (editor, range, table) => {
        await cmd.moveColRight(editor, range, table, stringifier)
    }))
    ctx.subscriptions.push(registerTableCommand("text-tables.moveColLeft", async (editor, range, table) => {
        await cmd.moveColLeft(editor, range, table, stringifier)
    }))
    ctx.subscriptions.push(registerTableCommand("text-tables.createColLeft", async (editor, range, table) => {
        await cmd.createColumnOnLeft(editor, range, table, stringifier)
    }))
    ctx.subscriptions.push(registerTableCommand("text-tables.deleteColumn", async (editor, range, table) => {
        await cmd.deleteColumn(editor, range, table, stringifier)
    }))

    ctx.subscriptions.push(vscode.commands.registerTextEditorCommand("text-tables.clearCell",
        (e, ed) => cmd.clearCell(e, ed, parser)))

    ctx.subscriptions.push(registerTableCommand("text-tables.gotoNextCell", async (editor, range, table) => {
        await cmd.gotoNextCell(editor, range, table, stringifier)
    }))

    ctx.subscriptions.push(registerTableCommand("text-tables.gotoPreviousCell", cmd.gotoPreviousCell, {format: true}))
    ctx.subscriptions.push(registerTableCommand("text-tables.nextRow", async (editor, range, table) => {
        await cmd.nextRow(editor, range, table, stringifier)
    }))

    // Format table under cursor
    ctx.subscriptions.push(registerTableCommand("text-tables.formatUnderCursor",
        (editor, range, table) => cmd.formatUnderCursor(editor, range, table, stringifier)))

    ctx.subscriptions.push(vscode.commands.registerTextEditorCommand("text-tables.createTable", async editor => {
        const opts: vscode.InputBoxOptions = {
            value: "5x2",
            prompt: "Table size Columns x Rows (e.g. 5x2)",
            validateInput: (value: string) => {
                if (!utils.tableSizeRe.test(value)) {
                    return "Provided value is invalid. Please provide the value in format Columns x Rows (e.g. 5x2)"
                }
                return
            }
        }

        const size = await vscode.window.showInputBox(opts)
        if (size) {
            const match = size.match(utils.tableSizeRe)
            if (match) {
                const cols = +match[1] || 1
                const rows = +match[2] || 2
                cmd.createTable(rows, cols, editor, stringifier)
            }
        }
    }))

    // Register listeners for the table selection context
    ctx.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateSelectionContext))
    ctx.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(updateSelectionContext))
    updateSelectionContext()
}

export function deactivate() {
}

type TableCommandCallback = (editor: vscode.TextEditor, tableLocation: vscode.Range, table: Table) => Thenable<void>

function registerTableCommand(command: string, callback: TableCommandCallback, options?: {format: boolean}) {
    return vscode.commands.registerCommand(command, async () => {
        const editor = vscode.window.activeTextEditor

        if (editor === undefined) {
            return
        }

        const tableRange = locator.locate(editor.document, editor.selection.start.line)
        if (tableRange === undefined) {
            return
        }
        const selectedText = editor.document.getText(tableRange)
        const table = parser.parse(selectedText)

        if (table === undefined) {
            return
        }

        table.startLine = tableRange.start.line

        if (options && options.format) {
            await cmd.formatUnderCursor(editor, tableRange, table, stringifier)
        }

        await callback(editor, tableRange, table)
    })
}
