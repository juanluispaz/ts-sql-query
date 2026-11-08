// The JavaScript functions the documentation gives for the decimal strategies with functions (registered for the
// SQLite cells in test/db/sqlite/runners.ts) give the results of SQLite's decimal extension: the extension is built
// from extensions/decimal.c (ext/misc/decimal.c of SQLite 3.53.0) and loaded on better-sqlite3, and the same
// queries run against it and against the JavaScript functions. Without a C compiler, or without the headers of
// SQLite, the comparison is skipped.

import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { describe, expect, test } from '../../lib/testRunner.js'
import { registerBetterSqlite3DecimalFunctions } from '../../db/sqlite/runners.js'
import { buildSqliteExtension } from './sqliteExtensions.js'

// The extension loaded on better-sqlite3, or why it can't be: building or loading it never fails the run
function loadDecimalExtension(): { real: Database.Database } | { reason: string } {
    const built = buildSqliteExtension('decimal')
    if ('reason' in built) {
        return built
    }
    try {
        const real = new Database(':memory:')
        real.loadExtension(built.path)
        return { real }
    } catch (e) {
        return { reason: 'the decimal extension could not be loaded: ' + (e instanceof Error ? e.message : String(e)) }
    }
}
const extension = loadDecimalExtension()
if ('reason' in extension) {
    console.warn('SqliteDecimalFunctions: the decimal extension of SQLite could not be built, so the comparison is skipped: ' + extension.reason)
}

const values = ['1.50', '1.5', '-0.25', '0', '0.00', '-0', '.5', '007.10', '12345678901234567890.1234567891', '-98765432109876543210.0000000001', '0.0000000001', '3', '-3', '1e3', '2.5E-2', '10']
const nonNull = (a: string, b: string) => [a, b]
const pairs: [string | null, string | null][] = []
for (const a of values) {
    for (const b of values) {
        pairs.push(nonNull(a, b) as [string, string])
    }
}

describe.skipIf('reason' in extension)('SQLite: the JavaScript decimal functions give the results of the decimal extension', () => {
    const real = 'real' in extension ? extension.real : new Database(':memory:')
    const javaScript = new Database(':memory:')
    registerBetterSqlite3DecimalFunctions(javaScript)
    const both = (sql: string, ...args: unknown[]) => [real.prepare(sql).get(...args), javaScript.prepare(sql).get(...args)]

    for (const name of ['decimal_add', 'decimal_sub', 'decimal_mul', 'decimal_cmp']) {
        test(name, () => {
            for (const [a, b] of pairs) {
                if (name === 'decimal_cmp' && (a === '2.5E-2' || b === '2.5E-2')) {
                    // The extension counts the zeros an exponent adds before the digits as digits of the integer part,
                    // so its decimal_cmp('.5', '2.5E-2') is -1; the library sends no exponent, and rejects one it reads
                    continue
                }
                const [fromExtension, fromJavaScript] = both(`select ${name}(?, ?) as v`, a, b)
                expect([a, b, fromJavaScript]).toEqual([a, b, fromExtension])
            }
        })
    }

    test('a-number-of-the-database-as-an-operand', () => {
        for (const sql of ['select decimal_add(1.5, 2) as v', 'select decimal_mul(2, 0.25) as v', 'select decimal_cmp(10, 9.5) as v']) {
            const [fromExtension, fromJavaScript] = both(sql)
            expect([sql, fromJavaScript]).toEqual([sql, fromExtension])
        }
    })

    test('a-null-operand', () => {
        // The extension's decimal_add and decimal_sub fail with "out of memory"; the JavaScript ones return null
        expect(() => real.prepare('select decimal_add(null, ?) as v').get('1')).toThrow('out of memory')
        expect(javaScript.prepare('select decimal_add(null, ?) as v').get('1')).toEqual({ v: null })
        for (const sql of ['select decimal_mul(null, ?) as v', 'select decimal_cmp(null, ?) as v', 'select decimal_cmp(?, null) as v']) {
            const [fromExtension, fromJavaScript] = both(sql, '1')
            expect([sql, fromJavaScript]).toEqual([sql, { v: null }])
            expect([sql, fromExtension]).toEqual([sql, { v: null }])
        }
    })

    test('decimal_sum', () => {
        const cases: (string | null)[][] = [[], [null], [null, null], ['1.5', null], ['1.50', '-1.50'], ['-1.50', '1.50'], ['0.1', '0.2'], ['12345678901234567890.1234567891', '98765432109876543210.9876543210', '-0.25'], ['1.5', '1.5', '1.50'], ['3', '0.000']]
        for (const rows of cases) {
            const union = rows.length === 0 ? "select '1' as v where 0" : rows.map(() => 'select ? as v').join(' union all ')
            for (const sql of [`select decimal_sum(v) as v from (${union})`, `select decimal_sum(distinct v) as v from (${union})`]) {
                const [fromExtension, fromJavaScript] = both(sql, ...rows)
                expect([sql, rows, fromJavaScript]).toEqual([sql, rows, fromExtension])
            }
        }
    })

    test('decimal_sum-by-group', () => {
        const sql = "select g, decimal_sum(v) as v from (select 1 as g, '1.5' as v union all select 1, '2.25' union all select 2, null union all select 2, '-0.5') group by g order by g"
        expect(javaScript.prepare(sql).all()).toEqual(real.prepare(sql).all())
    })
})

