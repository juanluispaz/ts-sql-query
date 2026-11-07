// useLikeInsteadOfIlike: the insensitive operations with a pattern are written with like instead of ilike, whatever
// insensitiveCollation says. A collation then decides what's equal, and without one they still ignore case.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: useLikeInsteadOfIlike only exists on PostgreSqlConnection, the only database with ilike.
    /*
    test('by-default-they-are-written-with-ilike', () => {
        const unset = ctx.conn.selectFrom(tIssue)
            .where(tIssue.title.containsInsensitive('HERO'))
            .select({ id: tIssue.id })
            .query()
        expect(unset).toMatchInlineSnapshot(`"select id as id from issue where title ilike ('%' || $1 || '%')"`)

        const empty = ctx.withInsensitiveCollation('').selectFrom(tIssue)
            .where(tIssue.title.containsInsensitive('HERO'))
            .select({ id: tIssue.id })
            .query()
        expect(empty).toMatchInlineSnapshot(`"select id as id from issue where title ilike ('%' || $1 || '%')"`)

        const named = ctx.withInsensitiveCollation(ctx.exampleInsensitiveCollation).selectFrom(tIssue)
            .where(tIssue.title.containsInsensitive('HERO'))
            .select({ id: tIssue.id })
            .query()
        expect(named).toMatchInlineSnapshot(`"select id as id from issue where title ilike ('%' || $1 || '%') collate "und-x-icu""`)
    })
    */

    // NOT-APPLICABLE: useLikeInsteadOfIlike only exists on PostgreSqlConnection, the only database with ilike.
    /*
    test('with-a-collation-they-are-written-with-like', () => {
        const query = ctx.withLikeInsteadOfIlike(ctx.exampleInsensitiveCollation).selectFrom(tIssue)
            .where(tIssue.title.likeInsensitive('A%'))
            .and(tIssue.title.notLikeInsensitive('B%'))
            .and(tIssue.title.startsWithInsensitive('C'))
            .and(tIssue.title.notStartsWithInsensitive('D'))
            .and(tIssue.title.endsWithInsensitive('E'))
            .and(tIssue.title.notEndsWithInsensitive('F'))
            .and(tIssue.title.containsInsensitive('G'))
            .and(tIssue.title.notContainsInsensitive('H'))
            .select({ id: tIssue.id })
            .query()

        expect(query).toMatchInlineSnapshot(`"select id as id from issue where title like $1 collate "und-x-icu" and title not like $2 collate "und-x-icu" and title like ($3 || '%') collate "und-x-icu" and title not like ($4 || '%') collate "und-x-icu" and title like ('%' || $5) collate "und-x-icu" and title not like ('%' || $6) collate "und-x-icu" and title like ('%' || $7 || '%') collate "und-x-icu" and title not like ('%' || $8 || '%') collate "und-x-icu""`)
    })
    */

    // NOT-APPLICABLE: useLikeInsteadOfIlike only exists on PostgreSqlConnection, the only database with ilike.
    /*
    test('with-an-empty-collation-they-are-written-with-like', () => {
        const query = ctx.withLikeInsteadOfIlike('').selectFrom(tIssue)
            .where(tIssue.title.likeInsensitive('A%'))
            .and(tIssue.title.notLikeInsensitive('B%'))
            .and(tIssue.title.startsWithInsensitive('C'))
            .and(tIssue.title.notStartsWithInsensitive('D'))
            .and(tIssue.title.endsWithInsensitive('E'))
            .and(tIssue.title.notEndsWithInsensitive('F'))
            .and(tIssue.title.containsInsensitive('G'))
            .and(tIssue.title.notContainsInsensitive('H'))
            .select({ id: tIssue.id })
            .query()

        expect(query).toMatchInlineSnapshot(`"select id as id from issue where title like $1 and title not like $2 and title like ($3 || '%') and title not like ($4 || '%') and title like ('%' || $5) and title not like ('%' || $6) and title like ('%' || $7 || '%') and title not like ('%' || $8 || '%')"`)
    })
    */

    // NOT-APPLICABLE: useLikeInsteadOfIlike only exists on PostgreSqlConnection, the only database with ilike.
    /*
    test('without-a-collation-they-are-written-with-lower', () => {
        const query = ctx.withLikeInsteadOfIlike(undefined).selectFrom(tIssue)
            .where(tIssue.title.likeInsensitive('A%'))
            .and(tIssue.title.notLikeInsensitive('B%'))
            .and(tIssue.title.startsWithInsensitive('C'))
            .and(tIssue.title.notStartsWithInsensitive('D'))
            .and(tIssue.title.endsWithInsensitive('E'))
            .and(tIssue.title.notEndsWithInsensitive('F'))
            .and(tIssue.title.containsInsensitive('G'))
            .and(tIssue.title.notContainsInsensitive('H'))
            .select({ id: tIssue.id })
            .query()

        expect(query).toMatchInlineSnapshot(`"select id as id from issue where lower(title) like lower($1) and lower(title) not like lower($2) and lower(title) like lower($3 || '%') and lower(title) not like lower($4 || '%') and lower(title) like lower('%' || $5) and lower(title) not like lower('%' || $6) and lower(title) like lower('%' || $7 || '%') and lower(title) not like lower('%' || $8 || '%')"`)
    })
    */

    // NOT-APPLICABLE: useLikeInsteadOfIlike only exists on PostgreSqlConnection, the only database with ilike.
    /*
    test('without-a-collation-they-still-ignore-case', async () => {
        const conn = ctx.withLikeInsteadOfIlike(undefined)

        for (const { condition, ids } of [
            { condition: tIssue.title.likeInsensitive('UPDATE%'), ids: [1] },
            { condition: tIssue.title.likeInsensitive('update%'), ids: [1] },
            { condition: tIssue.title.notLikeInsensitive('UPDATE%'), ids: [2, 3, 4] },
            { condition: tIssue.title.startsWithInsensitive('UPDATE'), ids: [1] },
            { condition: tIssue.title.notStartsWithInsensitive('UPDATE'), ids: [2, 3, 4] },
            { condition: tIssue.title.endsWithInsensitive('COPY'), ids: [1] },
            { condition: tIssue.title.notEndsWithInsensitive('COPY'), ids: [2, 3, 4] },
            { condition: tIssue.title.containsInsensitive('HERO'), ids: [1] },
            { condition: tIssue.title.containsInsensitive('esm'), ids: [3] },
            { condition: tIssue.title.notContainsInsensitive('HERO'), ids: [2, 3, 4] },
        ]) {
            const expected = ids.map((id) => ({ id }))
            ctx.mockNext(expected)
            const rows = await conn.selectFrom(tIssue).where(condition).select({ id: tIssue.id }).orderBy('id').executeSelectMany()
            expect(rows).toEqual(expected)
        }
    })
    */

    // NOT-APPLICABLE: useLikeInsteadOfIlike only exists on PostgreSqlConnection, the only database with ilike.
    /*
    test('without-a-collation-the-wildcards-of-the-value-stay-literal', async () => {
        const conn = ctx.withLikeInsteadOfIlike(undefined)

        for (const { condition, ids } of [
            { condition: tIssue.title.likeInsensitive('%'), ids: [1, 2, 3, 4] },
            { condition: tIssue.title.containsInsensitive('%'), ids: [] },
            { condition: tIssue.title.startsWithInsensitive('_'), ids: [] },
            { condition: tIssue.title.notEndsWithInsensitive('_'), ids: [1, 2, 3, 4] },
        ]) {
            const expected = ids.map((id) => ({ id }))
            ctx.mockNext(expected)
            const rows = await conn.selectFrom(tIssue).where(condition).select({ id: tIssue.id }).orderBy('id').executeSelectMany()
            expect(rows).toEqual(expected)
        }
    })
    */

    // NOT-APPLICABLE: useLikeInsteadOfIlike only exists on PostgreSqlConnection, the only database with ilike.
    /*
    test('with-a-collation-that-distinguishes-case-they-distinguish-it', async () => {
        const conn = ctx.withLikeInsteadOfIlike(ctx.exampleInsensitiveCollation)

        for (const { condition, ids } of [
            { condition: tIssue.title.containsInsensitive('hero'), ids: [1] },
            { condition: tIssue.title.containsInsensitive('HERO'), ids: [] },
            { condition: tIssue.title.likeInsensitive('Update%'), ids: [1] },
            { condition: tIssue.title.likeInsensitive('UPDATE%'), ids: [] },
        ]) {
            const expected = ids.map((id) => ({ id }))
            ctx.mockNext(expected)
            const rows = await conn.selectFrom(tIssue).where(condition).select({ id: tIssue.id }).orderBy('id').executeSelectMany()
            expect(rows).toEqual(expected)
        }
    })
    */

    // NOT-APPLICABLE: useLikeInsteadOfIlike only exists on PostgreSqlConnection, the only database with ilike.
    /*
    test('with-an-empty-collation-the-collation-of-the-column-decides', async () => {
        const conn = ctx.withLikeInsteadOfIlike('')

        for (const { condition, ids } of [
            { condition: tIssue.title.containsInsensitive('hero'), ids: [1] },
            { condition: tIssue.title.containsInsensitive('HERO'), ids: [] },
        ]) {
            const expected = ids.map((id) => ({ id }))
            ctx.mockNext(expected)
            const rows = await conn.selectFrom(tIssue).where(condition).select({ id: tIssue.id }).orderBy('id').executeSelectMany()
            expect(rows).toEqual(expected)
        }
    })
    */

    // NOT-APPLICABLE: useLikeInsteadOfIlike only exists on PostgreSqlConnection, the only database with ilike.
    /*
    test('a-nondeterministic-collation-works-in-every-operation', async () => {
        const conn = ctx.withLikeInsteadOfIlike(ctx.exampleCollationForInsensitiveEquality)

        for (const { condition, ids } of [
            { condition: tIssue.title.equalsInsensitive('UPDATE HERO COPY'), ids: [1] },
            { condition: tIssue.title.notEqualsInsensitive('UPDATE HERO COPY'), ids: [2, 3, 4] },
            { condition: tIssue.title.likeInsensitive('UPDATE%'), ids: [1] },
            { condition: tIssue.title.notLikeInsensitive('UPDATE%'), ids: [2, 3, 4] },
            { condition: tIssue.title.startsWithInsensitive('UPDATE'), ids: [1] },
            { condition: tIssue.title.notStartsWithInsensitive('UPDATE'), ids: [2, 3, 4] },
            { condition: tIssue.title.endsWithInsensitive('COPY'), ids: [1] },
            { condition: tIssue.title.notEndsWithInsensitive('COPY'), ids: [2, 3, 4] },
            { condition: tIssue.title.containsInsensitive('HERO'), ids: [1] },
            { condition: tIssue.title.notContainsInsensitive('HERO'), ids: [2, 3, 4] },
        ]) {
            const expected = ids.map((id) => ({ id }))
            ctx.mockNext(expected)
            const rows = await conn.selectFrom(tIssue).where(condition).select({ id: tIssue.id }).orderBy('id').executeSelectMany()
            expect(rows).toEqual(expected)
        }
    })
    */
})
