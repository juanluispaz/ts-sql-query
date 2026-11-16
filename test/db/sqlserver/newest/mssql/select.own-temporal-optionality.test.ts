// Optionality-flipped own-temporal getters. The required own-temporal
// columns (`releasedOn` LocalDatesType, `cutoffTime` LocalTimesType) are read
// through their REQUIRED getter elsewhere; their OPTIONAL getter (the result-shape
// arm that yields `Date | undefined` and runs the optional-own-temporal read
// transform) is otherwise never exercised because the only optional own-temporal
// column in the domain is `signedOffAt` (LocalDateTimesType). `.asOptional()` on
// the required columns synthesises those optional getters with no new fixture; the
// value stays present (release 1 has both), so the read transform runs on a real value.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tProjectRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('own-localdate-as-optional-getter-projects-optional-date', async () => {
        // `releasedOn.asOptional()` (LocalDatesType 'ReleaseDay') projects an
        // OPTIONAL own-localDate leaf (`Date | undefined`); release 1's
        // released_on is 2024-01-15, present.
        const expected = { id: 1, releasedOn: new Date(Date.UTC(2024, 0, 15, 10, 0, 0)) }
        ctx.mockNext({ id: 1, releasedOn: new Date(Date.UTC(2024, 0, 15, 10, 0, 0)) })
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, releasedOn: tProjectRelease.releasedOn.asOptional() })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, released_on as releasedOn from project_release where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; releasedOn?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('own-localtime-as-optional-getter-projects-optional-date', async () => {
        // `cutoffTime.asOptional()` (LocalTimesType 'CutoffClock') projects an
        // OPTIONAL own-localTime leaf; release 1's cutoff_time is 17:00:00.
        const expected = { id: 1, cutoffTime: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)) }
        ctx.mockNext({ id: 1, cutoffTime: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)) })
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, cutoffTime: tProjectRelease.cutoffTime.asOptional() })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, cutoff_time as cutoffTime from project_release where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; cutoffTime?: Date }>>()
        expect(row).toEqual(expected)
    })

    test('required-own-localdatetime-getter-projects-required-date', async () => {
        // `publishedAt` is a REQUIRED LocalDateTimesType
        // ('PublishStamp') column — the required twin of the OPTIONAL
        // `signedOffAt`. Reading it through its plain getter projects a REQUIRED
        // own-localDateTime leaf (`Date`, not `Date | undefined`) and runs the
        // required-own-temporal read transform. Release 1's published_at is
        // 2024-01-16 09:00:00.
        const expected = { id: 1, publishedAt: new Date(Date.UTC(2024, 0, 16, 9, 0, 0)) }
        ctx.mockNext({ id: 1, publishedAt: new Date(Date.UTC(2024, 0, 16, 9, 0, 0)) })
        const row = await ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .select({ id: tProjectRelease.id, publishedAt: tProjectRelease.publishedAt })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, published_at as publishedAt from project_release where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; publishedAt: Date }>>()
        expect(row).toEqual(expected)
    })
})
