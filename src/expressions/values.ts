import type { ITableOrView, ITableOrViewOf, ITableOrViewRef, HasAddWiths } from "../utils/ITableOrView"
import type { AnyDB } from "../databases"
import type { TypeAdapter } from "../TypeAdapter"
import type { aggregatedArrayValueSourceType, anyBooleanValueSourceType, bigintValueSourceType, booleanValueSourceType, columnsType, comparableValueSourceType, customDoubleValueSourceType, customIntValueSourceType, customLocalDateTimeValueSourceType, customLocalDateValueSourceType, customLocalTimeValueSourceType, customUuidValueSourceType, database, localDateTimeValueSourceType, localDateValueSourceType, equalableValueSourceType, ifValueSourceType, nullableValueSourceType, numberValueSourceType, optionalType, requiredTableOrView, resultType, stringValueSourceType, tableOrView, tableOrViewRef, localTimeValueSourceType, type, uuidValueSourceType, valueSourceType } from "../utils/symbols"
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
    OPTIONAL_TYPE extends 'optional' ? null | undefined : never

export type ValueSourceValueType<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | OptionalValueType<OPTIONAL_TYPE> : never
export type ValueSourceValueTypeForResult<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' ? never : null) : never
export type ValueSourceValueTypeForObjectResult<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' ? never : undefined) : never
export type ValueSourceValueTypeForNullableObjectResult<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' ? never : null) : never
export type ValueSourceValueTypeForRequiredInOptionalObject<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' | 'requiredInOptionalObject' ? never : undefined) : never
export type ValueSourceValueTypeForRequiredInNullableOptionalObject<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' | 'requiredInOptionalObject' ? never : null) : never
export type ValueSourceValueTypeForOptionalObjectResultSameOuterJoin<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' | 'requiredInOptionalObject' | 'originallyRequired' ? never : undefined) : never
export type ValueSourceValueTypeForOptionalNullableObjectResultSameOuterJoin<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' | 'requiredInOptionalObject' | 'originallyRequired' ? never : null) : never

export interface AnyValueSource {
    [valueSourceType]: 'ValueSource'
}

export interface ValueSourceOfDB<DB extends AnyDB> extends AnyValueSource {
    [database]: DB
}

export interface ValueSourceOf<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>> extends ValueSourceOfDB<TABLE_OR_VIEW[typeof database]> {
    [tableOrView]: TABLE_OR_VIEW
}

export interface IValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends ValueSourceOf<TABLE_OR_VIEW> {
    [valueType]: TYPE
    [optionalType]: OPTIONAL_TYPE
    [valueSourceTypeName]: TYPE_NAME
}

export interface ValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends IValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    isConstValue(): boolean
    getConstValue(): TYPE
    allowWhen(when: boolean, errorMessage: string): this
    allowWhen(when: boolean, error: Error): this
    disallowWhen(when: boolean, errorMessage: string): this
    disallowWhen(when: boolean, error: Error): this
}

export type ValueType = 'boolean'
    | 'int' | 'bigint' | 'customInt'
    | 'double' | 'customDouble'
    | 'string'
    | 'uuid' | 'customUuid'
    | 'localDate' | 'customLocalDate'
    | 'localTime' | 'customLocalTime'
    | 'localDateTime' | 'customLocalDateTime'
    | 'enum' | 'custom' | 'customComparable'
    | 'aggregatedArray'
    | '' // TableOrViewFragment

export type NativeValueType = Exclude<ValueType, 'enum' | 'custom' | 'customComparable' | 'aggregatedArray' | ''>

export interface __ValueSourcePrivate extends HasAddWiths {
    [isValueSourceObject]: true
    __valueType: ValueType
    __valueTypeName: string
    __optionalType: OptionalType
    __typeAdapter?: TypeAdapter
    __isBooleanForCondition?: boolean
    __aggregatedArrayColumns?: __AggregatedArrayColumns | AnyValueSource
    __aggregatedArrayMode?: __AggregatedArrayMode
    __aggreagtedProjectingOptionalValuesAsNullable?: boolean
    __uuidString?: boolean

    isConstValue(): boolean
    getConstValue(): any
}

export function __isBooleanValueSource(valueSourcePrivate: __ValueSourcePrivate): boolean {
    return valueSourcePrivate.__valueType === 'boolean'
}

export function __isBooleanValueType(valueType: ValueType): boolean {
    return valueType === 'boolean'
}

export function __isUuidValueSource(valueSourcePrivate: __ValueSourcePrivate): boolean {
    return valueSourcePrivate.__valueType === 'uuid' || valueSourcePrivate.__valueType === 'customUuid'
}

export function __isUuidValueType(valueType: ValueType): boolean {
    return valueType === 'uuid' || valueType === 'customUuid'
}

export function __isStringValueSource(valueSourcePrivate: __ValueSourcePrivate): boolean {
    return valueSourcePrivate.__valueType === 'string'
}

export function __isLocalDateValueSource(valueSourcePrivate: __ValueSourcePrivate): boolean {
    return valueSourcePrivate.__valueType === 'localDate' || valueSourcePrivate.__valueType === 'customLocalDate'
}

export function __isLocalTimeValueSource(valueSourcePrivate: __ValueSourcePrivate): boolean {
    return valueSourcePrivate.__valueType === 'localTime' || valueSourcePrivate.__valueType === 'customLocalTime'
}

