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

    test('docs:recursive/parents-chain', async () => {
        // Seed has no parent_id set, so against a real DB this returns
        // only the starting issue (id=2). The mock primes the value
        // shape we'd expect when the chain has multiple ancestors.
        // Note: `parentId` MUST be projected so the recursive view exposes
        // it for the JOIN ON to reference.
        const expected = [
            { id: 2, title: 'Redesign navbar' },
            { id: 1, title: 'Update hero copy' },
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
            .recursiveUnionAllOn((parent) =>
                tIssue.id.equals(parent.parentId)
            )
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title, parentId) as (select id as id, title as title, parent_id as parentId from issue where id = :0 union all select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on issue.id = recursive_select_1.parentId) select id as "id", title as "title", parentId as "parentId" from recursive_select_1"`)
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
        if (!ctx.realDbEnabled) expect(ancestors).toEqual(expected)
    })

    test('docs:recursive/parents-chain-full-inner', async () => {
        // Section "Recursive select looking for parents" — first snippet,
        // where the recursive arm is spelled out as a full `selectFrom(...).join(child).on(...).select({...})`
        // instead of the shortcut `recursiveUnionAllOn`.
        const expected = [
            { id: 2, title: 'Redesign navbar' },
            { id: 1, title: 'Update hero copy' },
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title, parentId) as (select id as id, title as title, parent_id as parentId from issue where id = :0 union all select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on recursive_select_1.parentId = issue.id) select id as "id", title as "title", parentId as "parentId" from recursive_select_1"`)
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
        if (!ctx.realDbEnabled) expect(ancestors).toEqual(expected)
    })

    test('docs:recursive/children-tree', async () => {
        // Section "Recursive select looking for children" — same shape
        // as "parents" but the JOIN direction is flipped so we walk down
        // the tree from a root.
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
            .recursiveUnionAllOn((parent) =>
                tIssue.parentId.equals(parent.id),
            )
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title, parentId) as (select id as id, title as title, parent_id as parentId from issue where id = :0 union all select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", title as "title", parentId as "parentId" from recursive_select_1"`)
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
    })

    test('docs-extra:recursive/union-vs-union-all', async () => {
        // Section "UNION vs UNION ALL inside a recursive CTE" — both
        // `recursiveUnion` and `recursiveUnionAll` exist where the
        // dialect supports the operator. The deduplicating variant
        // (`recursiveUnion`) is only available on the dialects that
        // accept `UNION` (not `UNION ALL`) in a recursive CTE.
        ctx.mockNext([{ id: 1, title: 'Root', parentId: undefined }])
        const connection = ctx.conn

        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:       tIssue.id,
                title:    tIssue.title,
                parentId: tIssue.parentId,
            })
            .recursiveUnionAllOn((parent) =>
                tIssue.id.equals(parent.parentId),
            )
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title, parentId) as (select id as id, title as title, parent_id as parentId from issue where id = :0 union all select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on issue.id = recursive_select_1.parentId) select id as "id", title as "title", parentId as "parentId" from recursive_select_1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:        number
            title:     string
            parentId?: number
        }>>>()
    })
})
