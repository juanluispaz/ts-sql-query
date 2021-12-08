import type { ITableOrView, ITableOrViewOf, TableOrViewRef, HasAddWiths } from "../utils/ITableOrView"
import type { AnyDB } from "../databases"
import type { int, double, /*LocalDate, LocalTime, LocalDateTime,*/ stringDouble, stringInt, LocalTime, LocalDateTime, LocalDate } from "ts-extended-types"
import type { TypeAdapter } from "../TypeAdapter"
import type { anyBooleanValueSourceType, bigintValueSourceType, booleanValueSourceType, columnsType, comparableValueSourceType, database, dateTimeValueSourceType, dateValueSourceType, doubleValueSourceType, equalableValueSourceType, ifValueSourceType, intValueSourceType, localDateTimeValueSourceType, localDateValueSourceType, localTimeValueSourceType, nullableValueSourceType, numberValueSourceType, optionalType, requiredTableOrView, resultType, stringDoubleValueSourceType, stringIntValueSourceType, stringNumberValueSourceType, stringValueSourceType, tableOrView, tableOrViewRef, timeValueSourceType, type, typeSafeBigintValueSourceType, typeSafeStringValueSourceType, valueSourceType } from "../utils/symbols"
import { valueType, valueSourceTypeName, isValueSourceObject } from "../utils/symbols"

export type OptionalType = 'required' | 'requiredInOptionalObject'  | 'originallyRequired' | 'optional' // sorted from the more strict to less strict

export type MergeOptional<OP1 extends OptionalType, OP2 extends OptionalType> =
    // Always select the less strict option
    OP1 extends 'any' ? 'optional' :
    OP2 extends 'any' ? 'optional' :
    OP1 extends 'required' ? OP2 :
    OP1 extends 'requiredInOptionalObject' ? (
        OP2 extends 'required' ? 'requiredInOptionalObject' : OP2
    ) :
    OP1 extends 'originallyRequired' ? (
        OP2 extends 'required' | 'requiredInOptionalObject' ? 'originallyRequired' : OP2
    ) : 'optional'

export type MergeOptionalUnion<OPTIONAL_TYPE extends OptionalType> =
    // Always select the less strict option
    'any' extends OPTIONAL_TYPE ? 'optional' :
    'optional' extends OPTIONAL_TYPE ? 'optional' :
    'originallyRequired' extends OPTIONAL_TYPE ? 'originallyRequired' :
    'requiredInOptionalObject' extends OPTIONAL_TYPE ? 'requiredInOptionalObject' :
    'required'

export type OptionalTypeRequiredOrAny<OPTIONAL_TYPE extends OptionalType> =
    // Always select the less strict option
    OPTIONAL_TYPE extends 'any' ? any :
    OPTIONAL_TYPE extends 'required' ? 'required' : any

type OptionalValueType<OPTIONAL_TYPE extends OptionalType> = 
    OPTIONAL_TYPE extends 'required' ? never : null | undefined

export type ValueSourceValueType<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | OptionalValueType<OPTIONAL_TYPE> : never
export type ValueSourceValueTypeForResult<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' ? never : null) : never
export type ValueSourceValueTypeForObjectResult<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' ? never : undefined) : never
export type ValueSourceValueTypeForRequiredInOptionalObject<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' | 'requiredInOptionalObject' ? never : undefined) : never
export type ValueSourceValueTypeForOptionalObjectResultSameOuterJoin<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' | 'requiredInOptionalObject' | 'originallyRequired' ? never : undefined) : never

export interface AnyValueSource {
    [valueSourceType]: 'ValueSource'
}

export interface ValueSourceOfDB<DB extends AnyDB> extends AnyValueSource {
    [database]: DB
}

export interface ValueSourceOf<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>> extends ValueSourceOfDB<TABLE_OR_VIEW[typeof database]> {
    [tableOrView]: TABLE_OR_VIEW
}

export interface IValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends ValueSourceOf<TABLE_OR_VIEW> {
    [valueType]: TYPE
    [optionalType]: OPTIONAL_TYPE
    [valueSourceTypeName]: TYPE_NAME
}

export interface ValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends IValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    isConstValue(): boolean
    getConstValue(): TYPE
}

export interface __ValueSourcePrivate extends HasAddWiths {
    [isValueSourceObject]: true
    __valueType: string
    __optionalType: OptionalType
    __typeAdapter?: TypeAdapter
    __isBooleanForCondition?: boolean

    isConstValue(): boolean
    getConstValue(): any
}

export function isValueSource(value: any): value is AnyValueSource {
    if (value === undefined || value === null) {
        return false
    }
    if (typeof value === 'object') {
        return !!value[isValueSourceObject]
    }
    return false
}

export function __getValueSourceOfObject(obj: ITableOrView<any>, prop: string): ValueSource<TableOrViewRef<AnyDB>, unknown, unknown, any> | undefined {
    const result = (obj as any)[prop]
    if (!result) {
        return undefined
    }
    if (typeof result !== 'object') {
        return undefined
    }
    if (result[isValueSourceObject]) {
        return result as any
    } else {
        return undefined
    }
}

export function __getValueSourcePrivate(valueSource: AnyValueSource | IIfValueSource<any, any>): __ValueSourcePrivate {
    return valueSource as any
}

export interface INullableValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends IValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [nullableValueSourceType]: 'NullableValueSource'
}

export interface NullableValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends ValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>, INullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    isNull(): BooleanValueSource<TABLE_OR_VIEW, 'required'>
    isNotNull(): BooleanValueSource<TABLE_OR_VIEW, 'required'>
    // The next methods must be reimplemented in the subinterface with the proper return type
    valueWhenNull(value: TYPE): NullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, TYPE, this[typeof valueSourceTypeName], any>>(value: VALUE): NullableValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    asOptional(): NullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): NullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
}

export interface IExecutableSelectQuery<DB extends AnyDB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    [type]: 'ExecutableSelectQuery'
    [database]: DB
    [requiredTableOrView]: REQUIRED_TABLE_OR_VIEW
    [resultType]: RESULT
    [columnsType]: COLUMNS
}

export interface IEqualableValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends INullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [equalableValueSourceType]: 'EqualableValueSource'
}