export function __isLocalDateTimeValueSource(valueSourcePrivate: __ValueSourcePrivate): boolean {
    return valueSourcePrivate.__valueType === 'localDateTime' || valueSourcePrivate.__valueType === 'customLocalDateTime'
}

export type __AggregatedArrayColumns = {
    [P: string]: AnyValueSource | __AggregatedArrayColumns
}

export type __AggregatedArrayMode = 'ResultObject' | 'InnerResultObject'

export function isValueSource(value: any): value is AnyValueSource {
    if (value === undefined || value === null) {
        return false
    }
    if (typeof value === 'object') {
        return !!value[isValueSourceObject]
    }
    return false
}

export function __getValueSourceOfObject(obj: ITableOrView<any>, prop: string): ValueSource<ITableOrViewRef<AnyDB>, unknown, unknown, any> | undefined {
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

export interface INullableValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends IValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [nullableValueSourceType]: 'NullableValueSource'
}

export interface NullableValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends ValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>, INullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    isNull(): BooleanValueSource<TABLE_OR_VIEW, 'required'>
    isNotNull(): BooleanValueSource<TABLE_OR_VIEW, 'required'>
    // The next methods must be reimplemented in the subinterface with the proper return type
    valueWhenNull(value: TYPE): NullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, this[typeof valueSourceTypeName], any>>(value: VALUE): NullableValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): NullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, this[typeof valueSourceTypeName], any>>(value: VALUE): NullableValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, 'optional'>
    asOptional(): NullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): NullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): NullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): NullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
}

export interface IExecutableSelectQuery<DB extends AnyDB, RESULT, COLUMNS, REQUIRED_TABLE_OR_VIEW extends ITableOrViewOf<DB, any>> {
    [type]: 'ExecutableSelectQuery'
    [database]: DB
    [requiredTableOrView]: REQUIRED_TABLE_OR_VIEW
    [resultType]: RESULT
    [columnsType]: COLUMNS
}

export interface IExecutableInsertQuery<TABLE extends ITableOrView<any>, RESULT> {
    [type]: 'ExecutableInsertQuery'
    [database]: TABLE[typeof database]
    [tableOrView]: TABLE
    [resultType]: RESULT
}

export interface IExecutableUpdateQuery<TABLE extends ITableOrView<any>, RESULT> {
    [type]: 'ExecutableUpdateQuery'
    [database]: TABLE[typeof database]
    [tableOrView]: TABLE
    [resultType]: RESULT
}

export interface IExecutableDeleteQuery<TABLE extends ITableOrView<any>, RESULT> {
    [type]: 'ExecutableDeleteQuery'
    [database]: TABLE[typeof database]
    [tableOrView]: TABLE
    [resultType]: RESULT
}

export interface IEqualableValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends INullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [equalableValueSourceType]: 'EqualableValueSource'
}

export interface EqualableValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends NullableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>, IEqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    equalsIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    equals(value: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    equals<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEqualsIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEquals(value: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEquals<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    isIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    is(value: TYPE | null | undefined): BooleanValueSource<TABLE_OR_VIEW, 'required'>
    is<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], 'required'>
    isNotIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, 'required'>
    isNot(value: TYPE | null | undefined): BooleanValueSource<TABLE_OR_VIEW, 'required'>
    isNot<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], 'required'>

    inIfValue(values: TYPE[] | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    in(values: TYPE[]): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    in<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    in<TABLE_OR_VIEW2 extends ITableOrView<any>>(select: IExecutableSelectQuery<TABLE_OR_VIEW[typeof database], TYPE | null | undefined, IEqualableValueSource<any, TYPE, TYPE_NAME, any>, TABLE_OR_VIEW2>): BooleanValueSource<TABLE_OR_VIEW | TABLE_OR_VIEW2[typeof tableOrViewRef], OPTIONAL_TYPE>
    notInIfValue(values: TYPE[] | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notIn(values: TYPE[]): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notIn<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notIn<TABLE_OR_VIEW2 extends ITableOrView<any>>(select: IExecutableSelectQuery<TABLE_OR_VIEW[typeof database], TYPE | null | undefined, IEqualableValueSource<any, TYPE, TYPE_NAME, any>, TABLE_OR_VIEW2>): BooleanValueSource<TABLE_OR_VIEW | TABLE_OR_VIEW2[typeof tableOrViewRef], OPTIONAL_TYPE>
    inN(...value: TYPE[]): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    inN<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(...value: Array<TYPE | VALUE>): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notInN(...value: TYPE[]): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notInN<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(...value: Array<TYPE | VALUE>): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>

    // Redefined methods
    valueWhenNull(value: TYPE): EqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, this[typeof valueSourceTypeName], any>>(value: VALUE): EqualableValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): EqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, this[typeof valueSourceTypeName], any>>(value: VALUE): EqualableValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, 'optional'>
    asOptional(): EqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): EqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): EqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): EqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
}

export interface IComparableValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends IEqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [comparableValueSourceType]: 'ComparableValueSource'
}

