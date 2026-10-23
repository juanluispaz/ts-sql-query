// Trailing-TypeAdapter ([a2] slot) on Table columns of each kind. Before these
// fixtures, no Table column factory carried a custom-kind trailing TypeAdapter
// (only View columns did), and the plain-kind adapter slot on a Table was only
// exercised for int / string. Each column below is a columnWithDefaultValue on
// tReleaseDraft that reads its DB DEFAULT through a value-transforming adapter,
// so the adapter's read effect is observable in the result. Every test asserts
// the required read (the adapter fires -> a required leaf) and the asOptional
// read (the same adapter fires -> an optional leaf).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tReleaseDraft, type ReleaseChannel, type WorklogActivity } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('custom-int-trailing-adapter-column-read', async () => {
        // scaledCost: customInt 'Cents' + scaledTenthAdapter (read /10). Draft 1's
        // scaled_cost DEFAULT 250 reads back as 25.
        ctx.mockNext({ id: 1, v: 250 })
        const row = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.scaledCost })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, scaled_cost as \`v\` from release_draft where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: number }>>()
        expect(row).toEqual({ id: 1, v: 25 })

        ctx.mockNext({ id: 1, v: 250 })
        const opt = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.scaledCost.asOptional() })
            .executeSelectOne()
        assertType<Exact<typeof opt, { id: number; v?: number }>>()
        expect(opt).toEqual({ id: 1, v: 25 })
    })

    test('custom-double-trailing-adapter-column-read', async () => {
        // shiftedAmount: customDouble 'Money' + plusOffsetAdapter (read +1000).
        // Draft 1's shifted_amount DEFAULT 300 reads back as 1300.
        ctx.mockNext({ id: 1, v: 300 })
        const row = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.shiftedAmount })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, shifted_amount as \`v\` from release_draft where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: number }>>()
        expect(row).toEqual({ id: 1, v: 1300 })

        ctx.mockNext({ id: 1, v: 300 })
        const opt = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.shiftedAmount.asOptional() })
            .executeSelectOne()
        assertType<Exact<typeof opt, { id: number; v?: number }>>()
        expect(opt).toEqual({ id: 1, v: 1300 })
    })

    test('custom-comparable-trailing-adapter-column-read', async () => {
        // bracketVersion: customComparable 'Semver' + bracketAdapter (read wraps in
        // [...]). Draft 1's bracket_version DEFAULT '2.0.0' reads back as '[2.0.0]'.
        ctx.mockNext({ id: 1, v: '2.0.0' })
        const row = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.bracketVersion })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, bracket_version as \`v\` from release_draft where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: string }>>()
        expect(row).toEqual({ id: 1, v: '[2.0.0]' })

        ctx.mockNext({ id: 1, v: '2.0.0' })
        const opt = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.bracketVersion.asOptional() })
            .executeSelectOne()
        assertType<Exact<typeof opt, { id: number; v?: string }>>()
        expect(opt).toEqual({ id: 1, v: '[2.0.0]' })
    })

    test('custom-trailing-adapter-column-read', async () => {
        // bracketChannel: custom 'ReleaseChannel' + bracketAdapter. Draft 1's
        // bracket_channel DEFAULT 'stable' reads back as '[stable]'.
        ctx.mockNext({ id: 1, v: 'stable' })
        const row = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.bracketChannel })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, bracket_channel as \`v\` from release_draft where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: ReleaseChannel }>>()
        expect(row).toEqual({ id: 1, v: '[stable]' })

        ctx.mockNext({ id: 1, v: 'stable' })
        const opt = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.bracketChannel.asOptional() })
            .executeSelectOne()
        assertType<Exact<typeof opt, { id: number; v?: ReleaseChannel }>>()
        expect(opt).toEqual({ id: 1, v: '[stable]' })
    })

    test('enum-trailing-adapter-column-read', async () => {
        // bracketActivity: enum 'WorklogActivity' + bracketAdapter. Draft 1's
        // bracket_activity DEFAULT 'coding' reads back as '[coding]'.
        ctx.mockNext({ id: 1, v: 'coding' })
        const row = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.bracketActivity })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, bracket_activity as \`v\` from release_draft where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: WorklogActivity }>>()
        expect(row).toEqual({ id: 1, v: '[coding]' })

        ctx.mockNext({ id: 1, v: 'coding' })
        const opt = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.bracketActivity.asOptional() })
            .executeSelectOne()
        assertType<Exact<typeof opt, { id: number; v?: WorklogActivity }>>()
        expect(opt).toEqual({ id: 1, v: '[coding]' })
    })

    test('custom-local-date-time-trailing-adapter-column-read', async () => {
        // shiftedStamp: customLocalDateTime 'PublishStamp' + shiftHourAdapter (read
        // +1h). Draft 1's shifted_stamp DEFAULT 2024-06-01 10:00:00 reads back as
        // 2024-06-01 11:00:00.
        ctx.mockNext({ id: 1, v: new Date(Date.UTC(2024, 5, 1, 10, 0, 0)) })
        const row = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.shiftedStamp })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, shifted_stamp as \`v\` from release_draft where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual({ id: 1, v: new Date(Date.UTC(2024, 5, 1, 11, 0, 0)) })

        ctx.mockNext({ id: 1, v: new Date(Date.UTC(2024, 5, 1, 10, 0, 0)) })
        const opt = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.shiftedStamp.asOptional() })
            .executeSelectOne()
        assertType<Exact<typeof opt, { id: number; v?: Date }>>()
        expect(opt).toEqual({ id: 1, v: new Date(Date.UTC(2024, 5, 1, 11, 0, 0)) })
    })

    test('bigint-trailing-adapter-column-read', async () => {
        // shiftedCount: bigint + plusThousandBigintAdapter (read +1000n). Draft 1's
        // shifted_count DEFAULT 5000 reads back as 6000n.
        ctx.mockNext({ id: 1, v: 5000n })
        const row = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.shiftedCount })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, shifted_count as \`v\` from release_draft where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: bigint }>>()
        expect(row).toEqual({ id: 1, v: 6000n })

        ctx.mockNext({ id: 1, v: 5000n })
        const opt = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.shiftedCount.asOptional() })
            .executeSelectOne()
        assertType<Exact<typeof opt, { id: number; v?: bigint }>>()
        expect(opt).toEqual({ id: 1, v: 6000n })
    })

    test('double-trailing-adapter-column-read', async () => {
        // shiftedRating: double + plusOffsetAdapter (read +1000). Draft 1's
        // shifted_rating DEFAULT 4.5 reads back as 1004.5.
        ctx.mockNext({ id: 1, v: 4.5 })
        const row = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.shiftedRating })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, shifted_rating as \`v\` from release_draft where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: number }>>()
        expect(row).toEqual({ id: 1, v: 1004.5 })

        ctx.mockNext({ id: 1, v: 4.5 })
        const opt = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.shiftedRating.asOptional() })
            .executeSelectOne()
        assertType<Exact<typeof opt, { id: number; v?: number }>>()
        expect(opt).toEqual({ id: 1, v: 1004.5 })
    })

    test('custom-uuid-trailing-adapter-column-read', async () => {
        // bracketSigningKey: customUuid 'SigningKey' + bracketAdapter (read wraps in
        // [...]). Draft 1's bracket_signing_key DEFAULT
        // 00000000-0000-4000-8000-000000000000 (a digits-only uuid, so no dialect's
        // case normalization changes it) reads back through the uuid base marshaller,
        // then bracketed.
        ctx.mockNext({ id: 1, v: '00000000-0000-4000-8000-000000000000' })
        const row = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.bracketSigningKey })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, bracket_signing_key as \`v\` from release_draft where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: string }>>()
        expect(row).toEqual({ id: 1, v: '[00000000-0000-4000-8000-000000000000]' })

        ctx.mockNext({ id: 1, v: '00000000-0000-4000-8000-000000000000' })
        const opt = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.bracketSigningKey.asOptional() })
            .executeSelectOne()
        assertType<Exact<typeof opt, { id: number; v?: string }>>()
        expect(opt).toEqual({ id: 1, v: '[00000000-0000-4000-8000-000000000000]' })
    })

    test('custom-local-date-trailing-adapter-column-read', async () => {
        // shiftedReleaseDay: customLocalDate 'ReleaseDay' + shiftHourAdapter (read
        // +1h). Draft 1's shifted_release_day DEFAULT 2025-03-01 reads back through the
        // localDate base marshaller, then shifted +1h.
        ctx.mockNext({ id: 1, v: new Date(Date.UTC(2025, 2, 1, 0, 0, 0)) })
        const row = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.shiftedReleaseDay })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, shifted_release_day as \`v\` from release_draft where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual({ id: 1, v: new Date(Date.UTC(2025, 2, 1, 11, 0, 0)) })

        ctx.mockNext({ id: 1, v: new Date(Date.UTC(2025, 2, 1, 0, 0, 0)) })
        const opt = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.shiftedReleaseDay.asOptional() })
            .executeSelectOne()
        assertType<Exact<typeof opt, { id: number; v?: Date }>>()
        expect(opt).toEqual({ id: 1, v: new Date(Date.UTC(2025, 2, 1, 11, 0, 0)) })
    })

    test('custom-local-time-trailing-adapter-column-read', async () => {
        // shiftedCutoff: customLocalTime 'CutoffClock' + shiftHourAdapter (read +1h).
        // Draft 1's shifted_cutoff DEFAULT 09:00:00 reads back through the localTime
        // base marshaller, then shifted +1h to 10:00:00.
        ctx.mockNext({ id: 1, v: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)) })
        const row = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.shiftedCutoff })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, shifted_cutoff as \`v\` from release_draft where id = ?"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { id: number; v: Date }>>()
        expect(row).toEqual({ id: 1, v: new Date(Date.UTC(1970, 0, 1, 10, 0, 0)) })

        ctx.mockNext({ id: 1, v: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)) })
        const opt = await ctx.conn.selectFrom(tReleaseDraft)
            .where(tReleaseDraft.id.equals(1))
            .select({ id: tReleaseDraft.id, v: tReleaseDraft.shiftedCutoff.asOptional() })
            .executeSelectOne()
        assertType<Exact<typeof opt, { id: number; v?: Date }>>()
        expect(opt).toEqual({ id: 1, v: new Date(Date.UTC(1970, 0, 1, 10, 0, 0)) })
    })
})
