// Coverage of the IfValue operators (and `between`) inside an UPDATE,
// which the existing IfValue tests miss because they only build SELECT
// statements. A SELECT only asks each expression for the withs, tables
// and columns it uses and whether it is allowed; an UPDATE or an INSERT
// also asks whether it reads the old values (`_old_`) or the values for
// insert (EXCLUDED), to decide whether to add that subquery. Placing the
// same operators in an UPDATE WHERE / SET covers that:
//
// - test 1: `equalsIfValue(value)` in an UPDATE WHERE, with the value
//     present.
// - test 2: `inIfValue([…])` in an UPDATE WHERE; the non-empty array
//     propagates through each of its items.
// - test 3: `between(a, b)` in an UPDATE WHERE; the 2-arg comparator
//     has no IfValue guard, so it always propagates.
// - test 4: `concatIfValue(suffix)` inside an UPDATE SET expression; the
//     propagation goes through the SET right-hand side.
// - test 5: `replaceAllIfValue(find, replace)` inside an UPDATE SET
//     expression, the 2-arg IfValue variant.
//
// LHS columns are all from `tProject` / `tIssue` (no `oldValues()` /
// `valuesForInsert()` references), so the SQL surface is portable
// across every dialect — the per-cell snapshots differ only in
// parameter placeholder shape (`$N` / `?` / `:N` / `@N`) and the
// usual SET / RETURNING quoting.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('equals-if-value-in-update-where-fires-old-values-and-values-for-insert-propagation', async () => {
        // `tProject.name.equalsIfValue('foo')` lives inside the WHERE
        // of an UPDATE. UpdateQueryBuilder calls every propagation
        // method on the predicate node (the
        // `SqlOperation1ValueSourceIfValueOrNoop` instance) to decide
        // whether to materialise the `_old_` subquery and whether
        // the statement references EXCLUDED columns — even though
        // both checks return `undefined` for a regular column, the
        // calls execute the value-present branches.
        // The SQL is the standard `update … where id = $1 and name = $2`.
        ctx.mockNext(1)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            const filterName: string = 'Marketing site'
            const affected = await connection.update(tProject)
                .set({ name: 'Marketing site v9' })
                .where(tProject.id.equals(1))
                  .and(tProject.name.equalsIfValue(filterName))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = $1 where id = $2 and name = $3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "Marketing site v9",
                1,
                "Marketing site",
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(1)
        })
    })

    test('in-if-value-in-update-where-fires-array-iteration-propagation', async () => {
        // `tIssue.priority.inIfValue([1, 2, 3])` lives inside the
        // WHERE of an UPDATE. UpdateQueryBuilder walks the predicate
        // and the `SqlOperationInValueSourceIfValueOrNoop` node fires
        // the array-iteration arms of every propagation method (the
        // `Array.isArray(values)` branches) plus
        // its own `__getOldValues` / `__getValuesForInsert` calls.
        // Three placeholders land in the WHERE for the array
        // contents.
        ctx.mockNext(2)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            const priorities: number[] = [1, 2, 3]
            const affected = await connection.update(tIssue)
                .set({ status: 'archived' })
                .where(tIssue.projectId.equals(1))
                  .and(tIssue.priority.inIfValue(priorities))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = $1 where project_id = $2 and priority in ($3, $4, $5)"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
                1,
                1,
                2,
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(2)
        })
    })

    test('between-in-update-where-fires-two-arg-propagation', async () => {
        // `tIssue.priority.between(1, 3)` is the 2-arg shape of
        // `SqlOperation2ValueSource`. No IfValue early-return — the
        // propagation methods always walk the LHS and
        // both values. We exercise the path inside an UPDATE WHERE
        // so UpdateQueryBuilder also calls `__getOldValues` /
        // `__getValuesForInsert` (both returning undefined for plain
        // column / literal values).
        ctx.mockNext(2)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            const affected = await connection.update(tIssue)
                .set({ status: 'archived' })
                .where(tIssue.projectId.equals(1))
                  .and(tIssue.priority.between(1, 3))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = $1 where project_id = $2 and priority between $3 and $4"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "archived",
                1,
                1,
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(2)
        })
    })

    test('concat-if-value-in-update-set-fires-or-ignore-propagation', async () => {
        // `tProject.name.concatIfValue(' (was)')` is the OrIgnore
        // variant of the IfValue family —
        // `SqlOperation1ValueSourceIfValueOrIgnore`. When the value is
        // present, the operator emits a `||` concat; when absent, the
        // node renders the LHS unchanged (test
        // `select.value-source.if-value-negated-and-is` already pins
        // the "absent" path). Placing it inside an UPDATE SET
        // exercises the propagation methods via
        // UpdateQueryBuilder walking SET expressions.
        ctx.mockNext(1)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            const suffix: string = ' (was)'
            const affected = await connection.update(tProject)
                .set({ name: tProject.name.concatIfValue(suffix) })
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = name || $1 where id = $2"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                " (was)",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(1)
        })
    })

    test('replace-all-if-value-in-update-set-fires-two-arg-or-ignore-propagation', async () => {
        // `tProject.name.replaceAllIfValue('site', 'gateway')` is the
        // 2-arg OrIgnore variant —
        // `SqlOperation2ValueSourceIfValueOrIgnore`. Both find /
        // replace values are concrete, so the operator emits the
        // `replace(<col>, $1, $2)` shape and the propagation methods
        // fire from UpdateQueryBuilder walking SET
        // expressions.
        ctx.mockNext(1)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            const findValue: string = 'site'
            const replaceValue: string = 'gateway'
            const affected = await connection.update(tProject)
                .set({ name: tProject.name.replaceAllIfValue(findValue, replaceValue) })
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = replace(name, $1, $2) where id = $3"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                "site",
                "gateway",
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            if (!ctx.realDbEnabled) expect(affected).toBe(1)
        })
    })
})