export interface ComparableValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends EqualableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>, IComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    lessThanIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    lessThan(value: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    lessThan<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    greaterThanIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    greaterThan(value: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    greaterThan<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    lessOrEqualsIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    lessOrEquals(value: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    lessOrEquals<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    greaterOrEqualsIfValue(value: TYPE | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    greaterOrEquals(value: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    greaterOrEquals<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    between(value: TYPE, value2: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    between<VALUE2 extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: TYPE, value2: VALUE2): BooleanValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    between<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE, value2: TYPE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    between<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>, VALUE2 extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE, value2: VALUE2): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    notBetween(value: TYPE, value2: TYPE): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notBetween<VALUE2 extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: TYPE, value2: VALUE2): BooleanValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    notBetween<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE, value2: TYPE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notBetween<VALUE extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>, VALUE2 extends IEqualableValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE, value2: VALUE2): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: TYPE): ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, this[typeof valueSourceTypeName], any>>(value: VALUE): ComparableValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, this[typeof valueSourceTypeName], any>>(value: VALUE): ComparableValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, 'optional'>
    asOptional(): ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
}

export interface IBooleanValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IEqualableValueSource<TABLE_OR_VIEW, boolean, 'BooleanValueSource', OPTIONAL_TYPE> {
    [booleanValueSourceType]: 'BooleanValueSource'
    [anyBooleanValueSourceType]: 'AnyBooleanValueSource'
}

export interface BooleanValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends EqualableValueSource<TABLE_OR_VIEW, boolean, 'BooleanValueSource', OPTIONAL_TYPE>, IBooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    negate(): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    and(value: boolean): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    and<VALUE extends IIfValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    and<VALUE extends IBooleanValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or(value: boolean): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    or<VALUE extends IIfValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or<VALUE extends IBooleanValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    onlyWhen(condition: boolean): IIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ignoreWhen(condition: boolean): IIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: boolean): BooleanValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, boolean, this[typeof valueSourceTypeName], any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    nullIfValue(value: boolean): BooleanValueSource<TABLE_OR_VIEW, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, boolean, this[typeof valueSourceTypeName], any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], 'optional'>
    asOptional(): BooleanValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): BooleanValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): BooleanValueSource<TABLE_OR_VIEW, 'optional'>
    ignoreWhenAsNull(when: boolean): BooleanValueSource<TABLE_OR_VIEW, 'optional'>
}

export interface IIfValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> {
    [database]: TABLE_OR_VIEW[typeof database]
    [tableOrView]: TABLE_OR_VIEW
    [valueType]: boolean
    [optionalType]: OPTIONAL_TYPE
    [ifValueSourceType]: 'IfValueSource'
    [anyBooleanValueSourceType]: 'AnyBooleanValueSource'
}

export interface IfValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    negate(): IIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    and(value: boolean): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    and<VALUE extends IIfValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): IfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    and<VALUE extends IBooleanValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or(value: boolean): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    or<VALUE extends IIfValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): IfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or<VALUE extends IBooleanValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    onlyWhen(condition: boolean): IIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ignoreWhen(condition: boolean): IIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    trueWhenNoValue(): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    falseWhenNoValue(): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    valueWhenNoValue(value: boolean): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    valueWhenNoValue<VALUE extends IIfValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): IIfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    valueWhenNoValue<VALUE extends IBooleanValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
}

export interface IAnyBooleanValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> {
    [database]: TABLE_OR_VIEW[typeof database]
    [tableOrView]: TABLE_OR_VIEW
    [valueType]: boolean
    [optionalType]: OPTIONAL_TYPE
    [anyBooleanValueSourceType]: 'AnyBooleanValueSource'
}

export interface AlwaysIfValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    negate(): AlwaysIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    and(value: boolean): AlwaysIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    and<VALUE extends IIfValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): AlwaysIfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    and<VALUE extends IBooleanValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): AlwaysIfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or(value: boolean): AlwaysIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    or<VALUE extends IIfValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): AlwaysIfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or<VALUE extends IBooleanValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): AlwaysIfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    onlyWhen(condition: boolean): AlwaysIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    ignoreWhen(condition: boolean): AlwaysIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    trueWhenNoValue(): AlwaysIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    falseWhenNoValue(): AlwaysIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    valueWhenNoValue(value: boolean): AlwaysIfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    valueWhenNoValue<VALUE extends IIfValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): AlwaysIfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    valueWhenNoValue<VALUE extends IBooleanValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): AlwaysIfValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
}

export interface INumberValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, number, 'NumberValueSource', OPTIONAL_TYPE> {
    [numberValueSourceType]: 'NumberValueSource'
}

export interface NumberValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, number, 'NumberValueSource', OPTIONAL_TYPE>, INumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    asInt(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> // Maybe unsafe cast, we round it when it is necesary
    asDouble(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
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
    power<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    logn<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    roundn(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    roundn<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    multiply<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    divide<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    atan2(value: number): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    atan2<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: number): NumberValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, number, this[typeof valueSourceTypeName], any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    nullIfValue(value: number): NumberValueSource<TABLE_OR_VIEW, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, number, this[typeof valueSourceTypeName], any>>(value: VALUE): NumberValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], 'optional'>
    asOptional(): NumberValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): NumberValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): NumberValueSource<TABLE_OR_VIEW, 'optional'>
    ignoreWhenAsNull(when: boolean): NumberValueSource<TABLE_OR_VIEW, 'optional'>
}

export interface IBigintValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, bigint, 'BigintValueSource', OPTIONAL_TYPE> {
    [bigintValueSourceType]: 'BigintValueSource'
}

