// Documentation snippets for the Recursive select page
// (docs/queries/recursive-select.md). Builds a standard recursive CTE
// (`WITH RECURSIVE`) traversing the self-referential `issue.parent_id`
// hierarchy.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:recursive-select/parents-chain', async () => {
        // No issue has a parent in the seed, so only the starting issue comes back.
        const expected = [
            { id: 2, title: 'Redesign navbar', parentId: undefined },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const ancestors = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id:       tIssue.id,
                title:    tIssue.title,
                parentId: tIssue.parentId,
            })
            .recursiveUnionAllOn((child) => {
                return child.parentId.equals(tIssue.id)
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1 as (select id as id, title as title, parent_id as parentId from issue where id = @0 union all select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on recursive_select_1.parentId = issue.id) select id as id, title as title, parentId as parentId from recursive_select_1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof ancestors, Array<{
            id:        number
            title:     string
            parentId?: number
        }>>>()
        expect(ancestors).toEqual(expected)
    })

    test('docs:recursive-select/parents-chain-full-inner', async () => {
        // Section "Recursive select looking for parents" — first snippet,
        // where the recursive arm is spelled out as a full select+join
        // instead of the shortcut `recursiveUnionAllOn`. No parent_id is
        // seeded, so the chain stops at the starting issue (id=2).
        const expected = [
            { id: 2, title: 'Redesign navbar', parentId: undefined },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const ancestors = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(2))
            .select({
                id:       tIssue.id,
                title:    tIssue.title,
                parentId: tIssue.parentId,
            })
            .recursiveUnionAll((child) => {
                return connection.selectFrom(tIssue)
                    .join(child).on(child.parentId.equals(tIssue.id))
                    .select({
                        id:       tIssue.id,
                        title:    tIssue.title,
                        parentId: tIssue.parentId,
                    })
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1 as (select id as id, title as title, parent_id as parentId from issue where id = @0 union all select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on recursive_select_1.parentId = issue.id) select id as id, title as title, parentId as parentId from recursive_select_1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof ancestors, Array<{
            id:        number
            title:     string
            parentId?: number
        }>>>()
        expect(ancestors).toEqual(expected)
    })

    test('docs:recursive-select/children-tree', async () => {
        // No issue has a parent in the seed, so only the starting issue comes back.
        const expected = [{ id: 1, title: 'Update hero copy' }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        // doc-start
        const descendants = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:       tIssue.id,
                title:    tIssue.title,
                parentId: tIssue.parentId,
            })
            .recursiveUnionAllOn((parent) => {
                return parent.id.equals(tIssue.parentId)
            })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1 as (select id as id, title as title, parent_id as parentId from issue where id = @0 union all select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on recursive_select_1.id = issue.parent_id) select id as id, title as title, parentId as parentId from recursive_select_1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof descendants, Array<{
            id:        number
            title:     string
            parentId?: number
        }>>>()
        expect(descendants).toEqual(expected)
    })

    test('docs:recursive-select/children-tree-full-inner', async () => {
        // Issues 2 and 3 become children of issue 1, inside the rollback.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar', parentId: 1 },
            { id: 3, title: 'Migrate to ESM',  parentId: 1 },
        ]
        ctx.mockNext(1)
        ctx.mockNext(expected)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            await connection.update(tIssue).set({ parentId: 1 }).where(tIssue.id.in([2, 3])).executeUpdate()

            // doc-start
            const descendants = await connection.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({
                    id:       tIssue.id,
                    title:    tIssue.title,
                    parentId: tIssue.parentId,
                })
                .recursiveUnionAll((parent) => {
                    return connection.selectFrom(tIssue)
                        .join(parent).on(parent.id.equals(tIssue.parentId))
                        .select({
                            id:       tIssue.id,
                            title:    tIssue.title,
                            parentId: tIssue.parentId,
                        })
                })
                .executeSelectMany()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1 as (select id as id, title as title, parent_id as parentId from issue where id = @0 union all select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on recursive_select_1.id = issue.parent_id) select id as id, title as title, parentId as parentId from recursive_select_1"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof descendants, Array<{
                id:        number
                title:     string
                parentId?: number
            }>>>()
            // A recursive select has no order by here.
            expect([...descendants].sort((a, b) => a.id - b.id)).toEqual(expected)
        })
    })

    // NOT-APPLICABLE: this database only accepts union all in a recursive query, so recursiveUnion and recursiveUnionOn are typed never on this connection.
    /*
    test('docs:recursive-select/union-stops-at-cycle', async () => {
        // Issues 1 and 2 are the parent of each other, inside the rollback.
        const expected = [
            { id: 1, title: 'Update hero copy', parentId: 2 },
            { id: 2, title: 'Redesign navbar',  parentId: 1 },
        ]
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(expected)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            await connection.update(tIssue).set({ parentId: 1 }).where(tIssue.id.equals(2)).executeUpdate()
            await connection.update(tIssue).set({ parentId: 2 }).where(tIssue.id.equals(1)).executeUpdate()

            // doc-start
            const issues = await connection.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({
                    id:       tIssue.id,
                    title:    tIssue.title,
                    parentId: tIssue.parentId,
                })
                .recursiveUnionOn((parent) => {
                    return parent.id.equals(tIssue.parentId)
                })
                .orderBy('id')
                .executeSelectMany()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof issues, Array<{
                id:        number
                title:     string
                parentId?: number
            }>>>()
            expect(issues).toEqual(expected)
        })
    })
    */

    test('docs:recursive-select/depth-limit', async () => {
        // Issues 1 and 2 are the parent of each other, inside the rollback: the
        // limit on the level is what ends the query.
        const expected = [
            { id: 1, title: 'Update hero copy', level: 1 },
            { id: 2, title: 'Redesign navbar',  level: 2 },
            { id: 1, title: 'Update hero copy', level: 3 },
        ]
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(expected)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            await connection.update(tIssue).set({ parentId: 1 }).where(tIssue.id.equals(2)).executeUpdate()
            await connection.update(tIssue).set({ parentId: 2 }).where(tIssue.id.equals(1)).executeUpdate()

            // doc-start
            const issues = await connection.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({
                    id:    tIssue.id,
                    title: tIssue.title,
                    level: connection.const(1, 'int'),
                })
                .recursiveUnionAll((parent) => {
                    return connection.selectFrom(tIssue)
                        .join(parent).on(parent.id.equals(tIssue.parentId))
                        .where(parent.level.lessThan(3))
                        .select({
                            id:    tIssue.id,
                            title: tIssue.title,
                            level: parent.level.add(1),
                        })
                })
                .orderBy('level')
                .executeSelectMany()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1 as (select id as id, title as title, @0 as level from issue where id = @1 union all select issue.id as id, issue.title as title, recursive_select_1.level + @2 as level from issue join recursive_select_1 on recursive_select_1.id = issue.parent_id where recursive_select_1.level < @3) select id as id, title as title, level as level from recursive_select_1 order by level"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                1,
                1,
                3,
              ]
            `)
            assertType<Exact<typeof issues, Array<{
                id:    number
                title: string
                level: number
            }>>>()
            expect(issues).toEqual(expected)
        })
    })

    // NOT-APPLICABLE: `.startWith` / `.connectBy` are typed `never` on this connection; the hierarchical query clauses exist only on Oracle.
    /*
    test('docs:recursive-select/connect-by', async () => {
        // Issues 2 and 3 become children of issue 1, inside the rollback. The
        // siblings come back ordered by title, under their parent.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 3, title: 'Migrate to ESM',  parentId: 1 },
            { id: 2, title: 'Redesign navbar', parentId: 1 },
        ]
        ctx.mockNext(1)
        ctx.mockNext(expected)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            await connection.update(tIssue).set({ parentId: 1 }).where(tIssue.id.in([2, 3])).executeUpdate()

            // doc-start
            const descendants = await connection.selectFrom(tIssue)
                .select({
                    id:       tIssue.id,
                    title:    tIssue.title,
                    parentId: tIssue.parentId,
                })
                .startWith(tIssue.id.equals(1))
                .connectBy((prior) => {
                    return prior(tIssue.id).equals(tIssue.parentId)
                })
                .orderBy('title')
                .orderingSiblingsOnly()
                .executeSelectMany()
            // doc-end

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof descendants, Array<{
                id:        number
                title:     string
                parentId?: number
            }>>>()
            expect(descendants).toEqual(expected)
        })
    })
    */

    // NOT-APPLICABLE: SQL Server rejects UNION in the recursive arm of a recursive CTE, so `recursiveUnionOn` is typed never
    /*
    test('docs-extra:recursive-select/recursive-union-dedup', async () => {
        // Section "UNION vs UNION ALL inside a recursive CTE": `recursiveUnionOn`
        // emits a plain union. Issues 2 and 3 become children of issue 1, inside
        // the rollback.
        const expected = [
            { id: 1, title: 'Update hero copy' },
            { id: 2, title: 'Redesign navbar', parentId: 1 },
            { id: 3, title: 'Migrate to ESM',  parentId: 1 },
        ]
        ctx.mockNext(1)
        ctx.mockNext(expected)
        const connection = ctx.conn

        await ctx.withRollback(async () => {
            await connection.update(tIssue).set({ parentId: 1 }).where(tIssue.id.in([2, 3])).executeUpdate()

            const descendants = await connection.selectFrom(tIssue)
                .where(tIssue.id.equals(1))
                .select({
                    id:       tIssue.id,
                    title:    tIssue.title,
                    parentId: tIssue.parentId,
                })
                .recursiveUnionOn((parent) => {
                    return parent.id.equals(tIssue.parentId)
                })
                .executeSelectMany()

            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(ctx.lastParams).toMatchInlineSnapshot()
            assertType<Exact<typeof descendants, Array<{
                id:        number
                title:     string
                parentId?: number
            }>>>()
            expect([...descendants].sort((a, b) => a.id - b.id)).toEqual(expected)
        })
    })
    */

})
