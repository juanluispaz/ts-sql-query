import type { AnyValueSource, ValueSourceOf } from '../expressions/values.js'
import type { AnyForUseInLeftJoin, AnyTableOrView, ForUseInLeftJoin, ITableOrView } from '../utils/ITableOrView.js'
import type { UsableKeyOf } from '../utils/objectUtils.js'
import type { NSource } from '../utils/sourceName.js'
import type { source } from '../utils/symbols.js'

/*
 * This contains the types needed a base for the functions that receves a
 * complex projections, like the argument type in a selec(...)
 */

// [source]?: SOURCE is here to improve TS error messages
export type DataToProject</*in|out*/ SOURCE extends NSource> = DataToProject1<SOURCE> | ITableOrView<SOURCE> | ForUseInLeftJoin<SOURCE>

type DataToProject1</*in|out*/ SOURCE extends NSource> = {
    [P: string]: ValueSourceOf<SOURCE> | DataToProject2<SOURCE> | ITableOrView<SOURCE> | ForUseInLeftJoin<SOURCE>
    // Source si here to improve TS error messages
    [source]?: SOURCE
}

type DataToProject2</*in|out*/ SOURCE extends NSource> = {
    [P: string]: ValueSourceOf<SOURCE> | DataToProject3<SOURCE> | ITableOrView<SOURCE> | ForUseInLeftJoin<SOURCE>
    // Source si here to improve TS error messages
    [source]?: SOURCE
}

type DataToProject3</*in|out*/ SOURCE extends NSource> = {
    [P: string]: ValueSourceOf<SOURCE> | DataToProject4<SOURCE> | ITableOrView<SOURCE> | ForUseInLeftJoin<SOURCE>
    // Source si here to improve TS error messages
    [source]?: SOURCE
}

type DataToProject4</*in|out*/ SOURCE extends NSource> = {
    [P: string]: ValueSourceOf<SOURCE> | DataToProject5<SOURCE> | ITableOrView<SOURCE> | ForUseInLeftJoin<SOURCE>
    // Source si here to improve TS error messages
    [source]?: SOURCE
}

