// A nested object that mixes an OWN-TABLE required leaf (always present) with a
// LEFT-JOIN originallyRequired leaf (present only when the join hits). The
// own-table required leaf forces the whole object to stay REQUIRED, while the
// left-join leaves are demoted to optional — `?`/absent under the default
// asUndefined projector, `| null` under projectingOptionalValuesAsNullable().

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProject } from '../../domain/connection.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "iid", issue.id as "mix.ownId", project.name as "mix.projName" from issue left join project on project.id = issue.project_id where issue.id = :0"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "iid", issue.id as "mix.ownId", project.name as "mix.projName" from issue left join project on project.id = issue.project_id where issue.id = :0"`)
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
})
