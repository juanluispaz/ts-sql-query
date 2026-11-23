// Compile-time negative tests for the scaled bigints on the oracle dialect: a ScaledBigInt has its scale in its type,
// so a negative scale, a value of another scale, a plain bigint and a product of two of them are rejected. These never execute any SQL: `validate:tests` (tsc) rejects each
// `@ts-expect-error` line.

import { test, expect } from '../../../lib/testRunner.js'
import { Table } from '../../../../src/Table.js'
import { DBConnection } from '../domain/connection.js'
import { scaledBigInt, ScaledBigIntType } from '../../../../src/exports/v2/index.js'

const tScaledAmount = new class TScaledAmount extends Table<DBConnection, 'TScaledAmount'> {
    id    = this.primaryKey('id', 'int')
    price = this.optionalColumn('price', ScaledBigIntType.of(2))
    constructor() { super('exact_amount') }
}()

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
const negativeScale = () => ScaledBigIntType.of(-2)

// Rule: a name of a scaled bigint has a scale of 0 or more (a function never called: the name is unknown at run time).
const negativeScaleName = () => new class TNegativeName extends Table<DBConnection, 'TNegativeName'> {
    id       = this.primaryKey('id', 'int')
    // @ts-expect-error a negative scale is no name of a data type
    hundreds = this.optionalColumn('hundreds', 'ScaledBigInt<-2>')
    constructor() { super('exact_amount') }
}()

// Rule: two scaled bigints aren't multiplied nor divided: the product has another scale (functions never called:
// the methods don't exist).
// @ts-expect-error a scaled bigint has no multiply
const product = () => tScaledAmount.price.multiply(scaledBigInt(2n, 2))
// @ts-expect-error a scaled bigint has no divide
const quotient = () => tScaledAmount.price.divide(scaledBigInt(2n, 2))

test('compile-time-only', () => {
    void [sameScale, otherScale, plainBigint, otherScaleSum, product, quotient, negativeScale, negativeScaleName]
    expect(true).toBe(true)
})
