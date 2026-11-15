// `.allowWhen(...)` / `.disallowWhen(...)` on the aggregates as array: an aggregate (`aggregateAsArray`,
// `aggregateAsArrayOfOneColumn`), a select used as an aggregated array (`forUseAsInlineAggregatedArrayValue`), and the
// null that replaces one (`.onlyWhenOrNull(false)` BEFORE `.allowWhen(...)`). A disallowed one throws when the query is
// built, also after its optionality changes or another `allowWhen` that allows it, as any other value does.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/queryIntrospection.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('aggregate-as-array-allow-when-false-throws-on-build', async () => {
        // The throw fires when the query is built (`executeSelectOne`), not when the aggregate is made
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()
        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                issues: connection.aggregateAsArray({
                    id:    tIssueLeftJoin.id,
                    title: tIssueLeftJoin.title,
                }).allowWhen(false, 'aggregate-as-array-gate-blocks'),
            })
            .groupBy('id')

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectOne()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('aggregate-as-array-gate-blocks')
    })

    test('aggregate-as-array-of-one-column-allow-when-false-throws-on-build', async () => {
        // Same throw as the aggregate of objects
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()
        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                titles: connection.aggregateAsArrayOfOneColumn(tIssueLeftJoin.title)
                    .allowWhen(false, 'aggregate-of-one-column-gate-blocks'),
            })
            .groupBy('id')

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectOne()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('aggregate-of-one-column-gate-blocks')
    })

    test('aggregate-as-array-allow-when-false-keeps-blocking-after-changing-its-optionality', async () => {
        // Whether the array can be empty or absent changes, the gate stays
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()
        const gatedTitles = () => connection.aggregateAsArrayOfOneColumn(tIssueLeftJoin.title).allowWhen(false, 'titles-gate-blocks')

        const withEmptyArray = connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .select({ id: tProject.id, titles: gatedTitles().useEmptyArrayForNoValue() })
            .groupBy('id')
        expect(isQueryAllowed(withEmptyArray)).toBe(false)
        expect(() => withEmptyArray.query()).toThrow('titles-gate-blocks')

        const optional = connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .select({ id: tProject.id, titles: gatedTitles().asOptionalNonEmptyArray() })
            .groupBy('id')
        expect(isQueryAllowed(optional)).toBe(false)
        expect(() => optional.query()).toThrow('titles-gate-blocks')

        const inline = connection.selectFrom(tProject)
            .select({
                id: tProject.id,
                issues: connection.subSelectUsing(tProject).from(tIssue)
                    .where(tIssue.projectId.equals(tProject.id))
                    .select({ title: tIssue.title })
                    .forUseAsInlineAggregatedArrayValue()
                    .allowWhen(false, 'inline-gate-blocks')
                    .useEmptyArrayForNoValue(),
            })
        expect(isQueryAllowed(inline)).toBe(false)
        expect(() => inline.query()).toThrow('inline-gate-blocks')
    })

    test('aggregate-as-array-allow-when-false-keeps-blocking-after-another-allow-when-true', async () => {
        // A gate that allows doesn't lift an earlier one that blocks
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()
        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .select({
                id: tProject.id,
                titles: connection.aggregateAsArrayOfOneColumn(tIssueLeftJoin.title)
                    .allowWhen(false, 'first-gate-blocks')
                    .allowWhen(true, 'second-gate-allows'),
            })
            .groupBy('id')
        expect(isQueryAllowed(query)).toBe(false)
        expect(() => query.query()).toThrow('first-gate-blocks')
    })

    test('null-aggregate-as-array-via-only-when-or-null-false-then-allow-when-false-throws', async () => {
        // `.onlyWhenOrNull(false)` replaces the aggregate by null; `.allowWhen(false, '...')` on that null still throws
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()
        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                issues: connection.aggregateAsArray({
                    id:    tIssueLeftJoin.id,
                    title: tIssueLeftJoin.title,
                }).onlyWhenOrNull(false).allowWhen(false, 'null-aggregate-as-array-gate-blocks'),
            })
            .groupBy('id')

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectOne()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('null-aggregate-as-array-gate-blocks')
    })

    test('null-aggregate-as-array-of-one-column-via-only-when-or-null-false-then-allow-when-false-throws', async () => {
        // Same shape as the object aggregate but for the one-column variant
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()
        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                titles: connection.aggregateAsArrayOfOneColumn(tIssueLeftJoin.title)
                    .onlyWhenOrNull(false)
                    .allowWhen(false, 'null-aggregate-of-one-column-gate-blocks'),
            })
            .groupBy('id')

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectOne()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('null-aggregate-of-one-column-gate-blocks')
    })

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — json_arrayagg (aggregateAsArray / JSON array projection) requires MariaDB 10.5+; earlier releases have no json_arrayagg function.
    /*
    test('aggregate-as-array-allow-when-true-emits-transparently', async () => {
        // Favorable counterpart: open gate ⇒ the wrapper is transparent
        // and the aggregate renders identically to the ungated case.
        // The expected aggregated JSON shape pins that the aggregate is written as without the gate.
        const expected = { id: 1, issues: [{ id: 1, title: 'Update hero copy' }, { id: 2, title: 'Redesign navbar' }] }
        ctx.mockNext(expected)
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()

        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                issues: connection.aggregateAsArray({
                    id:    tIssueLeftJoin.id,
                    title: tIssueLeftJoin.title,
                }).allowWhen(true, 'aggregate-as-array-gate-open'),
            })
            .groupBy('id')

        expect(isQueryAllowed(query)).toBe(true)

        const row = await query.executeSelectOne()

        assertType<Exact<typeof row, { id: number; issues: Array<{ id: number; title: string }> }>>()
        if (!ctx.realDbEnabled) expect(row).toEqual(expected)
    })
    */

    // NOT-SUPPORTED: see ENGINE_SUPPORT.md — json_arrayagg (aggregateAsArray / JSON array projection) requires MariaDB 10.5+; earlier releases have no json_arrayagg function.
    /*
    test('aggregate-as-array-of-one-column-allow-when-true-emits-transparently', async () => {
        // Favorable counterpart for the one-column aggregate variant.
        const expected = { id: 1, titles: ['Update hero copy', 'Redesign navbar'] }
        ctx.mockNext(expected)
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()

        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                titles: connection.aggregateAsArrayOfOneColumn(tIssueLeftJoin.title)
                    .allowWhen(true, 'aggregate-of-one-column-gate-open'),
            })
            .groupBy('id')

        expect(isQueryAllowed(query)).toBe(true)

        const row = await query.executeSelectOne()

        assertType<Exact<typeof row, { id: number; titles: string[] }>>()
        if (!ctx.realDbEnabled) expect(row).toEqual(expected)
    })
    */

    test('null-aggregate-as-array-via-only-when-or-null-false-then-allow-when-true-emits-transparently', async () => {
        // `.onlyWhenOrNull(false).allowWhen(true, ...)` — the null
        // wrapper is in play, the gate is open. Builds successfully;
        // `onlyWhenOrNull(false)` drops the column from the projection
        // entirely (it never reaches the SELECT list).
        const expected = { id: 1 }
        ctx.mockNext(expected)
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()

        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                issues: connection.aggregateAsArray({
                    id:    tIssueLeftJoin.id,
                    title: tIssueLeftJoin.title,
                }).onlyWhenOrNull(false).allowWhen(true, 'null-aggregate-as-array-gate-open'),
            })
            .groupBy('id')

        expect(isQueryAllowed(query)).toBe(true)

        const row = await query.executeSelectOne()

        if (!ctx.realDbEnabled) expect(row).toEqual(expected)
    })

    test('null-aggregate-as-array-of-one-column-via-only-when-or-null-false-then-allow-when-true-emits-transparently', async () => {
        // Twin of the previous test for the one-column variant.
        const expected = { id: 1 }
        ctx.mockNext(expected)
        const connection = ctx.conn
        const tIssueLeftJoin = tIssue.forUseInLeftJoin()

        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeftJoin).on(tIssueLeftJoin.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                id:     tProject.id,
                titles: connection.aggregateAsArrayOfOneColumn(tIssueLeftJoin.title)
                    .onlyWhenOrNull(false)
                    .allowWhen(true, 'null-aggregate-of-one-column-gate-open'),
            })
            .groupBy('id')

        expect(isQueryAllowed(query)).toBe(true)

        const row = await query.executeSelectOne()

        if (!ctx.realDbEnabled) expect(row).toEqual(expected)
    })

    test('null-inline-aggregated-array-via-only-when-or-null-false-then-allow-when-true-emits-transparently', async () => {
        // The inline-subquery form: `forUseAsInlineAggregatedArrayValue()`
        // then `.onlyWhenOrNull(false).allowWhen(true, ...)`. The column
        // renders as a typed NULL, so it is absent from every row.
        const expected = [{ id: 2 }, { id: 3 }]
        ctx.mockNext(expected)
        const connection = ctx.conn

        const projectIssues = connection.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ id: tIssue.id, title: tIssue.title })
            .forUseAsInlineAggregatedArrayValue()
            .onlyWhenOrNull(false)
            .allowWhen(true, 'null-inline-aggregate-gate-open')

        const query = connection.selectFrom(tProject)
            .where(tProject.id.in([2, 3]))
            .select({ id: tProject.id, issues: projectIssues })
            .orderBy('id')

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast(null as char) as issues from project where id in (?, ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            3,
          ]
        `)
        expect(rows).toEqual(expected)
    })
})

// Tests referencing these are commented out above with NOT-SUPPORTED
// markers; keep the bindings referenced so noUnusedLocals stays green.
void assertType
export type { Exact }