export interface EqualableValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends NullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>, IEqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    equalsIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    equals(value: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using equalsIfValue instead */
    equals(value: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    equals<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEqualsIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEquals(value: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notEqualsIfValue instead */
    notEquals(value: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEquals<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    isIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    is(value: TYPE | null | undefined): BooleanValueSource<TABLE_OR_VIEW, 'required'>
    is<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], 'required'>
    isNotIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, 'required'>
    isNot(value: TYPE | null | undefined): BooleanValueSource<TABLE_OR_VIEW, 'required'>
    isNot<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], 'required'>

    inIfValue(values: TYPE[] | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    in(values: TYPE[]): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    in<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    in<TABLE_OR_VIEW2 extends ITableOrView<any>>(select: IExecutableSelectQuery<TABLE_OR_VIEW[typeof database], TYPE | null | undefined, IEqualableValueSource<any, TYPE, TYPE_NAME, any>, TABLE_OR_VIEW2>): BooleanValueSource<TABLE_OR_VIEW | TABLE_OR_VIEW2[typeof tableOrViewRef], OPTIONAL_TYPE>
    notInIfValue(values: TYPE[] | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notIn(values: TYPE[]): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notIn<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notIn<TABLE_OR_VIEW2 extends ITableOrView<any>>(select: IExecutableSelectQuery<TABLE_OR_VIEW[typeof database], TYPE | null | undefined, IEqualableValueSource<any, TYPE, TYPE_NAME, any>, TABLE_OR_VIEW2>): BooleanValueSource<TABLE_OR_VIEW | TABLE_OR_VIEW2[typeof tableOrViewRef], OPTIONAL_TYPE>
    inN(...value: TYPE[]): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    inN<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(...value: Array<TYPE | VALUE>): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notInN(...value: TYPE[]): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notInN<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(...value: Array<TYPE | VALUE>): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>

    // Redefined methods
    valueWhenNull(value: TYPE): EqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, TYPE, this[typeof valueSourceTypeName], any>>(value: VALUE): EqualableValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    asOptional(): EqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): EqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
}

export interface IComparableValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends IEqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [comparableValueSourceType]: 'ComparableValueSource'
}

export interface ComparableValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends EqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>, IComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    /** @deprecated use lessThanIfValue method instead */
    smallerIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use lessThan method instead */
    smaller(value: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use lessThan method instead */
    smaller<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use greaterThanIfValue method instead */
    largerIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use greaterThan method instead */
    larger(value: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use greaterThan method instead */
    larger<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use lessOrEqualsIfValue method instead */
    smallAsIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use lessOrEquals method instead */
    smallAs(value: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use lessOrEquals method instead */
    smallAs<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use greaterOrEqualsIfValue method instead */
    largeAsIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use greaterOrEquals method instead */
    largeAs(value: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use greaterOrEquals method instead */
    largeAs<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    lessThanIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    lessThan(value: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using lessThanIfValue instead */
    lessThan(value: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    lessThan<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    greaterThanIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    greaterThan(value: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using greaterThanIfValue instead */
    greaterThan(value: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    greaterThan<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    lessOrEqualsIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    lessOrEquals(value: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using lessOrEqualsIfValue instead */
    lessOrEquals(value: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    lessOrEquals<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    greaterOrEqualsIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    greaterOrEquals(value: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using greaterOrEqualsIfValue instead */
    greaterOrEquals(value: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    greaterOrEquals<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    between(value: TYPE, value2: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using greaterOrEqualsIfValue instead */
    between(value: TYPE | OptionalValueType<OPTIONAL_TYPE>, value2: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    between<VALUE2 extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: TYPE, value2: VALUE2): BooleanValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using greaterOrEqualsIfValue instead */
    between<VALUE2 extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: TYPE | OptionalValueType<OPTIONAL_TYPE>, value2: VALUE2): BooleanValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    between<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE, value2: TYPE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using greaterOrEqualsIfValue instead */
    between<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE, value2: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    between<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>, VALUE2 extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE, value2: VALUE2): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    notBetween(value: TYPE, value2: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using greaterOrEqualsIfValue instead */
    notBetween(value: TYPE | OptionalValueType<OPTIONAL_TYPE>, value2: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notBetween<VALUE2 extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: TYPE, value2: VALUE2): BooleanValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using greaterOrEqualsIfValue instead */
    notBetween<VALUE2 extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: TYPE | OptionalValueType<OPTIONAL_TYPE>, value2: VALUE2): BooleanValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    notBetween<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE, value2: TYPE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using greaterOrEqualsIfValue instead */
    notBetween<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE, value2: TYPE | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notBetween<VALUE extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>, VALUE2 extends IEqualableValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE, value2: VALUE2): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: TYPE): ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, TYPE, this[typeof valueSourceTypeName], any>>(value: VALUE): ComparableValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    asOptional(): ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
}

export interface IBooleanValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IEqualableValueSource<TABLE_OR_VIEW, boolean, 'BooleanValueSource', OPTIONAL_TYPE> {
    [booleanValueSourceType]: 'BooleanValueSource'
    [anyBooleanValueSourceType]: 'AnyBooleanValueSource'
}

export interface BooleanValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends EqualableValueSource<TABLE_OR_VIEW, boolean, 'BooleanValueSource', OPTIONAL_TYPE>, IBooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    negate(): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    and(value: boolean): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); this could be an error in your code */
    and(value: boolean | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    and<VALUE extends IIfValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    and<VALUE extends IBooleanValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or(value: boolean): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); this could be an error in your code */
    or(value: boolean| OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    or<VALUE extends IIfValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or<VALUE extends IBooleanValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: boolean): BooleanValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, boolean, this[typeof valueSourceTypeName], any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): BooleanValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): BooleanValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface IIfValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> {
    [database]: TABLE_OR_VIEW[typeof database]
    [tableOrView]: TABLE_OR_VIEW
    [valueType]: boolean
    [optionalType]: OPTIONAL_TYPE
    [ifValueSourceType]: 'IfValueSource'
    [anyBooleanValueSourceType]: 'AnyBooleanValueSource'
}

export interface IfValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    and(value: boolean): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); this could be an error in your code */
    and(value: boolean | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    and<VALUE extends IIfValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): IfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    and<VALUE extends IBooleanValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or(value: boolean): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); this could be an error in your code */
    or(value: boolean| OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    or<VALUE extends IIfValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): IfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or<VALUE extends IBooleanValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
}

export interface IAnyBooleanValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> {
    [database]: TABLE_OR_VIEW[typeof database]
    [tableOrView]: TABLE_OR_VIEW
    [valueType]: boolean
    [optionalType]: OPTIONAL_TYPE
    [anyBooleanValueSourceType]: 'AnyBooleanValueSource'
}

export interface AlwaysIfValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    and(value: boolean): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); this could be an error in your code */
    and(value: boolean | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    and<VALUE extends IIfValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): AlwaysIfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    and<VALUE extends IBooleanValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): AlwaysIfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or(value: boolean): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); this could be an error in your code */
    or(value: boolean| OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    or<VALUE extends IIfValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): AlwaysIfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or<VALUE extends IBooleanValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): AlwaysIfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
}

export interface INumberValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, number, 'NumberValueSource', OPTIONAL_TYPE> {
    [numberValueSourceType]: 'NumberValueSource'
}

