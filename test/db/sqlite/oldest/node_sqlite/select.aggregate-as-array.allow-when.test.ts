// `.allowWhen(...)` / `.disallowWhen(...)` on the four aggregate-as-array
// value sources land in distinct subclasses
//
// `AggregateSelectValueSource.allowWhen` →
// `AllowWhenAggregateSelectValueSource`.
// `NullAggregateSelectValueSource.allowWhen` →
// `NullAllowWhenAggregateSelectValueSource`.
// `AggregateValueAsArrayValueSource.allowWhen` →
// `AllowWhenAggregateValueAsArrayValueSource`.
// `NullAggregateValueAsArrayValueSource.allowWhen` →
// `NullAllowWhenAggregateValueAsArrayValueSource`.
//
// Each subclass's `__toSql` throws when `__allowed === false`; the
// existing [`select.value-source.allow-when.test.ts`](./select.value-source.allow-when.test.ts)
// only covers the plain `ValueSourceImpl.allowWhen`
// and never reaches any of these four. The `Null*` variants are
// reached by chaining `.onlyWhenOrNull(false)` BEFORE `.allowWhen(...)`.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/isAllowed.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('aggregate-as-array-allow-when-false-throws-on-build', async () => {
        // `aggregateAsArray({...}).allowWhen(false, '...')` constructs
        // an `AllowWhenAggregateSelectValueSource`. On build,
        // `__toSql` checks `__allowed`, sees `false`, and throws the
        // attached `TsSqlProcessingError`. The catch confirms the
        // throw fires during `executeSelectOne`, not on construction.
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
        // `aggregateAsArrayOfOneColumn(col).allowWhen(false, '...')`
        // constructs an `AllowWhenAggregateValueAsArrayValueSource`.
        // Same throw shape as the object aggregate.
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

    test('null-aggregate-as-array-via-only-when-or-null-false-then-allow-when-false-throws', async () => {
        // `.onlyWhenOrNull(false)` swaps the value source for
        // `NullAggregateSelectValueSource`; chaining
        // `.allowWhen(false, '...')` on THAT lands in
        // `NullAllowWhenAggregateSelectValueSource`. Its `__toSql`
        // throws on the disallowed path before reaching
        // the parent `_asNullValue(...)`.
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
        // Same shape as the object aggregate but for the one-column
        // variant. Lands in `NullAllowWhenAggregateValueAsArrayValueSource`.
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

    test('aggregate-as-array-allow-when-true-emits-transparently', async () => {
        // Favorable counterpart: open gate ⇒ the wrapper is transparent
        // and the aggregate renders identically to the ungated case.
        // The expected aggregated JSON shape pins that the surrounding
        // `_inlineSelectAsValue` path runs unchanged.
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
})
