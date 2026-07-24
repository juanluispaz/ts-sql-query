// A WHERE condition that is PRESENT but renders to the empty string.
//
// `connection.dynamicBooleanExpressionUsing(table)` returns the neutral
// element of the dynamic-boolean system: a real condition object that
// contributes no SQL. Handed to `.where(...)` with nothing `and`-ed onto
// it, the mutation therefore carries a where condition that emits nothing.
//
// This is a different state from "no `.where(...)` was ever called", and
// the library must collapse the two: an empty-rendering condition is
// treated as NO WHERE — never as an empty `where ()` and never as a
// silently-dropped predicate that would leave a full-table statement
// looking guarded. Two observables pin that down:
//
//   * `update(...)` / `deleteFrom(...)` refuse the statement with
//     `MISSING_WHERE` — the same refusal a where-less statement gets, even
//     though the static guard is satisfied here (`.where(...)` WAS called,
//     so `executeUpdate` / `executeDelete` are typed and reachable; only
//     the runtime guard can catch this).
//   * `updateAllowingNoWhere(...)` / `deleteAllowingNoWhereFrom(...)` waive
//     the refusal and emit SQL with no `where` clause at all.
//
// The contrast tests supply a criterion to the very same dynamic
// condition: it then renders a real `where` and no refusal fires — so the
// refusal is attributable to the empty rendering, not to the presence of a
// dynamic condition.
//
// Every test runs inside `ctx.withRollback(...)`: two of them mutate every
// seeded issue, and the refused ones would mutate every seeded issue too if
// the guard ever regressed — which is exactly the failure this file is
// meant to catch, so the rollback keeps the cell clean in that case as well.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('where-renders-empty/update-with-an-empty-dynamic-condition-is-refused', async () => {
        // The condition is present, so `.executeUpdate()` is statically
        // available — the refusal is purely dynamic. No SQL is produced, so
        // there is nothing to snapshot: the observables are the error
        // identity, its reason, and the fact that nothing reached the driver
        // (`lastNoTransactionSql` skips the transaction-control entries the
        // rollback wrapper adds).
        //
        // Observable limit, stated plainly: an update with NO `where` at all
        // is refused with the same error and the same reason, so this test
        // pins the REFUSAL, not which of the two paths produced it. What it
        // does establish is that a condition which renders nothing is treated
        // as no condition rather than silently dropped — the sibling test
        // below shows the same statement building once the guard is waived.
        await ctx.withRollback(async () => {
            const emptyDynamicWhere = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
            const query = ctx.conn.update(tIssue)
                .set({ status: 'archived' })
                .where(emptyDynamicWhere)

            let thrown: unknown
            try {
                await query.executeUpdate()
            } catch (e) {
                thrown = e
            }
            expect(thrown).toBeInstanceOf(TsSqlError)
            expect((thrown as Error).message).toContain('No where defined for the update operation')
            const reason = thrown instanceof TsSqlError ? thrown.errorReason : undefined
            expect(reason?.reason).toBe('MISSING_WHERE')
            expect(ctx.lastNoTransactionSql).toBe('')
        })
    })

    test('where-renders-empty/update-allowing-no-where-with-an-empty-dynamic-condition-emits-no-where', async () => {
        // Same statement on the guard-relaxed builder: the empty-rendering
        // condition contributes no `where` clause and the UPDATE touches all
        // 4 seeded issues. The absence of `where` in the snapshot is what
        // proves the condition was collapsed rather than rendered as an
        // empty predicate.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const emptyDynamicWhere = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
            const query = ctx.conn.updateAllowingNoWhere(tIssue)
                .set({ status: 'archived' })
                .where(emptyDynamicWhere)

            const affected = await query.executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })

    test('where-renders-empty/update-with-a-populated-dynamic-condition-renders-a-real-where', async () => {
        // The falsifiable contrast: the same dynamic condition, this time
        // with a criterion `and`-ed onto it. It renders a real predicate, the
        // guard stays silent, and only the 2 seeded issues whose status is
        // 'open' (ids 1 and 3) are updated.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            let dynamicWhere = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
            dynamicWhere = dynamicWhere.and(tIssue.status.equals('open'))

            const query = ctx.conn.update(tIssue)
                .set({ status: 'archived' })
                .where(dynamicWhere)

            const affected = await query.executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = $1 where status = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
                "open",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        })
    })

    test('where-renders-empty/delete-with-an-empty-dynamic-condition-is-refused', async () => {
        // DELETE twin of the refused UPDATE: the condition is present (so
        // `.executeDelete()` is statically reachable) but renders nothing, so
        // the whole-table guard fires. Nothing to snapshot — the error and
        // the absence of any dispatched statement are the observables. As with
        // the UPDATE twin, a delete with no `where` at all is refused with the
        // same reason, so this pins the refusal rather than the path taken.
        await ctx.withRollback(async () => {
            const emptyDynamicWhere = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
            const query = ctx.conn.deleteFrom(tIssue)
                .where(emptyDynamicWhere)

            let thrown: unknown
            try {
                await query.executeDelete()
            } catch (e) {
                thrown = e
            }
            expect(thrown).toBeInstanceOf(TsSqlError)
            expect((thrown as Error).message).toContain('No where defined for the delete operation')
            const reason = thrown instanceof TsSqlError ? thrown.errorReason : undefined
            expect(reason?.reason).toBe('MISSING_WHERE')
            expect(ctx.lastNoTransactionSql).toBe('')
        })
    })

    test('where-renders-empty/delete-allowing-no-where-with-an-empty-dynamic-condition-emits-no-where', async () => {
        // The guard-relaxed DELETE emits no `where` clause and removes all 4
        // seeded issues; the worklog and webhook rows referencing them are
        // declared ON DELETE CASCADE, so the whole-table delete trips no FK
        // constraint. `issue.parent_id` also references `issue(id)` and is
        // NOT cascading — the delete is safe only because the seed leaves
        // `parent_id` NULL on all four rows.
        ctx.mockNext(4)
        await ctx.withRollback(async () => {
            const emptyDynamicWhere = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
            const query = ctx.conn.deleteAllowingNoWhereFrom(tIssue)
                .where(emptyDynamicWhere)

            const affected = await query.executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(4)
        })
    })

    test('where-renders-empty/delete-with-a-populated-dynamic-condition-renders-a-real-where', async () => {
        // DELETE contrast: the same dynamic condition carrying a criterion
        // renders a real predicate, so no refusal fires and only the 2 seeded
        // issues with status 'open' (ids 1 and 3) are removed.
        ctx.mockNext(2)
        await ctx.withRollback(async () => {
            let dynamicWhere = ctx.conn.dynamicBooleanExpressionUsing(tIssue)
            dynamicWhere = dynamicWhere.and(tIssue.status.equals('open'))

            const query = ctx.conn.deleteFrom(tIssue)
                .where(dynamicWhere)

            const affected = await query.executeDelete()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"delete from issue where status = $1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "open",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)
        })
    })
})
