// Coverage of the `*When(when: boolean, …)` conditional helpers on the SHAPED
// single-row INSERT set node, reached after a shaped opener:
// `.shapedAs({…}).set({…})` then the `*When` call. Each helper is a thin
// dispatcher that routes to its non-`When` sibling when the boolean is true and
// returns `this` unchanged when false; the renamed shape keys flow through the
// dispatcher and map back to their real columns.
//
// Shape used throughout: { proj: 'projectId', num: 'number', ttl: 'title',
// st: 'status', prio: 'priority', desc: 'body' }. New issues are inserted for
// project 1 with numbers above the seed's 1–2 range so the (project_id, number)
// UNIQUE constraint stays admissible against the real DB; `ctx.withRollback`
// reverts between tests. Each test pairs `*When(false, …)` against
// `*When(true, …)` so the snapshot delta shows the dispatch fired.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

const shape = { proj: 'projectId', num: 'number', ttl: 'title', st: 'status', prio: 'priority', desc: 'body' } as const

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('shaped-set-if-value-when-false-is-noop-true-overrides', async () => {
        // `setIfValueWhen(false)` returns `this` so the staged renamed `ttl`
        // (title) stays; `setIfValueWhen(true)` dispatches to `setIfValue` and the
        // real value overwrites `title`. Same column list — only the title param
        // differs.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 201, ttl: 'Draft title', st: 'open', prio: 2 })
                .setIfValueWhen(false, { ttl: 'Overridden via when' })
                .executeInsert()
            const falseSql = ctx.lastSql
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 202, ttl: 'Draft title', st: 'open', prio: 2 })
                .setIfValueWhen(true, { ttl: 'Overridden via when' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                201,
                "Draft title",
                "open",
                2,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                202,
                "Overridden via when",
                "open",
                2,
              ]
            `)
        })
    })

    test('shaped-set-if-set-when-dispatches-on-true', async () => {
        // `setIfSetWhen(true)` -> `setIfSet`: overwrites only renamed keys already
        // staged. `ttl` was staged so it is overwritten; the false arm leaves the
        // staged draft title intact.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 203, ttl: 'Draft title', st: 'open', prio: 2 })
                .setIfSetWhen(false, { ttl: 'Renamed via when' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 204, ttl: 'Draft title', st: 'open', prio: 2 })
                .setIfSetWhen(true, { ttl: 'Renamed via when' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                203,
                "Draft title",
                "open",
                2,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                204,
                "Renamed via when",
                "open",
                2,
              ]
            `)
        })
    })

    test('shaped-set-if-not-set-when-dispatches-on-true', async () => {
        // `setIfNotSetWhen(true)` -> `setIfNotSet`: adds only renamed keys NOT
        // already staged. `desc` (body) is unstaged so the true arm adds the
        // `body` column; the false arm leaves the 5-column list unchanged.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 205, ttl: 'Document webhook retries', st: 'open', prio: 2 })
                .setIfNotSetWhen(false, { desc: 'See ADR-021 for the retry policy.' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 206, ttl: 'Document webhook retries', st: 'open', prio: 2 })
                .setIfNotSetWhen(true, { desc: 'See ADR-021 for the retry policy.' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('shaped-ignore-if-set-when-dispatches-on-true', async () => {
        // `ignoreIfSetWhen(true, 'desc')` -> `ignoreIfSet`: removes the staged
        // renamed `desc` (body) from the column list; the false arm keeps it.
        //
        // Type lock (shaped MissingKeys fold): opened from `dynamicSet()` every
        // required renamed key is still missing, so `ignoreIfSet` over an optional
        // key keeps them all missing (the insert stays non-executable);
        // `ignoreIfSetWhen(true, …)` must fold the missing-key set identically.
        const ignoreResult = ctx.conn.insertInto(tIssue).shapedAs(shape).dynamicSet()
            .ignoreIfSet('desc')
        const ignoreWhenTrueResult = ctx.conn.insertInto(tIssue).shapedAs(shape).dynamicSet()
            .ignoreIfSetWhen(true, 'desc')
        assertType<Exact<typeof ignoreResult, typeof ignoreWhenTrueResult>>()

        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 207, ttl: 'Backfill audit log', desc: 'Spotted during SOC2 prep.', st: 'open', prio: 2 })
                .ignoreIfSetWhen(false, 'desc')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 208, ttl: 'Backfill audit log', desc: 'Spotted during SOC2 prep.', st: 'open', prio: 2 })
                .ignoreIfSetWhen(true, 'desc')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('shaped-keep-only-when-dispatches-on-true', async () => {
        // `keepOnlyWhen(true, …renamed keys)` -> `keepOnly`: drops any staged
        // renamed key not in the kept list — the staged `desc` (body) is dropped
        // before the INSERT; the false arm keeps it.
        //
        // Type lock (shaped MissingKeys fold): opened from `dynamicSet()` every
        // required renamed key is still missing, so `keepOnly` over that exact set
        // keeps them all missing (the insert stays non-executable);
        // `keepOnlyWhen(true, …)` must fold the missing-key set identically and not
        // silently clear it.
        const keepOnlyResult = ctx.conn.insertInto(tIssue).shapedAs(shape).dynamicSet()
            .keepOnly('proj', 'num', 'ttl', 'st', 'prio')
        const keepOnlyWhenTrueResult = ctx.conn.insertInto(tIssue).shapedAs(shape).dynamicSet()
            .keepOnlyWhen(true, 'proj', 'num', 'ttl', 'st', 'prio')
        assertType<Exact<typeof keepOnlyResult, typeof keepOnlyWhenTrueResult>>()

        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 209, ttl: 'Migrate metrics to OTLP', desc: 'Draft body to discard.', st: 'open', prio: 2 })
                .keepOnlyWhen(false, 'proj', 'num', 'ttl', 'st', 'prio')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 210, ttl: 'Migrate metrics to OTLP', desc: 'Draft body to discard.', st: 'open', prio: 2 })
                .keepOnlyWhen(true, 'proj', 'num', 'ttl', 'st', 'prio')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('shaped-disallow-if-set-when-dispatches-on-true', async () => {
        // `disallowIfSetWhen(true, msg, 'desc')` -> `disallowIfSet`: throws
        // synchronously when the renamed `desc` (body) is staged. The `when=false`
        // arm is silent and the insert executes normally.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 211, ttl: 'Add changelog to release notes', desc: 'User-supplied body.', st: 'open', prio: 2 })
                .disallowIfSetWhen(false, 'body must be assigned by the triage agent, not the reporter', 'desc')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tIssue)
                    .shapedAs(shape)
                    .set({ proj: 1, num: 212, ttl: 'Add changelog to release notes', desc: 'User-supplied body.', st: 'open', prio: 2 })
                    .disallowIfSetWhen(true, 'body must be assigned by the triage agent, not the reporter', 'desc')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/body must be assigned by the triage agent|disallow/i)
        })
    })

    test('shaped-set-when-dispatches-on-true', async () => {
        // `setWhen(true, { ttl })` -> `set`: overwrites the staged renamed `ttl`
        // (title) regardless of prior state; the false arm leaves the draft title.
        // Same column list — only the title param differs.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 213, ttl: 'Draft title', st: 'open', prio: 2 })
                .setWhen(false, { ttl: 'Overridden via when' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 214, ttl: 'Draft title', st: 'open', prio: 2 })
                .setWhen(true, { ttl: 'Overridden via when' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                213,
                "Draft title",
                "open",
                2,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                214,
                "Overridden via when",
                "open",
                2,
              ]
            `)
        })
    })

    test('shaped-set-if-set-if-value-when-dispatches-on-true', async () => {
        // `setIfSetIfValueWhen(true)` -> `setIfSetIfValue`: only assigns renamed
        // keys BOTH already staged AND passing `_isValue`. `ttl` (title) is staged
        // and the value is real, so the true arm overwrites it.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 215, ttl: 'Refresh pricing page', st: 'open', prio: 2 })
                .setIfSetIfValueWhen(false, { ttl: 'Update support email' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 216, ttl: 'Refresh pricing page', st: 'open', prio: 2 })
                .setIfSetIfValueWhen(true, { ttl: 'Update support email' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                215,
                "Refresh pricing page",
                "open",
                2,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                216,
                "Update support email",
                "open",
                2,
              ]
            `)
        })
    })

    test('shaped-set-if-not-set-if-value-when-dispatches-on-true', async () => {
        // `setIfNotSetIfValueWhen(true)` -> `setIfNotSetIfValue`: only assigns
        // renamed keys NOT already staged whose incoming value passes `_isValue`.
        // `desc` (body) is unstaged, so the true arm adds the `body` column.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 217, ttl: 'Add OAuth login', st: 'open', prio: 2 })
                .setIfNotSetIfValueWhen(false, { desc: 'Customers report intermittent timeouts.' })
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 218, ttl: 'Add OAuth login', st: 'open', prio: 2 })
                .setIfNotSetIfValueWhen(true, { desc: 'Customers report intermittent timeouts.' })
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('shaped-set-if-has-value-when-dispatches-on-true', async () => {
        // `setIfHasValueWhen(true)` -> `setIfHasValue`: overwrites only renamed
        // keys whose currently-staged value is non-null. `desc` (body) is staged
        // as null so it stays out of the override; `ttl` (title) has a value so it
        // is re-assigned in the true branch.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 219, ttl: 'Refactor onboarding wizard', desc: null, st: 'open', prio: 2 })
                .setIfHasValueWhen(false, { ttl: 'Translate help center FAQ', desc: 'Should remain null.' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 220, ttl: 'Refactor onboarding wizard', desc: null, st: 'open', prio: 2 })
                .setIfHasValueWhen(true, { ttl: 'Translate help center FAQ', desc: 'Should remain null.' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                219,
                "Refactor onboarding wizard",
                "open",
                2,
                null,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                220,
                "Translate help center FAQ",
                "open",
                2,
                null,
              ]
            `)
        })
    })

    test('shaped-set-if-has-value-if-value-when-dispatches-on-true', async () => {
        // `setIfHasValueIfValueWhen(true)` -> `setIfHasValueIfValue`: the staged
        // value must be non-null AND the incoming must pass `_isValue`. `ttl`
        // (title) qualifies, so the true arm overwrites it.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 221, ttl: 'Wire export to CSV', st: 'open', prio: 2 })
                .setIfHasValueIfValueWhen(false, { ttl: 'Patch CVE-2024-1234' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 222, ttl: 'Wire export to CSV', st: 'open', prio: 2 })
                .setIfHasValueIfValueWhen(true, { ttl: 'Patch CVE-2024-1234' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                221,
                "Wire export to CSV",
                "open",
                2,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                222,
                "Patch CVE-2024-1234",
                "open",
                2,
              ]
            `)
        })
    })

    test('shaped-set-if-has-no-value-when-dispatches-on-true', async () => {
        // `setIfHasNoValueWhen(true)` -> `setIfHasNoValue`: only assigns renamed
        // keys whose currently-staged value IS null. `desc` (body) is staged as
        // null, so the true arm supplies the default body.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 223, ttl: 'Investigate latency spike', desc: null, st: 'open', prio: 2 })
                .setIfHasNoValueWhen(false, { desc: 'Pending triage notes.' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 224, ttl: 'Investigate latency spike', desc: null, st: 'open', prio: 2 })
                .setIfHasNoValueWhen(true, { desc: 'Pending triage notes.' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                223,
                "Investigate latency spike",
                "open",
                2,
                null,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                224,
                "Investigate latency spike",
                "open",
                2,
                "Pending triage notes.",
              ]
            `)
        })
    })

    test('shaped-set-if-has-no-value-if-value-when-dispatches-on-true', async () => {
        // `setIfHasNoValueIfValueWhen(true)` -> `setIfHasNoValueIfValue`: the
        // intersect of HasNoValue + IfValue on the renamed key. `desc` (body) is
        // staged null and the incoming value is real, so the true arm fills it.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 225, ttl: 'Audit dependency tree', desc: null, st: 'open', prio: 2 })
                .setIfHasNoValueIfValueWhen(false, { desc: 'Run `npm audit --omit=dev`.' })
                .executeInsert()
            const falseParams = ctx.lastParams

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 226, ttl: 'Audit dependency tree', desc: null, st: 'open', prio: 2 })
                .setIfHasNoValueIfValueWhen(true, { desc: 'Run `npm audit --omit=dev`.' })
                .executeInsert()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                1,
                225,
                "Audit dependency tree",
                "open",
                2,
                null,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                1,
                226,
                "Audit dependency tree",
                "open",
                2,
                "Run \`npm audit --omit=dev\`.",
              ]
            `)
        })
    })

    test('shaped-ignore-if-has-value-when-dispatches-on-true', async () => {
        // `ignoreIfHasValueWhen(true, 'desc')` -> `ignoreIfHasValue`: drops the
        // renamed `desc` (body) from the column list if its staged value is
        // non-null. The argument is `OptionalColumnsForSetOfWithShape` — `desc`
        // maps to the `optionalColumn` body and qualifies.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 227, ttl: 'Restore staging snapshots', desc: 'Provided by the SRE team.', st: 'open', prio: 2 })
                .ignoreIfHasValueWhen(false, 'desc')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 228, ttl: 'Restore staging snapshots', desc: 'Provided by the SRE team.', st: 'open', prio: 2 })
                .ignoreIfHasValueWhen(true, 'desc')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('shaped-ignore-if-has-no-value-when-dispatches-on-true', async () => {
        // `ignoreIfHasNoValueWhen(true, 'desc')` -> `ignoreIfHasNoValue`: drops the
        // renamed `desc` (body) if its staged value is null.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 229, ttl: 'Deprecate legacy webhooks', desc: null, st: 'open', prio: 2 })
                .ignoreIfHasNoValueWhen(false, 'desc')
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 230, ttl: 'Deprecate legacy webhooks', desc: null, st: 'open', prio: 2 })
                .ignoreIfHasNoValueWhen(true, 'desc')
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('shaped-ignore-any-set-with-no-value-when-dispatches-on-true', async () => {
        // `ignoreAnySetWithNoValueWhen(true)` -> `ignoreAnySetWithNoValue`: drops
        // every staged renamed key whose value is null/undefined — the staged
        // `desc` (body) is null so the true arm removes it.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 231, ttl: 'Add changelog to release notes', desc: null, st: 'open', prio: 2 })
                .ignoreAnySetWithNoValueWhen(false)
                .executeInsert()
            const falseSql = ctx.lastSql

            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 232, ttl: 'Add changelog to release notes', desc: null, st: 'open', prio: 2 })
                .ignoreAnySetWithNoValueWhen(true)
                .executeInsert()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority, body) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, number, title, status, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('shaped-disallow-if-not-set-when-dispatches-on-true', async () => {
        // `disallowIfNotSetWhen(true, msg, 'desc')` -> `disallowIfNotSet`: throws
        // synchronously when the renamed `desc` (body) is NOT staged. The
        // `when=false` arm is silent and the insert executes normally.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 233, ttl: 'Document webhook retries', st: 'open', prio: 2 })
                .disallowIfNotSetWhen(false, 'body is required on this workflow', 'desc')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tIssue)
                    .shapedAs(shape)
                    .set({ proj: 1, num: 234, ttl: 'Document webhook retries', st: 'open', prio: 2 })
                    .disallowIfNotSetWhen(true, 'body is required on this workflow', 'desc')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/body is required on this workflow|disallow/i)
        })
    })

    test('shaped-disallow-if-value-when-dispatches-on-true', async () => {
        // `disallowIfValueWhen(true, msg, 'ttl')` -> `disallowIfValue`: throws when
        // the renamed `ttl` (title) is staged with a value passing `_isValue`. The
        // `when=false` arm is silent.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 235, ttl: 'Patch CVE-2024-1234', st: 'open', prio: 2 })
                .disallowIfValueWhen(false, 'title is reserved for the triage agent', 'ttl')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tIssue)
                    .shapedAs(shape)
                    .set({ proj: 1, num: 236, ttl: 'Patch CVE-2024-1234', st: 'open', prio: 2 })
                    .disallowIfValueWhen(true, 'title is reserved for the triage agent', 'ttl')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/title is reserved for the triage agent|disallow/i)
        })
    })

    test('shaped-disallow-if-no-value-when-dispatches-on-true', async () => {
        // `disallowIfNoValueWhen(true, msg, 'desc')` -> `disallowIfNoValue`: throws
        // when the renamed `desc` (body) is staged with a null value. The
        // `when=false` arm is silent.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 237, ttl: 'Capture stacktrace from sentry', desc: null, st: 'open', prio: 2 })
                .disallowIfNoValueWhen(false, 'body must include a sentry link', 'desc')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tIssue)
                    .shapedAs(shape)
                    .set({ proj: 1, num: 238, ttl: 'Capture stacktrace from sentry', desc: null, st: 'open', prio: 2 })
                    .disallowIfNoValueWhen(true, 'body must include a sentry link', 'desc')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/body must include a sentry link|disallow/i)
        })
    })

    test('shaped-disallow-any-other-set-when-dispatches-on-true', async () => {
        // `disallowAnyOtherSetWhen(true, msg, 'proj', 'num')` ->
        // `disallowAnyOtherSet`: throws when any staged renamed key falls outside
        // the allow-list. `ttl`/`st`/`prio` are staged beyond `proj`/`num`, so the
        // true arm throws; the `when=false` arm is silent.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.insertInto(tIssue)
                .shapedAs(shape)
                .set({ proj: 1, num: 239, ttl: 'Investigate p99 latency', st: 'open', prio: 2 })
                .disallowAnyOtherSetWhen(false, 'this entry point only accepts proj/num', 'proj', 'num')
                .executeInsert()

            let caught: unknown
            try {
                await ctx.conn.insertInto(tIssue)
                    .shapedAs(shape)
                    .set({ proj: 1, num: 240, ttl: 'Investigate p99 latency', st: 'open', prio: 2 })
                    .disallowAnyOtherSetWhen(true, 'this entry point only accepts proj/num', 'proj', 'num')
                    .executeInsert()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/this entry point only accepts proj\/num|disallow/i)
        })
    })
})
