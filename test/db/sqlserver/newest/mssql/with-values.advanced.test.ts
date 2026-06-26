// Coverage of the `Values` class surface that the basic `with-values`
// coverage does not exercise. `Values` is documented at
// [`docs/queries/select.md`](../../../../../docs/queries/select.md).
//
// Specifically:
//
// `.as(alias)`: clones the values view under a new
//     alias, copying `__values` and `__source` so the WITH clause
//     keeps emitting the original name once.
// `.forUseInLeftJoin` / `.forUseInLeftJoinAs(alias)`:
//     marks the cloned values view as left-joinable; columns become
//     `originallyRequired` via `__setColumnsForLeftJoin`. Using the
//     alias in a `selectFrom(other).leftJoin(vJoined).on(...)`
//     produces `WITH name(...) AS (...) … LEFT JOIN name alias ON …`.
// `.optionalColumn(...)`: the optional sibling of
//     `column(...)`. Each row may legitimately set the field to
//     `undefined`, and the typed projection surfaces it as
//     `T | undefined`.
// `.virtualColumnFromFragment(...)`: declares a
//     computed column derived from a fragment over the values row.
//     The column is not emitted as a VALUES tuple member; instead,
//     reading `vRow.derived` lands the fragment SQL inline wherever
//     it's selected.
// `Values.create(type, name, [])`: empty values list
//     throws `TsSqlProcessingError` with reason
//     `CONSTANT_VALUES_VIEW_CANNOT_BE_EMPTY`.
//
// `Values` is only typed on the dialects that support this surface; the
// cells whose dialect types it `never` comment out the file body with a
// "not supported" note to keep the symmetry audit happy.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Values } from '../../../../../src/Values.js'
import { TsSqlProcessingError } from '../../../../../src/TsSqlError.js'
import { DBConnection, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

class VProjectPatch extends Values<DBConnection, 'projectPatch'> {
    id   = this.column('int')
    name = this.column('string')
}

class VProjectPatchOptional extends Values<DBConnection, 'projectPatchOpt'> {
    id        = this.column('int')
    newName   = this.optionalColumn('string')
}

// Branded-type ergonomics that production apps commonly want at the
// edges of typed SQL: an `IssueId` newtype + a `Money` newtype.
// The values view models a batch upload of issue financial summaries
// from an external system.
type IssueId    = number & { readonly __brand: 'IssueId' }
type Money      = number & { readonly __brand: 'Money' }
type OrderState = 'open' | 'paid' | 'void'

class VIssueBilling extends Values<DBConnection, 'issueBilling'> {
    // `column<T>('customInt', 'IssueId')` reaches — the
    // `typeof adapter === 'string'` branch of the column impl.
    issueId  = this.column<IssueId>('customInt', 'IssueId')
    // `optionalColumn<T>('customDouble', 'Money')` reaches —
    // the optional sibling of the same branch.
    amount   = this.optionalColumn<Money>('customDouble', 'Money')
    // `virtualColumnFromFragment` / `optionalVirtualColumnFromFragment`
    // declare computed columns over the values row. They are NOT emitted
    // as VALUES tuple members; reading the field inlines the fragment SQL
    // wherever it's selected. The fragments are bare literals (no `${…}`
    // interpolation) — the canonical shape now that the overload
    // resolution accepts a no-table-required fragment source.
    state     = this.virtualColumnFromFragment<OrderState>('enum', 'OrderState', fragment => fragment.sql`'open'`)
    billingRef = this.optionalVirtualColumnFromFragment<string>('customUuid', 'BillingRef', fragment => fragment.sql`null`)
}

// the BASE-TYPE (non-custom) `optionalVirtualColumnFromFragment`
// overloads — `'int'` / `'string'` / … with no typeName, contrast with
// `VIssueBilling.billingRef` which uses the `customUuid` form. Each projects
// as `T | undefined` and, like every virtual column, is NOT a VALUES tuple
// member: only the real `column(...)` fields appear in the `name(cols)`
// list, while reading a virtual field inlines its fragment SQL.
class VBatchRow extends Values<DBConnection, 'batchRow'> {
    id    = this.column('int')
    label = this.column('string')
    rank  = this.optionalVirtualColumnFromFragment('int', fragment => fragment.sql`null`)
    note  = this.optionalVirtualColumnFromFragment('string', fragment => fragment.sql`null`)
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch as (select * from (values (@0, @1), (@2, @3)) as projectPatch(id, name)) select pp.id as id, pp.name as name from projectPatch as pp order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "one",
            2,
            "two",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; name: string }>>>()
        expect(rows).toEqual(expected)
    })

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatch as (select * from (values (@0, @1)) as projectPatch(id, name)) select project.id as pid, pp.name as newName from project left join projectPatch as pp on pp.id = project.id where project.id <= @2 order by pid"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "one",
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ pid: number; newName?: string }>>>()
        // Projects 1 and 2 exist; only project 1 has a patch row → project 2's newName is absent.
        expect(rows).toEqual([
            { pid: 1, newName: 'one' },
            { pid: 2 },
        ])
    })

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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with projectPatchOpt as (select * from (values (@0, @1), (@2, @3)) as projectPatchOpt(id, newName)) select id as id, newName as newName from projectPatchOpt order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "one",
            2,
            null,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; newName?: string }>>>()
        // Row 2's null newName surfaces as an absent (undefined) field.
        expect(rows).toEqual([
            { id: 1, newName: 'one' },
            { id: 2 },
        ])
    })

    test('values-with-custom-typed-columns-emits-customint-customdouble-casts', async () => {
        // `column<T>('customInt', 'IssueId')` and
        // `optionalColumn<T>('customDouble', 'Money')` on the
        // `VIssueBilling` view above route through the
        // `typeof adapter === 'string'` branch of /
        // 128-133 — the only branch reached when the user passes a
        // typeName. The emitted VALUES tuple casts the placeholders for
        // the custom-typed columns; the exact cast each dialect emits is
        // pinned by the snapshot.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with issueBilling as (select * from (values (@0, @1), (@2, @3)) as issueBilling(issueId, amount)) select issueId as issueId, amount as amount from issueBilling order by issueId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            101,
            19.99,
            102,
            null,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ issueId: IssueId; amount?: Money }>>>()
        expect(rows).toEqual([
            { issueId: 101 as IssueId, amount: 19.99 as Money },
            { issueId: 102 as IssueId },
        ])
    })

    test('values-virtual-column-from-fragment-with-custom-type-emits-inline-fragment', async () => {
        // `virtualColumnFromFragment<T>('enum', 'OrderState', fn)` reaches
        // the `typeof arg1 === 'string'` branch. The
        // column does NOT appear in the VALUES tuple; the fragment SQL
        // is inlined wherever `billing.state` is selected.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with issueBilling as (select * from (values (@0, @1), (@2, @3)) as issueBilling(issueId, amount)) select issueId as issueId, 'open' as [state] from issueBilling order by issueId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            101,
            19.99,
            102,
            null,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ issueId: IssueId; state: OrderState }>>>()
        expect(rows).toEqual([
            { issueId: 101 as IssueId, state: 'open' as OrderState },
            { issueId: 102 as IssueId, state: 'open' as OrderState },
        ])
    })

    test('values-optional-virtual-column-from-fragment-with-custom-type-emits-inline-fragment', async () => {
        // `optionalVirtualColumnFromFragment<T>('customUuid', 'BillingRef', fn)`
        // reaches. Same dispatch branch as the
        // required-virtual-column test above; the projection surfaces
        // `string | undefined`.
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

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with issueBilling as (select * from (values (@0, @1), (@2, @3)) as issueBilling(issueId, amount)) select issueId as issueId, null as billingRef from issueBilling order by issueId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            101,
            19.99,
            102,
            null,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ issueId: IssueId; billingRef?: string }>>>()
        expect(rows).toEqual([
            { issueId: 101 as IssueId },
            { issueId: 102 as IssueId },
        ])
    })

    test('values-create-with-empty-list-throws-cannot-be-empty', () => {
        // `Values.create(type, name, [])` reaches the guard
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

    test('values-base-type-optional-virtual-column-projects-optional-and-is-not-a-tuple-member', async () => {
        // the base-type `optionalVirtualColumnFromFragment('int' | 'string',
        // …)` overloads. The data tuples only supply the real `column(...)`
        // fields (id, label) — `rank` / `note` are virtual, so they are absent
        // from both the `batchRow(id, label)` column list and the VALUES rows;
        // reading them inlines their fragment (`null`). They project as
        // `T | undefined`.
        const expected = [
            { id: 1, label: 'a' },
            { id: 2, label: 'b' },
        ]
        ctx.mockNext(expected)
        const batch = Values.create(VBatchRow, 'batchRow', [
            { id: 1, label: 'a' },
            { id: 2, label: 'b' },
        ])
        const rows = await ctx.conn.selectFrom(batch)
            .select({ id: batch.id, label: batch.label, rank: batch.rank, note: batch.note })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with batchRow as (select * from (values (@0, @1), (@2, @3)) as batchRow(id, [label])) select id as id, [label] as [label], null as rank, null as note from batchRow order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "a",
            2,
            "b",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; label: string; rank?: number; note?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('values-branded-column-through-for-use-in-left-join-as-keeps-the-brand', async () => {
        // A branded `Values` (`VIssueBilling`, whose `issueId` leaf IS the brand
        // `IssueId`) left-joined via `forUseInLeftJoinAs`: the left-joined
        // `issueId` keeps the brand while widening to `?: IssueId`. The base view
        // has issues 101 and 102; the joined view only has 101, so 102's joined
        // leaf is absent.
        class VIssueBillingJoin extends Values<DBConnection, 'issueBillingJoin'> {
            issueId = this.column<IssueId>('customInt', 'IssueId')
            amount  = this.optionalColumn<Money>('customDouble', 'Money')
        }
        const expected = [
            { base: 101 as IssueId, joined: 101 as IssueId },
            { base: 102 as IssueId },
        ]
        ctx.mockNext(expected)
        const billing = Values.create(VIssueBilling, 'issueBilling', [
            { issueId: 101 as IssueId, amount: 19.99 as Money },
            { issueId: 102 as IssueId, amount: null },
        ])
        const billingJoin = Values.create(VIssueBillingJoin, 'issueBillingJoin', [
            { issueId: 101 as IssueId, amount: 5 as Money },
        ]).forUseInLeftJoinAs('ibj')

        const rows = await ctx.conn.selectFrom(billing)
            .leftJoin(billingJoin).on(billingJoin.issueId.equals(billing.issueId))
            .select({
                base:   billing.issueId,
                joined: billingJoin.issueId,
            })
            .orderBy('base')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"with issueBilling as (select * from (values (@0, @1), (@2, @3)) as issueBilling(issueId, amount)), issueBillingJoin as (select * from (values (@4, @5)) as issueBillingJoin(issueId, amount)) select issueBilling.issueId as base, ibj.issueId as joined from issueBilling left join issueBillingJoin as ibj on ibj.issueId = issueBilling.issueId order by base"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            101,
            19.99,
            102,
            null,
            101,
            5,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ base: IssueId; joined?: IssueId }>>>()
        expect(rows).toEqual(expected)
    })
})
