// Recursive select projecting a NESTED OBJECT (dot-alias through anchor +
// recursion). Every other recursive test projects FLAT columns; here the
// projection is `select({ id, header: { num, title } })`, so the two leaf
// columns carry the `"header.num"` / `"header.title"` dot-aliases.
//
// What this pins that the flat recursive tests cannot:
//   - the dot-aliased columns are emitted in BOTH the recursion anchor AND
//     the recursive member (distinct emission — the recursive arm re-projects
//     `issue.number as "header.num"`, not a bare `header`), and
//   - the nested object survives the recursion into the outer
//     `select ... from recursive_select_1` and into the projected result type
//     (`header: { num; title }` stays a required nested object).
//
// Every seeded issue has a NULL parent_id, so the child traversal from an
// anchor adds no rows and the recursion terminates returning exactly the
// anchor rows — deterministic values without needing a populated tree.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('recursive-nested-object-shortcut-children', async () => {
        // `recursiveUnionAllOn(...)` shortcut: the recursive arm is synthesised
        // by the library from the anchor's projection, so the dot-aliased
        // `"header.num"` / `"header.title"` columns it emits in the recursive
        // member are library-generated — the strongest proof that the nested
        // object's dot-aliases are reproduced in the recursive term. Anchor is
        // issue 1; its parent_id is NULL so the child traversal adds nothing,
        // and exactly the anchor row comes back with its nested `header`.
        const expected = [
            { id: 1, header: { num: 1, title: 'Update hero copy' } },
        ]
        ctx.mockNext([
            { id: 1, 'header.num': 1, 'header.title': 'Update hero copy' },
        ])
        const connection = ctx.conn

        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                id:     tIssue.id,
                header: { num: tIssue.number, title: tIssue.title },
            })
            .recursiveUnionAllOn((parent) =>
                tIssue.parentId.equals(parent.id),
            )
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, "header.num", "header.title") as (select id as id, "number" as "header.num", title as "header.title" from issue where id = :0 union all select issue.id as id, issue."number" as "header.num", issue.title as "header.title" from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", "header.num" as "header.num", "header.title" as "header.title" from recursive_select_1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:     number
            header: { num: number; title: string }
        }>>>()
        expect(result).toEqual(expected)
    })

    test('recursive-nested-object-explicit-recursive-arm', async () => {
        // Full-form `recursiveUnionAll(fn)`: the recursive arm is authored by
        // hand and re-projects the SAME nested `header` object against the base
        // table joined to the recursive view. This pins that the hand-written
        // recursive member also carries the `"header.num"` / `"header.title"`
        // dot-aliases, matching the anchor's column shape so the `union all`
        // is well-formed. Anchor selects issues 1, 2, 3; every parent_id is
        // NULL so the recursion adds nothing, and `.orderBy('id')` (resolving
        // the flat top-level `id` key of the nested projection) keeps the three
        // nested rows deterministically ordered.
        const expected = [
            { id: 1, header: { num: 1, title: 'Update hero copy' } },
            { id: 2, header: { num: 2, title: 'Redesign navbar' } },
            { id: 3, header: { num: 1, title: 'Migrate to ESM' } },
        ]
        ctx.mockNext([
            { id: 1, 'header.num': 1, 'header.title': 'Update hero copy' },
            { id: 2, 'header.num': 2, 'header.title': 'Redesign navbar' },
            { id: 3, 'header.num': 1, 'header.title': 'Migrate to ESM' },
        ])
        const connection = ctx.conn

        const result = await connection.selectFrom(tIssue)
            .where(tIssue.id.in([1, 2, 3]))
            .select({
                id:     tIssue.id,
                header: { num: tIssue.number, title: tIssue.title },
            })
            .recursiveUnionAll((parent) => {
                return connection.selectFrom(tIssue)
                    .join(parent).on(tIssue.parentId.equals(parent.id))
                    .select({
                        id:     tIssue.id,
                        header: { num: tIssue.number, title: tIssue.title },
                    })
            })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with recursive_select_1(id, "header.num", "header.title") as (select id as id, "number" as "header.num", title as "header.title" from issue where id in (:0, :1, :2) union all select issue.id as id, issue."number" as "header.num", issue.title as "header.title" from issue join recursive_select_1 on issue.parent_id = recursive_select_1.id) select id as "id", "header.num" as "header.num", "header.title" as "header.title" from recursive_select_1 order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:     number
            header: { num: number; title: string }
        }>>>()
        expect(result).toEqual(expected)
    })
})
