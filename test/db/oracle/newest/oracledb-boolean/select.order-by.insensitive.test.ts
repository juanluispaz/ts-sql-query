// Coverage of `.orderBy(col, 'insensitive')` (and its asc/desc/nulls
// permutations) under the two `insensitiveCollation` modes that
// `select.order-by.variants.test.ts` does NOT exercise — the existing
// variants file pins the default (`undefined`) mode where the builder
// wraps the column in `lower(...)`.
//
// The two branches covered here are:
//   - `insensitiveCollation: '<name>'` — emits `<col> collate <name>`.
//     The order-by argument must be a value source (not a SELECT alias
//     string), because some dialects only accept `COLLATE`
//     against a real column reference in ORDER BY, never against a
//     SELECT output alias. The string-alias route is verified under
//     the collation-empty mode below where no `collate` suffix is
//     emitted.
//   - `insensitiveCollation: ''` — engine handles case-insensitivity
//     itself; the builder emits the bare column with no wrapper.
//
// Some dialects reference the original column in ORDER BY (the
// expression variant) rather than the SELECT alias (the alias variant);
// this file exercises both. The exact ORDER BY form for this dialect is
// pinned by the snapshot below.
//
// `_isStringOrderByColumn` is also exercised by the last test, which
// orders by an int column with the insensitive modifier — the modifier
// is dropped silently on every dialect.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser, tIssue, tProject } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('collation-set: order-by-insensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        ctx.mockNext([])
        await collated.selectFrom(tAppUser)
            .select({ id: tAppUser.id, fullName: tAppUser.fullName })
            .orderBy(tAppUser.fullName, 'insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", full_name as "fullName" from app_user order by app_user.full_name collate BINARY_CI"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('collation-set: order-by-asc-nulls-first-insensitive', async () => {
        // Combines asc + nulls-first + insensitive. Exercises the
        // dialect-specific permutation that builds null-position +
        // collation suffix together.
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        ctx.mockNext([])
        await collated.selectFrom(tAppUser)
            .select({ id: tAppUser.id, fullName: tAppUser.fullName })
            .orderBy(tAppUser.fullName, 'asc nulls first insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", full_name as "fullName" from app_user order by app_user.full_name collate BINARY_CI asc nulls first"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('collation-set: order-by-desc-insensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        ctx.mockNext([])
        await collated.selectFrom(tAppUser)
            .select({ id: tAppUser.id, fullName: tAppUser.fullName })
            .orderBy(tAppUser.fullName, 'desc insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", full_name as "fullName" from app_user order by app_user.full_name collate BINARY_CI desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('collation-empty: order-by-from-string-insensitive', async () => {
        // String-parsing route via `orderByFromString`. Uses the
        // collation-empty mode because the dialect-COLLATE form is
        // restricted to real column refs on PG / SQL Server (see
        // header) — the empty-collation mode emits no `collate` suffix
        // so the string-alias path is safe on every dialect. Locks the
        // parser branch that accepts the `insensitive` token.
        const noWrapper = ctx.withInsensitiveCollation('')
        ctx.mockNext([])
        await noWrapper.selectFrom(tAppUser)
            .select({ id: tAppUser.id, fullName: tAppUser.fullName })
            .orderByFromString('fullName insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", full_name as "fullName" from app_user order by "fullName""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('collation-empty: order-by-insensitive-emits-no-wrapper', async () => {
        // `insensitiveCollation: ''` — the SqlBuilder is told the engine
        // handles case-insensitivity natively (e.g. a `*_ci` MySQL
        // collation or an Oracle session NLS_SORT). The modifier is
        // accepted but emits no `lower(...)` and no collate suffix.
        const noWrapper = ctx.withInsensitiveCollation('')
        ctx.mockNext([])
        await noWrapper.selectFrom(tAppUser)
            .select({ id: tAppUser.id, fullName: tAppUser.fullName })
            .orderBy(tAppUser.fullName, 'insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", full_name as "fullName" from app_user order by app_user.full_name"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('collation-set: order-by-on-non-string-column-drops-modifier', async () => {
        // `tIssue.priority` is an int column — `_isStringOrderByColumn`
        // returns false, so the `'insensitive'` modifier is dropped
        // before any collate / lower / wrapper is emitted. The output
        // is identical to a plain `.orderBy(tIssue.priority)`.
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        ctx.mockNext([])
        await collated.selectFrom(tIssue)
            .select({ id: tIssue.id, priority: tIssue.priority })
            .orderBy(tIssue.priority, 'insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", priority as "priority" from issue order by issue.priority"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    // The same two collation modes on a COMPOUND. A compound can only order
    // by a SELECT alias, so whether the collation can be applied at all
    // depends on the dialect: the ones that cannot collate an output alias
    // get the compound wrapped in `select * from (...)` first, and the
    // ordering is applied to the wrapper — where the alias IS a real input
    // column of the derived table, so collating it is legal.
    //
    // The eight labels have distinct leading letters and the one tie breaks
    // on a lowercase pair, so the row order is the same under EVERY collation
    // in the matrix, case-sensitive or not. The coverage signal here is the
    // emitted SQL, not the row order.

    test('collation-set: compound-order-by-insensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        const expected = [
            { label: 'Document /v2/users' },
            { label: 'Internal tools' },
            { label: 'Legacy app' },
            { label: 'Marketing site' },
            { label: 'Migrate to ESM' },
            { label: 'Public API' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const result = await collated.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(collated.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderBy('label', 'asc insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select * from (select name as "label" from project union select title as "label" from issue) o_1_ order by "label" collate BINARY_CI asc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })

    test('collation-empty: compound-order-by-insensitive-emits-no-wrapper', async () => {
        // With the collation left empty the engine is trusted to compare
        // case-insensitively itself, so nothing is wrapped and nothing is
        // suffixed: the compound orders by the bare alias.
        const collated = ctx.withInsensitiveCollation('')
        const expected = [
            { label: 'Document /v2/users' },
            { label: 'Internal tools' },
            { label: 'Legacy app' },
            { label: 'Marketing site' },
            { label: 'Migrate to ESM' },
            { label: 'Public API' },
            { label: 'Redesign navbar' },
            { label: 'Update hero copy' },
        ]
        ctx.mockNext(expected)
        const result = await collated.selectFrom(tProject)
            .select({ label: tProject.name })
            .union(collated.selectFrom(tIssue).select({ label: tIssue.title }))
            .orderBy('label', 'insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select name as "label" from project union select title as "label" from issue order by 1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof result, Array<{ label: string }>>>()
        expect(result).toEqual(expected)
    })
})
