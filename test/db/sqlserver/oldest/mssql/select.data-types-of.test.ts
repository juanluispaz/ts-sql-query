// The data types a family makes with `of`, for a specific use: an enumeration of its values (EnumType.of), an integer
// of yours (IntegersType.of) and a scaled bigint of yours with its scale (ScaledBigIntsType.of). A value of an
// enumeration is one of its values, sent and read: another one is rejected, and null says any value goes.
// issue_worklog has the activities coding (1), review (2) and meeting (3) and the minutes 90, null and 30;
// issue 1 has the title 'Update hero copy'; exact_amount row 1 has the price 1.50.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { Table } from '../../../../../src/Table.js'
import { TsSqlError } from '../../../../../src/TsSqlError.js'
import { EnumType, IntegersType, IntType, ScaledBigIntsType, type ScaledBigInt } from '../../../../../src/exports/v2/index.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'

type Units = number & { readonly __units: 'Units' }
type Price = ScaledBigInt<2> & { readonly __price: 'Price' }

const tWorklogOf = new class TWorklogOf extends Table<DBConnection, 'TWorklogOf'> {
    id       = this.primaryKey('id', 'int')
    activity = this.column('activity', EnumType.of('WorklogActivity', ['coding', 'review', 'meeting']))
    minutes  = this.optionalColumn('minutes', IntegersType.of<Units, 'Units'>('Units'))
    constructor() { super('issue_worklog') }
}()

// The title of an issue read as an enumeration whose values aren't titles, and as one that takes any value
const tIssueTitleOf = new class TIssueTitleOf extends Table<DBConnection, 'TIssueTitleOf'> {
    id         = this.primaryKey('id', 'int')
    titleKind  = this.column('title', EnumType.of('TitleKind', ['short', 'long']))
    anyTitle   = this.column('title', EnumType.of<string, 'AnyTitle'>('AnyTitle', null))
    constructor() { super('issue') }
}()

const tPriceOf = new class TPriceOf extends Table<DBConnection, 'TPriceOf'> {
    id    = this.primaryKey('id', 'int')
    price = this.optionalColumn('price', ScaledBigIntsType.of<Price, 'Price'>('Price', 2))
    constructor() { super('exact_amount') }
}()

// An enumeration of yours as a class, which must say its values
abstract class MoodWithoutValuesType extends EnumType<'happy' | 'sad', 'MoodWithoutValues'> {
    static override readonly type = 'MoodWithoutValues'
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('data-types-of/an-enum-of-its-values', async () => {
        ctx.mockNext([
            { id: 1, activity: 'coding' },
            { id: 2, activity: 'review' },
            { id: 3, activity: 'meeting' },
        ])
        const rows = await ctx.conn.selectFrom(tWorklogOf)
            .select({ id: tWorklogOf.id, activity: tWorklogOf.activity })
            .orderBy('id')
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id, activity as activity from issue_worklog order by id"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`[]`)
        assertType<Exact<typeof rows, { id: number; activity: 'coding' | 'review' | 'meeting' }[]>>()
        expect(rows).toEqual([
            { id: 1, activity: 'coding' },
            { id: 2, activity: 'review' },
            { id: 3, activity: 'meeting' },
        ])
    })

