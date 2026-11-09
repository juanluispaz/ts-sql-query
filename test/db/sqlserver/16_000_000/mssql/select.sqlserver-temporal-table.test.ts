// A system-versioned temporal table read with FOR SYSTEM_TIME BETWEEN through a
// table customization: plan 1 was updated once, plan 2 never.
// The seed restores the versions with fixed periods: plan 1 was 'Basic' from
// 2024-01-01 to 2024-06-01 and is 'Standard' since, plan 2 is 'Enterprise'
// since 2024-01-01. Every window below is a month or more away from those
// instants.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tServicePlan } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('for-system-time-between-returns-both-versions-of-an-updated-row', async () => {
        const expected = [
            { id: 1, name: 'Basic', description: 'Entry plan' },
            { id: 1, name: 'Standard', description: 'Entry plan' },
        ]
        ctx.mockNext(expected)

        const planVersions = ctx.conn.forSystemTimeBetween(tServicePlan, 'planVersions', new Date('2023-12-01T00:00:00.000Z'), new Date('2024-12-01T00:00:00.000Z'))

        const result = await ctx.conn.selectFrom(planVersions)
            .where(planVersions.id.equals(1))
            .select({
                id:          planVersions.id,
                name:        planVersions.name,
                description: planVersions.description,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, description as description from service_plan for system_time between @0 and @1  where id = @2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2023-12-01T00:00:00.000Z,
            2024-12-01T00:00:00.000Z,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:           number
            name:         string
            description?: string
        }>>>()
        // The query has no order by.
        expect([...result].sort((a, b) => a.name.localeCompare(b.name))).toEqual(expected)
    })

    test('for-system-time-between-returns-the-only-version-of-a-row-never-updated', async () => {
        const expected = [{ id: 2, name: 'Enterprise' }]
        ctx.mockNext(expected)

        const planVersions = ctx.conn.forSystemTimeBetween(tServicePlan, 'planVersions', new Date('2023-12-01T00:00:00.000Z'), new Date('2024-12-01T00:00:00.000Z'))

        const result = await ctx.conn.selectFrom(planVersions)
            .where(planVersions.id.equals(2))
            .select({
                id:          planVersions.id,
                name:        planVersions.name,
                description: planVersions.description,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name, description as description from service_plan for system_time between @0 and @1  where id = @2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2023-12-01T00:00:00.000Z,
            2024-12-01T00:00:00.000Z,
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{
            id:           number
            name:         string
            description?: string
        }>>>()
        expect(result).toEqual(expected)
    })

    test('for-system-time-between-before-the-update-returns-only-the-first-version', async () => {
        const expected = [{ id: 1, name: 'Basic' }]
        ctx.mockNext(expected)

        const planVersions = ctx.conn.forSystemTimeBetween(tServicePlan, 'planVersions', new Date('2024-02-01T00:00:00.000Z'), new Date('2024-03-01T00:00:00.000Z'))

        const result = await ctx.conn.selectFrom(planVersions)
            .where(planVersions.id.equals(1))
            .select({
                id:   planVersions.id,
                name: planVersions.name,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from service_plan for system_time between @0 and @1  where id = @2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-02-01T00:00:00.000Z,
            2024-03-01T00:00:00.000Z,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, name: string }>>>()
        expect(result).toEqual(expected)
    })

    test('for-system-time-between-after-the-update-returns-only-the-current-version', async () => {
        const expected = [{ id: 1, name: 'Standard' }]
        ctx.mockNext(expected)

        const planVersions = ctx.conn.forSystemTimeBetween(tServicePlan, 'planVersions', new Date('2024-07-01T00:00:00.000Z'), new Date('2024-08-01T00:00:00.000Z'))

        const result = await ctx.conn.selectFrom(planVersions)
            .where(planVersions.id.equals(1))
            .select({
                id:   planVersions.id,
                name: planVersions.name,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, name as name from service_plan for system_time between @0 and @1  where id = @2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2024-07-01T00:00:00.000Z,
            2024-08-01T00:00:00.000Z,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number, name: string }>>>()
        expect(result).toEqual(expected)
    })

    test('for-system-time-between-returns-nothing-before-the-row-existed', async () => {
        const expected: Array<{ id: number }> = []
        ctx.mockNext(expected)

        const planVersions = ctx.conn.forSystemTimeBetween(tServicePlan, 'planVersions', new Date('2023-01-01T00:00:00.000Z'), new Date('2023-12-01T00:00:00.000Z'))

        const result = await ctx.conn.selectFrom(planVersions)
            .where(planVersions.id.equals(1))
            .select({ id: planVersions.id })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from service_plan for system_time between @0 and @1  where id = @2"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2023-01-01T00:00:00.000Z,
            2023-12-01T00:00:00.000Z,
            1,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        expect(result).toEqual(expected)
    })
})
