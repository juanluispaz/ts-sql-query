// Model-first dynamic conditions: `DynamicConditionForModel<Model>` derives the
// filter-criteria type from a plain business interface instead of from the
// value-source map or a hand-written descriptor map. This file proves it is
// EQUIVALENT to the descriptor form — same accepted filter, same emitted SQL —
// and that the derived type maps each value category to the right filter.
//
// `DynamicConditionForModel<M>` is sugar for `DynamicCondition<DynamicDefinitionForModel<M>>`;
// the mapping (`DynamicDefinitionForModel`) turns `number → 'int'`, `string →
// 'string'`, `bigint → 'bigint'`, `Date → 'localDateTime'`, a literal union →
// `['enum', …]`, and a nested object → a nested definition.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DynamicCondition, DynamicConditionForModel, DynamicDefinitionForModel } from '../../../../../src/dynamic/condition.js'
import type { OrderByForModel } from '../../../../../src/dynamic/orderBy.js'
import type { DynamicOrderByForModel } from '../../../../../src/experimental/types.js'
import { tIssue, tProject, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

// Business model (upper layer) — no ts-sql-query types.
interface IssueModel {
    id:             number
    title:          string
    priority:       number
    viewCount:      bigint
    estimatedHours: number
    externalRef:    string   // uuid stored as a string
    createdAt:      Date
}

const selectFields = {
    id:             tIssue.id,
    title:          tIssue.title,
    priority:       tIssue.priority,
    viewCount:      tIssue.viewCount,
    estimatedHours: tIssue.estimatedHours,
    externalRef:    tIssue.externalRef,
    createdAt:      tIssue.createdAt,
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('from-model/maps-each-value-category-to-the-descriptor-form', () => {
        // The model-derived definition equals the hand-written descriptor map.
        assertType<Exact<
            DynamicDefinitionForModel<IssueModel>,
            {
                id:             'int'
                title:          'string'
                priority:       'int'
                viewCount:      'bigint'
                estimatedHours: 'int'
                externalRef:    'string'
                createdAt:      'localDateTime'
            }
        >>()
    })

    test('from-model/enum-and-nested-mapping', () => {
        type M = { status: 'open' | 'closed'; org: { id: number; name: string } }
        assertType<Exact<
            DynamicDefinitionForModel<M>,
            { status: ['enum', 'open' | 'closed']; org: { id: 'int'; name: 'string' } }
        >>()
    })

    test('from-model/emits-the-same-sql-as-the-descriptor-form', async () => {
        // Same filter value, typed two ways: from the model vs from the
        // descriptor map. Both must route through withValues identically.
        const fromModel: DynamicConditionForModel<IssueModel> = {
            or: [
                { title: { startsWithInsensitive: 'Re' } },
                { priority: { greaterThan: 3 } },
            ],
            viewCount: { greaterOrEqual: 10n },
            externalRef: { containsInsensitive: 'abc' },
        }
        const fromDescriptor: DynamicCondition<{
            id: 'int', title: 'string', priority: 'int', viewCount: 'bigint',
            estimatedHours: 'int', externalRef: 'string', createdAt: 'localDateTime',
        }> = fromModel   // the model-derived type is assignable to the descriptor form

        // Same filter, routed two ways: the model-derived type and the
        // descriptor form. Each emits its SQL through the interceptor; both
        // must come out identical.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues(fromModel))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()
        const modelSql = ctx.lastSql
        const modelParams = ctx.lastParams

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor(selectFields).withValues(fromDescriptor))
            .select({ id: tIssue.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toBe(modelSql)
        expect(ctx.lastParams).toEqual(modelParams)
        expect(modelSql).toMatchInlineSnapshot(`"select id as id from issue where (lower(title) like concat(lower(?), '%') or priority > ?) and view_count >= ? and lower(external_ref) like concat('%', lower(?), '%') order by id"`)
        expect(modelParams).toMatchInlineSnapshot(`
          [
            "Re",
            3,
            10n,
            "abc",
          ]
        `)
    })

    test('from-model/nested-filter-emits-expected-sql', async () => {
        const organization = tOrganization.forUseInLeftJoinAs('organization')
        const fields = {
            id:   tProject.id,
            name: tProject.name,
            organization: { id: organization.id, name: organization.name },
        }
        interface ProjectModel {
            id:   number
            name: string
            organization?: { id: number; name: string }
        }

        const filter: DynamicConditionForModel<ProjectModel> = {
            name: { contains: 'foo' },
            organization: { name: { equals: 'Acme' } },
        }

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProject)
            .optionalLeftOuterJoin(organization).on(organization.id.equals(tProject.organizationId))
            .where(ctx.conn.dynamicConditionFor(fields).withValues(filter))
            .select({ id: tProject.id }).orderBy('id').executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id from project left outer join organization as organization on organization.id = project.organization_id where project.name like concat('%', ?, '%') and organization.name = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "foo",
            "Acme",
          ]
        `)
    })

    // ---- Model-first dynamic order-by: OrderByForModel ----

    interface IssueOrderModel {
        id:        number
        title:     string
        priority:  number
        createdAt: Date
        tags:      string[]                       // not orderable (an array)
        author:    { id: number; name: string }   // nested projection — order by its leaves
    }

    test('from-model/order-by-clause-type', () => {
        // A single clause: a scalar field PATH, optionally followed by an ordering mode.
        // Matching the runtime, scalar leaves of nested objects are orderable by their
        // dotted path; the object itself, and arrays, are not.
        type Clause = OrderByForModel<IssueOrderModel>
        const ok1: Clause = 'title'
        const ok2: Clause = 'priority desc'
        const ok3: Clause = 'createdAt asc nulls last'
        const ok4: Clause = 'title insensitive'
        const ok5: Clause = 'author.name'          // nested scalar leaf
        const ok6: Clause = 'author.id desc'
        expect([ok1, ok2, ok3, ok4, ok5, ok6]).toHaveLength(6)
        // Negative-type assertions (the rejected clauses) live in
        // types.negative/dynamic-condition.from-model.test.ts.
    })

    test('from-model/order-by-string-feeds-orderByFromString', async () => {
        // The typed clauses are joined into the plain string `orderByFromString` takes;
        // the order-by column names are matched against the projected (model) names.
        const order: OrderByForModel<IssueOrderModel>[] = ['priority desc', 'title asc']

        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .select({ id: tIssue.id, title: tIssue.title, priority: tIssue.priority })
            .orderByFromString(order.join(', '))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, title as title, priority as priority from issue order by priority desc, title asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('from-model/order-by-nested-leaf-in-complex-projection', async () => {
        // The runtime resolves a dotted order-by path into the nested projection, so
        // ordering by `organization.name` works on a complex projection. OrderByForModel
        // mirrors this: the nested scalar leaf is orderable, the object itself is not.
        interface ProjectWithOrgModel {
            id:   number
            name: string
            organization?: { id: number; name: string }
        }
        const organization = tOrganization.forUseInLeftJoinAs('organization')
        const order: OrderByForModel<ProjectWithOrgModel>[] = ['organization.name asc nulls last', 'name desc']

        ctx.mockNext([])
        await ctx.conn.selectFrom(tProject)
            .optionalLeftOuterJoin(organization).on(organization.id.equals(tProject.organizationId))
            .select({ id: tProject.id, name: tProject.name, organization: { id: organization.id, name: organization.name } })
            .orderByFromString(order.join(', '))
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, organization.id as \`organization.id\`, organization.name as \`organization.name\` from project left outer join organization as organization on organization.id = project.organization_id order by \`organization.name\` is null, \`organization.name\` asc, name desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // ---- Whole-string dynamic order-by: DynamicOrderByForModel (no join) ----

    interface ProjectWithOrg {
        id:   number
        name: string
        organization?: { id: number; name: string }
    }

    test('from-model/dynamic-order-by-validates-whole-string', () => {
        // DynamicOrderByForModel<Model, ORDER_BY> validates the full comma-separated
        // string; the idiomatic shape infers ORDER_BY in a generic function parameter.
        function check<ORDER_BY extends string>(orderBy: DynamicOrderByForModel<ProjectWithOrg, ORDER_BY>): ORDER_BY {
            return orderBy
        }
        expect(check('name')).toBe('name')
        expect(check('organization.name asc nulls last, name desc')).toBe('organization.name asc nulls last, name desc')
        expect(check('id, name asc, organization.id desc')).toBe('id, name asc, organization.id desc')
        // Negative-type assertions (the rejected strings) live in
        // types.negative/dynamic-condition.from-model.test.ts.
    })

    test('from-model/dynamic-order-by-validated-string-feeds-orderByFromString', async () => {
        // The validated whole string (inferred in a generic function parameter) feeds
        // orderByFromString directly — no `.join`.
        async function runOrdered<ORDER_BY extends string>(orderBy: DynamicOrderByForModel<ProjectWithOrg, ORDER_BY>) {
            const organization = tOrganization.forUseInLeftJoinAs('organization')
            return ctx.conn.selectFrom(tProject)
                .optionalLeftOuterJoin(organization).on(organization.id.equals(tProject.organizationId))
                .select({ id: tProject.id, name: tProject.name, organization: { id: organization.id, name: organization.name } })
                .orderByFromString(orderBy)
                .executeSelectMany()
        }

        ctx.mockNext([])
        await runOrdered('organization.name asc nulls last, name desc')

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as id, project.name as name, organization.id as \`organization.id\`, organization.name as \`organization.name\` from project left outer join organization as organization on organization.id = project.organization_id order by \`organization.name\` is null, \`organization.name\` asc, name desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })
})
