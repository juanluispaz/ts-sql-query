// `Values` (`WITH name(...) AS (VALUES ...)`) is typed only on the
// postgreSql / sqlite / sqlServer / oracle / noopDB dialects. The
// library blocks it at compile time on mariadb / mysql. Block-commented
// stubs keep the symmetry audit's per-cell test-name count aligned;
// see the active implementation in any sqlite or postgres cell.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: MySQL has no Values (`WITH name AS (VALUES …)`) — the library type-excludes it on MySqlConnection.
    /*
    test('values-aliased-via-as-keeps-original-with-name', async () => {
        // Not supported on this dialect: `Values` is not typed.
    })
    */

    // NOT-APPLICABLE: MySQL has no Values (`WITH name AS (VALUES …)`) — the library type-excludes it on MySqlConnection.
    /*
    test('values-for-use-in-left-join-as-emits-left-join', async () => {
        // Not supported on this dialect: `Values` is not typed.
    })
    */

    // NOT-APPLICABLE: MySQL has no Values (`WITH name AS (VALUES …)`) — the library type-excludes it on MySqlConnection.
    /*
    test('values-optional-column-allows-undefined-per-row', async () => {
        // Not supported on this dialect: `Values` is not typed.
    })
    */

    // NOT-APPLICABLE: MySQL has no Values (`WITH name AS (VALUES …)`); the
    // library type-excludes it on MySqlConnection.
    /*
    test('values-with-custom-typed-columns-emits-customint-customdouble-casts', async () => {
        // `column<T>('customInt', 'IssueId')` and
        // `optionalColumn<T>('customDouble', 'Money')` on the
        // `VIssueBilling` view above route through the
        // `typeof adapter === 'string'` branch of Values.ts:94-99 /
        // 128-133 — the only branch reached when the user passes a
        // typeName. The emitted VALUES tuple still casts placeholders
        // (`customInt` and `customDouble` are not enumerated in the
        // postgres switch, so the fallback in
        // `PostgreSqlConnection.transformPlaceholder` picks the cast
        // from `typeof valueSentToDB` — `int4` / `float8`).
        ctx.mockNext([
            { issueId: 101 as IssueId, amount: 19.99 as Money },
            { issueId: 102 as IssueId, amount: undefined        },
        ])
        const billing = Values.create(VIssueBilling, 'issueBilling', [
            { issueId: 101 as IssueId, amount: 19.99 as Money },
            { issueId: 102 as IssueId, amount: null as unknown as Money },
        ])

        const rows = await ctx.conn.selectFrom(billing)
            .select({
                issueId: billing.issueId,
                amount:  billing.amount,
            })
            .orderBy('issueId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ issueId: IssueId; amount?: Money }>>>()
        expect(rows).toEqual([
            { issueId: 101 as IssueId, amount: 19.99 as Money },
            { issueId: 102 as IssueId },
        ])
    })
    */

    // NOT-APPLICABLE: MySQL has no Values (`WITH name AS (VALUES …)`); the
    // library type-excludes it on MySqlConnection.
    /*
    test('values-virtual-column-from-fragment-with-custom-type-emits-inline-fragment', async () => {
        // `virtualColumnFromFragment<T>('enum', 'OrderState', fn)` reaches
        // Values.ts:162-168 — the `typeof arg1 === 'string'` branch. The
        // column does NOT appear in the VALUES tuple; the fragment SQL
        // is inlined wherever `billing.state` is selected.
        ctx.mockNext([
            { issueId: 101 as IssueId, state: 'open' as OrderState },
            { issueId: 102 as IssueId, state: 'open' as OrderState },
        ])
        const billing = Values.create(VIssueBilling, 'issueBilling', [
            { issueId: 101 as IssueId, amount: 19.99 as Money },
            { issueId: 102 as IssueId, amount: null as unknown as Money },
        ])

        const rows = await ctx.conn.selectFrom(billing)
            .select({
                issueId: billing.issueId,
                state:   billing.state,
            })
            .orderBy('issueId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ issueId: IssueId; state: OrderState }>>>()
        expect(rows).toEqual([
            { issueId: 101 as IssueId, state: 'open' as OrderState },
            { issueId: 102 as IssueId, state: 'open' as OrderState },
        ])
    })
    */

    // NOT-APPLICABLE: MySQL has no Values (`WITH name AS (VALUES …)`); the
    // library type-excludes it on MySqlConnection.
    /*
    test('values-optional-virtual-column-from-fragment-with-custom-type-emits-inline-fragment', async () => {
        // `optionalVirtualColumnFromFragment<T>('customUuid', 'BillingRef', fn)`
        // reaches Values.ts:198-205. Same dispatch branch as the
        // required-virtual-column test above; the projection surfaces
        // `string | undefined`.
        ctx.mockNext([
            { issueId: 101 as IssueId, billingRef: undefined as string | undefined },
            { issueId: 102 as IssueId, billingRef: undefined as string | undefined },
        ])
        const billing = Values.create(VIssueBilling, 'issueBilling', [
            { issueId: 101 as IssueId, amount: 19.99 as Money },
            { issueId: 102 as IssueId, amount: null as unknown as Money },
        ])

        const rows = await ctx.conn.selectFrom(billing)
            .select({
                issueId:    billing.issueId,
                billingRef: billing.billingRef,
            })
            .orderBy('issueId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ issueId: IssueId; billingRef?: string }>>>()
        expect(rows).toEqual([
            { issueId: 101 as IssueId },
            { issueId: 102 as IssueId },
        ])
    })
    */

    // NOT-APPLICABLE: MySQL has no Values (`WITH name AS (VALUES …)`) — the library type-excludes it on MySqlConnection.
    /*
    test('values-create-with-empty-list-throws-cannot-be-empty', () => {
        // Not supported on this dialect: `Values` is not typed.
    })
    */
})
