// Documentation snippets for the Dates as Date page (docs/configuration/dates-as-date.md). The releases of the seed:
// 1.2.0 signed off on 2024-01-14 at 12:30 and published on 2024-01-16 at 09:00; 1.3.0-beta.1 not signed off; 0.9.0
// signed off on 2024-02-28 at 09:00 and published on 2024-03-02 at 11:00.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tRelease } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:dates-as-date/from-a-date-to-temporal', async () => {
        ctx.mockNext([
            { version: '0.9.0', signedOffAt: '2024-02-28 09:00:00', signedOffOn: '2024-02-28', publishedAt: '2024-03-02 11:00:00' },
            { version: '1.2.0', signedOffAt: '2024-01-14 12:30:00', signedOffOn: '2024-01-14', publishedAt: '2024-01-16 09:00:00' },
        ])
        const connection = ctx.conn

        // doc-start
        const releases = await connection.selectFrom(tRelease)
            .where(tRelease.signedOffAt.toPlainDateTime().lessThan(tRelease.publishedAt))
            .select({
                version: tRelease.version,
                signedOffAt: tRelease.signedOffAt.toPlainDateTime(),
                signedOffOn: tRelease.signedOffAt.toPlainDate(),
                publishedAt: tRelease.publishedAt,
            })
            .orderBy('version')
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select version as version, signed_off_at::timestamp as "signedOffAt", cast(signed_off_at::timestamp as date) as "signedOffOn", published_at as "publishedAt" from project_release where signed_off_at::timestamp < published_at order by version"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof releases, Array<{ version: string; signedOffAt?: Temporal.PlainDateTime; signedOffOn?: Temporal.PlainDate; publishedAt: Temporal.PlainDateTime }>>>()
        expect(releases.map(release => [release.version, release.signedOffAt?.toString(), release.signedOffOn?.toString(), release.publishedAt.toString()])).toEqual([
            ['0.9.0', '2024-02-28T09:00:00', '2024-02-28', '2024-03-02T11:00:00'],
            ['1.2.0', '2024-01-14T12:30:00', '2024-01-14', '2024-01-16T09:00:00'],
        ])
    })
})
