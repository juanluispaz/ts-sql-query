// per-type ValueSource dispatch on a VIEW source rather than a Table.
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
import type { ReleaseTag } from '../../domain/connection.js'
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

    test('view-side-adapter-bearing-column-reads-through-the-adapter', async () => {
        // `versionBracketed` is a VIEW column carrying a trailing
        // TypeAdapter (bracketAdapter, read wraps the value in [...]). View
        // columns return a bare DBColumnImpl whose adapter read path is otherwise
        // never observed. Release 1's version is '1.2.0', so the bracketed read is
        // '[1.2.0]'. The adapter is read-only here, so no param is bound.
        const expected = [{ id: 1, versionBracketed: '[1.2.0]' }]
        ctx.mockNext([{ id: 1, versionBracketed: '1.2.0' }])
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, versionBracketed: vReleaseOverview.versionBracketed })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", version_bracketed as "versionBracketed" from release_overview where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; versionBracketed: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('view-side-virtual-column-with-adapter-reads-through-the-adapter', async () => {
        // `versionTagged` is a View REQUIRED virtualColumnFromFragment
        // (upper(version)) carrying a trailing bracketAdapter. The fragment
        // computes upper(version) in the query; the adapter then wraps the read
        // in [...]. Release 2's version is '1.3.0-beta.1', so upper →
        // '1.3.0-BETA.1', bracketed → '[1.3.0-BETA.1]'.
        const expected = [{ id: 2, versionTagged: '[1.3.0-BETA.1]' }]
        ctx.mockNext([{ id: 2, versionTagged: '1.3.0-BETA.1' }])
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({ id: vReleaseOverview.id, versionTagged: vReleaseOverview.versionTagged })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", upper(version) as "versionTagged" from release_overview where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; versionTagged: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('view-side-custom-local-time-column-projects-as-date', async () => {
        // `cutoffClock` is a customLocalTime VIEW column (the View
        // side of the customLocalTime kind). Release 1's cutoff_time is 17:00:00,
        // read as a Date normalised to 1970-01-01 17:00 UTC (TZ=UTC forced).
        const expected = [{ id: 1, cutoffClock: new Date(Date.UTC(1970, 0, 1, 17, 0, 0)) }]
        ctx.mockNext(expected)
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, cutoffClock: vReleaseOverview.cutoffClock })
            .executeSelectMany()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", cutoff_clock as "cutoffClock" from release_overview where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; cutoffClock: Date }>>>()
        expect(rows).toEqual(expected)
    })

    test('view-side-optional-adapter-bearing-column-reads-present-and-absent', async () => {
        // `channelBracketed` is an OPTIONAL VIEW column carrying a trailing
        // bracketAdapter (read wraps a present value in [...]). The view's
        // `channel_bracketed` expression is the release channel except for beta
        // releases, where it is NULL. release 1 -> 'stable' -> '[stable]'; release 2
        // (beta) -> NULL -> the optional key is absent; release 3 -> 'canary' ->
        // '[canary]'.
        const expected = [
            { id: 1, channelBracketed: '[stable]' },
            { id: 2 },
            { id: 3, channelBracketed: '[canary]' },
        ]
        ctx.mockNext([
            { id: 1, channelBracketed: 'stable' },
            { id: 2, channelBracketed: null },
            { id: 3, channelBracketed: 'canary' },
        ])
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .select({ id: vReleaseOverview.id, channelBracketed: vReleaseOverview.channelBracketed })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", channel_bracketed as "channelBracketed" from release_overview order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; channelBracketed?: string }>>>()
        expect(rows).toEqual(expected)
        // release 2's channel_bracketed is NULL, so the optional key is ABSENT
        // (not present-as-undefined) — the adapter passed the null through.
        expect('channelBracketed' in rows[1]!).toBe(false)
    })

    test('view-side-optional-custom-kind-adapter-column-reads-present-and-absent', async () => {
        // `optionalReleaseOrdinal` is an OPTIONAL VIEW column of a CUSTOM kind
        // (customInt / ReleaseTag) carrying a trailing plusOffsetAdapter (read +1000).
        // The view computes it as the release id when download_count is present, else
        // NULL. release 1 (download present) → id 1 → +1000 → 1001; release 2
        // (download NULL) → NULL → the optional key is absent (the adapter passes the
        // null through); release 3 → id 3 → 1003.
        const expected = [
            { id: 1, optionalReleaseOrdinal: 1001 as ReleaseTag },
            { id: 2 },
            { id: 3, optionalReleaseOrdinal: 1003 as ReleaseTag },
        ]
        ctx.mockNext([
            { id: 1, optionalReleaseOrdinal: 1 },
            { id: 2, optionalReleaseOrdinal: null },
            { id: 3, optionalReleaseOrdinal: 3 },
        ])
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .select({ id: vReleaseOverview.id, optionalReleaseOrdinal: vReleaseOverview.optionalReleaseOrdinal })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", optional_release_ordinal as "optionalReleaseOrdinal" from release_overview order by "id""`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, Array<{ id: number; optionalReleaseOrdinal?: ReleaseTag }>>>()
        expect(rows).toEqual(expected)
        // release 2's optional_release_ordinal is NULL, so the optional key is
        // ABSENT (the adapter passed the null through).
        expect('optionalReleaseOrdinal' in rows[1]!).toBe(false)
    })

    test('view-side-optional-virtual-column-with-adapter-reads-through-the-adapter', async () => {
        // `versionUpperTagged` is a View OPTIONAL virtualColumnFromFragment
        // (upper(version)) carrying a trailing bracketAdapter. The fragment
        // computes upper(version); the adapter wraps the read in [...]. It is
        // always present (version is required). Release 2's
        // version '1.3.0-beta.1' -> upper '1.3.0-BETA.1' -> '[1.3.0-BETA.1]'.
        const expected = [{ id: 2, versionUpperTagged: '[1.3.0-BETA.1]' }]
        ctx.mockNext([{ id: 2, versionUpperTagged: '1.3.0-BETA.1' }])
        const rows = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({ id: vReleaseOverview.id, versionUpperTagged: vReleaseOverview.versionUpperTagged })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as "id", upper(version) as "versionUpperTagged" from release_overview where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof rows, Array<{ id: number; versionUpperTagged?: string }>>>()
        expect(rows).toEqual(expected)
    })

    test('view-side-plain-columns-read-as-their-types', async () => {
        // Reading release 1 through the View: plain boolean / bigint / double / uuid /
        // localDate / localTime columns plus a custom-kind column carrying a trailing
        // adapter. is_signed TRUE, download_count 4200000042, avg_rating 4.5,
        // signing_key <uuid>, released_on 2024-01-15, cutoff_time 17:00:00; releaseOrdinal
        // reads id 1 shifted +1000 → 1001 (plusOffsetAdapter), so the mock is primed with
        // the raw 1. TZ=UTC forced.
        const expected = {
            isSigned:        true,
            downloadCount:   4200000042n,
            avgRating:       4.5,
            signingUuid:     '0a8f9c1e-1111-4222-8333-444455556666',
            releaseDayPlain: new Date(Date.UTC(2024, 0, 15, 10, 0, 0)),
            cutoffPlain:     new Date(Date.UTC(1970, 0, 1, 17, 0, 0)),
            releaseOrdinal:  1001 as ReleaseTag,
        }
        ctx.mockNext({
            isSigned:        true,
            downloadCount:   4200000042n,
            avgRating:       4.5,
            signingUuid:     '0a8f9c1e-1111-4222-8333-444455556666',
            releaseDayPlain: new Date(Date.UTC(2024, 0, 15, 10, 0, 0)),
            cutoffPlain:     new Date(Date.UTC(1970, 0, 1, 17, 0, 0)),
            releaseOrdinal:  1,
        })
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({
                isSigned:        vReleaseOverview.isSigned,
                downloadCount:   vReleaseOverview.downloadCount,
                avgRating:       vReleaseOverview.avgRating,
                signingUuid:     vReleaseOverview.signingUuid,
                releaseDayPlain: vReleaseOverview.releaseDayPlain,
                cutoffPlain:     vReleaseOverview.cutoffPlain,
                releaseOrdinal:  vReleaseOverview.releaseOrdinal,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select is_signed as "isSigned", download_count as "downloadCount", avg_rating as "avgRating", raw_to_uuid(signing_uuid) as "signingUuid", release_day_plain as "releaseDayPlain", cutoff_plain as "cutoffPlain", release_ordinal as "releaseOrdinal" from release_overview where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, {
            isSigned?:       boolean
            downloadCount?:  bigint
            avgRating?:      number
            signingUuid?:    string
            releaseDayPlain: Date
            cutoffPlain:     Date
            releaseOrdinal:  ReleaseTag
        }>>()
        expect(row).toEqual(expected)
    })

    test('view-side-plain-optional-kinds-read-absent-when-null', async () => {
        // The nullable plain-kind View columns read ABSENT when their source is
        // NULL. Release 2 has is_signed / download_count / avg_rating / signing_key
        // all NULL, so those keys are dropped; the required localDate/localTime and
        // the custom-kind+adapter columns stay present (released_on 2024-02-20,
        // cutoff_time 18:30:00, id 2 → releaseOrdinal 1002).
        const expected = {
            releaseDayPlain: new Date(Date.UTC(2024, 1, 20, 10, 0, 0)),
            cutoffPlain:     new Date(Date.UTC(1970, 0, 1, 18, 30, 0)),
            releaseOrdinal:  1002 as ReleaseTag,
        }
        ctx.mockNext({
            isSigned:        null,
            downloadCount:   null,
            avgRating:       null,
            signingUuid:     null,
            releaseDayPlain: new Date(Date.UTC(2024, 1, 20, 10, 0, 0)),
            cutoffPlain:     new Date(Date.UTC(1970, 0, 1, 18, 30, 0)),
            releaseOrdinal:  2,
        })
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({
                isSigned:        vReleaseOverview.isSigned,
                downloadCount:   vReleaseOverview.downloadCount,
                avgRating:       vReleaseOverview.avgRating,
                signingUuid:     vReleaseOverview.signingUuid,
                releaseDayPlain: vReleaseOverview.releaseDayPlain,
                cutoffPlain:     vReleaseOverview.cutoffPlain,
                releaseOrdinal:  vReleaseOverview.releaseOrdinal,
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select is_signed as "isSigned", download_count as "downloadCount", avg_rating as "avgRating", raw_to_uuid(signing_uuid) as "signingUuid", release_day_plain as "releaseDayPlain", cutoff_plain as "cutoffPlain", release_ordinal as "releaseOrdinal" from release_overview where id = :0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, {
            isSigned?:       boolean
            downloadCount?:  bigint
            avgRating?:      number
            signingUuid?:    string
            releaseDayPlain: Date
            cutoffPlain:     Date
            releaseOrdinal:  ReleaseTag
        }>>()
        expect(row).toEqual(expected)
        expect('isSigned' in row).toBe(false)
        expect('downloadCount' in row).toBe(false)
        expect('signingUuid' in row).toBe(false)
    })
})