type DataToProject5</*in|out*/ SOURCE extends NSource> = {
    [P: string]: ValueSourceOf<SOURCE>
    // Source si here to improve TS error messages
    [source]?: SOURCE
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export type DataToProjectOfAny = DataToProjectOfAny1 | AnyTableOrView | AnyForUseInLeftJoin

export type DataToProjectOfAny1 = {
    [P: string]: AnyValueSource | DataToProjectOfAny2 | AnyTableOrView | AnyForUseInLeftJoin
}

type DataToProjectOfAny2 = {
    [P: string]: AnyValueSource | DataToProjectOfAny3 | AnyTableOrView | AnyForUseInLeftJoin
}

type DataToProjectOfAny3 = {
    [P: string]: AnyValueSource | DataToProjectOfAny4 | AnyTableOrView | AnyForUseInLeftJoin
}

type DataToProjectOfAny4 = {
    [P: string]: AnyValueSource | DataToProjectOfAny5 | AnyTableOrView | AnyForUseInLeftJoin
}

type DataToProjectOfAny5 = {
    [P: string]: AnyValueSource | DataToProjectOfAny
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export type DataToProjectOf<T> = {
    [P: string]: T | DataToProjectOf2<T>
}

type DataToProjectOf2<T> = {
    [P: string]: T | DataToProjectOf3<T>
}

type DataToProjectOf3<T> = {
    [P: string]: T | DataToProjectOf4<T>
}

type DataToProjectOf4<T> = {
    [P: string]: AnyValueSource | DataToProjectOf5<T>
}

type DataToProjectOf5<T> = {
    [P: string]: T | DataToProjectOfAny
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export type GetDataToProjectSource<TYPE> = ({
    [KEY in UsableKeyOf<TYPE>]-?: TYPE[KEY] extends ValueSourceOf<infer SOURCE> ? SOURCE : GetDataToProjectSource2<TYPE[KEY]>
})[UsableKeyOf<TYPE>]

type GetDataToProjectSource2<TYPE> = ({
    [KEY in UsableKeyOf<TYPE>]-?: TYPE[KEY] extends ValueSourceOf<infer SOURCE> ? SOURCE : GetDataToProjectSource3<TYPE[KEY]>
})[UsableKeyOf<TYPE>]

type GetDataToProjectSource3<TYPE> = ({
    [KEY in UsableKeyOf<TYPE>]-?: TYPE[KEY] extends ValueSourceOf<infer SOURCE> ? SOURCE : GetDataToProjectSource4<TYPE[KEY]>
})[UsableKeyOf<TYPE>]

type GetDataToProjectSource4<TYPE> = ({
    [KEY in UsableKeyOf<TYPE>]-?: TYPE[KEY] extends ValueSourceOf<infer SOURCE> ? SOURCE : GetDataToProjectSource5<TYPE[KEY]>
})[UsableKeyOf<TYPE>]

type GetDataToProjectSource5<TYPE> = ({
    [KEY in UsableKeyOf<TYPE>]-?: TYPE[KEY] extends ValueSourceOf<infer SOURCE> ? SOURCE : never
})[UsableKeyOf<TYPE>]

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/** The names of the columns of a select that a group by can refer to: the required ones that are not an aggregate */
export type NonAggregatedColumnNames<T> = 
    T extends AnyValueSource ? (IsAggregate<T> extends true ? never : 'result')
    : unknown extends T // this is the case when the arguments are of type any
    ? never : NonAggregatedColumnNames1<T, ''>

type IsAggregate<T> = NonNullable<T> extends ValueSourceOf<infer SOURCE> ? ([Extract<SOURCE, `${string}aggregate/`>] extends [never] ? false : true) : false

type NonAggregatedColumnNames1<T, PREFIX extends string> = { [K in UsableKeyOf<T>]-?: 
    K extends string 
    ?
        T[K] extends AnyValueSource | undefined // Undefined is to deal with picking columns
        ? ({} extends Pick<T, K> ? never : IsAggregate<T[K]> extends true ? never : `${PREFIX}${K}`) 
        : NonAggregatedColumnNames2<T[K], `${PREFIX}${K}.`>
    : never
}[UsableKeyOf<T>]

type NonAggregatedColumnNames2<T, PREFIX extends string> = { [K in UsableKeyOf<T>]-?: 
    K extends string 
    ?
        T[K] extends AnyValueSource | undefined // Undefined is to deal with picking columns
        ? ({} extends Pick<T, K> ? never : IsAggregate<T[K]> extends true ? never : `${PREFIX}${K}`) 
        : NonAggregatedColumnNames3<T[K], `${PREFIX}${K}.`>
    : never
}[UsableKeyOf<T>]

type NonAggregatedColumnNames3<T, PREFIX extends string> = { [K in UsableKeyOf<T>]-?: 
    K extends string 
    ?
        T[K] extends AnyValueSource | undefined // Undefined is to deal with picking columns
        ? ({} extends Pick<T, K> ? never : IsAggregate<T[K]> extends true ? never : `${PREFIX}${K}`) 
        : NonAggregatedColumnNames4<T[K], `${PREFIX}${K}.`>
    : never
}[UsableKeyOf<T>]

type NonAggregatedColumnNames4<T, PREFIX extends string> = { [K in UsableKeyOf<T>]-?: 
    K extends string 
    ?
        T[K] extends AnyValueSource | undefined // Undefined is to deal with picking columns
        ? ({} extends Pick<T, K> ? never : IsAggregate<T[K]> extends true ? never : `${PREFIX}${K}`) 
        : NonAggregatedColumnNames5<T[K], `${PREFIX}${K}.`>
    : never
}[UsableKeyOf<T>]

type NonAggregatedColumnNames5<T, PREFIX extends string> = { [K in UsableKeyOf<T>]-?: 
    K extends string 
    ?
        T[K] extends AnyValueSource | undefined // Undefined is to deal with picking columns
        ? ({} extends Pick<T, K> ? never : IsAggregate<T[K]> extends true ? never : `${PREFIX}${K}`) 
        : never
    : never
}[UsableKeyOf<T>]

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export type RequiredColumnNames<T> = 
    T extends AnyValueSource ? 'result' 
    : unknown extends T // this is the case when the arguments are of type any
    ? never : RequiredColumnNames1<T>

type RequiredColumnNames1<T> = { [K in UsableKeyOf<T>]-?: 
    K extends string 
    ?
        T[K] extends AnyValueSource | undefined // Undefined is to deal with picking columns
        ? ({} extends Pick<T, K> ? never : `${K}`) 
        : RequiredColumnNames2<T[K], `${K}.`>
    : never
}[UsableKeyOf<T>]

type RequiredColumnNames2<T, PREFIX extends string> = { [K in UsableKeyOf<T>]-?: 
    K extends string 
    ?
        T[K] extends AnyValueSource | undefined // Undefined is to deal with picking columns
        ? ({} extends Pick<T, K> ? never : `${PREFIX}${K}`) 
        : RequiredColumnNames3<T[K], `${PREFIX}${K}.`>
    : never
}[UsableKeyOf<T>]

type RequiredColumnNames3<T, PREFIX extends string> = { [K in UsableKeyOf<T>]-?: 
    K extends string 
    ?
        T[K] extends AnyValueSource | undefined // Undefined is to deal with picking columns
        ? ({} extends Pick<T, K> ? never : `${PREFIX}${K}`) 
        : RequiredColumnNames4<T[K], `${PREFIX}${K}.`>
    : never
}[UsableKeyOf<T>]

type RequiredColumnNames4<T, PREFIX extends string> = { [K in UsableKeyOf<T>]-?: 
    K extends string 
    ?
        T[K] extends AnyValueSource | undefined // Undefined is to deal with picking columns
        ? ({} extends Pick<T, K> ? never : `${PREFIX}${K}`) 
        : RequiredColumnNames5<T[K], `${PREFIX}${K}.`>
    : never
}[UsableKeyOf<T>]

type RequiredColumnNames5<T, PREFIX extends string> = { [K in UsableKeyOf<T>]-?: 
    K extends string 
    ?
        T[K] extends AnyValueSource | undefined // Undefined is to deal with picking columns
        ? ({} extends Pick<T, K> ? never : `${PREFIX}${K}`) 
        : never
    : never
}[UsableKeyOf<T>]
