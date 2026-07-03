// Coverage of boolean-expression composition: `.and()`, `.or()`,
// `.negate()` (logical NOT — different from the arithmetic negation
// in numeric ops which is just `multiply(-1)`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tIssueWorklog } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('and', async () => {
        const expected = [{ id: 1 }]  // status=open AND priority=2 → issue 1
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open').and(tIssue.priority.equals(2)))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where status = $1 and priority = $2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('or', async () => {
        const expected = [{ id: 2 }, { id: 4 }]  // priority=1 OR status=closed
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.equals(1).or(tIssue.status.equals('closed')))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority = $1 or status = $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "closed",
          ]
        `)
        expect(result).toEqual(expected)
    })

    test('negate-not', async () => {
        // NOT (status = 'open') → 2 (in_progress) + 4 (closed)
        const expected = [{ id: 2 }, { id: 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open').negate())
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where not (status = $1) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        expect(result).toEqual(expected)
    })

    test('and-or-complex', async () => {
        // (priority<=2 AND status='open') OR status='closed'
        const expected = [{ id: 1 }, { id: 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(
                tIssue.priority.lessOrEqual(2)
                    .and(tIssue.status.equals('open'))
                    .or(tIssue.status.equals('closed')),
            )
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where (priority <= $1 and status = $2) or status = $3 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            "open",
            "closed",
          ]
        `)
        expect(result).toEqual(expected)
    })

    // ── A plain (non-adapter) native-boolean COLUMN as a combinator receiver ──
    // `issue_worklog.billable` is a plain nullable boolean (no CustomBooleanTypeAdapter).
    // Used directly as a BooleanValueSource receiver of `.negate()` / `.and()` /
    // `.or()` / `.onlyWhen()` / `.ignoreWhen()`, it renders the bare column
    // predicate for the dialect (native `billable` where the engine has a boolean
    // type, `billable = 1` where it does not). Seed billable: worklog 1 TRUE,
    // 2 FALSE, 3 NULL.

    test('plain-boolean-column-negated', async () => {
        // `billable.negate()` negates the plain boolean predicate. Worklog 2
        // (FALSE) matches; 1 (TRUE) fails; 3 (NULL → NOT NULL = NULL) is excluded.
        const expected = [{ id: 2 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.negate())
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where not billable order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })

    test('plain-boolean-column-as-and-receiver', async () => {
        // `billable.and(id.greaterThan(0))` → `billable and id > $1`. Only worklog
        // 1 (TRUE, id > 0) matches.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.and(tIssueWorklog.id.greaterThan(0)))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billable and id > $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            0,
          ]
        `)
        expect(result).toEqual(expected)
    })

    test('plain-boolean-column-as-or-receiver', async () => {
        // `billable.or(id.greaterThan(2))` → `billable or id > $1`. Worklog 1
        // (TRUE) via the first arm; worklog 3 (NULL or 3 > 2 = TRUE) via the
        // second; worklog 2 (FALSE or 2 > 2 = FALSE) stays out.
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.or(tIssueWorklog.id.greaterThan(2)))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billable or id > $1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        expect(result).toEqual(expected)
    })

    test('plain-boolean-column-kept-by-only-when', async () => {
        // `billable.onlyWhen(true)` keeps the bare predicate. Worklog 1 (TRUE)
        // matches.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.onlyWhen(true))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billable order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(result).toEqual(expected)
    })

    test('plain-boolean-column-kept-by-ignore-when', async () => {
        // `billable.ignoreWhen(false)` keeps the bare predicate (inverse of
        // onlyWhen). Worklog 1 (TRUE) matches.
        const expected = [{ id: 1 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.billable.ignoreWhen(false))
            .select({ id: tIssueWorklog.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where billable order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(result).toEqual(expected)
    })
})
