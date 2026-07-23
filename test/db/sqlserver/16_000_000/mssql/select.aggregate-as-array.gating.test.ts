// The gate overloads and the null-projection modifiers on the two
// aggregated-array value-source families — a subquery turned into an inline
// aggregated array via `.forUseAsInlineAggregatedArrayValue()`, and
// `connection.aggregateAsArray({...})`.
//
// Companion to `select.aggregate-as-array.allow-when.test.ts`, which owns the
// STRING-message overload on the two plain classes. This file owns what that one
// does not: the `Error`-INSTANCE overload on both classes and both of their
// null-projecting twins, the twins' own `onlyWhenOrNull` / `ignoreWhenAsNull`,
// and a gate nested inside the aggregate's element object.
//
// Both gate methods are overloaded on their second argument. The string overload
// mints a `TsSqlError` carrying `reason: 'DISALLOWED'` and the name of the gate
// that fired; the instance overload stores the caller's object and rethrows
// *that very object* unwrapped. Each test below pins whichever of the two its
// overload produces.
//
// `onlyWhenOrNull(false)` and `ignoreWhenAsNull(true)` swap the aggregate for a
// null-projecting twin carrying its own copy of the whole surface. The twins are
// idempotent: once null-projected there is no way back to the subquery, so the
// modifiers can be reapplied in either arm and the emission stays a literal null.
//
// The build-time throw is SYNCHRONOUS — the query renders before the `execute*`
// promise is created — hence the `try { await … } catch` idiom rather than
// `rejects`. `isQueryAllowed` is the sanctioned introspection seam; see
// test/LIMITATIONS.md.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { isQueryAllowed } from '../../../../lib/queryIntrospection.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('inline-aggregated-array-allow-when-false-with-error-instance-throws-that-instance', async () => {
        // A closed gate on an inline aggregated array: the query refuses to build
        // and the caller's own Error comes back unwrapped.
        const connection = ctx.conn
        const sentinel = new Error('app-level: inline aggregated array is admin-only')

        const issues = connection.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ id: tIssue.id, title: tIssue.title })
            .forUseAsInlineAggregatedArrayValue()

        const query = connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, issues: issues.allowWhen(false, sentinel) })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectOne()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBe(sentinel)
    })

    test('inline-aggregated-array-disallow-when-true-with-error-instance-throws-that-instance', async () => {
        // The inverted gate, same identity contract.
        const connection = ctx.conn
        const sentinel = new Error('app-level: feature flag blocks the inline aggregate')

        const issues = connection.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ id: tIssue.id, title: tIssue.title })
            .forUseAsInlineAggregatedArrayValue()

        const query = connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, issues: issues.disallowWhen(true, sentinel) })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectOne()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBe(sentinel)
    })

    test('null-inline-aggregated-array-allow-when-false-throws-and-introspects-disallowed', async () => {
        // A closed gate is refused even when what it guards would have rendered as
        // a harmless literal null. String overload, so the thrown error is the
        // library's own, carrying the `DISALLOWED` reason and the gate's name.
        const connection = ctx.conn

        const issues = connection.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ id: tIssue.id, title: tIssue.title })
            .forUseAsInlineAggregatedArrayValue()

        const query = connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                pid: tProject.id,
                issues: issues.onlyWhenOrNull(false).allowWhen(false, 'null-inline-aggregate gate blocks'),
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectOne()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('null-inline-aggregate gate blocks')
        const reason = thrown instanceof TsSqlError ? thrown.errorReason : undefined
        expect(reason?.reason).toBe('DISALLOWED')
        expect(reason?.reason === 'DISALLOWED' ? reason.functionName : undefined).toBe('allowWhen')
    })

    test('null-inline-aggregated-array-allow-when-false-with-error-instance-throws-that-instance', async () => {
        // The null-projecting twin carries the caller's object through unchanged,
        // exactly like the non-null one.
        const connection = ctx.conn
        const sentinel = new Error('app-level: null-projected inline aggregate is admin-only')

        const issues = connection.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ id: tIssue.id, title: tIssue.title })
            .forUseAsInlineAggregatedArrayValue()

        const query = connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, issues: issues.onlyWhenOrNull(false).allowWhen(false, sentinel) })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectOne()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBe(sentinel)
    })

    test('null-inline-aggregated-array-disallow-when-true-throws-and-introspects-disallowed', async () => {
        // The inverted gate on the null-projecting twin, string overload — so the
        // reason names `disallowWhen` rather than `allowWhen`.
        const connection = ctx.conn

        const issues = connection.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ id: tIssue.id, title: tIssue.title })
            .forUseAsInlineAggregatedArrayValue()

        const query = connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                pid: tProject.id,
                issues: issues.onlyWhenOrNull(false).disallowWhen(true, 'null-inline-aggregate disallow blocks'),
            })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectOne()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('null-inline-aggregate disallow blocks')
        const reason = thrown instanceof TsSqlError ? thrown.errorReason : undefined
        expect(reason?.reason).toBe('DISALLOWED')
        expect(reason?.reason === 'DISALLOWED' ? reason.functionName : undefined).toBe('disallowWhen')
    })

    test('null-inline-aggregated-array-disallow-when-true-with-error-instance-throws-that-instance', async () => {
        // The last of the four inline-family gate overloads.
        const connection = ctx.conn
        const sentinel = new Error('app-level: flag blocks the null-projected inline aggregate')

        const issues = connection.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ id: tIssue.id, title: tIssue.title })
            .forUseAsInlineAggregatedArrayValue()

        const query = connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({ pid: tProject.id, issues: issues.onlyWhenOrNull(false).disallowWhen(true, sentinel) })

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectOne()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBe(sentinel)
    })

    test('null-inline-aggregated-array-projection-modifiers-are-idempotent', async () => {
        // `ignoreWhenAsNull(true)` collapses the correlated aggregate subquery to
        // the dialect's literal null and widens the projection to optional. Once
        // collapsed, reapplying either modifier in either arm changes nothing — so
        // all five columns emit the same null and every key is dropped from the
        // result object. The subquery's `orderBy` is kept on `direct` to show it
        // does not survive the collapse either.
        ctx.mockNext({ pid: 1, direct: null, kept: null, dropped: null, ignored: null, keptIgnored: null })
        const connection = ctx.conn

        const issues = connection.subSelectUsing(tProject).from(tIssue)
            .where(tIssue.projectId.equals(tProject.id))
            .select({ id: tIssue.id, title: tIssue.title })
            .orderBy('id')
            .forUseAsInlineAggregatedArrayValue()

        const query = connection.selectFrom(tProject)
            .where(tProject.id.equals(1))
            .select({
                pid: tProject.id,
                direct: issues.ignoreWhenAsNull(true),
                kept: issues.onlyWhenOrNull(false).onlyWhenOrNull(true),
                dropped: issues.onlyWhenOrNull(false).onlyWhenOrNull(false),
                ignored: issues.onlyWhenOrNull(false).ignoreWhenAsNull(true),
                keptIgnored: issues.onlyWhenOrNull(false).ignoreWhenAsNull(false),
            })

        expect(isQueryAllowed(query)).toBe(true)

        const row = await query.executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as pid, null as direct, null as kept, null as dropped, null as ignored, null as keptIgnored from project where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            pid: number
            direct?: Array<{ id: number, title: string }>
            kept?: Array<{ id: number, title: string }>
            dropped?: Array<{ id: number, title: string }>
            ignored?: Array<{ id: number, title: string }>
            keptIgnored?: Array<{ id: number, title: string }>
        }>>()
        expect(row).toEqual({ pid: 1 })
    })

    test('aggregate-as-array-allow-when-false-with-error-instance-throws-that-instance', async () => {
        // The other family: a gate on `connection.aggregateAsArray({...})` itself.
        const connection = ctx.conn
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const sentinel = new Error('app-level: aggregated issue array is admin-only')

        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid: tProject.id,
                issues: connection.aggregateAsArray({
                    id: tIssueLeft.id,
                    title: tIssueLeft.title,
                }).allowWhen(false, sentinel),
            })
            .groupBy('pid')

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBe(sentinel)
    })

    test('aggregate-as-array-disallow-when-true-with-error-instance-throws-that-instance', async () => {
        // The inverted gate on the same family.
        const connection = ctx.conn
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const sentinel = new Error('app-level: flag blocks the aggregated issue array')

        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid: tProject.id,
                issues: connection.aggregateAsArray({
                    id: tIssueLeft.id,
                    title: tIssueLeft.title,
                }).disallowWhen(true, sentinel),
            })
            .groupBy('pid')

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBe(sentinel)
    })

    test('null-aggregate-as-array-allow-when-false-with-error-instance-throws-that-instance', async () => {
        // Gating the null-projecting twin of `aggregateAsArray`.
        const connection = ctx.conn
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const sentinel = new Error('app-level: null-projected aggregate is admin-only')

        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid: tProject.id,
                issues: connection.aggregateAsArray({
                    id: tIssueLeft.id,
                    title: tIssueLeft.title,
                }).onlyWhenOrNull(false).allowWhen(false, sentinel),
            })
            .groupBy('pid')

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBe(sentinel)
    })

    test('null-aggregate-as-array-disallow-when-true-throws-and-introspects-disallowed', async () => {
        // The one gate overload of the four aggregate classes with neither branch
        // exercised anywhere else.
        const connection = ctx.conn
        const tIssueLeft = tIssue.forUseInLeftJoin()

        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid: tProject.id,
                issues: connection.aggregateAsArray({
                    id: tIssueLeft.id,
                    title: tIssueLeft.title,
                }).onlyWhenOrNull(false).disallowWhen(true, 'null-aggregate disallow blocks'),
            })
            .groupBy('pid')

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('null-aggregate disallow blocks')
        const reason = thrown instanceof TsSqlError ? thrown.errorReason : undefined
        expect(reason?.reason).toBe('DISALLOWED')
        expect(reason?.reason === 'DISALLOWED' ? reason.functionName : undefined).toBe('disallowWhen')
    })

    test('null-aggregate-as-array-disallow-when-true-with-error-instance-throws-that-instance', async () => {
        // The Error-instance branch of the same method.
        const connection = ctx.conn
        const tIssueLeft = tIssue.forUseInLeftJoin()
        const sentinel = new Error('app-level: flag blocks the null-projected aggregate')

        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid: tProject.id,
                issues: connection.aggregateAsArray({
                    id: tIssueLeft.id,
                    title: tIssueLeft.title,
                }).onlyWhenOrNull(false).disallowWhen(true, sentinel),
            })
            .groupBy('pid')

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBe(sentinel)
    })

    test('null-aggregate-as-array-projection-modifiers-are-idempotent', async () => {
        // The `aggregateAsArray` twin of the inline idempotence test: all four
        // arms keep the literal null, so no key survives into the result. The left
        // join and the group by stay in the emitted SQL — they come from the
        // query, not from the now-inert aggregates.
        ctx.mockNext([{ pid: 1, kept: null, dropped: null, ignored: null, keptIgnored: null }])
        const connection = ctx.conn
        const tIssueLeft = tIssue.forUseInLeftJoin()

        const query = connection.selectFrom(tProject)
            .leftJoin(tIssueLeft).on(tIssueLeft.projectId.equals(tProject.id))
            .where(tProject.id.equals(1))
            .select({
                pid: tProject.id,
                kept: connection.aggregateAsArray({
                    id: tIssueLeft.id,
                    title: tIssueLeft.title,
                }).onlyWhenOrNull(false).onlyWhenOrNull(true),
                dropped: connection.aggregateAsArray({
                    id: tIssueLeft.id,
                    title: tIssueLeft.title,
                }).onlyWhenOrNull(false).onlyWhenOrNull(false),
                ignored: connection.aggregateAsArray({
                    id: tIssueLeft.id,
                    title: tIssueLeft.title,
                }).onlyWhenOrNull(false).ignoreWhenAsNull(true),
                keptIgnored: connection.aggregateAsArray({
                    id: tIssueLeft.id,
                    title: tIssueLeft.title,
                }).onlyWhenOrNull(false).ignoreWhenAsNull(false),
            })
            .groupBy('pid')

        expect(isQueryAllowed(query)).toBe(true)

        const rows = await query.executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select project.id as pid, null as kept, null as dropped, null as ignored, null as keptIgnored from project left join issue on issue.project_id = project.id where project.id = @0 group by project.id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            pid: number
            kept?: Array<{ id: number, title: string }>
            dropped?: Array<{ id: number, title: string }>
            ignored?: Array<{ id: number, title: string }>
            keptIgnored?: Array<{ id: number, title: string }>
        }>>>()
        expect(rows).toEqual([{ pid: 1 }])
    })

    test('aggregate-as-array-with-gated-column-in-nested-element-object-introspects-disallowed', async () => {
        // The gate sits INSIDE the element object, one level down in a nested
        // `header` object. The aggregate walks its element columns structurally, so
        // a gate anywhere below it blocks the whole aggregate.
        const connection = ctx.conn

        const query = connection.selectFrom(tIssue)
            .where(tIssue.projectId.equals(1))
            .select({
                pid: tIssue.projectId,
                issues: connection.aggregateAsArray({
                    id: tIssue.id,
                    header: { title: tIssue.title.allowWhen(false, 'nested element gate blocks') },
                }),
            })
            .groupBy('pid')

        expect(isQueryAllowed(query)).toBe(false)

        let thrown: unknown
        try {
            await query.executeSelectMany()
        } catch (e) {
            thrown = e
        }
        expect(thrown).toBeInstanceOf(Error)
        expect((thrown as Error).message).toContain('nested element gate blocks')
    })
})
