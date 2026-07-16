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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id = :0 union select id as "iid", "body" as "body" from issue where id = :1 order by 1"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as "iid", app_user.id as "assignee.id", app_user.full_name as "assignee.name" from issue left join app_user on app_user.id = issue.assignee_id where issue.id = :0 union select issue.id as "iid", app_user.id as "assignee.id", app_user.full_name as "assignee.name" from issue left join app_user on app_user.id = issue.assignee_id where issue.id = :1 order by 1"`)
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id = :0 union select id as "iid", "body" as "body" from issue where id = :1 order by 1"`)
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

    test('compound-three-arm-projecting-optionals-as-nullable-exec', async () => {
        // Three-arm compound `a.union(b).union(c)` with `.projectingOptionalValuesAsNullable()`
        // on every arm. The second `.union(...)` chains onto the already-combined
        // first two arms, so the nullable projection must survive both unions for the
        // optional `body` leaf to stay `string | null` and surface present-as-null.
        // Arm 1 = issue 1 (body NULL);
        // arm 2 = issue 2 (body 'Use new tokens'); arm 3 = issue 4 (body 'See ADR-014').
        const expected = [
            { iid: 1, body: null },
            { iid: 2, body: 'Use new tokens' },
            { iid: 4, body: 'See ADR-014' },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .union(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .union(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(4)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id = :0 union select id as "iid", "body" as "body" from issue where id = :1 union select id as "iid", "body" as "body" from issue where id = :2 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            4,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is PRESENT-null across both unions.
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-three-arm-projecting-optionals-as-nullable-inline', async () => {
        // The three-arm compound (flag on every arm) consumed as an inline aggregated
        // array: the optional `body` leaf surfaces present-as-null in each element,
        // so the nullable projection survives both unions and the inline-aggregate
        // consumption. Arms = issues 1 (body NULL), 2, 4.
        ctx.mockNext({ arr: JSON.stringify([
            { iid: 1, body: null },
            { iid: 2, body: 'Use new tokens' },
            { iid: 4, body: 'See ADR-014' },
        ]) })
        const arr = ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .union(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .union(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(4)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable().select({ arr }).executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select json_arrayagg(json_object('iid' value a_1_.iid, 'body' value a_1_."body")) from (select id as iid, "body" as "body" from issue where id = :0 union select id as iid, "body" as "body" from issue where id = :1 union select id as iid, "body" as "body" from issue where id = :2) a_1_) as "arr" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            4,
          ]
        `)
        assertType<Exact<typeof row, { arr: Array<{ iid: number; body: string | null }> }>>()
        expect({ arr: [...row.arr].sort((a, b) => a.iid - b.iid) }).toEqual({ arr: [
            { iid: 1, body: null },
            { iid: 2, body: 'Use new tokens' },
            { iid: 4, body: 'See ADR-014' },
        ] })
        const nullRow = row.arr.find(r => r.iid === 1)!
        expect('body' in nullRow).toBe(true)
        expect(nullRow.body).toBe(null)
    })

    test('compound-before-op-unionAll-nullable-exec', async () => {
        // `.projectingOptionalValuesAsNullable()` on the arms BEFORE `.unionAll(...)`:
        // the compound builder inherits the nullable-projection flag, so the optional
        // `body` leaf surfaces present-as-null through the `union all` compound (execute-rows path).
        const expected = [
            { iid: 1, body: null },
            { iid: 2, body: 'Use new tokens' },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .unionAll(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id = :0 union all select id as "iid", "body" as "body" from issue where id = :1 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is PRESENT-null (the before-op flag survives the compound).
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-before-op-unionAll-nullable-inline', async () => {
        // Same `union all` compound with the before-op nullable flag, consumed as an inline
        // aggregated array: the optional `body` leaf surfaces present-as-null in the
        // aggregated element.
        ctx.mockNext({ arr: JSON.stringify([
            { iid: 1, body: null },
            { iid: 2, body: 'Use new tokens' },
        ]) })
        const arr = ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .unionAll(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable().select({ arr }).executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select json_arrayagg(json_object('iid' value a_1_.iid, 'body' value a_1_."body")) from (select id as iid, "body" as "body" from issue where id = :0 union all select id as iid, "body" as "body" from issue where id = :1) a_1_) as "arr" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof row, { arr: Array<{ iid: number; body: string | null }> }>>()
        expect({ arr: [...row.arr].sort((a, b) => a.iid - b.iid) }).toEqual({ arr: [
            { iid: 1, body: null },
            { iid: 2, body: 'Use new tokens' },
        ] })
        const nullRow = row.arr.find(r => r.iid === 1)!
        expect('body' in nullRow).toBe(true)
        expect(nullRow.body).toBe(null)
    })

    test('compound-before-op-intersect-nullable-exec', async () => {
        // `.projectingOptionalValuesAsNullable()` on the arms BEFORE `.intersect(...)`:
        // the compound builder inherits the nullable-projection flag, so the optional
        // `body` leaf surfaces present-as-null through the `intersect` compound (execute-rows path).
        const expected = [
            { iid: 1, body: null },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .intersect(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id in (:0, :1) intersect select id as "iid", "body" as "body" from issue where id = :2 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is PRESENT-null (the before-op flag survives the compound).
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-before-op-intersect-nullable-inline', async () => {
        // Same `intersect` compound with the before-op nullable flag, consumed as an inline
        // aggregated array: the optional `body` leaf surfaces present-as-null in the
        // aggregated element.
        ctx.mockNext({ arr: JSON.stringify([
            { iid: 1, body: null },
        ]) })
        const arr = ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .intersect(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable().select({ arr }).executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select json_arrayagg(json_object('iid' value a_1_.iid, 'body' value a_1_."body")) from (select id as iid, "body" as "body" from issue where id in (:0, :1) intersect select id as iid, "body" as "body" from issue where id = :2) a_1_) as "arr" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof row, { arr: Array<{ iid: number; body: string | null }> }>>()
        expect({ arr: [...row.arr].sort((a, b) => a.iid - b.iid) }).toEqual({ arr: [
            { iid: 1, body: null },
        ] })
        const nullRow = row.arr.find(r => r.iid === 1)!
        expect('body' in nullRow).toBe(true)
        expect(nullRow.body).toBe(null)
    })

    test('compound-before-op-intersectAll-nullable-exec', async () => {
        // `.projectingOptionalValuesAsNullable()` on the arms BEFORE `.intersectAll(...)`:
        // the compound builder inherits the nullable-projection flag, so the optional
        // `body` leaf surfaces present-as-null through the `intersect all` compound (execute-rows path).
        const expected = [
            { iid: 1, body: null },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .intersectAll(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id in (:0, :1) intersect all select id as "iid", "body" as "body" from issue where id = :2 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is PRESENT-null (the before-op flag survives the compound).
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-before-op-intersectAll-nullable-inline', async () => {
        // Same `intersect all` compound with the before-op nullable flag, consumed as an inline
        // aggregated array: the optional `body` leaf surfaces present-as-null in the
        // aggregated element.
        ctx.mockNext({ arr: JSON.stringify([
            { iid: 1, body: null },
        ]) })
        const arr = ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .intersectAll(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable().select({ arr }).executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select json_arrayagg(json_object('iid' value a_1_.iid, 'body' value a_1_."body")) from (select id as iid, "body" as "body" from issue where id in (:0, :1) intersect all select id as iid, "body" as "body" from issue where id = :2) a_1_) as "arr" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof row, { arr: Array<{ iid: number; body: string | null }> }>>()
        expect({ arr: [...row.arr].sort((a, b) => a.iid - b.iid) }).toEqual({ arr: [
            { iid: 1, body: null },
        ] })
        const nullRow = row.arr.find(r => r.iid === 1)!
        expect('body' in nullRow).toBe(true)
        expect(nullRow.body).toBe(null)
    })

    test('compound-before-op-except-nullable-exec', async () => {
        // `.projectingOptionalValuesAsNullable()` on the arms BEFORE `.except(...)`:
        // the compound builder inherits the nullable-projection flag, so the optional
        // `body` leaf surfaces present-as-null through the `except` compound (execute-rows path).
        const expected = [
            { iid: 1, body: null },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .except(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id in (:0, :1) minus select id as "iid", "body" as "body" from issue where id = :2 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is PRESENT-null (the before-op flag survives the compound).
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-before-op-except-nullable-inline', async () => {
        // Same `except` compound with the before-op nullable flag, consumed as an inline
        // aggregated array: the optional `body` leaf surfaces present-as-null in the
        // aggregated element.
        ctx.mockNext({ arr: JSON.stringify([
            { iid: 1, body: null },
        ]) })
        const arr = ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .except(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable().select({ arr }).executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select json_arrayagg(json_object('iid' value a_1_.iid, 'body' value a_1_."body")) from (select id as iid, "body" as "body" from issue where id in (:0, :1) minus select id as iid, "body" as "body" from issue where id = :2) a_1_) as "arr" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof row, { arr: Array<{ iid: number; body: string | null }> }>>()
        expect({ arr: [...row.arr].sort((a, b) => a.iid - b.iid) }).toEqual({ arr: [
            { iid: 1, body: null },
        ] })
        const nullRow = row.arr.find(r => r.iid === 1)!
        expect('body' in nullRow).toBe(true)
        expect(nullRow.body).toBe(null)
    })

    test('compound-before-op-exceptAll-nullable-exec', async () => {
        // `.projectingOptionalValuesAsNullable()` on the arms BEFORE `.exceptAll(...)`:
        // the compound builder inherits the nullable-projection flag, so the optional
        // `body` leaf surfaces present-as-null through the `except all` compound (execute-rows path).
        const expected = [
            { iid: 1, body: null },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .exceptAll(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id in (:0, :1) minus all select id as "iid", "body" as "body" from issue where id = :2 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is PRESENT-null (the before-op flag survives the compound).
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-before-op-exceptAll-nullable-inline', async () => {
        // Same `except all` compound with the before-op nullable flag, consumed as an inline
        // aggregated array: the optional `body` leaf surfaces present-as-null in the
        // aggregated element.
        ctx.mockNext({ arr: JSON.stringify([
            { iid: 1, body: null },
        ]) })
        const arr = ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .exceptAll(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable().select({ arr }).executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select json_arrayagg(json_object('iid' value a_1_.iid, 'body' value a_1_."body")) from (select id as iid, "body" as "body" from issue where id in (:0, :1) minus all select id as iid, "body" as "body" from issue where id = :2) a_1_) as "arr" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof row, { arr: Array<{ iid: number; body: string | null }> }>>()
        expect({ arr: [...row.arr].sort((a, b) => a.iid - b.iid) }).toEqual({ arr: [
            { iid: 1, body: null },
        ] })
        const nullRow = row.arr.find(r => r.iid === 1)!
        expect('body' in nullRow).toBe(true)
        expect(nullRow.body).toBe(null)
    })

    test('compound-before-op-minus-nullable-exec', async () => {
        // `.projectingOptionalValuesAsNullable()` on the arms BEFORE `.minus(...)`:
        // the compound builder inherits the nullable-projection flag, so the optional
        // `body` leaf surfaces present-as-null through the `except (minus alias)` compound (execute-rows path).
        const expected = [
            { iid: 1, body: null },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .minus(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id in (:0, :1) minus select id as "iid", "body" as "body" from issue where id = :2 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is PRESENT-null (the before-op flag survives the compound).
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-before-op-minus-nullable-inline', async () => {
        // Same `except (minus alias)` compound with the before-op nullable flag, consumed as an inline
        // aggregated array: the optional `body` leaf surfaces present-as-null in the
        // aggregated element.
        ctx.mockNext({ arr: JSON.stringify([
            { iid: 1, body: null },
        ]) })
        const arr = ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .minus(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable().select({ arr }).executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select json_arrayagg(json_object('iid' value a_1_.iid, 'body' value a_1_."body")) from (select id as iid, "body" as "body" from issue where id in (:0, :1) minus select id as iid, "body" as "body" from issue where id = :2) a_1_) as "arr" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof row, { arr: Array<{ iid: number; body: string | null }> }>>()
        expect({ arr: [...row.arr].sort((a, b) => a.iid - b.iid) }).toEqual({ arr: [
            { iid: 1, body: null },
        ] })
        const nullRow = row.arr.find(r => r.iid === 1)!
        expect('body' in nullRow).toBe(true)
        expect(nullRow.body).toBe(null)
    })

    test('compound-before-op-minusAll-nullable-exec', async () => {
        // `.projectingOptionalValuesAsNullable()` on the arms BEFORE `.minusAll(...)`:
        // the compound builder inherits the nullable-projection flag, so the optional
        // `body` leaf surfaces present-as-null through the `except all (minus alias)` compound (execute-rows path).
        const expected = [
            { iid: 1, body: null },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .minusAll(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id in (:0, :1) minus all select id as "iid", "body" as "body" from issue where id = :2 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is PRESENT-null (the before-op flag survives the compound).
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-before-op-minusAll-nullable-inline', async () => {
        // Same `except all (minus alias)` compound with the before-op nullable flag, consumed as an inline
        // aggregated array: the optional `body` leaf surfaces present-as-null in the
        // aggregated element.
        ctx.mockNext({ arr: JSON.stringify([
            { iid: 1, body: null },
        ]) })
        const arr = ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable()
            .minusAll(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }).projectingOptionalValuesAsNullable())
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable().select({ arr }).executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select json_arrayagg(json_object('iid' value a_1_.iid, 'body' value a_1_."body")) from (select id as iid, "body" as "body" from issue where id in (:0, :1) minus all select id as iid, "body" as "body" from issue where id = :2) a_1_) as "arr" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof row, { arr: Array<{ iid: number; body: string | null }> }>>()
        expect({ arr: [...row.arr].sort((a, b) => a.iid - b.iid) }).toEqual({ arr: [
            { iid: 1, body: null },
        ] })
        const nullRow = row.arr.find(r => r.iid === 1)!
        expect('body' in nullRow).toBe(true)
        expect(nullRow.body).toBe(null)
    })
    // The existing union tests pin the modifier applied AFTER `.union(...)` (on the
    // compound RESULT). These mirror that AFTER-op form to each remaining compound op:
    // the modifier is applied once on the combined result (the arms carry no flag), and
    // the compound builder still flips the optional `body` leaf to present-`null`. Arms
    // reuse the same id predicates as the before-op siblings so each op yields a
    // deterministic, non-empty result.

    test('compound-after-op-unionAll-nullable-surfaces-null', async () => {
        // `.projectingOptionalValuesAsNullable()` applied AFTER `.unionAll(...)`: the
        // optional `body` leaf surfaces present-as-null on the merged result. Arm 1 =
        // issue 1 (body NULL); arm 2 = issue 2 (body 'Use new tokens').
        const expected = [
            { iid: 1, body: null },
            { iid: 2, body: 'Use new tokens' },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ iid: tIssue.id, body: tIssue.body })
            .unionAll(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }))
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id = :0 union all select id as "iid", "body" as "body" from issue where id = :1 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        // Issue 1's null body is PRESENT-null under the after-op nullable projector.
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-after-op-intersect-nullable-surfaces-null', async () => {
        // `.projectingOptionalValuesAsNullable()` applied AFTER `.intersect(...)`: the
        // optional `body` leaf surfaces present-as-null on the merged result. Arm 1 =
        // issues 1,2; arm 2 = issue 1; the intersection is issue 1 (body NULL).
        const expected = [
            { iid: 1, body: null },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body })
            .intersect(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ iid: tIssue.id, body: tIssue.body }))
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id in (:0, :1) intersect select id as "iid", "body" as "body" from issue where id = :2 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-after-op-intersectAll-nullable-surfaces-null', async () => {
        // `.projectingOptionalValuesAsNullable()` applied AFTER `.intersectAll(...)`: the
        // optional `body` leaf surfaces present-as-null on the merged result. Arm 1 =
        // issues 1,2; arm 2 = issue 1; the intersection is issue 1 (body NULL).
        const expected = [
            { iid: 1, body: null },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body })
            .intersectAll(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ iid: tIssue.id, body: tIssue.body }))
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id in (:0, :1) intersect all select id as "iid", "body" as "body" from issue where id = :2 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-after-op-except-nullable-surfaces-null', async () => {
        // `.projectingOptionalValuesAsNullable()` applied AFTER `.except(...)`: the
        // optional `body` leaf surfaces present-as-null on the merged result. Arm 1 =
        // issues 1,2; arm 2 = issue 2; the difference is issue 1 (body NULL).
        const expected = [
            { iid: 1, body: null },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body })
            .except(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }))
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id in (:0, :1) minus select id as "iid", "body" as "body" from issue where id = :2 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-after-op-exceptAll-nullable-surfaces-null', async () => {
        // `.projectingOptionalValuesAsNullable()` applied AFTER `.exceptAll(...)`: the
        // optional `body` leaf surfaces present-as-null on the merged result. Arm 1 =
        // issues 1,2; arm 2 = issue 2; the difference is issue 1 (body NULL).
        const expected = [
            { iid: 1, body: null },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body })
            .exceptAll(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }))
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id in (:0, :1) minus all select id as "iid", "body" as "body" from issue where id = :2 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-after-op-minus-nullable-surfaces-null', async () => {
        // `.projectingOptionalValuesAsNullable()` applied AFTER `.minus(...)` (the
        // `except` alias): the optional `body` leaf surfaces present-as-null on the
        // merged result. Arm 1 = issues 1,2; arm 2 = issue 2; the difference is issue 1.
        const expected = [
            { iid: 1, body: null },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body })
            .minus(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }))
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id in (:0, :1) minus select id as "iid", "body" as "body" from issue where id = :2 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    test('compound-after-op-minusAll-nullable-surfaces-null', async () => {
        // `.projectingOptionalValuesAsNullable()` applied AFTER `.minusAll(...)` (the
        // `except all` alias): the optional `body` leaf surfaces present-as-null on the
        // merged result. Arm 1 = issues 1,2; arm 2 = issue 2; the difference is issue 1.
        const expected = [
            { iid: 1, body: null },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue).where(tIssue.id.in([1, 2])).select({ iid: tIssue.id, body: tIssue.body })
            .minusAll(ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2)).select({ iid: tIssue.id, body: tIssue.body }))
            .projectingOptionalValuesAsNullable()
            .orderBy('iid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "iid", "body" as "body" from issue where id in (:0, :1) minus all select id as "iid", "body" as "body" from issue where id = :2 order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ iid: number; body: string | null }>>>()
        expect(rows).toEqual(expected)
        expect('body' in rows[0]!).toBe(true)
        expect(rows[0]!.body).toBe(null)
    })

    // The DEFAULT-projector twins of the inline compound cases above. Each is a UNION
    // consumed as an inline aggregated array (`forUseAsInlineAggregatedArrayValue()`)
    // whose element carries a rule-1 (requiredInOptionalObject gate) leaf or a rule-2
    // (left-join originallyRequired) leaf. The inline aggregate runtime is NON-DROPPING,
    // so each element is KEPT; under the default projector a null gate / left-join leaf
    // is ABSENT (dropped) rather than surfacing present-null. This is the R40/R41-sensitive
    // seam: the compound re-projection must carry the inline element's DEFAULT projection
    // (optionals-as-undefined) into the merged array — matching a standalone inline
    // aggregate over the same rule-1/rule-2 leaf.

    test('inline-compound-union-rule-1-gate-leaf-default-drops-gate', async () => {
        // A UNION consumed inline, DEFAULT projector. Each arm projects `{ ref, assigneeId }`
        // where `ref` is a requiredInOptionalObject gate (issue.body) and `assigneeId` an
        // optional leaf. Both leaves are optional in the (all-optional) element; a null
        // `ref`/`assigneeId` is ABSENT under the default projector. Arm 1 = issue 1 (body
        // NULL → ref absent, assignee 1); arm 2 = issue 2 (body present, assignee 2).
        ctx.mockNext({ arr: JSON.stringify([
            { ref: null, assigneeId: 1 },
            { ref: 'Use new tokens', assigneeId: 2 },
        ]) })
        const arr = ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(1))
            .select({ ref: tIssue.body.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId })
            .union(
                ctx.conn.selectFrom(tIssue).where(tIssue.id.equals(2))
                    .select({ ref: tIssue.body.asRequiredInOptionalObject(), assigneeId: tIssue.assigneeId }),
            )
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable().select({ arr }).executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select json_arrayagg(json_object('ref' value a_1_."ref", 'assigneeId' value a_1_.assigneeId)) from (select "body" as "ref", assignee_id as assigneeId from issue where id = :0 union select "body" as "ref", assignee_id as assigneeId from issue where id = :1) a_1_) as "arr" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            arr: Array<{ ref?: string; assigneeId?: number }>
        }>>()
        const sorted = [...row.arr].sort((a, b) => a.assigneeId! - b.assigneeId!)
        expect(sorted).toEqual([
            { assigneeId: 1 },
            { ref: 'Use new tokens', assigneeId: 2 },
        ])
        // Arm 1's null gate `ref` is ABSENT (dropped) under the default projector.
        expect('ref' in sorted[0]!).toBe(false)
    })

    test('inline-compound-union-rule-2-left-join-leaf-default-drops-on-miss', async () => {
        // A UNION consumed inline, DEFAULT projector. Each arm left-joins app_user and
        // projects the sole originallyRequired left-join leaf `name` (rule-2). On a join
        // miss the non-dropping inline runtime keeps the element and OMITS `name` under
        // the default projector. Arm 1 = issue 1 (assignee 1 → name present); arm 2 =
        // issue 3 (assignee NULL → name dropped, element kept as `{}`).
        ctx.mockNext({ arr: JSON.stringify([
            { name: 'Ada Lovelace' },
            { name: null },
        ]) })
        const tAssignee = tAppUser.forUseInLeftJoin()
        const arr = ctx.conn.selectFrom(tIssue)
            .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
            .where(tIssue.id.equals(1))
            .select({ name: tAssignee.fullName })
            .union(
                ctx.conn.selectFrom(tIssue)
                    .leftJoin(tAssignee).on(tAssignee.id.equals(tIssue.assigneeId))
                    .where(tIssue.id.equals(3))
                    .select({ name: tAssignee.fullName }),
            )
            .forUseAsInlineAggregatedArrayValue()
        const row = await ctx.conn.selectFromNoTable().select({ arr }).executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select (select json_arrayagg(json_object('name' value a_1_.name)) from (select app_user.full_name as name from issue left join app_user on app_user.id = issue.assignee_id where issue.id = :0 union select app_user.full_name as name from issue left join app_user on app_user.id = issue.assignee_id where issue.id = :1) a_1_) as "arr" from dual"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
          ]
        `)
        assertType<Exact<typeof row, {
            arr: Array<{ name?: string }>
        }>>()
        // The join-miss element is KEPT as `{}` with `name` ABSENT under default.
        const sorted = [...row.arr].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
        expect(sorted).toEqual([{}, { name: 'Ada Lovelace' }])
        const missElement = row.arr.find(e => !('name' in e))!
        expect('name' in missElement).toBe(false)
    })

})
