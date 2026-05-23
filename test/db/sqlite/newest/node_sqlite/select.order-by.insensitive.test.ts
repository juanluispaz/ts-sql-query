// Coverage of `.orderBy(col, 'insensitive')` (and its asc/desc/nulls
// permutations) under the two `insensitiveCollation` modes that
// `select.order-by.variants.test.ts` does NOT exercise — the existing
// variants file pins the default (`undefined`) mode where the builder
// wraps the column in `lower(...)`.
//
// The two branches covered here are:
//   - `insensitiveCollation: '<name>'` — emits `<col> collate <name>`.
//     The order-by argument must be a value source (not a SELECT alias
//     string), because PostgreSQL and SQL Server only accept `COLLATE`
//     against a real column reference in ORDER BY, never against a
//     SELECT output alias. The string-alias route is verified under
//     the collation-empty mode below where no `collate` suffix is
//     emitted.
//   - `insensitiveCollation: ''` — engine handles case-insensitivity
//     itself (typical for `_ci` MySQL/MariaDB collations or Oracle's
//     NLS_SORT settings); the builder emits the bare column with no
//     wrapper.
//
// MySQL / MariaDB take a different path through
// `AbstractMySqlMariaBDSqlBuilder._appendOrderByColumnExpressionInsensitive`
// (the **expression** variant — they reference the original column in
// ORDER BY, not the SELECT alias); every other dialect goes through
// `AbstractSqlBuilder._appendOrderByColumnAliasInsensitive` (the alias
// variant). The L202 expression-variant was previously unexercised.
//
// `_isStringOrderByColumn` is also exercised by the last test, which
// orders by an int column with the insensitive modifier — the modifier
// is dropped silently on every dialect.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tAppUser, tIssue } from '../../domain/connection.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, full_name as fullName from app_user order by app_user.full_name collate NOCASE"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, full_name as fullName from app_user order by app_user.full_name collate NOCASE asc nulls first"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })

    test('collation-set: order-by-desc-insensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        ctx.mockNext([])
        await collated.selectFrom(tAppUser)
            .select({ id: tAppUser.id, fullName: tAppUser.fullName })
            .orderBy(tAppUser.fullName, 'desc insensitive')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, full_name as fullName from app_user order by app_user.full_name collate NOCASE desc"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, full_name as fullName from app_user order by fullName"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, full_name as fullName from app_user order by app_user.full_name"`)
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, priority as priority from issue order by issue.priority"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
    })
})
