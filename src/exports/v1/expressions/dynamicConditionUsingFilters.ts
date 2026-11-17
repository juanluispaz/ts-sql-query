// ts-sql-query/expressions/dynamicConditionUsingFilters: the path of version 1, kept so that code written for it keeps compiling. Each name says where
// it is imported from in version 2

import { type BigintType, type BooleanType, type ComparableType, type DecimalsType, type DoubleType, type DynamicCondition as DynamicConditionOfVersion2, type EnumType, type EqualableType, type FilterOf, type IntegersType, type LocalDateTimeType, type LocalDateTimesType, type LocalDateType, type LocalDatesType, type LocalTimeType, type LocalTimesType, type RealsType, type StringType, type UuidsType } from '../../v2/index.js'
import { type DynamicConditionExtension, type DynamicDefinition } from '../../../expressions/dynamicConditionUsingFilters.js'
import { type AnyValueSource } from '../../../typeSystem/valueSource.js'
import { type NullableType } from '../../../typeSystem/nullable.js'

/** @deprecated Use FilterOf, imported from 'ts-sql-query', with the data type of the column (`FilterOf<IntType>`) */
export interface Filter {
}

/**
 * @deprecated Use FilterOf, imported from 'ts-sql-query', with the data type of the column (`FilterOf<IntType>`)
 */
export type NullableFilter = FilterOf<NullableType<any>>

/**
 * @deprecated Use FilterOf, imported from 'ts-sql-query', with the data type of the column (`FilterOf<EnumType<T, 'Name'>>`)
 */
export type EqualableFilter<TYPE> = FilterOf<EqualableType<TYPE, string>>

/**
 * @deprecated Use FilterOf, imported from 'ts-sql-query', with the data type of the column (`FilterOf<MoneyType>`)
 */
export type ComparableFilter<TYPE> = FilterOf<ComparableType<TYPE, string>>

/**
 * @deprecated Use FilterOf<BooleanType>, imported from 'ts-sql-query'
 */
export type BooleanFilter = FilterOf<BooleanType>

/**
 * @deprecated Use FilterOf<IntType> or FilterOf<DoubleType>, imported from 'ts-sql-query'
 */
export type NumberFilter = FilterOf<DoubleType>

/**
 * @deprecated Use FilterOf<BigintType>, imported from 'ts-sql-query'
 */
export type BigintFilter = FilterOf<BigintType>

/**
 * @deprecated Use FilterOf<StringType>, imported from 'ts-sql-query'
 */
export type StringFilter = FilterOf<StringType>

/**
 * @deprecated Use FilterOf<LocalDateType>, imported from 'ts-sql-query'
 */
export type DateFilter = FilterOf<LocalDateType>

/**
 * @deprecated Use FilterOf<LocalTimeType>, imported from 'ts-sql-query'
 */
export type TimeFilter = FilterOf<LocalTimeType>

/**
 * @deprecated Use FilterOf<LocalDateTimeType>, imported from 'ts-sql-query'
 */
export type DateTimeFilter = FilterOf<LocalDateTimeType>

/** @deprecated Use FilterOf, imported from 'ts-sql-query', with the data type of the column (`FilterOf<MoneyType>`) */
export interface CustomIntFilter<TYPE> extends ComparableFilter<TYPE> {
}

/** @deprecated Use FilterOf, imported from 'ts-sql-query', with the data type of the column (`FilterOf<MoneyType>`) */
export interface CustomDoubleFilter<TYPE> extends ComparableFilter<TYPE> {
}

/** @deprecated Use FilterOf, imported from 'ts-sql-query', with the data type of the column */
export interface CustomLocalDateFilter<TYPE> extends ComparableFilter<TYPE> {
}

/** @deprecated Use FilterOf, imported from 'ts-sql-query', with the data type of the column */
export interface CustomLocalTimeFilter<TYPE> extends ComparableFilter<TYPE> {
}

/** @deprecated Use FilterOf, imported from 'ts-sql-query', with the data type of the column */
export interface CustomLocalDateTimeFilter<TYPE> extends ComparableFilter<TYPE> {
}

/** @deprecated Use FilterOf, imported from 'ts-sql-query', with the data type of the column (`FilterOf<CustomerIdType>`) */
export interface CustomUuidFilter<TYPE> extends FilterOf<UuidsType<TYPE, string>> {
}

/**
 * @deprecated Use DynamicCondition, imported from 'ts-sql-query': a column of a type of yours is declared with its data
 * type (`total: MoneyType`) instead of a tuple (`total: ['customDouble', Money]`)
 */
export type DynamicCondition<DEFINITION, EXTENSION extends DynamicConditionExtension = never> =
    DefinitionOfVersion1<DEFINITION> extends infer RESULT extends DynamicDefinition ? DynamicConditionOfVersion2<RESULT, EXTENSION> : never

// The data type each tuple of version 1 declared
type ColumnOfVersion1<COLUMN> =
    COLUMN extends ['customInt', infer T] ? IntegersType<T, string> :
    COLUMN extends ['customBigint', infer T] ? IntegersType<T, string> :
    COLUMN extends ['customDouble', infer T] ? RealsType<T, string> :
    COLUMN extends ['customDecimal', infer T] ? DecimalsType<T, string> :
    COLUMN extends ['customUuid', infer T] ? UuidsType<T, string> :
    COLUMN extends ['customLocalDate', infer T] ? LocalDatesType<T, string> :
    COLUMN extends ['customLocalTime', infer T] ? LocalTimesType<T, string> :
    COLUMN extends ['customLocalDateTime', infer T] ? LocalDateTimesType<T, string> :
    COLUMN extends ['enum', infer T] ? EnumType<T, string> :
    COLUMN extends ['custom', infer T] ? EqualableType<T, string> :
    COLUMN extends ['customComparable', infer T] ? ComparableType<T, string> :
    COLUMN

// A definition of version 1, with its tuples as data types: up to 5 levels, as a definition of version 2
type DefinitionOfVersion1<DEFINITION> = {
    [KEY in keyof DEFINITION]: DEFINITION[KEY] extends AnyValueSource | string | [string, any] ? ColumnOfVersion1<DEFINITION[KEY]> : DefinitionOfVersion1Level2<DEFINITION[KEY]>
}
type DefinitionOfVersion1Level2<DEFINITION> = {
    [KEY in keyof DEFINITION]: DEFINITION[KEY] extends AnyValueSource | string | [string, any] ? ColumnOfVersion1<DEFINITION[KEY]> : DefinitionOfVersion1Level3<DEFINITION[KEY]>
}
type DefinitionOfVersion1Level3<DEFINITION> = {
    [KEY in keyof DEFINITION]: DEFINITION[KEY] extends AnyValueSource | string | [string, any] ? ColumnOfVersion1<DEFINITION[KEY]> : DefinitionOfVersion1Level4<DEFINITION[KEY]>
}
type DefinitionOfVersion1Level4<DEFINITION> = {
    [KEY in keyof DEFINITION]: DEFINITION[KEY] extends AnyValueSource | string | [string, any] ? ColumnOfVersion1<DEFINITION[KEY]> : DefinitionOfVersion1Level5<DEFINITION[KEY]>
}
type DefinitionOfVersion1Level5<DEFINITION> = {
    [KEY in keyof DEFINITION]: ColumnOfVersion1<DEFINITION[KEY]>
}