export interface NumberValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, number, 'NumberValueSource', OPTIONAL_TYPE>, INumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    asInt(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> // Maybe unsafe cast, we round it when it is necesary
    asDouble(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asStringInt(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> // Maybe unsafe cast, we round it when it is necesary
    asStringDouble(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asBigint(): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> // Maybe unsafe cast, we round it when it is necesary
    abs(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ceil(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    floor(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    round(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    exp(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ln(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    log10(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sqrt(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cbrt(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sign(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Trigonometric Functions
    acos(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asin(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cos(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cot(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sin(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    tan(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // SqlFunction1
    power(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    power(value: number | OptionalValueType<OPTIONAL_TYPE>): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    power<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    logn(value: number | OptionalValueType<OPTIONAL_TYPE>): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    logn<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    roundn(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    roundn(value: number | OptionalValueType<OPTIONAL_TYPE>): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    roundn<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    minValue(value: number | OptionalValueType<OPTIONAL_TYPE>): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    maxValue(value: number | OptionalValueType<OPTIONAL_TYPE>): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    add(value: number | OptionalValueType<OPTIONAL_TYPE>): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    substract(value: number | OptionalValueType<OPTIONAL_TYPE>): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    multiply(value: number | OptionalValueType<OPTIONAL_TYPE>): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    multiply<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    divide(value: number | OptionalValueType<OPTIONAL_TYPE>): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    divide<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    modulo(value: number | OptionalValueType<OPTIONAL_TYPE>): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use modulo method instead */
    mod(value: number | OptionalValueType<OPTIONAL_TYPE>): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use modulo method instead */
    mod<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    atan2(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    atan2(value: number | OptionalValueType<OPTIONAL_TYPE>): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan2<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: number): NumberValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, number, this[typeof valueSourceTypeName], any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): NumberValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): NumberValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface IStringNumberValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, number | string, 'StringNumberValueSource', OPTIONAL_TYPE> {
    [stringNumberValueSourceType]: 'StringNumberValueSource'
}

export interface StringNumberValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, number | string, 'StringNumberValueSource', OPTIONAL_TYPE>, IStringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    asStringInt(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> // Maybe unsafe cast, we round it when it is necesary
    asStringDouble(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asBigint(): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> // Maybe unsafe cast, we round it when it is necesary
    abs(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ceil(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    floor(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    round(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    exp(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ln(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    log10(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sqrt(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cbrt(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sign(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Trigonometric Functions
    acos(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asin(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cos(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cot(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sin(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    tan(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // SqlFunction1
    power(value: number | string): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    power(value: number | string | OptionalValueType<OPTIONAL_TYPE>): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    power<VALUE extends IStringNumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    power<VALUE extends IStringNumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: number | string): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    logn(value: number | string | OptionalValueType<OPTIONAL_TYPE>): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    logn<VALUE extends IStringNumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    roundn(value: number | string): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    roundn(value: number | string | OptionalValueType<OPTIONAL_TYPE>): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    roundn<VALUE extends IStringNumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: number | string): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    minValue(value: number | string | OptionalValueType<OPTIONAL_TYPE>): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends IStringNumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: number | string): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    maxValue(value: number | string | OptionalValueType<OPTIONAL_TYPE>): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends IStringNumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: number | string): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    add(value: number | string | OptionalValueType<OPTIONAL_TYPE>): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends IStringNumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: number | string): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    substract(value: number | string | OptionalValueType<OPTIONAL_TYPE>): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends IStringNumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: number | string): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    multiply(value: number | string | OptionalValueType<OPTIONAL_TYPE>): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    multiply<VALUE extends IStringNumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: number | string): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    divide(value: number | string | OptionalValueType<OPTIONAL_TYPE>): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    divide<VALUE extends IStringNumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: number | string): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    modulo(value: number | string | OptionalValueType<OPTIONAL_TYPE>): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends IStringNumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use modulo method instead */
    mod(value: number | string): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    mod(value: number | string | OptionalValueType<OPTIONAL_TYPE>): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use modulo method instead */
    mod<VALUE extends IStringNumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    atan2(value: number | string): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    atan2(value: number | string | OptionalValueType<OPTIONAL_TYPE>): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan2<VALUE extends IStringNumberValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: number | string): StringNumberValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, number | string, this[typeof valueSourceTypeName], any>>(value: VALUE): StringNumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): StringNumberValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): StringNumberValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface IIntValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, int, 'IntValueSource', OPTIONAL_TYPE> {
    [intValueSourceType]: 'IntValueSource'
}

export interface IntValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, int, 'IntValueSource', OPTIONAL_TYPE>, IIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    asStringInt(): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asBigint(): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asDouble(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asStringDouble(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    abs(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ceil(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    floor(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    round(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    exp(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ln(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    log10(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sqrt(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cbrt(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sign(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Trigonometric Functions
    acos(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asin(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cos(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cot(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sin(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    tan(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // SqlFunction1
    power(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    power(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    power<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    power(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    power(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    power<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    logn(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    logn<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    logn(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    logn<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    roundn(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    roundn(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    roundn<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: int): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    minValue(value: int | OptionalValueType<OPTIONAL_TYPE>): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): IntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    minValue(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: int): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    maxValue(value: int | OptionalValueType<OPTIONAL_TYPE>): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): IntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    maxValue(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: int): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    add(value: int | OptionalValueType<OPTIONAL_TYPE>): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): IntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    add(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    add(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: int): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    substract(value: int | OptionalValueType<OPTIONAL_TYPE>): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): IntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    substract(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: int): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    multiply(value: int | OptionalValueType<OPTIONAL_TYPE>): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    multiply<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): IntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    multiply(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    multiply<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    divide(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    divide<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    divide(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    divide<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: int): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    modulo(value: int | OptionalValueType<OPTIONAL_TYPE>): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): IntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    modulo(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use modulo method instead */
    mod(value: int | OptionalValueType<OPTIONAL_TYPE>): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use modulo method instead */
    mod<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): IntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use modulo method instead */
    mod(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use modulo method instead */
    mod<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    atan2(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    atan2(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan2<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    atan2(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    atan2(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan2<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: int): IntValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, int, this[typeof valueSourceTypeName], any>>(value: VALUE): IntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): IntValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): IntValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface IDoubleValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, double, 'DoubleValueSource', OPTIONAL_TYPE> {
    [doubleValueSourceType]: 'DoubleValueSource'
}

export interface DoubleValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, double, 'DoubleValueSource', OPTIONAL_TYPE>, IDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    asStringDouble(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    abs(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ceil(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    floor(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    round(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    exp(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ln(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    log10(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sqrt(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cbrt(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sign(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Trigonometric Functions
    acos(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asin(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cos(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cot(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sin(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    tan(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // SqlFunction1
    power(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    power(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    power<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    power(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    power(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    power<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    logn(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    logn<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    logn(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    logn<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    roundn(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    roundn(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    roundn<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    minValue(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    minValue(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    maxValue(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    maxValue(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    add(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    add(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    add(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    substract(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    substract(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    multiply(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    multiply<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    multiply(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    multiply<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    divide(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    divide<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    divide(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    divide<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    mod(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    mod(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    modulo(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use modulo method instead */
    mod(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use modulo method instead */
    mod<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use modulo method instead */
    mod(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use modulo method instead */
    mod<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    atan2(value: int): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    atan2(value: int | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan2<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    atan2(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    atan2(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan2<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: double): DoubleValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, double, this[typeof valueSourceTypeName], any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): DoubleValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): DoubleValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface IBigintValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, bigint, 'BigintValueSource', OPTIONAL_TYPE> {
    [bigintValueSourceType]: 'BigintValueSource'
}

// some methods are commented because there is no bigdouble yet
export interface BigintValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, bigint, 'BigintValueSource', OPTIONAL_TYPE>, IBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    asStringInt(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asStringDouble(): StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    abs(): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ceil(): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    floor(): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    round(): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // exp(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // ln(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // log10(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // sqrt(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // cbrt(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sign(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Trigonometric Functions
    // acos(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // asin(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // atan(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // cos(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // cot(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // sin(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // tan(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // SqlFunction1
    // power(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // power(value: bigint | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // power<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // power(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // power(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // power<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // logn(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // logn(value: bigint | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // logn<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // logn(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // logn(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // logn<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // roundn(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // roundn(value: bigint | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // roundn<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: bigint): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    minValue(value: bigint | OptionalValueType<OPTIONAL_TYPE>): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends IBigintValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // minValue(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // minValue(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // minValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: bigint): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    maxValue(value: bigint | OptionalValueType<OPTIONAL_TYPE>): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends IBigintValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // maxValue(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // maxValue(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // maxValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: bigint): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    add(value: bigint | OptionalValueType<OPTIONAL_TYPE>): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends IBigintValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // add(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // add(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // add<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: bigint): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    substract(value: bigint | OptionalValueType<OPTIONAL_TYPE>): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends IBigintValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // substract(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // substract(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // substract<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // multiply(value: bigint): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // multiply(value: bigint | OptionalValueType<OPTIONAL_TYPE>): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // multiply<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): IntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // multiply(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // multiply(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // multiply<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // divide(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // divide(value: bigint | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // divide<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // divide(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // divide(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // divide<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: bigint): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    modulo(value: bigint | OptionalValueType<OPTIONAL_TYPE>): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends IBigintValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // modulo(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // modulo(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // modulo<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use modulo method instead */
    mod(value: bigint | OptionalValueType<OPTIONAL_TYPE>): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use modulo method instead */
    mod<VALUE extends IBigintValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // /** @deprecated use modulo method instead */
    // mod(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated use modulo method instead */
    // mod<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    // atan2(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // atan2(value: bigint | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // atan2<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // atan2(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // atan2(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // atan2<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: bigint): BigintValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, bigint, this[typeof valueSourceTypeName], any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): BigintValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): BigintValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}


export interface ITypeSafeBigintValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, bigint, 'TypeSafeBigintValueSource', OPTIONAL_TYPE> {
    [typeSafeBigintValueSourceType]: 'TypeSafeBigintValueSource'
}

// some methods are commented because there is no bigdouble yet
export interface TypeSafeBigintValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, bigint, 'TypeSafeBigintValueSource', OPTIONAL_TYPE>, ITypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    asStringInt(): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asStringDouble(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    abs(): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ceil(): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    floor(): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    round(): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // exp(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // ln(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // log10(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // sqrt(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // cbrt(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sign(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Trigonometric Functions
    // acos(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // asin(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // atan(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // cos(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // cot(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // sin(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // tan(): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // SqlFunction1
    // power(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // power(value: bigint | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // power<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // power(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // power(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // power<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // logn(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // logn(value: bigint | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // logn<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // logn(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // logn(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // logn<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // roundn(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // roundn(value: bigint | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // roundn<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: bigint): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    minValue(value: bigint | OptionalValueType<OPTIONAL_TYPE>): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends ITypeSafeBigintValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): TypeSafeBigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // minValue(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // minValue(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // minValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: bigint): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    maxValue(value: bigint | OptionalValueType<OPTIONAL_TYPE>): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends ITypeSafeBigintValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): TypeSafeBigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // maxValue(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // maxValue(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // maxValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: bigint): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    add(value: bigint | OptionalValueType<OPTIONAL_TYPE>): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends ITypeSafeBigintValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): TypeSafeBigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // add(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // add(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // add<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: bigint): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    substract(value: bigint | OptionalValueType<OPTIONAL_TYPE>): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends ITypeSafeBigintValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): TypeSafeBigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // substract(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // substract(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // substract<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // multiply(value: bigint): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // multiply(value: bigint | OptionalValueType<OPTIONAL_TYPE>): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // multiply<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): IntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // multiply(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // multiply(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // multiply<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // divide(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // divide(value: bigint | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // divide<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // divide(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // divide(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // divide<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: bigint): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    modulo(value: bigint | OptionalValueType<OPTIONAL_TYPE>): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends ITypeSafeBigintValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): TypeSafeBigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // modulo(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // modulo(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // modulo<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use modulo method instead */
    mod(value: bigint | OptionalValueType<OPTIONAL_TYPE>): TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use modulo method instead */
    mod<VALUE extends ITypeSafeBigintValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): TypeSafeBigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // /** @deprecated use modulo method instead */
    // mod(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated use modulo method instead */
    // mod<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    // atan2(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // atan2(value: bigint | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // atan2<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // atan2(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    // atan2(value: double | OptionalValueType<OPTIONAL_TYPE>): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // atan2<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: bigint): TypeSafeBigintValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, bigint, this[typeof valueSourceTypeName], any>>(value: VALUE): TypeSafeBigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): TypeSafeBigintValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): TypeSafeBigintValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface IStringIntValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, stringInt, 'StringIntValueSource', OPTIONAL_TYPE> {
    [stringIntValueSourceType]: 'StringIntValueSource'
}

export interface StringIntValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, stringInt, 'StringIntValueSource', OPTIONAL_TYPE>, IStringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    asStringDouble(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asBigint(): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    abs(): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ceil(): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    floor(): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    round(): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    exp(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ln(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    log10(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sqrt(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cbrt(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sign(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Trigonometric Functions
    acos(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asin(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cos(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cot(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sin(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    tan(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // SqlFunction1
    power(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    power(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    power<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    power(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    power(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    power<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    logn(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    logn<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    logn(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    logn<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    roundn(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    roundn(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    roundn<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: stringInt): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    minValue(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringIntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    minValue(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: stringInt): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    maxValue(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringIntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    maxValue(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: stringInt): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    add(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringIntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    add(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    add(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: stringInt): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    substract(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringIntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    substract(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: stringInt): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    multiply(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    multiply<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringIntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    multiply(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    multiply<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    divide(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    divide<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    divide(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    divide<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: stringInt): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    modulo(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringIntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    modulo(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use modulo method instead */
    mod(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use modulo method instead */
    mod<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringIntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use modulo method instead */
    mod(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use modulo method instead */
    mod<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    atan2(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    atan2(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan2<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    atan2(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    atan2(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan2<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: stringInt): StringIntValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, stringInt, this[typeof valueSourceTypeName], any>>(value: VALUE): StringIntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): StringIntValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): StringIntValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface IStringDoubleValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, stringDouble, 'StringDoubleValueSource', OPTIONAL_TYPE> {
    [stringDoubleValueSourceType]: 'StringDoubleValueSource'
}

export interface StringDoubleValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, stringDouble, 'StringDoubleValueSource', OPTIONAL_TYPE>, IStringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    //asInt(): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> // test function
    abs(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ceil(): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    floor(): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    round(): StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    exp(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ln(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    log10(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sqrt(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cbrt(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sign(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Trigonometric Functions
    acos(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    asin(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cos(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    cot(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    sin(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    tan(): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // SqlFunction1
    power(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    power(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    power<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    power(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    power(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    power<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    logn(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    logn<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    logn(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    logn<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    roundn(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    roundn(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    roundn<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    minValue(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    minValue(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    maxValue(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    maxValue(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    add(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    add(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    add(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    substract(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    substract(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    multiply(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    multiply<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    multiply(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    multiply<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    divide(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    divide<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    divide(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    divide<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    modulo(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    modulo(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use modulo method instead */
    mod(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use modulo method instead */
    mod<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use modulo method instead */
    mod(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use modulo method instead */
    mod<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    atan2(value: stringInt): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    atan2(value: stringInt | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan2<VALUE extends IStringIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    atan2(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); this could be an error in your code */
    atan2(value: stringDouble | OptionalValueType<OPTIONAL_TYPE>): StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan2<VALUE extends IStringDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: stringDouble): StringDoubleValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, stringDouble, this[typeof valueSourceTypeName], any>>(value: VALUE): StringDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): StringDoubleValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): StringDoubleValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface IStringValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, string, 'StringValueSource', OPTIONAL_TYPE> {
    [stringValueSourceType]: 'StringValueSource'
}

export interface StringValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, string, 'StringValueSource', OPTIONAL_TYPE>, IStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    // SqlComparator 1
    equalsInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    equalsInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using equalsInsensitiveIfValue instead */
    equalsInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    equalsInsensitive<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEqualsInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEqualsInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notEqualsInsensitiveIfValue instead */
    notEqualsInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEqualsInsensitive<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    likeIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    like(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using likeIfValue instead */
    like(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    like<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notLikeIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notLikeIfValue instead */
    notLike(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notLike(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notLike<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    likeInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    likeInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using likeInsensitiveIfValue instead */
    likeInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    likeInsensitive<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notLikeInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notLikeInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notLikeInsensitiveIfValue instead */
    notLikeInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notLikeInsensitive<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    startsWithIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    startsWith(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using startsWithIfValue instead */
    startsWith(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    startsWith<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notStartsWithIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notStartsWith(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notStartsWithIfValue instead */
    notStartsWith(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notStartsWith<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    endsWithIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    endsWith(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using endsWithIfValue instead */
    endsWith(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    endsWith<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEndsWithIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEndsWith(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notEndsWithIfValue instead */
    notEndsWith(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEndsWith<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    startsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    startsWithInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using startsWithInsensitiveIfValue instead */
    startsWithInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    startsWithInsensitive<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notStartsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notStartsWithInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notStartsWithInsensitiveIfValue instead */
    notStartsWithInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notStartsWithInsensitive<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    endsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    endsWithInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using endsWithInsensitiveIfValue instead */
    endsWithInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    endsWithInsensitive<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEndsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEndsWithInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notEndsWithInsensitiveIfValue instead */
    notEndsWithInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEndsWithInsensitive<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    containsIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    contains(value: string ): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using containsIfValue instead */
    contains(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    contains<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notContainsIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notContains(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notContainsIfValue instead */
    notContains(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notContains<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    containsInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    containsInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using containsInsensitiveIfValue instead */
    containsInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    containsInsensitive<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notContainsInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notContainsInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notContainsInsensitiveIfValue instead */
    notContainsInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notContainsInsensitive<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // SqlFunction0
    toLowerCase(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use toLowerCase method instead */
    lower(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    toUpperCase(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use toUpperCase method instead */
    upper(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    length(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    trim(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    trimLeft(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use trimLeft method instead */
    ltrim(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    trimRight(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use trimRight method instead */
    rtrim(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    reverse(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // SqlFunction1
    concatIfValue(value: string | null | undefined): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    concat(value: string): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); you should be using concatIfValue instead */
    concat(value: string | OptionalValueType<OPTIONAL_TYPE>): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); you should be using concatIfValue instead */
    concat(value: string | null | undefined): StringValueSource<TABLE_OR_VIEW, 'optional'>
    concat<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substrToEnd(start: number): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substrToEnd<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(start: VALUE): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substringToEnd(start: number): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substringToEnd<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(start: VALUE): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // SqlFunction2
    substr(start: number, count: number): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substr<VALUE2 extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(start: number, count: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    substr<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(start: VALUE, count: number): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substr<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>, VALUE2 extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(start: VALUE, count: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    substring(start: number, count: number): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substring<VALUE2 extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(start: number, end: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    substring<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(start: VALUE, end: number): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substring<VALUE extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>, VALUE2 extends INumberValueSource<TableOrViewRef<this[typeof database]>, any>>(start: VALUE, end: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    /** @deprecated use replaceAllIfValue method instead */
    replaceIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use replaceAllIfValue method instead */
    replaceIfValue<VALUE2 extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: string | null | undefined, replaceWith: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    /** @deprecated use replaceAllIfValue method instead */
    replaceIfValue<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: string | null | undefined): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use replaceAll method instead */
    replace(findString: string | OptionalValueType<OPTIONAL_TYPE>, replaceWith: string | OptionalValueType<OPTIONAL_TYPE>): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use replaceAll method instead */
    replace<VALUE2 extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: string | OptionalValueType<OPTIONAL_TYPE>, replaceWith: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    /** @deprecated use replaceAll method instead */
    replace<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: string | OptionalValueType<OPTIONAL_TYPE>): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use replaceAll method instead */
    replace<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>, VALUE2 extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    replaceAllIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    replaceAllIfValue<VALUE2 extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: string | null | undefined, replaceWith: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    replaceAllIfValue<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: string | null | undefined): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    replaceAll(findString: string, replaceWith: string): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); you should be using replaceAllIfValue instead */
    replaceAll(findString: string | OptionalValueType<OPTIONAL_TYPE>, replaceWith: string | OptionalValueType<OPTIONAL_TYPE>): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    replaceAll<VALUE2 extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: string, replaceWith: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); you should be using replaceAllIfValue instead */
    replaceAll<VALUE2 extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: string | OptionalValueType<OPTIONAL_TYPE>, replaceWith: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    replaceAll<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: string): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); you should be using replaceAllIfValue instead */
    replaceAll<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: string | OptionalValueType<OPTIONAL_TYPE>): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    replaceAll<VALUE extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>, VALUE2 extends IStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: string): StringValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, string, this[typeof valueSourceTypeName], any>>(value: VALUE): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): StringValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): StringValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface ITypeSafeStringValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, string, 'TypeSafeStringValueSource', OPTIONAL_TYPE> {
    [typeSafeStringValueSourceType]: 'TypeSafeStringValueSource'
}

export interface TypeSafeStringValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, string, 'TypeSafeStringValueSource', OPTIONAL_TYPE>, ITypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    // SqlComparator 1
    //asString(): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> // test function
    equalsInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    equalsInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using equalsInsensitiveIfValue instead */
    equalsInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    equalsInsensitive<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEqualsInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEqualsInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using noEqualsInsensitiveIfValue instead */
    notEqualsInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEqualsInsensitive<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    likeIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    like(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using likeIfValue instead */
    like(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    like<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notLikeIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notLike(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notLikeIfValue instead */
    notLike(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notLike<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    likeInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    likeInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using likeInsensitiveIfValue instead */
    likeInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    likeInsensitive<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notLikeInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notLikeInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notLikeInsensitiveIfValue instead */
    notLikeInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notLikeInsensitive<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    startsWithIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    startsWith(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using startsWithIfValue instead */
    startsWith(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    startsWith<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notStartsWithIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notStartsWith(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notStartsWithIfValue instead */
    notStartsWith(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notStartsWith<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    endsWithIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    endsWith(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using endsWithIfValue instead */
    endsWith(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    endsWith<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEndsWithIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEndsWith(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notEndsWithIfValue instead */
    notEndsWith(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEndsWith<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    startsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    startsWithInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using startsWithInsensitiveIfValue instead */
    startsWithInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    startsWithInsensitive<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notStartsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notStartsWithInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notStartsWithInsensitiveIfValue instead */
    notStartsWithInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notStartsWithInsensitive<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    endsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    endsWithInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using endsWithInsensitiveIfValue instead */
    endsWithInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    endsWithInsensitive<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEndsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEndsWithInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notEndsWithInsensitiveIfValue instead */
    notEndsWithInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEndsWithInsensitive<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    containsIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    contains(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using containsIfValue instead */
    contains(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    contains<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notContainsIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notContains(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notContainsIfValue instead */
    notContains(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notContains<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    containsInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    containsInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using containsInsensitiveIfValue instead */
    containsInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    containsInsensitive<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notContainsInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notContainsInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected falsy value (when the provided value is null or undefined); you should be using notContainsInsensitiveIfValue instead */
    notContainsInsensitive(value: string | OptionalValueType<OPTIONAL_TYPE>): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notContainsInsensitive<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // SqlFunction0
    toLowerCase(): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use toLowerCase method instead */
    lower(): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    toUpperCase(): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use toUpperCase method instead */
    upper(): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    length(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    trim(): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    trimLeft(): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use trimLeft method instead */
    ltrim(): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    trimRight(): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use trimRight method instead */
    rtrim(): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    reverse(): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // SqlFunction1
    concatIfValue(value: string | null | undefined): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    concat(value: string): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); you should be using concatfValue instead */
    concat(value: string | OptionalValueType<OPTIONAL_TYPE>): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); you should be using concatIfValue instead */
    concat(value: string | null | undefined): TypeSafeStringValueSource<TABLE_OR_VIEW, 'optional'>
    concat<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substrToEnd(start: int): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substrToEnd<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(start: VALUE): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substringToEnd(start: int): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substringToEnd<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(start: VALUE): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // SqlFunction2
    substr(start: int, count: int): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substr<VALUE2 extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(start: int, count: VALUE2): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    substr<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(start: VALUE, count: int): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substr<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>, VALUE2 extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(start: VALUE, count: VALUE2): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    substring(start: int, end: int): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>    
    substring<VALUE2 extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(start: int, end: VALUE2): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    substring<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(start: VALUE, end: int): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substring<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>, VALUE2 extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(start: VALUE, end: VALUE2): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    /** @deprecated use replaceAllIfValue method instead */
    replaceIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use replaceAllIfValue method instead */
    replaceIfValue<VALUE2 extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: string | null | undefined, replaceWith: VALUE2): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    /** @deprecated use replaceAllIfValue method instead */
    replaceIfValue<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: string | null | undefined): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use replaceAll method instead */
    replace(findString: string | OptionalValueType<OPTIONAL_TYPE>, replaceWith: string | OptionalValueType<OPTIONAL_TYPE>): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated use replaceAll method instead */
    replace<VALUE2 extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: string | OptionalValueType<OPTIONAL_TYPE>, replaceWith: VALUE2): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    /** @deprecated use replaceAll method instead */
    replace<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: string | OptionalValueType<OPTIONAL_TYPE>): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated use replaceAll method instead */
    replace<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>, VALUE2 extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: VALUE2): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    replaceAllIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    replaceAllIfValue<VALUE2 extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: string | null | undefined, replaceWith: VALUE2): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    replaceAllIfValue<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: string | null | undefined): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    replaceAll(findString: string, replaceWith: string): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); you should be using replaceAllIfValue instead */
    replaceAll(findString: string | OptionalValueType<OPTIONAL_TYPE>, replaceWith: string | OptionalValueType<OPTIONAL_TYPE>): TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    replaceAll<VALUE2 extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: string, replaceWith: VALUE2): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); you should be using replaceAllIfValue instead */
    replaceAll<VALUE2 extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: string | OptionalValueType<OPTIONAL_TYPE>, replaceWith: VALUE2): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    replaceAll<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: string): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    /** @deprecated you are using a value that can returns an unexpected null value (when the provided value is null or undefined); you should be using replaceAllIfValue instead */
    replaceAll<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: string | OptionalValueType<OPTIONAL_TYPE>): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    replaceAll<VALUE extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>, VALUE2 extends ITypeSafeStringValueSource<TableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: VALUE2): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: string): TypeSafeStringValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, string, this[typeof valueSourceTypeName], any>>(value: VALUE): TypeSafeStringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): TypeSafeStringValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): TypeSafeStringValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface IDateValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, Date, 'DateValueSource', OPTIONAL_TYPE> {
    [dateValueSourceType]: 'DateValueSource'
}

export interface DateValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, Date, 'DateValueSource', OPTIONAL_TYPE>, IDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    /** Gets the year */
    getFullYear(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: Date): DateValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, Date, this[typeof valueSourceTypeName], any>>(value: VALUE): DateValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): DateValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): DateValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface ITimeValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, Date, 'TimeValueSource', OPTIONAL_TYPE> {
    [timeValueSourceType]: 'TimeValueSource'
}

export interface TimeValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, Date, 'TimeValueSource', OPTIONAL_TYPE>, ITimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    /** Gets the hours */
    getHours(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the minutes */
    getMinutes(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the seconds */
    getSeconds(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the milliseconds */
    getMilliseconds(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: Date): TimeValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, Date, this[typeof valueSourceTypeName], any>>(value: VALUE): TimeValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): TimeValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): TimeValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface IDateTimeValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, Date, 'DateTimeValueSource', OPTIONAL_TYPE> {
    [dateTimeValueSourceType]: 'DateTimeValueSource'
}

export interface DateTimeValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, Date, 'DateTimeValueSource', OPTIONAL_TYPE>, IDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    /** Gets the year */
    getFullYear(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the hours */
    getHours(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the minutes */
    getMinutes(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the seconds */
    getSeconds(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the milliseconds */
    getMilliseconds(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the time value in milliseconds */
    getTime(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: Date): DateTimeValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, Date, this[typeof valueSourceTypeName], any>>(value: VALUE): DateTimeValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): DateTimeValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): DateTimeValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface ILocalDateValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, LocalDate, 'LocalDateValueSource', OPTIONAL_TYPE> {
    [localDateValueSourceType]: 'LocalDateValueSource'
}

export interface LocalDateValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, LocalDate, 'LocalDateValueSource', OPTIONAL_TYPE>, ILocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    /** Gets the year */
    getFullYear(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the day-of-the-month */
    getDate(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: LocalDate): LocalDateValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, LocalDate, this[typeof valueSourceTypeName], any>>(value: VALUE): LocalDateValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): LocalDateValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): LocalDateValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface ILocalTimeValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, LocalTime, 'LocalTimeValueSource', OPTIONAL_TYPE> {
    [localTimeValueSourceType]: 'LocalTimeValueSource'
}

export interface LocalTimeValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, LocalTime, 'LocalTimeValueSource', OPTIONAL_TYPE>, ILocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    /** Gets the hours */
    getHours(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the minutes */
    getMinutes(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the seconds */
    getSeconds(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the milliseconds */
    getMilliseconds(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: LocalTime): LocalTimeValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, LocalTime, this[typeof valueSourceTypeName], any>>(value: VALUE): LocalTimeValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): LocalTimeValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): LocalTimeValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export interface ILocalDateTimeValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, LocalDateTime, 'LocalDateTimeValueSource', OPTIONAL_TYPE> {
    [localDateTimeValueSourceType]: 'LocalDateTimeValueSource'
}

export interface LocalDateTimeValueSource<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, LocalDateTime, 'LocalDateTimeValueSource', OPTIONAL_TYPE>, ILocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    /** Gets the year */
    getFullYear(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the day-of-the-month */
    getDate(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the hours */
    getHours(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the minutes */
    getMinutes(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the seconds */
    getSeconds(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the milliseconds */
    getMilliseconds(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the time value in milliseconds. */
    getTime(): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: LocalDateTime): LocalDateTimeValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<TableOrViewRef<this[typeof database]>, LocalDateTime, this[typeof valueSourceTypeName], any>>(value: VALUE): LocalDateTimeValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    asOptional(): LocalDateTimeValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): LocalDateTimeValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
}

export type RemapValueSourceType<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, TYPE> =
    TYPE extends IValueSource<any, infer T, infer TYPE_NAME, infer OPTIONAL_TYPE> ? (
        TYPE extends IBooleanValueSource<any, any> ? BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringIntValueSource<any, any> ? StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IIntValueSource<any, any> ? IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringDoubleValueSource<any, any> ? StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IDoubleValueSource<any, any> ? DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ITypeSafeBigintValueSource<any, any> ? TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IBigintValueSource<any, any> ? BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringNumberValueSource<any, any> ? StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends INumberValueSource<any, any> ? NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ITypeSafeStringValueSource<any, any> ? TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringValueSource<any, any> ? StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateTimeValueSource<any, any> ? LocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IDateTimeValueSource<any, any> ? DateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateValueSource<any, any> ? LocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IDateValueSource<any, any> ? DateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalTimeValueSource<any, any> ? LocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ITimeValueSource<any, any> ? TimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IComparableValueSource<any, any, any, any> ? ComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IEqualableValueSource<any, any,any, any> ? EqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends INullableValueSource<any, any, any, any> ? NullableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        ValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE>
    ): never


export type RemapValueSourceTypeWithOptionalType<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, TYPE, OPTIONAL_TYPE extends OptionalType> =
    TYPE extends IValueSource<any, infer T, infer TYPE_NAME, any> ? (
        TYPE extends IBooleanValueSource<any, any> ? BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringIntValueSource<any, any> ? StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IIntValueSource<any, any> ? IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringDoubleValueSource<any, any> ? StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IDoubleValueSource<any, any> ? DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ITypeSafeBigintValueSource<any, any> ? TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IBigintValueSource<any, any> ? BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringNumberValueSource<any, any> ? StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends INumberValueSource<any, any> ? NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ITypeSafeStringValueSource<any, any> ? TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringValueSource<any, any> ? StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateTimeValueSource<any, any> ? LocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IDateTimeValueSource<any, any> ? DateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateValueSource<any, any> ? LocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IDateValueSource<any, any> ? DateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalTimeValueSource<any, any> ? LocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ITimeValueSource<any, any> ? TimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IComparableValueSource<any, any,any, any> ? ComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IEqualableValueSource<any, any, any, any> ? EqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends INullableValueSource<any, any, any, any> ? NullableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        ValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE>
    ): never

export type RemapIValueSourceType<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, TYPE> =
    TYPE extends IValueSource<any, infer T, infer TYPE_NAME, infer OPTIONAL_TYPE> ? (
        TYPE extends IBooleanValueSource<any, any> ? IBooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringIntValueSource<any, any> ? IStringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IIntValueSource<any, any> ? IIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringDoubleValueSource<any, any> ? IStringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IDoubleValueSource<any, any> ? IDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ITypeSafeBigintValueSource<any, any> ? ITypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IBigintValueSource<any, any> ? IBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringNumberValueSource<any, any> ? IStringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends INumberValueSource<any, any> ? INumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ITypeSafeStringValueSource<any, any> ? ITypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringValueSource<any, any> ? IStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateTimeValueSource<any, any> ? ILocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IDateTimeValueSource<any, any> ? IDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateValueSource<any, any> ? ILocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IDateValueSource<any, any> ? IDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalTimeValueSource<any, any> ? ILocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ITimeValueSource<any, any> ? ITimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IComparableValueSource<any, any, any, any> ? IComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IEqualableValueSource<any, any,any, any> ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends INullableValueSource<any, any, any, any> ? INullableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        IValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE>
    ): never

export type RemapIValueSourceTypeWithOptionalType<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, TYPE, OPTIONAL_TYPE extends OptionalType> =
    TYPE extends IValueSource<any, infer T, infer TYPE_NAME, any> ? (
        TYPE extends IBooleanValueSource<any, any> ? IBooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringIntValueSource<any, any> ? IStringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IIntValueSource<any, any> ? IIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringDoubleValueSource<any, any> ? IStringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IDoubleValueSource<any, any> ? IDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ITypeSafeBigintValueSource<any, any> ? ITypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IBigintValueSource<any, any> ? IBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringNumberValueSource<any, any> ? IStringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends INumberValueSource<any, any> ? INumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ITypeSafeStringValueSource<any, any> ? ITypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringValueSource<any, any> ? IStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateTimeValueSource<any, any> ? ILocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IDateTimeValueSource<any, any> ? IDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateValueSource<any, any> ? ILocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IDateValueSource<any, any> ? IDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalTimeValueSource<any, any> ? ILocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ITimeValueSource<any, any> ? ITimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IComparableValueSource<any, any,any, any> ? IComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IEqualableValueSource<any, any, any, any> ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends INullableValueSource<any, any, any, any> ? INullableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        IValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE>
    ): never



export type ArgumentType = 'boolean' | 'stringInt' | 'int' | 'stringDouble' | 'double' | 'bigint' | 'string' | 'localDateTime' | 'localDate' | 'localTime' | 'customComparable' | 'enum' | 'custom'
export type ArgumentOptionalType = 'required' | 'optional'
export type ArgumentMode = 'value' | 'combined'
export class Argument<T extends ArgumentType, OPTIONAL_TYPE extends ArgumentOptionalType, MODE extends ArgumentMode, TYPE, TYPE_NAME = any> {
    readonly type: T
    readonly typeName: string
    readonly optionalType: OPTIONAL_TYPE
    readonly mode: MODE
    readonly adapter?: TypeAdapter
    [valueType]: TYPE
    [valueSourceTypeName]: TYPE_NAME

    constructor (argumentType: T, typeName: string, optionalType: OPTIONAL_TYPE, mode: MODE, adapter?: TypeAdapter) {
        this.type = argumentType
        this.typeName = typeName
        this.optionalType = optionalType
        this.mode = mode
        this.adapter = adapter
    }
}

export type TypeOfArgument<ARG> = ARG extends Argument<any, infer OPTIONAL_TYPE, any, infer T> ? T | OptionalValueType<OPTIONAL_TYPE> : never

export type MapArgumentToTypeSafe<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, ARG> =
    ARG extends Argument<infer TYPE, infer OPTIONAL_TYPE, any, infer T, infer TYPE_NAME> ? (
        TYPE extends 'boolean' ? BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'stringInt' ? StringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'int' ? IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'stringDouble' ? StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'double' ? DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'bigint' ? TypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'string' ? TypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localDateTime' ? LocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localDate' ? LocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localTime' ? LocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'customComparable'? ComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'enum' ? EqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'custom' ? EqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        never
    ): never

export type MapArgumentToTypeUnsafe<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, ARG> =
    ARG extends Argument<infer TYPE, infer OPTIONAL_TYPE, any, infer T, infer TYPE_NAME> ? (
        TYPE extends 'boolean' ? BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'stringInt' ? StringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'int' ? NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'stringDouble' ? StringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'double' ? NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'bigint' ? BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'string' ? StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localDateTime' ? DateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localDate' ? DateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localTime' ? TimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'customComparable' ? ComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'enum' ? EqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'custom' ? EqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        never
    ): never

export type MapArgumentToITypeSafe<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, ARG> =
    ARG extends Argument<infer TYPE, infer OPTIONAL_TYPE, any, infer T, infer TYPE_NAME> ? (
        TYPE extends 'boolean' ? IBooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'stringInt' ? IStringIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'int' ? IIntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'stringDouble' ? IStringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'double' ? IDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'bigint' ? ITypeSafeBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'string' ? ITypeSafeStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localDateTime' ? ILocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localDate' ? ILocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localTime' ? ILocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'customComparable'? IComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'enum' ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'custom' ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        never
    ): never

export type MapArgumentToITypeUnsafe<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, ARG> =
    ARG extends Argument<infer TYPE, infer OPTIONAL_TYPE, any, infer T, infer TYPE_NAME> ? (
        TYPE extends 'boolean' ? IBooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'stringInt' ? IStringNumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'int' ? INumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'stringDouble' ? IStringDoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'double' ? INumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'bigint' ? IBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'string' ? IStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localDateTime' ? IDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localDate' ? IDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localTime' ? ITimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'customComparable' ? IComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'enum' ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'custom' ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        never
    ): never

export type MapArgumentToITypeSafeAsAnyOptionalType<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, ARG> =
    ARG extends Argument<infer TYPE, any, any, infer T, infer TYPE_NAME> ? (
        TYPE extends 'boolean' ? IBooleanValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'stringInt' ? IStringIntValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'int' ? IIntValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'stringDouble' ? IStringDoubleValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'double' ? IDoubleValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'bigint' ? ITypeSafeBigintValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'string' ? ITypeSafeStringValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'localDateTime' ? ILocalDateTimeValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'localDate' ? ILocalDateValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'localTime' ? ILocalTimeValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'customComparable'? IComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        TYPE extends 'enum' ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        TYPE extends 'custom' ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        never
    ): never

export type MapArgumentToITypeUnsafeAsAnyOptionalType<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, ARG> =
    ARG extends Argument<infer TYPE, any, any, infer T, infer TYPE_NAME> ? (
        TYPE extends 'boolean' ? IBooleanValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'stringInt' ? IStringNumberValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'int' ? INumberValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'stringDouble' ? IStringDoubleValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'double' ? INumberValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'bigint' ? IBigintValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'string' ? IStringValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'localDateTime' ? IDateTimeValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'localDate' ? IDateValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'localTime' ? ITimeValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'customComparable' ? IComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        TYPE extends 'enum' ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        TYPE extends 'custom' ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        never
    ): never

export type SafeArgForFn<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, ARG> =
    ARG extends Argument<any, infer OPTIONAL_TYPE, infer MODE, any> ? (
        MODE extends 'value' ? never : (
            'required' extends OPTIONAL_TYPE
            ? MapArgumentToITypeSafe<TABLE_OR_VIEW, ARG>
            : MapArgumentToITypeSafeAsAnyOptionalType<TABLE_OR_VIEW, ARG>
        )
    ): never

export type UnsafeArgForFn<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, ARG> =
    ARG extends Argument<any, infer OPTIONAL_TYPE, infer MODE, any> ? (
        MODE extends 'value' ? never : (
            'required' extends OPTIONAL_TYPE
            ? MapArgumentToITypeUnsafe<TABLE_OR_VIEW, ARG>
            : MapArgumentToITypeUnsafeAsAnyOptionalType<TABLE_OR_VIEW, ARG>
        )
    ): never

export type RequiredArgumentWhenValueMode<ARG> =
    ARG extends Argument<infer TYPE, any, infer MODE, infer T> ? (
        MODE extends 'value' ? Argument<TYPE, 'required', MODE, T> : ARG
    ): never

export type SafeArgForBuilderIfValue<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, ARG> =
    MapArgumentToTypeSafe<TABLE_OR_VIEW, RequiredArgumentWhenValueMode<ARG>>

export type UnsafeArgForBuilderIfValue<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, ARG> =
    MapArgumentToTypeUnsafe<TABLE_OR_VIEW, RequiredArgumentWhenValueMode<ARG>>


export type RemapValueSourceTypeIfValue<TABLE_OR_VIEW extends TableOrViewRef<AnyDB>, TYPE> =
    TYPE extends IIfValueSource<any, infer T> ? (
        IfValueSource<TABLE_OR_VIEW, T>
    ) : RemapValueSourceType<TABLE_OR_VIEW, TYPE>

export function asAlwaysIfValueSource<VS extends IAnyBooleanValueSource<any, any>>(valueSource: VS): AlwaysIfValueSource<VS[typeof tableOrView], VS[typeof optionalType]> {
    return valueSource as any
}