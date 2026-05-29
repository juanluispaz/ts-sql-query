// Coverage of the propagation methods on five `ValueSourceImpl`
// subclasses that the existing IfValue tests miss because they only
// build SELECT statements. SELECT only walks `__addWiths` /
// `__registerTableOrView` / `__registerRequiredColumn` / `__isAllowed`
// on every node — it never calls `__getOldValues` /
// `__getValuesForInsert` (those are wired by UPDATE / INSERT
// builders to decide whether to materialise the `_old_` / EXCLUDED
// subquery). Placing the same operators in an UPDATE WHERE / SET
// closes the remaining uncovered ranges:
//
//   - `SqlOperation1ValueSourceIfValueOrNoop` (L1192-1248): created by
//     the `*IfValue(value)` family. Test 1 uses `equalsIfValue` in an
//     UPDATE WHERE, exercising the value-present branches of every
//     method on the node (including `__getOldValues` L1230-1234 and
//     `__getValuesForInsert` L1236-1240).
//   - `SqlOperationInValueSourceIfValueOrNoop` (L1250-1373): test 2
//     uses `inIfValue([…])` in an UPDATE WHERE. The non-empty array
//     also exercises the per-item loops at L1273-1278 (`__addWiths`),
//     L1287-1292 (`__registerTableOrView`), L1301-1307
//     (`__registerRequiredColumn`), L1318-1324 (`__getOldValues`)
//     and the matching `__getValuesForInsert` / `__isAllowed`.
//   - `SqlOperation2ValueSource` (L1425-1465): test 3 uses
//     `between(a, b)` in an UPDATE WHERE; the 2-arg comparator has no
//     IfValue guard so every method always propagates.
//   - `SqlOperation1ValueSourceIfValueOrIgnore` (L1385-1423): test 4
//     uses `concatIfValue(suffix)` inside an UPDATE SET expression —
//     the OrIgnore variant fires the propagation through the SET
//     right-hand side, exercising L1407-1421.
//   - `SqlOperation2ValueSourceIfValueOrIgnore` (L1467-1513): test 5
//     uses `replaceAllIfValue(find, replace)` inside an UPDATE SET
//     expression, exercising the 2-arg OrIgnore propagation at
//     L1495-1511.
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
        // calls execute the value-present branches at L1216-1247.
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = ? where id = ? and name = ?"`)
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
        // `Array.isArray(values)` branches at L1273-1278 etc.) plus
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ? where project_id = ? and priority in (?, ?, ?)"`)
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
        // propagation methods at L1447-1460 always walk the LHS and
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue set status = ? where project_id = ? and priority between ? and ?"`)
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
        // exercises the propagation methods at L1407-1421 via
        // UpdateQueryBuilder walking SET expressions.
        ctx.mockNext(1)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            const suffix: string = ' (was)'
            const affected = await connection.update(tProject)
                .set({ name: tProject.name.concatIfValue(suffix) })
                .where(tProject.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = name || ? where id = ?"`)
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
        // at L1495-1511 fire from UpdateQueryBuilder walking SET
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

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update project set name = replace(name, ?, ?) where id = ?"`)
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
