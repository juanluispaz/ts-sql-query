// registerSqliteFunctions of each SQLite query runner whose driver registers functions written in JavaScript
// (better-sqlite3, node:sqlite, bun:sqlite, sqlite-wasm): the functions are there with hand-written SQL, decimal_sum
// works as a window function, the deterministic ones serve an index on an expression, and uuid() isn't deterministic.
// With trusted_schema off, SQLite takes in the schema only the functions marked innocuous, which only sqlite-wasm can
// mark.

import { describe, expect, test } from '../../lib/testRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'

type Rows = Record<string, unknown>[]
interface Driver {
    name: string
    enabled: boolean
    open(options?: { before?: 'ci_replace of my own', skip?: string[] }): Promise<{ all(sql: string, ...params: unknown[]): Rows, run(sql: string): void, close(): void, hadUuid: boolean }>
}

// A database whose SQLite has the uuid extension built in (the one of Bun) already has uuid(), a version 4 UUID
const uuidListed = "select name from pragma_function_list where name = 'uuid'"

const isBun = typeof globalThis.Bun !== 'undefined'
const nodeSqliteAvailable = await import('node:sqlite').then(() => true, () => false)

const drivers: Driver[] = [
    {
        name: 'better-sqlite3',
        enabled: isRealDbEnabled('sqlite', 'native', 'newest', 'better-sqlite3'),
        async open(options) {
            const Database = (await import('better-sqlite3')).default
            const { registerSqliteFunctions } = await import('../../../src/queryRunners/BetterSqlite3QueryRunner.js')
            const db = new Database(':memory:')
            const hadUuid = db.prepare(uuidListed).all().length > 0
            if (options?.before) db.function('ci_replace', (_source: unknown, _find: unknown, _replacement: unknown) => 'mine')
            registerSqliteFunctions(db, options?.skip ? { skip: options.skip } : undefined)
            return { all: (sql, ...params) => db.prepare(sql).all(...params) as Rows, run: sql => { db.exec(sql) }, close: () => { db.close() }, hadUuid }
        },
    },
    {
        name: 'node:sqlite',
        enabled: nodeSqliteAvailable && isRealDbEnabled('sqlite', 'native', 'newest', 'node_sqlite'),
        async open(options) {
            const { DatabaseSync } = await import('node:sqlite')
            const { registerSqliteFunctions } = await import('../../../src/queryRunners/NodeSqliteQueryRunner.js')
            const db = new DatabaseSync(':memory:')
            const hadUuid = db.prepare(uuidListed).all().length > 0
            if (options?.before) db.function('ci_replace', (_source: unknown, _find: unknown, _replacement: unknown) => 'mine')
            registerSqliteFunctions(db, options?.skip ? { skip: options.skip } : undefined)
            return { all: (sql, ...params) => db.prepare(sql).all(...(params as never[])) as Rows, run: sql => { db.exec(sql) }, close: () => { db.close() }, hadUuid }
        },
    },
    {
        name: 'bun:sqlite',
        enabled: isBun && isRealDbEnabled('sqlite', 'native', 'newest', 'bun_sqlite'),
        async open(options) {
            const { Database } = await import('bun:sqlite')
            const { registerSqliteFunctions } = await import('../../../src/queryRunners/BunSqliteQueryRunner.js')
            const db = new Database(':memory:')
            const hadUuid = db.query(uuidListed).all().length > 0
            if (options?.before) db.function('ci_replace', (_source: unknown, _find: unknown, _replacement: unknown) => 'mine')
            registerSqliteFunctions(db, options?.skip ? { skip: options.skip } : undefined)
            return { all: (sql, ...params) => db.query(sql).all(...(params as never[])) as Rows, run: sql => { db.run(sql) }, close: () => { db.close() }, hadUuid }
        },
    },
    {
        name: 'sqlite-wasm',
        enabled: isRealDbEnabled('sqlite', 'wasm', 'newest', 'sqlite-wasm-OO1'),
        async open(options) {
            const sqlite3 = await (await import('@sqlite.org/sqlite-wasm')).default()
            const { registerSqliteFunctions } = await import('../../../src/queryRunners/Sqlite3WasmOO1QueryRunner.js')
            const db = new sqlite3.oo1.DB(':memory:', 'c')
            const hadUuid = db.selectObjects(uuidListed).length > 0
            if (options?.before) db.createFunction('ci_replace', () => 'mine', { arity: 3 })
            registerSqliteFunctions(db, sqlite3, options?.skip ? { skip: options.skip } : undefined)
            return { all: (sql, ...params) => db.selectObjects(sql, params as never) as Rows, run: sql => { db.exec(sql) }, close: () => { db.close() }, hadUuid }
        },
    },
]

