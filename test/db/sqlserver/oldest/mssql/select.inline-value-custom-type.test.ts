// A scalar subquery selecting a CUSTOM / branded column (customComparable 'Semver',
// customUuid 'SigningKey', customDouble 'Money', customInt 'Cents') wrapped via
// `forUseAsInlineQueryValue()` and fed back to the SAME-branded column's `.equals(...)`.
// The comparison only type-checks if the wrapper preserves the brand (a different
// brand would not compile). Each comparison is a column-equals-itself-via-inline-
// subquery, so the boolean is a deterministic `true` on every dialect — no raw custom
// value is asserted, avoiding uuid-casing / float-format divergence across engines.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssueWorklog, tProjectRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('inline-value-keeps-custom-comparable-and-uuid-brand', async () => {
        // customComparable 'Semver' (version, required) and customUuid
        // 'SigningKey' (signing_key, optional) pushed through
        // forUseAsInlineQueryValue and compared back to their own column.
        // Release 1: version '1.2.0', signing_key non-null → both equal → true;
        // signingKey's optional inline operand keeps the comparison optional.
        const expected = [{ id: 1, sameSemver: true, sameKey: true }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({
                id: tProjectRelease.id,
                sameSemver: tProjectRelease.version.equals(
                    ctx.conn.selectFrom(tProjectRelease)
                        .where(tProjectRelease.id.equals(1))
                        .selectOneColumn(tProjectRelease.version)
                        .forUseAsInlineQueryValue()
                ),
                sameKey: tProjectRelease.signingKey.equals(
                    ctx.conn.selectFrom(tProjectRelease)
                        .where(tProjectRelease.id.equals(1))
                        .selectOneColumn(tProjectRelease.signingKey)
                        .forUseAsInlineQueryValue()
                ),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(case when version = (select version as [result] from project_release where id = @0) then 1 when not (version = (select version as [result] from project_release where id = @1)) then 0 else null end as bit) as sameSemver, cast(case when signing_key = (select signing_key as [result] from project_release where id = @2) then 1 when not (signing_key = (select signing_key as [result] from project_release where id = @3)) then 0 else null end as bit) as sameKey from project_release where id = @4"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            1,
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sameSemver?: boolean; sameKey?: boolean }>>>()
        expect(result).toEqual(expected)
    })

    test('inline-value-keeps-custom-numeric-brand', async () => {
        // customDouble 'Money' (billed_amount) and customInt 'Cents' (cost_cents),
        // both required, pushed through forUseAsInlineQueryValue and compared back
        // to their own column. Worklog 1: billed_amount 200, cost_cents 100 →
        // both equal → true. The branded value sources only type-check as operands
        // of the same-branded column, proving the brand survived the wrapper.
        const expected = [{ id: 1, sameMoney: true, sameCents: true }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssueWorklog)
            .where(tIssueWorklog.id.equals(1))
            .select({
                id: tIssueWorklog.id,
                sameMoney: tIssueWorklog.billedAmount.equals(
                    ctx.conn.selectFrom(tIssueWorklog)
                        .where(tIssueWorklog.id.equals(1))
                        .selectOneColumn(tIssueWorklog.billedAmount)
                        .forUseAsInlineQueryValue()
                ),
                sameCents: tIssueWorklog.costCents.equals(
                    ctx.conn.selectFrom(tIssueWorklog)
                        .where(tIssueWorklog.id.equals(1))
                        .selectOneColumn(tIssueWorklog.costCents)
                        .forUseAsInlineQueryValue()
                ),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(case when billed_amount = (select billed_amount as [result] from issue_worklog where id = @0) then 1 when not (billed_amount = (select billed_amount as [result] from issue_worklog where id = @1)) then 0 else null end as bit) as sameMoney, cast(case when cost_cents = (select cost_cents as [result] from issue_worklog where id = @2) then 1 when not (cost_cents = (select cost_cents as [result] from issue_worklog where id = @3)) then 0 else null end as bit) as sameCents from issue_worklog where id = @4"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            1,
            1,
            1,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number; sameMoney?: boolean; sameCents?: boolean }>>>()
        expect(result).toEqual(expected)
    })
})
