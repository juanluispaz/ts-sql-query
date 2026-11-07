// What each text format of dates and times reads and writes, and the normalization of the rows that an earlier version
// wrote with two widths, as the migration guide gives it. These run on the database: a value that SQLite computes
// is read as text through a fragment of type string. The suite runs in UTC, so the local formats write the same text
// as the UTC ones.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tColMatrixOptional } from '../../domain/connection.js'
import type { SqliteDateTimeFormat } from '../../../../../src/connections/SqliteConfiguration.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

const NO_MILLISECONDS = new Date(Date.UTC(2024, 0, 14, 10, 0, 0, 0))
const HALF_SECOND = new Date(Date.UTC(2024, 0, 14, 10, 0, 0, 500))

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    function readDateTime(format: SqliteDateTimeFormat, text: string) {
        const conn = ctx.withDateTimeFormat(format)
        return conn.fragmentWithType('localDateTime', 'required').sql`${conn.const(text, 'string')}`
    }

    function readTime(format: SqliteDateTimeFormat, text: string) {
        const conn = ctx.withDateTimeFormat(format)
        return conn.fragmentWithType('localTime', 'required').sql`${conn.const(text, 'string')}`
    }

    test('localdate seconds as text: reads every text, with decimals or without, with a Z or without', () => {
        const conn = ctx.withDateTimeFormat('localdate seconds as text')
        const texts = ['2024-01-14 10:00:00', '2024-01-14 10:00:00.500', '2024-01-14T10:00:00.500Z', '2024-01-14 10:00:00.000Z']
        ctx.mockNext({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
        const row = sync(conn.selectFromNoTable()
            .select({
                a: readDateTime('localdate seconds as text', texts[0]!),
                b: readDateTime('localdate seconds as text', texts[1]!),
                c: readDateTime('localdate seconds as text', texts[2]!),
                d: readDateTime('localdate seconds as text', texts[3]!),
                e: readTime('localdate seconds as text', '10:00:00'),
                f: readTime('localdate seconds as text', '10:00:00.500'),
                g: readTime('localdate seconds as text', '10:00:00.500Z'),
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { a: Date; b: Date; c: Date; d: Date; e: Date; f: Date; g: Date }>>()
        expect(row).toEqual({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
    })

    test('localdate milliseconds as text: reads every text, with decimals or without, with a Z or without', () => {
        const conn = ctx.withDateTimeFormat('localdate milliseconds as text')
        const texts = ['2024-01-14 10:00:00', '2024-01-14 10:00:00.500', '2024-01-14T10:00:00.500Z', '2024-01-14 10:00:00.000Z']
        ctx.mockNext({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
        const row = sync(conn.selectFromNoTable()
            .select({
                a: readDateTime('localdate milliseconds as text', texts[0]!),
                b: readDateTime('localdate milliseconds as text', texts[1]!),
                c: readDateTime('localdate milliseconds as text', texts[2]!),
                d: readDateTime('localdate milliseconds as text', texts[3]!),
                e: readTime('localdate milliseconds as text', '10:00:00'),
                f: readTime('localdate milliseconds as text', '10:00:00.500'),
                g: readTime('localdate milliseconds as text', '10:00:00.500Z'),
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { a: Date; b: Date; c: Date; d: Date; e: Date; f: Date; g: Date }>>()
        expect(row).toEqual({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
    })

    test('localdate seconds as text using T separator: reads every text, with decimals or without, with a Z or without', () => {
        const conn = ctx.withDateTimeFormat('localdate seconds as text using T separator')
        const texts = ['2024-01-14T10:00:00', '2024-01-14T10:00:00.500', '2024-01-14 10:00:00.500Z', '2024-01-14T10:00:00.000Z']
        ctx.mockNext({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
        const row = sync(conn.selectFromNoTable()
            .select({
                a: readDateTime('localdate seconds as text using T separator', texts[0]!),
                b: readDateTime('localdate seconds as text using T separator', texts[1]!),
                c: readDateTime('localdate seconds as text using T separator', texts[2]!),
                d: readDateTime('localdate seconds as text using T separator', texts[3]!),
                e: readTime('localdate seconds as text using T separator', '10:00:00'),
                f: readTime('localdate seconds as text using T separator', '10:00:00.500'),
                g: readTime('localdate seconds as text using T separator', '10:00:00.500Z'),
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { a: Date; b: Date; c: Date; d: Date; e: Date; f: Date; g: Date }>>()
        expect(row).toEqual({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
    })

    test('localdate milliseconds as text using T separator: reads every text, with decimals or without, with a Z or without', () => {
        const conn = ctx.withDateTimeFormat('localdate milliseconds as text using T separator')
        const texts = ['2024-01-14T10:00:00', '2024-01-14T10:00:00.500', '2024-01-14 10:00:00.500Z', '2024-01-14T10:00:00.000Z']
        ctx.mockNext({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
        const row = sync(conn.selectFromNoTable()
            .select({
                a: readDateTime('localdate milliseconds as text using T separator', texts[0]!),
                b: readDateTime('localdate milliseconds as text using T separator', texts[1]!),
                c: readDateTime('localdate milliseconds as text using T separator', texts[2]!),
                d: readDateTime('localdate milliseconds as text using T separator', texts[3]!),
                e: readTime('localdate milliseconds as text using T separator', '10:00:00'),
                f: readTime('localdate milliseconds as text using T separator', '10:00:00.500'),
                g: readTime('localdate milliseconds as text using T separator', '10:00:00.500Z'),
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { a: Date; b: Date; c: Date; d: Date; e: Date; f: Date; g: Date }>>()
        expect(row).toEqual({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
    })

    test('UTC seconds as text: reads every text, with decimals or without, with a Z or without', () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text')
        const texts = ['2024-01-14 10:00:00', '2024-01-14 10:00:00.500', '2024-01-14T10:00:00.500Z', '2024-01-14 10:00:00.000Z']
        ctx.mockNext({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
        const row = sync(conn.selectFromNoTable()
            .select({
                a: readDateTime('UTC seconds as text', texts[0]!),
                b: readDateTime('UTC seconds as text', texts[1]!),
                c: readDateTime('UTC seconds as text', texts[2]!),
                d: readDateTime('UTC seconds as text', texts[3]!),
                e: readTime('UTC seconds as text', '10:00:00'),
                f: readTime('UTC seconds as text', '10:00:00.500'),
                g: readTime('UTC seconds as text', '10:00:00.500Z'),
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { a: Date; b: Date; c: Date; d: Date; e: Date; f: Date; g: Date }>>()
        expect(row).toEqual({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
    })

    test('UTC milliseconds as text: reads every text, with decimals or without, with a Z or without', () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text')
        const texts = ['2024-01-14 10:00:00', '2024-01-14 10:00:00.500', '2024-01-14T10:00:00.500Z', '2024-01-14 10:00:00.000Z']
        ctx.mockNext({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
        const row = sync(conn.selectFromNoTable()
            .select({
                a: readDateTime('UTC milliseconds as text', texts[0]!),
                b: readDateTime('UTC milliseconds as text', texts[1]!),
                c: readDateTime('UTC milliseconds as text', texts[2]!),
                d: readDateTime('UTC milliseconds as text', texts[3]!),
                e: readTime('UTC milliseconds as text', '10:00:00'),
                f: readTime('UTC milliseconds as text', '10:00:00.500'),
                g: readTime('UTC milliseconds as text', '10:00:00.500Z'),
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { a: Date; b: Date; c: Date; d: Date; e: Date; f: Date; g: Date }>>()
        expect(row).toEqual({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
    })

    test('UTC seconds as text using T separator: reads every text, with decimals or without, with a Z or without', () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using T separator')
        const texts = ['2024-01-14T10:00:00', '2024-01-14T10:00:00.500', '2024-01-14 10:00:00.500Z', '2024-01-14T10:00:00.000Z']
        ctx.mockNext({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
        const row = sync(conn.selectFromNoTable()
            .select({
                a: readDateTime('UTC seconds as text using T separator', texts[0]!),
                b: readDateTime('UTC seconds as text using T separator', texts[1]!),
                c: readDateTime('UTC seconds as text using T separator', texts[2]!),
                d: readDateTime('UTC seconds as text using T separator', texts[3]!),
                e: readTime('UTC seconds as text using T separator', '10:00:00'),
                f: readTime('UTC seconds as text using T separator', '10:00:00.500'),
                g: readTime('UTC seconds as text using T separator', '10:00:00.500Z'),
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { a: Date; b: Date; c: Date; d: Date; e: Date; f: Date; g: Date }>>()
        expect(row).toEqual({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
    })

    test('UTC milliseconds as text using T separator: reads every text, with decimals or without, with a Z or without', () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using T separator')
        const texts = ['2024-01-14T10:00:00', '2024-01-14T10:00:00.500', '2024-01-14 10:00:00.500Z', '2024-01-14T10:00:00.000Z']
        ctx.mockNext({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
        const row = sync(conn.selectFromNoTable()
            .select({
                a: readDateTime('UTC milliseconds as text using T separator', texts[0]!),
                b: readDateTime('UTC milliseconds as text using T separator', texts[1]!),
                c: readDateTime('UTC milliseconds as text using T separator', texts[2]!),
                d: readDateTime('UTC milliseconds as text using T separator', texts[3]!),
                e: readTime('UTC milliseconds as text using T separator', '10:00:00'),
                f: readTime('UTC milliseconds as text using T separator', '10:00:00.500'),
                g: readTime('UTC milliseconds as text using T separator', '10:00:00.500Z'),
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { a: Date; b: Date; c: Date; d: Date; e: Date; f: Date; g: Date }>>()
        expect(row).toEqual({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
    })

    test('UTC seconds as text using Z timezone: reads every text, with decimals or without, with a Z or without', () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using Z timezone')
        const texts = ['2024-01-14 10:00:00', '2024-01-14 10:00:00.500', '2024-01-14T10:00:00.500Z', '2024-01-14 10:00:00.000Z']
        ctx.mockNext({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
        const row = sync(conn.selectFromNoTable()
            .select({
                a: readDateTime('UTC seconds as text using Z timezone', texts[0]!),
                b: readDateTime('UTC seconds as text using Z timezone', texts[1]!),
                c: readDateTime('UTC seconds as text using Z timezone', texts[2]!),
                d: readDateTime('UTC seconds as text using Z timezone', texts[3]!),
                e: readTime('UTC seconds as text using Z timezone', '10:00:00'),
                f: readTime('UTC seconds as text using Z timezone', '10:00:00.500'),
                g: readTime('UTC seconds as text using Z timezone', '10:00:00.500Z'),
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { a: Date; b: Date; c: Date; d: Date; e: Date; f: Date; g: Date }>>()
        expect(row).toEqual({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
    })

    test('UTC milliseconds as text using Z timezone: reads every text, with decimals or without, with a Z or without', () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using Z timezone')
        const texts = ['2024-01-14 10:00:00', '2024-01-14 10:00:00.500', '2024-01-14T10:00:00.500Z', '2024-01-14 10:00:00.000Z']
        ctx.mockNext({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
        const row = sync(conn.selectFromNoTable()
            .select({
                a: readDateTime('UTC milliseconds as text using Z timezone', texts[0]!),
                b: readDateTime('UTC milliseconds as text using Z timezone', texts[1]!),
                c: readDateTime('UTC milliseconds as text using Z timezone', texts[2]!),
                d: readDateTime('UTC milliseconds as text using Z timezone', texts[3]!),
                e: readTime('UTC milliseconds as text using Z timezone', '10:00:00'),
                f: readTime('UTC milliseconds as text using Z timezone', '10:00:00.500'),
                g: readTime('UTC milliseconds as text using Z timezone', '10:00:00.500Z'),
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { a: Date; b: Date; c: Date; d: Date; e: Date; f: Date; g: Date }>>()
        expect(row).toEqual({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
    })

    test('UTC seconds as text using T separator and Z timezone: reads every text, with decimals or without, with a Z or without', () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using T separator and Z timezone')
        const texts = ['2024-01-14T10:00:00', '2024-01-14T10:00:00.500', '2024-01-14 10:00:00.500Z', '2024-01-14T10:00:00.000Z']
        ctx.mockNext({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
        const row = sync(conn.selectFromNoTable()
            .select({
                a: readDateTime('UTC seconds as text using T separator and Z timezone', texts[0]!),
                b: readDateTime('UTC seconds as text using T separator and Z timezone', texts[1]!),
                c: readDateTime('UTC seconds as text using T separator and Z timezone', texts[2]!),
                d: readDateTime('UTC seconds as text using T separator and Z timezone', texts[3]!),
                e: readTime('UTC seconds as text using T separator and Z timezone', '10:00:00'),
                f: readTime('UTC seconds as text using T separator and Z timezone', '10:00:00.500'),
                g: readTime('UTC seconds as text using T separator and Z timezone', '10:00:00.500Z'),
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { a: Date; b: Date; c: Date; d: Date; e: Date; f: Date; g: Date }>>()
        expect(row).toEqual({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
    })

    test('UTC milliseconds as text using T separator and Z timezone: reads every text, with decimals or without, with a Z or without', () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using T separator and Z timezone')
        const texts = ['2024-01-14T10:00:00', '2024-01-14T10:00:00.500', '2024-01-14 10:00:00.500Z', '2024-01-14T10:00:00.000Z']
        ctx.mockNext({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
        const row = sync(conn.selectFromNoTable()
            .select({
                a: readDateTime('UTC milliseconds as text using T separator and Z timezone', texts[0]!),
                b: readDateTime('UTC milliseconds as text using T separator and Z timezone', texts[1]!),
                c: readDateTime('UTC milliseconds as text using T separator and Z timezone', texts[2]!),
                d: readDateTime('UTC milliseconds as text using T separator and Z timezone', texts[3]!),
                e: readTime('UTC milliseconds as text using T separator and Z timezone', '10:00:00'),
                f: readTime('UTC milliseconds as text using T separator and Z timezone', '10:00:00.500'),
                g: readTime('UTC milliseconds as text using T separator and Z timezone', '10:00:00.500Z'),
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { a: Date; b: Date; c: Date; d: Date; e: Date; f: Date; g: Date }>>()
        expect(row).toEqual({ a: NO_MILLISECONDS, b: HALF_SECOND, c: HALF_SECOND, d: NO_MILLISECONDS, e: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)), f: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)), g: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 500)) })
    })

    test('localdate seconds as text: the database writes the current date time and time with the width of the format', () => {
        const conn = ctx.withDateTimeFormat('localdate seconds as text')
        ctx.mockNext({ at: '2024-01-14 10:00:00', time: '10:00:00' })
        const row = sync(conn.selectFromNoTable()
            .select({
                at: conn.fragmentWithType('string', 'required').sql`${conn.currentTimestamp()}`,
                time: conn.fragmentWithType('string', 'required').sql`${conn.currentTime()}`,
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { at: string; time: string }>>()
        // The digits change with the clock: the shape of the text is what the format fixes
        expect(row.at.replace(/\d/g, '9')).toBe('9999-99-99 99:99:99')
        expect(row.time.replace(/\d/g, '9')).toBe('99:99:99')
    })

    test('localdate milliseconds as text: the database writes the current date time and time with the width of the format', () => {
        const conn = ctx.withDateTimeFormat('localdate milliseconds as text')
        ctx.mockNext({ at: '2024-01-14 10:00:00.250', time: '10:00:00.250' })
        const row = sync(conn.selectFromNoTable()
            .select({
                at: conn.fragmentWithType('string', 'required').sql`${conn.currentTimestamp()}`,
                time: conn.fragmentWithType('string', 'required').sql`${conn.currentTime()}`,
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { at: string; time: string }>>()
        // The digits change with the clock: the shape of the text is what the format fixes
        expect(row.at.replace(/\d/g, '9')).toBe('9999-99-99 99:99:99.999')
        expect(row.time.replace(/\d/g, '9')).toBe('99:99:99.999')
    })

    test('localdate seconds as text using T separator: the database writes the current date time and time with the width of the format', () => {
        const conn = ctx.withDateTimeFormat('localdate seconds as text using T separator')
        ctx.mockNext({ at: '2024-01-14T10:00:00', time: '10:00:00' })
        const row = sync(conn.selectFromNoTable()
            .select({
                at: conn.fragmentWithType('string', 'required').sql`${conn.currentTimestamp()}`,
                time: conn.fragmentWithType('string', 'required').sql`${conn.currentTime()}`,
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { at: string; time: string }>>()
        // The digits change with the clock: the shape of the text is what the format fixes
        expect(row.at.replace(/\d/g, '9')).toBe('9999-99-99T99:99:99')
        expect(row.time.replace(/\d/g, '9')).toBe('99:99:99')
    })

    test('localdate milliseconds as text using T separator: the database writes the current date time and time with the width of the format', () => {
        const conn = ctx.withDateTimeFormat('localdate milliseconds as text using T separator')
        ctx.mockNext({ at: '2024-01-14T10:00:00.250', time: '10:00:00.250' })
        const row = sync(conn.selectFromNoTable()
            .select({
                at: conn.fragmentWithType('string', 'required').sql`${conn.currentTimestamp()}`,
                time: conn.fragmentWithType('string', 'required').sql`${conn.currentTime()}`,
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { at: string; time: string }>>()
        // The digits change with the clock: the shape of the text is what the format fixes
        expect(row.at.replace(/\d/g, '9')).toBe('9999-99-99T99:99:99.999')
        expect(row.time.replace(/\d/g, '9')).toBe('99:99:99.999')
    })

    test('UTC seconds as text: the database writes the current date time and time with the width of the format', () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text')
        ctx.mockNext({ at: '2024-01-14 10:00:00', time: '10:00:00' })
        const row = sync(conn.selectFromNoTable()
            .select({
                at: conn.fragmentWithType('string', 'required').sql`${conn.currentTimestamp()}`,
                time: conn.fragmentWithType('string', 'required').sql`${conn.currentTime()}`,
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { at: string; time: string }>>()
        // The digits change with the clock: the shape of the text is what the format fixes
        expect(row.at.replace(/\d/g, '9')).toBe('9999-99-99 99:99:99')
        expect(row.time.replace(/\d/g, '9')).toBe('99:99:99')
    })

    test('UTC milliseconds as text: the database writes the current date time and time with the width of the format', () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text')
        ctx.mockNext({ at: '2024-01-14 10:00:00.250', time: '10:00:00.250' })
        const row = sync(conn.selectFromNoTable()
            .select({
                at: conn.fragmentWithType('string', 'required').sql`${conn.currentTimestamp()}`,
                time: conn.fragmentWithType('string', 'required').sql`${conn.currentTime()}`,
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { at: string; time: string }>>()
        // The digits change with the clock: the shape of the text is what the format fixes
        expect(row.at.replace(/\d/g, '9')).toBe('9999-99-99 99:99:99.999')
        expect(row.time.replace(/\d/g, '9')).toBe('99:99:99.999')
    })

    test('UTC seconds as text using T separator: the database writes the current date time and time with the width of the format', () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using T separator')
        ctx.mockNext({ at: '2024-01-14T10:00:00', time: '10:00:00' })
        const row = sync(conn.selectFromNoTable()
            .select({
                at: conn.fragmentWithType('string', 'required').sql`${conn.currentTimestamp()}`,
                time: conn.fragmentWithType('string', 'required').sql`${conn.currentTime()}`,
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { at: string; time: string }>>()
        // The digits change with the clock: the shape of the text is what the format fixes
        expect(row.at.replace(/\d/g, '9')).toBe('9999-99-99T99:99:99')
        expect(row.time.replace(/\d/g, '9')).toBe('99:99:99')
    })

    test('UTC milliseconds as text using T separator: the database writes the current date time and time with the width of the format', () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using T separator')
        ctx.mockNext({ at: '2024-01-14T10:00:00.250', time: '10:00:00.250' })
        const row = sync(conn.selectFromNoTable()
            .select({
                at: conn.fragmentWithType('string', 'required').sql`${conn.currentTimestamp()}`,
                time: conn.fragmentWithType('string', 'required').sql`${conn.currentTime()}`,
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { at: string; time: string }>>()
        // The digits change with the clock: the shape of the text is what the format fixes
        expect(row.at.replace(/\d/g, '9')).toBe('9999-99-99T99:99:99.999')
        expect(row.time.replace(/\d/g, '9')).toBe('99:99:99.999')
    })

    test('UTC seconds as text using Z timezone: the database writes the current date time and time with the width of the format', () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using Z timezone')
        ctx.mockNext({ at: '2024-01-14 10:00:00Z', time: '10:00:00Z' })
        const row = sync(conn.selectFromNoTable()
            .select({
                at: conn.fragmentWithType('string', 'required').sql`${conn.currentTimestamp()}`,
                time: conn.fragmentWithType('string', 'required').sql`${conn.currentTime()}`,
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { at: string; time: string }>>()
        // The digits change with the clock: the shape of the text is what the format fixes
        expect(row.at.replace(/\d/g, '9')).toBe('9999-99-99 99:99:99Z')
        expect(row.time.replace(/\d/g, '9')).toBe('99:99:99Z')
    })

    test('UTC milliseconds as text using Z timezone: the database writes the current date time and time with the width of the format', () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using Z timezone')
        ctx.mockNext({ at: '2024-01-14 10:00:00.250Z', time: '10:00:00.250Z' })
        const row = sync(conn.selectFromNoTable()
            .select({
                at: conn.fragmentWithType('string', 'required').sql`${conn.currentTimestamp()}`,
                time: conn.fragmentWithType('string', 'required').sql`${conn.currentTime()}`,
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { at: string; time: string }>>()
        // The digits change with the clock: the shape of the text is what the format fixes
        expect(row.at.replace(/\d/g, '9')).toBe('9999-99-99 99:99:99.999Z')
        expect(row.time.replace(/\d/g, '9')).toBe('99:99:99.999Z')
    })

    test('UTC seconds as text using T separator and Z timezone: the database writes the current date time and time with the width of the format', () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using T separator and Z timezone')
        ctx.mockNext({ at: '2024-01-14T10:00:00Z', time: '10:00:00Z' })
        const row = sync(conn.selectFromNoTable()
            .select({
                at: conn.fragmentWithType('string', 'required').sql`${conn.currentTimestamp()}`,
                time: conn.fragmentWithType('string', 'required').sql`${conn.currentTime()}`,
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { at: string; time: string }>>()
        // The digits change with the clock: the shape of the text is what the format fixes
        expect(row.at.replace(/\d/g, '9')).toBe('9999-99-99T99:99:99Z')
        expect(row.time.replace(/\d/g, '9')).toBe('99:99:99Z')
    })

    test('UTC milliseconds as text using T separator and Z timezone: the database writes the current date time and time with the width of the format', () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using T separator and Z timezone')
        ctx.mockNext({ at: '2024-01-14T10:00:00.250Z', time: '10:00:00.250Z' })
        const row = sync(conn.selectFromNoTable()
            .select({
                at: conn.fragmentWithType('string', 'required').sql`${conn.currentTimestamp()}`,
                time: conn.fragmentWithType('string', 'required').sql`${conn.currentTime()}`,
            })
            .executeSelectOne())
        assertType<Exact<typeof row, { at: string; time: string }>>()
        // The digits change with the clock: the shape of the text is what the format fixes
        expect(row.at.replace(/\d/g, '9')).toBe('9999-99-99T99:99:99.999Z')
        expect(row.time.replace(/\d/g, '9')).toBe('99:99:99.999Z')
    })

    test('localdate seconds as text: the rows of an earlier version, normalized to seconds, compare well', async () => {
        const conn = ctx.withDateTimeFormat('localdate seconds as text')
        const t = tColMatrixOptional
        const dateTime = t.mDatetime
        const time = t.mTime
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(2)
        ctx.mockNext(2)
        ctx.mockNext([101, 102])
        ctx.mockNext([103])
        ctx.mockNext([101, 102, 103].map(id => ({ id, at: NO_MILLISECONDS })))
        ctx.mockNext([101, 102])
        ctx.mockNext([101, 102, 103].map(id => ({ id, time: NO_MILLISECONDS })))
        await ctx.withRollback(async () => {
            sync(conn.insertInto(tColMatrixOptional).set({ id: 101, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:00'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 102, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:00.500'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00.500'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 103, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:01'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:01'` }).executeInsert())
            sync(conn.update(t)
                .set({ mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`substr(${dateTime}, 1, 19)` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${dateTime}) > 19`)
                .executeUpdate())
            sync(conn.update(t)
                .set({ mTime: conn.fragmentWithType('localTime', 'required').sql`substr(${time}, 1, 8)` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${time}) > 8`)
                .executeUpdate())
            const ours = t.id.greaterThan(100)
            const equal = sync(conn.selectFrom(t).where(ours).and(dateTime.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const later = sync(conn.selectFrom(t).where(ours).and(dateTime.greaterThan(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const ordered = sync(conn.selectFrom(t).where(ours).select({ id: t.id, at: dateTime }).orderBy('at').executeSelectMany())
            const equalTime = sync(conn.selectFrom(t).where(ours).and(time.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const orderedTime = sync(conn.selectFrom(t).where(ours).select({ id: t.id, time }).orderBy('time').executeSelectMany())
            expect(equal).toEqual([101, 102])
            expect(later).toEqual([103])
            expect(ordered.map(row => row.id)).toEqual([101, 102, 103])
            expect(equalTime).toEqual([101, 102])
            expect(orderedTime.map(row => row.id)).toEqual([101, 102, 103])
        })
    })

    test('localdate milliseconds as text: the rows of an earlier version, normalized to milliseconds, compare well', async () => {
        const conn = ctx.withDateTimeFormat('localdate milliseconds as text')
        const t = tColMatrixOptional
        const dateTime = t.mDatetime
        const time = t.mTime
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext([101])
        ctx.mockNext([102, 103])
        ctx.mockNext([101, 102, 103].map(id => ({ id, at: NO_MILLISECONDS })))
        ctx.mockNext([101])
        ctx.mockNext([101, 102, 103].map(id => ({ id, time: NO_MILLISECONDS })))
        await ctx.withRollback(async () => {
            sync(conn.insertInto(tColMatrixOptional).set({ id: 101, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:00'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 102, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:00.500'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00.500'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 103, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:01'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:01'` }).executeInsert())
            sync(conn.update(t)
                .set({ mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`${dateTime} || '.000'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${dateTime}) = 19`)
                .executeUpdate())
            sync(conn.update(t)
                .set({ mTime: conn.fragmentWithType('localTime', 'required').sql`${time} || '.000'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${time}) = 8`)
                .executeUpdate())
            const ours = t.id.greaterThan(100)
            const equal = sync(conn.selectFrom(t).where(ours).and(dateTime.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const later = sync(conn.selectFrom(t).where(ours).and(dateTime.greaterThan(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const ordered = sync(conn.selectFrom(t).where(ours).select({ id: t.id, at: dateTime }).orderBy('at').executeSelectMany())
            const equalTime = sync(conn.selectFrom(t).where(ours).and(time.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const orderedTime = sync(conn.selectFrom(t).where(ours).select({ id: t.id, time }).orderBy('time').executeSelectMany())
            expect(equal).toEqual([101])
            expect(later).toEqual([102, 103])
            expect(ordered.map(row => row.id)).toEqual([101, 102, 103])
            expect(equalTime).toEqual([101])
            expect(orderedTime.map(row => row.id)).toEqual([101, 102, 103])
        })
    })

    test('localdate seconds as text using T separator: the rows of an earlier version, normalized to seconds, compare well', async () => {
        const conn = ctx.withDateTimeFormat('localdate seconds as text using T separator')
        const t = tColMatrixOptional
        const dateTime = t.mDatetime
        const time = t.mTime
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(2)
        ctx.mockNext(2)
        ctx.mockNext([101, 102])
        ctx.mockNext([103])
        ctx.mockNext([101, 102, 103].map(id => ({ id, at: NO_MILLISECONDS })))
        ctx.mockNext([101, 102])
        ctx.mockNext([101, 102, 103].map(id => ({ id, time: NO_MILLISECONDS })))
        await ctx.withRollback(async () => {
            sync(conn.insertInto(tColMatrixOptional).set({ id: 101, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:00'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 102, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:00.500'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00.500'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 103, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:01'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:01'` }).executeInsert())
            sync(conn.update(t)
                .set({ mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`substr(${dateTime}, 1, 19)` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${dateTime}) > 19`)
                .executeUpdate())
            sync(conn.update(t)
                .set({ mTime: conn.fragmentWithType('localTime', 'required').sql`substr(${time}, 1, 8)` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${time}) > 8`)
                .executeUpdate())
            const ours = t.id.greaterThan(100)
            const equal = sync(conn.selectFrom(t).where(ours).and(dateTime.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const later = sync(conn.selectFrom(t).where(ours).and(dateTime.greaterThan(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const ordered = sync(conn.selectFrom(t).where(ours).select({ id: t.id, at: dateTime }).orderBy('at').executeSelectMany())
            const equalTime = sync(conn.selectFrom(t).where(ours).and(time.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const orderedTime = sync(conn.selectFrom(t).where(ours).select({ id: t.id, time }).orderBy('time').executeSelectMany())
            expect(equal).toEqual([101, 102])
            expect(later).toEqual([103])
            expect(ordered.map(row => row.id)).toEqual([101, 102, 103])
            expect(equalTime).toEqual([101, 102])
            expect(orderedTime.map(row => row.id)).toEqual([101, 102, 103])
        })
    })

    test('localdate milliseconds as text using T separator: the rows of an earlier version, normalized to milliseconds, compare well', async () => {
        const conn = ctx.withDateTimeFormat('localdate milliseconds as text using T separator')
        const t = tColMatrixOptional
        const dateTime = t.mDatetime
        const time = t.mTime
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext([101])
        ctx.mockNext([102, 103])
        ctx.mockNext([101, 102, 103].map(id => ({ id, at: NO_MILLISECONDS })))
        ctx.mockNext([101])
        ctx.mockNext([101, 102, 103].map(id => ({ id, time: NO_MILLISECONDS })))
        await ctx.withRollback(async () => {
            sync(conn.insertInto(tColMatrixOptional).set({ id: 101, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:00'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 102, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:00.500'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00.500'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 103, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:01'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:01'` }).executeInsert())
            sync(conn.update(t)
                .set({ mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`${dateTime} || '.000'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${dateTime}) = 19`)
                .executeUpdate())
            sync(conn.update(t)
                .set({ mTime: conn.fragmentWithType('localTime', 'required').sql`${time} || '.000'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${time}) = 8`)
                .executeUpdate())
            const ours = t.id.greaterThan(100)
            const equal = sync(conn.selectFrom(t).where(ours).and(dateTime.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const later = sync(conn.selectFrom(t).where(ours).and(dateTime.greaterThan(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const ordered = sync(conn.selectFrom(t).where(ours).select({ id: t.id, at: dateTime }).orderBy('at').executeSelectMany())
            const equalTime = sync(conn.selectFrom(t).where(ours).and(time.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const orderedTime = sync(conn.selectFrom(t).where(ours).select({ id: t.id, time }).orderBy('time').executeSelectMany())
            expect(equal).toEqual([101])
            expect(later).toEqual([102, 103])
            expect(ordered.map(row => row.id)).toEqual([101, 102, 103])
            expect(equalTime).toEqual([101])
            expect(orderedTime.map(row => row.id)).toEqual([101, 102, 103])
        })
    })

    test('UTC seconds as text: the rows of an earlier version, normalized to seconds, compare well', async () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text')
        const t = tColMatrixOptional
        const dateTime = t.mDatetime
        const time = t.mTime
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(2)
        ctx.mockNext(2)
        ctx.mockNext([101, 102])
        ctx.mockNext([103])
        ctx.mockNext([101, 102, 103].map(id => ({ id, at: NO_MILLISECONDS })))
        ctx.mockNext([101, 102])
        ctx.mockNext([101, 102, 103].map(id => ({ id, time: NO_MILLISECONDS })))
        await ctx.withRollback(async () => {
            sync(conn.insertInto(tColMatrixOptional).set({ id: 101, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:00'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 102, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:00.500'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00.500'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 103, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:01'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:01'` }).executeInsert())
            sync(conn.update(t)
                .set({ mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`substr(${dateTime}, 1, 19)` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${dateTime}) > 19`)
                .executeUpdate())
            sync(conn.update(t)
                .set({ mTime: conn.fragmentWithType('localTime', 'required').sql`substr(${time}, 1, 8)` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${time}) > 8`)
                .executeUpdate())
            const ours = t.id.greaterThan(100)
            const equal = sync(conn.selectFrom(t).where(ours).and(dateTime.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const later = sync(conn.selectFrom(t).where(ours).and(dateTime.greaterThan(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const ordered = sync(conn.selectFrom(t).where(ours).select({ id: t.id, at: dateTime }).orderBy('at').executeSelectMany())
            const equalTime = sync(conn.selectFrom(t).where(ours).and(time.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const orderedTime = sync(conn.selectFrom(t).where(ours).select({ id: t.id, time }).orderBy('time').executeSelectMany())
            expect(equal).toEqual([101, 102])
            expect(later).toEqual([103])
            expect(ordered.map(row => row.id)).toEqual([101, 102, 103])
            expect(equalTime).toEqual([101, 102])
            expect(orderedTime.map(row => row.id)).toEqual([101, 102, 103])
        })
    })

    test('UTC milliseconds as text: the rows of an earlier version, normalized to milliseconds, compare well', async () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text')
        const t = tColMatrixOptional
        const dateTime = t.mDatetime
        const time = t.mTime
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext([101])
        ctx.mockNext([102, 103])
        ctx.mockNext([101, 102, 103].map(id => ({ id, at: NO_MILLISECONDS })))
        ctx.mockNext([101])
        ctx.mockNext([101, 102, 103].map(id => ({ id, time: NO_MILLISECONDS })))
        await ctx.withRollback(async () => {
            sync(conn.insertInto(tColMatrixOptional).set({ id: 101, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:00'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 102, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:00.500'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00.500'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 103, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:01'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:01'` }).executeInsert())
            sync(conn.update(t)
                .set({ mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`${dateTime} || '.000'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${dateTime}) = 19`)
                .executeUpdate())
            sync(conn.update(t)
                .set({ mTime: conn.fragmentWithType('localTime', 'required').sql`${time} || '.000'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${time}) = 8`)
                .executeUpdate())
            const ours = t.id.greaterThan(100)
            const equal = sync(conn.selectFrom(t).where(ours).and(dateTime.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const later = sync(conn.selectFrom(t).where(ours).and(dateTime.greaterThan(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const ordered = sync(conn.selectFrom(t).where(ours).select({ id: t.id, at: dateTime }).orderBy('at').executeSelectMany())
            const equalTime = sync(conn.selectFrom(t).where(ours).and(time.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const orderedTime = sync(conn.selectFrom(t).where(ours).select({ id: t.id, time }).orderBy('time').executeSelectMany())
            expect(equal).toEqual([101])
            expect(later).toEqual([102, 103])
            expect(ordered.map(row => row.id)).toEqual([101, 102, 103])
            expect(equalTime).toEqual([101])
            expect(orderedTime.map(row => row.id)).toEqual([101, 102, 103])
        })
    })

    test('UTC seconds as text using T separator: the rows of an earlier version, normalized to seconds, compare well', async () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using T separator')
        const t = tColMatrixOptional
        const dateTime = t.mDatetime
        const time = t.mTime
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(2)
        ctx.mockNext(2)
        ctx.mockNext([101, 102])
        ctx.mockNext([103])
        ctx.mockNext([101, 102, 103].map(id => ({ id, at: NO_MILLISECONDS })))
        ctx.mockNext([101, 102])
        ctx.mockNext([101, 102, 103].map(id => ({ id, time: NO_MILLISECONDS })))
        await ctx.withRollback(async () => {
            sync(conn.insertInto(tColMatrixOptional).set({ id: 101, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:00'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 102, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:00.500'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00.500'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 103, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:01'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:01'` }).executeInsert())
            sync(conn.update(t)
                .set({ mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`substr(${dateTime}, 1, 19)` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${dateTime}) > 19`)
                .executeUpdate())
            sync(conn.update(t)
                .set({ mTime: conn.fragmentWithType('localTime', 'required').sql`substr(${time}, 1, 8)` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${time}) > 8`)
                .executeUpdate())
            const ours = t.id.greaterThan(100)
            const equal = sync(conn.selectFrom(t).where(ours).and(dateTime.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const later = sync(conn.selectFrom(t).where(ours).and(dateTime.greaterThan(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const ordered = sync(conn.selectFrom(t).where(ours).select({ id: t.id, at: dateTime }).orderBy('at').executeSelectMany())
            const equalTime = sync(conn.selectFrom(t).where(ours).and(time.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const orderedTime = sync(conn.selectFrom(t).where(ours).select({ id: t.id, time }).orderBy('time').executeSelectMany())
            expect(equal).toEqual([101, 102])
            expect(later).toEqual([103])
            expect(ordered.map(row => row.id)).toEqual([101, 102, 103])
            expect(equalTime).toEqual([101, 102])
            expect(orderedTime.map(row => row.id)).toEqual([101, 102, 103])
        })
    })

    test('UTC milliseconds as text using T separator: the rows of an earlier version, normalized to milliseconds, compare well', async () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using T separator')
        const t = tColMatrixOptional
        const dateTime = t.mDatetime
        const time = t.mTime
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext([101])
        ctx.mockNext([102, 103])
        ctx.mockNext([101, 102, 103].map(id => ({ id, at: NO_MILLISECONDS })))
        ctx.mockNext([101])
        ctx.mockNext([101, 102, 103].map(id => ({ id, time: NO_MILLISECONDS })))
        await ctx.withRollback(async () => {
            sync(conn.insertInto(tColMatrixOptional).set({ id: 101, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:00'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 102, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:00.500'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00.500'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 103, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:01'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:01'` }).executeInsert())
            sync(conn.update(t)
                .set({ mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`${dateTime} || '.000'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${dateTime}) = 19`)
                .executeUpdate())
            sync(conn.update(t)
                .set({ mTime: conn.fragmentWithType('localTime', 'required').sql`${time} || '.000'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${time}) = 8`)
                .executeUpdate())
            const ours = t.id.greaterThan(100)
            const equal = sync(conn.selectFrom(t).where(ours).and(dateTime.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const later = sync(conn.selectFrom(t).where(ours).and(dateTime.greaterThan(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const ordered = sync(conn.selectFrom(t).where(ours).select({ id: t.id, at: dateTime }).orderBy('at').executeSelectMany())
            const equalTime = sync(conn.selectFrom(t).where(ours).and(time.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const orderedTime = sync(conn.selectFrom(t).where(ours).select({ id: t.id, time }).orderBy('time').executeSelectMany())
            expect(equal).toEqual([101])
            expect(later).toEqual([102, 103])
            expect(ordered.map(row => row.id)).toEqual([101, 102, 103])
            expect(equalTime).toEqual([101])
            expect(orderedTime.map(row => row.id)).toEqual([101, 102, 103])
        })
    })

    test('UTC seconds as text using Z timezone: the rows of an earlier version, normalized to seconds, compare well', async () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using Z timezone')
        const t = tColMatrixOptional
        const dateTime = t.mDatetime
        const time = t.mTime
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(2)
        ctx.mockNext(2)
        ctx.mockNext([101, 102])
        ctx.mockNext([103])
        ctx.mockNext([101, 102, 103].map(id => ({ id, at: NO_MILLISECONDS })))
        ctx.mockNext([101, 102])
        ctx.mockNext([101, 102, 103].map(id => ({ id, time: NO_MILLISECONDS })))
        await ctx.withRollback(async () => {
            sync(conn.insertInto(tColMatrixOptional).set({ id: 101, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:00Z'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00Z'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 102, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:00.500Z'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00.500Z'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 103, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:01Z'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:01Z'` }).executeInsert())
            sync(conn.update(t)
                .set({ mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`substr(${dateTime}, 1, 19) || 'Z'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${dateTime}) > 20`)
                .executeUpdate())
            sync(conn.update(t)
                .set({ mTime: conn.fragmentWithType('localTime', 'required').sql`substr(${time}, 1, 8) || 'Z'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${time}) > 9`)
                .executeUpdate())
            const ours = t.id.greaterThan(100)
            const equal = sync(conn.selectFrom(t).where(ours).and(dateTime.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const later = sync(conn.selectFrom(t).where(ours).and(dateTime.greaterThan(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const ordered = sync(conn.selectFrom(t).where(ours).select({ id: t.id, at: dateTime }).orderBy('at').executeSelectMany())
            const equalTime = sync(conn.selectFrom(t).where(ours).and(time.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const orderedTime = sync(conn.selectFrom(t).where(ours).select({ id: t.id, time }).orderBy('time').executeSelectMany())
            expect(equal).toEqual([101, 102])
            expect(later).toEqual([103])
            expect(ordered.map(row => row.id)).toEqual([101, 102, 103])
            expect(equalTime).toEqual([101, 102])
            expect(orderedTime.map(row => row.id)).toEqual([101, 102, 103])
        })
    })

    test('UTC milliseconds as text using Z timezone: the rows of an earlier version, normalized to milliseconds, compare well', async () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using Z timezone')
        const t = tColMatrixOptional
        const dateTime = t.mDatetime
        const time = t.mTime
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext([101])
        ctx.mockNext([102, 103])
        ctx.mockNext([101, 102, 103].map(id => ({ id, at: NO_MILLISECONDS })))
        ctx.mockNext([101])
        ctx.mockNext([101, 102, 103].map(id => ({ id, time: NO_MILLISECONDS })))
        await ctx.withRollback(async () => {
            sync(conn.insertInto(tColMatrixOptional).set({ id: 101, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:00Z'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00Z'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 102, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:00.500Z'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00.500Z'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 103, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14 10:00:01Z'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:01Z'` }).executeInsert())
            sync(conn.update(t)
                .set({ mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`substr(${dateTime}, 1, 19) || '.000Z'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${dateTime}) = 20`)
                .executeUpdate())
            sync(conn.update(t)
                .set({ mTime: conn.fragmentWithType('localTime', 'required').sql`substr(${time}, 1, 8) || '.000Z'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${time}) = 9`)
                .executeUpdate())
            const ours = t.id.greaterThan(100)
            const equal = sync(conn.selectFrom(t).where(ours).and(dateTime.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const later = sync(conn.selectFrom(t).where(ours).and(dateTime.greaterThan(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const ordered = sync(conn.selectFrom(t).where(ours).select({ id: t.id, at: dateTime }).orderBy('at').executeSelectMany())
            const equalTime = sync(conn.selectFrom(t).where(ours).and(time.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const orderedTime = sync(conn.selectFrom(t).where(ours).select({ id: t.id, time }).orderBy('time').executeSelectMany())
            expect(equal).toEqual([101])
            expect(later).toEqual([102, 103])
            expect(ordered.map(row => row.id)).toEqual([101, 102, 103])
            expect(equalTime).toEqual([101])
            expect(orderedTime.map(row => row.id)).toEqual([101, 102, 103])
        })
    })

    test('UTC seconds as text using T separator and Z timezone: the rows of an earlier version, normalized to seconds, compare well', async () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using T separator and Z timezone')
        const t = tColMatrixOptional
        const dateTime = t.mDatetime
        const time = t.mTime
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(2)
        ctx.mockNext(2)
        ctx.mockNext([101, 102])
        ctx.mockNext([103])
        ctx.mockNext([101, 102, 103].map(id => ({ id, at: NO_MILLISECONDS })))
        ctx.mockNext([101, 102])
        ctx.mockNext([101, 102, 103].map(id => ({ id, time: NO_MILLISECONDS })))
        await ctx.withRollback(async () => {
            sync(conn.insertInto(tColMatrixOptional).set({ id: 101, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:00Z'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00Z'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 102, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:00.500Z'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00.500Z'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 103, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:01Z'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:01Z'` }).executeInsert())
            sync(conn.update(t)
                .set({ mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`substr(${dateTime}, 1, 19) || 'Z'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${dateTime}) > 20`)
                .executeUpdate())
            sync(conn.update(t)
                .set({ mTime: conn.fragmentWithType('localTime', 'required').sql`substr(${time}, 1, 8) || 'Z'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${time}) > 9`)
                .executeUpdate())
            const ours = t.id.greaterThan(100)
            const equal = sync(conn.selectFrom(t).where(ours).and(dateTime.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const later = sync(conn.selectFrom(t).where(ours).and(dateTime.greaterThan(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const ordered = sync(conn.selectFrom(t).where(ours).select({ id: t.id, at: dateTime }).orderBy('at').executeSelectMany())
            const equalTime = sync(conn.selectFrom(t).where(ours).and(time.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const orderedTime = sync(conn.selectFrom(t).where(ours).select({ id: t.id, time }).orderBy('time').executeSelectMany())
            expect(equal).toEqual([101, 102])
            expect(later).toEqual([103])
            expect(ordered.map(row => row.id)).toEqual([101, 102, 103])
            expect(equalTime).toEqual([101, 102])
            expect(orderedTime.map(row => row.id)).toEqual([101, 102, 103])
        })
    })

    test('UTC milliseconds as text using T separator and Z timezone: the rows of an earlier version, normalized to milliseconds, compare well', async () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using T separator and Z timezone')
        const t = tColMatrixOptional
        const dateTime = t.mDatetime
        const time = t.mTime
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext(1)
        ctx.mockNext([101])
        ctx.mockNext([102, 103])
        ctx.mockNext([101, 102, 103].map(id => ({ id, at: NO_MILLISECONDS })))
        ctx.mockNext([101])
        ctx.mockNext([101, 102, 103].map(id => ({ id, time: NO_MILLISECONDS })))
        await ctx.withRollback(async () => {
            sync(conn.insertInto(tColMatrixOptional).set({ id: 101, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:00Z'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00Z'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 102, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:00.500Z'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:00.500Z'` }).executeInsert())
            sync(conn.insertInto(tColMatrixOptional).set({ id: 103, mInt: 1, mBigint: 1n, mDouble: 1, mBool: true, mUuid: 'b1f5a7c4-8c2e-4f7a-9d3b-2a6e5c1f0d41', mDate: NO_MILLISECONDS, mStr: 'm',
                mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`'2024-01-14T10:00:01Z'`,
                mTime: conn.fragmentWithType('localTime', 'required').sql`'10:00:01Z'` }).executeInsert())
            sync(conn.update(t)
                .set({ mDatetime: conn.fragmentWithType('localDateTime', 'required').sql`substr(${dateTime}, 1, 19) || '.000Z'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${dateTime}) = 20`)
                .executeUpdate())
            sync(conn.update(t)
                .set({ mTime: conn.fragmentWithType('localTime', 'required').sql`substr(${time}, 1, 8) || '.000Z'` })
                .where(conn.fragmentWithType('boolean', 'required').sql`length(${time}) = 9`)
                .executeUpdate())
            const ours = t.id.greaterThan(100)
            const equal = sync(conn.selectFrom(t).where(ours).and(dateTime.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const later = sync(conn.selectFrom(t).where(ours).and(dateTime.greaterThan(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const ordered = sync(conn.selectFrom(t).where(ours).select({ id: t.id, at: dateTime }).orderBy('at').executeSelectMany())
            const equalTime = sync(conn.selectFrom(t).where(ours).and(time.equals(NO_MILLISECONDS)).selectOneColumn(t.id).orderBy('result').executeSelectMany())
            const orderedTime = sync(conn.selectFrom(t).where(ours).select({ id: t.id, time }).orderBy('time').executeSelectMany())
            expect(equal).toEqual([101])
            expect(later).toEqual([102, 103])
            expect(ordered.map(row => row.id)).toEqual([101, 102, 103])
            expect(equalTime).toEqual([101])
            expect(orderedTime.map(row => row.id)).toEqual([101, 102, 103])
        })
    })
})
