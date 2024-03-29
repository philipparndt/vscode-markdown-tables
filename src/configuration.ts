import * as vscode from "vscode"

export const section = "text-tables"

export const modeKey = "mode"
export const showStatusKey = "showStatus"

export interface Configuration {
    showStatus: boolean
}

export function build(): Configuration {
    const c = vscode.workspace.getConfiguration(section)

    return {
        showStatus: c.get<boolean>(showStatusKey, true)
    }
}

export async function override(overrides: any) {
    const c = vscode.workspace.getConfiguration(section)
    for (const k of Object.keys(overrides)) {
        await c.update(k, overrides[k], false)
    }
}
