// LoggingQueryRunner and ConsoleLogQueryRunner over a query runner built with
// SynchronousPromise (better-sqlite3 in memory): the result, the error and the
// end of a transaction are delivered before the call returns, as the runner
// underneath delivers them, and each query is logged.

import Database from 'better-sqlite3'
import { SynchronousPromise } from 'synchronous-promise'
import { afterEach, beforeEach, describe, expect, test } from '../../lib/testRunner.js'
import { BetterSqlite3QueryRunner } from '../../../src/queryRunners/BetterSqlite3QueryRunner.js'
import { ConsoleLogQueryRunner } from '../../../src/queryRunners/ConsoleLogQueryRunner.js'
import { LoggingQueryRunner } from '../../../src/queryRunners/LoggingQueryRunner.js'
import type { QueryRunner } from '../../../src/queryRunners/QueryRunner.js'
import { isRealDbEnabled } from '../../lib/backends.js'

type Settled = { done: false } | { done: true, value?: unknown, error?: unknown }

// What the promise gave when the call returned, without waiting
function settledNow(promise: Promise<unknown>): Settled {
    let settled: Settled = { done: false }
    promise.then((value) => { settled = { done: true, value } }, (error: unknown) => { settled = { done: true, error } })
    return settled
}

// The queries logged during the test: by the logger of LoggingQueryRunner, and
// by console.log for ConsoleLogQueryRunner (its second argument is the query)
let loggedQueries: string[] = []

const wrappers: readonly { label: string, wrap(runner: QueryRunner): QueryRunner }[] = [
    {
        label: 'LoggingQueryRunner',
        wrap: (runner) => new LoggingQueryRunner({ onQuery: (_type, query) => { loggedQueries.push(query) } }, runner),
    },
    {
        label: 'ConsoleLogQueryRunner',
        wrap: (runner) => new ConsoleLogQueryRunner(runner),
    },
]

describe.skipIf(!isRealDbEnabled('sqlite', 'native', 'newest', 'better-sqlite3-sync'))('A logging query runner over a synchronous one', () => {
    let db: Database.Database
    let consoleLog: typeof console.log
    beforeEach(() => {
        db = new Database(':memory:')
        db.exec('create table rt_log (id integer primary key, name text not null)')
        loggedQueries = []
        consoleLog = console.log
        console.log = (_type: unknown, query: unknown) => { loggedQueries.push(String(query)) }
    })
    afterEach(() => {
        console.log = consoleLog
        db.close()
    })

    for (const { label, wrap } of wrappers) {
        test(`${label}: a select gives its result before the call returns`, () => {
            const runner = wrap(new BetterSqlite3QueryRunner(db, { promise: SynchronousPromise }))
            expect(settledNow(runner.executeSelectOneColumnOneRow('select 41 + 1', []))).toEqual({ done: true, value: 42 })
            expect(loggedQueries).toEqual(['select 41 + 1'])
        })

        test(`${label}: an insert gives its count before the call returns`, () => {
            const runner = wrap(new BetterSqlite3QueryRunner(db, { promise: SynchronousPromise }))
            expect(settledNow(runner.executeInsert("insert into rt_log (id, name) values (1, 'one')", []))).toEqual({ done: true, value: 1 })
            expect(db.prepare('select name from rt_log where id = 1').pluck().get()).toBe('one')
            expect(loggedQueries).toEqual(["insert into rt_log (id, name) values (1, 'one')"])
        })

        test(`${label}: an error is given before the call returns`, () => {
            const runner = wrap(new BetterSqlite3QueryRunner(db, { promise: SynchronousPromise }))
            const settled = settledNow(runner.executeSelectOneColumnOneRow('select * from rt_missing', []))
            expect(settled.done).toBe(true)
            expect(settled.done && settled.error).toBeInstanceOf(Error)
            expect(loggedQueries).toEqual(['select * from rt_missing'])
        })

        test(`${label}: a transaction is committed before the call returns`, () => {
            const runner = wrap(new BetterSqlite3QueryRunner(db, { promise: SynchronousPromise }))
            const settled = settledNow(runner.executeInTransaction(() => runner.executeInsert("insert into rt_log (id, name) values (2, 'two')", []), runner, undefined))
            expect(settled).toEqual({ done: true, value: 1 })
            expect(runner.isTransactionActive()).toBe(false)
            expect(db.prepare('select name from rt_log where id = 2').pluck().get()).toBe('two')
        })
    }
})
