// `projectingOptionalValuesAsNullable()` applied to a COMPOUND (union) result:
// the cross "compound re-projection × optional leaf → null flip". The modifier can
// be applied to the union result (after `.union(...)`) OR on the arms before it —
// both are honoured at runtime: the compound builder inherits the arms'
// `projectingOptionalValuesAsNullable()` flag, matching the type (which preserves
// the nullable projection across the union). The last test pins the before-union form.
//
// Compound order is engine-defined; both arms are tagged with a distinct `iid`
// and an ORDER BY pins the order. Mocks are primed with the RAW merged rows.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('compound-optional-flat-leaf-as-nullable-surfaces-null', async () => {
        // Two union arms project a flat optional `body`. Under
        // `projectingOptionalValuesAsNullable()` the merged result keeps a null
        // body as `string | null` (present-null) rather than dropping it. Arm 1 =
        // issue 1 (body NULL); arm 2 = issue 2 (body 'Use new tokens').
        const expected = [
            { iid: 1, body: null },
            { iid: 2, body: 'Use new tokens' },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, body: tIssue.body })
            .union(
                ctx.conn.selectFrom(tIssue)
                    .where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, body: tIssue.body }),
            )
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as body from issue where id = ? union select id as iid, body as body from issue where id = ? order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is PRESENT-NULL under the nullable projector.
        expect('body' in rows[0]!).toBe(true)
    })

    test('compound-optional-left-joined-object-as-nullable-surfaces-null', async () => {
        // Two union arms project an `assignee` object built from a LEFT-JOINED
        // app_user, so the object is optional (rule-2). Under the nullable
        // projector the object surfaces as `{...} | null` when the join misses.
        // Arm 1 = issue 1 (assignee 1 → present); arm 2 = issue 3 (assignee NULL →
        // join misses → object null).
        const expected = [
            { iid: 1, assignee: { id: 1, name: 'Ada Lovelace' } },
            { iid: 3, assignee: null },
        ]
        ctx.mockNext([
            { iid: 1, 'assignee.id': 1, 'assignee.name': 'Ada Lovelace' },
            { iid: 3, 'assignee.id': null, 'assignee.name': null },
        ])
        const tAssignee = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, assignee: { id: tAssignee.id, name: tAssignee.fullName } })
            .union(
                ctx.conn.selectFrom(tIssue)
                    .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                    .where(tIssue.id.equals(3))
                    .select({ iid: tIssue.id, assignee: { id: tAssignee.id, name: tAssignee.fullName } }),
            )
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as iid, app_user.id as "assignee.id", app_user.full_name as "assignee.name" from issue left join app_user on app_user.id = issue.assignee_id where issue.id = ? union select issue.id as iid, app_user.id as "assignee.id", app_user.full_name as "assignee.name" from issue left join app_user on app_user.id = issue.assignee_id where issue.id = ? order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            iid:      number
            assignee: { id: number; name: string } | null
        }>>>()
        expect(rows).toEqual(expected)
        // Arm 2 (issue 3) has no assignee, so the object is PRESENT-NULL (not absent).
        expect('assignee' in rows[1]!).toBe(true)
        expect(rows[1]!.assignee).toBe(null)
    })
    test('compound-optional-leaf-modifier-before-union-surfaces-null', async () => {
        // Regression: `projectingOptionalValuesAsNullable()` applied on the arms
        // BEFORE `.union(...)` is now honoured at runtime — the compound builder
        // inherits the flag — so a null `body` surfaces present-as-null rather than
        // being dropped. The type preserves the nullable projection across the union
        // (`body: string | null`); this pins that the runtime matches it. Arm 1 =
        // issue 1 (body NULL); arm 2 = issue 2 (body 'Use new tokens').
        const expected = [
            { iid: 1, body: null },
            { iid: 2, body: 'Use new tokens' },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ iid: tIssue.id, body: tIssue.body })
            .projectingOptionalValuesAsNullable()
            .union(
                ctx.conn.selectFrom(tIssue)
                    .where(tIssue.id.equals(2))
                    .select({ iid: tIssue.id, body: tIssue.body })
                    .projectingOptionalValuesAsNullable(),
            )
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as iid, body as body from issue where id = ? union select id as iid, body as body from issue where id = ? order by iid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is PRESENT-NULL even though the modifier was applied
        // before the union (previously it was silently dropped at runtime).
        expect('body' in rows[0]!).toBe(true)
    })
})
