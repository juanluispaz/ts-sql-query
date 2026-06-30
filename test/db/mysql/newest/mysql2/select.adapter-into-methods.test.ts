// Adapter-bearing columns fed into a NON-`equals` method of their
// value-source type. The existing adapter coverage
// (`select.column-adapter-non-boolean.test.ts`,
// `select.adapter-operand-positions.test.ts`,
// `select.custom-boolean-remap.test.ts`) only exercises these columns via
// `.equals(...)` / bare projection. The per-column `TypeAdapter` provably
// propagates to:
//   - the BOUND OPERAND of a numeric/string method (the column adapter is
//     threaded to the literal via `getTypeAdapter*`), and
//   - the RESULT LEAF of a value-returning transform (`add`, `toLowerCase`,
//     …) which inherits the column's `transformValueFromDB`.
// Both are value-observable: the bound param is mock-visible, the read
// transform runs on the mock-primed RAW value, and the real engine confirms
// the arithmetic/string op end-to-end.
//
// Fixtures (seed, postgres/domain/seed.sql):
//   - project_review 1: reviewer_code 'R-7A2' (bracketAdapter, read '[...]'),
//     score 850 raw (scaledTenthAdapter, read ÷10 → 85, write ×10).
//   - invoice: invoice_no 100 raw (scaledTenthAdapter PK, read ÷10 → 10).
//   - project 1: published 't' (CustomBooleanTypeAdapter 't'/'f' → true).
//   - issue_worklog 1: invoiced 1 (numeric CustomBooleanTypeAdapter 1/0 → true).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tInvoice, tIssue, tIssueWorklog, tProject, tProjectReview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('adapter-int-column-into-numeric-add-scales-operand-and-result', async () => {
        // `score.add(5)` threads the scaledTenthAdapter to the bound operand,
        // so 5 binds as the scaled 50; the computed result leaf inherits the
        // read adapter, so (raw 850 + 50 = 900) reads ÷10 → 90 (= 85 + 5).
        const expected = { id: 1, bumped: 90 }
        ctx.mockNext({ id: 1, bumped: 900 })
        const row = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.id.equals(1))
            .select({ id: tProjectReview.id, bumped: tProjectReview.score.add(5) })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, score + ? as bumped from project_review where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; bumped: number }>>()
        expect(row).toEqual(expected)
    })

    test('adapter-provided-pk-column-into-numeric-add-scales-operand-and-result', async () => {
        // `invoiceNo` is a caller-provided primary key carrying the same
        // scaledTenthAdapter. Fed into `add(5)` the operand binds the scaled
        // 50; the result leaf reads ÷10 → 15 (raw 100 + 50 = 150 → 15 = 10 + 5).
        const expected = { invoiceNo: 10, next: 15 }
        ctx.mockNext({ invoiceNo: 100, next: 150 })
        const row = await ctx.conn.selectFrom(tInvoice)
            .where(tInvoice.invoiceNo.equals(10))
            .select({ invoiceNo: tInvoice.invoiceNo, next: tInvoice.invoiceNo.add(5) })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select invoice_no as invoiceNo, invoice_no + ? as \`next\` from invoice where invoice_no = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            50,
            100,
          ]
        `)
        assertType<Exact<typeof row, { invoiceNo: number; next: number }>>()
        expect(row).toEqual(expected)
    })

    test('adapter-string-column-into-to-lower-case-keeps-result-leaf-bracketed', async () => {
        // `reviewerCode.toLowerCase()` produces a value-returning transform
        // whose result leaf inherits bracketAdapter, so the lowered DB value
        // 'r-7a2' is read bracketed → '[r-7a2]'. (toLowerCase also makes the
        // string op observable since the seed value is upper-case.)
        const expected = { id: 1, code: '[r-7a2]' }
        ctx.mockNext({ id: 1, code: 'r-7a2' })
        const row = await ctx.conn.selectFrom(tProjectReview)
            .where(tProjectReview.id.equals(1))
            .select({ id: tProjectReview.id, code: tProjectReview.reviewerCode.toLowerCase() })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, lower(reviewer_code) as \`code\` from project_review where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; code: string }>>()
        expect(row).toEqual(expected)
    })

    test('adapter-string-column-into-starts-with-predicate-in-join-on', async () => {
        // `reviewerCode.startsWith('R-')` is a string PREDICATE on an
        // adapter-bearing column, placed OUTSIDE the top-level WHERE (in the
        // JOIN ON). Review 1's reviewer_code 'R-7A2' starts with 'R-' so
        // project 1 joins; the projected reviewer_code still reads bracketed.
        const expected = [{ projectId: 1, reviewer: '[R-7A2]' }]
        ctx.mockNext([{ projectId: 1, reviewer: 'R-7A2' }])
        const rows = await ctx.conn.selectFrom(tProject)
            .innerJoin(tProjectReview).on(
                tProjectReview.projectId.equals(tProject.id)
                    .and(tProjectReview.reviewerCode.startsWith('R-')),
            )
            .where(tProject.id.equals(1))
            .select({ projectId: tProject.id, reviewer: tProjectReview.reviewerCode })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as projectId, project_review.reviewer_code as reviewer from project inner join project_review on project_review.project_id = project.id and project_review.reviewer_code like concat(?, '%') where project.id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "R-",
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ projectId: number; reviewer: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('custom-boolean-string-column-as-equals-if-value-receiver', async () => {
        // `published.equalsIfValue(true)` — the receiver is a custom-boolean
        // column (t/f) and `true` passes `_isValue`, so the predicate is
        // active; the adapter remaps the comparison to the column's stored
        // representation. Project 1 (published 't') matches.
        const expected = [{ id: 1, name: 'Marketing site' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
                .and(tProject.published.equalsIfValue(true))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\` from project where id = ? and (published = 't') = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            true,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('custom-boolean-numeric-column-as-is-if-value-receiver', async () => {
        // `invoiced.isIfValue(true)` — the receiver is a NUMERIC custom-boolean
        // column (1/0) and `is` is the null-safe equality; `true` passes
        // `_isValue` so the predicate is active and the adapter remaps the
        // comparison to the stored int. Worklog 1 (invoiced 1) matches.
        const expected = [{ id: 1, issueId: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
                .and(tIssueWorklog.invoiced.isIfValue(true))
            .select({ id: tIssueWorklog.id, issueId: tIssueWorklog.issueId })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, issue_id as issueId from issue_worklog where id = ? and (invoiced = 1) <=> ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            true,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; issueId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('custom-boolean-numeric-column-equals-predicate-in-join-on', async () => {
        // `invoiced.equals(true)` — a NUMERIC custom-boolean predicate with a
        // value operand, placed OUTSIDE the top-level WHERE (in the JOIN ON).
        // The adapter maps `true` to the stored 1. Worklogs 1 and 3 (both
        // invoiced 1, both on issue 1) match, so issue 1 joins.
        const expected = [{ issueId: 1, worklogId: 1 }, { issueId: 1, worklogId: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .innerJoin(tIssueWorklog).on(
                tIssueWorklog.issueId.equals(tIssue.id)
                    .and(tIssueWorklog.invoiced.equals(true)),
            )
            .where(tIssue.id.equals(1))
            .select({ issueId: tIssue.id, worklogId: tIssueWorklog.id })
            .orderBy('worklogId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select issue.id as issueId, issue_worklog.id as worklogId from issue inner join issue_worklog on issue_worklog.issue_id = issue.id and (issue_worklog.invoiced = 1) = ? where issue.id = ? order by worklogId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            true,
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ issueId: number; worklogId: number }>>>()
        expect(rows).toEqual(expected)
    })

    // ELIDE twins of the two custom-boolean `*IfValue` receivers above. The
    // `*IfValue` impl short-circuits (`if (!_isValue) return ''`) BEFORE the
    // adapter remap, so an absent value emits NO clause at all — the
    // `(published = 't')` / `(invoiced = 1)` remap never runs. This is a
    // genuinely distinct emission from the present-value half (which the two
    // tests above pin), so it is asserted on its own.

    test('custom-boolean-string-column-as-equals-if-value-receiver-elided', async () => {
        // `published.equalsIfValue(undefined)` — `undefined` fails `_isValue`, so
        // the predicate is dropped entirely BEFORE the custom-boolean adapter
        // could remap it. The WHERE is left with only the `id` clause: NO
        // `(published = 't') = $n` fragment is emitted.
        const expected = [{ id: 1, name: 'Marketing site' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
                .and(tProject.published.equalsIfValue(undefined))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\` from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('custom-boolean-numeric-column-as-is-if-value-receiver-elided', async () => {
        // `invoiced.isIfValue(undefined)` — `undefined` fails `_isValue`, so the
        // null-safe predicate is dropped BEFORE the numeric custom-boolean adapter
        // could remap it. The WHERE keeps only the `id` clause: NO
        // `(invoiced = 1) is not distinct from $n` fragment is emitted.
        const expected = [{ id: 1, issueId: 1 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
                .and(tIssueWorklog.invoiced.isIfValue(undefined))
            .select({ id: tIssueWorklog.id, issueId: tIssueWorklog.issueId })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, issue_id as issueId from issue_worklog where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; issueId: number }>>>()
        expect(rows).toEqual(expected)
    })

    // FIRE + ELIDE for the custom-boolean `notEqualsIfValue` receiver — the
    // remaining IfValue arm on a custom-boolean column (the equals/is arms are
    // covered above). Fire remaps to `(published = 't') <> $n`; elide drops it.

    test('custom-boolean-string-column-as-not-equals-if-value-receiver', async () => {
        // `published.notEqualsIfValue(false)` — `false` passes `_isValue`, so the
        // predicate fires and the adapter remaps the comparison to the stored
        // representation. Project 1 (published 't' → true) is `<>` false → matches.
        const expected = [{ id: 1, name: 'Marketing site' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
                .and(tProject.published.notEqualsIfValue(false))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\` from project where id = ? and (published = 't') <> ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            false,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('custom-boolean-string-column-as-not-equals-if-value-receiver-elided', async () => {
        // `published.notEqualsIfValue(undefined)` — `undefined` fails `_isValue`,
        // so the predicate is dropped BEFORE the adapter remap. The WHERE keeps
        // only the `id` clause: NO `(published = 't') <> $n` fragment is emitted.
        const expected = [{ id: 1, name: 'Marketing site' }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tProject)
            .where(tProject.id.equals(1))
                .and(tProject.published.notEqualsIfValue(undefined))
            .select({ id: tProject.id, name: tProject.name })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, \`name\` as \`name\` from project where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })
})
