// Coverage of INSERT's "has value" / "if value" / "when" setter
// families plus the multi-row `setForAllIf*` branches.
//
// The shape is parallel to [update.conditional-sets.test.ts](./update.conditional-sets.test.ts)
// with two extras specific to INSERT:
//
//   - multi-row: when `.values([row1, row2])` is used the setter family
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values ($1, $2, $3, $4, $5, $6)"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values ($1, $2, $3, $4, $5)"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values ($1, $2, $3, $4, $5, $6)"`)
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
        // The `*IfHasValueIfValue` / `*IfHasNoValueIfValue` variants need
        // BOTH gates to flip in the same direction.
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
                .setIfHasValueIfValue({ title: 'Triaged', body: 'will-skip', priority: undefined })
                .setIfHasNoValueIfValue({ body: 'Backfilled', title: '' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values ($1, $2, $3, $4, $5, $6)"`)
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
        // its value passes the value gate. Restricted to nullable columns
        // (`body`, `assigneeId`) so the resulting INSERT remains
        // satisfiable against the real DB even after the drops.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, assignee_id, status, priority) values ($1, $2, $3, $4, $5, $6)"`)
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
        // Mirror of `ignoreIfHasValue`, single-row.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values ($1, $2, $3, $4, $5)"`)
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
        // Single-row branch of `ignoreAnySetWithNoValue`. Both empty
        // staged columns (`body: null`, `assigneeId: null`) are nullable,
        // so the trimmed INSERT still satisfies NOT NULL.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values ($1, $2, $3, $4, $5)"`)
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)"`)
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
        // variants require the incoming value to pass the value gate as
        // well. An `undefined` incoming is a no-op even when the row state
        // would otherwise match.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)"`)
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
        // Multi-row variants of the `*HasValue` gates. Row 0's `body` has
        // value → updated; row 1's `body` is null → setForAllIfHasNoValue
        // fills it.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)"`)
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

    test('set-for-all-if-has-value-if-value-and-if-has-no-value-if-value-route-per-row', async () => {
        // The `*HasValueIfValue` variants add an incoming value-gate on top
        // of the per-row `*HasValue` gate. With real incoming values they
        // behave like the plain `*HasValue` variants: row 0's `body` has
        // value → overwritten; row 1's `body` is null → backfilled.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 240, title: 'A', body: 'present', status: 'open', priority: 1 },
                    { projectId: 1, number: 241, title: 'B', body: null,      status: 'open', priority: 1 },
                ])
                .setForAllIfHasValueIfValue({ body: 'overwritten' })
                .setForAllIfHasNoValueIfValue({ body: 'backfilled' })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                240,
                "A",
                "overwritten",
                "open",
                1,
                1,
                241,
                "B",
                "backfilled",
                "open",
                1,
              ]
            `)
        })
    })

    test('set-for-all-if-has-value-if-value-undefined-incoming-is-a-no-op', async () => {
        // The incoming value-gate: an `undefined` incoming makes both
        // `*HasValueIfValue` variants no-ops even when the per-row `*HasValue`
        // gate would otherwise match, so every row keeps its staged `body`.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 242, title: 'A', body: 'present', status: 'open', priority: 1 },
                    { projectId: 1, number: 243, title: 'B', body: null,      status: 'open', priority: 1 },
                ])
                .setForAllIfHasValueIfValue({ body: undefined })
                .setForAllIfHasNoValueIfValue({ body: undefined })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                242,
                "A",
                "present",
                "open",
                1,
                1,
                243,
                "B",
                null,
                "open",
                1,
              ]
            `)
        })
    })

    test('multi-row-ignore-if-has-value-and-has-no-value-route-per-row', async () => {
        // Multi-row branches of `ignoreIfHasValue` and `ignoreIfHasNoValue`:
        // per-row delete decisions. Row 0's `body` has value →
        // `ignoreIfHasValue('body')` drops it; row 1's `body` is null → it
        // survives the sweep. The dropped column is nullable so the result
        // stays valid against real DBs.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 206, title: 'A', body: 'present', status: 'open', priority: 1 },
                    { projectId: 1, number: 207, title: 'B', body: null,      status: 'open', priority: 1 },
                ])
                .ignoreIfHasValue('body')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)"`)
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

    test('multi-row-ignore-if-has-no-value-routes-per-row', async () => {
        // Multi-row branch of `ignoreIfHasNoValue` (distinct from the
        // `ignoreIfHasValue` multi-row branch above — same `.values([...])`
        // shape, opposite gate). Per-row delete decisions: row 0's `body`
        // is null -> dropped; row 1's `body` has value -> kept. The dropped
        // column is nullable so the unioned INSERT stays valid. Two rows
        // are inserted regardless of the per-row pruning.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 220, title: 'A', body: null,             status: 'open', priority: 1 },
                    { projectId: 1, number: 221, title: 'B', body: 'Use new tokens', status: 'open', priority: 1 },
                ])
                .ignoreIfHasNoValue('body')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                220,
                "A",
                "open",
                1,
                null,
                1,
                221,
                "B",
                "open",
                1,
                "Use new tokens",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        })
    })

    test('multi-row-ignore-any-set-with-no-value-prunes-per-row', async () => {
        // Multi-row branch of `ignoreAnySetWithNoValue`. Each row is swept
        // independently: row 0 keeps `body` (valid) and drops `assigneeId`
        // (null); row 1 drops both because both fail the value gate. Both
        // dropped columns are nullable.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .values([
                    { projectId: 1, number: 208, title: 'A', body: 'present', assigneeId: null, status: 'open', priority: 1 },
                    { projectId: 1, number: 209, title: 'B', body: null,      assigneeId: null, status: 'open', priority: 1 },
                ])
                .ignoreAnySetWithNoValue()
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, body, status, priority) values ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)"`)
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
        // delegates. Covers `setWhen` and `setIfValueWhen`.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values ($1, $2, $3, $4, $5, $6)"`)
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
        // `disallowIfValue` / `disallowIfNoValue` both throw an error
        // keyed by the offending property. No SQL is ever built.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values ($1, $2, $3, $4, $5)"`)
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

    test('disallow-guards-allow-the-insert-when-no-rule-is-violated', async () => {
        // Mirror of `disallow-if-value-and-no-value-throw-synchronously`
        // above: each `disallow*` guard returns the builder unchanged (no
        // throw) when its condition is not met, so a valid INSERT proceeds.
        // `body`/`assigneeId` are unstaged so `disallowIfValue`/`disallowIfSet`
        // pass, the core columns are present so `disallowIfNoValue`/
        // `disallowIfNotSet` pass, and only the core columns are staged so
        // `disallowAnyOtherSet` passes. The guards leave no trace in the SQL.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 214, title: 'New issue', status: 'open', priority: 5 })
                .disallowIfValue('body must stay unset', 'body')
                .disallowIfNoValue('title is required', 'title')
                .disallowIfSet('assignee is set later', 'assigneeId')
                .disallowIfNotSet('status is required', 'status')
                .disallowAnyOtherSet('only core fields allowed', 'projectId', 'number', 'title', 'status', 'priority')
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values ($1, $2, $3, $4, $5)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                214,
                "New issue",
                "open",
                5,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('chain-start-set-if-value-skips-empty-incoming', async () => {
        // The chain-START `insertInto(t).setIfValue({...})` overload (no prior
        // `.set(...)` / `.values(...)`) — distinct from the mid-chain setters
        // above. It accepts the mandatory + optional insert shape and drops the
        // columns whose incoming value is null/undefined: all required columns
        // are present (so the insert is valid) while `assigneeId: undefined` is
        // skipped, so assignee_id never reaches the column list.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tIssue)
                .setIfValue({
                    projectId:  1,
                    number:     200,
                    title:      'Chain start',
                    status:     'open',
                    priority:   2,
                    assigneeId: undefined,
                })
                .executeInsert()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values ($1, $2, $3, $4, $5)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                200,
                "Chain start",
                "open",
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('dynamic-set-one-arg-overload-matches-the-plain-set', async () => {
        // `dynamicSet({...})` seeds the insert with an initial column object;
        // with every required column supplied it is directly executable. The
        // paired `set({...})` form is built but not executed — its query and
        // params are compared instead — so the UNIQUE(project_id, number) row
        // is inserted only once.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.insertInto(tIssue)
                .dynamicSet({ projectId: 1, number: 300, title: 'Dynamic seed', status: 'open', priority: 2 })
                .executeInsert()
            const dynamicSql = ctx.lastSql
            const dynamicParams = ctx.lastParams

            const viaSet = ctx.conn.insertInto(tIssue)
                .set({ projectId: 1, number: 300, title: 'Dynamic seed', status: 'open', priority: 2 })
            expect(viaSet.query()).toBe(dynamicSql)
            expect(viaSet.params()).toEqual(dynamicParams)

            expect(dynamicSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values ($1, $2, $3, $4, $5)"`)
            expect(dynamicParams).toMatchInlineSnapshot(`
              [
                1,
                300,
                "Dynamic seed",
                "open",
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
})
