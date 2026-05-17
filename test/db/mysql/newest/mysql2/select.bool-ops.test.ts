// Coverage of boolean-expression composition: `.and()`, `.or()`,
// `.negate()` (logical NOT — different from the arithmetic negation
// in numeric ops which is just `multiply(-1)`).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('and', async () => {
        const expected = [{ id: 1 }]  // status=open AND priority=2 → issue 1
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open').and(tIssue.priority.equals(2)))
            .select({ id: tIssue.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where \`status\` = ? and priority = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
            2,
          ]
        `)
        assertType<Exact<typeof result, Array<{ id: number }>>>()
        if (ctx.realDbEnabled) {
            expect(result).toEqual([{ id: 1 }])
        }
    })

    test('or', async () => {
        const expected = [{ id: 2 }, { id: 4 }]  // priority=1 OR status=closed
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.priority.equals(1).or(tIssue.status.equals('closed')))
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where priority = ? or \`status\` = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            "closed",
          ]
        `)
        if (ctx.realDbEnabled) {
            expect(result).toEqual([{ id: 2 }, { id: 4 }])
        }
    })

    test('negate-not', async () => {
        // NOT (status = 'open') → 2 (in_progress) + 4 (closed)
        const expected = [{ id: 2 }, { id: 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.status.equals('open').negate())
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where not (\`status\` = ?) order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "open",
          ]
        `)
        if (ctx.realDbEnabled) {
            expect(result).toEqual([{ id: 2 }, { id: 4 }])
        }
    })

    test('and-or-complex', async () => {
        // (priority<=2 AND status='open') OR status='closed'
        const expected = [{ id: 1 }, { id: 4 }]
        ctx.mockNext(expected)
        const result = await ctx.conn.selectFrom(tIssue)
            .where(
                tIssue.priority.lessOrEqual(2)
                    .and(tIssue.status.equals('open'))
                    .or(tIssue.status.equals('closed')),
            )
            .select({ id: tIssue.id })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue where (priority <= ? and \`status\` = ?) or \`status\` = ? order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
            "open",
            "closed",
          ]
        `)
        if (ctx.realDbEnabled) {
            expect(result).toEqual([{ id: 1 }, { id: 4 }])
        }
    })
})
