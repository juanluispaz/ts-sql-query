// Per-connection coverage of the three branches every insensitive
// comparison operator gates on `_connectionConfiguration.insensitiveCollation`:
//
//   - `collation` set to a non-empty string: emits the native form
//     plus ` collate <name>`.
//   - `collation === ''`: emits the native form with no `lower(...)`
//     wrapper and no collate suffix (the "engine handles it" path).
//   - `collation === undefined` (default): wraps both sides in
//     `lower(...)`. This is what the rest of the suite exercises
//     (see [select.where.operators-insensitive.test.ts](./select.where.operators-insensitive.test.ts))
//     so we don't repeat it here.
//
// `ctx.withInsensitiveCollation(...)` returns a `DBConnection` whose
// `insensitiveCollation` is pinned to the requested value while sharing
// `ctx.conn`'s underlying `CaptureInterceptor` and driver. The
// non-empty value comes from `ctx.exampleInsensitiveCollation` — each
// dialect picks a collation that ships with a default install, so the
// emitted SQL runs against the real DB in every cell — no mock-only
// guard needed.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { tAppUser, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'


describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('collation: equalsInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        sync(collated.selectFrom(tAppUser)
            .where(tAppUser.email.equalsInsensitive('ada'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email = ? collate NOCASE"`)

        const empty = ctx.withInsensitiveCollation('')
        sync(empty.selectFrom(tAppUser)
            .where(tAppUser.email.equalsInsensitive('ada'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email = ?"`)
    })

    test('collation: notEqualsInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        sync(collated.selectFrom(tAppUser)
            .where(tAppUser.email.notEqualsInsensitive('ada'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email <> ? collate NOCASE"`)

        const empty = ctx.withInsensitiveCollation('')
        sync(empty.selectFrom(tAppUser)
            .where(tAppUser.email.notEqualsInsensitive('ada'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email <> ?"`)
    })

    test('collation: likeInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        sync(collated.selectFrom(tAppUser)
            .where(tAppUser.email.likeInsensitive('ad%'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ? collate NOCASE escape '\\'"`)

        const empty = ctx.withInsensitiveCollation('')
        sync(empty.selectFrom(tAppUser)
            .where(tAppUser.email.likeInsensitive('ad%'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ? escape '\\'"`)
    })

    test('collation: notLikeInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        sync(collated.selectFrom(tAppUser)
            .where(tAppUser.email.notLikeInsensitive('ad%'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ? collate NOCASE escape '\\'"`)

        const empty = ctx.withInsensitiveCollation('')
        sync(empty.selectFrom(tAppUser)
            .where(tAppUser.email.notLikeInsensitive('ad%'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ? escape '\\'"`)
    })

    test('collation: startsWithInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        sync(collated.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive('ad'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (? || '%') collate NOCASE escape '\\'"`)

        const empty = ctx.withInsensitiveCollation('')
        sync(empty.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive('ad'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (? || '%') escape '\\'"`)
    })

    test('collation: notStartsWithInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        sync(collated.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitive('ad'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (? || '%') collate NOCASE escape '\\'"`)

        const empty = ctx.withInsensitiveCollation('')
        sync(empty.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitive('ad'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (? || '%') escape '\\'"`)
    })

    test('collation: endsWithInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        sync(collated.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitive('@acme.test'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || ?) collate NOCASE escape '\\'"`)

        const empty = ctx.withInsensitiveCollation('')
        sync(empty.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitive('@acme.test'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || ?) escape '\\'"`)
    })

    test('collation: notEndsWithInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        sync(collated.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitive('@acme.test'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' || ?) collate NOCASE escape '\\'"`)

        const empty = ctx.withInsensitiveCollation('')
        sync(empty.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitive('@acme.test'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' || ?) escape '\\'"`)
    })

    test('collation: containsInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        sync(collated.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive('cme'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || ? || '%') collate NOCASE escape '\\'"`)

        const empty = ctx.withInsensitiveCollation('')
        sync(empty.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive('cme'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || ? || '%') escape '\\'"`)
    })

    test('collation: notContainsInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        sync(collated.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitive('cme'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' || ? || '%') collate NOCASE escape '\\'"`)

        const empty = ctx.withInsensitiveCollation('')
        sync(empty.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitive('cme'))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' || ? || '%') escape '\\'"`)
    })
    test('collation: affix operators with a value-source (column) needle', async () => {
        // The insensitive-affix operators reached with a VALUE-SOURCE (column)
        // needle instead of a string literal, under a SET collation. The needle
        // renders as the column expression (`full_name`) — no bound param for the
        // needle — inside the `(... || '%')` affix, and the ` collate <name>` suffix
        // still trails the whole comparison. The empty-collation arm keeps the same
        // column needle with no
        // collate suffix. No email starts with / contains a user's own full name,
        // so both queries match no rows — the assertions pin the emitted SQL.
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        sync(collated.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive(tAppUser.fullName))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (replace(replace(replace(full_name, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%') collate NOCASE escape '\\'"`)

        sync(collated.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive(tAppUser.fullName))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' || replace(replace(replace(full_name, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%') collate NOCASE escape '\\'"`)

        const empty = ctx.withInsensitiveCollation('')
        sync(empty.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive(tAppUser.fullName))
            .select({ id: tAppUser.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (replace(replace(replace(full_name, '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%') escape '\\'"`)
    })


    test('replaceAllInsensitiveFunction routes through the named UDF', async () => {
        // With `replaceAllInsensitiveFunction = 'ci_replace'`, `replaceAllInsensitive`
        // emits `ci_replace(?, ?, ?)` instead of the case-sensitive `replace(...)`
        // fallback. `ci_replace` folds case, so 'ABCabc' with 'abc' → 'X' rewrites both
        // 'ABC' and 'abc' → 'XX'.
                ctx.mockNext([{ v: 'XX' }])
const conn = ctx.withReplaceAllInsensitiveFunction('ci_replace')
        const rows = sync(conn.selectFromNoTable()
            .select({ v: conn.const('ABCabc', 'string').replaceAllInsensitive('abc', 'X') })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select ci_replace(?, ?, ?) as "v""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "ABCabc",
            "abc",
            "X",
          ]
        `)
        expect(rows).toEqual([{ v: 'XX' }])
    })

    test('collation: affix operators with a uuid receiver', async () => {
        // A uuid RECEIVER (`tIssue.externalRef.asString()`) reached through the affix-insensitive
        // operators under a SET collation, then under the empty collation. The ` collate <name>`
        // suffix trails the whole comparison over the rendered uuid receiver; the empty-collation
        // arm keeps the same shape with no collate suffix. The assertions pin the emitted SQL.
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        sync(collated.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().startsWithInsensitive('0a8f'))
            .select({ id: tIssue.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like (? || '%') collate NOCASE escape '\\'"`)

        sync(collated.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().containsInsensitive('1111'))
            .select({ id: tIssue.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like ('%' || ? || '%') collate NOCASE escape '\\'"`)

        sync(collated.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().endsWithInsensitive('6666'))
            .select({ id: tIssue.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like ('%' || ?) collate NOCASE escape '\\'"`)

        const empty = ctx.withInsensitiveCollation('')
        sync(empty.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().containsInsensitive('1111'))
            .select({ id: tIssue.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like ('%' || ? || '%') escape '\\'"`)
    })

})
