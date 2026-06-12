// Coverage of INSERT's "has value" / "if value" / "when" setter
// families plus the multi-row `setForAllIf*` branches. Together they
// make up the bulk of the dynamic-set surface in
// [src/queryBuilders/InsertQueryBuilder.ts](../../../../../src/queryBuilders/InsertQueryBuilder.ts).
//
// The shape is parallel to [update.conditional-sets.test.ts](./update.conditional-sets.test.ts)
// with two extras specific to INSERT:
//
//   - `__multiple` branches: when `.values([row1, row2])` is used the
//     setter family routes through `__getSetsForMultipleInsert()` and
//     loops over each row.
//   - `setForAllIfSet` / `setForAllIfNotSet` / `setForAllIfHasValue`
//     / `setForAllIfHasNoValue` (+ `IfValue` and `When` flavours):
//     apply a per-column value to every row in the array, gated by
//     the per-row staged state.
//
// Each mutation is wrapped in `ctx.withRollback(...)` so real-DB cells
// stay clean; the snapshot assertions are the source of truth for the
// emitted SQL.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('set-if-has-value-overwrites-only-when-current-has-value', async () => {
        // Same semantics as the UPDATE flavour: the staged `body` is
        // null, so `setIfHasValue({ body: ... })` is a no-op; `title`
        // is set so it is overwritten.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tIssue)
                .set({
                    projectId: 1,
                    number:    100,
                    title:     'Triage',
                    body:      null,
                    status:    'open',
                    priority:  2,
                })
                .setIfHasValue({ title: 'Triaged', body: 'should-be-ignored' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values (@0, @1, @2, @3, @4, @5)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                100,
                "Triaged",
                null,
                "open",
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(1)
        })
    })

    test('set-if-set-if-value-needs-both-prior-set-and-non-empty-incoming', async () => {
        // `setIfSetIfValue` only assigns columns where both the prior
        // set is present AND the incoming value passes `_isValue`.
        // `status` was prior-set + valid → overwrites; `body` wasn't
        // prior-set → skipped; the `null` incoming for status is also
        // rejected.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({
                    projectId: 1,
                    number:    101,
                    title:     'Required',
                    status:    'open',
                    priority:  2,
                })
                .setIfSetIfValue({ status: 'closed', body: 'never-staged' })
                .setIfSetIfValue({ status: null })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (@0, @1, @2, @3, @4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                101,
                "Required",
                "closed",
                2,
              ]
            `)
        })
    })

    test('set-if-not-set-if-value-fills-only-missing-with-real-value', async () => {
        // `setIfNotSetIfValue` only assigns columns that were NOT set
        // before AND whose incoming value passes `_isValue`. `priority`
        // is already set so the override is dropped; `body: ''` fails
        // the value gate; `body: 'New body text'` is new + valid so it
        // sticks. (Required columns must all be present in the initial
        // `.set` call, so this test targets the nullable `body` for
        // the dynamic fill.)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({
                    projectId: 1,
                    number:    102,
                    title:     'Triage',
                    status:    'open',
                    priority:  9,
                })
                .setIfNotSetIfValue({ priority: 0, body: '' })
                .setIfNotSetIfValue({ body: 'New body text' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values (@0, @1, @2, @3, @4, @5)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                102,
                "Triage",
                "open",
                9,
                "New body text",
              ]
            `)
        })
    })

    test('set-if-has-value-if-value-and-has-no-value-if-value-cover-both-gates', async () => {
        // The `*IfHasValueIfValue` / `*IfHasNoValueIfValue` variants
        // need BOTH gates to flip in the same direction:
        //   - `title` is staged with a value and the incoming value is
        //     non-empty → overwritten.
        //   - `body` is staged null → `setIfHasValueIfValue` skips it,
        //     then `setIfHasNoValueIfValue` backfills it.
        //   - the empty-string incoming `title: ''` is rejected by the
        //     incoming-value gate, so the backfill leaves `title` intact.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({
                    projectId: 1,
                    number:    103,
                    title:     'Triage',
                    body:      null,
                    status:    'open',
                    priority:  2,
                })
                .setIfHasValueIfValue({ title: 'Triaged', body: 'will-skip' })
                .setIfHasNoValueIfValue({ body: 'Backfilled', title: '' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values (@0, @1, @2, @3, @4, @5)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                103,
                "Triaged",
                "Backfilled",
                "open",
                2,
              ]
            `)
        })
    })

    test('ignore-if-has-value-drops-only-populated-sets', async () => {
        // `ignoreIfHasValue(col, ...)` deletes a staged column only if
        // its value PASSES `_isValue`. Single-row branch at
        // [InsertQueryBuilder.ts:805](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L805).
        // Restricted to nullable columns (`body`, `assigneeId`) so the
        // resulting INSERT remains satisfiable against the real DB
        // even after the drops.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({
                    projectId:  1,
                    number:     104,
                    title:      'Triage',
                    body:       'present',
                    assigneeId: null,
                    status:     'open',
                    priority:   9,
                })
                .ignoreIfHasValue('body', 'assigneeId')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, assignee_id, status, priority) values (@0, @1, @2, @3, @4, @5)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                104,
                "Triage",
                null,
                "open",
                9,
              ]
            `)
        })
    })

    test('ignore-if-has-no-value-drops-only-empty-sets', async () => {
        // Mirror of `ignoreIfHasValue`; single-row branch at
        // [InsertQueryBuilder.ts:836](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L836).
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({
                    projectId:  1,
                    number:     105,
                    title:      'Triage',
                    body:       null,
                    assigneeId: null,
                    status:     'open',
                    priority:   9,
                })
                .ignoreIfHasNoValue('body', 'assigneeId')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (@0, @1, @2, @3, @4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                105,
                "Triage",
                "open",
                9,
              ]
            `)
        })
    })

    test('ignore-any-set-with-no-value-sweeps-single-row', async () => {
        // Single-row branch of `ignoreAnySetWithNoValue` (line 867).
        // Both empty staged columns (`body: null`, `assigneeId: null`)
        // are nullable, so the trimmed INSERT still satisfies NOT NULL.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({
                    projectId:  1,
                    number:     106,
                    title:      'Triage',
                    body:       null,
                    assigneeId: null,
                    status:     'open',
                    priority:   9,
                })
                .ignoreAnySetWithNoValue()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (@0, @1, @2, @3, @4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                106,
                "Triage",
                "open",
                9,
              ]
            `)
        })
    })

    test('set-for-all-if-set-and-if-not-set-route-per-row', async () => {
        // Multi-row INSERT exercises `setForAllIfSet` and
        // `setForAllIfNotSet`. Each is gated per row:
        //   - Row 0 has `body` already → `setForAllIfSet({body})`
        //     overrides it; `setForAllIfNotSet({body})` skips it.
        //   - Row 1 has no `body` → `setForAllIfSet({body})` skips
        //     it; `setForAllIfNotSet({body})` fills it.
        // The `body` column is nullable in the schema, so dropping or
        // adding it never breaks NOT NULL.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 200, title: 'A', body: 'present', status: 'open', priority: 1 },
                    { projectId: 1, number: 201, title: 'B',                  status: 'open', priority: 1 },
                ])
                .setForAllIfSet({ body: 'in-progress' })
                .setForAllIfNotSet({ body: 'triage' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values (@0, @1, @2, @3, @4, @5), (@6, @7, @8, @9, @10, @11)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                200,
                "A",
                "in-progress",
                "open",
                1,
                1,
                201,
                "B",
                "triage",
                "open",
                1,
              ]
            `)
        })
    })

    test('set-for-all-if-set-if-value-and-if-not-set-if-value-skip-empty-incoming', async () => {
        // The `setForAllIfSetIfValue` / `setForAllIfNotSetIfValue`
        // branches at lines 976 and 1031 require the incoming value to
        // pass `_isValue` as well. An `undefined` incoming is a no-op
        // even when the row state would otherwise match.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 202, title: 'A', body: 'present', status: 'open', priority: 1 },
                    { projectId: 1, number: 203, title: 'B',                  status: 'open', priority: 1 },
                ])
                .setForAllIfSetIfValue({ body: undefined })
                .setForAllIfNotSetIfValue({ body: 'staged-only' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values (@0, @1, @2, @3, @4, @5), (@6, @7, @8, @9, @10, @11)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                202,
                "A",
                "present",
                "open",
                1,
                1,
                203,
                "B",
                "staged-only",
                "open",
                1,
              ]
            `)
        })
    })

    test('set-for-all-if-has-value-and-if-has-no-value-route-per-row', async () => {
        // Multi-row variants of the `*HasValue` gates from
        // [InsertQueryBuilder.ts:1061](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L1061)
        // and 1116. Row 0's `body` has value → updated; row 1's `body`
        // is null → setForAllIfHasNoValue fills it.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 204, title: 'A', body: 'present', status: 'open', priority: 1 },
                    { projectId: 1, number: 205, title: 'B', body: null,      status: 'open', priority: 1 },
                ])
                .setForAllIfHasValue({ body: 'overwritten' })
                .setForAllIfHasNoValue({ body: 'backfilled' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values (@0, @1, @2, @3, @4, @5), (@6, @7, @8, @9, @10, @11)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                204,
                "A",
                "overwritten",
                "open",
                1,
                1,
                205,
                "B",
                "backfilled",
                "open",
                1,
              ]
            `)
        })
    })

    test('multi-row-ignore-if-has-value-and-has-no-value-route-per-row', async () => {
        // Multi-row branches of `ignoreIfHasValue` (line 811) and
        // `ignoreIfHasNoValue` (line 842): per-row delete decisions.
        // Row 0's `body` has value → `ignoreIfHasValue('body')` drops
        // it; row 1's `body` is null → it survives the sweep. The
        // dropped column is nullable so the result stays valid
        // against real DBs.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 206, title: 'A', body: 'present', status: 'open', priority: 1 },
                    { projectId: 1, number: 207, title: 'B', body: null,      status: 'open', priority: 1 },
                ])
                .ignoreIfHasValue('body')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values (@0, @1, @2, @3, @4, @5), (@6, @7, @8, @9, @10, @11)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                206,
                "A",
                "open",
                1,
                null,
                1,
                207,
                "B",
                "open",
                1,
                null,
              ]
            `)
        })
    })

    test('multi-row-ignore-any-set-with-no-value-prunes-per-row', async () => {
        // Multi-row branch of `ignoreAnySetWithNoValue` at line 873.
        // Each row is swept independently: row 0 keeps `body` (valid)
        // and drops `assigneeId` (null); row 1 drops both because both
        // fail `_isValue`. Both dropped columns are nullable.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 208, title: 'A', body: 'present', assigneeId: null, status: 'open', priority: 1 },
                    { projectId: 1, number: 209, title: 'B', body: null,      assigneeId: null, status: 'open', priority: 1 },
                ])
                .ignoreAnySetWithNoValue()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values (@0, @1, @2, @3, @4, @5), (@6, @7, @8, @9, @10, @11)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                208,
                "A",
                "present",
                "open",
                1,
                1,
                209,
                "B",
                null,
                "open",
                1,
              ]
            `)
        })
    })

    test('set-when-and-set-if-value-when-toggle-cleanly', async () => {
        // `*When` wrappers: false branch is a no-op, true branch
        // delegates. Covers `setWhen` and `setIfValueWhen` from
        // [InsertQueryBuilder.ts:1395](../../../../../src/queryBuilders/InsertQueryBuilder.ts#L1395)
        // and 1401.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({
                    projectId: 1,
                    number:    210,
                    title:     'Base',
                    status:    'open',
                    priority:  1,
                })
                .setWhen(false, { title: 'NEVER' })
                .setWhen(true, { body: 'gated on' })
                .setIfValueWhen(false, { priority: 99 })
                .setIfValueWhen(true, { priority: 7 })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values (@0, @1, @2, @3, @4, @5)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                210,
                "Base",
                "open",
                7,
                "gated on",
              ]
            `)
        })
    })

    test('disallow-if-value-and-no-value-throw-synchronously', () => {
        // `disallowIfValue` / `disallowIfNoValue` (lines 1250, 1289)
        // both throw a `TsSqlProcessingError` keyed by the offending
        // property. No SQL is ever built.
        expect(() => {
            ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 211, title: 'X', status: 'closed', priority: 1 })
                .disallowIfValue('status must be staged by the workflow', 'status')
        }).toThrow(/status must be staged by the workflow/)

        expect(() => {
            ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 212, title: 'X', status: 'open', priority: 1, body: null })
                .disallowIfNoValue('body is required', 'body')
        }).toThrow(/body is required/)
    })

    test('ignore-if-has-no-value-when-true-drops-null-staged-column', async () => {
        // `ignoreIfHasNoValueWhen(true, 'body')` drops `body` from the
        // INSERT because it has no value (null). The remaining columns
        // survive.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .set({
                    projectId: 1,
                    number:    213,
                    title:     'Base',
                    body:      null,
                    status:    'open',
                    priority:  1,
                })
                .ignoreIfHasNoValueWhen(true, 'body')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (@0, @1, @2, @3, @4)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                213,
                "Base",
                "open",
                1,
              ]
            `)
        })
    })
})