// some methods are commented because there is no bigdouble yet
export interface BigintValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, bigint, 'BigintValueSource', OPTIONAL_TYPE>, IBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
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
    // power<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // power(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // power<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // logn(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // logn<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // logn(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // logn<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // roundn(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // roundn<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: bigint): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    minValue<VALUE extends IBigintValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // minValue(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // minValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: bigint): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    maxValue<VALUE extends IBigintValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // maxValue(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // maxValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: bigint): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    add<VALUE extends IBigintValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // add(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // add<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: bigint): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substract<VALUE extends IBigintValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // substract(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // substract<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // multiply(value: bigint): IntValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // multiply<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): IntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // multiply(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // multiply<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // divide(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // divide<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // divide(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // divide<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: bigint): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    modulo<VALUE extends IBigintValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // modulo(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // modulo<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    // atan2(value: bigint): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // atan2<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // atan2(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // atan2<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: bigint): BigintValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, bigint, this[typeof valueSourceTypeName], any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    nullIfValue(value: bigint): BigintValueSource<TABLE_OR_VIEW, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, bigint, this[typeof valueSourceTypeName], any>>(value: VALUE): BigintValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], 'optional'>
    asOptional(): BigintValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): BigintValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): BigintValueSource<TABLE_OR_VIEW, 'optional'>
    ignoreWhenAsNull(when: boolean): BigintValueSource<TABLE_OR_VIEW, 'optional'>
}

export interface ICustomIntValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [customIntValueSourceType]: 'CustomIntValueSource'
}

// some methods are commented because there is no double equivalent
export interface CustomIntValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW,TYPE, TYPE_NAME, OPTIONAL_TYPE>, ICustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    abs(): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    ceil(): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    floor(): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    round(): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
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
    // power(value: TYPE): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // power<VALUE extends CustomIntValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // power(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // power<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // logn(value: TYPE): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // logn<VALUE extends CustomIntValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // logn(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // logn<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // roundn(value: TYPE): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // roundn<VALUE extends CustomIntValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: TYPE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    minValue<VALUE extends CustomIntValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // minValue(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // minValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: TYPE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    maxValue<VALUE extends CustomIntValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // maxValue(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // maxValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: TYPE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    add<VALUE extends CustomIntValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // add(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // add<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: TYPE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    substract<VALUE extends CustomIntValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // substract(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // substract<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: TYPE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    multiply<VALUE extends CustomIntValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // multiply(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // multiply<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // divide(value: TYPE): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // divide<VALUE extends CustomIntValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // divide(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // divide<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: TYPE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    modulo<VALUE extends CustomIntValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // modulo(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // modulo<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    // atan2(value: TYPE): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // atan2<VALUE extends CustomIntValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // atan2(value: double): DoubleValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // atan2<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: TYPE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    asOptional(): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): CustomIntValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
}

export interface ICustomDoubleValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [customDoubleValueSourceType]: 'CustomDoubleValueSource'
}

