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
            .recursiveUnionOn((parent) =>
                tIssue.id.equals(parent.parentId)
            )
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, title, parentId) as (select id as id, title as title, parent_id as parentId from issue where id = :0 union select issue.id as id, issue.title as title, issue.parent_id as parentId from issue join recursive_select_1 on issue.id = recursive_select_1.parentId) select id as "id", title as "title", parentId as "parentId" from recursive_select_1"`)
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
})