describe('SQLite: the decimal functions of the documentation', () => {
    const read = (path: string) => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8')
    const module = readFileSync(new URL('../../db/sqlite/decimalFunctions.ts', import.meta.url), 'utf8')
    const runners = readFileSync(new URL('../../db/sqlite/runners.ts', import.meta.url), 'utf8')
    // The names given to db.function, db.aggregate, db.createFunction and the aggregate helper of sqlite-wasm
    const registeredNames = (code: string) => [...code.matchAll(/(?:\.function|\.aggregate|\.createFunction|aggregate)(?:<[^>]*>)?\(\s*'([a-z_]+)'/g)].map(match => match[1]).sort()
    const pages = [
        { page: 'docs/configuration/supported-databases/sqlite.md', register: undefined },
        { page: 'docs/configuration/query-runners/recommended/better-sqlite3.md', register: 'registerBetterSqlite3DecimalFunctions' },
        { page: 'docs/configuration/query-runners/recommended/bun_sqlite.md', register: 'registerBunSqliteDecimalFunctions' },
        { page: 'docs/configuration/query-runners/recommended/node_sqlite.md', register: 'registerNodeSqliteDecimalFunctions' },
        { page: 'docs/configuration/query-runners/recommended/sqlite-wasm-OO1.md', register: 'registerSqlite3WasmOO1DecimalFunctions' },
    ]
    for (const { page, register } of pages) {
        test(page, () => {
            const text = read(page)
            // The block "decimalFunctions.ts" of the page is test/db/sqlite/decimalFunctions.ts as it is
            const start = text.indexOf('```typescriptreact title="decimalFunctions.ts"\n')
            expect(start).toBeGreaterThanOrEqual(0)
            const block = text.substring(text.indexOf('\n', start) + 1, text.indexOf('\n```\n', start) + 1)
            expect(block).toBe(module)
            if (register) {
                // The snippet after it registers the functions the cells register, by the same names
                const snippetStart = text.indexOf('```typescriptreact\n', start + block.length)
                const snippet = text.substring(snippetStart, text.indexOf('\n```\n', snippetStart))
                const registration = runners.substring(runners.indexOf('function ' + register + '('), runners.indexOf('\n}\n', runners.indexOf('function ' + register + '(')))
                expect(registeredNames(snippet)).toEqual(registeredNames(registration))
            }
        })
    }
})
