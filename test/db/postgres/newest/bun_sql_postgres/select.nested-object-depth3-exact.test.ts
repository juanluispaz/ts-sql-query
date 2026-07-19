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
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as "a.b.c.num", title as "a.b.c.title" from issue where project_id = $1 order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as "a.b.c.num", body as "a.b.c.body" from issue where project_id = $1 order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as "a.b.c.d.num", title as "a.b.c.d.title" from issue where project_id = $1 order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as "a.b.c.d.num", body as "a.b.c.d.body" from issue where project_id = $1 order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as "a.keepA", title as "a.b.keepB", body as "a.b.c.body", assignee_id as "a.b.c.assigneeId" from issue where id in ($1, $2) order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as "a.keepA", title as "a.b.keepB", body as "a.b.c.body", assignee_id as "a.b.c.assigneeId" from issue where id in ($1, $2) order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as "a.keepA", title as "a.b.keepB", status as "a.b.c.keepC", body as "a.b.c.d.body", assignee_id as "a.b.c.d.assigneeId" from issue where id in ($1, $2) order by iid"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as "a.keepA", title as "a.b.keepB", status as "a.b.c.keepC", body as "a.b.c.d.body", assignee_id as "a.b.c.d.assigneeId" from issue where id in ($1, $2) order by iid"`)
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
    test('level-4-rule1-gate-container-default-as-undefined', async () => {
        // The level-4 `c` container is a RULE-1 gate: `gate` is
        // `body.asRequiredInOptionalObject()` and `sibling` is a value-bearing required
        // column. Distinct from the all-optional (rule-3) level-4 container above — here
        // the container drops when the GATE is null even though the sibling has a value,
        // and the gated leaf stays REQUIRED inside the optional container:
        // `c?: { sibling: string; gate: string }`. issue 2: body present → c present;
        // issue 1: body null → c dropped despite status present.
        const expected = [
            { iid: 1, a: { keepA: 1, b: { keepB: 'Update hero copy' } } },
            { iid: 2, a: { keepA: 2, b: { keepB: 'Redesign navbar', c: { sibling: 'in_progress', gate: 'Use new tokens' } } } },
        ]
        ctx.mockNext([
            { iid: 1, 'a.keepA': 1, 'a.b.keepB': 'Update hero copy', 'a.b.c.sibling': 'open',        'a.b.c.gate': null },
            { iid: 2, 'a.keepA': 2, 'a.b.keepB': 'Redesign navbar',  'a.b.c.sibling': 'in_progress', 'a.b.c.gate': 'Use new tokens' },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                a: {
                    keepA: tIssue.number,
                    b: {
                        keepB: tIssue.title,
                        c: { sibling: tIssue.status, gate: tIssue.body.asRequiredInOptionalObject() },
                    },
                },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as "a.keepA", title as "a.b.keepB", status as "a.b.c.sibling", body as "a.b.c.gate" from issue where project_id = $1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            a: { keepA: number; b: { keepB: string; c?: { sibling: string; gate: string } } }
        }>>>()
        expect(rows).toEqual(expected)
        expect('c' in rows[0]!.a.b).toBe(false)
    })
    test('level-4-rule1-gate-container-projecting-optional-values-as-nullable', async () => {
        // The same level-4 rule-1 gate under `projectingOptionalValuesAsNullable()`: the
        // gated leaves stay REQUIRED and the container becomes `{...} | null`, surfacing as
        // `null` when the gate is null. issue 2: c present; issue 1: c null.
        const expected = [
            { iid: 1, a: { keepA: 1, b: { keepB: 'Update hero copy', c: null } } },
            { iid: 2, a: { keepA: 2, b: { keepB: 'Redesign navbar', c: { sibling: 'in_progress', gate: 'Use new tokens' } } } },
        ]
        ctx.mockNext([
            { iid: 1, 'a.keepA': 1, 'a.b.keepB': 'Update hero copy', 'a.b.c.sibling': 'open',        'a.b.c.gate': null },
            { iid: 2, 'a.keepA': 2, 'a.b.keepB': 'Redesign navbar',  'a.b.c.sibling': 'in_progress', 'a.b.c.gate': 'Use new tokens' },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                a: {
                    keepA: tIssue.number,
                    b: {
                        keepB: tIssue.title,
                        c: { sibling: tIssue.status, gate: tIssue.body.asRequiredInOptionalObject() },
                    },
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as "a.keepA", title as "a.b.keepB", status as "a.b.c.sibling", body as "a.b.c.gate" from issue where project_id = $1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            a: { keepA: number; b: { keepB: string; c: { sibling: string; gate: string } | null } }
        }>>>()
        expect(rows).toEqual(expected)
    })
    test('level-5-rule1-gate-container-default-as-undefined', async () => {
        // The deepest renderable container (`a.b.c.d`, level 5) is a RULE-1 gate:
        // `d?: { sibling: string; gate: string }`, dropped when the gate leaf is null.
        // issue 2: body present → d present; issue 1: body null → d dropped.
        const expected = [
            { iid: 1, a: { keepA: 1, b: { keepB: 'Update hero copy', c: { keepC: 'open' } } } },
            { iid: 2, a: { keepA: 2, b: { keepB: 'Redesign navbar', c: { keepC: 'in_progress', d: { sibling: 'in_progress', gate: 'Use new tokens' } } } } },
        ]
        ctx.mockNext([
            { iid: 1, 'a.keepA': 1, 'a.b.keepB': 'Update hero copy', 'a.b.c.keepC': 'open',        'a.b.c.d.sibling': 'open',        'a.b.c.d.gate': null },
            { iid: 2, 'a.keepA': 2, 'a.b.keepB': 'Redesign navbar',  'a.b.c.keepC': 'in_progress', 'a.b.c.d.sibling': 'in_progress', 'a.b.c.d.gate': 'Use new tokens' },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                a: {
                    keepA: tIssue.number,
                    b: {
                        keepB: tIssue.title,
                        c: {
                            keepC: tIssue.status,
                            d: { sibling: tIssue.status, gate: tIssue.body.asRequiredInOptionalObject() },
                        },
                    },
                },
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as "a.keepA", title as "a.b.keepB", status as "a.b.c.keepC", status as "a.b.c.d.sibling", body as "a.b.c.d.gate" from issue where project_id = $1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            a: { keepA: number; b: { keepB: string; c: { keepC: string; d?: { sibling: string; gate: string } } } }
        }>>>()
        expect(rows).toEqual(expected)
        expect('d' in rows[0]!.a.b.c).toBe(false)
    })
    test('level-5-rule1-gate-container-projecting-optional-values-as-nullable', async () => {
        // The same level-5 rule-1 gate under `projectingOptionalValuesAsNullable()`:
        // `d: { sibling: string; gate: string } | null`. issue 2: d present; issue 1: d null.
        const expected = [
            { iid: 1, a: { keepA: 1, b: { keepB: 'Update hero copy', c: { keepC: 'open', d: null } } } },
            { iid: 2, a: { keepA: 2, b: { keepB: 'Redesign navbar', c: { keepC: 'in_progress', d: { sibling: 'in_progress', gate: 'Use new tokens' } } } } },
        ]
        ctx.mockNext([
            { iid: 1, 'a.keepA': 1, 'a.b.keepB': 'Update hero copy', 'a.b.c.keepC': 'open',        'a.b.c.d.sibling': 'open',        'a.b.c.d.gate': null },
            { iid: 2, 'a.keepA': 2, 'a.b.keepB': 'Redesign navbar',  'a.b.c.keepC': 'in_progress', 'a.b.c.d.sibling': 'in_progress', 'a.b.c.d.gate': 'Use new tokens' },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                iid: tIssue.id,
                a: {
                    keepA: tIssue.number,
                    b: {
                        keepB: tIssue.title,
                        c: {
                            keepC: tIssue.status,
                            d: { sibling: tIssue.status, gate: tIssue.body.asRequiredInOptionalObject() },
                        },
                    },
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, number as "a.keepA", title as "a.b.keepB", status as "a.b.c.keepC", status as "a.b.c.d.sibling", body as "a.b.c.d.gate" from issue where project_id = $1 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            a: { keepA: number; b: { keepB: string; c: { keepC: string; d: { sibling: string; gate: string } | null } } }
        }>>>()
        expect(rows).toEqual(expected)
    })
    test('level-4-rule2-left-join-container-default-as-undefined', async () => {
        // The level-4 `c` container is a RULE-2 (same-left-join) container: BOTH leaves come
        // from the same left-joined table (`tOrgLeft`), so the whole container is optional
        // and its leaves optional — present when the join hits, DROPPED when it misses. The
        // join `organization.id = project.id` hits for projects 1,2 (orgs 1,2 exist) and
        // misses for 3,4. A left-join object is all-or-nothing, so the leaves stay REQUIRED inside the optional container → `c?: { orgId: number; orgName: string }`.
        const tOrgLeft = tOrganization.forUseInLeftJoin()
        const expected = [
            { pid: 1, a: { keepA: 'Marketing site', b: { keepB: 'mktg-site',  c: { orgId: 1, orgName: 'Acme Corp' } } } },
            { pid: 2, a: { keepA: 'Internal tools', b: { keepB: 'tools',      c: { orgId: 2, orgName: 'Globex Ltd' } } } },
            { pid: 3, a: { keepA: 'Public API',     b: { keepB: 'public-api' } } },
            { pid: 4, a: { keepA: 'Legacy app',     b: { keepB: 'legacy' } } },
        ]
        ctx.mockNext([
            { pid: 1, 'a.keepA': 'Marketing site', 'a.b.keepB': 'mktg-site',  'a.b.c.orgId': 1,    'a.b.c.orgName': 'Acme Corp' },
            { pid: 2, 'a.keepA': 'Internal tools', 'a.b.keepB': 'tools',      'a.b.c.orgId': 2,    'a.b.c.orgName': 'Globex Ltd' },
            { pid: 3, 'a.keepA': 'Public API',     'a.b.keepB': 'public-api', 'a.b.c.orgId': null, 'a.b.c.orgName': null },
            { pid: 4, 'a.keepA': 'Legacy app',     'a.b.keepB': 'legacy',     'a.b.c.orgId': null, 'a.b.c.orgName': null },
        ])
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tOrgLeft).on(tOrgLeft.id.equals(tProject.id))
            .select({
                pid: tProject.id,
                a: {
                    keepA: tProject.name,
                    b: {
                        keepB: tProject.slug,
                        c: { orgId: tOrgLeft.id, orgName: tOrgLeft.name },
                    },
                },
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, project.name as "a.keepA", project.slug as "a.b.keepB", organization.id as "a.b.c.orgId", organization.name as "a.b.c.orgName" from project left join organization on organization.id = project.id order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            pid: number
            a: { keepA: string; b: { keepB: string; c?: { orgId: number; orgName: string } } }
        }>>>()
        expect(rows).toEqual(expected)
        expect('c' in rows[2]!.a.b).toBe(false)
    })
    test('level-4-rule2-left-join-container-projecting-optional-values-as-nullable', async () => {
        // The same level-4 rule-2 container under `projectingOptionalValuesAsNullable()`:
        // a left-join object is fully present or absent, so its leaves stay REQUIRED and
        // the container becomes `{...} | null` (null on a miss). projects 1,2 present;
        // 3,4 null.
        const tOrgLeft = tOrganization.forUseInLeftJoin()
        const expected = [
            { pid: 1, a: { keepA: 'Marketing site', b: { keepB: 'mktg-site',  c: { orgId: 1, orgName: 'Acme Corp' } } } },
            { pid: 2, a: { keepA: 'Internal tools', b: { keepB: 'tools',      c: { orgId: 2, orgName: 'Globex Ltd' } } } },
            { pid: 3, a: { keepA: 'Public API',     b: { keepB: 'public-api', c: null } } },
            { pid: 4, a: { keepA: 'Legacy app',     b: { keepB: 'legacy',     c: null } } },
        ]
        ctx.mockNext([
            { pid: 1, 'a.keepA': 'Marketing site', 'a.b.keepB': 'mktg-site',  'a.b.c.orgId': 1,    'a.b.c.orgName': 'Acme Corp' },
            { pid: 2, 'a.keepA': 'Internal tools', 'a.b.keepB': 'tools',      'a.b.c.orgId': 2,    'a.b.c.orgName': 'Globex Ltd' },
            { pid: 3, 'a.keepA': 'Public API',     'a.b.keepB': 'public-api', 'a.b.c.orgId': null, 'a.b.c.orgName': null },
            { pid: 4, 'a.keepA': 'Legacy app',     'a.b.keepB': 'legacy',     'a.b.c.orgId': null, 'a.b.c.orgName': null },
        ])
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tOrgLeft).on(tOrgLeft.id.equals(tProject.id))
            .select({
                pid: tProject.id,
                a: {
                    keepA: tProject.name,
                    b: {
                        keepB: tProject.slug,
                        c: { orgId: tOrgLeft.id, orgName: tOrgLeft.name },
                    },
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, project.name as "a.keepA", project.slug as "a.b.keepB", organization.id as "a.b.c.orgId", organization.name as "a.b.c.orgName" from project left join organization on organization.id = project.id order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            pid: number
            a: { keepA: string; b: { keepB: string; c: { orgId: number; orgName: string } | null } }
        }>>>()
        expect(rows).toEqual(expected)
    })
    test('level-5-rule2-left-join-container-default-as-undefined', async () => {
        // The deepest renderable container (`a.b.c.d`, level 5) is a RULE-2 left-join
        // container → `d?: { orgId: number; orgName: string }` (leaves required, all-or-nothing), dropped on a join miss.
        // projects 1,2 hit; 3,4 miss.
        const tOrgLeft = tOrganization.forUseInLeftJoin()
        const expected = [
            { pid: 1, a: { keepA: 'Marketing site', b: { keepB: 'mktg-site',  c: { keepC: 1, d: { orgId: 1, orgName: 'Acme Corp' } } } } },
            { pid: 2, a: { keepA: 'Internal tools', b: { keepB: 'tools',      c: { keepC: 1, d: { orgId: 2, orgName: 'Globex Ltd' } } } } },
            { pid: 3, a: { keepA: 'Public API',     b: { keepB: 'public-api', c: { keepC: 2 } } } },
            { pid: 4, a: { keepA: 'Legacy app',     b: { keepB: 'legacy',     c: { keepC: 2 } } } },
        ]
        ctx.mockNext([
            { pid: 1, 'a.keepA': 'Marketing site', 'a.b.keepB': 'mktg-site',  'a.b.c.keepC': 1, 'a.b.c.d.orgId': 1,    'a.b.c.d.orgName': 'Acme Corp' },
            { pid: 2, 'a.keepA': 'Internal tools', 'a.b.keepB': 'tools',      'a.b.c.keepC': 1, 'a.b.c.d.orgId': 2,    'a.b.c.d.orgName': 'Globex Ltd' },
            { pid: 3, 'a.keepA': 'Public API',     'a.b.keepB': 'public-api', 'a.b.c.keepC': 2, 'a.b.c.d.orgId': null, 'a.b.c.d.orgName': null },
            { pid: 4, 'a.keepA': 'Legacy app',     'a.b.keepB': 'legacy',     'a.b.c.keepC': 2, 'a.b.c.d.orgId': null, 'a.b.c.d.orgName': null },
        ])
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tOrgLeft).on(tOrgLeft.id.equals(tProject.id))
            .select({
                pid: tProject.id,
                a: {
                    keepA: tProject.name,
                    b: {
                        keepB: tProject.slug,
                        c: {
                            keepC: tProject.organizationId,
                            d: { orgId: tOrgLeft.id, orgName: tOrgLeft.name },
                        },
                    },
                },
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, project.name as "a.keepA", project.slug as "a.b.keepB", project.organization_id as "a.b.c.keepC", organization.id as "a.b.c.d.orgId", organization.name as "a.b.c.d.orgName" from project left join organization on organization.id = project.id order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            pid: number
            a: { keepA: string; b: { keepB: string; c: { keepC: number; d?: { orgId: number; orgName: string } } } }
        }>>>()
        expect(rows).toEqual(expected)
        expect('d' in rows[2]!.a.b.c).toBe(false)
    })
    test('level-5-rule2-left-join-container-projecting-optional-values-as-nullable', async () => {
        // The same level-5 rule-2 container under `projectingOptionalValuesAsNullable()`:
        // `d: { orgId: number; orgName: string } | null`. projects 1,2 present; 3,4 null.
        const tOrgLeft = tOrganization.forUseInLeftJoin()
        const expected = [
            { pid: 1, a: { keepA: 'Marketing site', b: { keepB: 'mktg-site',  c: { keepC: 1, d: { orgId: 1, orgName: 'Acme Corp' } } } } },
            { pid: 2, a: { keepA: 'Internal tools', b: { keepB: 'tools',      c: { keepC: 1, d: { orgId: 2, orgName: 'Globex Ltd' } } } } },
            { pid: 3, a: { keepA: 'Public API',     b: { keepB: 'public-api', c: { keepC: 2, d: null } } } },
            { pid: 4, a: { keepA: 'Legacy app',     b: { keepB: 'legacy',     c: { keepC: 2, d: null } } } },
        ]
        ctx.mockNext([
            { pid: 1, 'a.keepA': 'Marketing site', 'a.b.keepB': 'mktg-site',  'a.b.c.keepC': 1, 'a.b.c.d.orgId': 1,    'a.b.c.d.orgName': 'Acme Corp' },
            { pid: 2, 'a.keepA': 'Internal tools', 'a.b.keepB': 'tools',      'a.b.c.keepC': 1, 'a.b.c.d.orgId': 2,    'a.b.c.d.orgName': 'Globex Ltd' },
            { pid: 3, 'a.keepA': 'Public API',     'a.b.keepB': 'public-api', 'a.b.c.keepC': 2, 'a.b.c.d.orgId': null, 'a.b.c.d.orgName': null },
            { pid: 4, 'a.keepA': 'Legacy app',     'a.b.keepB': 'legacy',     'a.b.c.keepC': 2, 'a.b.c.d.orgId': null, 'a.b.c.d.orgName': null },
        ])
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tOrgLeft).on(tOrgLeft.id.equals(tProject.id))
            .select({
                pid: tProject.id,
                a: {
                    keepA: tProject.name,
                    b: {
                        keepB: tProject.slug,
                        c: {
                            keepC: tProject.organizationId,
                            d: { orgId: tOrgLeft.id, orgName: tOrgLeft.name },
                        },
                    },
                },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, project.name as "a.keepA", project.slug as "a.b.keepB", project.organization_id as "a.b.c.keepC", organization.id as "a.b.c.d.orgId", organization.name as "a.b.c.d.orgName" from project left join organization on organization.id = project.id order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            pid: number
            a: { keepA: string; b: { keepB: string; c: { keepC: number; d: { orgId: number; orgName: string } | null } } }
        }>>>()
        expect(rows).toEqual(expected)
    })
})
