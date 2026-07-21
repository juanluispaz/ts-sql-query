// Dynamic-condition combinations: a custom/branded column filtered under the
// structural engine (`not`, `or`) paired with its direct equivalent (identical
// SQL+params), a model-derived filter (`DynamicConditionForModel<M, EXT>`)
// carrying an extension rule run end-to-end, the aggregated-array empty-filter
// no-op, `OrderByForModel` over a branded/custom-Date/optional scalar leaf, and
// an extension key shadowing a built-in operator.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import type { DynamicCondition, DynamicConditionForModel } from '../../../../../src/dynamic/condition.js'
import type { OrderByForModel } from '../../../../../src/dynamic/orderBy.js'
import { tIssue, tProject, tProjectRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

// A publicly-typed boolean value source — the return type an extension rule
// callback is contractually required to produce.
type BoolRule<V> = (rule: V) => ReturnType<typeof tIssue.id.equals>

function buildExtension(connection: typeof ctx.conn) {
    return {
        withProjectName: (rules: string | null | undefined) => {
            if (!rules) {
                return connection.noValueBoolean()
            }
            const sub = connection.subSelectUsing(tIssue)
                .from(tProject)
                .where(tProject.id.equals(tIssue.projectId))
                .and(tProject.name.containsInsensitive(rules))
                .selectOneColumn(tProject.id)
            return connection.exists(sub)
        },
    }
}
type WithProjectNameExt = {
    withProjectName: (rules: string | null | undefined) => ReturnType<ReturnType<typeof buildExtension>['withProjectName']>
}

interface IssueFilterModel {
    id:       number
    status:   string
    priority: number
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('custom-column-under-not-equals-the-direct-negate', async () => {
        // A `custom` column (`channel`) filtered under the structural `not`,
        // paired with the direct `.negate()` — both emit identical SQL+params.
        const selectFields = { id: tProjectRelease.id, channel: tProjectRelease.channel }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({ not: { channel: { equals: 'stable' } } }))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        const dynSql = ctx.lastSql
        const dynParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.channel.equals('stable').negate())
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toBe(dynSql)
        expect(ctx.lastParams).toEqual(dynParams)
        expect(dynSql).toMatchInlineSnapshot(`"select id as id from project_release where not (channel = @0) order by id"`)
        expect(dynParams).toMatchInlineSnapshot(`
          [
            "stable",
          ]
        `)
    })

    test('custom-comparable-column-under-or-equals-the-direct-or', async () => {
        // A `customComparable` column (`version`) filtered under the structural
        // `or`, paired with the direct `.or(...)` chain — identical SQL+params.
        const selectFields = { id: tProjectRelease.id, version: tProjectRelease.version }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues({
                or: [{ version: { equals: '1.2.0' } }, { version: { equals: '0.9.0' } }],
            }))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()
        const dynSql = ctx.lastSql
        const dynParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.version.equals('1.2.0').or(tProjectRelease.version.equals('0.9.0')))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toBe(dynSql)
        expect(ctx.lastParams).toEqual(dynParams)
        expect(dynSql).toMatchInlineSnapshot(`"select id as id from project_release where version = @0 or version = @1 order by id"`)
        expect(dynParams).toMatchInlineSnapshot(`
          [
            "1.2.0",
            "0.9.0",
          ]
        `)
    })

    test('model-derived-filter-with-extension-rule-emits-sql', async () => {
        // `DynamicConditionForModel<M, EXT>` end-to-end: a model-derived filter
        // carrying both a column filter and an extension rule, run through
        // `dynamicConditionFor(fields, extension).withValues(...)` to emit SQL.
        const connection = ctx.conn
        const extension = buildExtension(connection)
        const selectFields = {
            id:       tIssue.id,
            status:   tIssue.status,
            priority: tIssue.priority,
        }
        const filter: DynamicConditionForModel<IssueFilterModel, WithProjectNameExt> = {
            status: { equals: 'open' },
            withProjectName: 'mktg',
        }

        ctx.mockNext([])
        await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where status = @0 and exists(select id as [result] from project where id = issue.project_id and lower(name) like lower('%' + @1 + '%')) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            "mktg",
          ]
        `)
    })

    test('aggregated-array-empty-filter-is-a-legal-no-op', async () => {
        // `{ titles: {} }` (an empty Filter over an aggregated-array field) is
        // type-legal without `as any` and a runtime no-op. The aggregated-array
        // value source taints the condition with the `aggregate/` source, so the
        // no-op is applied in `.having(...)`; being a no-op, no HAVING is emitted.
        const aggFields = {
            titles: ctx.conn.aggregateAsArrayOfOneColumn(tIssue.title),
        }
        const expected = [{ projectId: 1 }, { projectId: 2 }, { projectId: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .select({ projectId: tIssue.projectId })
            .groupBy('projectId')
            .having(ctx.conn.dynamicConditionFor(aggFields).withValues({ titles: {} }))
            .orderBy('projectId')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project_id as projectId from issue group by project_id order by projectId"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        expect(rows).toEqual(expected)
    })

    test('order-by-for-model-classifies-branded-custom-date-and-optional-scalar', () => {
        // `OrderByForModel<M>` classifies a branded string, a `Date`
        // (custom-date) and an optional scalar leaf as orderable (type-only).
        type Semver = string & { readonly __brand: 'Semver' }
        interface ReleaseOrderModel {
            version:    Semver   // branded string
            releasedOn: Date     // custom-date scalar
            estimate?:  number   // optional scalar
        }
        const clauses: OrderByForModel<ReleaseOrderModel>[] = [
            'version',
            'releasedOn desc',
            'estimate asc nulls last',
        ]
        expect(clauses).toHaveLength(3)
    })

    test('column-extension-key-shadows-the-built-in-operator', async () => {
        // An extension whose key collides with a built-in operator (`equals`)
        // shadows it (`ColumnFilterWithExtension = Omit<COLUMN_FILTER, keyof
        // EXTENSION> & EXTENSION`): `{ id: { equals: 5 } }` dispatches to the
        // extension's `equals` rule, emitting `id > $1` rather than `id = $1`.
        const connection = ctx.conn
        const selectFields = { id: tIssue.id }
        const extension = {
            equals: (v: number) => tIssue.id.greaterThan(v),
        }
        const filter: DynamicCondition<{ id: 'int' }, { equals: BoolRule<number> }> = { id: { equals: 5 } }

        ctx.mockNext([])
        await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields, extension).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where id > @0 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            5,
          ]
        `)
    })
    test('dynamic-condition-in-a-compound-union-matches-the-direct-predicate', async () => {
        // A dynamic condition feeding the WHERE of the left side of a compound
        // (UNION): dynamicConditionFor(...).withValues(...) -> .where(...) ->
        // .union(...). The emitted SQL+params must match a hand-written
        // direct-predicate compound.
        const fields = { id: tIssue.id, priority: tIssue.priority }
        const filter = { priority: { greaterThan: 2 } }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(fields).withValues(filter))
            .select({ id: tIssue.id })
            .union(
                ctx.conn.selectFrom(tIssue).where(tIssue.priority.equals(1)).select({ id: tIssue.id }),
            )
            .executeSelectMany()
        const dynSql = ctx.lastSql
        const dynParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.greaterThan(2))
            .select({ id: tIssue.id })
            .union(
                ctx.conn.selectFrom(tIssue).where(tIssue.priority.equals(1)).select({ id: tIssue.id }),
            )
            .executeSelectMany()

        expect(ctx.lastSql).toBe(dynSql)
        expect(ctx.lastParams).toEqual(dynParams)
        expect(dynSql).toMatchInlineSnapshot(`"select id as id from issue where priority > @0 union select id as id from issue where priority = @1"`)
        expect(dynParams).toMatchInlineSnapshot(`
          [
            2,
            1,
          ]
        `)
    })

})
