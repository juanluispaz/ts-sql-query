// Hierarchical query syntax: `START WITH … CONNECT BY [NOCYCLE]
// PRIOR …`. The fluent shape is `.startWith(cond).connectBy(prior =>
// …)` / `.connectByNoCycle(prior => …)`. On the dialects whose grammar
// has no CONNECT BY these methods are typed `never`; the equivalent
// pattern is a recursive CTE — see
// [cte.recursive-union-variants.test.ts](./cte.recursive-union-variants.test.ts).
//
// Mock-mode pins the emitted SQL; real-DB mode seeds parent-child
// relations inside `ctx.withRollback` and verifies the walk order.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: MariaDB has no `START WITH … CONNECT BY` hierarchical-query syntax — `.startWith` / `.connectBy` / `.connectByNoCycle` are typed `never`; the equivalent shape on MariaDB is a recursive CTE.
    /*
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
    */

    // NOT-APPLICABLE: MariaDB has no `START WITH … CONNECT BY` hierarchical-query syntax — `.startWith` / `.connectBy` / `.connectByNoCycle` are typed `never`; the equivalent shape on MariaDB is a recursive CTE.
    /*
    test('connect-by-nocycle-emits-nocycle-keyword', async () => {
        // `connectByNoCycle` is the cycle-safe variant — Oracle stops
        // traversing once it detects the start of a loop and does not
        // raise ORA-01436. Pins the `connect by nocycle` rendering
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
    */

    // NOT-APPLICABLE: MariaDB has no `START WITH … CONNECT BY` hierarchical-query syntax — `.startWith` / `.connectBy` / `.connectByNoCycle` are typed `never`; the equivalent shape on MariaDB is a recursive CTE.
    /*
    test('start-with-where-and-connect-by-combine', async () => {
        // WHERE narrows the hierarchical result post-walk. START WITH
        // picks roots, CONNECT BY walks, WHERE keeps only rows
        // matching the filter. Pins both the START WITH and the WHERE
        // landing in the emitted SQL in the documented order (WHERE
        // before START WITH per
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
    */

    // NOT-APPLICABLE: MariaDB has no `START WITH … CONNECT BY` hierarchical-query syntax — `.startWith` / `.connectBy` / `.connectByNoCycle` are typed `never`; the equivalent shape on MariaDB is a recursive CTE.
    /*
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

        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select id as \"id\", parent_id as \"parentId\" from issue start with parent_id is null connect by prior id = parent_id order siblings by \"id\""`)
        expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; parentId?: number }>>>()
        expect(rows.length).toBe(4)
        const ids = rows.map(r => r.id).sort()
        expect(ids).toEqual([1, 2, 3, 4])
    })
    */
    // NOT-APPLICABLE: MariaDB has no `START WITH … CONNECT BY` hierarchical-query syntax — `.startWith` / `.connectBy` / `.connectByNoCycle` are typed `never`; the equivalent shape on MariaDB is a recursive CTE.
    /*
    test('connect-by-without-start-with-every-row-is-root', async () => {
        // `connectBy` WITHOUT a preceding `startWith` emits `connect by` with no
        // `start with`. Oracle then treats EVERY row as a hierarchy
        // root, so the walk re-emits each node once per ancestor path.
        // Tree shape after seeding: 3 ← 2 ← 1, plus 4 (standalone).
        // Per-root paths: {1}, {2,1}, {3,2,1}, {4} → 7 rows total,
        // id multiset [1,1,1,2,2,3,4].
        ctx.mockNext([
            { id: 1, parentId: 2 },
            { id: 2, parentId: 3 },
            { id: 1, parentId: 2 },
            { id: 3, parentId: null },
            { id: 2, parentId: 3 },
            { id: 1, parentId: 2 },
            { id: 4, parentId: null },
        ])

        const runQuery = () => ctx.conn.selectFrom(tIssue)
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

        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select id as "id", parent_id as "parentId" from issue connect by prior id = parent_id"`)
        expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; parentId?: number }>>>()
        expect(rows.length).toBe(7)
        // Sort for a stable comparison: the CONNECT BY walk order is not
        // guaranteed beyond the hierarchical traversal.
        const ids = rows.map(r => r.id).sort()
        expect(ids).toEqual([1, 1, 1, 2, 2, 3, 4])
    })
    */

    // NOT-APPLICABLE: MariaDB has no `START WITH … CONNECT BY` hierarchical-query syntax — `.startWith` / `.connectBy` / `.connectByNoCycle` are typed `never`; the equivalent shape on MariaDB is a recursive CTE.
    /*
    test('connect-by-customize-query-order-by-hooks', async () => {
        // `customizeQuery({ beforeOrderByItems, afterOrderByItems })`
        // splices raw fragments around the explicit ORDER BY items of a
        // hierarchical query. Each of the three ORDER BY terms uses a
        // DISTINCT column (parent_id / id / priority) so Oracle does not
        // trip its "column specified more than once in the order by"
        // check. A top-level ORDER BY sorts the whole CONNECT BY result
        // deterministically. Tree shape: 3 ← 2 ← 1, plus 4.
        ctx.mockNext([
            { id: 1, parentId: 2 },
            { id: 2, parentId: 3 },
            { id: 3, parentId: null },
            { id: 4, parentId: null },
        ])

        const connection = ctx.conn
        const runQuery = () => connection.selectFrom(tIssue)
            .startWith(tIssue.parentId.isNull())
            .connectBy(prior => prior(tIssue.id).equals(tIssue.parentId))
            .select({
                id:       tIssue.id,
                parentId: tIssue.parentId,
            })
            .orderBy('id')
            .customizeQuery({
                beforeOrderByItems: connection.rawFragment`parent_id asc`,
                afterOrderByItems:  connection.rawFragment`priority asc`,
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

        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select id as "id", parent_id as "parentId" from issue start with parent_id is null connect by prior id = parent_id order by parent_id asc, "id", priority asc"`)
        expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; parentId?: number }>>>()
        // ORDER BY parent_id asc (nulls last), id, priority asc: issue 1
        // (parent 2), issue 2 (parent 3), then the null-parent roots 3, 4.
        expect(rows).toEqual([
            { id: 1, parentId: 2 },
            { id: 2, parentId: 3 },
            { id: 3 },
            { id: 4 },
        ])
    })
    */

    // NOT-APPLICABLE: MariaDB has no `START WITH … CONNECT BY` hierarchical-query syntax — `.startWith` / `.connectBy` / `.connectByNoCycle` are typed `never`; the equivalent shape on MariaDB is a recursive CTE.
    /*
    test('connect-by-for-use-in-query-as-cte', async () => {
        // `forUseInQueryAs('tree')` materializes the hierarchical query as
        // a `WITH tree AS (...)` view; the outer `selectFrom(tree)` reads
        // it back and its `orderBy('id')` makes the result deterministic.
        // The CTE holds the full walk {1,2,3,4}. Tree shape: 3 ← 2 ← 1,
        // plus 4.
        ctx.mockNext([
            { id: 1, parentId: 2 },
            { id: 2, parentId: 3 },
            { id: 3, parentId: null },
            { id: 4, parentId: null },
        ])

        const tree = ctx.conn.selectFrom(tIssue)
            .startWith(tIssue.parentId.isNull())
            .connectBy(prior => prior(tIssue.id).equals(tIssue.parentId))
            .select({
                id:       tIssue.id,
                parentId: tIssue.parentId,
            })
            .forUseInQueryAs('tree')

        const runQuery = () => ctx.conn.selectFrom(tree)
            .select({
                id:       tree.id,
                parentId: tree.parentId,
            })
            .orderBy('id')
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

        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"with tree as (select id as id, parent_id as parentId from issue start with parent_id is null connect by prior id = parent_id) select id as "id", parentId as "parentId" from tree order by "id""`)
        expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; parentId?: number }>>>()
        expect(rows).toEqual([
            { id: 1, parentId: 2 },
            { id: 2, parentId: 3 },
            { id: 3 },
            { id: 4 },
        ])
    })
    */

    // NOT-APPLICABLE: MariaDB has no `START WITH … CONNECT BY` hierarchical-query syntax — `.startWith` / `.connectBy` / `.connectByNoCycle` are typed `never`; the equivalent shape on MariaDB is a recursive CTE.
    /*
    test('connect-by-for-use-as-inline-aggregated-array-value', async () => {
        // `forUseAsInlineAggregatedArrayValue()` consumes the one-column
        // hierarchical walk as an inline `json_arrayagg(...)` array inside
        // an outer query. The array holds the full walk {1,2,3,4}; Oracle
        // does not guarantee aggregate order, so JS-sort before comparing.
        // Tree shape: 3 ← 2 ← 1, plus 4.
        ctx.mockNext([{ id: 1, tree: [1, 2, 3, 4] }])

        const tree = ctx.conn.selectFrom(tIssue)
            .startWith(tIssue.parentId.isNull())
            .connectBy(prior => prior(tIssue.id).equals(tIssue.parentId))
            .selectOneColumn(tIssue.id)
            .forUseAsInlineAggregatedArrayValue()

        const runQuery = () => ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:   tProject.id,
                tree,
            })
            .executeSelectMany()

        let rows!: Array<{ id: number; tree: number[] }>
        if (ctx.realDbEnabled) {
            await ctx.withRollback(async () => {
                await ctx.conn.update(tIssue).set({ parentId: 2 }).where(tIssue.id.equals(1)).executeUpdate()
                await ctx.conn.update(tIssue).set({ parentId: 3 }).where(tIssue.id.equals(2)).executeUpdate()
                rows = await runQuery()
            })
        } else {
            rows = await runQuery()
        }

        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select id as "id", (select json_arrayagg(id) from issue start with parent_id is null connect by prior id = parent_id) as "tree" from project where id = :0"`)
        expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; tree: number[] }>>>()
        expect(rows.map(r => ({ ...r, tree: [...r.tree].sort((a, b) => a - b) }))).toEqual([
            { id: 1, tree: [1, 2, 3, 4] },
        ])
    })
    */

    // NOT-APPLICABLE: MariaDB has no `START WITH … CONNECT BY` hierarchical-query syntax — `.startWith` / `.connectBy` / `.connectByNoCycle` are typed `never`; the equivalent shape on MariaDB is a recursive CTE.
    /*
    test('connect-by-for-use-as-inline-query-value-scalar', async () => {
        // `forUseAsInlineQueryValue()` consumes a one-column hierarchical
        // query as a SCALAR subquery. To stay single-row (Oracle raises
        // ORA-01427 otherwise) the walk starts at leaf issue 1 — nothing
        // has `parent_id = 1`, so the walk is just {1} and the scalar is
        // 1. The scalar value source is optional, so it surfaces as
        // `root?`.
        ctx.mockNext([{ id: 1, root: 1 }])

        const root = ctx.conn.selectFrom(tIssue)
            .startWith(tIssue.id.equals(1))
            .connectBy(prior => prior(tIssue.id).equals(tIssue.parentId))
            .selectOneColumn(tIssue.id)
            .forUseAsInlineQueryValue()

        const runQuery = () => ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                id:   tProject.id,
                root,
            })
            .executeSelectMany()

        let rows!: Array<{ id: number; root?: number }>
        if (ctx.realDbEnabled) {
            await ctx.withRollback(async () => {
                await ctx.conn.update(tIssue).set({ parentId: 2 }).where(tIssue.id.equals(1)).executeUpdate()
                await ctx.conn.update(tIssue).set({ parentId: 3 }).where(tIssue.id.equals(2)).executeUpdate()
                rows = await runQuery()
            })
        } else {
            rows = await runQuery()
        }

        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select id as "id", (select id as "result" from issue start with id = :0 connect by prior id = parent_id) as "root" from project where id = :1"`)
        expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`
          [
            1,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; root?: number }>>>()
        expect(rows).toEqual([{ id: 1, root: 1 }])
    })
    */

    // NOT-APPLICABLE: MariaDB has no `START WITH … CONNECT BY` hierarchical-query syntax — `.startWith` / `.connectBy` / `.connectByNoCycle` are typed `never`; the equivalent shape on MariaDB is a recursive CTE.
    /*
    test('connect-by-projecting-optional-values-as-nullable', async () => {
        // `projectingOptionalValuesAsNullable()` reshapes the optional
        // `parentId?` to `parentId: number | null` — only the TS type
        // changes, the emitted SQL is identical to the plain walk. A null
        // parent must surface as `null` (PRESENT), not absent, which is
        // what distinguishes it from the default optional projection.
        // Tree shape: 3 ← 2 ← 1, plus 4 — issues 3 and 4 have a null parent.
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
            .projectingOptionalValuesAsNullable()
            .executeSelectMany()

        let rows!: Array<{ id: number; parentId: number | null }>
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
        assertType<Exact<typeof rows, Array<{ id: number; parentId: number | null }>>>()
        expect(rows.length).toBe(4)
        const byId = new Map(rows.map(r => [r.id, r]))
        // The null parent is present AS null (not stripped to absent).
        expect(byId.get(3)).toEqual({ id: 3, parentId: null })
        expect(byId.get(1)).toEqual({ id: 1, parentId: 2 })
    })
    */

    // NOT-APPLICABLE: MariaDB has no `START WITH … CONNECT BY` hierarchical-query syntax — `.startWith` / `.connectBy` / `.connectByNoCycle` are typed `never`; the equivalent shape on MariaDB is a recursive CTE.
    /*
    test('connect-by-walk-as-a-compound-union-arm', async () => {
        // A CONNECT BY hierarchical walk used as one ARM of a compound (UNION): the
        // walk select composes with `.union(...)` like any other select, so the
        // hierarchical arm and a plain arm merge into one result set. Tree: 3 ← 2 ←
        // 1, plus 4 (root); the walk from the null-parent roots reaches issues
        // {1,2,3,4}, and the other arm contributes project 1's id — the union dedups
        // to {1,2,3,4}.
        ctx.mockNext([{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }])
        const runQuery = () => ctx.conn.selectFrom(tIssue)
            .startWith(tIssue.parentId.isNull())
            .connectBy(prior => prior(tIssue.id).equals(tIssue.parentId))
            .select({ n: tIssue.id })
            .union(
                ctx.conn.selectFrom(tProject)
                    .where(tProject.id.equals(1))
                    .select({ n: tProject.id }),
            )
            .orderBy('n')
            .executeSelectMany()

        let rows!: Array<{ n: number }>
        if (ctx.realDbEnabled) {
            await ctx.withRollback(async () => {
                await ctx.conn.update(tIssue).set({ parentId: 2 }).where(tIssue.id.equals(1)).executeUpdate()
                await ctx.conn.update(tIssue).set({ parentId: 3 }).where(tIssue.id.equals(2)).executeUpdate()
                rows = await runQuery()
            })
        } else {
            rows = await runQuery()
        }

        expect(ctx.lastNoTransactionSql).toMatchInlineSnapshot(`"select id as "n" from issue start with parent_id is null connect by prior id = parent_id union select id as "n" from project where id = :0 order by 1"`)
        expect(ctx.lastNoTransactionParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ n: number }>>>()
        expect(rows).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }])
    })
    */

})
