import type { DataTypeClass } from '../TypeAdapter.js'
import { BooleanType } from './logical.js'
import { DoubleType, IntType } from './number.js'
import { BigintType } from './bigint.js'
import { CustomBigintType } from './customNumber.js'
import { IntegersType, RealsType } from './numeric.js'
import { DecimalsType } from './decimals.js'
import { StringType } from './strings.js'
import { UuidsType } from './uuids.js'
import { LocalDatesType, LocalDateTimesType, LocalTimesType } from './localDates.js'
import { AggregatedArraysType } from './aggregatedArrays.js'

/*
 * The questions the connections ask about the data type of a value, by its class: how the library converts the values
 * of each of its data types (transformValueFromDB / transformValueToDB of the connection, which the user can override,
 * requesting another type). A class answers as the family it extends, also one of the user. Only the connections ask
 * them: the SQL builders and the query runners decide by the SQL data type of the data type (dataTypes.ts).
 */

/** Whether the class is the one given or extends it */
function isOf(typeClass: DataTypeClass, base: abstract new (...args: any) => any): boolean {
    return typeClass === (base as unknown as DataTypeClass) || (typeClass as unknown as { prototype: unknown }).prototype instanceof base
}

export function __isBooleanClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, BooleanType)
}
/** An int: an IntType, or an integer of the user (IntegersType) that is not a bigint */
export function __isIntClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, IntType) || (isOf(typeClass, IntegersType) && !__isBigintClass(typeClass))
}
export function __isBigintClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, BigintType) || isOf(typeClass, CustomBigintType)
}
/** A double: a DoubleType, or a floating point number of the user (RealsType) */
export function __isDoubleClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, DoubleType) || isOf(typeClass, RealsType)
}
/** An exact decimal: a stringDecimal or a customDecimal, whose value is its text */
export function __isExactDecimalClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, DecimalsType)
}
export function __isStringClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, StringType)
}
export function __isUuidClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, UuidsType)
}
export function __isLocalDateClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, LocalDatesType)
}
export function __isLocalTimeClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, LocalTimesType)
}
export function __isLocalDateTimeClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, LocalDateTimesType)
}
export function __isAggregatedArrayClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, AggregatedArraysType)
}
