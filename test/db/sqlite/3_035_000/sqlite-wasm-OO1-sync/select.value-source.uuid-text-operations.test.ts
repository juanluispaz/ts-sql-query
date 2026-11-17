// The text operators of a uuid: `like`, `startsWith`, `endsWith`, `contains` and `equalsInsensitive`, each with its
// `not`, `Insensitive` and `IfValue` forms, are methods of the uuid that apply to its text, with the same SQL and params
// as the same method on `asString()`. The insensitive ones find a part typed in upper case, a wildcard in the value is
// a literal character, the value can be a text value source, and a dynamic filter calls the same methods, on a uuid of
// the library and on one of the user.
//
// Seed: issue 1 has the external ref 0a8f9c1e-1111-4222-8333-444455556666, issue 2 7b3e9d20-2222-4c55-9b66-dddd00009999,
// and issues 3 and 4 have none; release 1 has the signing key of issue 1, release 3 the one of issue 2.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue, tProjectRelease } from '../../domain/connection.js'
import type { ILogicalValueSource, SourceOf } from '../../../../../src/typeSystem/base.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

// A condition on the issues
type IssueCondition = ILogicalValueSource<SourceOf<typeof tIssue.id>, any>

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // The same SQL and params for the method of the uuid and the same method on its text
    async function expectSameSql(ofUuid: IssueCondition, ofText: IssueCondition) {
        ctx.mockNext([])
        sync(ctx.conn.selectFrom(tIssue).where(ofUuid).select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        const uuidSql = ctx.lastSql
        const uuidParams = ctx.lastParams
        ctx.mockNext([])
        sync(ctx.conn.selectFrom(tIssue).where(ofText).select({ id: tIssue.id }).orderBy('id').executeSelectMany())
        expect(uuidSql).toBe(ctx.lastSql)
        expect(uuidParams).toEqual(ctx.lastParams)
    }

    test('uuid-text/each-operator-is-the-one-of-its-text', async () => {
        const ref = tIssue.externalRef
        await expectSameSql(ref.equalsInsensitive('0A8F9C1E-1111-4222-8333-444455556666'), ref.asString().equalsInsensitive('0A8F9C1E-1111-4222-8333-444455556666'))
        await expectSameSql(ref.notEqualsInsensitive('x'), ref.asString().notEqualsInsensitive('x'))
        await expectSameSql(ref.like('0a8f%'), ref.asString().like('0a8f%'))
        await expectSameSql(ref.notLike('0a8f%'), ref.asString().notLike('0a8f%'))
        await expectSameSql(ref.likeInsensitive('0A8F%'), ref.asString().likeInsensitive('0A8F%'))
        await expectSameSql(ref.notLikeInsensitive('0A8F%'), ref.asString().notLikeInsensitive('0A8F%'))
        await expectSameSql(ref.startsWith('0a8f'), ref.asString().startsWith('0a8f'))
        await expectSameSql(ref.notStartsWith('0a8f'), ref.asString().notStartsWith('0a8f'))
        await expectSameSql(ref.startsWithInsensitive('0A8F'), ref.asString().startsWithInsensitive('0A8F'))
        await expectSameSql(ref.notStartsWithInsensitive('0A8F'), ref.asString().notStartsWithInsensitive('0A8F'))
        await expectSameSql(ref.endsWith('6666'), ref.asString().endsWith('6666'))
        await expectSameSql(ref.notEndsWith('6666'), ref.asString().notEndsWith('6666'))
        await expectSameSql(ref.endsWithInsensitive('DDDD'), ref.asString().endsWithInsensitive('DDDD'))
        await expectSameSql(ref.notEndsWithInsensitive('DDDD'), ref.asString().notEndsWithInsensitive('DDDD'))
        await expectSameSql(ref.contains('1111'), ref.asString().contains('1111'))
        await expectSameSql(ref.notContains('1111'), ref.asString().notContains('1111'))
        await expectSameSql(ref.containsInsensitive('DDDD'), ref.asString().containsInsensitive('DDDD'))
        await expectSameSql(ref.notContainsInsensitive('DDDD'), ref.asString().notContainsInsensitive('DDDD'))
        await expectSameSql(ref.containsIfValue(null), ref.asString().containsIfValue(null))
        await expectSameSql(ref.startsWithInsensitiveIfValue('0A8F'), ref.asString().startsWithInsensitiveIfValue('0A8F'))
    })

    test('uuid-text/the-insensitive-operators-find-a-part-typed-in-upper-case', async () => {
        ctx.mockNext([{ id: 1 }])
        const startsWith = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.startsWithInsensitive('0A8F'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where lower(external_ref) like lower(?1 || '%') escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "0A8F",
          ]
        `)
        assertType<Exact<typeof startsWith, { id: number }[]>>()
        expect(startsWith).toEqual([{ id: 1 }])

        ctx.mockNext([{ id: 2 }])
        const contains = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.containsInsensitive('-DDDD0'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where lower(external_ref) like lower('%' || ?1 || '%') escape '\\' order by id"`)
        expect(contains).toEqual([{ id: 2 }])

        ctx.mockNext([{ id: 1 }])
        const equals = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.equalsInsensitive('0A8F9C1E-1111-4222-8333-444455556666'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where lower(external_ref) = lower(?1) order by id"`)
        expect(equals).toEqual([{ id: 1 }])

        ctx.mockNext([{ id: 2 }])
        const like = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.likeInsensitive('%-2222-%'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where lower(external_ref) like lower(?1) escape '\\' order by id"`)
        expect(like).toEqual([{ id: 2 }])

        ctx.mockNext([{ id: 1 }])
        const endsWith = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.endsWith('6666'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like ('%' || ?1) escape '\\' order by id"`)
        expect(endsWith).toEqual([{ id: 1 }])
    })

    test('uuid-text/a-wildcard-in-the-value-is-a-literal-character', async () => {
        // No uuid has a % or a _: contains finds none, notContains every uuid
        ctx.mockNext([])
        const withPercent = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.contains('%'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like ('%' || ?1 || '%') escape '\\' order by id"`)
        expect(withPercent).toEqual([])

        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const withoutUnderscore = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.notContainsInsensitive('_'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where lower(external_ref) not like lower('%' || ?1 || '%') escape '\\' order by id"`)
        expect(withoutUnderscore).toEqual([{ id: 1 }, { id: 2 }])
    })

    test('uuid-text/the-value-can-be-a-text-value-source', async () => {
        // Each uuid starts with its own first 4 characters
        ctx.mockNext([{ id: 1 }, { id: 2 }])
        const rows = sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.startsWith(tIssue.externalRef.asString().substr(0, 4)))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where external_ref like (replace(replace(replace(substr(external_ref, ?1, ?2), '\\', '\\\\'), '%', '\\%'), '_', '\\_') || '%') escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            4,
          ]
        `)
        expect(rows).toEqual([{ id: 1 }, { id: 2 }])
    })

    test('uuid-text/a-dynamic-filter-calls-the-methods-of-the-uuid', async () => {
        ctx.mockNext([{ id: 1 }])
        const issues = sync(ctx.conn.selectFrom(tIssue)
            .where(ctx.conn.dynamicConditionFor({ externalRef: tIssue.externalRef }).withValues({ externalRef: { startsWithInsensitive: '0A8F' } }))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())
        const dynSql = ctx.lastSql
        const dynParams = ctx.lastParams
        expect(issues).toEqual([{ id: 1 }])
        ctx.mockNext([])
        sync(ctx.conn.selectFrom(tIssue)
            .where(tIssue.externalRef.startsWithInsensitive('0A8F'))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toBe(dynSql)
        expect(ctx.lastParams).toEqual(dynParams)

        // A uuid of the user: the text operators take a text
        ctx.mockNext([{ id: 3 }])
        const releases = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(ctx.conn.dynamicConditionFor({ signingKey: tProjectRelease.signingKey }).withValues({ signingKey: { containsInsensitive: '-DDDD0' } }))
            .select({ id: tProjectRelease.id })
            .orderBy('id')
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where lower(signing_key) like lower('%' || ?1 || '%') escape '\\' order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "-DDDD0",
          ]
        `)
        expect(releases).toEqual([{ id: 3 }])
    })
})
