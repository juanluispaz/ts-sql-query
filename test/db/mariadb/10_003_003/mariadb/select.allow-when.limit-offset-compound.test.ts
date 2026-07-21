// `allowWhen` / `disallowWhen` introspection coverage for the SELECT
// builder paths that `select.allow-when.composition.test.ts` does not
// reach: the `__isAllowed` walker's handling of a gated value source in
//
//   - `.limit(...)` and `.offset(...)` (they accept an INumberValueSource),
//   - a `customizeQuery({...})` raw-fragment hook, and
//   - a COMPOUND query (`union`/`unionAll`/...) — both a gated column in
//     the second member and a gated `.limit(...)` on the compound itself.
//
// These pin the introspection walker (the planned `query.isAllowed()`
// API, exercised here through the `isQueryAllowed` test seam — see
// test/lib/isAllowed.ts) over query shapes it had no coverage for. The
// walker runs entirely client-side and renders no SQL, so every
// assertion is a boolean and this file is byte-identical across all 17
// cells (no per-dialect snapshots).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { isQueryAllowed } from '../../../../lib/isAllowed.js'
import { tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('allow-when/limit-gated-open-reports-allowed', () => {
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .limit(connection.const(10, 'int').allowWhen(true, 'limit gate') as any)
        expect(isQueryAllowed(query)).toBe(true)
    })

    test('allow-when/limit-gated-closed-reports-disallowed', () => {
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .limit(connection.const(10, 'int').allowWhen(false, 'limit gate blocks') as any)
        expect(isQueryAllowed(query)).toBe(false)
    })

    test('allow-when/offset-gated-closed-reports-disallowed', () => {
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .limit(10)
            .offset(connection.const(5, 'int').allowWhen(false, 'offset gate blocks') as any)
        expect(isQueryAllowed(query)).toBe(false)
    })

    test('allow-when/customize-query-gated-closed-reports-disallowed', () => {
        // A gated value source embedded in a customizeQuery raw fragment:
        // the walker descends into the customization fragments.
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                afterOrderByItems: connection.rawFragment`${tProject.id.allowWhen(false, 'customize gate blocks')} desc`,
            })
        expect(isQueryAllowed(query)).toBe(false)
    })

    test('allow-when/customize-query-gated-open-reports-allowed', () => {
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .customizeQuery({
                afterOrderByItems: connection.rawFragment`${tProject.id.allowWhen(true, 'customize gate')} desc`,
            })
        expect(isQueryAllowed(query)).toBe(true)
    })

    test('allow-when/compound-second-member-gated-closed-reports-disallowed', () => {
        // A gated column in the SECOND member of a UNION: the compound
        // builder's own `__isAllowed` must recurse into both members.
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .union(
                connection.selectFrom(tIssue)
                    .select({ id: tIssue.id.allowWhen(false, 'compound member gate blocks') }),
            )
        expect(isQueryAllowed(query)).toBe(false)
    })

    test('allow-when/compound-open-reports-allowed', () => {
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .union(
                connection.selectFrom(tIssue)
                    .select({ id: tIssue.id.allowWhen(true, 'compound member gate') }),
            )
        expect(isQueryAllowed(query)).toBe(true)
    })

    test('allow-when/compound-limit-gated-closed-reports-disallowed', () => {
        // A gated `.limit(...)` applied to the COMPOUND result.
        const connection = ctx.conn
        const query = connection.selectFrom(tProject)
            .select({ id: tProject.id })
            .union(
                connection.selectFrom(tIssue)
                    .select({ id: tIssue.id }),
            )
            .limit(connection.const(10, 'int').allowWhen(false, 'compound limit gate blocks') as any)
        expect(isQueryAllowed(query)).toBe(false)
    })
})
