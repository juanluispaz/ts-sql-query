// Coverage of the `Values` class surface that the existing
// `with-values.test.ts` does not exercise. `Values` is documented at
// [`docs/queries/select.md`](../../../../../docs/queries/select.md);
// the source is [`src/Values.ts`](../../../../../src/Values.ts).
//
// `Values` is only typed on PostgreSQL / SQLite / SQL Server / Oracle
// / noopDB connections. MariaDB and MySQL cells comment out the file
// body with the same reason as the existing
// [`with-values.test.ts`](./with-values.test.ts). The full canonical
// body (mirrored from `postgres/newest/pg`) is kept inside the comment
// so a fix here is a `/* */` removal — plus the snapshot bake — once
// MariaDB grows `Values` support.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // TODO[LIMITATION]: see LIMITATIONS.md — MariaDB accepts the library's exact `name(cols) AS (VALUES (...),(...))` emission (verified on mariadb 12.3.2) but Values is type-excluded on MariaDBConnection. A library gap, not a dialect boundary; the canonical body below mirrors the postgres / sqlite cells — uncomment and bake snapshots once the typing lands.
    /*
    class VProjectPatch extends Values<DBConnection, 'projectPatch'> {
        id   = this.column('int')
        name = this.column('string')
    }

    class VProjectPatchOptional extends Values<DBConnection, 'projectPatchOpt'> {
        id        = this.column('int')
        newName   = this.optionalColumn('string')
    }

    type IssueId    = number & { readonly __brand: 'IssueId' }
    type Money      = number & { readonly __brand: 'Money' }
    type OrderState = 'open' | 'paid' | 'void'

    class VIssueBilling extends Values<DBConnection, 'issueBilling'> {
        issueId  = this.column<IssueId>('customInt', 'IssueId')
        amount   = this.optionalColumn<Money>('customDouble', 'Money')
        state     = this.virtualColumnFromFragment<OrderState>('enum', 'OrderState', fragment => fragment.sql`'open'`)
        billingRef = this.optionalVirtualColumnFromFragment<string>('customUuid', 'BillingRef', fragment => fragment.sql`null`)
    }

    test('values-aliased-via-as-keeps-original-with-name', async () => {
        // `.as(alias)` clones the values view under a new alias.
        // Cloned columns carry the source's names, so SELECTs against
        // the alias emit qualified references like `pp.id` / `pp.name`
        // (not an empty qualifier). The original WITH name is still
        // emitted once.
        const expected = [
            { id: 1, name: 'one' },
            { id: 2, name: 'two' },
        ]
        ctx.mockNext(expected)
        const patch = Values.create(VProjectPatch, 'projectPatch', [
            { id: 1, name: 'one' },
            { id: 2, name: 'two' },
        ])
        const pp = patch.as('pp')

        const rows = await ctx.conn.selectFrom(pp)
            .select({ id: pp.id, name: pp.name })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — MariaDB accepts the library's exact `name(cols) AS (VALUES (...),(...))` emission (verified on mariadb 12.3.2) but Values is type-excluded on MariaDBConnection. A library gap, not a dialect boundary; the canonical body below mirrors the postgres / sqlite cells — uncomment and bake snapshots once the typing lands.
    /*
    test('values-for-use-in-left-join-as-emits-left-join', async () => {
        // `.forUseInLeftJoinAs(alias)` marks the cloned values view as
        // left-joinable; cloned columns inherit the source's names, so
        // the JOIN emits `pp.id` / `pp.name` qualifiers. Projects with
        // no matching patch row surface `newName` as undefined.
        ctx.mockNext([
            { pid: 1, newName: 'one' },
            { pid: 2, newName: undefined },
        ])
        const patch = Values.create(VProjectPatch, 'projectPatch', [
            { id: 1, name: 'one' },
        ])
        const pp = patch.forUseInLeftJoinAs('pp')

        const rows = await ctx.conn.selectFrom(tProject)
            .leftJoin(pp).on(pp.id.equals(tProject.id))
            .where(tProject.id.lessOrEqual(2))
            .select({
                pid:     tProject.id,
                newName: pp.name,
            })
            .orderBy('pid')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ pid: number; newName?: string }>>>()
        // Projects 1 and 2 exist; only project 1 has a patch row → project 2's newName is absent.
        expect(rows).toEqual([
            { pid: 1, newName: 'one' },
            { pid: 2 },
        ])
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — MariaDB accepts the library's exact `name(cols) AS (VALUES (...),(...))` emission (verified on mariadb 12.3.2) but Values is type-excluded on MariaDBConnection. A library gap, not a dialect boundary; the canonical body below mirrors the postgres / sqlite cells — uncomment and bake snapshots once the typing lands.
    /*
    test('values-optional-column-allows-undefined-per-row', async () => {
        // An optional column accepts per-row null/undefined, emitted as NULL
        // in the VALUES tuple, and the projection surfaces it as optional.
        ctx.mockNext([
            { id: 1, newName: 'one'   },
            { id: 2, newName: undefined },
        ])
        const patch = Values.create(VProjectPatchOptional, 'projectPatchOpt', [
            { id: 1, newName: 'one' },
            { id: 2, newName: null },
        ])

        const rows = await ctx.conn.selectFrom(patch)
            .select({ id: patch.id, newName: patch.newName })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot()
        expect(ctx.lastParams).toMatchInlineSnapshot()
        assertType<Exact<typeof rows, Array<{ id: number; newName?: string }>>>()
        // Row 2's null newName surfaces as an absent (undefined) field.
        expect(rows).toEqual([
            { id: 1, newName: 'one' },
            { id: 2 },
        ])
    })
    */

    // TODO[LIMITATION]: see LIMITATIONS.md — MariaDB accepts the library's exact `name(cols) AS (VALUES (...),(...))` emission (verified on mariadb 12.3.2) but Values is type-excluded on MariaDBConnection. A library gap, not a dialect boundary; the canonical body below mirrors the postgres / sqlite cells — uncomment and bake snapshots once the typing lands.
    /*
    test('values-with-custom-typed-columns-emits-customint-customdouble-casts', async () => {
        // `column<T>('customInt', 'IssueId')` and
        // `optionalColumn<T>('customDouble', 'Money')` on the
        // `VIssueBilling` view above route through the
        // `typeof adapter === 'string'` branch of the column impl — the
        // only branch reached when the user passes a typeName.
        ctx.mockNext([
            { issueId: 101 as IssueId, amount: 19.99 as Money },
            { issueId: 102 as IssueId, amount: undefined        },
        ])
        const billing = Values.create(VIssueBilling, 'issueBilling', [
            { issueId: 101 as IssueId, amount: 19.99 as Money },
            { issueId: 102 as IssueId, amount: null },
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

    // TODO[LIMITATION]: see LIMITATIONS.md — MariaDB accepts the library's exact `name(cols) AS (VALUES (...),(...))` emission (verified on mariadb 12.3.2) but Values is type-excluded on MariaDBConnection. A library gap, not a dialect boundary; the canonical body below mirrors the postgres / sqlite cells — uncomment and bake snapshots once the typing lands.
    /*
    test('values-virtual-column-from-fragment-with-custom-type-emits-inline-fragment', async () => {
        // `virtualColumnFromFragment<T>('enum', 'OrderState', fn)` reaches
        // the `typeof arg1 === 'string'` branch. The column does NOT
        // appear in the VALUES tuple; the fragment SQL is inlined wherever
        // `billing.state` is selected.
        ctx.mockNext([
            { issueId: 101 as IssueId, state: 'open' as OrderState },
            { issueId: 102 as IssueId, state: 'open' as OrderState },
        ])
        const billing = Values.create(VIssueBilling, 'issueBilling', [
            { issueId: 101 as IssueId, amount: 19.99 as Money },
            { issueId: 102 as IssueId, amount: null },
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

    // TODO[LIMITATION]: see LIMITATIONS.md — MariaDB accepts the library's exact `name(cols) AS (VALUES (...),(...))` emission (verified on mariadb 12.3.2) but Values is type-excluded on MariaDBConnection. A library gap, not a dialect boundary; the canonical body below mirrors the postgres / sqlite cells — uncomment and bake snapshots once the typing lands.
    /*
    test('values-optional-virtual-column-from-fragment-with-custom-type-emits-inline-fragment', async () => {
        // `optionalVirtualColumnFromFragment<T>('customUuid', 'BillingRef', fn)`
        // reaches the same dispatch branch as the required-virtual-column
        // test above; the projection surfaces `string | undefined`.
        ctx.mockNext([
            { issueId: 101 as IssueId, billingRef: undefined },
            { issueId: 102 as IssueId, billingRef: undefined },
        ])
        const billing = Values.create(VIssueBilling, 'issueBilling', [
            { issueId: 101 as IssueId, amount: 19.99 as Money },
            { issueId: 102 as IssueId, amount: null },
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

    // TODO[LIMITATION]: see LIMITATIONS.md — MariaDB accepts the library's exact `name(cols) AS (VALUES (...),(...))` emission (verified on mariadb 12.3.2) but Values is type-excluded on MariaDBConnection. A library gap, not a dialect boundary; the canonical body below mirrors the postgres / sqlite cells — uncomment and bake snapshots once the typing lands.
    /*
    test('values-create-with-empty-list-throws-cannot-be-empty', () => {
        // `Values.create(type, name, [])` reaches the empty-list guard
        // and throws a `TsSqlProcessingError` with reason
        // `CONSTANT_VALUES_VIEW_CANNOT_BE_EMPTY`. Pure compile-time
        // type-check still admits the call shape; the runtime guard
        // is the assertion.
        let thrown: unknown
        try {
            Values.create(VProjectPatch, 'projectPatch', [])
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(TsSqlProcessingError)
        expect((thrown as TsSqlProcessingError).errorReason.reason)
            .toBe('CONSTANT_VALUES_VIEW_CANNOT_BE_EMPTY')
    })
    */
})