export interface CustomDoubleValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>, ICustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    // asInt(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> // Maybe unsafe cast, we round it when it is necesary
    // asDouble(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // asBigint(): BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> // Maybe unsafe cast, we round it when it is necesary
    abs(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    ceil(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    floor(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    round(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    exp(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    ln(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    log10(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sqrt(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    cbrt(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sign(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Trigonometric Functions
    acos(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    asin(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    atan(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    cos(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    cot(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sin(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    tan(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    // SqlFunction1
    power(value: TYPE): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    power<VALUE extends CustomDoubleValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: TYPE): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    logn<VALUE extends CustomDoubleValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    roundn(value: TYPE): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    roundn(value: number): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    roundn<VALUE extends CustomDoubleValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    roundn<VALUE extends NumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: TYPE): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    minValue<VALUE extends CustomDoubleValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: TYPE): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    maxValue<VALUE extends CustomDoubleValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: TYPE): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    add<VALUE extends CustomDoubleValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: TYPE): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    substract<VALUE extends CustomDoubleValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: TYPE): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    multiply<VALUE extends CustomDoubleValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: TYPE): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    divide<VALUE extends CustomDoubleValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: TYPE): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    modulo<VALUE extends CustomDoubleValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    atan2(value: TYPE): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    atan2<VALUE extends CustomDoubleValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: TYPE): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, 'optional'>
    asOptional(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): CustomDoubleValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
}

export interface IStringValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, string, 'StringValueSource', OPTIONAL_TYPE> {
    [stringValueSourceType]: 'StringValueSource'
}

export interface StringValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, string, 'StringValueSource', OPTIONAL_TYPE>, IStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    // SqlComparator 1
    equalsInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    equalsInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    equalsInsensitive<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEqualsInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEqualsInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEqualsInsensitive<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    likeIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    like(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    like<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notLikeIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notLike(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notLike<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    likeInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    likeInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    likeInsensitive<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notLikeInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notLikeInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notLikeInsensitive<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    startsWithIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    startsWith(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    startsWith<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notStartsWithIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notStartsWith(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notStartsWith<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    endsWithIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    endsWith(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    endsWith<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEndsWithIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEndsWith(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEndsWith<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    startsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    startsWithInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    startsWithInsensitive<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notStartsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notStartsWithInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notStartsWithInsensitive<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    endsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    endsWithInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    endsWithInsensitive<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEndsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEndsWithInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notEndsWithInsensitive<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    containsIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    contains(value: string ): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    contains<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notContainsIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notContains(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notContains<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    containsInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    containsInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    containsInsensitive<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notContainsInsensitiveIfValue(value: string | null | undefined): IfValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notContainsInsensitive(value: string): BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    notContainsInsensitive<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): BooleanValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // SqlFunction0
    toLowerCase(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    toUpperCase(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    length(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    trim(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    trimLeft(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    trimRight(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    reverse(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // SqlFunction1
    concatIfValue(value: string | null | undefined): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    concat(value: string): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    concat<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(value: VALUE): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substrToEnd(start: number): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substrToEnd<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(start: VALUE): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substringToEnd(start: number): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substringToEnd<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(start: VALUE): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // SqlFunction2
    substr(start: number, count: number): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substr<VALUE2 extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(start: number, count: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    substr<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(start: VALUE, count: number): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substr<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>, VALUE2 extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(start: VALUE, count: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    substring(start: number, count: number): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    substring<VALUE2 extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(start: number, end: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    substring<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(start: VALUE, end: number): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substring<VALUE extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>, VALUE2 extends INumberValueSource<ITableOrViewRef<this[typeof database]>, any>>(start: VALUE, end: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    replaceAllIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    replaceAllIfValue<VALUE2 extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(findString: string | null | undefined, replaceWith: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    replaceAllIfValue<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: string | null | undefined): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    replaceAll(findString: string, replaceWith: string): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    replaceAll<VALUE2 extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(findString: string, replaceWith: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE2[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    replaceAll<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: string): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    replaceAll<VALUE extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>, VALUE2 extends IStringValueSource<ITableOrViewRef<this[typeof database]>, any>>(findString: VALUE, replaceWith: VALUE2): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView] | VALUE2[typeof tableOrView], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: string): StringValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, string, this[typeof valueSourceTypeName], any>>(value: VALUE): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    nullIfValue(value: string): StringValueSource<TABLE_OR_VIEW, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, string, this[typeof valueSourceTypeName], any>>(value: VALUE): StringValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], 'optional'>
    asOptional(): StringValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): StringValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): StringValueSource<TABLE_OR_VIEW, 'optional'>
    ignoreWhenAsNull(when: boolean): StringValueSource<TABLE_OR_VIEW, 'optional'>
}

export interface IUuidValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, string, 'UuidValueSource', OPTIONAL_TYPE> {
    [uuidValueSourceType]: 'UuidValueSource'
}

export interface UuidValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, string, 'UuidValueSource', OPTIONAL_TYPE>, IUuidValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    asString(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: string): UuidValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, string, this[typeof valueSourceTypeName], any>>(value: VALUE): UuidValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    nullIfValue(value: string): UuidValueSource<TABLE_OR_VIEW, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, string, this[typeof valueSourceTypeName], any>>(value: VALUE): UuidValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], 'optional'>
    asOptional(): UuidValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): UuidValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): UuidValueSource<TABLE_OR_VIEW, 'optional'>
    ignoreWhenAsNull(when: boolean): UuidValueSource<TABLE_OR_VIEW, 'optional'>
}

export interface ICustomUuidValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [customUuidValueSourceType]: 'CustomUuidValueSource'
}

export interface CustomUuidValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>, ICustomUuidValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    asString(): StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: TYPE): CustomUuidValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomUuidValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): CustomUuidValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomUuidValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, 'optional'>
    asOptional(): CustomUuidValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): CustomUuidValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): CustomUuidValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): CustomUuidValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
}

export interface ILocalDateValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, Date, 'DateValueSource', OPTIONAL_TYPE> {
    [localDateValueSourceType]: 'LocalDateValueSource'
}

export interface LocalDateValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, Date, 'DateValueSource', OPTIONAL_TYPE>, ILocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    /** Gets the year */
    getFullYear(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: Date): LocalDateValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, Date, this[typeof valueSourceTypeName], any>>(value: VALUE): LocalDateValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    nullIfValue(value: Date): LocalDateValueSource<TABLE_OR_VIEW, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, Date, this[typeof valueSourceTypeName], any>>(value: VALUE): LocalDateValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], 'optional'>
    asOptional(): LocalDateValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): LocalDateValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): LocalDateValueSource<TABLE_OR_VIEW, 'optional'>
    ignoreWhenAsNull(when: boolean): LocalDateValueSource<TABLE_OR_VIEW, 'optional'>
}

export interface ILocalTimeValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, Date, 'TimeValueSource', OPTIONAL_TYPE> {
    [localTimeValueSourceType]: 'LocalTimeValueSource'
}

export interface LocalTimeValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, Date, 'TimeValueSource', OPTIONAL_TYPE>, ILocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
    /** Gets the hours */
    getHours(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the minutes */
    getMinutes(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the seconds */
    getSeconds(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the milliseconds */
    getMilliseconds(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: Date): LocalTimeValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, Date, this[typeof valueSourceTypeName], any>>(value: VALUE): LocalTimeValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    nullIfValue(value: Date): LocalTimeValueSource<TABLE_OR_VIEW, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, Date, this[typeof valueSourceTypeName], any>>(value: VALUE): LocalTimeValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], 'optional'>
    asOptional(): LocalTimeValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): LocalTimeValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): LocalTimeValueSource<TABLE_OR_VIEW, 'optional'>
    ignoreWhenAsNull(when: boolean): LocalTimeValueSource<TABLE_OR_VIEW, 'optional'>
}

export interface ILocalDateTimeValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, Date, 'DateTimeValueSource', OPTIONAL_TYPE> {
    [localDateTimeValueSourceType]: 'LocalDateTimeValueSource'
}

export interface LocalDateTimeValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, Date, 'DateTimeValueSource', OPTIONAL_TYPE>, ILocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> {
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
    valueWhenNull(value: Date): LocalDateTimeValueSource<TABLE_OR_VIEW, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, Date, this[typeof valueSourceTypeName], any>>(value: VALUE): LocalDateTimeValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], VALUE[typeof optionalType]>
    nullIfValue(value: Date): LocalDateTimeValueSource<TABLE_OR_VIEW, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, Date, this[typeof valueSourceTypeName], any>>(value: VALUE): LocalDateTimeValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], 'optional'>
    asOptional(): LocalDateTimeValueSource<TABLE_OR_VIEW, 'optional'>
    asRequiredInOptionalObject(): LocalDateTimeValueSource<TABLE_OR_VIEW, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): LocalDateTimeValueSource<TABLE_OR_VIEW, 'optional'>
    ignoreWhenAsNull(when: boolean): LocalDateTimeValueSource<TABLE_OR_VIEW, 'optional'>
}

