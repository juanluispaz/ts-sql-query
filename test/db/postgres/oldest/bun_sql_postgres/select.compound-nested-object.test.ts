// A COMPOUND query (UNION / UNION ALL) whose arms re-project a NESTED OBJECT
// that is optional / left-join / rule-1 (requiredInOptionalObject) / rule-4
// (all-optional). The existing compound coverage re-projects flat columns or a
// REQUIRED nested object; the distinct path here is the compound carrying the
// optionality of a nested object through to the merged result.
//
// - a UNION of two left-join arms → the nested object stays optional (`proj?`).
// - a UNION ALL of two rule-4 (all-optional) arms → the object is dropped only
//   when every leaf is null.
// - a UNION of two rule-1 (requiredInOptionalObject) arms → the object stays
//   optional, its requiredInOptionalObject leaf required-when-present.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('union-of-left-join-arms-keeps-the-nested-object-optional', async () => {
        // Each arm left-joins the project and projects a `proj` object built from
        // the left-joined leaves, so the object is optional (rule-2). The compound
        // re-projects it unchanged: the merged result keeps `proj?`. Arm 1 = issue
        // 1 (project 1), arm 2 = issue 2 (project 1); both joins hit.
        const expected = [
            { iid: 1, proj: { id: 1, name: 'Marketing site' } },
            { iid: 2, proj: { id: 1, name: 'Marketing site' } },
        ]
        ctx.mockNext([
            { iid: 1, 'proj.id': 1, 'proj.name': 'Marketing site' },
            { iid: 2, 'proj.id': 1, 'proj.name': 'Marketing site' },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, proj: { id: tProjLeft.id, name: tProjLeft.name } })
            .union(
                ctx.conn.selectFrom(tIssue)
                    .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
                    .where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, proj: { id: tProjLeft.id, name: tProjLeft.name } }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id as "proj.id", project.name as "proj.name" from issue left join project on project.id = issue.project_id where issue.id = $1 union select issue.id as iid, project.id as "proj.id", project.name as "proj.name" from issue left join project on project.id = issue.project_id where issue.id = $2 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            proj?: { id: number; name: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('union-all-of-rule-4-all-optional-arms-drops-object-when-every-leaf-is-null', async () => {
        // Each arm projects an all-optional nested `opt` object (rule-4): the
        // object is optional and dropped when every leaf is null. UNION ALL keeps
        // both rows. Arm 1 = issue 1 (body NULL, assignee 1) → opt present with
        // assigneeId only. Arm 2 = issue 3 (body NULL, assignee NULL) → opt
        // dropped entirely.
        const expected = [
            { iid: 1, opt: { assigneeId: 1 } },
            { iid: 3 },
        ]
        ctx.mockNext([
            { iid: 1, 'opt.body': null, 'opt.assigneeId': 1 },
            { iid: 3, 'opt.body': null, 'opt.assigneeId': null },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, opt: { body: tIssue.body, assigneeId: tIssue.assigneeId } })
            .unionAll(
                ctx.conn.selectFrom(tIssue)
                    .where(tIssue.id.equals(3))
                    .select({ iid: tIssue.id, opt: { body: tIssue.body, assigneeId: tIssue.assigneeId } }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as "opt.body", assignee_id as "opt.assigneeId" from issue where id = $1 union all select id as iid, body as "opt.body", assignee_id as "opt.assigneeId" from issue where id = $2 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:  number
            opt?: { body: string | undefined; assigneeId: number | undefined }
        }>>>()
        expect(rows).toEqual(expected)
        // Arm 2 (issue 3) has every leaf null, so the optional `opt` object is
        // dropped entirely — the key must be ABSENT, not present-as-undefined.
        expect('opt' in rows[1]!).toBe(false)
    })

    test('union-of-rule-1-required-in-optional-object-arms-stays-optional', async () => {
        // Each arm projects a rule-1 nested `meta` object made optional by its
        // `requiredInOptionalObject` leaf (`gate`, status). The compound keeps the
        // object optional, with `gate` required-when-present and the plain-optional
        // `assigneeId` sibling `| undefined`. Arm 1 = issue 1, arm 2 = issue 2;
        // both have a status, so `meta` is present.
        const expected = [
            { iid: 1, meta: { gate: 'open', assigneeId: 1 } },
            { iid: 2, meta: { gate: 'in_progress', assigneeId: 2 } },
        ]
        ctx.mockNext([
            { iid: 1, 'meta.gate': 'open', 'meta.assigneeId': 1 },
            { iid: 2, 'meta.gate': 'in_progress', 'meta.assigneeId': 2 },
        ])
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({
                iid:  tIssue.id,
                meta: { gate: tIssue.status.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId },
            })
            .union(
                ctx.conn.selectFrom(tIssue)
                    .where(tIssue.id.equals(2))
                    .select({
                        iid:  tIssue.id,
                        meta: { gate: tIssue.status.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId },
                    }),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, status as "meta.gate", assignee_id as "meta.assigneeId" from issue where id = $1 union select id as iid, status as "meta.gate", assignee_id as "meta.assigneeId" from issue where id = $2 order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            meta?: { gate: string; assigneeId: number | undefined }
        }>>>()
        expect(rows).toEqual(expected)
    })
})
