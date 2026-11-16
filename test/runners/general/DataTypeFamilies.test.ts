// A data type of the user extends the family of what its values can do, with its type name: an integer, a decimal, a
// floating point number, a uuid or a date is sent and read as the custom data type of that family; a family that
// doesn't fix how the values are kept (a number that is only added, a value compared for equality or with an order)
// converts nothing, as a custom one. A class that doesn't say its static type is named by its class.

import { describe, expect, test } from '../../lib/testRunner.js'
import { PostgreSqlConnection } from '../../../src/connections/PostgreSqlConnection.js'
import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { getQueryContext } from '../../../src/QueryContext.js'
import { TsSqlError } from '../../../src/TsSqlError.js'
import {
    CustomComparableType, CustomDecimalType, CustomDoubleType, CustomEqualableType, CustomIntType, CustomLocalDateType, CustomUuidType,
} from '../../../src/exports/v2/index.js'
import type { DataTypeClass } from '../../../src/TypeAdapter.js'
import { AdditiveType, IntegersType, RealsType } from '../../../src/typeSystem/numeric.js'
import { DecimalsType } from '../../../src/typeSystem/decimals.js'
import { UuidsType } from '../../../src/typeSystem/uuids.js'
import { LocalDatesType } from '../../../src/typeSystem/localDates.js'
import { EqualableType } from '../../../src/typeSystem/equalable.js'
import { ComparableType } from '../../../src/typeSystem/comparable.js'

abstract class QuantityType extends IntegersType<number, 'Quantity'> { static override readonly type = 'Quantity' }
abstract class PriceType extends DecimalsType<string, 'Price'> { static override readonly type = 'Price' }
abstract class RatioType extends RealsType<number, 'Ratio'> { static override readonly type = 'Ratio' }
abstract class KeyType extends UuidsType<string, 'Key'> { static override readonly type = 'Key' }
abstract class DayType extends LocalDatesType<Date, 'Day'> { static override readonly type = 'Day' }
abstract class CashType extends AdditiveType<number, 'Cash'> { static override readonly type = 'Cash' }
abstract class TagType extends EqualableType<string, 'Tag'> { static override readonly type = 'Tag' }
abstract class VersionType extends ComparableType<string, 'Version'> { static override readonly type = 'Version' }
abstract class UnnamedQuantityType extends IntegersType<number, 'UnnamedQuantity'> {}

class DBConnection extends PostgreSqlConnection<'DBConnection'> {}

let lastQuery = ''
let lastParams: any[] = []
let rowsToReturn: any[] = []
const conn = new DBConnection(new MockQueryRunner((type, query, params) => {
    lastQuery = query
    lastParams = params
    return type === 'selectOneRow' ? rowsToReturn[0] : rowsToReturn
}))

/** What a query of a constant of the class gives: its SQL, its params, the value read (or the reason of the error) */
async function roundTrip(typeClass: DataTypeClass, sent: unknown, read: unknown): Promise<unknown> {
    rowsToReturn = [{ value: read }]
    let value: unknown
    try {
        value = await conn.selectFromNoTable().select({ value: conn.const(sent as never, typeClass as never) }).executeSelectOne()
    } catch (e) {
        value = e instanceof TsSqlError ? e.errorReason.reason : e
    }
    return { sql: lastQuery, params: lastParams, value }
}

describe('DataTypeFamilies', () => {
    const pairs: Array<[string, DataTypeClass, DataTypeClass, unknown, unknown[]]> = [
        ['integers', QuantityType, CustomIntType.of<number, 'Quantity'>('Quantity'), 7, [7, '7', 7n, 1.5, 'x', null]],
        ['decimals', PriceType, CustomDecimalType.of<string, 'Price'>('Price'), '1.25', ['1.25', 1.25, 'x', null]],
        ['reals', RatioType, CustomDoubleType.of<number, 'Ratio'>('Ratio'), 0.5, [0.5, '0.5', 'x', null]],
        ['uuids', KeyType, CustomUuidType.of<string, 'Key'>('Key'), '1d2b5e7a-1c3f-4b6a-8d9e-0f1a2b3c4d5e', ['1D2B5E7A-1C3F-4B6A-8D9E-0F1A2B3C4D5E', 5, null]],
        ['dates', DayType, CustomLocalDateType.of<Date, 'Day'>('Day'), new Date(Date.UTC(2024, 0, 2)), ['2024-01-02', new Date(Date.UTC(2024, 0, 2)), 'x', null]],
        ['equalable', TagType, CustomEqualableType.of<string, 'Tag'>('Tag'), 'a', ['a', 5, null]],
        ['comparable', VersionType, CustomComparableType.of<string, 'Version'>('Version'), '1.0', ['1.0', 5, null]],
    ]

    for (const [label, familyClass, customClass, sent, reads] of pairs) {
        test('a-data-type-of-the-' + label + '-family-is-sent-and-read-as-its-custom-data-type', async () => {
            expect(familyClass.sqlDataType).toBe(customClass.sqlDataType)
            for (const read of reads) {
                const result = await roundTrip(familyClass, sent, read)
                expect((result as { value: unknown }).value).not.toBe('INVALID_MOCKED_VALUE')
                expect(result).toEqual(await roundTrip(customClass, sent, read))
            }
        })
    }

    test('an-additive-data-type-converts-nothing-and-has-no-sql-data-type', async () => {
        expect(CashType.sqlDataType).toBeUndefined()
        for (const read of [5, '5', 'x', null]) {
            expect(await roundTrip(CashType, 5, read)).toEqual(await roundTrip(CustomEqualableType.of<number, 'Cash'>('Cash'), 5, read))
        }
    })

    test('the-type-requested-of-a-value-is-the-class-of-the-user', async () => {
        rowsToReturn = []
        await conn.selectFromNoTable().select({ value: conn.const(7, QuantityType) }).executeSelectMany()
        const queryContext = getQueryContext(lastQuery, lastParams)
        expect(queryContext.getParam(0)?.requestedType).toBe(QuantityType)
        expect(queryContext.getResultColumn('value')?.requestedType).toBe(QuantityType)
    })

    test('the-name-of-a-data-type-is-its-static-type-or-the-name-of-its-class', async () => {
        expect(QuantityType.type).toBe('Quantity')
        expect(UnnamedQuantityType.type).toBe('UnnamedQuantityType')
        rowsToReturn = [{ value: 'x' }]
        let error: unknown
        try {
            await conn.selectFromNoTable().select({ value: conn.const(7, UnnamedQuantityType) }).executeSelectOne()
        } catch (e) {
            error = e
        }
        expect(error).toBeInstanceOf(TsSqlError)
        expect(error instanceof TsSqlError ? error.errorReason : error).toMatchObject({ reason: 'INVALID_VALUE_RECEIVED_FROM_DATABASE', typeName: 'UnnamedQuantityType' })
    })
})
