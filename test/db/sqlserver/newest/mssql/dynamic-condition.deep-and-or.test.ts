// Deep `and` / `or` / `not` composition
// The sibling `dynamic-condition.operators.test.ts` covers the leaf
// operators; this file drives `processAndFilter`,
// `processOrFilter` and the recursive `processFilter` paths with
// nested boolean trees the operators file does not exercise:
//
//   - `and` containing nested `or`
//   - `or` containing nested `and` + `not`
//   - 3-level deep nesting (and -> or -> not -> column filter)
//   - empty `and: []` / `or: []` arrays (no-op cases)
//   - `and` whose every entry is a skipped `*IfValue` (no-op)

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import type { DynamicCondition } from '../../../../../src/dynamic/condition.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

type IssueFilter = DynamicCondition<{
    id:       'int',
    status:   'string',
    priority: 'int',
}>

const selectFields = {
    id:       tIssue.id,
    status:   tIssue.status,
    priority: tIssue.priority,
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('dynamic-condition-and-of-or-and-column-filter', async () => {
        // `and: [<column filter>, { or: [...] }]` - one outer AND
        // joining a leaf column filter to a nested OR group.
        ctx.mockNext([])
        const connection = ctx.conn
        const filter: IssueFilter = {
            and: [
                { status: { equals: 'open' } },
                { or: [
                    { priority: { greaterOrEqual: 3 } },
                    { id:       { in: [1, 2] } },
                ] },
            ],
        }
        await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where status = @0 and (priority >= @1 or id in (@2, @3)) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            3,
            1,
            2,
          ]
        `)
    })

    test('dynamic-condition-or-of-and-and-not-with-column-filter', async () => {
        // `or` taking two arms: an `and` group and a `not` group.
        ctx.mockNext([])
        const connection = ctx.conn
        const filter: IssueFilter = {
            or: [
                { and: [
                    { status:   { equals: 'open' } },
                    { priority: { equals: 3      } },
                ] },
                { not: { status: { equals: 'closed' } } },
            ],
        }
        await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where (status = @0 and priority = @1) or not (status = @2) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            3,
            "closed",
          ]
        `)
    })

    test('dynamic-condition-three-level-deep-nesting', async () => {
        // and -> or -> not -> leaf. The recursive `processFilter`
        // call chain has to thread the (empty) extension all the way
        // down without losing the column reference.
        ctx.mockNext([])
        const connection = ctx.conn
        const filter: IssueFilter = {
            and: [
                { or: [
                    { not: { status: { equals: 'closed' } } },
                    { id:  { greaterThan: 100 } },
                ] },
                { priority: { lessOrEqual: 2 } },
            ],
        }
        await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where (not (status = @0) or id > @1) and priority <= @2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "closed",
            100,
            2,
          ]
        `)
    })

    test('dynamic-condition-empty-and-array-is-noop', async () => {
        // `and: []` should produce no WHERE clause at all (or a
        // tautology that prunes to nothing).
        ctx.mockNext([])
        const connection = ctx.conn
        const filter: IssueFilter = { and: [] }
        await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('dynamic-condition-and-with-only-skipped-ifvalue-keys-is-noop', async () => {
        // Every leaf in the AND group is an `*IfValue` operator with
        // a `null` / `undefined` value, so each one short-circuits.
        // The AND group collapses to no WHERE.
        ctx.mockNext([])
        const connection = ctx.conn
        const filter: IssueFilter = {
            and: [
                { status:   { equalsIfValue:      undefined } },
                { priority: { greaterOrEqualIfValue: null  } },
            ],
        }
        await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('dynamic-condition-or-with-mixed-active-and-skipped-rules', async () => {
        // Some OR arms are active leaves, others are skipped
        // `*IfValue` entries. The dispatcher emits only the active
        // arms - the snapshot proves the skipped ones don't show up
        // as `true` / `1` / placeholders.
        ctx.mockNext([])
        const connection = ctx.conn
        const filter: IssueFilter = {
            or: [
                { status:   { equals: 'open' } },
                { priority: { equalsIfValue: undefined } },
                { id:       { equals: 42     } },
            ],
        }
        const rows = await connection.selectFrom(tIssue)
            .where(connection.dynamicConditionFor(selectFields).withValues(filter))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where status = @0 or id = @1 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            42,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
    })
})
