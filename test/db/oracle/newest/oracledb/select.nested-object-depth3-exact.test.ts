// DEEP nested-object projections asserted with the EXACT result type under BOTH
// projectors. The complex-projection recursion (`ResultObjectValues`..`5` in
// src/complexProjections/) descends five explicit levels (the top select plus
// four nested-object levels `a.b.c.d`). Here the assertion is `Exact` (not
// `Extends`), for the default optionals-as-undefined projector and for
// `projectingOptionalValuesAsNullable()`, at nested-object depths 3 and 4 — depth
// 4 (`a.b.c.d`) reaching `ResultObjectValues5`, the deepest renderable level. A
// 5th nested-object level (`a.b.c.d.e`) is beyond the recursion depth and does not
// type-check (a negative type test covers that boundary).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('depth-3-nested-object-default-as-undefined-exact', async () => {
        // Three object levels deep, all-required leaves at the bottom (`num`,
        // `title`). Under the default projector the inner objects stay required
        // and the leaves are required. The assertion pins the EXACT depth-3 shape.
        const expected = [
            { iid: 1, a: { b: { c: { num: 1, title: 'Update hero copy' } } } },
            { iid: 2, a: { b: { c: { num: 2, title: 'Redesign navbar' } } } },
        ]
        ctx.mockNext([
            { iid: 1, 'a.b.c.num': 1, 'a.b.c.title': 'Update hero copy' },
            { iid: 2, 'a.b.c.num': 2, 'a.b.c.title': 'Redesign navbar' },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                a: { b: { c: { num: tIssue.number, title: tIssue.title } } },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "number" as "a.b.c.num", title as "a.b.c.title" from issue where project_id = :0 order by "iid""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            a: { b: { c: { num: number; title: string } } }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('depth-3-nested-object-projecting-optional-values-as-nullable-exact', async () => {
        // The same depth-3 structure under `projectingOptionalValuesAsNullable()`,
        // mixing a required leaf (`num`) with an optional leaf (`body`) at the
        // bottom. The required leaf keeps every inner object required; the optional
        // `body` leaf flips to `string | null` (present-null). The assertion pins
        // the EXACT depth-3 shape under this projector. Issue 1: body NULL → null;
        // issue 2: body 'Use new tokens'.
        const expected = [
            { iid: 1, a: { b: { c: { num: 1, body: null } } } },
            { iid: 2, a: { b: { c: { num: 2, body: 'Use new tokens' } } } },
        ]
        ctx.mockNext([
            { iid: 1, 'a.b.c.num': 1, 'a.b.c.body': null },
            { iid: 2, 'a.b.c.num': 2, 'a.b.c.body': 'Use new tokens' },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                a: { b: { c: { num: tIssue.number, body: tIssue.body } } },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "number" as "a.b.c.num", "body" as "a.b.c.body" from issue where project_id = :0 order by "iid""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            a: { b: { c: { num: number; body: string | null } } }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('depth-4-nested-object-default-as-undefined-exact', async () => {
        // Four object levels deep (`a.b.c.d`), all-required leaves at the bottom.
        // Reaches `ResultObjectValues5` for the leaves (one level below the
        // never-truncation). Under the default projector the inner objects stay
        // required and the leaves are required.
        const expected = [
            { iid: 1, a: { b: { c: { d: { num: 1, title: 'Update hero copy' } } } } },
            { iid: 2, a: { b: { c: { d: { num: 2, title: 'Redesign navbar' } } } } },
        ]
        ctx.mockNext([
            { iid: 1, 'a.b.c.d.num': 1, 'a.b.c.d.title': 'Update hero copy' },
            { iid: 2, 'a.b.c.d.num': 2, 'a.b.c.d.title': 'Redesign navbar' },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                a: { b: { c: { d: { num: tIssue.number, title: tIssue.title } } } },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "number" as "a.b.c.d.num", title as "a.b.c.d.title" from issue where project_id = :0 order by "iid""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            a: { b: { c: { d: { num: number; title: string } } } }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('depth-4-nested-object-projecting-optional-values-as-nullable-exact', async () => {
        // The same depth-4 structure under `projectingOptionalValuesAsNullable()`,
        // mixing a required leaf (`num`) with an optional leaf (`body`) at the
        // bottom. The required leaf keeps every inner object required; the optional
        // `body` leaf flips to `string | null`. Issue 1: body NULL → null; issue 2:
        // body 'Use new tokens'.
        const expected = [
            { iid: 1, a: { b: { c: { d: { num: 1, body: null } } } } },
            { iid: 2, a: { b: { c: { d: { num: 2, body: 'Use new tokens' } } } } },
        ]
        ctx.mockNext([
            { iid: 1, 'a.b.c.d.num': 1, 'a.b.c.d.body': null },
            { iid: 2, 'a.b.c.d.num': 2, 'a.b.c.d.body': 'Use new tokens' },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                a: { b: { c: { d: { num: tIssue.number, body: tIssue.body } } } },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "number" as "a.b.c.d.num", "body" as "a.b.c.d.body" from issue where project_id = :0 order by "iid""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            a: { b: { c: { d: { num: number; body: string | null } } } }
        }>>>()
        expect(rows).toEqual(expected)
    })

})
