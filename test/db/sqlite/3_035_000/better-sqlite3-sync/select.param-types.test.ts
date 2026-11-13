// Each parameter of a query goes with the name of its type and its category, read from the context of the query
// (getQueryContext) at its index: the type of the column it's compared with, or the type of the argument when
// a function takes another one, like the positions of a substring.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { getQueryContext } from '../../../../../src/QueryContext.js'
import { tProjectRelease, vReleaseOverview } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

function paramTypes(): Array<[string | undefined, string | undefined]> {
    const params = ctx.lastParams
    return params.map((_value, index) => [getQueryContext(ctx.lastSql, params).getParam(index)?.type, getQueryContext(ctx.lastSql, params).getParam(index)?.typeCategory])
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('param-types/each-parameter-has-the-type-of-its-column', async () => {
        ctx.mockNext([{ id: 1 }])
        const rows = sync(ctx.conn.selectFrom(tProjectRelease)
            .where(tProjectRelease.id.equals(1))
            .and(tProjectRelease.version.equals('1.2.0'))
            .and(tProjectRelease.channel.equals('stable'))
            .and(tProjectRelease.signingKey.equals('0a8f9c1e-1111-4222-8333-444455556666'))
            .and(tProjectRelease.releasedOn.equals(new Date(2024, 0, 15)))
            .and(tProjectRelease.cutoffTime.equals(new Date(1970, 0, 1, 17, 0, 0)))
            .and(tProjectRelease.signedOffAt.equals(new Date(2024, 0, 14, 12, 30, 0)))
            .and(tProjectRelease.versionTag.equals('STABLE'))
            .and(tProjectRelease.versionTag.substring(0, 1).equals('S'))
            .select({ id: tProjectRelease.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from project_release where id = ?1 and version = ?2 and channel = ?3 and signing_key = ?4 and released_on = ?5 and cutoff_time = ?6 and signed_off_at = ?7 and upper(channel) = ?8 and substr(upper(channel), ?9, ?10) = ?11"`)
        expect(paramTypes()).toEqual([
            ['int', 'int'],
            ['Semver', 'customComparable'],
            ['ReleaseChannel', 'custom'],
            ['SigningKey', 'customUuid'],
            ['ReleaseDay', 'customLocalDate'],
            ['CutoffClock', 'customLocalTime'],
            ['SignOffStamp', 'customLocalDateTime'],
            ['string', 'string'],
            ['int', 'int'],
            ['int', 'int'],
            ['string', 'string'],
        ])
        assertType<Exact<typeof rows, { id: number }[]>>()
        expect(rows).toEqual([{ id: 1 }])
    })

    test('param-types/booleans-and-numbers', async () => {
        ctx.mockNext([{ id: 1 }])
        const rows = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.isSigned.equals(true))
            .and(vReleaseOverview.downloadCount.equals(4200000042n))
            .and(vReleaseOverview.avgRating.equals(4.5))
            .select({ id: vReleaseOverview.id })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from release_overview where is_signed = ?1 and download_count = ?2 and avg_rating = ?3"`)
        expect(paramTypes()).toEqual([
            ['boolean', 'boolean'],
            ['bigint', 'bigint'],
            ['double', 'double'],
        ])
        assertType<Exact<typeof rows, { id: number }[]>>()
        expect(rows).toEqual([{ id: 1 }])
    })
})
