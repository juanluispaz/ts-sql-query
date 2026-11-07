// Each text format writes a date time and a time with one width: always with three decimals, or always without them.
// These values are compared as text, and with two widths a value without decimals sorts after one with them in the
// same second when a Z follows, since a dot sorts before a Z. The comparisons run on the database. The suite runs in
// UTC, so the local formats write the same text as the UTC ones.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

const NO_MILLISECONDS = new Date(Date.UTC(2024, 0, 14, 10, 0, 0, 0))
const HALF_SECOND = new Date(Date.UTC(2024, 0, 14, 10, 0, 0, 500))
const NEXT_SECOND = new Date(Date.UTC(2024, 0, 14, 10, 0, 1, 0))

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('localdate seconds as text: the milliseconds are dropped, so two values in the same second are equal', () => {
        const conn = ctx.withDateTimeFormat('localdate seconds as text')
        const first = conn.const(NO_MILLISECONDS, 'localDateTime')
        ctx.mockNext({ isBefore: false, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: false })
        const row = sync(conn.selectFromNoTable()
            .select({
                isBefore: first.lessThan(HALF_SECOND),
                isAfter: first.greaterThan(HALF_SECOND),
                equal: first.equals(NO_MILLISECONDS),
                beforeNextSecond: first.lessThan(NEXT_SECOND),
                timeIsBefore: conn.const(NO_MILLISECONDS, 'localTime').lessThan(conn.const(HALF_SECOND, 'localTime')),
            })
            .executeSelectOne())
        expect(ctx.lastParams).toEqual([
            '2024-01-14 10:00:00', '2024-01-14 10:00:00',
            '2024-01-14 10:00:00', '2024-01-14 10:00:00',
            '2024-01-14 10:00:00', '2024-01-14 10:00:00',
            '2024-01-14 10:00:00', '2024-01-14 10:00:01',
            '10:00:00', '10:00:00',
        ])
        assertType<Exact<typeof row, { isBefore: boolean; isAfter: boolean; equal: boolean; beforeNextSecond: boolean; timeIsBefore: boolean }>>()
        expect(row).toEqual({ isBefore: false, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: false })
    })

    test('localdate milliseconds as text: a value without milliseconds comes before one with them in the same second', () => {
        const conn = ctx.withDateTimeFormat('localdate milliseconds as text')
        const first = conn.const(NO_MILLISECONDS, 'localDateTime')
        ctx.mockNext({ isBefore: true, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: true })
        const row = sync(conn.selectFromNoTable()
            .select({
                isBefore: first.lessThan(HALF_SECOND),
                isAfter: first.greaterThan(HALF_SECOND),
                equal: first.equals(NO_MILLISECONDS),
                beforeNextSecond: first.lessThan(NEXT_SECOND),
                timeIsBefore: conn.const(NO_MILLISECONDS, 'localTime').lessThan(conn.const(HALF_SECOND, 'localTime')),
            })
            .executeSelectOne())
        expect(ctx.lastParams).toEqual([
            '2024-01-14 10:00:00.000', '2024-01-14 10:00:00.500',
            '2024-01-14 10:00:00.000', '2024-01-14 10:00:00.500',
            '2024-01-14 10:00:00.000', '2024-01-14 10:00:00.000',
            '2024-01-14 10:00:00.000', '2024-01-14 10:00:01.000',
            '10:00:00.000', '10:00:00.500',
        ])
        assertType<Exact<typeof row, { isBefore: boolean; isAfter: boolean; equal: boolean; beforeNextSecond: boolean; timeIsBefore: boolean }>>()
        expect(row).toEqual({ isBefore: true, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: true })
    })

    test('localdate seconds as text using T separator: the milliseconds are dropped, so two values in the same second are equal', () => {
        const conn = ctx.withDateTimeFormat('localdate seconds as text using T separator')
        const first = conn.const(NO_MILLISECONDS, 'localDateTime')
        ctx.mockNext({ isBefore: false, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: false })
        const row = sync(conn.selectFromNoTable()
            .select({
                isBefore: first.lessThan(HALF_SECOND),
                isAfter: first.greaterThan(HALF_SECOND),
                equal: first.equals(NO_MILLISECONDS),
                beforeNextSecond: first.lessThan(NEXT_SECOND),
                timeIsBefore: conn.const(NO_MILLISECONDS, 'localTime').lessThan(conn.const(HALF_SECOND, 'localTime')),
            })
            .executeSelectOne())
        expect(ctx.lastParams).toEqual([
            '2024-01-14T10:00:00', '2024-01-14T10:00:00',
            '2024-01-14T10:00:00', '2024-01-14T10:00:00',
            '2024-01-14T10:00:00', '2024-01-14T10:00:00',
            '2024-01-14T10:00:00', '2024-01-14T10:00:01',
            '10:00:00', '10:00:00',
        ])
        assertType<Exact<typeof row, { isBefore: boolean; isAfter: boolean; equal: boolean; beforeNextSecond: boolean; timeIsBefore: boolean }>>()
        expect(row).toEqual({ isBefore: false, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: false })
    })

    test('localdate milliseconds as text using T separator: a value without milliseconds comes before one with them in the same second', () => {
        const conn = ctx.withDateTimeFormat('localdate milliseconds as text using T separator')
        const first = conn.const(NO_MILLISECONDS, 'localDateTime')
        ctx.mockNext({ isBefore: true, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: true })
        const row = sync(conn.selectFromNoTable()
            .select({
                isBefore: first.lessThan(HALF_SECOND),
                isAfter: first.greaterThan(HALF_SECOND),
                equal: first.equals(NO_MILLISECONDS),
                beforeNextSecond: first.lessThan(NEXT_SECOND),
                timeIsBefore: conn.const(NO_MILLISECONDS, 'localTime').lessThan(conn.const(HALF_SECOND, 'localTime')),
            })
            .executeSelectOne())
        expect(ctx.lastParams).toEqual([
            '2024-01-14T10:00:00.000', '2024-01-14T10:00:00.500',
            '2024-01-14T10:00:00.000', '2024-01-14T10:00:00.500',
            '2024-01-14T10:00:00.000', '2024-01-14T10:00:00.000',
            '2024-01-14T10:00:00.000', '2024-01-14T10:00:01.000',
            '10:00:00.000', '10:00:00.500',
        ])
        assertType<Exact<typeof row, { isBefore: boolean; isAfter: boolean; equal: boolean; beforeNextSecond: boolean; timeIsBefore: boolean }>>()
        expect(row).toEqual({ isBefore: true, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: true })
    })

    test('UTC seconds as text: the milliseconds are dropped, so two values in the same second are equal', () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text')
        const first = conn.const(NO_MILLISECONDS, 'localDateTime')
        ctx.mockNext({ isBefore: false, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: false })
        const row = sync(conn.selectFromNoTable()
            .select({
                isBefore: first.lessThan(HALF_SECOND),
                isAfter: first.greaterThan(HALF_SECOND),
                equal: first.equals(NO_MILLISECONDS),
                beforeNextSecond: first.lessThan(NEXT_SECOND),
                timeIsBefore: conn.const(NO_MILLISECONDS, 'localTime').lessThan(conn.const(HALF_SECOND, 'localTime')),
            })
            .executeSelectOne())
        expect(ctx.lastParams).toEqual([
            '2024-01-14 10:00:00', '2024-01-14 10:00:00',
            '2024-01-14 10:00:00', '2024-01-14 10:00:00',
            '2024-01-14 10:00:00', '2024-01-14 10:00:00',
            '2024-01-14 10:00:00', '2024-01-14 10:00:01',
            '10:00:00', '10:00:00',
        ])
        assertType<Exact<typeof row, { isBefore: boolean; isAfter: boolean; equal: boolean; beforeNextSecond: boolean; timeIsBefore: boolean }>>()
        expect(row).toEqual({ isBefore: false, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: false })
    })

    test('UTC milliseconds as text: a value without milliseconds comes before one with them in the same second', () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text')
        const first = conn.const(NO_MILLISECONDS, 'localDateTime')
        ctx.mockNext({ isBefore: true, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: true })
        const row = sync(conn.selectFromNoTable()
            .select({
                isBefore: first.lessThan(HALF_SECOND),
                isAfter: first.greaterThan(HALF_SECOND),
                equal: first.equals(NO_MILLISECONDS),
                beforeNextSecond: first.lessThan(NEXT_SECOND),
                timeIsBefore: conn.const(NO_MILLISECONDS, 'localTime').lessThan(conn.const(HALF_SECOND, 'localTime')),
            })
            .executeSelectOne())
        expect(ctx.lastParams).toEqual([
            '2024-01-14 10:00:00.000', '2024-01-14 10:00:00.500',
            '2024-01-14 10:00:00.000', '2024-01-14 10:00:00.500',
            '2024-01-14 10:00:00.000', '2024-01-14 10:00:00.000',
            '2024-01-14 10:00:00.000', '2024-01-14 10:00:01.000',
            '10:00:00.000', '10:00:00.500',
        ])
        assertType<Exact<typeof row, { isBefore: boolean; isAfter: boolean; equal: boolean; beforeNextSecond: boolean; timeIsBefore: boolean }>>()
        expect(row).toEqual({ isBefore: true, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: true })
    })

    test('UTC seconds as text using T separator: the milliseconds are dropped, so two values in the same second are equal', () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using T separator')
        const first = conn.const(NO_MILLISECONDS, 'localDateTime')
        ctx.mockNext({ isBefore: false, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: false })
        const row = sync(conn.selectFromNoTable()
            .select({
                isBefore: first.lessThan(HALF_SECOND),
                isAfter: first.greaterThan(HALF_SECOND),
                equal: first.equals(NO_MILLISECONDS),
                beforeNextSecond: first.lessThan(NEXT_SECOND),
                timeIsBefore: conn.const(NO_MILLISECONDS, 'localTime').lessThan(conn.const(HALF_SECOND, 'localTime')),
            })
            .executeSelectOne())
        expect(ctx.lastParams).toEqual([
            '2024-01-14T10:00:00', '2024-01-14T10:00:00',
            '2024-01-14T10:00:00', '2024-01-14T10:00:00',
            '2024-01-14T10:00:00', '2024-01-14T10:00:00',
            '2024-01-14T10:00:00', '2024-01-14T10:00:01',
            '10:00:00', '10:00:00',
        ])
        assertType<Exact<typeof row, { isBefore: boolean; isAfter: boolean; equal: boolean; beforeNextSecond: boolean; timeIsBefore: boolean }>>()
        expect(row).toEqual({ isBefore: false, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: false })
    })

    test('UTC milliseconds as text using T separator: a value without milliseconds comes before one with them in the same second', () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using T separator')
        const first = conn.const(NO_MILLISECONDS, 'localDateTime')
        ctx.mockNext({ isBefore: true, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: true })
        const row = sync(conn.selectFromNoTable()
            .select({
                isBefore: first.lessThan(HALF_SECOND),
                isAfter: first.greaterThan(HALF_SECOND),
                equal: first.equals(NO_MILLISECONDS),
                beforeNextSecond: first.lessThan(NEXT_SECOND),
                timeIsBefore: conn.const(NO_MILLISECONDS, 'localTime').lessThan(conn.const(HALF_SECOND, 'localTime')),
            })
            .executeSelectOne())
        expect(ctx.lastParams).toEqual([
            '2024-01-14T10:00:00.000', '2024-01-14T10:00:00.500',
            '2024-01-14T10:00:00.000', '2024-01-14T10:00:00.500',
            '2024-01-14T10:00:00.000', '2024-01-14T10:00:00.000',
            '2024-01-14T10:00:00.000', '2024-01-14T10:00:01.000',
            '10:00:00.000', '10:00:00.500',
        ])
        assertType<Exact<typeof row, { isBefore: boolean; isAfter: boolean; equal: boolean; beforeNextSecond: boolean; timeIsBefore: boolean }>>()
        expect(row).toEqual({ isBefore: true, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: true })
    })

    test('UTC seconds as text using Z timezone: the milliseconds are dropped, so two values in the same second are equal', () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using Z timezone')
        const first = conn.const(NO_MILLISECONDS, 'localDateTime')
        ctx.mockNext({ isBefore: false, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: false })
        const row = sync(conn.selectFromNoTable()
            .select({
                isBefore: first.lessThan(HALF_SECOND),
                isAfter: first.greaterThan(HALF_SECOND),
                equal: first.equals(NO_MILLISECONDS),
                beforeNextSecond: first.lessThan(NEXT_SECOND),
                timeIsBefore: conn.const(NO_MILLISECONDS, 'localTime').lessThan(conn.const(HALF_SECOND, 'localTime')),
            })
            .executeSelectOne())
        expect(ctx.lastParams).toEqual([
            '2024-01-14 10:00:00Z', '2024-01-14 10:00:00Z',
            '2024-01-14 10:00:00Z', '2024-01-14 10:00:00Z',
            '2024-01-14 10:00:00Z', '2024-01-14 10:00:00Z',
            '2024-01-14 10:00:00Z', '2024-01-14 10:00:01Z',
            '10:00:00Z', '10:00:00Z',
        ])
        assertType<Exact<typeof row, { isBefore: boolean; isAfter: boolean; equal: boolean; beforeNextSecond: boolean; timeIsBefore: boolean }>>()
        expect(row).toEqual({ isBefore: false, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: false })
    })

    test('UTC milliseconds as text using Z timezone: a value without milliseconds comes before one with them in the same second', () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using Z timezone')
        const first = conn.const(NO_MILLISECONDS, 'localDateTime')
        ctx.mockNext({ isBefore: true, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: true })
        const row = sync(conn.selectFromNoTable()
            .select({
                isBefore: first.lessThan(HALF_SECOND),
                isAfter: first.greaterThan(HALF_SECOND),
                equal: first.equals(NO_MILLISECONDS),
                beforeNextSecond: first.lessThan(NEXT_SECOND),
                timeIsBefore: conn.const(NO_MILLISECONDS, 'localTime').lessThan(conn.const(HALF_SECOND, 'localTime')),
            })
            .executeSelectOne())
        expect(ctx.lastParams).toEqual([
            '2024-01-14 10:00:00.000Z', '2024-01-14 10:00:00.500Z',
            '2024-01-14 10:00:00.000Z', '2024-01-14 10:00:00.500Z',
            '2024-01-14 10:00:00.000Z', '2024-01-14 10:00:00.000Z',
            '2024-01-14 10:00:00.000Z', '2024-01-14 10:00:01.000Z',
            '10:00:00.000Z', '10:00:00.500Z',
        ])
        assertType<Exact<typeof row, { isBefore: boolean; isAfter: boolean; equal: boolean; beforeNextSecond: boolean; timeIsBefore: boolean }>>()
        expect(row).toEqual({ isBefore: true, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: true })
    })

    test('UTC seconds as text using T separator and Z timezone: the milliseconds are dropped, so two values in the same second are equal', () => {
        const conn = ctx.withDateTimeFormat('UTC seconds as text using T separator and Z timezone')
        const first = conn.const(NO_MILLISECONDS, 'localDateTime')
        ctx.mockNext({ isBefore: false, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: false })
        const row = sync(conn.selectFromNoTable()
            .select({
                isBefore: first.lessThan(HALF_SECOND),
                isAfter: first.greaterThan(HALF_SECOND),
                equal: first.equals(NO_MILLISECONDS),
                beforeNextSecond: first.lessThan(NEXT_SECOND),
                timeIsBefore: conn.const(NO_MILLISECONDS, 'localTime').lessThan(conn.const(HALF_SECOND, 'localTime')),
            })
            .executeSelectOne())
        expect(ctx.lastParams).toEqual([
            '2024-01-14T10:00:00Z', '2024-01-14T10:00:00Z',
            '2024-01-14T10:00:00Z', '2024-01-14T10:00:00Z',
            '2024-01-14T10:00:00Z', '2024-01-14T10:00:00Z',
            '2024-01-14T10:00:00Z', '2024-01-14T10:00:01Z',
            '10:00:00Z', '10:00:00Z',
        ])
        assertType<Exact<typeof row, { isBefore: boolean; isAfter: boolean; equal: boolean; beforeNextSecond: boolean; timeIsBefore: boolean }>>()
        expect(row).toEqual({ isBefore: false, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: false })
    })

    test('UTC milliseconds as text using T separator and Z timezone: a value without milliseconds comes before one with them in the same second', () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using T separator and Z timezone')
        const first = conn.const(NO_MILLISECONDS, 'localDateTime')
        ctx.mockNext({ isBefore: true, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: true })
        const row = sync(conn.selectFromNoTable()
            .select({
                isBefore: first.lessThan(HALF_SECOND),
                isAfter: first.greaterThan(HALF_SECOND),
                equal: first.equals(NO_MILLISECONDS),
                beforeNextSecond: first.lessThan(NEXT_SECOND),
                timeIsBefore: conn.const(NO_MILLISECONDS, 'localTime').lessThan(conn.const(HALF_SECOND, 'localTime')),
            })
            .executeSelectOne())
        expect(ctx.lastParams).toEqual([
            '2024-01-14T10:00:00.000Z', '2024-01-14T10:00:00.500Z',
            '2024-01-14T10:00:00.000Z', '2024-01-14T10:00:00.500Z',
            '2024-01-14T10:00:00.000Z', '2024-01-14T10:00:00.000Z',
            '2024-01-14T10:00:00.000Z', '2024-01-14T10:00:01.000Z',
            '10:00:00.000Z', '10:00:00.500Z',
        ])
        assertType<Exact<typeof row, { isBefore: boolean; isAfter: boolean; equal: boolean; beforeNextSecond: boolean; timeIsBefore: boolean }>>()
        expect(row).toEqual({ isBefore: true, isAfter: false, equal: true, beforeNextSecond: true, timeIsBefore: true })
    })

    test('a value with zero milliseconds comes back as the same instant', () => {
        const conn = ctx.withDateTimeFormat('UTC milliseconds as text using Z timezone')
        ctx.mockNext({ at: '2024-01-14 10:00:00.000Z', time: '10:00:00.000Z' })
        const row = sync(conn.selectFromNoTable()
            .select({ at: conn.const(NO_MILLISECONDS, 'localDateTime'), time: conn.const(NO_MILLISECONDS, 'localTime') })
            .executeSelectOne())
        assertType<Exact<typeof row, { at: Date; time: Date }>>()
        expect(row.at.getTime()).toBe(NO_MILLISECONDS.getTime())
        expect(row.time.getTime()).toBe(Date.UTC(1970, 0, 1, 10, 0, 0, 0))
    })
})
