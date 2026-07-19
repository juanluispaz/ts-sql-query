// `aggregateAsArray({ …, header: { … } })` where one element property is ITSELF
// a nested object. The aggregate-element projector descends into the inner
// object the same way the top-level result projector does; existing aggregate
// coverage only uses flat element properties, so the element → inner-object arm
// is the distinct path here.
//
// - own-table leaves in the inner object → `header` is required.
// - a left-joined inner object → `header` becomes optional (absent when the
//   join misses), with a `projectingOptionalValuesAsNullable()` twin.
//
// JSON aggregate order is not guaranteed, so the array is sorted by `id` before
// comparing. Mocks are primed with the RAW aggregated rows.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('aggregate-element-with-required-nested-object', async () => {
        // The aggregate element carries an inner `header` object of two own-table
        // required columns. The element projector descends into `header`, which
        // stays required on every element. Project 1 has issues 1 and 2.
        ctx.mockNext([{ pid: 1, issues: [
            { id: 1, header: { num: 1, title: 'Update hero copy' } },
            { id: 2, header: { num: 2, title: 'Redesign navbar' } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({
                    id:     tIssue.id,
                    header: { num: tIssue.number, title: tIssue.title },
                }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, (json_agg(json_build_object('id', id, 'header.num', number, 'header.title', title)))::text as issues from issue where project_id = $1 group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ id: number; header: { num: number; title: string } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.id - b.id) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { id: 1, header: { num: 1, title: 'Update hero copy' } },
            { id: 2, header: { num: 2, title: 'Redesign navbar' } },
        ] }])
    })

    test('aggregate-element-with-left-joined-nested-object-makes-it-optional', async () => {
        // The inner `header` object is built from a LEFT-JOINED issue, so the
        // element projector makes the whole `header` optional (absent when the
        // join misses). Project 1 has issues 1 and 2, so the join hits for both
        // aggregated elements and `header` is present.
        ctx.mockNext([{ pid: 1, issues: [
            { id: 1, header: { num: 1, title: 'Update hero copy' } },
            { id: 2, header: { num: 2, title: 'Redesign navbar' } },
        ] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid:    tProject.id,
                issues: ctx.conn.aggregateAsArray({
                    id:     tIssueLeft.id,
                    header: { num: tIssueLeft.number, title: tIssueLeft.title },
                }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, (json_agg(json_build_object('id', issue.id, 'header.num', issue.number, 'header.title', issue.title)))::text as issues from project left join issue on issue.project_id = project.id where project.id = $1 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ id: number; header?: { num: number; title: string } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.id - b.id) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { id: 1, header: { num: 1, title: 'Update hero copy' } },
            { id: 2, header: { num: 2, title: 'Redesign navbar' } },
        ] }])
    })
    // Missing default/nullable twins of the aggregate-element nested-object paths:
    // a rule-3 REQUIRED inner object (kept required by a required leaf) carrying an
    // OPTIONAL leaf under the nullable projector, and a DEEP (depth-3) nested object
    // inside the aggregate element under both projectors.

    test('aggregate-element-with-required-nested-object-optional-leaf-as-nullable', async () => {
        // The inner `header` object has a REQUIRED leaf (`title`) so it stays required
        // on every element (rule 3), plus an OPTIONAL `body` leaf. Under
        // projectingOptionalValuesAsNullable() the object stays required and `body`
        // flips to `string | null` (present-null). Project 1: issue 1 (body NULL →
        // null), issue 2 (body 'Use new tokens').
        ctx.mockNext([{ pid: 1, issues: [
            { id: 1, header: { title: 'Update hero copy', body: null } },
            { id: 2, header: { title: 'Redesign navbar',  body: 'Use new tokens' } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({
                    id:     tIssue.id,
                    header: { title: tIssue.title, body: tIssue.body },
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, (json_agg(json_build_object('id', id, 'header.title', title, 'header.body', body)))::text as issues from issue where project_id = $1 group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ id: number; header: { title: string; body: string | null } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.id - b.id) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { id: 1, header: { title: 'Update hero copy', body: null } },
            { id: 2, header: { title: 'Redesign navbar',  body: 'Use new tokens' } },
        ] }])
        // Issue 1's null body is PRESENT-null inside the required `header`.
        const issue1 = rows[0]!.issues.find(i => i.id === 1)!
        expect('body' in issue1.header).toBe(true)
        expect(issue1.header.body).toBe(null)
    })

    test('aggregate-element-with-depth-3-nested-object-default', async () => {
        // The aggregate element carries a DEPTH-3 nested object
        // `outer.mid.{title,num}` of all-required leaves. The element projector
        // descends three levels; every level stays required. Project 1 has issues 1, 2.
        ctx.mockNext([{ pid: 1, issues: [
            { iid: 1, outer: { mid: { title: 'Update hero copy', num: 1 } } },
            { iid: 2, outer: { mid: { title: 'Redesign navbar',  num: 2 } } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({
                    iid:   tIssue.id,
                    outer: { mid: { title: tIssue.title, num: tIssue.number } },
                }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, (json_agg(json_build_object('iid', id, 'outer.mid.title', title, 'outer.mid.num', number)))::text as issues from issue where project_id = $1 group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ iid: number; outer: { mid: { title: string; num: number } } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.iid - b.iid) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { iid: 1, outer: { mid: { title: 'Update hero copy', num: 1 } } },
            { iid: 2, outer: { mid: { title: 'Redesign navbar',  num: 2 } } },
        ] }])
    })

    test('aggregate-element-with-depth-3-nested-object-as-nullable', async () => {
        // The same DEPTH-3 nested object under projectingOptionalValuesAsNullable(),
        // mixing a required leaf (`num`) with an optional leaf (`body`) at the bottom.
        // The required leaf keeps every level required; the optional `body` flips to
        // `string | null`. Issue 1: body NULL → null; issue 2: body 'Use new tokens'.
        ctx.mockNext([{ pid: 1, issues: [
            { iid: 1, outer: { mid: { num: 1, body: null } } },
            { iid: 2, outer: { mid: { num: 2, body: 'Use new tokens' } } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({
                    iid:   tIssue.id,
                    outer: { mid: { num: tIssue.number, body: tIssue.body } },
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, (json_agg(json_build_object('iid', id, 'outer.mid.num', number, 'outer.mid.body', body)))::text as issues from issue where project_id = $1 group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ iid: number; outer: { mid: { num: number; body: string | null } } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.iid - b.iid) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { iid: 1, outer: { mid: { num: 1, body: null } } },
            { iid: 2, outer: { mid: { num: 2, body: 'Use new tokens' } } },
        ] }])
        // Issue 1's null body is PRESENT-null at the bottom of the depth-3 object.
        const issue1 = rows[0]!.issues.find(i => i.iid === 1)!
        expect('body' in issue1.outer.mid).toBe(true)
        expect(issue1.outer.mid.body).toBe(null)
    })
    // Residual of the depth-3 pair above, one level deeper: a DEPTH-4 nested object
    // `outer.mid.inner.{...}` inside the aggregate element, under both projectors. The
    // element projector must descend four levels; the required-leaf spine keeps every
    // level required and the optional leaf under the nullable projector still surfaces
    // present-null at the bottom.

    test('aggregate-element-with-depth-4-nested-object-default', async () => {
        // The aggregate element carries a DEPTH-4 nested object
        // `outer.mid.inner.{title,num}` of all-required leaves. Every level stays
        // required. Project 1 has issues 1, 2.
        ctx.mockNext([{ pid: 1, issues: [
            { iid: 1, outer: { mid: { inner: { title: 'Update hero copy', num: 1 } } } },
            { iid: 2, outer: { mid: { inner: { title: 'Redesign navbar',  num: 2 } } } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({
                    iid:   tIssue.id,
                    outer: { mid: { inner: { title: tIssue.title, num: tIssue.number } } },
                }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, (json_agg(json_build_object('iid', id, 'outer.mid.inner.title', title, 'outer.mid.inner.num', number)))::text as issues from issue where project_id = $1 group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ iid: number; outer: { mid: { inner: { title: string; num: number } } } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.iid - b.iid) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { iid: 1, outer: { mid: { inner: { title: 'Update hero copy', num: 1 } } } },
            { iid: 2, outer: { mid: { inner: { title: 'Redesign navbar',  num: 2 } } } },
        ] }])
    })

    test('aggregate-element-with-depth-4-nested-object-as-nullable', async () => {
        // The same DEPTH-4 nested object under projectingOptionalValuesAsNullable(),
        // mixing a required leaf (`num`, keeps every level required) with an optional
        // `body` leaf at the bottom. The optional `body` flips to `string | null`.
        // Issue 1: body NULL → null; issue 2: body 'Use new tokens'.
        ctx.mockNext([{ pid: 1, issues: [
            { iid: 1, outer: { mid: { inner: { num: 1, body: null } } } },
            { iid: 2, outer: { mid: { inner: { num: 2, body: 'Use new tokens' } } } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({
                    iid:   tIssue.id,
                    outer: { mid: { inner: { num: tIssue.number, body: tIssue.body } } },
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, (json_agg(json_build_object('iid', id, 'outer.mid.inner.num', number, 'outer.mid.inner.body', body)))::text as issues from issue where project_id = $1 group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ iid: number; outer: { mid: { inner: { num: number; body: string | null } } } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.iid - b.iid) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { iid: 1, outer: { mid: { inner: { num: 1, body: null } } } },
            { iid: 2, outer: { mid: { inner: { num: 2, body: 'Use new tokens' } } } },
        ] }])
        // Issue 1's null body is PRESENT-null at the bottom of the depth-4 object.
        const issue1 = rows[0]!.issues.find(i => i.iid === 1)!
        expect('body' in issue1.outer.mid.inner).toBe(true)
        expect(issue1.outer.mid.inner.body).toBe(null)
    })
    test('aggregate-element-with-required-nested-object-optional-leaf-default-drops-null', async () => {
        // The DEFAULT-projector analog of
        // aggregate-element-with-required-nested-object-optional-leaf-as-nullable:
        // the inner `header` object has a REQUIRED leaf (`title`) so it stays
        // required on every element (rule 3), plus an OPTIONAL `body` leaf. WITHOUT
        // projectingOptionalValuesAsNullable() the default projector DROPS a null
        // optional leaf inside the required object — `body?: string`, absent at
        // runtime. Project 1: issue 1 (body NULL → absent), issue 2 (body
        // 'Use new tokens' → present). The mock is primed with the RAW aggregated
        // rows (body null for issue 1); the projector drops it.
        ctx.mockNext([{ pid: 1, issues: [
            { id: 1, header: { title: 'Update hero copy', body: null } },
            { id: 2, header: { title: 'Redesign navbar',  body: 'Use new tokens' } },
        ] }])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid:    tIssue.projectId,
                issues: ctx.conn.aggregateAsArray({
                    id:     tIssue.id,
                    header: { title: tIssue.title, body: tIssue.body },
                }),
            })
            .groupBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as pid, (json_agg(json_build_object('id', id, 'header.title', title, 'header.body', body)))::text as issues from issue where project_id = $1 group by project_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:    number
            issues: Array<{ id: number; header: { title: string; body?: string } }>
        }>>>()
        const sorted = rows.map(r => ({ ...r, issues: [...r.issues].sort((a, b) => a.id - b.id) }))
        expect(sorted).toEqual([{ pid: 1, issues: [
            { id: 1, header: { title: 'Update hero copy' } },
            { id: 2, header: { title: 'Redesign navbar', body: 'Use new tokens' } },
        ] }])
        // Issue 1's null body is ABSENT (dropped) inside the required `header`
        // under the default projector — the distinct path from the nullable twin.
        const issue1 = rows[0]!.issues.find(i => i.id === 1)!
        expect('body' in issue1.header).toBe(false)
    })
})
