// Merge-optional numeric and boolean operators realizing their NULL/absent
// runtime inhabitant: a plain `col.add(optionalCol)` where the optional operand
// is NULL, a 3-valued boolean `required.and(optional)` where the optional is
// NULL, the varargs membership predicate `inN`/`notInN`, whose optionality
// merges the receiver with every ELEMENT (both arms: an optional element and an
// all-required list), and the opposite case — the null-safe `is`/`isNot` family
// and its `*IfValue` twins, which stay REQUIRED over an OPTIONAL receiver
// because they answer over a NULL instead of propagating it. These use the
// existing NULL seed values (worklog 2 has NULL `minutes`; worklog 3 has NULL
// `billable` with activity 'meeting'), so no UPDATE is needed and every row is
// real-DB-validatable.
//
// Seed facts (issue_worklog):
//   worklog 1 — issue 1, minutes 90, activity 'coding',  billable TRUE
//   worklog 2 — issue 2, minutes NULL, activity 'review', billable FALSE
//   worklog 3 — issue 1, minutes 30, activity 'meeting', billable NULL

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssueWorklog, tAppUser, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('optional-plus-optional-stays-optional-and-realizes-both-inhabitants', async () => {
        // The `optional x optional -> optional` cell. `minutes.add(minutes)` has
        // two OPTIONAL operands (the same optional int column), so the result is
        // optional. worklog 1 (minutes 90) realizes the present value 180;
        // worklog 2 (minutes NULL) realizes the NULL inhabitant -> the leaf is
        // absent under the default projector.
        const expected = [{ id: 1, sum: 180 }, { id: 2 }]
        ctx.mockNext([{ id: 1, sum: 180 }, { id: 2, sum: null }])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.in([1, 2]))
            .select({
                id:  tIssueWorklog.id,
                sum: tIssueWorklog.minutes.add(tIssueWorklog.minutes),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, minutes + minutes as sum from issue_worklog where id in (?1, ?2) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; sum?: number }>>>()
        expect(rows).toEqual(expected)
        // The NULL-operand row drops the key entirely (absent, not present-undefined).
        expect('sum' in rows[1]!).toBe(false)
    })

    test('required-plus-optional-realizes-the-null-inhabitant', async () => {
        // A plain `col.add(optionalCol)` merge-optional binary op. issueId
        // (required int) + minutes (optional int) -> optional int. worklog 1:
        // 1 + 90 = 91 (present); worklog 2: 2 + NULL = NULL -> absent.
        const expected = [{ id: 1, total: 91 }, { id: 2 }]
        ctx.mockNext([{ id: 1, total: 91 }, { id: 2, total: null }])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.in([1, 2]))
            .select({
                id:    tIssueWorklog.id,
                total: tIssueWorklog.issueId.add(tIssueWorklog.minutes),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, issue_id + minutes as total from issue_worklog where id in (?1, ?2) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; total?: number }>>>()
        expect(rows).toEqual(expected)
        expect('total' in rows[1]!).toBe(false)
    })

    test('merged-optional-boolean-three-valued-null-default-drops-key', async () => {
        // Default projector: a merged-optional 3-valued boolean.
        // `activity.equals('meeting')` (required, TRUE for worklog 3) `.and(billable)`
        // (optional, NULL for worklog 3) -> `TRUE AND NULL = NULL` (SQL 3-valued
        // logic). The merged leaf is optional and the NULL result drops the key.
        const expected = [{ id: 3 }]
        ctx.mockNext([{ id: 3, flag: null }])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(3))
            .select({
                id:   tIssueWorklog.id,
                flag: tIssueWorklog.activity.equals('meeting').and(tIssueWorklog.billable),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, activity = ?1 and billable as flag from issue_worklog where id = ?2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "meeting",
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; flag?: boolean }>>>()
        expect(rows).toEqual(expected)
        expect('flag' in rows[0]!).toBe(false)
    })

    test('merged-optional-boolean-three-valued-null-as-nullable-surfaces-null', async () => {
        // projectingOptionalValuesAsNullable: the same `TRUE AND NULL = NULL`
        // merged boolean, but under the as-nullable projector the NULL surfaces as
        // a present `null` leaf instead of being dropped.
        const expected = [{ id: 3, flag: null }]
        ctx.mockNext([{ id: 3, flag: null }])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(3))
            .select({
                id:   tIssueWorklog.id,
                flag: tIssueWorklog.activity.equals('meeting').and(tIssueWorklog.billable),
            })
            .projectingOptionalValuesAsNullable()
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, activity = ?1 and billable as flag from issue_worklog where id = ?2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "meeting",
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; flag: boolean | null }>>>()
        expect(rows).toEqual(expected)
        expect(rows[0]!.flag).toBeNull()
    })

    test('in-n-with-an-optional-element-is-optional-and-realizes-the-null-inhabitant', async () => {
        // `inN`/`notInN` take VARARGS, and the optionality merges the receiver
        // with EVERY element, not the receiver alone: `issue_id in (99, minutes)`
        // carries an optional element, so by SQL's three-valued logic the
        // predicate is NULL -- not false -- when nothing matches and `minutes` is
        // NULL. worklog 1 (issueId 1, minutes 90) matches nothing and both
        // operands are present -> false/true; worklog 2 (issueId 2, minutes NULL)
        // realizes the NULL inhabitant -> both leaves are absent.
        const expected = [{ id: 1, hit: false, miss: true }, { id: 2 }]
        ctx.mockNext([{ id: 1, hit: false, miss: true }, { id: 2, hit: null, miss: null }])
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.in([1, 2]))
            .select({
                id:   tIssueWorklog.id,
                hit:  tIssueWorklog.issueId.inN(99, tIssueWorklog.minutes),
                miss: tIssueWorklog.issueId.notInN(99, tIssueWorklog.minutes),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, issue_id in (?1, minutes) as hit, issue_id not in (?2, minutes) as miss from issue_worklog where id in (?3, ?4) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            99,
            99,
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; hit?: boolean; miss?: boolean }>>>()
        expect(rows).toEqual(expected)
        expect('hit' in rows[1]!).toBe(false)
        expect('miss' in rows[1]!).toBe(false)
    })

    test('in-n-with-only-required-operands-stays-required', async () => {
        // The other arm of the same merge: every operand of
        // `issue_id in (99, id)` is present-by-type, so the predicate can never
        // be NULL and the leaf stays REQUIRED -- a plain boolean, present on
        // every row. worklog 1 (issueId 1, id 1) and worklog 2 (issueId 2, id 2)
        // match their own id -> true; worklog 3 (issueId 1, id 3) -> false.
        const expected = [
            { id: 1, hit: true,  miss: false },
            { id: 2, hit: true,  miss: false },
            { id: 3, hit: false, miss: true  },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.in([1, 2, 3]))
            .select({
                id:   tIssueWorklog.id,
                hit:  tIssueWorklog.issueId.inN(99, tIssueWorklog.id),
                miss: tIssueWorklog.issueId.notInN(99, tIssueWorklog.id),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, issue_id in (?1, id) as hit, issue_id not in (?2, id) as miss from issue_worklog where id in (?3, ?4, ?5) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            99,
            99,
            1,
            2,
            3,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; hit: boolean; miss: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-and-is-not-over-an-optional-receiver-project-a-required-boolean', async () => {
        // `is`/`isNot` are the null-safe comparison: they answer true or false
        // even when an operand is NULL, so the projected leaf is REQUIRED
        // whatever the receiver is -- unlike `equals`/`notEquals`, which carry
        // the receiver's optionality through and would drop the key on a NULL
        // row. worklog 1 (minutes 90) -> same=true, diff=false; worklog 2
        // (minutes NULL) -> the comparison still answers, same=false and
        // diff=true, both present.
        const expected = [
            { id: 1, same: true,  diff: false },
            { id: 2, same: false, diff: true  },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.in([1, 2]))
            .select({
                id:   tIssueWorklog.id,
                same: tIssueWorklog.minutes.is(90),
                diff: tIssueWorklog.minutes.isNot(90),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, minutes is ?1 as same, minutes is not ?2 as diff from issue_worklog where id in (?3, ?4) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            90,
            90,
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; same: boolean; diff: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-if-value-projects-a-required-boolean-with-and-without-an-operand', async () => {
        // The dynamic twins of that same total predicate are REQUIRED on both
        // arms: the comparison `isIfValue(90)` builds, and the neutral
        // `isNotIfValue(undefined)` becomes -- a neutral stands for the
        // expression it replaces, and that expression never yields NULL either.
        // `trueWhenNoValue()` leaves the condition world so the boolean can be
        // projected, carrying the condition's optionality through. worklog 1
        // (minutes 90) -> same=true; worklog 2 (minutes NULL) -> same=false;
        // `noOperand` got no operand at all, so it is the substituted true on
        // every row.
        const expected = [
            { id: 1, same: true,  noOperand: true },
            { id: 2, same: false, noOperand: true },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.in([1, 2]))
            .select({
                id:        tIssueWorklog.id,
                same:      tIssueWorklog.minutes.isIfValue(90).trueWhenNoValue(),
                noOperand: tIssueWorklog.minutes.isNotIfValue(undefined).trueWhenNoValue(),
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, minutes is ?1 as same, 1 as noOperand from issue_worklog where id in (?2, ?3) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            90,
            1,
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; same: boolean; noOperand: boolean }>>>()
        expect(rows).toEqual(expected)
    })

    test('concat-ignoring-null-with-a-required-in-optional-object-operand-gates-its-object', async () => {
        // A left-join operand merged with a required-in-optional-object one stays
        // required-in-optional-object: `note` is optional and drops only when the
        // concatenation is empty (issue 3: no assignee, no body).
        const expected = [
            { id: 1, note: { text: 'Ada Lovelace: ' } },
            { id: 2, note: { text: 'Grace Hopper: Use new tokens' } },
            { id: 3 },
            { id: 4, note: { text: 'Alan Turing: See ADR-014' } },
        ]
        ctx.mockNext([
            { id: 1, 'note.text': 'Ada Lovelace: ' },
            { id: 2, 'note.text': 'Grace Hopper: Use new tokens' },
            { id: 3, 'note.text': '' },
            { id: 4, 'note.text': 'Alan Turing: See ADR-014' },
        ])
        const assignee = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:   tIssue.id,
                note: { text: assignee.fullName.concat(': ').concatIgnoringNull(tIssue.body.asRequiredInOptionalObject()) },
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, coalesce((app_user.full_name || ?1), '') || coalesce(issue.body, '') as "note.text" from issue left join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            ": ",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; note?: { text: string } }>>>()
        expect(rows).toEqual(expected)
    })

    test('concat-ignoring-null-of-two-left-join-operands-stays-originally-required', async () => {
        // Both operands come from the same left join, so the object follows the
        // same-left-join rule: present while the join hits, dropped on issue 3.
        const expected = [
            { id: 1, contact: { line: 'Ada Lovelace ada@acme.test' } },
            { id: 2, contact: { line: 'Grace Hopper grace@acme.test' } },
            { id: 3 },
            { id: 4, contact: { line: 'Alan Turing alan@globex.test' } },
        ]
        ctx.mockNext([
            { id: 1, 'contact.line': 'Ada Lovelace ada@acme.test' },
            { id: 2, 'contact.line': 'Grace Hopper grace@acme.test' },
            { id: 3, 'contact.line': '' },
            { id: 4, 'contact.line': 'Alan Turing alan@globex.test' },
        ])
        const assignee = tAppUser.forUseInLeftJoin()
        const rows = await ctx.conn.selectFrom(tIssue)
            .leftJoin(assignee).on(assignee.id.equals(tIssue.assigneeId))
            .select({
                id:      tIssue.id,
                contact: { line: assignee.fullName.concat(' ').concatIgnoringNull(assignee.email) },
            })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as id, coalesce((app_user.full_name || ?1), '') || coalesce(app_user.email, '') as "contact.line" from issue left join app_user on app_user.id = issue.assignee_id order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            " ",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; contact?: { line: string } }>>>()
        expect(rows).toEqual(expected)
    })
})
