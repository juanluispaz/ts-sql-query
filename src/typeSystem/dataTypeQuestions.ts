import type { DataTypeClass } from '../TypeAdapter.js'
import { __fitsInANumberSql } from './dataTypes.js'
import { BooleanType } from './logical.js'
import { DoubleType, IntType } from './number.js'
import { IntegersType, RealsType } from './numeric.js'
import { DecimalsType, DnumDecimalsType } from './decimals.js'
import { ScaledBigIntsType } from './scaledBigInts.js'
import { StringType } from './strings.js'
import { UuidsType } from './uuids.js'
import { LocalDatesType, LocalDateTimesType, LocalTimesType } from './localDates.js'
import { PlainDatesType, PlainDateTimesType, PlainTimesType } from './plainDates.js'
import { DurationsType } from './durations.js'
import { InstantsType } from './instants.js'
import { ZonedDateTimesType } from './zonedDateTimes.js'
import { PlainMonthDaysType, PlainYearMonthsType } from './plainYearMonths.js'
import { AggregatedArraysType } from './aggregatedArrays.js'
import { EnumType } from './enum.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

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
/**
 * An exact decimal: a stringDecimal, a dnumDecimal, a decimal of the user or a scaled bigint; its value is its text, a
 * dnum for the ones of the dnum family (__isDnumDecimalClass), or a bigint for a scaled bigint
 * (__scaleOfScaledBigIntClass)
 */
export function __isExactDecimalClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, DecimalsType) || isOf(typeClass, ScaledBigIntsType)
}
/** An exact decimal whose value is a scaled bigint: a class of the family ScaledBigIntsType */
export function __isScaledBigIntClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, ScaledBigIntsType)
}
/**
 * The scale of the values of a scaled bigint, the one of the SQL data type of its class (`{ family: 'exact numeric',
 * scale: 2 }`), or undefined when it doesn't say an integer of 0 or more
 */
export function __scaleOfScaledBigIntClass(typeClass: DataTypeClass): number | undefined {
    const sqlDataType = typeClass.sqlDataType
    if (sqlDataType?.family !== 'exact numeric') {
        return undefined
    }
    const scale = sqlDataType.scale
    return scale !== undefined && Number.isSafeInteger(scale) && scale >= 0 ? scale : undefined
}
/** A value of an enumeration: a class of the family EnumType, whose values are the ones it says (__valuesOfEnumClass) */
export function __isEnumClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, EnumType)
}
/**
 * The values of an enumeration, the ones of its class (`static values`), or null when the class says any value goes; a
 * class that says nothing is an error
 */
export function __valuesOfEnumClass(typeClass: DataTypeClass): readonly unknown[] | null {
    const values = (typeClass as { readonly values?: unknown }).values
    if (values === null || Array.isArray(values)) {
        return values
    }
    throw new TsSqlProcessingError({ reason: 'INVALID_CONFIGURATION', name: 'values', value: typeClass.type }, 'The enumeration ' + typeClass.type + " doesn't say its values: static override readonly values = [...] as const, or null for any value")
}
/** An exact decimal whose value is a dnum: a dnumDecimal or a decimal of the user of the dnum family */
export function __isDnumDecimalClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, DnumDecimalsType)
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
/** A month of a year whose value is like a Temporal.PlainYearMonth: a plainYearMonth, or a type of the user of its family */
export function __isPlainYearMonthClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, PlainYearMonthsType)
}
/** A day of a month whose value is like a Temporal.PlainMonthDay: a plainMonthDay, or a type of the user of its family */
export function __isPlainMonthDayClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, PlainMonthDaysType)
}
/** A duration whose value is like a Temporal.Duration: a duration, or a type of the user of its family */
export function __isDurationClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, DurationsType)
}
/** An exact moment whose value is like a Temporal.Instant: an instant, or a type of the user of its family */
export function __isInstantClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, InstantsType)
}
/** An exact moment in a time zone whose value is like a Temporal.ZonedDateTime: a zonedDateTime, or a type of the user of its family */
export function __isZonedDateTimeClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, ZonedDateTimesType)
}
export function __isAggregatedArrayClass(typeClass: DataTypeClass): boolean {
    return isOf(typeClass, AggregatedArraysType)
}
