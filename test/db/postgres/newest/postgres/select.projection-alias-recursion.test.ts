// Coverage of the complex-projection remapper recursing into a NESTED OBJECT
// when a projection-carrying source is re-aliased. A CTE
// (`forUseInQueryAs(...)`) projects a nested object; the CTE is then re-aliased
// through `.as(alias)` and `forUseInLeftJoinAs(alias)`. Re-aliasing reassigns
// every column to the new alias, and the reassignment recurses through the
// nested object so its inner leaves carry the new alias too. The inner-rules
// tests cover the projection rules themselves; here the distinct path is the
// alias-recursion through the nested object.
//
// - `.as(alias)` over a CTE carrying a required nested object: every leaf is
//   re-aliased, the inner object stays required.
// - `forUseInLeftJoinAs(alias)` over the same CTE used as a left-join target:
//   the whole nested object becomes optional (absent when the join misses) and
//   the ON clause / projection reference the alias.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('as-alias-recurses-through-a-required-nested-object', async () => {
        // The CTE projects a nested `info` object of two required columns, then
        // `.as('pc')` re-aliases the CTE. The remapper recurses through `info`,
        // reassigning every leaf to the `pc` alias; the inner object stays
        // required and present on every row. proj 1..3 from the seed.
        const expected = [
            { pid: 1, info: { id: 1, name: 'Marketing site' } },
            { pid: 2, info: { id: 2, name: 'Internal tools' } },
            { pid: 3, info: { id: 3, name: 'Public API' } },
        ]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const projCte = connection.selectFrom(tProject)
            .where(tProject.archivedAt.isNull())
            .select({
                pid:  tProject.id,
                info: { id: tProject.id, name: tProject.name },
            })
            .forUseInQueryAs('proj_cte')

        const pc = projCte.as('pc')

        const rows = await connection.selectFrom(pc)
            .select({
                pid:  pc.pid,
                info: pc.info,
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with proj_cte as (select id as pid, id as "info.id", name as "info.name" from project where archived_at is null) select pc.pid as pid, pc."info.id" as "info.id", pc."info.name" as "info.name" from proj_cte as pc order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            pid:  number
            info: { id: number; name: string }
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('for-use-in-left-join-as-recurses-through-the-nested-object-and-makes-it-optional', async () => {
        // The same nested-object CTE used as a LEFT-JOIN target via
        // `forUseInLeftJoinAs('pc')`. The remapper recurses through `info` to
        // re-alias its leaves to `pc`, and the left-join widens the whole nested
        // object to optional (absent when the join misses). The ON clause and the
        // projection both reference the `pc` alias; the WITH declaration keeps the
        // source name. Every issue has a project, so the join hits.
        const expected = [
            { iid: 1, proj: { id: 1, name: 'Marketing site' } },
            { iid: 2, proj: { id: 1, name: 'Marketing site' } },
            { iid: 3, proj: { id: 2, name: 'Internal tools' } },
            { iid: 4, proj: { id: 3, name: 'Public API' } },
        ]
        ctx.mockNext([
            { iid: 1, 'proj.id': 1, 'proj.name': 'Marketing site' },
            { iid: 2, 'proj.id': 1, 'proj.name': 'Marketing site' },
            { iid: 3, 'proj.id': 2, 'proj.name': 'Internal tools' },
            { iid: 4, 'proj.id': 3, 'proj.name': 'Public API' },
        ])
        const connection = ctx.conn

        const projCte = connection.selectFrom(tProject)
            .select({
                pid:  tProject.id,
                info: { id: tProject.id, name: tProject.name },
            })
            .forUseInQueryAs('proj_cte')

        const pcLeft = projCte.forUseInLeftJoinAs('pc')

        const rows = await connection.selectFrom(tIssue)
            .leftJoin(pcLeft).on(pcLeft.pid.equals(tIssue.projectId))
            .select({
                iid:  tIssue.id,
                proj: pcLeft.info,
            })
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with proj_cte as (select id as pid, id as "info.id", name as "info.name" from project) select issue.id as iid, pc."info.id" as "proj.id", pc."info.name" as "proj.name" from issue left join proj_cte as pc on pc.pid = issue.project_id order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{
            iid:   number
            proj?: { id: number; name: string }
        }>>>()
        expect(rows).toEqual(expected)
    })
})
