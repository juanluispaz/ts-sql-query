// Runtime support for the documentation SQL tests (see test/DOC_CODE_EXTRACTOR.md).
//
// The doc code extractor turns each documentation ```ts snippet that is followed
// by dialect SQL fences into a test per database: it runs the snippet against a
// mock connection and asserts the SQL the builder emitted equals the SQL the
// docs show. These tests validate the SQL ONLY (not result types or values), and
// are ALWAYS mock — never a real database.
//
// `DocCodeMockRunner` is the mock the templates build their `connection` from
// (replacing the old `new MockQueryRunner(() => {})`). It records the last SQL +
// params, returns a per-`QueryType` heuristic result so most snippets run to
// completion, and exposes `assertSql()` for the generated test to compare the
// captured SQL against the (whitespace-normalised) expected SQL. When the
// heuristic is not enough for a particular snippet, the doc author sets the
// result with a `<!-- doc-code-snippet-result: <expr> -->` comment, which the extractor
// turns into `docCodeMock.next(<expr>)` before the snippet body.

import { expect } from '../testRunner.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import type { DatabaseType, QueryType } from '../../../src/queryRunners/QueryRunner.js'
import { SynchronousPromise } from 'synchronous-promise';
import { appendFileSync } from 'node:fs'
import { inspect } from 'node:util'

// `docs:sql-tabs` (test/lib/authoring/docSqlTabs.ts) writes the SQL tabs of the
// docs from what the snippets send: it puts a placeholder fence holding
// `@@<id>@@` after each snippet and runs these tests with this variable naming a
// file. A test whose expected SQL holds a placeholder then appends to that file
// the database, the SQL and the parameters its snippet sent, instead of asserting.
const SQL_TABS_LOG = process.env['DOC_CODE_SQL_TABS_LOG']

function recordForSqlTabs(runner: DocCodeMockRunner, expected: readonly string[]): boolean {
    if (!SQL_TABS_LOG) return false
    const id = /@@(.+?)@@/.exec(expected.join(' '))?.[1]
    if (id === undefined) return false
    appendFileSync(SQL_TABS_LOG, JSON.stringify({
        id,
        database: runner.database,
        sqls: runner.history,
        params: runner.paramsHistory.map(p => inspect(p, { breakLength: Infinity, depth: 10 })),
    }) + '\n')
    return true
}

/**
 * Collapse the whitespace the docs add for readability (line breaks + indentation)
 * down to single spaces so a multi-line documented query compares equal to the
 * single-line SQL the builder emits. Only whitespace is touched; the SQL is the same.
 */
export function normalizeSql(sql: string): string {
    return sql
        .replace(/\s+/g, ' ')   // collapse all whitespace runs to one space
        .replace(/\(\s+/g, '(')  // drop the space the docs add after a line-broken (
        .replace(/\s+\)/g, ')')  // …and before a line-broken )
        .trim()
}

// The extractor renders each expected SQL in `toMatchInlineSnapshot` form — the SQL
// wrapped in literal `"…"` so the asserted text matches the db-matrix snapshots for
// textual search. Drop those wrapping double-quotes to get the SQL back.
function unwrapSnapshot(expected: string): string {
    return expected.startsWith('"') && expected.endsWith('"') ? expected.slice(1, -1) : expected
}

// A shape that passes the MockQueryRunner shape-gate for each query type, so the
// snippet keeps running past the call (the SQL is already captured by then). The
// VALUE is irrelevant — these tests assert SQL only.
function heuristicResult(type: QueryType): unknown {
    switch (type) {
        // many-rows / many-values → empty array
        case 'selectManyRows':
        case 'selectOneColumnManyRows':
        case 'insertReturningManyRows':
        case 'insertReturningOneColumnManyRows':
        case 'insertReturningMultipleLastInsertedId':
        case 'updateReturningManyRows':
        case 'updateReturningOneColumnManyRows':
        case 'deleteReturningManyRows':
        case 'deleteReturningOneColumnManyRows':
            return []
        // affected-row counts / single id → a number
        case 'insert':
        case 'insertReturningLastInsertedId':
        case 'update':
        case 'delete':
            return 1
        // one-row / one-column-one-row → an empty object. A required single-row
        // query (executeSelectOne, …) throws NO_RESULT when the row is missing,
        // which would fail the test BEFORE assertSql runs; `{}` is a present-but-
        // empty row that survives that gate (the SQL is what these tests check).
        // `execute*NoneOrOne` shares these QueryTypes but wants `null` (no row) —
        // the extractor can't see that here, so it seeds `null` at gen time. When
        // `{}` is not enough (a projection that reads a specific field), the doc
        // author overrides with a `<!-- doc-code-snippet-result: <expr> -->` comment.
        case 'selectOneRow':
        case 'selectOneColumnOneRow':
        case 'insertReturningOneRow':
        case 'insertReturningOneColumnOneRow':
        case 'updateReturningOneRow':
        case 'updateReturningOneColumnOneRow':
        case 'deleteReturningOneRow':
        case 'deleteReturningOneColumnOneRow':
            return {}
        // none-or-one / side-effecting (procedure, function, transaction control,
        // schema/connection ops) → null/undefined
        default:
            return null
    }
}

/**
 * Mock query runner used by the documentation SQL tests. Always mock; records the
 * emitted SQL for assertion.
 */
export class DocCodeMockRunner extends MockQueryRunner {
    lastSql = ''
    lastParams: readonly unknown[] = []
    /** Every query's SQL, in execution order — for snippets that run more than one
     *  statement (e.g. `executeSelectPage()` emits a data query then a count). */
    readonly history: string[] = []
    /** The params of each query of `history`. */
    readonly paramsHistory: unknown[][] = []
    private readonly primed: unknown[] = []

    constructor(database: DatabaseType = 'noopDB') {
        let self!: DocCodeMockRunner
        super((type, query, params): unknown => {
            self.lastSql = query
            self.lastParams = params
            self.history.push(query)
            self.paramsHistory.push([...params])
            return self.primed.length ? self.primed.shift() : heuristicResult(type)
        }, { database, promise: SynchronousPromise })
        self = this
    }

    /** Clear the captured SQL/history and any primed results (plus the base counters). Called at the start of each test. */
    override reset(): void {
        super.reset()
        this.lastSql = ''
        this.lastParams = []
        this.history.length = 0
        this.paramsHistory.length = 0
        this.primed.length = 0
    }

    /** Prime the value the mock returns for the next execute (the `doc-code-snippet-result` escape hatch). */
    next(value: unknown): void {
        this.primed.push(value)
    }

    /** Assert the last emitted SQL equals `expected`, ignoring readability whitespace.
     *  `expected` is in toMatchInlineSnapshot form — the SQL wrapped in `"…"` — so the
     *  asserted text reads identically to the db-matrix snapshots; the wrapping
     *  double-quotes are dropped before comparing. */
    assertSql(expected: string): void {
        if (recordForSqlTabs(this, [expected])) return
        expect(normalizeSql(this.lastSql)).toBe(normalizeSql(unwrapSnapshot(expected)))
    }

    /** Assert the snippet emitted exactly these SQLs in order — for a multi-statement
     *  query like `executeSelectPage()` (data query then count). The mock runs on
     *  SynchronousPromise, so every chained query has executed (and recorded its
     *  SQL) by the time the snippet body returns, even without an `await`. */
    assertSqls(expected: readonly string[]): void {
        if (recordForSqlTabs(this, expected)) return
        expect(this.history.map(normalizeSql)).toEqual(expected.map((e) => normalizeSql(unwrapSnapshot(e))))
    }
}
