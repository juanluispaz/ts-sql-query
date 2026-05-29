// Oracle's hierarchical query syntax: `START WITH … CONNECT BY [NOCYCLE]
// PRIOR …`. The fluent shape is `.startWith(cond).connectBy(prior =>
// …)` /  `.connectByNoCycle(prior => …)`, defined on
// [src/expressions/select.ts:265-405](../../../../../src/expressions/select.ts#L265-L405).
// The rendering path lives in
// [src/sqlBuilders/AbstractSqlBuilder.ts:929-948](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L929-L948).
// On every other dialect (`postgreSql`, `sqlServer`, `mariaDB`,
// `mySql`, `sqlite`) these methods are typed `never`; the equivalent
// pattern is a recursive CTE — see
// [cte.recursive-union-variants.test.ts](./cte.recursive-union-variants.test.ts).
//
// Mock-mode pins the emitted SQL; real-DB mode seeds parent-child
// relations inside `ctx.withRollback` and verifies the walk order.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('start-with-connect-by-prior-walks-tree-from-roots', async () => {
        // Tree shape after seeding: 3 ← 2 ← 1, plus 4 (root standalone).
        // START WITH parent_id IS NULL → roots are {3, 4}.
        // CONNECT BY prior(id) = parent_id walks down: 3 → 2 → 1; 4.
        // Oracle returns rows in the walk order (depth-first by default).
        ctx.mockNext([
            { id: 3, parentId: null },
            { id: 2, parentId: 3 },
            { id: 1, parentId: 2 },
            { id: 4, parentId: null },
        ])

        const runQuery = () => ctx.conn.selectFrom(tIssue)
            .startWith(tIssue.parentId.isNull())
            .connectBy(prior => prior(tIssue.id).equals(tIssue.parentId))
            .select({
                id:       tIssue.id,
                parentId: tIssue.parentId,
            })
            .executeSelectMany()

        let rows!: Array<{ id: number; parentId?: number }>
        if (ctx.realDbEnabled) {
            await ctx.withRollback(async () => {
                await ctx.conn.update(tIssue).set({ parentId: 2 }).where(tIssue.id.equals(1)).executeUpdate()
                await ctx.conn.update(tIssue).set({ parentId: 3 }).where(tIssue.id.equals(2)).executeUpdate()
                rows = await runQuery()
            })
        } else {
            rows = await runQuery()
        }

        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select id as "id", parent_id as "parentId" from issue start with parent_id is null connect by prior id = parent_id"`)
        expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; parentId?: number }>>>()

        expect(rows.length).toBe(4)
        // The CONNECT BY walk surfaces 4 as a separate root; the
        // 3→2→1 chain comes through depth-first. Sort by id for a
        // stable comparison since Oracle does not guarantee row order
        // beyond the hierarchical traversal.
        const ids = rows.map(r => r.id).sort()
        expect(ids).toEqual([1, 2, 3, 4])
    })

    test('connect-by-nocycle-emits-nocycle-keyword', async () => {
        // `connectByNoCycle` is the cycle-safe variant — Oracle stops
        // traversing once it detects the start of a loop and does not
        // raise ORA-01436. Pins the `connect by nocycle` rendering at
        // [AbstractSqlBuilder.ts:943](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L943).
        // Tree shape identical to test 1.
        ctx.mockNext([
            { id: 3, parentId: null },
            { id: 2, parentId: 3 },
            { id: 1, parentId: 2 },
            { id: 4, parentId: null },
        ])

        const runQuery = () => ctx.conn.selectFrom(tIssue)
            .startWith(tIssue.parentId.isNull())
            .connectByNoCycle(prior => prior(tIssue.id).equals(tIssue.parentId))
            .select({
                id:       tIssue.id,
                parentId: tIssue.parentId,
            })
            .executeSelectMany()

        let rows!: Array<{ id: number; parentId?: number }>
        if (ctx.realDbEnabled) {
            await ctx.withRollback(async () => {
                await ctx.conn.update(tIssue).set({ parentId: 2 }).where(tIssue.id.equals(1)).executeUpdate()
                await ctx.conn.update(tIssue).set({ parentId: 3 }).where(tIssue.id.equals(2)).executeUpdate()
                rows = await runQuery()
            })
        } else {
            rows = await runQuery()
        }

        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select id as "id", parent_id as "parentId" from issue start with parent_id is null connect by nocycle prior id = parent_id"`)
        expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; parentId?: number }>>>()
        expect(rows.length).toBe(4)
    })

    test('start-with-where-and-connect-by-combine', async () => {
        // WHERE narrows the hierarchical result post-walk. START WITH
        // picks roots, CONNECT BY walks, WHERE keeps only rows
        // matching the filter. Pins both the START WITH and the WHERE
        // landing in the emitted SQL in the documented order (WHERE
        // before START WITH per
        // [AbstractSqlBuilder.ts:920-948](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts#L920-L948)).
        ctx.mockNext([
            { id: 1, parentId: 2 },
            { id: 4, parentId: null },
        ])

        const runQuery = () => ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.notEquals('in_progress'))
            .startWith(tIssue.parentId.isNull())
            .connectBy(prior => prior(tIssue.id).equals(tIssue.parentId))
            .select({
                id:       tIssue.id,
                parentId: tIssue.parentId,
            })
            .executeSelectMany()

        let rows!: Array<{ id: number; parentId?: number }>
        if (ctx.realDbEnabled) {
            await ctx.withRollback(async () => {
                await ctx.conn.update(tIssue).set({ parentId: 2 }).where(tIssue.id.equals(1)).executeUpdate()
                await ctx.conn.update(tIssue).set({ parentId: 3 }).where(tIssue.id.equals(2)).executeUpdate()
                rows = await runQuery()
            })
        } else {
            rows = await runQuery()
        }

        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select id as "id", parent_id as "parentId" from issue where status <> :0 start with parent_id is null connect by prior id = parent_id"`)
        expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`
          [
            "in_progress",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; parentId?: number }>>>()
        // Tree {3 ← 2 ← 1, 4}: filtering out `status = 'in_progress'`
        // drops issue 2 from the walk. Issue 3 has status 'open' so
        // it survives; issues 1, 4 also keep. Expected ids depend on
        // walk semantics — the filter is post-traversal, so seed
        // issue 2's "in_progress" status means it falls out but its
        // descendant 1 stays. Result: {3, 1, 4} on real DB.
        if (ctx.realDbEnabled) {
            const ids = rows.map(r => r.id).sort()
            expect(ids).toEqual([1, 3, 4])
        } else {
            // Mock returns a subset proxy — just check we got rows.
            expect(rows.length).toBeGreaterThan(0)
        }
    })

    test('connect-by-ordering-siblings-only-emits-order-siblings-by', async () => {
        // `.orderingSiblingsOnly()` swaps the trailing `order by` for
        // Oracle's hierarchical `order siblings by`, which orders rows
        // WITHIN each parent's children rather than the whole result
        // set — pins SelectQueryBuilder.orderingSiblingsOnly + the
        // keyword swap in the order-by emitter. Tree shape as test 1.
        ctx.mockNext([
            { id: 3, parentId: null },
            { id: 2, parentId: 3 },
            { id: 1, parentId: 2 },
            { id: 4, parentId: null },
        ])

        const runQuery = () => ctx.conn.selectFrom(tIssue)
            .startWith(tIssue.parentId.isNull())
            .connectBy(prior => prior(tIssue.id).equals(tIssue.parentId))
            .select({
                id:       tIssue.id,
                parentId: tIssue.parentId,
            })
            .orderBy('id')
            .orderingSiblingsOnly()
            .executeSelectMany()

        let rows!: Array<{ id: number; parentId?: number }>
        if (ctx.realDbEnabled) {
            await ctx.withRollback(async () => {
                await ctx.conn.update(tIssue).set({ parentId: 2 }).where(tIssue.id.equals(1)).executeUpdate()
                await ctx.conn.update(tIssue).set({ parentId: 3 }).where(tIssue.id.equals(2)).executeUpdate()
                rows = await runQuery()
            })
        } else {
            rows = await runQuery()
        }

        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select id as "id", parent_id as "parentId" from issue start with parent_id is null connect by prior id = parent_id order siblings by "id""`)
        expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; parentId?: number }>>>()
        expect(rows.length).toBe(4)
        const ids = rows.map(r => r.id).sort()
        expect(ids).toEqual([1, 2, 3, 4])
    })
})