// 30-digit decimals and the sums they give, computed exactly with bigint (10 decimals)
const values = ['123456789012345678901234567890.1', '0.0000000001', '-5.25', '99999999999999999999.99', '1.50', '-123456789012345678901234567890.0000000001']
const scaled = (value: string) => {
    const negative = value.startsWith('-')
    const [integerPart, fraction = ''] = value.replace('-', '').split('.')
    const digits = BigInt(integerPart! + fraction.padEnd(10, '0'))
    return negative ? -digits : digits
}
const text = (digits: bigint) => {
    const negative = digits < 0n
    const absolute = (negative ? -digits : digits).toString().padStart(11, '0')
    return (negative ? '-' : '') + absolute.substring(0, absolute.length - 10) + '.' + absolute.substring(absolute.length - 10)
}
const tableOfValues = 'with t(i, v) as (values ' + values.map((v, i) => `(${i + 1}, '${v}')`).join(', ') + ')'

for (const driver of drivers) {
    describe.skipIf(!driver.enabled)('registerSqliteFunctions on ' + driver.name, () => {
        test('the-decimal-and-tsq-functions', async () => {
            const db = await driver.open()
            try {
                expect(db.all("select decimal_add('0.1', '0.2') as a, decimal_sub('1.50', '1.5') as s, decimal_mul('1.50', '2.00') as m, decimal_cmp('1.50', '1.5') as c")).toEqual([{ a: '0.3', s: '0.00', m: '3.00', c: 0 }])
                expect(db.all("select tsq_decimal_round('2.345', 2) as r, tsq_decimal_ceil('-1.5') as c, tsq_decimal_floor('-1.5') as f, tsq_decimal_mod('5.5', '2') as m, tsq_decimal_abs('-0.25') as a")).toEqual([{ r: '2.35', c: '-1', f: '-2', m: '1.5', a: '0.25' }])
                expect(db.all("select tsq_decimal_key('1.5') = tsq_decimal_key('1.50') as same, tsq_decimal_key('9') < tsq_decimal_key('10') as ordered, tsq_decimal_key('-10') < tsq_decimal_key('-9') as negatives")).toEqual([{ same: 1, ordered: 1, negatives: 1 }])
                expect(db.all(tableOfValues + ' select decimal_sum(v) as s, tsq_decimal_min(v) as mn, tsq_decimal_max(v) as mx from t')).toEqual([{ s: text(values.reduce((sum, v) => sum + scaled(v), 0n)), mn: values[5], mx: values[0] }])
            } finally {
                db.close()
            }
        })

        test('decimal_sum-as-a-window-function', async () => {
            const db = await driver.open()
            try {
                const rows = db.all(tableOfValues + ' select decimal_sum(v) over (order by i) as running, decimal_sum(v) over (order by i rows between 2 preceding and current row) as sliding from t order by i')
                const expected = values.map((_, i) => ({
                    running: values.slice(0, i + 1).reduce((sum, v) => sum + scaled(v), 0n),
                    sliding: values.slice(Math.max(0, i - 2), i + 1).reduce((sum, v) => sum + scaled(v), 0n),
                }))
                // The sum keeps the largest scale seen, 10 decimals here once the second row is in
                expect(rows.map(row => ({ running: scaled(row['running'] as string), sliding: scaled(row['sliding'] as string) }))).toEqual(expected)
            } finally {
                db.close()
            }
        })

        test('the-uuid-functions-and-ci_replace', async () => {
            const db = await driver.open()
            try {
                const [row] = db.all("select uuid() as u, uuid_str(uuid_blob('{A0EEBC99-9C0B4EF8-BB6D-6BB9BD380A11}')) as s, typeof(uuid_blob('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')) as t, uuid_blob('nope') as invalid, uuid_str(null) as n, ci_replace('Hello hello', 'HELLO', 'x') as r")
                // The library's uuid() is a version 7 UUID; the one the database already has is left
                expect(row!['u']).toMatch(db.hadUuid ? /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/ : /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
                expect({ ...row, u: undefined }).toEqual({ u: undefined, s: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', t: 'blob', invalid: null, n: null, r: 'x x' })
                // uuid() generates a new value each time. A version 7 UUID starts with the time it was generated, which
                // never goes back; within the same millisecond the order depends on the generator of the runtime
                const generated = db.all('with recursive n(i) as (select 1 union all select i + 1 from n where i < 50) select uuid() as u from n').map(r => r['u'] as string)
                expect(new Set(generated).size).toBe(50)
                if (!db.hadUuid) {
                    const times = generated.map(u => u.substring(0, 13))
                    expect([...times].sort()).toEqual(times)
                }
                // The blob is the 16 bytes of the text, in its order
                expect(db.all("select hex(uuid_blob('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')) as h")).toEqual([{ h: 'A0EEBC999C0B4EF8BB6D6BB9BD380A11' }])
            } finally {
                db.close()
            }
        })

        test('an-index-on-the-decimal-key', async () => {
            const db = await driver.open()
            try {
                db.run("create table amounts (id integer primary key, v text not null) strict")
                db.run("insert into amounts (v) values ('1.50'), ('-10'), ('9'), ('10.00'), ('0.1')")
                db.run('create index amounts_key on amounts (tsq_decimal_key(v))')
                const plan = (sql: string) => db.all('explain query plan ' + sql).map(row => row['detail']).join(' | ')
                expect(plan("select id from amounts where tsq_decimal_key(v) = tsq_decimal_key('1.5')")).toContain('USING COVERING INDEX amounts_key')
                expect(plan("select id from amounts where tsq_decimal_key(v) > tsq_decimal_key('2')")).toContain('USING COVERING INDEX amounts_key')
                expect(plan('select v from amounts order by tsq_decimal_key(v)')).toContain('USING INDEX amounts_key')
                expect(db.all("select v from amounts where tsq_decimal_key(v) = tsq_decimal_key('1.5')")).toEqual([{ v: '1.50' }])
                expect(db.all('select v from amounts order by tsq_decimal_key(v)').map(row => row['v'])).toEqual(['-10', '0.1', '1.50', '9', '10.00'])
                // uuid() isn't deterministic, so SQLite doesn't take it in an index
                expect(() => db.run('create index amounts_uuid on amounts (uuid())')).toThrow('non-deterministic')
            } finally {
                db.close()
            }
        })

        test('a-function-the-database-already-has-is-left-and-skip-leaves-out', async () => {
            const mine = await driver.open({ before: 'ci_replace of my own' })
            try {
                expect(mine.all("select ci_replace('Hello', 'h', 'x') as r, decimal_add('1', '2') as a")).toEqual([{ r: 'mine', a: '3' }])
            } finally {
                mine.close()
            }
            const skipping = await driver.open({ skip: ['uuid', 'tsq_decimal_key'] })
            try {
                if (!skipping.hadUuid) {
                    expect(() => skipping.all('select uuid() as u')).toThrow('no such function: uuid')
                }
                expect(() => skipping.all("select tsq_decimal_key('1') as k")).toThrow('no such function: tsq_decimal_key')
                expect(skipping.all("select uuid_str(uuid_blob('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')) as s")).toEqual([{ s: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' }])
            } finally {
                skipping.close()
            }
        })

        test('an-index-on-the-decimal-key-with-trusted_schema-off', async () => {
            const db = await driver.open()
            try {
                db.run('pragma trusted_schema = off')
                db.run("create table amounts (id integer primary key, v text not null) strict")
                const createIndex = () => db.run('create index amounts_key on amounts (tsq_decimal_key(v))')
                if (driver.name === 'sqlite-wasm') {
                    createIndex()
                    db.run("insert into amounts (v) values ('1.50')")
                    expect(db.all("select v from amounts where tsq_decimal_key(v) = tsq_decimal_key('1.5')")).toEqual([{ v: '1.50' }])
                } else {
                    expect(createIndex).toThrow('unsafe use of tsq_decimal_key()')
                }
            } finally {
                db.close()
            }
        })
    })
}
