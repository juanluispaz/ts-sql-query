// Compile-time negative tests for the scaled bigints on the sqlserver dialect: a ScaledBigInt has its scale in its type,
// so a negative scale, a value of another scale, a plain bigint, a product of two of them and a type of yours of another scale than the
// family it extends are rejected. These never execute any SQL: `validate:tests` (tsc) rejects each
// `@ts-expect-error` line.

import { test, expect } from '../../../lib/testRunner.js'
import { Table } from '../../../../src/Table.js'
import { DBConnection } from '../domain/connection.js'
import { scaledBigInt, scaledBigIntsType, scaledBigIntType, type ScaledBigInt } from '../../../../src/exports/v2/index.js'

const tScaledAmount = new class TScaledAmount extends Table<DBConnection, 'TScaledAmount'> {
    id    = this.primaryKey('id', 'int')
    price = this.optionalColumn('price', scaledBigIntType(2))
    constructor() { super('exact_amount') }
}()

// Rule: a type of yours extends the family of the scale of its values.
const ScaledBigIntsOf2 = scaledBigIntsType(2)
abstract class PriceType extends ScaledBigIntsOf2<ScaledBigInt<2> & { readonly __brand: 'Price' }, 'Price'> {
    static override readonly type = 'Price'
}
// @ts-expect-error the values of a type of the family of the scale 2 are of the scale 2
abstract class OtherScaleType extends ScaledBigIntsOf2<ScaledBigInt<3>, 'OtherScale'> {}

// Rule: a value of a scaled bigint is of its scale: neither another scale nor a plain bigint.
const sameScale = tScaledAmount.price.equals(scaledBigInt(150n, 2))
// @ts-expect-error a value of another scale
const otherScale = tScaledAmount.price.equals(scaledBigInt(150n, 3))
// @ts-expect-error a plain bigint has no scale
const plainBigint = tScaledAmount.price.equals(150n)
// @ts-expect-error the sum of a value of another scale
const otherScaleSum = tScaledAmount.price.add(scaledBigInt(1n, 3))

// Rule: a scale is 0 or more (a function never called: the call throws).
// @ts-expect-error a negative scale
const negativeScale = () => scaledBigIntType(-2)

// Rule: two scaled bigints aren't multiplied nor divided: the product has another scale (functions never called:
// the methods don't exist).
// @ts-expect-error a scaled bigint has no multiply
const product = () => tScaledAmount.price.multiply(scaledBigInt(2n, 2))
// @ts-expect-error a scaled bigint has no divide
const quotient = () => tScaledAmount.price.divide(scaledBigInt(2n, 2))

test('compile-time-only', () => {
    void PriceType
    void OtherScaleType
    void [sameScale, otherScale, plainBigint, otherScaleSum, product, quotient, negativeScale]
    expect(true).toBe(true)
})
