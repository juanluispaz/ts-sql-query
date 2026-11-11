/**
 * The params as better-sqlite3, node:sqlite and sqlite-wasm receive them: they reject a JavaScript boolean, so it goes
 * as 1 or 0, the value SQLite stores for it (bun:sqlite and Bun SQL bind a boolean as 1 or 0 themselves). The params of the query keep the value the connection
 * handed; a copy is returned when a value changes.
 */
export function sqliteDriverParams(params: any[]): any[] {
    let result: any[] | undefined = undefined
    for (let i = 0, length = params.length; i < length; i++) {
        const value = params[i]
        if (typeof value !== 'boolean') {
            continue
        }
        if (!result) {
            result = params.slice()
        }
        result[i] = Number(value)
    }
    return result ?? params
}
