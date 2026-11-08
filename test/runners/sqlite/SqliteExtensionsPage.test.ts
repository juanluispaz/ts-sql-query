// The page of the documentation on SQLite's functions and extensions: its compile commands for macOS and Linux are the
// ones the tests build the extensions with, its math functions answer on every driver, and its loading steps work
// on the drivers of this runtime (an extension built by the tests, loaded and called).

import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { describe, expect, test } from '../../lib/testRunner.js'
import { buildSqliteExtension, sqliteExtensionCompileCommand } from './sqliteExtensions.js'

const page = readFileSync(fileURLToPath(new URL('../../../docs/configuration/supported-databases/sqlite-extensions.md', import.meta.url)), 'utf8')
const isBun = typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined'

// The `cc` lines of a tab of the page, with the indentation of the tab removed
function compileLines(tab: string): string[] {
    const start = page.indexOf('=== "' + tab + '"')
    const end = page.indexOf('\n=== ', start + 1)
    return page.substring(start, end < 0 ? undefined : end).split('\n').map(line => line.trim()).filter(line => line.startsWith('cc '))
}

describe('SQLite extensions page', () => {
    test('the-compile-commands-are-the-ones-the-tests-use', () => {
        const include = 'sqlite-amalgamation-3530000'
        for (const [tab, platform, suffix] of [['macOS', 'darwin', 'dylib'], ['Linux', 'linux', 'so']] as const) {
            const expected = ['decimal', 'uuid'].map(name => sqliteExtensionCompileCommand(platform, include, name + '.' + suffix, name + '.c').join(' '))
            expect([tab, compileLines(tab)]).toEqual([tab, expected])
        }
    })

    test('the-math-functions-are-built-in', () => {
        const db = new Database(':memory:')
        expect(db.prepare('select sqrt(16) as s, power(2, 10) as p, ln(1) as l, sin(0) as si, log10(100) as lg, round(pi(), 5) as pi').get()).toEqual({ s: 4, p: 1024, l: 0, si: 0, lg: 2, pi: 3.14159 })
        db.close()
    })

    const decimal = buildSqliteExtension('decimal')
    test.skipIf('reason' in decimal)('better-sqlite3-loads-the-built-extension', () => {
        const db = new Database(':memory:')
        db.loadExtension((decimal as { path: string }).path)
        expect(db.prepare("select decimal_add('0.1', '0.2') as v").get()).toEqual({ v: '0.3' })
        db.close()
    })

    test.skipIf('reason' in decimal || isBun)('node-sqlite-loads-the-built-extension-only-with-allowExtension', async () => {
        const { DatabaseSync } = await import('node:sqlite')
        const refused = new DatabaseSync(':memory:')
        expect(() => refused.loadExtension((decimal as { path: string }).path)).toThrow()
        const db = new DatabaseSync(':memory:', { allowExtension: true })
        db.loadExtension((decimal as { path: string }).path)
        expect(db.prepare("select decimal_add('0.1', '0.2') as v").get()).toEqual({ v: '0.3' })
    })

    // setCustomSQLite works only before the first Database of the process, so it runs in a process of its own
    const homebrewSqlite = '/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib'
    test.skipIf('reason' in decimal || !isBun || (process.platform === 'darwin' && !existsSync(homebrewSqlite)))('bun-sqlite-loads-the-built-extension', () => {
        const path = (decimal as { path: string }).path
        const script = process.platform === 'darwin'
            ? `import { Database } from 'bun:sqlite'; Database.setCustomSQLite(${JSON.stringify(homebrewSqlite)}); const db = new Database(':memory:'); db.loadExtension(${JSON.stringify(path)}); console.log(db.query("select decimal_add('0.1', '0.2') as v").get().v)`
            : `import { Database } from 'bun:sqlite'; const db = new Database(':memory:'); db.loadExtension(${JSON.stringify(path)}); console.log(db.query("select decimal_add('0.1', '0.2') as v").get().v)`
        const run = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' })
        expect([run.status, run.stdout.trim()]).toEqual([0, '0.3'])
    })
})
