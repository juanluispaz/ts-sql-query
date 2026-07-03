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

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority) values (?, ?, ?, ?, ?)"`)
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

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority) values (?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority, body) values (?, ?, ?, ?, ?, ?)"`)
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

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority, body) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority) values (?, ?, ?, ?, ?)"`)
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

            expect(falseSql).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority, body) values (?, ?, ?, ?, ?, ?)"`)
            expect(trueSql).toMatchInlineSnapshot(`"insert into issue (project_id, \`number\`, title, \`status\`, priority) values (?, ?, ?, ?, ?)"`)
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
})
