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
import { tAppUser, tIssue, tOrganization, tProject } from '../../domain/connection.js'
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
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like concat(replace(replace(replace(full_name, '\\\\', '\\\\\\\\'), '%', '\\\\%'), '_', '\\\\_'), '%') collate utf8mb4_general_ci"`)

        await collated.selectFrom(tAppUser)
            .where(tAppUser.email.containsInsensitive(tAppUser.fullName))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like concat('%', replace(replace(replace(full_name, '\\\\', '\\\\\\\\'), '%', '\\\\%'), '_', '\\\\_'), '%') collate utf8mb4_general_ci"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tAppUser)
            .where(tAppUser.email.startsWithInsensitive(tAppUser.fullName))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where email like concat(replace(replace(replace(full_name, '\\\\', '\\\\\\\\'), '%', '\\\\%'), '_', '\\\\_'), '%')"`)
    })

    test('collation: affix operators with a uuid receiver', async () => {
        // A uuid RECEIVER (`tIssue.externalRef.asString()`) reached through the affix-insensitive
        // operators under a SET collation, then under the empty collation. The ` collate <name>`
        // suffix trails the whole comparison over the rendered uuid receiver; the empty-collation
        // arm keeps the same shape with no collate suffix. The assertions pin the emitted SQL.
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().startsWithInsensitive('0a8f'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like concat(?, '%') collate utf8mb4_general_ci"`)

        await collated.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().containsInsensitive('1111'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like concat('%', ?, '%') collate utf8mb4_general_ci"`)

        await collated.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().endsWithInsensitive('6666'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like concat('%', ?) collate utf8mb4_general_ci"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().containsInsensitive('1111'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like concat('%', ?, '%')"`)
    })

    test('collation: negated affix operators with a uuid receiver', async () => {
        // The negated twins of the affix test above: `notStartsWithInsensitive`,
        // `notContainsInsensitive` and `notEndsWithInsensitive` over the same uuid
        // RECEIVER, under a SET collation.
        //
        // That combination is the point, and it is narrower than it looks. The
        // negated operators already have collation coverage elsewhere in this file,
        // but over a PLAIN string column; and the uuid receiver already has affix
        // coverage elsewhere, but with NO collation configured. Each negated
        // operator branches on the receiver being a uuid FIRST and on the collation
        // SECOND, so uuid-and-collated is a distinct arm from both — three arms, one
        // per operator, that neither of those two families reaches.
        //
        // The empty-collation arm keeps the same shape with no collate suffix,
        // exactly as the positive trio does.
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().notStartsWithInsensitive('0a8f'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref not like concat(?, '%') collate utf8mb4_general_ci"`)

        await collated.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().notContainsInsensitive('1111'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref not like concat('%', ?, '%') collate utf8mb4_general_ci"`)

        await collated.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().notEndsWithInsensitive('6666'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref not like concat('%', ?) collate utf8mb4_general_ci"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tIssue)
            .where(tIssue.externalRef.asString().notContainsInsensitive('1111'))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref not like concat('%', ?, '%')"`)
    })

    test('collation: aggregate-array-order-by-insensitive', async () => {
        // An inline aggregate whose inner `order by` uses an INSENSITIVE mode, on
        // a connection with `insensitiveCollation` set. The insensitive-order-by
        // path applies ` collate <name>` to the ordered string column; with the
        // collation set to '' it falls back to the plain ordering (no collate).
        // The exact per-dialect emission is pinned by the snapshot below.
        const collated = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation)
        await collated.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:    tOrganization.id,
                names: collated.subSelectUsing(tOrganization).from(tProject)
                    .where(tProject.organizationId.equals(tOrganization.id))
                    .selectOneColumn(tProject.name)
                    .orderBy('result', 'asc insensitive')
                    .forUseAsInlineAggregatedArrayValue(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast((select json_arrayagg(name order by name collate utf8mb4_general_ci asc) from project where organization_id = organization.id) as char) as names from organization where id = ?"`)

        const empty = ctx.withInsensitiveCollation('')
        await empty.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .select({
                id:    tOrganization.id,
                names: empty.subSelectUsing(tOrganization).from(tProject)
                    .where(tProject.organizationId.equals(tOrganization.id))
                    .selectOneColumn(tProject.name)
                    .orderBy('result', 'asc insensitive')
                    .forUseAsInlineAggregatedArrayValue(),
            })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cast((select json_arrayagg(name order by name asc) from project where organization_id = organization.id) as char) as names from organization where id = ?"`)
    })
})
