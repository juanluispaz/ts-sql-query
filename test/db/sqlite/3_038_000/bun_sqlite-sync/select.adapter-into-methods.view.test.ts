// View bracket-adapter columns fed into a value-returning string transform.
// `vReleaseOverview.versionBracketed` (REQUIRED string) and
// `vReleaseOverview.channelBracketed` (OPTIONAL string) both carry
// `bracketAdapter` (read wraps the value in [...]), for both the required and
// the optional receiver.
//
// For every value-returning string transform, the result leaf inherits the
// column's `transformValueFromDB`, so the transformed DB value reads back
// bracketed. `length()` is the counter-example: it returns a NUMBER leaf, so
// the string-only bracketAdapter no-ops and the raw number passes through.
// The read transform runs on the mock-primed RAW value in both mock and
// real-DB modes, so the single value assertion holds unconditionally.
//
// Fixtures (seed, postgres/domain/seed.sql — release_overview view):
//   - id 1: version_bracketed '1.2.0', channel_bracketed 'stable'.
//   - id 2: version_bracketed '1.3.0-beta.1', channel_bracketed NULL.
//   - id 3: version_bracketed '0.9.0', channel_bracketed 'canary'.
// The optional `channelBracketed` is present only on ids 1 and 3, so every
// `channelBracketed` case reads a non-null row.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { vReleaseOverview } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('version-bracketed-into-to-lower-case-keeps-result-leaf-bracketed', async () => {
        // `versionBracketed.toLowerCase()` produces a value-returning transform
        // whose result leaf inherits bracketAdapter, so the lowered DB value
        // reads back bracketed. version_bracketed '1.3.0-beta.1' is already
        // lower-case, so the op is a value no-op — the observable effect is the
        // re-bracketing of the result leaf.
        const expected = { id: 2, lc: '[1.3.0-beta.1]' }
        ctx.mockNext({ id: 2, lc: '1.3.0-beta.1' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({ id: vReleaseOverview.id, lc: vReleaseOverview.versionBracketed.toLowerCase() })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, lower(version_bracketed) as lc from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; lc: string }>>()
        expect(row).toEqual(expected)
    })

    test('version-bracketed-into-to-upper-case-keeps-result-leaf-bracketed', async () => {
        // `versionBracketed.toUpperCase()` — the result leaf inherits
        // bracketAdapter, so upper('1.3.0-beta.1') = '1.3.0-BETA.1' reads back
        // bracketed → '[1.3.0-BETA.1]'. (Makes the string op observable — the
        // 'beta' segment upper-cases.)
        const expected = { id: 2, uc: '[1.3.0-BETA.1]' }
        ctx.mockNext({ id: 2, uc: '1.3.0-BETA.1' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({ id: vReleaseOverview.id, uc: vReleaseOverview.versionBracketed.toUpperCase() })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(version_bracketed) as uc from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; uc: string }>>()
        expect(row).toEqual(expected)
    })

    test('version-bracketed-into-trim-keeps-result-leaf-bracketed', async () => {
        // `versionBracketed.trim()` — the result leaf inherits bracketAdapter, so
        // the trimmed DB value reads back bracketed. version_bracketed '1.2.0'
        // has no surrounding whitespace, so trim is a value no-op — the
        // observable effect is the re-bracketing of the result leaf.
        const expected = { id: 1, tm: '[1.2.0]' }
        ctx.mockNext({ id: 1, tm: '1.2.0' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, tm: vReleaseOverview.versionBracketed.trim() })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, trim(version_bracketed) as tm from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; tm: string }>>()
        expect(row).toEqual(expected)
    })

    test('version-bracketed-into-trim-left-keeps-result-leaf-bracketed', async () => {
        // `versionBracketed.trimLeft()` — the result leaf inherits bracketAdapter.
        // version_bracketed '1.2.0' has no leading whitespace, so ltrim is a value
        // no-op — the observable effect is the re-bracketing of the result leaf.
        const expected = { id: 1, tl: '[1.2.0]' }
        ctx.mockNext({ id: 1, tl: '1.2.0' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, tl: vReleaseOverview.versionBracketed.trimLeft() })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ltrim(version_bracketed) as tl from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; tl: string }>>()
        expect(row).toEqual(expected)
    })

    test('version-bracketed-into-trim-right-keeps-result-leaf-bracketed', async () => {
        // `versionBracketed.trimRight()` — the result leaf inherits bracketAdapter.
        // version_bracketed '1.2.0' has no trailing whitespace, so rtrim is a value
        // no-op — the observable effect is the re-bracketing of the result leaf.
        const expected = { id: 1, tr: '[1.2.0]' }
        ctx.mockNext({ id: 1, tr: '1.2.0' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, tr: vReleaseOverview.versionBracketed.trimRight() })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, rtrim(version_bracketed) as tr from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; tr: string }>>()
        expect(row).toEqual(expected)
    })

    // NOT-SUPPORTED: this SQLite build has no reverse() function.
    /*
    test('version-bracketed-into-reverse-keeps-result-leaf-bracketed', async () => {
        // `versionBracketed.reverse()` — the result leaf inherits bracketAdapter,
        // so reverse('1.3.0-beta.1') = '1.ateb-0.3.1' reads back bracketed →
        // '[1.ateb-0.3.1]'. (Makes the string op observable — reverse is not a
        // no-op on this value.)
        const expected = { id: 2, rev: '[1.ateb-0.3.1]' }
        ctx.mockNext({ id: 2, rev: '1.ateb-0.3.1' })
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({ id: vReleaseOverview.id, rev: vReleaseOverview.versionBracketed.reverse() })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, reverse(version_bracketed) as rev from release_overview where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; rev: string }>>()
        expect(row).toEqual(expected)
    })
    */

    test('version-bracketed-into-substring-keeps-result-leaf-bracketed', async () => {
        // `versionBracketed.substring(0, 3)` returns the first 3 chars of
        // '1.3.0-beta.1' = '1.3'; the result leaf inherits bracketAdapter, so it
        // reads back bracketed → '[1.3]'.
        const expected = { id: 2, sg: '[1.3]' }
        ctx.mockNext({ id: 2, sg: '1.3' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({ id: vReleaseOverview.id, sg: vReleaseOverview.versionBracketed.substring(0, 3) })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(version_bracketed, ?, ?) as sg from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; sg: string }>>()
        expect(row).toEqual(expected)
    })

    test('version-bracketed-into-substr-keeps-result-leaf-bracketed', async () => {
        // `versionBracketed.substr(0, 3)` returns the first 3 chars of
        // '1.3.0-beta.1' = '1.3'; the result leaf inherits bracketAdapter, so it
        // reads back bracketed → '[1.3]'.
        const expected = { id: 2, sb: '[1.3]' }
        ctx.mockNext({ id: 2, sb: '1.3' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({ id: vReleaseOverview.id, sb: vReleaseOverview.versionBracketed.substr(0, 3) })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(version_bracketed, ?, ?) as sb from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; sb: string }>>()
        expect(row).toEqual(expected)
    })

    test('version-bracketed-into-concat-keeps-result-leaf-bracketed', async () => {
        // `versionBracketed.concat('!')` — the result leaf inherits the receiver's
        // bracketAdapter, so '1.3.0-beta.1' || '!' = '1.3.0-beta.1!' reads back
        // bracketed → '[1.3.0-beta.1!]'.
        const expected = { id: 2, cc: '[1.3.0-beta.1!]' }
        ctx.mockNext({ id: 2, cc: '1.3.0-beta.1!' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({ id: vReleaseOverview.id, cc: vReleaseOverview.versionBracketed.concat('!') })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, version_bracketed || ? as cc from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; cc: string }>>()
        expect(row).toEqual(expected)
    })

    test('version-bracketed-into-replace-all-keeps-result-leaf-bracketed', async () => {
        // `versionBracketed.replaceAll('.', '_')` — the result leaf inherits
        // bracketAdapter, so replace('1.3.0-beta.1', '.', '_') = '1_3_0-beta_1'
        // reads back bracketed → '[1_3_0-beta_1]'. (Makes the string op observable
        // — all three dots are replaced.)
        const expected = { id: 2, rp: '[1_3_0-beta_1]' }
        ctx.mockNext({ id: 2, rp: '1_3_0-beta_1' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({ id: vReleaseOverview.id, rp: vReleaseOverview.versionBracketed.replaceAll('.', '_') })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(version_bracketed, ?, ?) as rp from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            ".",
            "_",
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; rp: string }>>()
        expect(row).toEqual(expected)
    })

    test('version-bracketed-into-length-passes-through-number-leaf', async () => {
        // `versionBracketed.length()` returns a NUMBER result leaf, so
        // bracketAdapter no-ops (it only wraps string reads; a number passes
        // through raw). length('1.3.0-beta.1') = 12 reads back as the raw number
        // 12, NOT bracketed.
        const expected = { id: 2, len: 12 }
        ctx.mockNext({ id: 2, len: 12 })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(2))
            .select({ id: vReleaseOverview.id, len: vReleaseOverview.versionBracketed.length() })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, length(version_bracketed) as len from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof row, { id: number; len: number }>>()
        expect(row).toEqual(expected)
    })

    test('channel-bracketed-into-to-lower-case-keeps-result-leaf-bracketed', async () => {
        // `channelBracketed.toLowerCase()` on the OPTIONAL receiver — the result
        // leaf inherits bracketAdapter and projects as `lc?: string`. channel
        // 'stable' (id 1) is already lower-case, so the op is a value no-op — the
        // observable effect is the re-bracketing of the result leaf → '[stable]'.
        const expected = { id: 1, lc: '[stable]' }
        ctx.mockNext({ id: 1, lc: 'stable' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, lc: vReleaseOverview.channelBracketed.toLowerCase() })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, lower(channel_bracketed) as lc from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; lc?: string }>>()
        expect(row).toEqual(expected)
    })

    test('channel-bracketed-into-to-upper-case-keeps-result-leaf-bracketed', async () => {
        // `channelBracketed.toUpperCase()` on the OPTIONAL receiver — the result
        // leaf inherits bracketAdapter and projects as `uc?: string`, so
        // upper('stable') = 'STABLE' reads back bracketed → '[STABLE]'. (Makes the
        // string op observable.)
        const expected = { id: 1, uc: '[STABLE]' }
        ctx.mockNext({ id: 1, uc: 'STABLE' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, uc: vReleaseOverview.channelBracketed.toUpperCase() })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, upper(channel_bracketed) as uc from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; uc?: string }>>()
        expect(row).toEqual(expected)
    })

    test('channel-bracketed-into-trim-keeps-result-leaf-bracketed', async () => {
        // `channelBracketed.trim()` on the OPTIONAL receiver — the result leaf
        // inherits bracketAdapter and projects as `tm?: string`. channel 'stable'
        // has no surrounding whitespace, so trim is a value no-op — the observable
        // effect is the re-bracketing of the result leaf → '[stable]'.
        const expected = { id: 1, tm: '[stable]' }
        ctx.mockNext({ id: 1, tm: 'stable' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, tm: vReleaseOverview.channelBracketed.trim() })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, trim(channel_bracketed) as tm from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; tm?: string }>>()
        expect(row).toEqual(expected)
    })

    test('channel-bracketed-into-trim-left-keeps-result-leaf-bracketed', async () => {
        // `channelBracketed.trimLeft()` on the OPTIONAL receiver — the result leaf
        // inherits bracketAdapter and projects as `tl?: string`. channel 'stable'
        // has no leading whitespace, so ltrim is a value no-op — the observable
        // effect is the re-bracketing of the result leaf → '[stable]'.
        const expected = { id: 1, tl: '[stable]' }
        ctx.mockNext({ id: 1, tl: 'stable' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, tl: vReleaseOverview.channelBracketed.trimLeft() })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, ltrim(channel_bracketed) as tl from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; tl?: string }>>()
        expect(row).toEqual(expected)
    })

    test('channel-bracketed-into-trim-right-keeps-result-leaf-bracketed', async () => {
        // `channelBracketed.trimRight()` on the OPTIONAL receiver — the result leaf
        // inherits bracketAdapter and projects as `tr?: string`. channel 'stable'
        // has no trailing whitespace, so rtrim is a value no-op — the observable
        // effect is the re-bracketing of the result leaf → '[stable]'.
        const expected = { id: 1, tr: '[stable]' }
        ctx.mockNext({ id: 1, tr: 'stable' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, tr: vReleaseOverview.channelBracketed.trimRight() })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, rtrim(channel_bracketed) as tr from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; tr?: string }>>()
        expect(row).toEqual(expected)
    })

    // NOT-SUPPORTED: this SQLite build has no reverse() function.
    /*
    test('channel-bracketed-into-reverse-keeps-result-leaf-bracketed', async () => {
        // `channelBracketed.reverse()` on the OPTIONAL receiver — the result leaf
        // inherits bracketAdapter and projects as `rev?: string`, so
        // reverse('stable') = 'elbats' reads back bracketed → '[elbats]'. (Makes
        // the string op observable.)
        const expected = { id: 1, rev: '[elbats]' }
        ctx.mockNext({ id: 1, rev: 'elbats' })
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, rev: vReleaseOverview.channelBracketed.reverse() })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, reverse(channel_bracketed) as rev from release_overview where id = $1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; rev?: string }>>()
        expect(row).toEqual(expected)
    })
    */

    test('channel-bracketed-into-substring-keeps-result-leaf-bracketed', async () => {
        // `channelBracketed.substring(0, 3)` on the OPTIONAL receiver returns the
        // first 3 chars of 'stable' = 'sta'; the result leaf inherits
        // bracketAdapter and projects as `sg?: string`, reading back → '[sta]'.
        const expected = { id: 1, sg: '[sta]' }
        ctx.mockNext({ id: 1, sg: 'sta' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, sg: vReleaseOverview.channelBracketed.substring(0, 3) })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(channel_bracketed, ?, ?) as sg from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; sg?: string }>>()
        expect(row).toEqual(expected)
    })

    test('channel-bracketed-into-substr-keeps-result-leaf-bracketed', async () => {
        // `channelBracketed.substr(0, 3)` on the OPTIONAL receiver returns the
        // first 3 chars of 'stable' = 'sta'; the result leaf inherits
        // bracketAdapter and projects as `sb?: string`, reading back → '[sta]'.
        const expected = { id: 1, sb: '[sta]' }
        ctx.mockNext({ id: 1, sb: 'sta' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, sb: vReleaseOverview.channelBracketed.substr(0, 3) })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, substr(channel_bracketed, ?, ?) as sb from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
            3,
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; sb?: string }>>()
        expect(row).toEqual(expected)
    })

    test('channel-bracketed-into-concat-keeps-result-leaf-bracketed', async () => {
        // `channelBracketed.concat('!')` on the OPTIONAL receiver — the result leaf
        // inherits bracketAdapter and projects as `cc?: string`, so 'stable' || '!'
        // = 'stable!' reads back bracketed → '[stable!]'.
        const expected = { id: 1, cc: '[stable!]' }
        ctx.mockNext({ id: 1, cc: 'stable!' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, cc: vReleaseOverview.channelBracketed.concat('!') })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, channel_bracketed || ? as cc from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "!",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; cc?: string }>>()
        expect(row).toEqual(expected)
    })

    test('channel-bracketed-into-replace-all-keeps-result-leaf-bracketed', async () => {
        // `channelBracketed.replaceAll('a', 'A')` on the OPTIONAL receiver — the
        // result leaf inherits bracketAdapter and projects as `rp?: string`, so
        // replace('stable', 'a', 'A') = 'stAble' reads back bracketed → '[stAble]'.
        // (Makes the string op observable.)
        const expected = { id: 1, rp: '[stAble]' }
        ctx.mockNext({ id: 1, rp: 'stAble' })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, rp: vReleaseOverview.channelBracketed.replaceAll('a', 'A') })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(channel_bracketed, ?, ?) as rp from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "a",
            "A",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; rp?: string }>>()
        expect(row).toEqual(expected)
    })

    test('channel-bracketed-into-length-passes-through-number-leaf', async () => {
        // `channelBracketed.length()` on the OPTIONAL receiver returns a NUMBER
        // result leaf, so bracketAdapter no-ops (it only wraps string reads; a
        // number passes through raw) and it projects as `len?: number`.
        // length('stable') = 6 reads back as the raw number 6, NOT bracketed.
        const expected = { id: 1, len: 6 }
        ctx.mockNext({ id: 1, len: 6 })
        const row = sync(ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({ id: vReleaseOverview.id, len: vReleaseOverview.channelBracketed.length() })
            .executeSelectOne())

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, length(channel_bracketed) as len from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; len?: number }>>()
        expect(row).toEqual(expected)
    })

    test('project-name-replace-all-with-bracketed-find-string-inherits-the-operands-adapter', async () => {
        // The mirror of every test above: here the RECEIVER carries no adapter and
        // neither does the find-string, so the adapter arrives from the THIRD
        // operand. The result leaf resolves its adapter by asking the receiver
        // first, then each operand in turn, so the projection inherits the
        // bracketing adapter from the replacement column and reads back bracketed.
        //
        // The inherited adapter is invisible in the SQL — it lives purely on the
        // read path — so the VALUE is the witness. Release 1 belongs to
        // 'Marketing site' and its version is '1.2.0', so replacing 'site' with the
        // version genuinely rewrites the string, and the bracketing on top is what
        // the inherited adapter adds.
        const expected = { id: 1, rp: '[Marketing 1.2.0]' }
        ctx.mockNext({ id: 1, rp: 'Marketing 1.2.0' })
        const row = await ctx.conn.selectFrom(vReleaseOverview)
            .where(vReleaseOverview.id.equals(1))
            .select({
                id: vReleaseOverview.id,
                rp: vReleaseOverview.projectName.replaceAll('site', vReleaseOverview.versionBracketed),
            })
            .executeSelectOne()

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, replace(project_name, ?, version_bracketed) as rp from release_overview where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "site",
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number, rp: string }>>()
        expect(row).toEqual(expected)
    })
})
