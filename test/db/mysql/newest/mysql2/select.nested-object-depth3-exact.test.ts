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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, \`number\` as \`a.b.c.num\`, title as \`a.b.c.title\` from issue where project_id = ? order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, \`number\` as \`a.b.c.num\`, body as \`a.b.c.body\` from issue where project_id = ? order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, \`number\` as \`a.b.c.d.num\`, title as \`a.b.c.d.title\` from issue where project_id = ? order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, \`number\` as \`a.b.c.d.num\`, body as \`a.b.c.d.body\` from issue where project_id = ? order by iid"`)
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


    test('level-4-optional-container-default-as-undefined', async () => {
        // A depth-3 nesting whose DEEPEST container is optional: `a` and `b` each keep
        // a required leaf (`keepA`, `keepB`) so they stay required, while the level-4
        // `c` container is ALL-OPTIONAL (`body` + `assigneeId`) → demoted to `c?`,
        // dropped only when both leaves are null. issue 1: body null, assignee 1 → c
        // present with assigneeId; issue 3: body null, assignee null → c dropped.
        const expected = [
            { iid: 1, a: { keepA: 1, b: { keepB: 'Update hero copy', c: { assigneeId: 1 } } } },
            { iid: 3, a: { keepA: 1, b: { keepB: 'Migrate to ESM' } } },
        ]
        ctx.mockNext([
            { iid: 1, 'a.keepA': 1, 'a.b.keepB': 'Update hero copy', 'a.b.c.body': null, 'a.b.c.assigneeId': 1 },
            { iid: 3, 'a.keepA': 1, 'a.b.keepB': 'Migrate to ESM',   'a.b.c.body': null, 'a.b.c.assigneeId': null },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 3]))
            .select({
                iid: tIssue.id,
                a: {
                    keepA: tIssue.number,
                    b: {
                        keepB: tIssue.title,
                        c: { body: tIssue.body, assigneeId: tIssue.assigneeId },
                    },
                },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, \`number\` as \`a.keepA\`, title as \`a.b.keepB\`, body as \`a.b.c.body\`, assignee_id as \`a.b.c.assigneeId\` from issue where id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            a: { keepA: number; b: { keepB: string; c?: { body?: string; assigneeId?: number } } }
        }>>>()
        expect(rows).toEqual(expected)
        // Row 2 (issue 3): the level-4 `c` container is dropped entirely — assert
        // its key is ABSENT, not present-as-undefined.
        expect('c' in rows[1]!.a.b).toBe(false)
    })

    test('level-4-optional-container-projecting-optional-values-as-nullable', async () => {
        // The same level-4 optional container under
        // `projectingOptionalValuesAsNullable()`: the `c` container becomes
        // `{...} | null` (surfacing as `null` when both leaves are null) and each
        // leaf flips to `| null`. issue 1: body null, assignee 1 → c present with
        // `body: null`; issue 3: body null, assignee null → c null.
        const expected = [
            { iid: 1, a: { keepA: 1, b: { keepB: 'Update hero copy', c: { body: null, assigneeId: 1 } } } },
            { iid: 3, a: { keepA: 1, b: { keepB: 'Migrate to ESM', c: null } } },
        ]
        ctx.mockNext([
            { iid: 1, 'a.keepA': 1, 'a.b.keepB': 'Update hero copy', 'a.b.c.body': null, 'a.b.c.assigneeId': 1 },
            { iid: 3, 'a.keepA': 1, 'a.b.keepB': 'Migrate to ESM',   'a.b.c.body': null, 'a.b.c.assigneeId': null },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 3]))
            .select({
                iid: tIssue.id,
                a: {
                    keepA: tIssue.number,
                    b: {
                        keepB: tIssue.title,
                        c: { body: tIssue.body, assigneeId: tIssue.assigneeId },
                    },
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, \`number\` as \`a.keepA\`, title as \`a.b.keepB\`, body as \`a.b.c.body\`, assignee_id as \`a.b.c.assigneeId\` from issue where id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            a: { keepA: number; b: { keepB: string; c: { body: string | null; assigneeId: number | null } | null } }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('level-5-optional-container-default-as-undefined', async () => {
        // The deepest renderable container (`a.b.c.d`, level 5) is OPTIONAL. `a`,
        // `b`, `c` each keep a required leaf so they stay required; the level-5 `d`
        // container is ALL-OPTIONAL (`body` + `assigneeId`) → demoted to `d?`.
        // issue 1: body null, assignee 1 → d present with assigneeId; issue 3: body
        // null, assignee null → d dropped.
        const expected = [
            { iid: 1, a: { keepA: 1, b: { keepB: 'Update hero copy', c: { keepC: 'open', d: { assigneeId: 1 } } } } },
            { iid: 3, a: { keepA: 1, b: { keepB: 'Migrate to ESM', c: { keepC: 'open' } } } },
        ]
        ctx.mockNext([
            { iid: 1, 'a.keepA': 1, 'a.b.keepB': 'Update hero copy', 'a.b.c.keepC': 'open', 'a.b.c.d.body': null, 'a.b.c.d.assigneeId': 1 },
            { iid: 3, 'a.keepA': 1, 'a.b.keepB': 'Migrate to ESM',   'a.b.c.keepC': 'open', 'a.b.c.d.body': null, 'a.b.c.d.assigneeId': null },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 3]))
            .select({
                iid: tIssue.id,
                a: {
                    keepA: tIssue.number,
                    b: {
                        keepB: tIssue.title,
                        c: {
                            keepC: tIssue.status,
                            d: { body: tIssue.body, assigneeId: tIssue.assigneeId },
                        },
                    },
                },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, \`number\` as \`a.keepA\`, title as \`a.b.keepB\`, \`status\` as \`a.b.c.keepC\`, body as \`a.b.c.d.body\`, assignee_id as \`a.b.c.d.assigneeId\` from issue where id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            a: { keepA: number; b: { keepB: string; c: { keepC: string; d?: { body?: string; assigneeId?: number } } } }
        }>>>()
        expect(rows).toEqual(expected)
        // Row 2 (issue 3): the level-5 `d` container is dropped entirely — assert
        // its key is ABSENT.
        expect('d' in rows[1]!.a.b.c).toBe(false)
    })

    test('level-5-optional-container-projecting-optional-values-as-nullable', async () => {
        // The same level-5 optional container under
        // `projectingOptionalValuesAsNullable()`: the `d` container becomes
        // `{...} | null` (surfacing as `null` when both leaves are null) and each
        // leaf flips to `| null`. issue 1: body null, assignee 1 → d present with
        // `body: null`; issue 3: body null, assignee null → d null.
        const expected = [
            { iid: 1, a: { keepA: 1, b: { keepB: 'Update hero copy', c: { keepC: 'open', d: { body: null, assigneeId: 1 } } } } },
            { iid: 3, a: { keepA: 1, b: { keepB: 'Migrate to ESM', c: { keepC: 'open', d: null } } } },
        ]
        ctx.mockNext([
            { iid: 1, 'a.keepA': 1, 'a.b.keepB': 'Update hero copy', 'a.b.c.keepC': 'open', 'a.b.c.d.body': null, 'a.b.c.d.assigneeId': 1 },
            { iid: 3, 'a.keepA': 1, 'a.b.keepB': 'Migrate to ESM',   'a.b.c.keepC': 'open', 'a.b.c.d.body': null, 'a.b.c.d.assigneeId': null },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.in([1, 3]))
            .select({
                iid: tIssue.id,
                a: {
                    keepA: tIssue.number,
                    b: {
                        keepB: tIssue.title,
                        c: {
                            keepC: tIssue.status,
                            d: { body: tIssue.body, assigneeId: tIssue.assigneeId },
                        },
                    },
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, \`number\` as \`a.keepA\`, title as \`a.b.keepB\`, \`status\` as \`a.b.c.keepC\`, body as \`a.b.c.d.body\`, assignee_id as \`a.b.c.d.assigneeId\` from issue where id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            a: { keepA: number; b: { keepB: string; c: { keepC: string; d: { body: string | null; assigneeId: number | null } | null } } }
        }>>>()
        expect(rows).toEqual(expected)
    })
})
