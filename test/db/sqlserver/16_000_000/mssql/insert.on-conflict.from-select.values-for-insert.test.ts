// An insert from a select whose update of the conflict reads the row to insert.

import { afterAll, beforeAll, beforeEach, describe } from '../../../../lib/testRunner.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    // NOT-APPLICABLE: this database has no INSERT…ON CONFLICT.
    /*
    test('from-select-do-update-reads-the-row-to-insert', async () => {
        ctx.mockNext(1)
        ctx.mockNext('Europe')
        await ctx.withRollback(async () => {
            const forInsert = tCountry.valuesForInsert()
            const source = ctx.conn.selectFrom(tCountry)
                .where(tCountry.code.equals('GB'))
                .select({ code: tCountry.code, name: tCountry.region, region: tCountry.region })
            await ctx.conn.insertInto(tCountry)
                .from(source)
                .onConflictOn(tCountry.code)
                .doUpdateSet({ name: forInsert.name })
                .executeInsert()
            expect(ctx.lastSql).toMatchInlineSnapshot()
            expect(await ctx.conn.selectFrom(tCountry).where(tCountry.code.equals('GB')).selectOneColumn(tCountry.name).executeSelectOne()).toBe('Europe')
        })
    })
    */
})