    test('data-types-of/an-enum-sends-one-of-its-values', async () => {
        ctx.mockNext([{ id: 2 }])
        const rows = await ctx.conn.selectFrom(tWorklogOf)
            .where(tWorklogOf.activity.equals('review'))
            .select({ id: tWorklogOf.id })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from issue_worklog where activity = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "review",
          ]
        `)
        expect(rows).toEqual([{ id: 2 }])
    })

    test('data-types-of/an-enum-rejects-a-value-to-send', async () => {
        let error: unknown
        try {
            await ctx.conn.selectFrom(tWorklogOf)
                .where(tWorklogOf.activity.equals('sleeping' as any))
                .select({ id: tWorklogOf.id })
                .executeSelectMany()
        } catch (e) {
            error = e
        }
        expect(error instanceof TsSqlError ? error.errorReason : undefined).toEqual({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value: 'sleeping', typeName: 'WorklogActivity', paramIndex: 0 })
    })

    test('data-types-of/an-enum-rejects-a-value-received', async () => {
        ctx.mockNext([{ titleKind: 'Update hero copy' }])
        let error: unknown
        try {
            await ctx.conn.selectFrom(tIssueTitleOf)
                .where(tIssueTitleOf.id.equals(1))
                .select({ titleKind: tIssueTitleOf.titleKind })
                .executeSelectMany()
        } catch (e) {
            error = e
        }
        expect(error instanceof TsSqlError ? error.errorReason : undefined).toEqual({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', value: 'Update hero copy', typeName: 'TitleKind', rowIndex: 0, columnPath: 'titleKind' })
    })

    test('data-types-of/an-enum-of-null-takes-any-value', async () => {
        ctx.mockNext([{ anyTitle: 'Update hero copy' }])
        const rows = await ctx.conn.selectFrom(tIssueTitleOf)
            .where(tIssueTitleOf.id.equals(1))
            .select({ anyTitle: tIssueTitleOf.anyTitle })
            .executeSelectMany()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select title as anyTitle from issue where id = @0"`)
        assertType<Exact<typeof rows, { anyTitle: string }[]>>()
        expect(rows).toEqual([{ anyTitle: 'Update hero copy' }])
    })

    test('data-types-of/an-enum-of-numbers-reads-the-text-of-a-number-as-the-number', async () => {
        const LevelType = EnumType.of('Level', [1, 2, 3])
        ctx.mockNext('2')
        const level = await ctx.conn.selectFromNoTable()
            .selectOneColumn(ctx.conn.const(2, LevelType))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select @0 as result"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            2,
          ]
        `)
        assertType<Exact<typeof level, 1 | 2 | 3>>()
        expect(level).toBe(2)
    })

    test('data-types-of/an-enum-class-without-values-is-rejected', async () => {
        ctx.mockNext('happy')
        let error: unknown
        try {
            await ctx.conn.selectFromNoTable()
                .selectOneColumn(ctx.conn.const('happy', MoodWithoutValuesType))
                .executeSelectOne()
        } catch (e) {
            error = e
        }
        expect(error instanceof TsSqlError ? error.errorReason : undefined).toEqual({ reason: 'INVALID_CONFIGURATION', name: 'values', value: 'MoodWithoutValues' })
    })

    test('data-types-of/the-same-class-for-the-same-type-name', () => {
        const activities = ['coding', 'review', 'meeting'] as const
        expect(EnumType.of('WorklogActivity', activities)).toBe(EnumType.of('WorklogActivity', ['coding', 'review', 'meeting']))
        expect(EnumType.of('WorklogActivity', activities).values).toEqual(['coding', 'review', 'meeting'])
        expect(EnumType.of('WorklogActivity', activities).type).toBe('WorklogActivity')
        expect(IntegersType.of<Units, 'Units'>('Units')).toBe(IntegersType.of<Units, 'Units'>('Units'))
        expect(ScaledBigIntsType.of<Price, 'Price'>('Price', 2).sqlDataType).toEqual({ family: 'exact numeric', scale: 2 })
        let otherValues: unknown
        try {
            EnumType.of('WorklogActivity', ['coding'])
        } catch (e) {
            otherValues = e
        }
        expect(otherValues instanceof TsSqlError ? otherValues.errorReason : undefined).toEqual({ reason: 'INVALID_CONFIGURATION', name: 'typeName', value: 'WorklogActivity' })
    })

    test('data-types-of/a-data-type-has-no-of', () => {
        let error: unknown
        try {
            (IntType as any).of('Units')
        } catch (e) {
            error = e
        }
        expect(error instanceof TsSqlError ? error.errorReason : undefined).toEqual({ reason: 'INVALID_CONFIGURATION', name: 'of', value: 'int' })
    })

    test('data-types-of/undefined-values-of-an-enum-are-rejected', () => {
        let error: unknown
        try {
            (EnumType.of as any)('Mood', undefined)
        } catch (e) {
            error = e
        }
        expect(error instanceof TsSqlError ? error.errorReason : undefined).toEqual({ reason: 'INVALID_CONFIGURATION', name: 'values', value: undefined })
    })

    test('data-types-of/an-integer-and-a-scaled-bigint-of-yours', async () => {
        ctx.mockNext([
            { id: 1, minutes: 90 },
            { id: 2, minutes: null },
            { id: 3, minutes: 30 },
        ])
        ctx.mockNext({ price: '1.50' })
        const minutes = await ctx.conn.selectFrom(tWorklogOf)
            .select({ id: tWorklogOf.id, minutes: tWorklogOf.minutes })
            .orderBy('id')
            .executeSelectMany()
        const price = await ctx.conn.selectFrom(tPriceOf)
            .where(tPriceOf.id.equals(1))
            .select({ price: tPriceOf.price })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select convert(nvarchar(41), price) as price from exact_amount where id = @0"`)
        assertType<Exact<typeof minutes, { id: number; minutes?: Units }[]>>()
        assertType<Exact<typeof price, { price?: Price }>>()
        expect(minutes).toEqual([{ id: 1, minutes: 90 }, { id: 2 }, { id: 3, minutes: 30 }])
        expect(price).toEqual({ price: 150n })
    })
})
