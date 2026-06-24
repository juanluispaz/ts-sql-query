// Multi-row INSERT (`values([row1, row2, …])`) chained with the
// multi-row set-rule family: `ignoreIfSet`, `keepOnly`, `disallowIfSet`,
// `disallowIfNotSet`, `disallowIfValue`, `disallowIfNoValue`,
// `disallowAnyOtherSet`.
//
// The single-row branches of these methods are pinned by
// `insert.conditional-sets.test.ts`; the array-of-rows branch reports any
// thrown error with the offending row index — the sole observable
// difference from the single-row throw shape, so each expect-throws
// assertion below also reads it off the error object.
//
// The SQL-emitting tests deliberately drop only nullable columns
// (`body`, `assigneeId`, `archivedAt`) so the trimmed multi-row INSERT
// stays satisfiable against every real DB.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

// The disallow rules throw a `TsSqlProcessingError` (an `Error`) onto which
// the InsertQueryBuilder attaches the runtime-only `disallowedProperty` /
// `disallowedIndex` fields (set via direct assignment in src, not part of the
// public typed surface). This shape narrows the caught `unknown` so the
// assertions read those fields without an `any` local.
type DisallowError = Error & { disallowedProperty?: unknown; disallowedIndex?: unknown }

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('ignore-if-set-drops-named-columns-from-every-row', async () => {
        // Multi-row branch of `ignoreIfSet`: drops the named column from
        // every row. Both rows stage `body`; `ignoreIfSet('body')` drops it
        // everywhere, so the emitted column list omits `body` entirely.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 300, title: 'A', body: 'will-be-dropped', status: 'open', priority: 1 },
                    { projectId: 1, number: 301, title: 'B', body: 'also-dropped',    status: 'open', priority: 1 },
                ])
                .ignoreIfSet('body')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority) values (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                300,
                "A",
                "open",
                1,
                1,
                301,
                "B",
                "open",
                1,
              ]
            `)
        })
    })

    test('keep-only-prunes-every-row-to-allowed-columns', async () => {
        // Multi-row branch of `keepOnly`: per-row sweep that deletes
        // anything not in the allow set. Only required columns are listed,
        // so the trimmed INSERT still satisfies the schema. The `body`
        // (nullable) staged in both rows gets pruned away.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 302, title: 'A', body: 'extra', status: 'open', priority: 1 },
                    { projectId: 1, number: 303, title: 'B', body: 'extra', status: 'open', priority: 1 },
                ])
                .keepOnly('projectId', 'number', 'title', 'status', 'priority')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority) values (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                302,
                "A",
                "open",
                1,
                1,
                303,
                "B",
                "open",
                1,
              ]
            `)
        })
    })

    test('disallow-if-set-throws-on-second-row-with-disallowed-index', () => {
        // Multi-row branch of `disallowIfSet`. Row 0 omits `body`; row 1
        // stages it. The throw must carry `disallowedProperty: 'body'` AND
        // `disallowedIndex: 1`.
        let thrown: unknown
        try {
            ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 304, title: 'A',                  status: 'open', priority: 1 },
                    { projectId: 1, number: 305, title: 'B', body: 'leaked',  status: 'open', priority: 1 },
                ])
                .disallowIfSet('body must never be staged from the API', 'body')
        } catch (e) { thrown = e }
        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as DisallowError
        expect(err.message).toContain('body must never be staged from the API')
        expect(err.disallowedProperty).toBe('body')
        expect(err.disallowedIndex).toBe(1)
    })

    test('disallow-if-not-set-throws-when-row-is-missing-required-key', () => {
        // Multi-row branch of `disallowIfNotSet`. Row 0 has `title`; row 1
        // omits it. The first missing key on the second row triggers the
        // throw, carrying `disallowedIndex: 1`.
        let thrown: unknown
        try {
            ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 306, title: 'present', status: 'open', priority: 1 },
                    { projectId: 1, number: 307,                   status: 'open', priority: 1 } as any,
                ])
                .disallowIfNotSet('title is mandatory in bulk import', 'title')
        } catch (e) { thrown = e }
        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as DisallowError
        expect(err.message).toContain('title is mandatory in bulk import')
        expect(err.disallowedProperty).toBe('title')
        expect(err.disallowedIndex).toBe(1)
    })

    test('disallow-if-value-throws-when-any-row-passes-the-value-gate', () => {
        // Multi-row branch of `disallowIfValue`. Row 0 has `body: null`
        // (fails the value gate); row 1 has `body: 'real'` (passes) → the
        // throw fires on row 1.
        let thrown: unknown
        try {
            ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 308, title: 'A', body: null,   status: 'open', priority: 1 },
                    { projectId: 1, number: 309, title: 'B', body: 'real', status: 'open', priority: 1 },
                ])
                .disallowIfValue('body must be staged by the workflow', 'body')
        } catch (e) { thrown = e }
        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as DisallowError
        expect(err.message).toContain('body must be staged by the workflow')
        expect(err.disallowedProperty).toBe('body')
        expect(err.disallowedIndex).toBe(1)
    })

    test('disallow-if-no-value-throws-when-any-row-fails-the-value-gate', () => {
        // Multi-row branch of `disallowIfNoValue`. Row 0 has
        // `body: 'present'` (passes); row 1 has `body: null` (fails) → the
        // throw fires on row 1.
        let thrown: unknown
        try {
            ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 310, title: 'A', body: 'present', status: 'open', priority: 1 },
                    { projectId: 1, number: 311, title: 'B', body: null,      status: 'open', priority: 1 },
                ])
                .disallowIfNoValue('body is required for every row', 'body')
        } catch (e) { thrown = e }
        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as DisallowError
        expect(err.message).toContain('body is required for every row')
        expect(err.disallowedProperty).toBe('body')
        expect(err.disallowedIndex).toBe(1)
    })

    test('disallow-any-other-set-throws-on-row-with-extra-column', () => {
        // Multi-row branch of `disallowAnyOtherSet`. Row 0 only stages
        // allowed columns; row 1 sneaks in `published`, which is not in the
        // allow-list → throws with `disallowedProperty: 'published'`,
        // `disallowedIndex: 1`.
        let thrown: unknown
        try {
            ctx.conn.insertInto(tProject)
                .values([
                    { organizationId: 1, name: 'A', slug: 'a' },
                    { organizationId: 1, name: 'B', slug: 'b', published: true },
                ])
                .disallowAnyOtherSet(
                    'only org/name/slug may be bulk-imported',
                    'organizationId', 'name', 'slug',
                )
        } catch (e) { thrown = e }
        expect(thrown).toBeInstanceOf(Error)
        const err = thrown as DisallowError
        expect(err.message).toContain('only org/name/slug may be bulk-imported')
        expect(err.disallowedProperty).toBe('published')
        expect(err.disallowedIndex).toBe(1)
    })

    test('disallow-any-other-set-permits-rows-when-every-set-is-allowed', async () => {
        // Multi-row companion to the row-1-extra throw above: when every
        // staged column is in the allow-list the loop completes silently
        // and the INSERT proceeds.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tProject)
                .values([
                    { organizationId: 1, name: 'A', slug: 'a' },
                    { organizationId: 1, name: 'B', slug: 'b' },
                ])
                .disallowAnyOtherSet(
                    'only org/name/slug may be bulk-imported',
                    'organizationId', 'name', 'slug',
                )
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into project (organization_id, \`name\`, slug) values (?, ?, ?), (?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                "A",
                "a",
                1,
                "B",
                "b",
              ]
            `)
        })
    })

    test('disallow-guards-permit-multi-row-insert-when-no-row-violates', async () => {
        // Multi-row companion to `disallow-any-other-set-permits-rows...`
        // above: each `disallow*` guard walks every staged row and, finding
        // no violation, returns the builder unchanged so the multi-row INSERT
        // proceeds. `body`/`assigneeId` are unstaged in both rows so
        // `disallowIfValue`/`disallowIfSet` pass; the core columns are present
        // with values so `disallowIfNoValue`/`disallowIfNotSet` pass. As with
        // the companion above, the multi-row affected count is
        // dialect-dependent, so the SQL + params are the asserted contract.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 230, title: 'Bulk A', status: 'open', priority: 1 },
                    { projectId: 1, number: 231, title: 'Bulk B', status: 'open', priority: 2 },
                ])
                .disallowIfValue('body must stay unset', 'body')
                .disallowIfNoValue('title is required', 'title')
                .disallowIfSet('assignee is set later', 'assigneeId')
                .disallowIfNotSet('title is required', 'title')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority) values (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                230,
                "Bulk A",
                "open",
                1,
                1,
                231,
                "Bulk B",
                "open",
                2,
              ]
            `)
        })
    })

})
