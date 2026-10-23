// Coverage of the `__hasAggregation` introspection walker (exposed to tests via
// `queryHasAggregation`) in positions where an aggregate is SQL-INVALID and the
// engine would reject it. The walker is non-destructive scaffolding for a
// planned `query.isAllowed()`-style public API: it mirrors `__toSql` without
// rendering SQL and is never entered by any `execute*` path. An aggregate can be
// smuggled into these slots — where the fluent type-gate normally forbids one —
// by wrapping it in a self-contained scalar subquery promoted with
// `forUseAsInlineQueryValue()` (its outward source carries no aggregate marker,
// yet the walker still finds the inner aggregate).
//
// These queries are DELIBERATELY INVALID SQL and are asserted at BUILD time only
// — never executed. Each aggregating case is paired with a structurally
// identical NON-aggregating control (a plain scalar subquery, or a plain column)
// so the assertion cannot pass on a broken walker: the aggregate lives ONLY in
// the tested slot.

import { afterAll, beforeAll, describe, expect, test } from '../../../../lib/testRunner.js'
import { queryHasAggregation } from '../../../../lib/queryIntrospection.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)

    test('group-by-aggregating-inline-subquery-reports-aggregation', () => {
        // An aggregate in GROUP BY is SQL-invalid; the walker still visits the
        // group-by term. Build only — never execute.
        const issueCount = ctx.conn.selectFrom(tIssue).selectOneColumn(ctx.conn.count(tIssue.id)).forUseAsInlineQueryValue()
        const plainSub = ctx.conn.selectFrom(tIssue).selectOneColumn(tIssue.id).forUseAsInlineQueryValue()

        const aggregating = ctx.conn.selectFrom(tIssue).select({ id: tIssue.id }).groupBy(issueCount)
        const control = ctx.conn.selectFrom(tIssue).select({ id: tIssue.id }).groupBy(plainSub)

        expect(queryHasAggregation(aggregating)).toBe(true)
        expect(queryHasAggregation(control)).toBe(false)
    })

    // NOT-APPLICABLE: `.onConflictOn(...)` is typed `never` on this connection — this dialect has no on-conflict conflict-target column API.
    /*
    test('on-conflict-target-column-aggregating-inline-subquery-reports-aggregation', () => {
        // An aggregate as an on-conflict TARGET column is SQL-invalid (the target
        // must name an indexed expression); the walker still visits it. Build only.
        const issueCount = ctx.conn.selectFrom(tIssue).selectOneColumn(ctx.conn.count(tIssue.id)).forUseAsInlineQueryValue()

        const aggregating = ctx.conn.insertInto(tProject)
            .values({ organizationId: 1, slug: 'agg-target-col', name: 'X' })
            .onConflictOn(issueCount)
            .doNothing()
        const control = ctx.conn.insertInto(tProject)
            .values({ organizationId: 1, slug: 'plain-target-col', name: 'X' })
            .onConflictOn(tProject.organizationId, tProject.slug)
            .doNothing()

        expect(queryHasAggregation(aggregating)).toBe(true)
        expect(queryHasAggregation(control)).toBe(false)
    })
    */

    // NOT-APPLICABLE: `.onConflictOn(...)` is typed `never` on this connection — this dialect has no on-conflict conflict-target column API.
    /*
    test('on-conflict-target-where-aggregating-inline-subquery-reports-aggregation', () => {
        // An aggregate in the on-conflict TARGET where (the partial-index predicate)
        // is SQL-invalid; the walker still visits it. Build only.
        const issueCount = ctx.conn.selectFrom(tIssue).selectOneColumn(ctx.conn.count(tIssue.id)).forUseAsInlineQueryValue()

        const aggregating = ctx.conn.insertInto(tProject)
            .values({ organizationId: 1, slug: 'agg-target-where', name: 'X' })
            .onConflictOn(tProject.organizationId, tProject.slug)
            .where(tProject.id.greaterThan(issueCount))
            .doNothing()
        const control = ctx.conn.insertInto(tProject)
            .values({ organizationId: 1, slug: 'plain-target-where', name: 'X' })
            .onConflictOn(tProject.organizationId, tProject.slug)
            .where(tProject.archivedAt.isNull())
            .doNothing()

        expect(queryHasAggregation(aggregating)).toBe(true)
        expect(queryHasAggregation(control)).toBe(false)
    })
    */

    test('compound-order-by-aggregating-inline-subquery-reports-aggregation', () => {
        // An aggregate in a COMPOUND (union) ORDER BY renders as `order by (<scalar
        // subquery>)`, which some engines reject; the walker still visits it while
        // both members are non-aggregating. Build only.
        const issueCount = ctx.conn.selectFrom(tIssue).selectOneColumn(ctx.conn.count(tIssue.id)).forUseAsInlineQueryValue()
        const plainSub = ctx.conn.selectFrom(tIssue).selectOneColumn(tIssue.id).forUseAsInlineQueryValue()

        const aggregating = ctx.conn.selectFrom(tProject).select({ projectId: tProject.id })
            .union(ctx.conn.selectFrom(tIssue).select({ projectId: tIssue.projectId }))
            .orderBy(issueCount)
        const control = ctx.conn.selectFrom(tProject).select({ projectId: tProject.id })
            .union(ctx.conn.selectFrom(tIssue).select({ projectId: tIssue.projectId }))
            .orderBy(plainSub)

        expect(queryHasAggregation(aggregating)).toBe(true)
        expect(queryHasAggregation(control)).toBe(false)
    })
})