export interface ICustomLocalDateValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [customLocalDateValueSourceType]: 'CustomLocalDateValueSource'
}

export interface CustomLocalDateValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>, ICustomLocalDateValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    /** Gets the year */
    getFullYear(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    valueWhenNull(value: TYPE): CustomLocalDateValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomLocalDateValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): CustomLocalDateValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomLocalDateValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, 'optional'>
    asOptional(): CustomLocalDateValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): CustomLocalDateValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): CustomLocalDateValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): CustomLocalDateValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
}

export interface ICustomLocalTimeValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [customLocalTimeValueSourceType]: 'CustomLocalTimeValueSource'
}

export interface CustomLocalTimeValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>, ICustomLocalTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    /** Gets the hours */
    getHours(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the minutes */
    getMinutes(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the seconds */
    getSeconds(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    /** Gets the milliseconds */
    getMilliseconds(): NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: TYPE): CustomLocalTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomLocalTimeValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): CustomLocalTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomLocalTimeValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, 'optional'>
    asOptional(): CustomLocalTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): CustomLocalTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): CustomLocalTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): CustomLocalTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
}

export interface ICustomLocalDateTimeValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [customLocalDateTimeValueSourceType]: 'CustomLocalDateTimeValueSource'
}

export interface CustomLocalDateTimeValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, TYPE_NAME, OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE>, ICustomLocalDateTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
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
    valueWhenNull(value: TYPE): CustomLocalDateTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomLocalDateTimeValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): CustomLocalDateTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<ITableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): CustomLocalDateTimeValueSource<TABLE_OR_VIEW | VALUE[typeof tableOrView], TYPE, TYPE_NAME, 'optional'>
    asOptional(): CustomLocalDateTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): CustomLocalDateTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): CustomLocalDateTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): CustomLocalDateTimeValueSource<TABLE_OR_VIEW, TYPE, TYPE_NAME, 'optional'>
}

export interface IAggregatedArrayValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, OPTIONAL_TYPE extends OptionalType> extends IValueSource<TABLE_OR_VIEW, TYPE, 'AggregatedArray', OPTIONAL_TYPE> {
    [aggregatedArrayValueSourceType]: 'AggregatedArrayValueSource'
}

export interface AggregatedArrayValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, OPTIONAL_TYPE extends OptionalType> extends ValueSource<TABLE_OR_VIEW, TYPE, 'AggregatedArray', OPTIONAL_TYPE>, IAggregatedArrayValueSource<TABLE_OR_VIEW, TYPE, OPTIONAL_TYPE> {
    useEmptyArrayForNoValue(): AggregatedArrayValueSource<TABLE_OR_VIEW, TYPE, 'required'>
    asOptionalNonEmptyArray(): AggregatedArrayValueSource<TABLE_OR_VIEW, TYPE, 'optional'>
    asRequiredInOptionalObject(): AggregatedArrayValueSource<TABLE_OR_VIEW, TYPE, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): AggregatedArrayValueSource<TABLE_OR_VIEW, TYPE, 'optional'>
    ignoreWhenAsNull(when: boolean): AggregatedArrayValueSource<TABLE_OR_VIEW, TYPE, 'optional'>
}

export interface AggregatedArrayValueSourceProjectableAsNullable<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, STRICT_TYPE, OPTIONAL_TYPE extends OptionalType> extends AggregatedArrayValueSource<TABLE_OR_VIEW, TYPE, OPTIONAL_TYPE> {
    projectingOptionalValuesAsNullable(): AggregatedArrayValueSource<TABLE_OR_VIEW, STRICT_TYPE, OPTIONAL_TYPE>
}

