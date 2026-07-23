// Behavioral coverage of the NULL-safe equality operators `.is(...)` and
// `.isNot(...)`. They are part of the public surface but no other test
// exercises them. Each dialect renders them its own way, pinned per cell
// by the snapshot below.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('is-with-null', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.is(null))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id is not distinct from $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
    })

    test('is-with-value', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.is(2))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id is not distinct from $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
    })

    test('is-not-with-null', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.isNot(null))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id is distinct from $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
    })

    test('is-not-with-value', async () => {
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.isNot(2))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id is distinct from $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
    })

    test('is-with-column-comparison', async () => {
        // Comparing two columns of the same table; expresses NULL-safe
        // equality between parent_id and assignee_id.
        ctx.mockNext([])
        await ctx.conn.selectFrom(tIssue)
            .where(tIssue.assigneeId.is(tIssue.parentId))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where assignee_id is not distinct from parent_id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // The five tests above all put a COLUMN on the left of `.is(...)`. A
    // constant is equally valid there, and it is the shape a caller lands on
    // when the value being matched comes from the request and the column is
    // the thing being searched: "find the issues whose body is whatever the
    // caller supplied, treating absent as a real value to match".

    test('is-with-null-const-receiver-and-column-operand', async () => {
        const expected = [{ id: 1 }, { id: 3 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.optionalConst(null, 'string').is(tIssue.body))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where $1 is not distinct from body order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-not-with-null-const-receiver-and-column-operand', async () => {
        const expected = [{ id: 2 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.optionalConst(null, 'string').isNot(tIssue.body))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where $1 is distinct from body order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-with-null-const-receiver-and-literal-operand', async () => {
        // Both operands are constants, so no row can satisfy it: null is
        // distinct from any non-null literal.
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.optionalConst(null, 'string').is('See ADR-014'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where $1 is not distinct from $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
            "See ADR-014",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-not-with-null-const-receiver-and-literal-operand', async () => {
        // The complement of the test above: null IS distinct from any
        // non-null literal, so the predicate holds for every row.
        const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.optionalConst(null, 'string').isNot('See ADR-014'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where $1 is distinct from $2 order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            null,
            "See ADR-014",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number }>>>()
        expect(rows).toEqual(expected)
    })

    // Both `verified` columns are declared with the SAME
    // CustomBooleanTypeAdapter ('Y'/'N'), so the two operands share one
    // stored representation and the comparison can be made directly on the
    // stored values instead of unwrapping each side to a boolean first.
    // Scenario: which users agree with their organization on being verified.

    test('is-between-two-columns-sharing-a-custom-boolean-adapter', async () => {
        const expected = [
            { organizationId: 1, userId: 1 },
            { organizationId: 1, userId: 2 },
            { organizationId: 2, userId: 3 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tAppUser).on(tAppUser.verified.is(tOrganization.verified))
            .select({ organizationId: tOrganization.id, userId: tAppUser.id })
            .orderBy('organizationId')
            .orderBy('userId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as "organizationId", app_user.id as "userId" from organization inner join app_user on app_user.verified is not distinct from organization.verified order by "organizationId", "userId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ organizationId: number, userId: number }>>>()
        expect(rows).toEqual(expected)
    })

    test('is-not-between-two-columns-sharing-a-custom-boolean-adapter', async () => {
        const expected = [
            { organizationId: 1, userId: 3 },
            { organizationId: 2, userId: 1 },
            { organizationId: 2, userId: 2 },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(tOrganization)
            .innerJoin(tAppUser).on(tAppUser.verified.isNot(tOrganization.verified))
            .select({ organizationId: tOrganization.id, userId: tAppUser.id })
            .orderBy('organizationId')
            .orderBy('userId')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select organization.id as "organizationId", app_user.id as "userId" from organization inner join app_user on app_user.verified is distinct from organization.verified order by "organizationId", "userId""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ organizationId: number, userId: number }>>>()
        expect(rows).toEqual(expected)
    })
})
