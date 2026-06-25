// C12: per-type ValueSource dispatch on a VIEW source rather than a Table.
// `vReleaseOverview` is a `class extends View` whose columns are mapped with
// the branded `customComparable` (version) / `customLocalDate` (releasedOn)
// kinds, an optional `customLocalDateTime` (signedOffAt) and a
// `virtualColumnFromFragment` (versionUpper). This mirrors the table-side
// coverage in select.column-factory-types.test.ts through the View mapping,
// confirming the same projection/marshalling fires for View columns.
// TZ=UTC is forced by the suite.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { vReleaseOverview } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('view-side-custom-and-date-time-columns-project-as-their-types', async () => {
        // Release 1 surfaced through the view: version '1.2.0' (customComparable
        // → string), released_on 2024-01-15 (customLocalDate → Date normalised
        // to 10:00 UTC), signed_off_at 2024-01-14 12:30:00 (optional
        // customLocalDateTime → Date), and the virtual versionUpper =
        // upper(version).
        const expected = [{
            id:           1,
            version:      '1.2.0',
            releasedOn:   new Date(Date.UTC(2024, 0, 15, 10, 0, 0)),
            signedOffAt:  new Date(Date.UTC(2024, 0, 14, 12, 30, 0)),
            projectName:  'Marketing site',
            versionUpper: '1.2.0',
        }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({
                id:           vReleaseOverview.id,
                version:      vReleaseOverview.version,
                releasedOn:   vReleaseOverview.releasedOn,
                signedOffAt:  vReleaseOverview.signedOffAt,
                projectName:  vReleaseOverview.projectName,
                versionUpper: vReleaseOverview.versionUpper,
            })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", version as "version", released_on as "releasedOn", signed_off_at as "signedOffAt", project_name as "projectName", upper(version) as "versionUpper" from release_overview where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{
            id:           number
            version:      string
            releasedOn:   Date
            signedOffAt?: Date
            projectName:  string
            versionUpper: string
        }>>>()
        expect(rows).toEqual(expected)
    })

    test('view-side-custom-comparable-column-supports-ordering-operators', async () => {
        // The customComparable `version` on the View confers `<` / orderBy
        // (an EqualableValueSource could not). Releases below 1.3.0: 1 (1.2.0)
        // and 3 (0.9.0), ordered descending.
        const expected = [
            { id: 1, version: '1.2.0' },
            { id: 3, version: '0.9.0' },
        ]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.version.lessThan('1.3.0'))
            .select({ id: vReleaseOverview.id, version: vReleaseOverview.version })
            .orderBy('version', 'desc')
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", version as "version" from release_overview where version < :0 order by "version" desc"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "1.3.0",
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; version: string }>>>()
        expect(rows).toEqual(expected)
    })
})