export type RemapValueSourceType<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE> =
    TYPE extends IValueSource<any, infer T, infer TYPE_NAME, infer OPTIONAL_TYPE> ? (
        TYPE extends IBooleanValueSource<any, any> ? BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IBigintValueSource<any, any> ? BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends INumberValueSource<any, any> ? NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringValueSource<any, any> ? StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IUuidValueSource<any, any> ? UuidValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateTimeValueSource<any, any> ? LocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateValueSource<any, any> ? LocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalTimeValueSource<any, any> ? LocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ICustomIntValueSource<any, any, any, any> ? CustomIntValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomDoubleValueSource<any, any, any, any> ? CustomDoubleValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomUuidValueSource<any, any, any, any> ? CustomUuidValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateTimeValueSource<any, any, any, any> ? CustomLocalDateTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateValueSource<any, any, any, any> ? CustomLocalDateValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalTimeValueSource<any, any, any, any> ? CustomLocalTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IComparableValueSource<any, any, any, any> ? ComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IEqualableValueSource<any, any,any, any> ? EqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends INullableValueSource<any, any, any, any> ? NullableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IAggregatedArrayValueSource<any, any, any> ? AggregatedArrayValueSource<TABLE_OR_VIEW, T, OPTIONAL_TYPE> :
        ValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE>
    ): never


export type RemapValueSourceTypeWithOptionalType<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, OPTIONAL_TYPE extends OptionalType> =
    TYPE extends IValueSource<any, infer T, infer TYPE_NAME, any> ? (
        TYPE extends IBooleanValueSource<any, any> ? BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IBigintValueSource<any, any> ? BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends INumberValueSource<any, any> ? NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringValueSource<any, any> ? StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IUuidValueSource<any, any> ? UuidValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateTimeValueSource<any, any> ? LocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateValueSource<any, any> ? LocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalTimeValueSource<any, any> ? LocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ICustomIntValueSource<any, any, any, any> ? CustomIntValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomDoubleValueSource<any, any, any, any> ? CustomDoubleValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomUuidValueSource<any, any, any, any> ? CustomUuidValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateTimeValueSource<any, any, any, any> ? CustomLocalDateTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateValueSource<any, any, any, any> ? CustomLocalDateValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalTimeValueSource<any, any, any, any> ? CustomLocalTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IComparableValueSource<any, any,any, any> ? ComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IEqualableValueSource<any, any, any, any> ? EqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends INullableValueSource<any, any, any, any> ? NullableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IAggregatedArrayValueSource<any, any, any> ? AggregatedArrayValueSource<TABLE_OR_VIEW, T, OPTIONAL_TYPE> :
        ValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE>
    ): never

export type RemapIValueSourceType<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE> =
    TYPE extends IValueSource<any, infer T, infer TYPE_NAME, infer OPTIONAL_TYPE> ? (
        TYPE extends IBooleanValueSource<any, any> ? IBooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IBigintValueSource<any, any> ? IBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends INumberValueSource<any, any> ? INumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringValueSource<any, any> ? IStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IUuidValueSource<any, any> ? IUuidValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateTimeValueSource<any, any> ? ILocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateValueSource<any, any> ? ILocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalTimeValueSource<any, any> ? ILocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ICustomIntValueSource<any, any, any, any> ? ICustomIntValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomDoubleValueSource<any, any, any, any> ? ICustomDoubleValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomUuidValueSource<any, any, any, any> ? ICustomUuidValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateTimeValueSource<any, any, any, any> ? ICustomLocalDateTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateValueSource<any, any, any, any> ? ICustomLocalDateValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalTimeValueSource<any, any, any, any> ? ICustomLocalTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IComparableValueSource<any, any, any, any> ? IComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IEqualableValueSource<any, any,any, any> ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends INullableValueSource<any, any, any, any> ? INullableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IAggregatedArrayValueSource<any, any, any> ? IAggregatedArrayValueSource<TABLE_OR_VIEW, T, OPTIONAL_TYPE> :
        IValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE>
    ): never

export type RemapIValueSourceTypeWithOptionalType<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE, OPTIONAL_TYPE extends OptionalType> =
    TYPE extends IValueSource<any, infer T, infer TYPE_NAME, any> ? (
        TYPE extends IBooleanValueSource<any, any> ? IBooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IBigintValueSource<any, any> ? IBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends INumberValueSource<any, any> ? INumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IStringValueSource<any, any> ? IStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends IUuidValueSource<any, any> ? IUuidValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateTimeValueSource<any, any> ? ILocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalDateValueSource<any, any> ? ILocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ILocalTimeValueSource<any, any> ? ILocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends ICustomIntValueSource<any, any, any, any> ? ICustomIntValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomDoubleValueSource<any, any, any, any> ? ICustomDoubleValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomUuidValueSource<any, any, any, any> ? ICustomUuidValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateTimeValueSource<any, any, any, any> ? ICustomLocalDateTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateValueSource<any, any, any, any> ? ICustomLocalDateValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalTimeValueSource<any, any, any, any> ? ICustomLocalTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IComparableValueSource<any, any,any, any> ? IComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IEqualableValueSource<any, any, any, any> ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends INullableValueSource<any, any, any, any> ? INullableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IAggregatedArrayValueSource<any, any, any> ? IAggregatedArrayValueSource<TABLE_OR_VIEW, T, OPTIONAL_TYPE> :
        IValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE>
    ): never



