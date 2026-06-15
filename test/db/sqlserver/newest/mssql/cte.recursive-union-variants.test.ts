// Recursive CTE variants beyond the ones the docs page exercises in
// [docs.recursive-select.test.ts](./docs.recursive-select.test.ts):
//
//   - `.recursiveUnion(...)` (the dedup variant) on dialects that
//     accept `UNION` in the recursive arm (mysql, mariaDB,
//     postgreSql, sqlite) - Oracle and SQL Server reject the operator
//     and `recursiveUnion` is typed as `never` there.
//   - `.recursiveUnionOn(...)` (the shortcut paired with
//     `.recursiveUnion`) - same dialect narrowing.
//   - `.recursiveUnionAll(...)` with an extra column on the inner
//     arm (alias preservation through the JOIN).
//
// Hits the `_buildRecursiveSelect` branch
// that switches between `union` and `union all`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // Kept commented for symmetry; the recursive-children variant uses
    // `.recursiveUnionAllOn` from the docs page.
    // NOT-APPLICABLE: SQL Server rejects `UNION` (only `UNION ALL`) in the
    // recursive arm of a `WITH` ("Incorrect syntax near UNION"), so
    // `.recursiveUnionOn` is typed as `never`.
    /*
    test('recursive-union-on-dedup-variant', async () => {
        // ... see canonical body in sqlite/newest/bun_sqlite for the full block.
    })
    */

    // NOT-APPLICABLE: SQL Server rejects `UNION` in the recursive arm (same
    // reason as above), so `.recursiveUnion` is typed as `never`. Kept
    // commented for symmetry; use `.recursiveUnionAll`.
    /*
    test('recursive-union-fn-variant-with-explicit-join', async () => {
        // ... see canonical body in sqlite/newest/bun_sqlite for the full block.
    })
    */

    test('recursive-union-all-fn-with-extra-derived-column', async () => {
        // The recursive arm projects an extra computed column
        // (`depth`) derived from the view it joins. The recursive
        // CTE definition has to keep the column shape in sync
        // between the anchor and the recursive arm - the snapshot
        // pins the alias preservation.
        const expected = [
            { id: 1, title: 'Update hero copy', depth: 0 },
            { id: 2, title: 'Redesign navbar',  depth: 1 },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:    tIssue.id,
                title: tIssue.title,
                depth: connection.const(0, 'int'),
            })
            .recursiveUnionAll((parent) => {
                return connection.selectFrom(tIssue)
                    .join(parent).on(tIssue.parentId.equals(parent.id))
                    .select({
                        id:    tIssue.id,
                        title: tIssue.title,
                        depth: parent.depth.add(1),
                    })
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1 as (select id as id, title as title, @0 as [depth] from issue where id = @1 union all select issue.id as id, issue.title as title, recursive_select_1.[depth] + @2 as [depth] from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as id, title as title, [depth] as [depth] from recursive_select_1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:    number
            title: string
            depth: number
        }>>>()
    })
})
