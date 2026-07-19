// Behavioral coverage of the UPDATE `setIf*` family: setIfValue,
// setIfNotSet, ignoreIfSet. Each mutation runs in a rollback so the seed
// survives between tests.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('set-if-value-drops-null-fields', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const newTitle: string | null = 'Updated title'
            const newPriority: number | null = null
            const affected = await ctx.conn.update(tIssue)
                .set({})
                .setIfValue({ title:    newTitle })
                .setIfValue({ priority: newPriority })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Updated title",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('set-if-not-set-honors-prior-set', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            // `set` already defines `title`; `setIfNotSet` does NOT override
            // it because title is already set. So title stays "Forced".
            const affected = await ctx.conn.update(tIssue)
                .set({ title: 'Forced' })
                .setIfNotSet({ title: 'Default (ignored)' })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Forced",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('ignore-if-set-removes-prior', async () => {
        ctx.mockNext(1)
        await ctx.withRollback(async () => {
            const affected = await ctx.conn.update(tIssue)
                .set({ title: 'Would have changed' })
                .ignoreIfSet('title')
                .setIfNotSet({ title: 'Restored to default' })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set title = ? where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Restored to default",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
    test('set-minmax-poison-case-in-update-set', async () => {
        // A minValue/maxValue poison CASE in an UPDATE SET value. `assigneeId` (optional int)
        // is set to `assigneeId.maxValue(parentId)`; both operands optional → the SET
        // expression is the both-optional poison CASE. Issue 1 has assignee_id=1,
        // parent_id=NULL, so the SET evaluates to NULL (poisoned), which we read back.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.update(tIssue)
                .set({ assigneeId: tIssue.assigneeId.maxValue(tIssue.parentId) })
                .where(tIssue.id.equals(1))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set assignee_id = min(assignee_id, parent_id) where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)

            ctx.mockNext({ id: 1 })
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({ id: tIssue.id, assigneeId: tIssue.assigneeId })
                .executeSelectOne()
            expect(row).toEqual({ id: 1 })
            expect('assigneeId' in row).toBe(false)
        })
    })
    test('collation-forks-in-a-mutation-set-and-where', async () => {
        // a `replaceAllInsensitive` transform in an UPDATE SET value and a
        // `.collate()` in the WHERE — the collation forks reach the mutation seam (every
        // other collation test emits into a SELECT). The SET rewrites full_name; the search
        // term 'Love' matches 'Love' in 'Ada Lovelace' in the same case, so the result
        // coincides whether the engine folds case or not — 'Ada Xlace'. The WHERE forces the
        // code-point collation on the email match; only user 1 matches.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.update(tAppUser)
                .set({ fullName: tAppUser.fullName.replaceAllInsensitive('Love', 'X') })
                .where(tAppUser.email.collate('BINARY').equals('ada@acme.test'))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update app_user set full_name = replace(full_name, ?, ?) where (email collate BINARY) = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Love",
                "X",
                "ada@acme.test",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)

            ctx.mockNext({ id: 1, fullName: 'Ada Xlace' })
            const row = await ctx.conn.selectFrom(tAppUser)
                .where(tAppUser.id.equals(1))
                .select({ id: tAppUser.id, fullName: tAppUser.fullName })
                .executeSelectOne()
            expect(row).toEqual({ id: 1, fullName: 'Ada Xlace' })
        })
    })
    test('concat-with-optional-operand-in-update-set', async () => {
        // a `concat` with an OPTIONAL operand in an UPDATE SET value. `body` (optional
        // string) is set to `title.concat(body)`; the optional operand makes the SET
        // expression NULL-sensitive, so on engines whose `||` poisons on NULL (Oracle) it is
        // wrapped in a NULL-guard CASE (`case when body is null then null else title || body
        // end`), which the per-dialect snapshot pins. Issue 2 has body 'Use new tokens',
        // title 'Redesign navbar' → the concatenation; read back.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.update(tIssue)
                .set({ body: tIssue.title.concat(tIssue.body) })
                .where(tIssue.id.equals(2))
                .executeUpdate()
            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set body = title || body where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)

            ctx.mockNext({ id: 2, body: 'Redesign navbarUse new tokens' })
            const row = await ctx.conn.selectFrom(tIssue)
                .where(tIssue.id.equals(2))
                .select({ id: tIssue.id, body: tIssue.body })
                .executeSelectOne()
            expect(row).toEqual({ id: 2, body: 'Redesign navbarUse new tokens' })
        })
    })
})
