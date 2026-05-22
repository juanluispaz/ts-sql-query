// Per-connection coverage of the three branches every insensitive
// comparison operator in [AbstractSqlBuilder](../../../../../src/sqlBuilders/AbstractSqlBuilder.ts)
// gates on `_connectionConfiguration.insensitiveCollation`:
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
// dialect picks a collation that ships with a default install
// (SQLite: `NOCASE`, PostgreSQL: `C`, MySQL/MariaDB:
// `utf8mb4_general_ci`, Oracle: `BINARY_CI`, SQL Server:
// `Latin1_General_CI_AS`) so the emitted SQL runs against the real DB
// in every cell — no mock-only guard needed.
//
// MySQL/MariaDB override `_startsWith/_endsWith/_contains` and their
// insensitive forms with a `concat()`-based shape, so the snapshots on
// those cells differ from the sqlite shape pinned here.

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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email = ? collate utf8mb4_general_ci"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.equalsInsensitive('ada'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email = ?"`)
    })

    test('collation: notEqualsInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.notEqualsInsensitive('ada'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email <> ? collate utf8mb4_general_ci"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.notEqualsInsensitive('ada'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email <> ?"`)
    })

    test('collation: likeInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.likeInsensitive('ad%'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ? collate utf8mb4_general_ci"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.likeInsensitive('ad%'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like ?"`)
    })

    test('collation: notLikeInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.notLikeInsensitive('ad%'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ? collate utf8mb4_general_ci"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.notLikeInsensitive('ad%'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like ?"`)
    })

    test('collation: startsWithInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive('ad'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like concat(?, '%') collate utf8mb4_general_ci"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive('ad'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like concat(?, '%')"`)
    })

    test('collation: notStartsWithInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitive('ad'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like concat(?, '%') collate utf8mb4_general_ci"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.notStartsWithInsensitive('ad'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like concat(?, '%')"`)
    })

    test('collation: endsWithInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitive('@acme.test'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like concat('%', ?) collate utf8mb4_general_ci"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.endsWithInsensitive('@acme.test'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like concat('%', ?)"`)
    })

    test('collation: notEndsWithInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitive('@acme.test'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like concat('%', ?) collate utf8mb4_general_ci"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.notEndsWithInsensitive('@acme.test'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like concat('%', ?)"`)
    })

    test('collation: containsInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive('cme'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like concat('%', ?, '%') collate utf8mb4_general_ci"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive('cme'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like concat('%', ?, '%')"`)
    })

    test('collation: notContainsInsensitive', async () => {
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitive('cme'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like concat('%', ?, '%') collate utf8mb4_general_ci"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.notContainsInsensitive('cme'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email not like concat('%', ?, '%')"`)
    })
})
