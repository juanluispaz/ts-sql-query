// The WRITE-side remap of `CustomBooleanTypeAdapter` columns: what
// `update(...).set({ <adapter column>: <value> })` emits. The assigned value is
// re-encoded into the literals the target column stores, and the shape of that
// re-encoding depends on WHAT the value is — a column carrying the same mapping,
// a column carrying a different one, a plain boolean column, a boolean
// expression, or a plain literal. A column that already stores the target's own
// literals short-circuits to the bare column name; the other four kinds each
// split by whether the TARGET column is required or optional, for nine forms in
// total. An optional target always gets a third `else null` arm so a NULL source
// is stored as NULL instead of collapsing to the false literal. The two
// required-target forms fed by a differently-mapped column and by a boolean
// expression are already pinned by the select-side custom-boolean coverage in
// this cell, so they are not repeated here.
//
// Custom-boolean columns in this domain and the literals they store:
//   - organization.verified / app_user.verified — required, 'Y' / 'N' (one shared mapping)
//   - project.published                         — required, 't' / 'f'
//   - issue_worklog.invoiced                    — required, 1 / 0 (numeric adapter)
//   - issue_worklog.approved                    — OPTIONAL, 'A' / 'R'
// issue_worklog.billable is a plain optional boolean (no adapter) whose seeded
// values already agree with approved row by row; col_matrix.m_bool is the
// domain's only plain REQUIRED boolean.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tColMatrixColumn, tIssueWorklog, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('custom-boolean-remap/a-column-with-the-same-literals-emits-the-raw-column-name', async () => {
        // organization.verified and app_user.verified are two different columns
        // that store the same 'Y' / 'N' pair, so the source value is already in
        // the target's encoding and no re-encoding is emitted at all — the SET
        // right-hand side is the bare column name. There is no foreign key
        // between the two tables, so the rows are picked by id: organization 2
        // ('N') takes user 1's 'Y'.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.update(tOrganization)
                .from(tAppUser)
                .set({ verified: tAppUser.verified })
                .where(tOrganization.id.equals(2))
                .and(tAppUser.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update organization set verified = app_user.verified from app_user where organization.id = ? and app_user.id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('custom-boolean-remap/a-column-with-different-literals-to-an-optional-target-emits-case-source-when-mapped-else-null', async () => {
        // The optional target matches the source column against BOTH of the
        // source's literals and falls through to NULL, so a NULL source is
        // preserved rather than read as false. invoiced (1 / 0) re-encodes into
        // approved ('A' / 'R'); worklog 3 is invoiced 1 with approved NULL, so it
        // becomes 'A'.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.update(tIssueWorklog)
                .set({ approved: tIssueWorklog.invoiced })
                .where(tIssueWorklog.id.equals(3))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue_worklog set approved = case invoiced when 1 then 'A' when 0 then 'R' else null end where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                3,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('custom-boolean-remap/a-plain-boolean-column-to-a-required-target-emits-case-when-value-then-true-else-false', async () => {
        // A plain boolean column carries no adapter, so it is already a truth
        // value: it is tested as a condition and the target's literals are picked
        // from it. col_matrix is scaffolding — a fixture table holding one row per
        // column kind — and it is joined on nothing but its own id because no
        // required plain boolean shares a table with a required custom-boolean
        // column. Its m_bool is true, so organization 2 goes from 'N' to 'Y'.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.update(tOrganization)
                .from(tColMatrixColumn)
                .set({ verified: tColMatrixColumn.mBool })
                .where(tOrganization.id.equals(2))
                .and(tColMatrixColumn.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update organization set verified = case when col_matrix.m_bool then 'Y' else 'N' end from col_matrix where organization.id = ? and col_matrix.id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('custom-boolean-remap/a-plain-boolean-column-to-an-optional-target-emits-case-value-when-true-value-else-null', async () => {
        // The optional target compares the plain boolean column against the
        // dialect's own true / false spelling and falls through to NULL, so a NULL
        // source would stay NULL. The source is col_matrix.m_bool (true, and
        // joined on its own id as above) rather than issue_worklog.billable, whose
        // seeded values already equal approved on every row and would make the
        // write invisible. Worklogs 2 ('R') and 3 (NULL) both flip to 'A'; worklog
        // 1 is outside the WHERE and keeps its seeded 'A', so the read-back
        // separates the rewritten rows from the untouched one.
        await ctx.withRollback(async () => {
            ctx.mockNext(2)
            const affected = await ctx.conn.update(tIssueWorklog)
                .from(tColMatrixColumn)
                .set({ approved: tColMatrixColumn.mBool })
                .where(tIssueWorklog.id.in([2, 3]))
                .and(tColMatrixColumn.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue_worklog set approved = case col_matrix.m_bool when 1 then 'A' when 0 then 'R' else null end from col_matrix where issue_worklog.id in (?, ?) and col_matrix.id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                2,
                3,
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(2)

            const expected = [
                { id: 1, approved: true },
                { id: 2, approved: true },
                { id: 3, approved: true },
            ]
            ctx.mockNext(expected)
            const rows = await ctx.conn.selectFrom(tIssueWorklog)
                .select({ id: tIssueWorklog.id, approved: tIssueWorklog.approved })
                .orderBy('id')
                .executeSelectMany()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, (approved = 'A') as approved from issue_worklog order by id"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
            assertType<Exact<typeof rows, Array<{ id: number; approved?: boolean }>>>()
            expect(rows).toEqual(expected)
        })
    })

    test('custom-boolean-remap/a-parenthesised-boolean-expression-to-an-optional-target-emits-case-when-expression-when-not-expression-else-null', async () => {
        // The optional target renders the expression TWICE — plainly for the true
        // arm and behind `not` for the false arm — so its param is bound twice.
        // The parentheses the false arm puts around a comparison are cosmetic:
        // `not` binds looser than `>` in every target dialect. PostgreSQL's remap
        // emits that second copy unparenthesised, so on that cell this test and
        // the null-check one below produce the same shape and the pair pins
        // nothing there. Worklog 2 has minutes NULL, so neither arm holds and the
        // `else null` arm replaces the seeded 'R' with NULL.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.update(tIssueWorklog)
                .set({ approved: tIssueWorklog.minutes.greaterThan(60) })
                .where(tIssueWorklog.id.equals(2))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue_worklog set approved = case when minutes > ? then 'A' when not (minutes > ?) then 'R' else null end where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                60,
                60,
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('custom-boolean-remap/an-unparenthesised-boolean-expression-to-an-optional-target-repeats-the-expression-bare', async () => {
        // Same optional target, but a null check is never parenthesised behind
        // `not`, so the false arm repeats the expression bare. Worklog 1 has
        // duration_ms set, so the false arm wins and approved goes from 'A' to 'R'.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.update(tIssueWorklog)
                .set({ approved: tIssueWorklog.durationMs.isNull() })
                .where(tIssueWorklog.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue_worklog set approved = case when duration_ms is null then 'A' when not duration_ms is null then 'R' else null end where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('custom-boolean-remap/a-boolean-literal-to-a-required-target-emits-case-when-param-then-true-else-false', async () => {
        // A plain `true` rides as a bound param in the dialect's own boolean
        // spelling and the case picks the stored literal from it — the param
        // itself is never rewritten into 'Y'. Organization 2 goes from 'N' to 'Y'.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.update(tOrganization)
                .set({ verified: true })
                .where(tOrganization.id.equals(2))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update organization set verified = case when ? then 'Y' else 'N' end where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                1,
                2,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })

    test('custom-boolean-remap/a-boolean-literal-to-an-optional-target-emits-case-param-when-true-value-else-null', async () => {
        // The optional target matches the bound param against the dialect's true
        // and false spelling, so a null param would fall through to the `else
        // null` arm instead of being stored as the false literal. Worklog 1 goes
        // from 'A' to 'R'.
        await ctx.withRollback(async () => {
            ctx.mockNext(1)
            const affected = await ctx.conn.update(tIssueWorklog)
                .set({ approved: false })
                .where(tIssueWorklog.id.equals(1))
                .executeUpdate()

            expect(ctx.lastSql).toMatchInlineSnapshot(`"update issue_worklog set approved = case ? when 1 then 'A' when 0 then 'R' else null end where id = ?"`)
            expect(ctx.lastParams).toMatchInlineSnapshot(`
              [
                0,
                1,
              ]
            `)
            assertType<Exact<typeof affected, number>>()
            expect(affected).toBe(1)
        })
    })
})
