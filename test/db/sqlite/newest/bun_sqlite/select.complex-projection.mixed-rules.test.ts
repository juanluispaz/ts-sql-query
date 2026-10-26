// A nested object that mixes an OWN-TABLE required leaf (always present) with a
// LEFT-JOIN originallyRequired leaf (present only when the join hits). The
// own-table required leaf forces the whole object to stay REQUIRED, while the
// left-join leaves are demoted to optional — `?`/absent under the default
// asUndefined projector, `| null` under projectingOptionalValuesAsNullable().

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization, tProject, tReleaseDraft, type ReleaseChannel } from '../../domain/connection.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.id as "mix.ownId", project.name as "mix.projName" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.id as "mix.ownId", project.name as "mix.projName" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "proj.name", ? as "proj.tag" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "proj.name", ? as "proj.tag" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

    test('rule-2-left-join-object-mixing-a-const-leaf-dropped-on-join-miss-default', async () => {
        // The rule-2 boundary on a JOIN MISS. `iss` mixes a LEFT-JOIN
        // originallyRequired leaf (`title` = issue.title, NOT NULL in the
        // schema) with a `connection.const()` NO-TABLE leaf (`tag`, always
        // present). Rule 2 treats the originallyRequired left-join leaf as the
        // object's presence signal and IGNORES the no-table const leaf, so when
        // the join misses the WHOLE object is dropped — even though the const
        // still has a value. project 3 -> issue 4 (join hits, `iss` present);
        // project 4 -> no issue (join misses, `iss` absent). Matches the typed
        // `iss?: { title: string; tag: string }` (present ⟹ `title` is a string).
        const expected = [
            { pid: 3, iss: { title: 'Document /v2/users', tag: 'rel' } },
            { pid: 4 },
        ]
        ctx.mockNext([
            { pid: 3, 'iss.title': 'Document /v2/users', 'iss.tag': 'rel' },
            { pid: 4, 'iss.title': null, 'iss.tag': 'rel' },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                iss: { title: tIssueLeft.title, tag: ctx.conn.const('rel', 'string') },
            })
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.title as "iss.title", ? as "iss.tag" from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            iss?: { title: string; tag: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('rule-2-left-join-object-mixing-a-const-leaf-dropped-on-join-miss-projecting-optional-values-as-nullable', async () => {
        // Same miss under `projectingOptionalValuesAsNullable()`: the dropped
        // object surfaces as `null` (not absent), and the const leaf still does
        // not keep it alive. project 3 hits; project 4 misses -> `iss: null`.
        const expected = [
            { pid: 3, iss: { title: 'Document /v2/users', tag: 'rel' } },
            { pid: 4, iss: null },
        ]
        ctx.mockNext([
            { pid: 3, 'iss.title': 'Document /v2/users', 'iss.tag': 'rel' },
            { pid: 4, 'iss.title': null, 'iss.tag': 'rel' },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                iss: { title: tIssueLeft.title, tag: ctx.conn.const('rel', 'string') },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.title as "iss.title", ? as "iss.tag" from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            iss: { title: string; tag: string } | null
        }>>>()
        expect(rows).toEqual(expected)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "obj.projName", organization.name as "obj.orgName" from issue left join project on project.id = issue.project_id left join organization on organization.id = project.organization_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            obj?: { projName?: string; orgName?: string }
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "obj.projName", organization.name as "obj.orgName" from issue left join project on project.id = issue.project_id left join organization on organization.id = project.organization_id where issue.id = ?"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "proj.name", project.slug as "proj.slug" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            iid: number
            proj?: { name: string; slug?: string }
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.name as "proj.name", project.slug as "proj.slug" from issue left join project on project.id = issue.project_id where issue.id = ?"`)
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

    test('top-level-optional-branded-column-default-as-undefined', async () => {
        // A top-level optional branded literal-union column projected directly.
        // `tReleaseDraft.channel` is an optional `custom` (ReleaseChannel) column; under the default
        // projector the leaf is `channel?: ReleaseChannel`, absent when null. Draft 1 channel 'beta';
        // draft 2 NULL → absent.
        const expected = [{ id: 1, channel: 'beta' }, { id: 2 }]
        ctx.mockNext([{ id: 1, channel: 'beta' }, { id: 2, channel: null }])
        const rows = await ctx.conn.selectFrom(tReleaseDraft)
            .select({ id: tReleaseDraft.id, channel: tReleaseDraft.channel })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, channel as channel from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; channel?: ReleaseChannel }>>>()
        expect(rows).toEqual(expected)
    })
    test('top-level-optional-branded-column-projecting-optional-values-as-nullable', async () => {
        // The same top-level optional branded column under `projectingOptionalValuesAsNullable()`:
        // `channel: ReleaseChannel | null` (brand kept through `| null`). Draft 2's NULL channel is
        // present as null.
        const expected = [{ id: 1, channel: 'beta' }, { id: 2, channel: null }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tReleaseDraft)
            .select({ id: tReleaseDraft.id, channel: tReleaseDraft.channel })
            .projectingOptionalValuesAsNullable()
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, channel as channel from release_draft order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; channel: ReleaseChannel | null }>>>()
        expect(rows).toEqual(expected)
    })

    test('rule-3-required-container-own-and-left-join-leaf-dropped-on-join-miss-default', async () => {
        // Rule 3 (required container) on a JOIN MISS. `mix` mixes an OWN-TABLE
        // required leaf (`ownId` = project.id, always present) with a LEFT-JOIN
        // originallyRequired leaf (`issTitle` = issue.title via left join). The
        // own-table leaf makes the object REQUIRED (`mix:`, never dropped); the
        // left-join leaf is demoted to `string | undefined`. project 3 -> issue 4
        // (join hits, `issTitle` present); project 4 -> no issue (join misses, so
        // `issTitle` drops while `mix` itself stays present with only `ownId`).
        const expected = [
            { pid: 3, mix: { ownId: 3, issTitle: 'Document /v2/users' } },
            { pid: 4, mix: { ownId: 4 } },
        ]
        ctx.mockNext([
            { pid: 3, 'mix.ownId': 3, 'mix.issTitle': 'Document /v2/users' },
            { pid: 4, 'mix.ownId': 4, 'mix.issTitle': null },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                mix: { ownId: tProject.id, issTitle: tIssueLeft.title },
            })
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, project.id as "mix.ownId", issue.title as "mix.issTitle" from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            mix: { ownId: number; issTitle?: string }
        }>>>()
        const miss = rows[1]!
        expect('mix' in miss).toBe(true)
        expect('issTitle' in miss.mix).toBe(false)
        expect(rows).toEqual(expected)
    })

    test('rule-3-required-container-own-and-left-join-leaf-dropped-on-join-miss-projecting-optional-values-as-nullable', async () => {
        // Same rule-3 miss under `projectingOptionalValuesAsNullable()`: the object
        // stays REQUIRED (own-table leaf keeps it present), but the demoted
        // left-join leaf flips to `string | null` and surfaces as `null` on the
        // miss instead of being absent. project 4 -> no issue -> `issTitle: null`.
        const expected = [
            { pid: 3, mix: { ownId: 3, issTitle: 'Document /v2/users' } },
            { pid: 4, mix: { ownId: 4, issTitle: null } },
        ]
        ctx.mockNext([
            { pid: 3, 'mix.ownId': 3, 'mix.issTitle': 'Document /v2/users' },
            { pid: 4, 'mix.ownId': 4, 'mix.issTitle': null },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                mix: { ownId: tProject.id, issTitle: tIssueLeft.title },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, project.id as "mix.ownId", issue.title as "mix.issTitle" from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            mix: { ownId: number; issTitle: string | null }
        }>>>()
        const miss = rows[1]!
        expect(miss.mix.issTitle).toBe(null)
        expect(rows).toEqual(expected)
    })

    test('two-different-left-joins-full-miss-drops-object-default', async () => {
        // Rule 4 (two DIFFERENT left joins in one object) on a FULL miss. `obj`
        // mixes an issue-left-join leaf (`issTitle` = issue.title) with a chained
        // user-left-join leaf (`assigneeName` = app_user.full_name). Because the
        // two leaves come from different left joins, the object is OPTIONAL
        // (`obj?`, dropped only when BOTH leaves are null). project 3 -> issue 4 ->
        // assignee 3 (Alan Turing): both joins hit, `obj` present. project 4 -> no
        // issue -> the user join misses too: BOTH null, so the whole object drops.
        const expected = [
            { pid: 3, obj: { issTitle: 'Document /v2/users', assigneeName: 'Alan Turing' } },
            { pid: 4 },
        ]
        ctx.mockNext([
            { pid: 3, 'obj.issTitle': 'Document /v2/users', 'obj.assigneeName': 'Alan Turing' },
            { pid: 4, 'obj.issTitle': null, 'obj.assigneeName': null },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const tUserLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .leftJoin(tUserLeft).on(tUserLeft.id.equals(tIssueLeft.assigneeId))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                obj: { issTitle: tIssueLeft.title, assigneeName: tUserLeft.fullName },
            })
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.title as "obj.issTitle", app_user.full_name as "obj.assigneeName" from project left join issue on issue.project_id = project.id left join app_user on app_user.id = issue.assignee_id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            obj?: { issTitle?: string; assigneeName?: string }
        }>>>()
        const miss = rows[1]!
        expect('obj' in miss).toBe(false)
        expect(rows).toEqual(expected)
    })

    test('two-different-left-joins-full-miss-drops-object-projecting-optional-values-as-nullable', async () => {
        // Same rule-4 full miss under `projectingOptionalValuesAsNullable()`: the
        // dropped object surfaces as `null` (not absent). project 4 -> both leaves
        // null -> `obj: null`.
        const expected = [
            { pid: 3, obj: { issTitle: 'Document /v2/users', assigneeName: 'Alan Turing' } },
            { pid: 4, obj: null },
        ]
        ctx.mockNext([
            { pid: 3, 'obj.issTitle': 'Document /v2/users', 'obj.assigneeName': 'Alan Turing' },
            { pid: 4, 'obj.issTitle': null, 'obj.assigneeName': null },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const tUserLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .leftJoin(tUserLeft).on(tUserLeft.id.equals(tIssueLeft.assigneeId))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                obj: { issTitle: tIssueLeft.title, assigneeName: tUserLeft.fullName },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.title as "obj.issTitle", app_user.full_name as "obj.assigneeName" from project left join issue on issue.project_id = project.id left join app_user on app_user.id = issue.assignee_id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            obj: { issTitle: string | null; assigneeName: string | null } | null
        }>>>()
        const miss = rows[1]!
        expect(miss.obj).toBe(null)
        expect(rows).toEqual(expected)
    })

    test('two-different-left-joins-partial-miss-keeps-object-default', async () => {
        // Rule 4 (two DIFFERENT left joins) on a PARTIAL miss — the strongest of
        // the four boundaries, exercising per-leaf source discrimination. project 2
        // -> issue 3 ('Migrate to ESM'), whose assignee_id is NULL: the issue join
        // HITS (`issTitle` present) but the user join MISSES (`assigneeName` null).
        // At least one leaf has a value, so the object is KEPT; the null leaf drops.
        const expected = { pid: 2, obj: { issTitle: 'Migrate to ESM' } }
        ctx.mockNext({ pid: 2, 'obj.issTitle': 'Migrate to ESM', 'obj.assigneeName': null })
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const tUserLeft = tAppUser.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .leftJoin(tUserLeft).on(tUserLeft.id.equals(tIssueLeft.assigneeId))
            .where(tProject.id.equals(2))
            .select({
                pid: tProject.id,
                obj: { issTitle: tIssueLeft.title, assigneeName: tUserLeft.fullName },
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.title as "obj.issTitle", app_user.full_name as "obj.assigneeName" from project left join issue on issue.project_id = project.id left join app_user on app_user.id = issue.assignee_id where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            pid: number
            obj?: { issTitle?: string; assigneeName?: string }
        }>>()
        expect('obj' in row).toBe(true)
        expect(row.obj!.issTitle).toBe('Migrate to ESM')
        expect('assigneeName' in row.obj!).toBe(false)
        expect(row).toEqual(expected)
    })

    test('two-different-left-joins-partial-miss-keeps-object-projecting-optional-values-as-nullable', async () => {
        // Same rule-4 partial miss under `projectingOptionalValuesAsNullable()`: the
        // object is kept, the present leaf carries its value, and the missing leaf
        // surfaces as `null` instead of being absent. project 2 -> issue 3 present,
        // assignee null -> `{ issTitle: 'Migrate to ESM', assigneeName: null }`.
        const expected = { pid: 2, obj: { issTitle: 'Migrate to ESM', assigneeName: null } }
        ctx.mockNext({ pid: 2, 'obj.issTitle': 'Migrate to ESM', 'obj.assigneeName': null })
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const tUserLeft = tAppUser.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .leftJoin(tUserLeft).on(tUserLeft.id.equals(tIssueLeft.assigneeId))
            .where(tProject.id.equals(2))
            .select({
                pid: tProject.id,
                obj: { issTitle: tIssueLeft.title, assigneeName: tUserLeft.fullName },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.title as "obj.issTitle", app_user.full_name as "obj.assigneeName" from project left join issue on issue.project_id = project.id left join app_user on app_user.id = issue.assignee_id where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            pid: number
            obj: { issTitle: string | null; assigneeName: string | null } | null
        }>>()
        expect(row.obj!.assigneeName).toBe(null)
        expect(row.obj!.issTitle).toBe('Migrate to ESM')
        expect(row).toEqual(expected)
    })

    test('rule-1-required-in-optional-object-marker-hits-while-demoted-leaf-misses-default', async () => {
        // Rule 1 (asRequiredInOptionalObject marker) with the marked leaf and the
        // demoted leaf drawn from DIFFERENT left joins so one HITS and the other
        // MISSES. `mix` marks the issue-left-join `title`
        // (`.asRequiredInOptionalObject()`) — that marker makes the object OPTIONAL
        // (`mix?`) and keeps it present as long as the MARKED leaf has a value;
        // the sibling user-left-join `assigneeName` (originallyRequired) is demoted
        // to `string | undefined`. project 2 -> issue 3 ('Migrate to ESM', assignee
        // NULL): the issue join hits so the marked leaf keeps `mix` present, while
        // the user join misses so the demoted `assigneeName` drops.
        const expected = { pid: 2, mix: { title: 'Migrate to ESM' } }
        ctx.mockNext({ pid: 2, 'mix.title': 'Migrate to ESM', 'mix.assigneeName': null })
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const tUserLeft = tAppUser.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .leftJoin(tUserLeft).on(tUserLeft.id.equals(tIssueLeft.assigneeId))
            .where(tProject.id.equals(2))
            .select({
                pid: tProject.id,
                mix: { title: tIssueLeft.title.asRequiredInOptionalObject(), assigneeName: tUserLeft.fullName },
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.title as "mix.title", app_user.full_name as "mix.assigneeName" from project left join issue on issue.project_id = project.id left join app_user on app_user.id = issue.assignee_id where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            pid: number
            mix?: { title: string; assigneeName?: string }
        }>>()
        expect('mix' in row).toBe(true)
        expect(row.mix!.title).toBe('Migrate to ESM')
        expect('assigneeName' in row.mix!).toBe(false)
        expect(row).toEqual(expected)
    })

    test('rule-1-required-in-optional-object-marker-hits-while-demoted-leaf-misses-projecting-optional-values-as-nullable', async () => {
        // Same rule-1 boundary under `projectingOptionalValuesAsNullable()`: the
        // object stays present (marked leaf hits) and becomes `{...} | null`, the
        // marked `title` stays required inside it, and the demoted `assigneeName`
        // surfaces as `null` instead of being absent. project 2 -> marked leaf
        // present, user join misses -> `{ title: 'Migrate to ESM', assigneeName: null }`.
        const expected = { pid: 2, mix: { title: 'Migrate to ESM', assigneeName: null } }
        ctx.mockNext({ pid: 2, 'mix.title': 'Migrate to ESM', 'mix.assigneeName': null })
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const tUserLeft = tAppUser.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .leftJoin(tUserLeft).on(tUserLeft.id.equals(tIssueLeft.assigneeId))
            .where(tProject.id.equals(2))
            .select({
                pid: tProject.id,
                mix: { title: tIssueLeft.title.asRequiredInOptionalObject(), assigneeName: tUserLeft.fullName },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.title as "mix.title", app_user.full_name as "mix.assigneeName" from project left join issue on issue.project_id = project.id left join app_user on app_user.id = issue.assignee_id where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            pid: number
            mix: { title: string; assigneeName: string | null } | null
        }>>()
        expect(row.mix!.assigneeName).toBe(null)
        expect(row.mix!.title).toBe('Migrate to ESM')
        expect(row).toEqual(expected)
    })

    test('rule-2-const-FIRST-leaf-order-object-dropped-on-join-miss-default', async () => {
        // A rule-2 nested object with the `connection.const()` NO-TABLE leaf FIRST and
        // the LEFT-JOIN originallyRequired leaf (`title` = issue.title) second. Rule 2
        // ignores the leading const and treats the left-join leaf as the object's presence
        // signal, so the object is OPTIONAL (`iss?`) and drops on a join MISS even though
        // the const has a value. project 3 -> issue 4 (join hits, `iss` present); project
        // 4 -> no issue (join misses, `iss` dropped).
        const expected = [
            { pid: 3, iss: { tag: 'rel', title: 'Document /v2/users' } },
            { pid: 4 },
        ]
        ctx.mockNext([
            { pid: 3, 'iss.tag': 'rel', 'iss.title': 'Document /v2/users' },
            { pid: 4, 'iss.tag': 'rel', 'iss.title': null },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                iss: { tag: ctx.conn.const('rel', 'string'), title: tIssueLeft.title },
            })
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, ? as "iss.tag", issue.title as "iss.title" from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            iss?: { tag: string; title: string }
        }>>>()
        const miss = rows[1]!
        expect('iss' in miss).toBe(false)
        expect(rows).toEqual(expected)
    })

    test('rule-2-const-FIRST-leaf-order-object-dropped-on-join-miss-projecting-optional-values-as-nullable', async () => {
        // Same const-FIRST boundary under `projectingOptionalValuesAsNullable()`:
        // the dropped object surfaces as `null` (not absent), and the leading const
        // still does not keep it alive. project 3 hits; project 4 misses -> `iss: null`.
        const expected = [
            { pid: 3, iss: { tag: 'rel', title: 'Document /v2/users' } },
            { pid: 4, iss: null },
        ]
        ctx.mockNext([
            { pid: 3, 'iss.tag': 'rel', 'iss.title': 'Document /v2/users' },
            { pid: 4, 'iss.tag': 'rel', 'iss.title': null },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                iss: { tag: ctx.conn.const('rel', 'string'), title: tIssueLeft.title },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, ? as "iss.tag", issue.title as "iss.title" from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            iss: { tag: string; title: string } | null
        }>>>()
        const miss = rows[1]!
        expect(miss.iss).toBe(null)
        expect(rows).toEqual(expected)
    })

    test('all-const-nested-object-is-required-and-never-dropped', async () => {
        // A nested object whose EVERY leaf is a `connection.const()` NO-TABLE source. With
        // no table-bound leaf, the object is REQUIRED (`tags:`, never dropped) and both
        // leaves are required (`{ a: string; b: string }`).
        const expected = { pid: 1, tags: { a: 'x', b: 'y' } }
        ctx.mockNext({ pid: 1, 'tags.a': 'x', 'tags.b': 'y' })
        const row = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                pid: tProject.id,
                tags: { a: ctx.conn.const('x', 'string'), b: ctx.conn.const('y', 'string') },
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, ? as "tags.a", ? as "tags.b" from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "x",
            "y",
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            pid: number
            tags: { a: string; b: string }
        }>>()
        expect('tags' in row).toBe(true)
        expect(row).toEqual(expected)
    })

    test('two-different-left-joins-plus-const-promotes-to-rule-3-container-survives-full-miss-default', async () => {
        // Two DIFFERENT left joins in one object PLUS a `connection.const()` NO-TABLE leaf.
        // The always-present const anchors the container's presence, so the object is
        // REQUIRED (`obj:`) and the two left-join leaves are demoted to optional; on a FULL
        // miss the container SURVIVES carrying only the const. project 3 -> issue 4 ->
        // assignee 3 (Alan Turing): both joins hit. project 4 -> no issue -> user join
        // misses too: both left-join leaves drop, but `obj` stays present with just `tag`.
        const expected = [
            { pid: 3, obj: { issTitle: 'Document /v2/users', assigneeName: 'Alan Turing', tag: 'rel' } },
            { pid: 4, obj: { tag: 'rel' } },
        ]
        ctx.mockNext([
            { pid: 3, 'obj.issTitle': 'Document /v2/users', 'obj.assigneeName': 'Alan Turing', 'obj.tag': 'rel' },
            { pid: 4, 'obj.issTitle': null, 'obj.assigneeName': null, 'obj.tag': 'rel' },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const tUserLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .leftJoin(tUserLeft).on(tUserLeft.id.equals(tIssueLeft.assigneeId))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                obj: { issTitle: tIssueLeft.title, assigneeName: tUserLeft.fullName, tag: ctx.conn.const('rel', 'string') },
            })
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.title as "obj.issTitle", app_user.full_name as "obj.assigneeName", ? as "obj.tag" from project left join issue on issue.project_id = project.id left join app_user on app_user.id = issue.assignee_id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            obj: { issTitle?: string; assigneeName?: string; tag: string }
        }>>>()
        const miss = rows[1]!
        expect('obj' in miss).toBe(true)
        expect('issTitle' in miss.obj).toBe(false)
        expect('assigneeName' in miss.obj).toBe(false)
        expect(miss.obj.tag).toBe('rel')
        expect(rows).toEqual(expected)
    })

    test('two-different-left-joins-plus-const-promotes-to-rule-3-container-survives-full-miss-projecting-optional-values-as-nullable', async () => {
        // Same rule-3 promotion under `projectingOptionalValuesAsNullable()`: the
        // object stays REQUIRED (const anchors it) and the two demoted left-join
        // leaves flip to `| null`, surfacing as `null` on the full miss instead of
        // being absent. project 4 -> full miss -> `obj: { issTitle: null,
        // assigneeName: null, tag: 'rel' }`.
        const expected = [
            { pid: 3, obj: { issTitle: 'Document /v2/users', assigneeName: 'Alan Turing', tag: 'rel' } },
            { pid: 4, obj: { issTitle: null, assigneeName: null, tag: 'rel' } },
        ]
        ctx.mockNext([
            { pid: 3, 'obj.issTitle': 'Document /v2/users', 'obj.assigneeName': 'Alan Turing', 'obj.tag': 'rel' },
            { pid: 4, 'obj.issTitle': null, 'obj.assigneeName': null, 'obj.tag': 'rel' },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const tUserLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .leftJoin(tUserLeft).on(tUserLeft.id.equals(tIssueLeft.assigneeId))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                obj: { issTitle: tIssueLeft.title, assigneeName: tUserLeft.fullName, tag: ctx.conn.const('rel', 'string') },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.title as "obj.issTitle", app_user.full_name as "obj.assigneeName", ? as "obj.tag" from project left join issue on issue.project_id = project.id left join app_user on app_user.id = issue.assignee_id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            obj: { issTitle: string | null; assigneeName: string | null; tag: string }
        }>>>()
        const miss = rows[1]!
        expect(miss.obj.issTitle).toBe(null)
        expect(miss.obj.assigneeName).toBe(null)
        expect(miss.obj.tag).toBe('rel')
        expect(rows).toEqual(expected)
    })

    test('two-different-left-joins-merged-in-one-leaf-plus-const-survives-partial-miss-default', async () => {
        // A SINGLE leaf that MERGES two DIFFERENT left joins with an operator
        // (`combined` = project.id + assignee.id) PLUS a `connection.const()`
        // NO-TABLE leaf. The always-present const anchors the container, so the
        // object is REQUIRED (`obj:`) and the merged left-join leaf is demoted to
        // optional; because the sum is null as soon as EITHER join misses, a
        // partial miss drops the merged leaf while the container SURVIVES carrying
        // only the const. issue 3 -> project 2 hit, assignee absent -> `combined`
        // is null, `obj` stays present with just `tag`. issue 4 -> project 3 +
        // assignee 3 -> combined = 3 + 3.
        const expected = [
            { iid: 3, obj: { tag: 'rel' } },
            { iid: 4, obj: { combined: 6, tag: 'rel' } },
        ]
        ctx.mockNext([
            { iid: 3, 'obj.combined': null, 'obj.tag': 'rel' },
            { iid: 4, 'obj.combined': 6, 'obj.tag': 'rel' },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const tAssigneeLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .leftJoin(tAssigneeLeft).on(tAssigneeLeft.id.equals(tIssue.assigneeId))
            .where(tIssue.id.in([3, 4]))
            .select({
                iid: tIssue.id,
                obj: { combined: tProjLeft.id.add(tAssigneeLeft.id), tag: ctx.conn.const('rel', 'string') },
            })
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id + app_user.id as "obj.combined", ? as "obj.tag" from issue left join project on project.id = issue.project_id left join app_user on app_user.id = issue.assignee_id where issue.id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            obj: { combined?: number; tag: string }
        }>>>()
        const miss = rows[0]!
        expect('obj' in miss).toBe(true)
        expect('combined' in miss.obj).toBe(false)
        expect(miss.obj.tag).toBe('rel')
        expect(rows).toEqual(expected)
    })

    test('two-different-left-joins-merged-in-one-leaf-plus-const-survives-partial-miss-projecting-optional-values-as-nullable', async () => {
        // Same merged-leaf rule-3 promotion under `projectingOptionalValuesAsNullable()`:
        // the object stays REQUIRED (const anchors it) and the demoted merged
        // left-join leaf flips to `number | null`, surfacing as `null` on the
        // partial miss instead of being absent. issue 3 -> assignee absent ->
        // `obj: { combined: null, tag: 'rel' }`.
        const expected = [
            { iid: 3, obj: { combined: null, tag: 'rel' } },
            { iid: 4, obj: { combined: 6, tag: 'rel' } },
        ]
        ctx.mockNext([
            { iid: 3, 'obj.combined': null, 'obj.tag': 'rel' },
            { iid: 4, 'obj.combined': 6, 'obj.tag': 'rel' },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const tAssigneeLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .leftJoin(tAssigneeLeft).on(tAssigneeLeft.id.equals(tIssue.assigneeId))
            .where(tIssue.id.in([3, 4]))
            .select({
                iid: tIssue.id,
                obj: { combined: tProjLeft.id.add(tAssigneeLeft.id), tag: ctx.conn.const('rel', 'string') },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id + app_user.id as "obj.combined", ? as "obj.tag" from issue left join project on project.id = issue.project_id left join app_user on app_user.id = issue.assignee_id where issue.id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            obj: { combined: number | null; tag: string }
        }>>>()
        const miss = rows[0]!
        expect(miss.obj.combined).toBe(null)
        expect(miss.obj.tag).toBe('rel')
        expect(rows).toEqual(expected)
    })


    test('merged-two-left-join-leaf-alone-no-const-drops-object-default', async () => {
        // A merged two-DIFFERENT-left-join leaf (`combined` = project.id +
        // assignee.id) ALONE in the object — NO const anchor. Because the merged
        // leaf spans TWO different left joins, rule 2 is disqualified and
        // the object is OPTIONAL (`obj?`): with nothing else to anchor it, a partial
        // miss (either join null) drops the WHOLE object. issue 3 -> project 2 hit
        // but assignee NULL -> combined null -> obj dropped; issue 4 -> project 3 +
        // assignee 3 -> combined = 3 + 3 = 6.
        const expected = [
            { iid: 3 },
            { iid: 4, obj: { combined: 6 } },
        ]
        ctx.mockNext([
            { iid: 3, 'obj.combined': null },
            { iid: 4, 'obj.combined': 6 },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const tAssigneeLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .leftJoin(tAssigneeLeft).on(tAssigneeLeft.id.equals(tIssue.assigneeId))
            .where(tIssue.id.in([3, 4]))
            .select({
                iid: tIssue.id,
                obj: { combined: tProjLeft.id.add(tAssigneeLeft.id) },
            })
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id + app_user.id as "obj.combined" from issue left join project on project.id = issue.project_id left join app_user on app_user.id = issue.assignee_id where issue.id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            obj?: { combined?: number }
        }>>>()
        const miss = rows[0]!
        expect('obj' in miss).toBe(false)
        expect(rows).toEqual(expected)
    })

    test('merged-two-left-join-leaf-alone-no-const-drops-object-projecting-optional-values-as-nullable', async () => {
        // Same merged-leaf-ALONE boundary under `projectingOptionalValuesAsNullable()`.
        // The single merged leaf's absent inhabitant collapses the WHOLE object to
        // `null` (NOT `{ combined: null }`): with no other leaf to realize a
        // value-present object, the `number | null` inhabitant of `combined` is
        // unreachable in a present object, so a partial miss surfaces as `obj: null`.
        // issue 3 -> assignee NULL -> `obj: null`; issue 4 -> combined 6.
        const expected = [
            { iid: 3, obj: null },
            { iid: 4, obj: { combined: 6 } },
        ]
        ctx.mockNext([
            { iid: 3, 'obj.combined': null },
            { iid: 4, 'obj.combined': 6 },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const tAssigneeLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .leftJoin(tAssigneeLeft).on(tAssigneeLeft.id.equals(tIssue.assigneeId))
            .where(tIssue.id.in([3, 4]))
            .select({
                iid: tIssue.id,
                obj: { combined: tProjLeft.id.add(tAssigneeLeft.id) },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id + app_user.id as "obj.combined" from issue left join project on project.id = issue.project_id left join app_user on app_user.id = issue.assignee_id where issue.id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            obj: { combined: number | null } | null
        }>>>()
        const miss = rows[0]!
        expect(miss.obj).toBe(null)
        expect(rows).toEqual(expected)
    })

    test('own-optional-sibling-keeps-object-alive-on-left-join-miss-default', async () => {
        // An object mixing an OWN-TABLE OPTIONAL leaf (`projArchived` =
        // project.archived_at) with a LEFT-JOIN originallyRequired leaf (`issTitle` =
        // issue.title). The own-table leaf disqualifies rule 2, so the left-join leaf
        // is demoted `| undefined` (rule 4). project 4 (Legacy app) has NO issue -> the
        // join MISSES (`issTitle` absent) but its own `archived_at` is present, so the
        // object SURVIVES carrying only `projArchived`.
        const archived = new Date(Date.UTC(2024, 0, 1, 0, 0, 0))
        const expected = { pid: 4, obj: { projArchived: archived } }
        ctx.mockNext({ pid: 4, 'obj.issTitle': null, 'obj.projArchived': archived })
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(4))
            .select({
                pid: tProject.id,
                obj: { issTitle: tIssueLeft.title, projArchived: tProject.archivedAt },
            })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.title as "obj.issTitle", project.archived_at as "obj.projArchived" from project left join issue on issue.project_id = project.id where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
          ]
        `)
        assertType<Exact<typeof row, {
            pid: number
            obj?: { issTitle?: string; projArchived?: Date }
        }>>()
        expect('obj' in row).toBe(true)
        expect('issTitle' in row.obj!).toBe(false)
        expect(row.obj!.projArchived instanceof Date).toBe(true)
        if (!ctx.realDbEnabled) {
            expect(row).toEqual(expected)
        }
    })

    test('own-optional-sibling-keeps-object-alive-on-left-join-miss-projecting-optional-values-as-nullable', async () => {
        // Same own-optional-sibling boundary under `projectingOptionalValuesAsNullable()`:
        // the object stays present (own leaf keeps it alive) and becomes `{...} | null`,
        // the demoted left-join `issTitle` surfaces as `null` on the miss, and the own
        // optional `projArchived` flips to `Date | null` (present here). project 4 ->
        // issue join misses -> `{ issTitle: null, projArchived: <Date> }`.
        const archived = new Date(Date.UTC(2024, 0, 1, 0, 0, 0))
        const expected = { pid: 4, obj: { issTitle: null, projArchived: archived } }
        ctx.mockNext({ pid: 4, 'obj.issTitle': null, 'obj.projArchived': archived })
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(4))
            .select({
                pid: tProject.id,
                obj: { issTitle: tIssueLeft.title, projArchived: tProject.archivedAt },
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.title as "obj.issTitle", project.archived_at as "obj.projArchived" from project left join issue on issue.project_id = project.id where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
          ]
        `)
        assertType<Exact<typeof row, {
            pid: number
            obj: { issTitle: string | null; projArchived: Date | null } | null
        }>>()
        expect(row.obj).not.toBe(null)
        expect(row.obj!.issTitle).toBe(null)
        expect(row.obj!.projArchived instanceof Date).toBe(true)
        if (!ctx.realDbEnabled) {
            expect(row).toEqual(expected)
        }
    })

    test('merged-leaf-first-with-own-required-anchor-survives-partial-miss-default', async () => {
        // The merged two-left-join leaf placed FIRST, with an OWN-TABLE required
        // anchor (`ownId` = issue.id) second. The own-table leaf makes the object
        // REQUIRED (`obj:`); the leading merged leaf is demoted to
        // `combined?`. issue 3 -> project 2 hit but assignee NULL -> combined null,
        // obj survives with `ownId`; issue 4 -> combined = 3 + 3 = 6.
        const expected = [
            { iid: 3, obj: { ownId: 3 } },
            { iid: 4, obj: { combined: 6, ownId: 4 } },
        ]
        ctx.mockNext([
            { iid: 3, 'obj.combined': null, 'obj.ownId': 3 },
            { iid: 4, 'obj.combined': 6, 'obj.ownId': 4 },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const tAssigneeLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .leftJoin(tAssigneeLeft).on(tAssigneeLeft.id.equals(tIssue.assigneeId))
            .where(tIssue.id.in([3, 4]))
            .select({
                iid: tIssue.id,
                obj: { combined: tProjLeft.id.add(tAssigneeLeft.id), ownId: tIssue.id },
            })
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id + app_user.id as "obj.combined", issue.id as "obj.ownId" from issue left join project on project.id = issue.project_id left join app_user on app_user.id = issue.assignee_id where issue.id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            obj: { combined?: number; ownId: number }
        }>>>()
        const miss = rows[0]!
        expect('obj' in miss).toBe(true)
        expect('combined' in miss.obj).toBe(false)
        expect(rows).toEqual(expected)
    })

    test('merged-leaf-first-with-own-required-anchor-survives-partial-miss-projecting-optional-values-as-nullable', async () => {
        // Same merged-leaf-FIRST + own-anchor boundary under
        // `projectingOptionalValuesAsNullable()`: the object stays REQUIRED (own leaf)
        // and the demoted merged leaf flips to `number | null`, surfacing as `null` on
        // the partial miss. issue 3 -> `obj: { combined: null, ownId: 3 }`.
        const expected = [
            { iid: 3, obj: { combined: null, ownId: 3 } },
            { iid: 4, obj: { combined: 6, ownId: 4 } },
        ]
        ctx.mockNext([
            { iid: 3, 'obj.combined': null, 'obj.ownId': 3 },
            { iid: 4, 'obj.combined': 6, 'obj.ownId': 4 },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const tAssigneeLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .leftJoin(tAssigneeLeft).on(tAssigneeLeft.id.equals(tIssue.assigneeId))
            .where(tIssue.id.in([3, 4]))
            .select({
                iid: tIssue.id,
                obj: { combined: tProjLeft.id.add(tAssigneeLeft.id), ownId: tIssue.id },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id + app_user.id as "obj.combined", issue.id as "obj.ownId" from issue left join project on project.id = issue.project_id left join app_user on app_user.id = issue.assignee_id where issue.id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            obj: { combined: number | null; ownId: number }
        }>>>()
        const miss = rows[0]!
        expect(miss.obj.combined).toBe(null)
        expect(rows).toEqual(expected)
    })

    test('merged-leaf-mixing-main-and-left-join-source-plus-const-survives-partial-miss-default', async () => {
        // A merged leaf mixing the MAIN table (`issue.id`, required) with a LEFT-JOIN
        // source (`assignee.id`, originallyRequired) PLUS a const anchor. The
        // `required ⊕ originallyRequired` merge resolves to originallyRequired, so the
        // const keeps the object REQUIRED (`obj:`) and `combined` is demoted to
        // `combined?`. issue 3 -> assignee NULL -> combined null, obj survives with
        // `tag`; issue 4 -> assignee 3 -> combined = 4 + 3 = 7.
        const expected = [
            { iid: 3, obj: { tag: 'rel' } },
            { iid: 4, obj: { combined: 7, tag: 'rel' } },
        ]
        ctx.mockNext([
            { iid: 3, 'obj.combined': null, 'obj.tag': 'rel' },
            { iid: 4, 'obj.combined': 7, 'obj.tag': 'rel' },
        ])
        const tAssigneeLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tAssigneeLeft).on(tAssigneeLeft.id.equals(tIssue.assigneeId))
            .where(tIssue.id.in([3, 4]))
            .select({
                iid: tIssue.id,
                obj: { combined: tIssue.id.add(tAssigneeLeft.id), tag: ctx.conn.const('rel', 'string') },
            })
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.id + app_user.id as "obj.combined", ? as "obj.tag" from issue left join app_user on app_user.id = issue.assignee_id where issue.id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            obj: { combined?: number; tag: string }
        }>>>()
        const miss = rows[0]!
        expect('obj' in miss).toBe(true)
        expect('combined' in miss.obj).toBe(false)
        expect(miss.obj.tag).toBe('rel')
        expect(rows).toEqual(expected)
    })

    test('merged-leaf-mixing-main-and-left-join-source-plus-const-survives-partial-miss-projecting-optional-values-as-nullable', async () => {
        // Same main+left merged-leaf boundary under `projectingOptionalValuesAsNullable()`:
        // the const keeps the object REQUIRED and the demoted merged leaf flips to
        // `number | null`, surfacing as `null` on the assignee miss. issue 3 ->
        // `obj: { combined: null, tag: 'rel' }`.
        const expected = [
            { iid: 3, obj: { combined: null, tag: 'rel' } },
            { iid: 4, obj: { combined: 7, tag: 'rel' } },
        ]
        ctx.mockNext([
            { iid: 3, 'obj.combined': null, 'obj.tag': 'rel' },
            { iid: 4, 'obj.combined': 7, 'obj.tag': 'rel' },
        ])
        const tAssigneeLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tAssigneeLeft).on(tAssigneeLeft.id.equals(tIssue.assigneeId))
            .where(tIssue.id.in([3, 4]))
            .select({
                iid: tIssue.id,
                obj: { combined: tIssue.id.add(tAssigneeLeft.id), tag: ctx.conn.const('rel', 'string') },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.id + app_user.id as "obj.combined", ? as "obj.tag" from issue left join app_user on app_user.id = issue.assignee_id where issue.id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            obj: { combined: number | null; tag: string }
        }>>>()
        const miss = rows[0]!
        expect(miss.obj.combined).toBe(null)
        expect(miss.obj.tag).toBe('rel')
        expect(rows).toEqual(expected)
    })

    test('merged-leaf-plus-const-nested-one-level-deeper-survives-partial-miss-default', async () => {
        // The merged-two-left-join leaf + const anchor nested ONE LEVEL DEEPER
        // (`outer.inner`). The inner object is REQUIRED (const anchor) and
        // the merged `combined` is demoted; the outer object holds only the required
        // inner, so it is REQUIRED too. issue 3 -> assignee NULL -> combined null;
        // issue 4 -> combined = 3 + 3 = 6.
        const expected = [
            { iid: 3, outer: { inner: { tag: 'rel' } } },
            { iid: 4, outer: { inner: { combined: 6, tag: 'rel' } } },
        ]
        ctx.mockNext([
            { iid: 3, 'outer.inner.combined': null, 'outer.inner.tag': 'rel' },
            { iid: 4, 'outer.inner.combined': 6, 'outer.inner.tag': 'rel' },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const tAssigneeLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .leftJoin(tAssigneeLeft).on(tAssigneeLeft.id.equals(tIssue.assigneeId))
            .where(tIssue.id.in([3, 4]))
            .select({
                iid: tIssue.id,
                outer: { inner: { combined: tProjLeft.id.add(tAssigneeLeft.id), tag: ctx.conn.const('rel', 'string') } },
            })
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id + app_user.id as "outer.inner.combined", ? as "outer.inner.tag" from issue left join project on project.id = issue.project_id left join app_user on app_user.id = issue.assignee_id where issue.id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            outer: { inner: { combined?: number; tag: string } }
        }>>>()
        const miss = rows[0]!
        expect('combined' in miss.outer.inner).toBe(false)
        expect(miss.outer.inner.tag).toBe('rel')
        expect(rows).toEqual(expected)
    })

    test('merged-leaf-plus-const-nested-one-level-deeper-survives-partial-miss-projecting-optional-values-as-nullable', async () => {
        // Same nested merged-leaf boundary under `projectingOptionalValuesAsNullable()`:
        // the inner object stays REQUIRED (const anchor) and the demoted merged leaf
        // flips to `number | null`, surfacing as `null` on the miss. issue 3 ->
        // `outer.inner: { combined: null, tag: 'rel' }`.
        const expected = [
            { iid: 3, outer: { inner: { combined: null, tag: 'rel' } } },
            { iid: 4, outer: { inner: { combined: 6, tag: 'rel' } } },
        ]
        ctx.mockNext([
            { iid: 3, 'outer.inner.combined': null, 'outer.inner.tag': 'rel' },
            { iid: 4, 'outer.inner.combined': 6, 'outer.inner.tag': 'rel' },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const tAssigneeLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .leftJoin(tAssigneeLeft).on(tAssigneeLeft.id.equals(tIssue.assigneeId))
            .where(tIssue.id.in([3, 4]))
            .select({
                iid: tIssue.id,
                outer: { inner: { combined: tProjLeft.id.add(tAssigneeLeft.id), tag: ctx.conn.const('rel', 'string') } },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, project.id + app_user.id as "outer.inner.combined", ? as "outer.inner.tag" from issue left join project on project.id = issue.project_id left join app_user on app_user.id = issue.assignee_id where issue.id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "rel",
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            outer: { inner: { combined: number | null; tag: string } }
        }>>>()
        const miss = rows[0]!
        expect(miss.outer.inner.combined).toBe(null)
        expect(rows).toEqual(expected)
    })

    test('merged-same-single-left-join-leaf-stays-rule-2-and-drops-on-miss-default', async () => {
        // A merged leaf whose BOTH operands come from the SAME single left join
        // (`m` = issue.id + issue.number). Merging within ONE source keeps the leaf
        // single-table, so rule 2 still applies: the object is OPTIONAL (`obj?`) with
        // `m` required-when-present, and
        // it DROPS on a join miss. project 3 -> issue 4 hit -> m = 4 + 1 = 5; project
        // 4 -> no issue -> obj dropped.
        const expected = [
            { pid: 3, obj: { m: 5 } },
            { pid: 4 },
        ]
        ctx.mockNext([
            { pid: 3, 'obj.m': 5 },
            { pid: 4, 'obj.m': null },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                obj: { m: tIssueLeft.id.add(tIssueLeft.number) },
            })
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.id + issue.number as "obj.m" from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            obj?: { m: number }
        }>>>()
        const miss = rows[1]!
        expect('obj' in miss).toBe(false)
        expect(rows).toEqual(expected)
    })

    test('merged-same-single-left-join-leaf-stays-rule-2-and-drops-on-miss-projecting-optional-values-as-nullable', async () => {
        // Same merged-SAME-single-left-join boundary under
        // `projectingOptionalValuesAsNullable()`: the object is OPTIONAL and surfaces
        // as `null` on the join miss (not absent). project 4 -> no issue -> `obj: null`.
        const expected = [
            { pid: 3, obj: { m: 5 } },
            { pid: 4, obj: null },
        ]
        ctx.mockNext([
            { pid: 3, 'obj.m': 5 },
            { pid: 4, 'obj.m': null },
        ])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.in([3, 4]))
            .select({
                pid: tProject.id,
                obj: { m: tIssueLeft.id.add(tIssueLeft.number) },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, issue.id + issue.number as "obj.m" from project left join issue on issue.project_id = project.id where project.id in (?, ?) order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            3,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            obj: { m: number } | null
        }>>>()
        const miss = rows[1]!
        expect(miss.obj).toBe(null)
        expect(rows).toEqual(expected)
    })

    test('object-mixing-own-optional-and-left-join-optional-leaves-drops-on-full-miss-default', async () => {
        // An object mixing an OWN-TABLE OPTIONAL leaf (`body` = issue.body) with a
        // LEFT-JOIN OPTIONAL leaf (`arch` = project.archived_at via left join). The
        // object is OPTIONAL and drops only when BOTH leaves are null. issue 1 -> body NULL + project 1
        // archived_at NULL -> obj dropped; issue 2 -> body 'Use new tokens' -> obj
        // present (project 1 archived_at still NULL, so `arch` absent).
        const expected = [
            { iid: 1 },
            { iid: 2, obj: { body: 'Use new tokens' } },
        ]
        ctx.mockNext([
            { iid: 1, 'obj.body': null, 'obj.arch': null },
            { iid: 2, 'obj.body': 'Use new tokens', 'obj.arch': null },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.in([1, 2]))
            .select({
                iid: tIssue.id,
                obj: { body: tIssue.body, arch: tProjLeft.archivedAt },
            })
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.body as "obj.body", project.archived_at as "obj.arch" from issue left join project on project.id = issue.project_id where issue.id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            obj?: { body?: string; arch?: Date }
        }>>>()
        const miss = rows[0]!
        expect('obj' in miss).toBe(false)
        const hit = rows[1]!
        expect('obj' in hit).toBe(true)
        expect('arch' in hit.obj!).toBe(false)
        expect(rows).toEqual(expected)
    })

    test('object-mixing-own-optional-and-left-join-optional-leaves-drops-on-full-miss-projecting-optional-values-as-nullable', async () => {
        // Same own-optional + left-join-optional boundary under
        // `projectingOptionalValuesAsNullable()`: the object becomes `{...} | null`,
        // both leaves `| null`, and the full miss surfaces as `obj: null`. issue 1 ->
        // both null -> `obj: null`; issue 2 -> `{ body: 'Use new tokens', arch: null }`.
        const expected = [
            { iid: 1, obj: null },
            { iid: 2, obj: { body: 'Use new tokens', arch: null } },
        ]
        ctx.mockNext([
            { iid: 1, 'obj.body': null, 'obj.arch': null },
            { iid: 2, 'obj.body': 'Use new tokens', 'obj.arch': null },
        ])
        const tProjLeft = tProject.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tProjLeft).on(tProjLeft.id.equals(tIssue.projectId))
            .where(tIssue.id.in([1, 2]))
            .select({
                iid: tIssue.id,
                obj: { body: tIssue.body, arch: tProjLeft.archivedAt },
            })
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, issue.body as "obj.body", project.archived_at as "obj.arch" from issue left join project on project.id = issue.project_id where issue.id in (?, ?) order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid: number
            obj: { body: string | null; arch: Date | null } | null
        }>>>()
        const miss = rows[0]!
        expect(miss.obj).toBe(null)
        const hit = rows[1]!
        expect(hit.obj).not.toBe(null)
        expect(hit.obj!.arch).toBe(null)
        expect(rows).toEqual(expected)
    })

    test('merged-two-left-join-leaf-plus-const-inside-aggregate-element-demotes-leaf-default', async () => {
        // The merged-two-left-join leaf + const anchor inside an `aggregateAsArray`
        // ELEMENT. The const anchors the element (required), so the merged leaf
        // (project.id + assignee.id, spanning two different left joins) is demoted to
        // `combined?`. project 2 -> issue 3 (assignee NULL) -> combined null, so the
        // single element is `{ tag: 'rel' }` with `combined` absent.
        const expected = [{ pid: 2, items: [{ tag: 'rel' }] }]
        ctx.mockNext([{ pid: 2, items: [{ combined: null, tag: 'rel' }] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const tAssigneeLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .leftJoin(tAssigneeLeft).on(tAssigneeLeft.id.equals(tIssueLeft.assigneeId))
            .where(tProject.id.equals(2))
            .select({
                pid:   tProject.id,
                items: ctx.conn.aggregateAsArray({
                    combined: tIssueLeft.id.add(tAssigneeLeft.id),
                    tag:      ctx.conn.fragmentWithType('string', 'required').sql`'rel'`,
                }),
            })
            .groupBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_group_array(json_object('combined', issue.id + app_user.id, 'tag', 'rel')) as items from project left join issue on issue.project_id = project.id left join app_user on app_user.id = issue.assignee_id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:   number
            items: Array<{ combined?: number; tag: string }>
        }>>>()
        const element = rows[0]!.items[0]!
        expect('combined' in element).toBe(false)
        expect(element.tag).toBe('rel')
        expect(rows).toEqual(expected)
    })

    test('merged-two-left-join-leaf-plus-const-inside-aggregate-element-demotes-leaf-projecting-optional-values-as-nullable', async () => {
        // Same merged-leaf-inside-aggregate-element boundary under
        // `projectingOptionalValuesAsNullable()`: the element stays required (const
        // anchor) and the demoted merged leaf flips to `number | null`, surfacing as
        // `null` in the element. project 2 -> issue 3 assignee NULL ->
        // `items: [{ combined: null, tag: 'rel' }]`.
        const expected = [{ pid: 2, items: [{ combined: null, tag: 'rel' }] }]
        ctx.mockNext([{ pid: 2, items: [{ combined: null, tag: 'rel' }] }])
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const tAssigneeLeft = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .leftJoin(tAssigneeLeft).on(tAssigneeLeft.id.equals(tIssueLeft.assigneeId))
            .where(tProject.id.equals(2))
            .select({
                pid:   tProject.id,
                items: ctx.conn.aggregateAsArray({
                    combined: tIssueLeft.id.add(tAssigneeLeft.id),
                    tag:      ctx.conn.fragmentWithType('string', 'required').sql`'rel'`,
                }).projectingOptionalValuesAsNullable(),
            })
            .groupBy('pid')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, json_group_array(json_object('combined', issue.id + app_user.id, 'tag', 'rel')) as items from project left join issue on issue.project_id = project.id left join app_user on app_user.id = issue.assignee_id where project.id = ? group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid:   number
            items: Array<{ combined: number | null; tag: string }>
        }>>>()
        const element = rows[0]!.items[0]!
        expect(element.combined).toBe(null)
        expect(element.tag).toBe('rel')
        expect(rows).toEqual(expected)
    })

    test('merge-optional-required-in-optional-object-fragment-gates-rule-1-drop', async () => {
        // A custom maybe-optional fragment (`coalesce3`) whose three args are all
        // `.asRequiredInOptionalObject()` folds — through the RUNTIME optional-type
        // combiner `__mergeOptional` (arm: op1 is requiredInOptionalObject; op2 not
        // 'required' → return op2, which stays requiredInOptionalObject) — to a
        // `requiredInOptionalObject` result. That makes the fragment the rule-1 gate of
        // the optional `grp`: when the fragment resolves NULL — a LEFT-JOIN MISS makes
        // all three `coalesce` args null — the WHOLE `grp` object drops even though its
        // sibling `projName` (the outer project, always present) has a value. The
        // observable is the reshaped VALUE: a broken combiner folding the fragment to
        // plain `optional` would instead keep `grp: { projName }`. SQL and the
        // compile-time type are identical either way, so the `toEqual` is load-bearing.
        // Project 4 (org 2) has NO issues → the fragment is null and `grp` drops.
        const expected = { pid: 4 }
        ctx.mockNext({ pid: 4, 'grp.frag': null, 'grp.projName': 'Legacy app' })
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const row = await ctx.conn.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(4))
            .select({
                pid: tProject.id,
                grp: {
                    frag: ctx.conn.coalesce3(
                        tIssueLeft.title.asRequiredInOptionalObject(),
                        tIssueLeft.status.asRequiredInOptionalObject(),
                        tIssueLeft.body.asRequiredInOptionalObject(),
                    ),
                    projName: tProject.name,
                },
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, coalesce(issue.title, issue.status, issue.body) as "grp.frag", project.name as "grp.projName" from project left join issue on issue.project_id = project.id where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            4,
          ]
        `)
        assertType<Exact<typeof row, {
            pid:  number
            grp?: { frag: string; projName: string }
        }>>()
        expect(row).toEqual(expected)
        expect('grp' in row!).toBe(false)
    })
})