export type ArgumentType = 'boolean' | 'int' | 'double' | 'bigint' | 'string' | 'uuid' | 'localDateTime' | 'localDate' | 'localTime' | 'customInt' | 'customDouble' | 'customUuid' | 'customLocalDateTime' | 'customLocalDate' | 'customLocalTime' | 'customComparable' | 'enum' | 'custom'
export type ArgumentOptionalType = 'required' | 'optional'
export type ArgumentMode = 'value' | 'combined'
export class Argument<T extends ArgumentType, OPTIONAL_TYPE extends ArgumentOptionalType, MODE extends ArgumentMode, TYPE, TYPE_NAME = any> {
    readonly type: T
    readonly typeName: string
    readonly optionalType: OPTIONAL_TYPE
    readonly mode: MODE
    readonly adapter?: TypeAdapter
    [valueType]!: TYPE
    [valueSourceTypeName]!: TYPE_NAME

    constructor (type: T, typeName: string, optionalType: OPTIONAL_TYPE, mode: MODE, adapter?: TypeAdapter) {
        this.type = type
        this.typeName = typeName
        this.optionalType = optionalType
        this.mode = mode
        this.adapter = adapter
    }
}

export type TypeOfArgument<ARG> = ARG extends Argument<any, infer OPTIONAL_TYPE, any, infer T> ? T | OptionalValueType<OPTIONAL_TYPE> : never

export type MapArgumentToValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, ARG> =
    ARG extends Argument<infer TYPE, infer OPTIONAL_TYPE, any, infer T, infer TYPE_NAME> ? (
        TYPE extends 'boolean' ? BooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'int' ? NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'double' ? NumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'bigint' ? BigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'string' ? StringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'uuid' ? UuidValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localDateTime' ? LocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localDate' ? LocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localTime' ? LocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'customInt' ? CustomIntValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customDouble' ? CustomDoubleValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customUuid' ? CustomUuidValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customLocalDateTime' ? CustomLocalDateTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customLocalDate' ? CustomLocalDateValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customLocalTime' ? CustomLocalTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customComparable' ? ComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'enum' ? EqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'custom' ? EqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        never
    ): never

export type MapArgumentToIValueSource<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, ARG> =
    ARG extends Argument<infer TYPE, infer OPTIONAL_TYPE, any, infer T, infer TYPE_NAME> ? (
        TYPE extends 'boolean' ? IBooleanValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'int' ? INumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'double' ? INumberValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'bigint' ? IBigintValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'string' ? IStringValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'uuid' ? IUuidValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localDateTime' ? ILocalDateTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localDate' ? ILocalDateValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'localTime' ? ILocalTimeValueSource<TABLE_OR_VIEW, OPTIONAL_TYPE> :
        TYPE extends 'customInt' ? CustomIntValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customDouble' ? ICustomDoubleValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customUuid' ? ICustomUuidValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customLocalDateTime' ? ICustomLocalDateTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customLocalDate' ? ICustomLocalDateValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customLocalTime' ? ICustomLocalTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customComparable' ? IComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'enum' ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'custom' ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, OPTIONAL_TYPE> :
        never
    ): never

export type MapArgumentToIValueSourceAsAnyOptionalType<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, ARG> =
    ARG extends Argument<infer TYPE, any, any, infer T, infer TYPE_NAME> ? (
        TYPE extends 'boolean' ? IBooleanValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'int' ? INumberValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'double' ? INumberValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'bigint' ? IBigintValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'string' ? IStringValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'uuid' ? IUuidValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'localDateTime' ? ILocalDateTimeValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'localDate' ? ILocalDateValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'localTime' ? ILocalTimeValueSource<TABLE_OR_VIEW, any> :
        TYPE extends 'customInt' ? CustomIntValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        TYPE extends 'customDouble' ? ICustomDoubleValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        TYPE extends 'customUuid' ? ICustomUuidValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        TYPE extends 'customLocalDateTime' ? ICustomLocalDateTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        TYPE extends 'customLocalDate' ? ICustomLocalDateValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        TYPE extends 'customLocalTime' ? ICustomLocalTimeValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        TYPE extends 'customComparable' ? IComparableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        TYPE extends 'enum' ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        TYPE extends 'custom' ? IEqualableValueSource<TABLE_OR_VIEW, T, TYPE_NAME, any> :
        never
    ): never

export type ArgForFn<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, ARG> =
    ARG extends Argument<any, infer OPTIONAL_TYPE, infer MODE, any> ? (
        MODE extends 'value' ? never : (
            'required' extends OPTIONAL_TYPE
            ? MapArgumentToIValueSource<TABLE_OR_VIEW, ARG>
            : MapArgumentToIValueSourceAsAnyOptionalType<TABLE_OR_VIEW, ARG>
        )
    ): never

export type RequiredArgumentWhenValueMode<ARG> =
    ARG extends Argument<infer TYPE, any, infer MODE, infer T> ? (
        MODE extends 'value' ? Argument<TYPE, 'required', MODE, T> : ARG
    ): never

export type ArgForBuilderIfValue<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, ARG> =
    MapArgumentToValueSource<TABLE_OR_VIEW, RequiredArgumentWhenValueMode<ARG>>


export type RemapValueSourceTypeIfValue<TABLE_OR_VIEW extends ITableOrViewRef<AnyDB>, TYPE> =
    TYPE extends IIfValueSource<any, infer T> ? (
        IfValueSource<TABLE_OR_VIEW, T>
    ) : RemapValueSourceType<TABLE_OR_VIEW, TYPE>

export function asAlwaysIfValueSource<VS extends IAnyBooleanValueSource<any, any>>(valueSource: VS): AlwaysIfValueSource<VS[typeof tableOrView], VS[typeof optionalType]> {
    return valueSource as any
}
