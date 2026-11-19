import type { DataTypeClass } from '../TypeAdapter.js'
import { __fitsInANumberSql } from './dataTypes.js'
import { BooleanType } from './logical.js'
import { DoubleType, IntType } from './number.js'
import { IntegersType, RealsType } from './numeric.js'
import { DecimalsType } from './decimals.js'
import { StringType } from './strings.js'
import { UuidsType } from './uuids.js'
import { LocalDatesType, LocalDateTimesType, LocalTimesType } from './localDates.js'
import { PlainDatesType, PlainDateTimesType, PlainTimesType } from './plainDates.js'
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
/**
 * An int, a number of JavaScript: an IntType, or an integer (IntegersType) whose SQL data type fits in a number (an int
 * of 4 bytes by default)
 */
export function __isIntClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, IntType) || (isOf(typeClass, IntegersType) && __fitsInANumberSql(typeClass))
}
/**
 * A bigint of JavaScript: an integer (IntegersType, also BigintType) whose SQL data type doesn't fit in a number (8
 * bytes, more than 15 digits, a precision without limit): what its values are says how they are kept in JavaScript
 */
export function __isBigintClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, IntegersType) && !__fitsInANumberSql(typeClass)
}
/** A double: a DoubleType, or a floating point number of the user (RealsType) */
export function __isDoubleClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, DoubleType) || isOf(typeClass, RealsType)
}
/** An exact decimal: a stringDecimal or a decimal of the user, whose value is its text */
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
/** A date whose value is like a Temporal.PlainDate: a plainDate, or a type of the user of its family */
export function __isPlainDateClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, PlainDatesType)
}
/** A time whose value is like a Temporal.PlainTime: a plainTime, or a type of the user of its family */
export function __isPlainTimeClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, PlainTimesType)
}
/** A date and a time whose value is like a Temporal.PlainDateTime: a plainDateTime, or a type of the user of its family */
export function __isPlainDateTimeClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, PlainDateTimesType)
}
export function __isAggregatedArrayClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, AggregatedArraysType)
}
