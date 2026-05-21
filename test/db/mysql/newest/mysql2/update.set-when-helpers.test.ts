// Coverage of every `*When(when: boolean, …)` conditional helper on
// [UpdateQueryBuilder](../../../../../src/queryBuilders/UpdateQueryBuilder.ts).
// Each helper is a thin dispatcher (~3 lines) that routes to its
// non-`When` sibling when the boolean is true, or returns `this`
// unchanged when false — see e.g.
// [L672-677](../../../../../src/queryBuilders/UpdateQueryBuilder.ts#L672-L677).
//
// The behaviour of the underlying methods (`set`, `setIfValue`,
// `setIfHasValue`, `disallowIfSet`, …) is exercised by
// [update.conditional-sets.test.ts](./update.conditional-sets.test.ts);
// this file pins **the dispatch itself**. Each test pairs
// `*When(false, …)` against `*When(true, …)` so the snapshot delta
// shows the dispatch actually fired. Update has no `setForAll*` family
// (multi-row only exists on INSERT) — see the Insert counterpart
// [insert.set-when-helpers.test.ts](./insert.set-when-helpers.test.ts)
// for those.
//
// The scenarios read as triage updates on the seeded issues (ids 1–4
// from `seed.sql`): closing tickets (`status: 'closed'`), filling in
// triage notes (`body`), retitling, etc. The `where(tIssue.id.equals(N))`
// uses ids that may or may not exist in the seed — irrelevant here, the
// assertions only inspect the emitted SQL/params, not the affected row
// count.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('set-when-false-is-noop-true-stages-columns', async () => {
        // setWhen(true) → set: stages columns; when=false leaves the
        // builder without a SET clause (which the executor rejects),
        // so the noop branch is exercised by keeping a sentinel
        // `.set({status})` first so the builder still has columns to
        // commit.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setWhen(false, { title: 'Triage churn alert' })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setWhen(true, { title: 'Triage churn alert' })
                .where(tIssue.id.equals(2))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update issue set \`status\` = ? where id = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"update issue set \`status\` = ?, title = ? where id = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('set-if-value-when-dispatches-on-true', async () => {
        // setIfValueWhen(true) → setIfValue: stages only columns whose
        // incoming value passes `_isValue`. Both branches must keep at
        // least one staged column (the base `.set({status})`).
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setIfValueWhen(false, { title: 'Investigate SSO regression' })
                .where(tIssue.id.equals(3))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setIfValueWhen(true, { title: 'Investigate SSO regression' })
                .where(tIssue.id.equals(4))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update issue set \`status\` = ? where id = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"update issue set \`status\` = ?, title = ? where id = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('set-if-set-when-dispatches-on-true', async () => {
        // setIfSetWhen(true) → setIfSet: only reassigns already-staged
        // columns. when=true closes the ticket; when=false leaves the
        // status alone.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setIfSetWhen(false, { status: 'closed' })
                .where(tIssue.id.equals(5))
                .executeUpdate()
            const falseParams = ctx.lastParams

            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setIfSetWhen(true, { status: 'closed' })
                .where(tIssue.id.equals(6))
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "open",
                5,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "closed",
                6,
              ]
            `)
        })
    })

    test('set-if-set-if-value-when-dispatches-on-true', async () => {
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setIfSetIfValueWhen(false, { status: 'closed' })
                .where(tIssue.id.equals(7))
                .executeUpdate()
            const falseParams = ctx.lastParams

            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setIfSetIfValueWhen(true, { status: 'closed' })
                .where(tIssue.id.equals(8))
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "open",
                7,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "closed",
                8,
              ]
            `)
        })
    })

    test('set-if-not-set-when-dispatches-on-true', async () => {
        // setIfNotSetWhen(true) → setIfNotSet: only assigns columns
        // NOT already staged. `body` is unstaged → fills it with
        // triage notes when true.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setIfNotSetWhen(false, { body: 'Pending triage notes.' })
                .where(tIssue.id.equals(9))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setIfNotSetWhen(true, { body: 'Pending triage notes.' })
                .where(tIssue.id.equals(10))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update issue set \`status\` = ? where id = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"update issue set \`status\` = ?, body = ? where id = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('set-if-not-set-if-value-when-dispatches-on-true', async () => {
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setIfNotSetIfValueWhen(false, { body: 'Pending triage notes.' })
                .where(tIssue.id.equals(11))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setIfNotSetIfValueWhen(true, { body: 'Pending triage notes.' })
                .where(tIssue.id.equals(12))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update issue set \`status\` = ? where id = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"update issue set \`status\` = ?, body = ? where id = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('ignore-if-set-when-dispatches-on-true', async () => {
        // ignoreIfSetWhen(true, 'body') → ignoreIfSet: removes a
        // staged column from the UPDATE.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: 'Reporter-supplied notes.' })
                .ignoreIfSetWhen(false, 'body')
                .where(tIssue.id.equals(13))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: 'Reporter-supplied notes.' })
                .ignoreIfSetWhen(true, 'body')
                .where(tIssue.id.equals(14))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update issue set \`status\` = ?, body = ? where id = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"update issue set \`status\` = ? where id = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('keep-only-when-dispatches-on-true', async () => {
        // keepOnlyWhen(true, 'status') → keepOnly: drops every staged
        // column not in the keep-list — useful when an upstream form
        // staged extras but only `status` should land on this path.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: 'Draft body to be discarded.' })
                .keepOnlyWhen(false, 'status')
                .where(tIssue.id.equals(15))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: 'Draft body to be discarded.' })
                .keepOnlyWhen(true, 'status')
                .where(tIssue.id.equals(16))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update issue set \`status\` = ?, body = ? where id = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"update issue set \`status\` = ? where id = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('set-if-has-value-when-dispatches-on-true', async () => {
        // setIfHasValueWhen(true) → setIfHasValue: only overwrites
        // staged columns whose current value is non-null. `body` is
        // staged as null so the override leaves it alone; `status`
        // gets re-assigned.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: null })
                .setIfHasValueWhen(false, { status: 'closed', body: 'Should remain null.' })
                .where(tIssue.id.equals(17))
                .executeUpdate()
            const falseParams = ctx.lastParams

            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: null })
                .setIfHasValueWhen(true, { status: 'closed', body: 'Should remain null.' })
                .where(tIssue.id.equals(18))
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "open",
                null,
                17,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "closed",
                null,
                18,
              ]
            `)
        })
    })

    test('set-if-has-value-if-value-when-dispatches-on-true', async () => {
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setIfHasValueIfValueWhen(false, { status: 'closed' })
                .where(tIssue.id.equals(19))
                .executeUpdate()
            const falseParams = ctx.lastParams

            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .setIfHasValueIfValueWhen(true, { status: 'closed' })
                .where(tIssue.id.equals(20))
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "open",
                19,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "closed",
                20,
              ]
            `)
        })
    })

    test('set-if-has-no-value-when-dispatches-on-true', async () => {
        // setIfHasNoValueWhen(true) → setIfHasNoValue: only assigns
        // staged columns whose current value IS null. Default-body
        // backfill flow.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: null })
                .setIfHasNoValueWhen(false, { body: 'Pending triage notes.' })
                .where(tIssue.id.equals(21))
                .executeUpdate()
            const falseParams = ctx.lastParams

            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: null })
                .setIfHasNoValueWhen(true, { body: 'Pending triage notes.' })
                .where(tIssue.id.equals(22))
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "open",
                null,
                21,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "open",
                "Pending triage notes.",
                22,
              ]
            `)
        })
    })

    test('set-if-has-no-value-if-value-when-dispatches-on-true', async () => {
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: null })
                .setIfHasNoValueIfValueWhen(false, { body: 'Pending triage notes.' })
                .where(tIssue.id.equals(23))
                .executeUpdate()
            const falseParams = ctx.lastParams

            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: null })
                .setIfHasNoValueIfValueWhen(true, { body: 'Pending triage notes.' })
                .where(tIssue.id.equals(24))
                .executeUpdate()
            const trueParams = ctx.lastParams

            expect(falseParams).toMatchInlineSnapshot(`
              [
                "open",
                null,
                23,
              ]
            `)
            expect(trueParams).toMatchInlineSnapshot(`
              [
                "open",
                "Pending triage notes.",
                24,
              ]
            `)
        })
    })

    test('ignore-if-has-value-when-dispatches-on-true', async () => {
        // ignoreIfHasValueWhen(true, 'status') → ignoreIfHasValue:
        // drops `status` if its staged value is non-null.
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: 'Reporter-supplied notes.' })
                .ignoreIfHasValueWhen(false, 'status')
                .where(tIssue.id.equals(25))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: 'Reporter-supplied notes.' })
                .ignoreIfHasValueWhen(true, 'status')
                .where(tIssue.id.equals(26))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update issue set \`status\` = ?, body = ? where id = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"update issue set body = ? where id = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('ignore-if-has-no-value-when-dispatches-on-true', async () => {
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: null })
                .ignoreIfHasNoValueWhen(false, 'body')
                .where(tIssue.id.equals(27))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: null })
                .ignoreIfHasNoValueWhen(true, 'body')
                .where(tIssue.id.equals(28))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update issue set \`status\` = ?, body = ? where id = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"update issue set \`status\` = ? where id = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('ignore-any-set-with-no-value-when-dispatches-on-true', async () => {
        ctx.mockNext(1)
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: null })
                .ignoreAnySetWithNoValueWhen(false)
                .where(tIssue.id.equals(29))
                .executeUpdate()
            const falseSql = ctx.lastSql

            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: null })
                .ignoreAnySetWithNoValueWhen(true)
                .where(tIssue.id.equals(30))
                .executeUpdate()
            const trueSql = ctx.lastSql

            expect(falseSql).toMatchInlineSnapshot(`"update issue set \`status\` = ?, body = ? where id = ?"`)
            expect(trueSql).toMatchInlineSnapshot(`"update issue set \`status\` = ? where id = ?"`)
            expect(trueSql).not.toBe(falseSql)
        })
    })

    test('disallow-if-set-when-dispatches-on-true', async () => {
        // disallowIfSetWhen(true, error, col) → throws when col is
        // staged. when=false is silent. Models a "audit-only endpoint
        // refuses to mutate status" policy.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .disallowIfSetWhen(false, 'status is read-only on this endpoint', 'status')
                .where(tIssue.id.equals(31))
                .executeUpdate()

            let caught: unknown
            try {
                await ctx.conn.update(tIssue)
                    .set({ status: 'open' })
                    .disallowIfSetWhen(true, 'status is read-only on this endpoint', 'status')
                    .where(tIssue.id.equals(32))
                    .executeUpdate()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/status is read-only on this endpoint|disallow/i)
        })
    })

    test('disallow-if-not-set-when-dispatches-on-true', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .disallowIfNotSetWhen(false, 'body is required on the triage endpoint', 'body')
                .where(tIssue.id.equals(33))
                .executeUpdate()

            let caught: unknown
            try {
                await ctx.conn.update(tIssue)
                    .set({ status: 'open' })
                    .disallowIfNotSetWhen(true, 'body is required on the triage endpoint', 'body')
                    .where(tIssue.id.equals(34))
                    .executeUpdate()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/body is required on the triage endpoint|disallow/i)
        })
    })

    test('disallow-if-value-when-dispatches-on-true', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .disallowIfValueWhen(false, 'status changes go through the workflow endpoint', 'status')
                .where(tIssue.id.equals(35))
                .executeUpdate()

            let caught: unknown
            try {
                await ctx.conn.update(tIssue)
                    .set({ status: 'open' })
                    .disallowIfValueWhen(true, 'status changes go through the workflow endpoint', 'status')
                    .where(tIssue.id.equals(36))
                    .executeUpdate()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/status changes go through the workflow endpoint|disallow/i)
        })
    })

    test('disallow-if-no-value-when-dispatches-on-true', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open', body: null })
                .disallowIfNoValueWhen(false, 'cannot clear the body via this endpoint', 'body')
                .where(tIssue.id.equals(37))
                .executeUpdate()

            let caught: unknown
            try {
                await ctx.conn.update(tIssue)
                    .set({ status: 'open', body: null })
                    .disallowIfNoValueWhen(true, 'cannot clear the body via this endpoint', 'body')
                    .where(tIssue.id.equals(38))
                    .executeUpdate()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/cannot clear the body via this endpoint|disallow/i)
        })
    })

    test('disallow-any-other-set-when-dispatches-on-true', async () => {
        // Models a "status-only" workflow endpoint that rejects any
        // attempt to mutate other columns on the same call.
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            await ctx.conn.update(tIssue)
                .set({ status: 'open' })
                .disallowAnyOtherSetWhen(false, 'this endpoint only updates status', 'status')
                .where(tIssue.id.equals(39))
                .executeUpdate()

            let caught: unknown
            try {
                await ctx.conn.update(tIssue)
                    .set({ status: 'open', body: 'Should be rejected.' })
                    .disallowAnyOtherSetWhen(true, 'this endpoint only updates status', 'status')
                    .where(tIssue.id.equals(40))
                    .executeUpdate()
            } catch (e) {
                caught = e
            }
            expect(String(caught)).toMatch(/this endpoint only updates status|disallow/i)
        })
    })
})
