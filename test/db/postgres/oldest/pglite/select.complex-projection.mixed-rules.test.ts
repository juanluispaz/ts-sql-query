// A nested object that mixes an OWN-TABLE required leaf (always present) with a
// LEFT-JOIN originallyRequired leaf (present only when the join hits). The
// own-table required leaf forces the whole object to stay REQUIRED, while the
// left-join leaves are demoted to optional — `?`/absent under the default
// asUndefined projector, `| null` under projectingOptionalValuesAsNullable().

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tOrganization, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('mixed-own-required-and-left-join-leaf-default-as-undefined', async () => {
        // `mix` mixes an own-table required leaf (`ownId` = issue.id) with a
        // left-join originallyRequired leaf (`projName` = project.name via left
        // join). The own-table leaf keeps the object REQUIRED (`mix:`, not
        // `mix?`); the left-join leaf is demoted to `string | undefined`. Every
        // issue has a project (FK), so the join hits and `projName` is present.
        const expected = { iid: 1, mix: { ownId: 1, projName: 'Marketing site' } }
        ctx.mockNext({ iid: 1, 'mix.ownId': 1, 'mix.projName': 'Marketing site' })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                mix: { ownId: tIssue.id, projName: tProjLeft.name },
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.id as "mix.ownId", project.name as "mix.projName" from issue left join project on project.id = issue.project_id where issue.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            mix: { ownId: number; projName?: string }
        }>>()
        expect(row).toEqual(expected)
    })

    test('mixed-own-required-and-left-join-leaf-projecting-optional-values-as-nullable', async () => {
        // Same boundary under `projectingOptionalValuesAsNullable()`: the
        // own-table leaf still keeps the object REQUIRED, but the left-join leaf
        // flips to `string | null` (present-as-null when the join misses) instead
        // of `| undefined`. Issue 1 → project 1, join hits → `projName` present.
        const expected = { iid: 1, mix: { ownId: 1, projName: 'Marketing site' } }
        ctx.mockNext({ iid: 1, 'mix.ownId': 1, 'mix.projName': 'Marketing site' })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                mix: { ownId: tIssue.id, projName: tProjLeft.name },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.id as "mix.ownId", project.name as "mix.projName" from issue left join project on project.id = issue.project_id where issue.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            mix: { ownId: number; projName: string | null }
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-2-left-join-object-mixing-a-const-leaf-stays-optional-default', async () => {
        // A rule-2 nested object mixing a LEFT-JOIN originallyRequired leaf
        // (`name` = project.name) with a `connection.const()` NO-TABLE leaf
        // (`tag`). The no-table source counts as part of the same-left-join set,
        // so rule 2 applies: the object is OPTIONAL (`proj?`) and both leaves are
        // required-when-present (the const is always present; the left-join leaf is
        // originallyRequired). Every issue has a project, so the join hits: issue 1
        // -> project 1 (Marketing site).
        const expected = { iid: 1, proj: { name: 'Marketing site', tag: 'rel' } }
        ctx.mockNext({ iid: 1, 'proj.name': 'Marketing site', 'proj.tag': 'rel' })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                proj: { name: tProjLeft.name, tag: ctx.conn.const('rel', 'string') },
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "proj.name", $1::text as "proj.tag" from issue left join project on project.id = issue.project_id where issue.id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            proj?: { name: string; tag: string }
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-2-left-join-object-mixing-a-const-leaf-projecting-optional-values-as-nullable', async () => {
        // Same boundary under `projectingOptionalValuesAsNullable()`: the object
        // becomes `{...} | null` (null only when the join misses), and both the
        // left-join leaf and the const leaf stay required inside it. Issue 1 ->
        // project 1, join hits.
        const expected = { iid: 1, proj: { name: 'Marketing site', tag: 'rel' } }
        ctx.mockNext({ iid: 1, 'proj.name': 'Marketing site', 'proj.tag': 'rel' })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                proj: { name: tProjLeft.name, tag: ctx.conn.const('rel', 'string') },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "proj.name", $1::text as "proj.tag" from issue left join project on project.id = issue.project_id where issue.id = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            proj: { name: string; tag: string } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('two-different-left-joins-in-one-object-demotes-both-leaves-default', async () => {
        // A single nested object whose two leaves come from TWO DIFFERENT left
        // joins (`projName` = project.name, `orgName` = organization.name via a
        // chained left join). Because the leaves are not all from a single SOURCE,
        // each left-join leaf is treated as independently optional: the object is
        // OPTIONAL (`obj?`, dropped only when both leaves are null) and each leaf is
        // `| undefined`. Issue 1 -> project 1 (Marketing site) -> organization 1
        // (Acme Corp); both joins hit.
        const expected = { iid: 1, obj: { projName: 'Marketing site', orgName: 'Acme Corp' } }
        ctx.mockNext({ iid: 1, 'obj.projName': 'Marketing site', 'obj.orgName': 'Acme Corp' })
        const tProjLeft = tProject.forUseInLeftJoin()
        const tOrgLeft = tOrganization.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .leftJoin(tOrgLeft).on(tOrgLeft.id.equals(tProjLeft.organizationId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                obj: { projName: tProjLeft.name, orgName: tOrgLeft.name },
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "obj.projName", organization.name as "obj.orgName" from issue left join project on project.id = issue.project_id left join organization on organization.id = project.organization_id where issue.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            obj?: { projName: string | undefined; orgName: string | undefined }
        }>>()
        expect(row).toEqual(expected)
    })

    test('two-different-left-joins-in-one-object-demotes-both-leaves-projecting-optional-values-as-nullable', async () => {
        // The same two-different-left-joins object under
        // `projectingOptionalValuesAsNullable()`: the optional object becomes
        // `{...} | null` and each left-join leaf flips to `| null` instead of
        // `| undefined`. Issue 1 -> project 1 -> organization 1; both joins hit.
        const expected = { iid: 1, obj: { projName: 'Marketing site', orgName: 'Acme Corp' } }
        ctx.mockNext({ iid: 1, 'obj.projName': 'Marketing site', 'obj.orgName': 'Acme Corp' })
        const tProjLeft = tProject.forUseInLeftJoin()
        const tOrgLeft = tOrganization.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .leftJoin(tOrgLeft).on(tOrgLeft.id.equals(tProjLeft.organizationId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                obj: { projName: tProjLeft.name, orgName: tOrgLeft.name },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "obj.projName", organization.name as "obj.orgName" from issue left join project on project.id = issue.project_id left join organization on organization.id = project.organization_id where issue.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            obj: { projName: string | null; orgName: string | null } | null
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-1-plain-object-with-left-join-required-in-optional-object-leaf-default', async () => {
        // A plain-select nested object whose leaves both come from the SAME left
        // join, with one leaf marked `.asRequiredInOptionalObject()` — the rule-1
        // marker that makes the OBJECT optional (`proj?`). The marked `name` stays
        // required-when-present (`string`); the sibling plain left-join `slug` is
        // demoted to `| undefined`. Issue 1 -> project 1 (Marketing site), join hits.
        const expected = { iid: 1, proj: { name: 'Marketing site', slug: 'mktg-site' } }
        ctx.mockNext({ iid: 1, 'proj.name': 'Marketing site', 'proj.slug': 'mktg-site' })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                proj: { name: tProjLeft.name.asRequiredInOptionalObject(), slug: tProjLeft.slug },
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "proj.name", project.slug as "proj.slug" from issue left join project on project.id = issue.project_id where issue.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            proj?: { name: string; slug: string | undefined }
        }>>()
        expect(row).toEqual(expected)
    })

    test('rule-1-plain-object-with-left-join-required-in-optional-object-leaf-projecting-optional-values-as-nullable', async () => {
        // The same rule-1 plain object under `projectingOptionalValuesAsNullable()`:
        // the optional object becomes `{...} | null`, the marked `name` stays
        // required inside it, and the sibling plain left-join `slug` flips to
        // `| null`. Issue 1 -> project 1, join hits.
        const expected = { iid: 1, proj: { name: 'Marketing site', slug: 'mktg-site' } }
        ctx.mockNext({ iid: 1, 'proj.name': 'Marketing site', 'proj.slug': 'mktg-site' })
        const tProjLeft = tProject.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.equals(1))
            .select({
                iid: tIssue.id,
                proj: { name: tProjLeft.name.asRequiredInOptionalObject(), slug: tProjLeft.slug },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "proj.name", project.slug as "proj.slug" from issue left join project on project.id = issue.project_id where issue.id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            proj: { name: string; slug: string | null } | null
        }>>()
        expect(row).toEqual(expected)
    })
})
