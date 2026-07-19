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
import { tAppUser } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('collation: equalsInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.equalsInsensitive('ada'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email = @0 collate Latin1_General_CI_AS"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.equalsInsensitive('ada'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email = @0"`)
    })

    test('collation: notEqualsInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.notEqualsInsensitive('ada'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email <> @0 collate Latin1_General_CI_AS"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.notEqualsInsensitive('ada'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email <> @0"`)
    })

    test('collation: likeInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.likeInsensitive('ad%'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like @0 collate Latin1_General_CI_AS"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.likeInsensitive('ad%'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like @0"`)
    })

    test('collation: notLikeInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.notLikeInsensitive('ad%'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like @0 collate Latin1_General_CI_AS"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.notLikeInsensitive('ad%'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like @0"`)
    })

    test('collation: startsWithInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive('ad'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%') collate Latin1_General_CI_AS"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive('ad'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (@0 + '%')"`)
    })

    test('collation: notStartsWithInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitive('ad'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%') collate Latin1_General_CI_AS"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitive('ad'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like (@0 + '%')"`)
    })

    test('collation: endsWithInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitive('@acme.test'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0) collate Latin1_General_CI_AS"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitive('@acme.test'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0)"`)
    })

    test('collation: notEndsWithInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitive('@acme.test'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0) collate Latin1_General_CI_AS"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitive('@acme.test'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0)"`)
    })

    test('collation: containsInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive('cme'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%') collate Latin1_General_CI_AS"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive('cme'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + @0 + '%')"`)
    })

    test('collation: notContainsInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitive('cme'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%') collate Latin1_General_CI_AS"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitive('cme'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ('%' + @0 + '%')"`)
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
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive(tAppUser.fullName))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (replace(replace(replace(full_name, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%') collate Latin1_General_CI_AS"`)

        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive(tAppUser.fullName))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ('%' + replace(replace(replace(full_name, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%') collate Latin1_General_CI_AS"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive(tAppUser.fullName))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like (replace(replace(replace(full_name, '[', '[[]'), '%', '[%]'), '_', '[_]') + '%')"`)
    })

    // NOT-APPLICABLE: replaceAllInsensitive collation knobs (replaceInsensitiveCollation / Oracle insensitiveCollation opt-out) are Oracle-only
    /*
    test('replaceInsensitiveCollation opt-out emits bare replace', async () => {
        // `replaceInsensitiveCollation = ''` opts out — `replaceAllInsensitive`
        // drops the per-operand `collate BINARY_CI` (and the trailing USING_NLS_COMP reset)
        // and emits the bare native `replace(...)`, which follows the session collation.
        const conn = new ReplaceCollationOptOutConnection(ctx.conn.queryRunner)
        await conn.selectFromNoTable()
            .select({ v: conn.const('ABCabc', 'string').replaceAllInsensitive('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot()
    })
    */
    // NOT-APPLICABLE: replaceAllInsensitive collation knobs (replaceInsensitiveCollation / Oracle insensitiveCollation opt-out) are Oracle-only
    /*
    test('insensitiveCollation opt-out also emits bare replace', async () => {
        // setting `insensitiveCollation = ''` opts `replaceAllInsensitive` out the
        // same way — a distinct config guard arm reaching the same bare-replace
        // emission (the SqlBuilder falls back to `replaceInsensitiveCollation`, then
        // `insensitiveCollation`; an empty value on either disables the collate).
        const conn = new InsensitiveCollationOptOutConnection(ctx.conn.queryRunner)
        await conn.selectFromNoTable()
            .select({ v: conn.const('ABCabc', 'string').replaceAllInsensitive('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot()
    })
    */
    // NOT-APPLICABLE: replaceAllInsensitive collation knobs (replaceInsensitiveCollation / Oracle insensitiveCollation opt-out) are Oracle-only
    /*
    test('replaceInsensitiveCollation alternate collation', async () => {
        // `replaceInsensitiveCollation = 'BINARY_AI'` (accent-insensitive) forces a
        // DIFFERENT collation name than the default BINARY_CI — the same branch, a
        // different collation string on each operand.
        const conn = new AlternateReplaceCollationConnection(ctx.conn.queryRunner)
        await conn.selectFromNoTable()
            .select({ v: conn.const('ABCabc', 'string').replaceAllInsensitive('abc', 'X') })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot()
    })
    */
})
