import type { HasAddWiths, HasSource, AnyTableOrView } from "../utils/ITableOrView"
import type { TypeAdapter } from "../TypeAdapter"
import type { aggregatedArrayValueSource, anyBooleanValueSource, bigintValueSource, booleanValueSource, columnsType, comparableValueSource, customDoubleValueSource, customIntValueSource, customLocalDateTimeValueSource, customLocalDateValueSource, customLocalTimeValueSource, customUuidValueSource, localDateTimeValueSource, localDateValueSource, equalableValueSource, ifValueSource, nullableValueSource, numberValueSource, optionalType, resultType, stringValueSource, localTimeValueSource, type, uuidValueSource, source } from "../utils/symbols"
import { valueType, typeName, typeName as typeName_, isValueSourceObject } from "../utils/symbols"
import type { NSource } from "../utils/sourceName"

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

export function __mergeOptional(op1: OptionalType, op2: OptionalType): OptionalType {
    // Always select the less strict option
    if (op1 === 'required') {
        return op2
    }
    if (op1 === 'requiredInOptionalObject') {
        if (op2 === 'required') {
            return 'requiredInOptionalObject'
        } else {
            return op2
        }
    }
    if (op1 === 'originallyRequired') {
        if (op2 === 'required' || op2 === 'requiredInOptionalObject') {
            return 'originallyRequired'
        } else {
            return op2
        }
    }
    return 'optional'
}

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

export type OptionalTypeOfValue<T> =
    undefined extends string ? 'optional' // tsc is working with strict mode disabled. There is no way to infer the optional properties. Keep as optional is a better approximation.
    : undefined extends T ? 'optional'
    : null extends T ? 'optional'
    : 'required'

export type ValueSourceValueType<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | OptionalValueType<OPTIONAL_TYPE> : never
export type ValueSourceValueTypeForResult<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' ? never : null) : never
export type ValueSourceValueTypeForObjectResult<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' ? never : undefined) : never
export type ValueSourceValueTypeForNullableObjectResult<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' ? never : null) : never
export type ValueSourceValueTypeForRequiredInOptionalObject<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' | 'requiredInOptionalObject' ? never : undefined) : never
export type ValueSourceValueTypeForRequiredInNullableOptionalObject<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' | 'requiredInOptionalObject' ? never : null) : never
export type ValueSourceValueTypeForOptionalObjectResultSameOuterJoin<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' | 'requiredInOptionalObject' | 'originallyRequired' ? never : undefined) : never
export type ValueSourceValueTypeForOptionalNullableObjectResultSameOuterJoin<T> = T extends IValueSource<any, infer TYPE, any, infer OPTIONAL_TYPE> ? TYPE | (OPTIONAL_TYPE extends 'required' | 'requiredInOptionalObject' | 'originallyRequired' ? never : null) : never

export interface AnyValueSource {
    [isValueSourceObject]: true
}

export interface ValueSourceOf</*in|out*/ SOURCE extends NSource> extends AnyValueSource, HasSource<SOURCE> {
}

export interface IValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ValueSourceOf<SOURCE> {
    [valueType]: TYPE
    [optionalType]: OPTIONAL_TYPE
    [typeName]: TYPE_NAME
}

export interface ValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
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

export function __getValueSourceOfObject(obj: AnyTableOrView, prop: string): ValueSource<any, unknown, unknown, any> | undefined {
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

export function __getValueSourcePrivate(valueSource: AnyValueSource | IAnyBooleanValueSource<any, any>): __ValueSourcePrivate {
    return valueSource as any
}

export interface INullableValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [nullableValueSource]: 'NullableValueSource'
}

export interface NullableValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>, INullableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    isNull(): BooleanValueSource<SOURCE, 'required'>
    isNotNull(): BooleanValueSource<SOURCE, 'required'>
    // The next methods must be reimplemented in the subinterface with the proper return type
    valueWhenNull(value: TYPE): NullableValueSource<SOURCE, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, TYPE, this[typeof typeName], any>>(value: VALUE): NullableValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): NullableValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, TYPE, this[typeof typeName], any>>(value: VALUE): NullableValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, 'optional'>
    asOptional(): NullableValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): NullableValueSource<SOURCE, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): NullableValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): NullableValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
}

export interface IExecutableSelectQuery</*in|out*/ SOURCE extends NSource, /*in|out*/ COLUMNS, /*in|out*/ RESULT> extends HasSource<SOURCE> {
    [type]: 'ExecutableSelectQuery'
    [resultType]: RESULT
    [columnsType]: COLUMNS
}

export interface IExecutableInsertQuery</*in|out*/ SOURCE extends NSource, /*in|out*/ RESULT> extends HasSource<SOURCE> {
    [type]: 'ExecutableInsertQuery'
    [resultType]: RESULT
}

export interface IExecutableUpdateQuery</*in|out*/ SOURCE extends NSource, /*in|out*/ RESULT> extends HasSource<SOURCE> {
    [type]: 'ExecutableUpdateQuery'
    [resultType]: RESULT
}

export interface IExecutableDeleteQuery</*in|out*/ SOURCE extends NSource, /*in|out*/ RESULT> extends HasSource<SOURCE> {
    [type]: 'ExecutableDeleteQuery'
    [resultType]: RESULT
}

export interface IEqualableValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends INullableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [equalableValueSource]: 'EqualableValueSource'
}

export interface EqualableValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends NullableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>, IEqualableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    equalsIfValue(value: TYPE | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    equals(value: TYPE): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    equals<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEqualsIfValue(value: TYPE | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    notEquals(value: TYPE): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    notEquals<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    isIfValue(value: TYPE | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    is(value: TYPE | null | undefined): BooleanValueSource<SOURCE, 'required'>
    is<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], 'required'>
    isNotIfValue(value: TYPE | null | undefined): IfValueSource<SOURCE, 'required'>
    isNot(value: TYPE | null | undefined): BooleanValueSource<SOURCE, 'required'>
    isNot<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], 'required'>

    inIfValue(values: TYPE[] | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    in(values: TYPE[]): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    in<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    in<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IEqualableValueSource<any, TYPE, TYPE_NAME, any>, TYPE | null | undefined>): BooleanValueSource<SOURCE | SOURCE2, OPTIONAL_TYPE>
    notInIfValue(values: TYPE[] | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    notIn(values: TYPE[]): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    notIn<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notIn<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IEqualableValueSource<any, TYPE, TYPE_NAME, any>, TYPE | null | undefined>): BooleanValueSource<SOURCE | SOURCE2, OPTIONAL_TYPE>
    inN(...value: TYPE[]): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    inN<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(...value: Array<TYPE | VALUE>): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notInN(...value: TYPE[]): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    notInN<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(...value: Array<TYPE | VALUE>): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>

    // Redefined methods
    valueWhenNull(value: TYPE): EqualableValueSource<SOURCE, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, TYPE, this[typeof typeName], any>>(value: VALUE): EqualableValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): EqualableValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, TYPE, this[typeof typeName], any>>(value: VALUE): EqualableValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, 'optional'>
    asOptional(): EqualableValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): EqualableValueSource<SOURCE, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): EqualableValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): EqualableValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
}

export interface IComparableValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IEqualableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [comparableValueSource]: 'ComparableValueSource'
}

export interface ComparableValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends EqualableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>, IComparableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    lessThanIfValue(value: TYPE | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    lessThan(value: TYPE): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    lessThan<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    greaterThanIfValue(value: TYPE | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    greaterThan(value: TYPE): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    greaterThan<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    lessOrEqualsIfValue(value: TYPE | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    lessOrEquals(value: TYPE): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    lessOrEquals<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    greaterOrEqualsIfValue(value: TYPE | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    greaterOrEquals(value: TYPE): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    greaterOrEquals<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    between(value: TYPE, value2: TYPE): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    between<VALUE2 extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: TYPE, value2: VALUE2): BooleanValueSource<SOURCE | VALUE2[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    between<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE, value2: TYPE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    between<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>, VALUE2 extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE, value2: VALUE2): BooleanValueSource<SOURCE | VALUE[typeof source] | VALUE2[typeof source], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    notBetween(value: TYPE, value2: TYPE): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    notBetween<VALUE2 extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: TYPE, value2: VALUE2): BooleanValueSource<SOURCE | VALUE2[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    notBetween<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE, value2: TYPE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notBetween<VALUE extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>, VALUE2 extends IEqualableValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE, value2: VALUE2): BooleanValueSource<SOURCE | VALUE[typeof source] | VALUE2[typeof source], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: TYPE): ComparableValueSource<SOURCE, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, TYPE, this[typeof typeName], any>>(value: VALUE): ComparableValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): ComparableValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, TYPE, this[typeof typeName], any>>(value: VALUE): ComparableValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, 'optional'>
    asOptional(): ComparableValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): ComparableValueSource<SOURCE, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): ComparableValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): ComparableValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
}

export interface IAnyBooleanValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends HasSource<SOURCE> {
    [valueType]: boolean
    [optionalType]: OPTIONAL_TYPE
    [anyBooleanValueSource]: 'AnyBooleanValueSource'
}

export interface IBooleanValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IEqualableValueSource<SOURCE, boolean, 'BooleanValueSource', OPTIONAL_TYPE>, IAnyBooleanValueSource<SOURCE, OPTIONAL_TYPE> {
    [booleanValueSource]: 'BooleanValueSource'
}

export interface BooleanValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends EqualableValueSource<SOURCE, boolean, 'BooleanValueSource', OPTIONAL_TYPE>, IBooleanValueSource<SOURCE, OPTIONAL_TYPE> {
    negate(): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    and(value: boolean): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    and<VALUE extends IAnyBooleanValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or(value: boolean): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    or<VALUE extends IAnyBooleanValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    onlyWhen(condition: boolean): IIfValueSource<SOURCE, OPTIONAL_TYPE>
    ignoreWhen(condition: boolean): IIfValueSource<SOURCE, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: boolean): BooleanValueSource<SOURCE, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, boolean, this[typeof typeName], any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], VALUE[typeof optionalType]>
    nullIfValue(value: boolean): BooleanValueSource<SOURCE, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, boolean, this[typeof typeName], any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], 'optional'>
    asOptional(): BooleanValueSource<SOURCE, 'optional'>
    asRequiredInOptionalObject(): BooleanValueSource<SOURCE, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): BooleanValueSource<SOURCE, 'optional'>
    ignoreWhenAsNull(when: boolean): BooleanValueSource<SOURCE, 'optional'>
}

export interface IIfValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IAnyBooleanValueSource<SOURCE, OPTIONAL_TYPE> {
    [ifValueSource]: 'IfValueSource'
}

export interface IfValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IIfValueSource<SOURCE, OPTIONAL_TYPE> {
    negate(): IIfValueSource<SOURCE, OPTIONAL_TYPE>
    and(value: boolean): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    and<VALUE extends IBooleanValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    and<VALUE extends IAnyBooleanValueSource<any, any>>(value: VALUE): IfValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or(value: boolean): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    or<VALUE extends IBooleanValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or<VALUE extends IAnyBooleanValueSource<any, any>>(value: VALUE): IfValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    onlyWhen(condition: boolean): IIfValueSource<SOURCE, OPTIONAL_TYPE>
    ignoreWhen(condition: boolean): IIfValueSource<SOURCE, OPTIONAL_TYPE>
    trueWhenNoValue(): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    falseWhenNoValue(): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    valueWhenNoValue(value: boolean): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    valueWhenNoValue<VALUE extends IBooleanValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    valueWhenNoValue<VALUE extends IAnyBooleanValueSource<any, any>>(value: VALUE): IIfValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
}

export interface AlwaysIfValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IIfValueSource<SOURCE, OPTIONAL_TYPE> {
    negate(): AlwaysIfValueSource<SOURCE, OPTIONAL_TYPE>
    and(value: boolean): AlwaysIfValueSource<SOURCE, OPTIONAL_TYPE>
    and<VALUE extends IAnyBooleanValueSource<any, any>>(value: VALUE): AlwaysIfValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    or(value: boolean): AlwaysIfValueSource<SOURCE, OPTIONAL_TYPE>
    or<VALUE extends IAnyBooleanValueSource<any, any>>(value: VALUE): AlwaysIfValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    onlyWhen(condition: boolean): AlwaysIfValueSource<SOURCE, OPTIONAL_TYPE>
    ignoreWhen(condition: boolean): AlwaysIfValueSource<SOURCE, OPTIONAL_TYPE>
    trueWhenNoValue(): AlwaysIfValueSource<SOURCE, OPTIONAL_TYPE>
    falseWhenNoValue(): AlwaysIfValueSource<SOURCE, OPTIONAL_TYPE>
    valueWhenNoValue(value: boolean): AlwaysIfValueSource<SOURCE, OPTIONAL_TYPE>
    valueWhenNoValue<VALUE extends IAnyBooleanValueSource<any, any>>(value: VALUE): AlwaysIfValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
}

export interface INumberValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<SOURCE, number, 'NumberValueSource', OPTIONAL_TYPE> {
    [numberValueSource]: 'NumberValueSource'
}

export interface NumberValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<SOURCE, number, 'NumberValueSource', OPTIONAL_TYPE>, INumberValueSource<SOURCE, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    asInt(): NumberValueSource<SOURCE, OPTIONAL_TYPE> // Maybe unsafe cast, we round it when it is necesary
    asDouble(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    asBigint(): BigintValueSource<SOURCE, OPTIONAL_TYPE> // Maybe unsafe cast, we round it when it is necesary
    abs(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    ceil(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    floor(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    round(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    exp(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    ln(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    log10(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    sqrt(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    cbrt(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    sign(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    // Trigonometric Functions
    acos(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    asin(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    atan(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    cos(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    cot(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    sin(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    tan(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    // SqlFunction1
    power(value: number): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    power<VALUE extends INumberValueSource<any, any>>(value: VALUE): NumberValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: number): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    logn<VALUE extends INumberValueSource<any, any>>(value: VALUE): NumberValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    roundn(value: number): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    roundn<VALUE extends INumberValueSource<any, any>>(value: VALUE): NumberValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: number): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    minValue<VALUE extends INumberValueSource<any, any>>(value: VALUE): NumberValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: number): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    maxValue<VALUE extends INumberValueSource<any, any>>(value: VALUE): NumberValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: number): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    add<VALUE extends INumberValueSource<any, any>>(value: VALUE): NumberValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: number): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    substract<VALUE extends INumberValueSource<any, any>>(value: VALUE): NumberValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: number): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    multiply<VALUE extends INumberValueSource<any, any>>(value: VALUE): NumberValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: number): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    divide<VALUE extends INumberValueSource<any, any>>(value: VALUE): NumberValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: number): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    modulo<VALUE extends INumberValueSource<any, any>>(value: VALUE): NumberValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    atan2(value: number): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    atan2<VALUE extends INumberValueSource<any, any>>(value: VALUE): NumberValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: number): NumberValueSource<SOURCE, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, number, this[typeof typeName], any>>(value: VALUE): NumberValueSource<SOURCE | VALUE[typeof source], VALUE[typeof optionalType]>
    nullIfValue(value: number): NumberValueSource<SOURCE, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, number, this[typeof typeName], any>>(value: VALUE): NumberValueSource<SOURCE | VALUE[typeof source], 'optional'>
    asOptional(): NumberValueSource<SOURCE, 'optional'>
    asRequiredInOptionalObject(): NumberValueSource<SOURCE, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): NumberValueSource<SOURCE, 'optional'>
    ignoreWhenAsNull(when: boolean): NumberValueSource<SOURCE, 'optional'>
}

export interface IBigintValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<SOURCE, bigint, 'BigintValueSource', OPTIONAL_TYPE> {
    [bigintValueSource]: 'BigintValueSource'
}

// some methods are commented because there is no bigdouble yet
export interface BigintValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<SOURCE, bigint, 'BigintValueSource', OPTIONAL_TYPE>, IBigintValueSource<SOURCE, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    abs(): BigintValueSource<SOURCE, OPTIONAL_TYPE>
    ceil(): BigintValueSource<SOURCE, OPTIONAL_TYPE>
    floor(): BigintValueSource<SOURCE, OPTIONAL_TYPE>
    round(): BigintValueSource<SOURCE, OPTIONAL_TYPE>
    // exp(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // ln(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // log10(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // sqrt(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // cbrt(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    sign(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    // Trigonometric Functions
    // acos(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // asin(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // atan(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // cos(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // cot(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // sin(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // tan(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // SqlFunction1
    // power(value: bigint): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // power<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // power(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // power<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // logn(value: bigint): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // logn<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // logn(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // logn<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // roundn(value: bigint): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // roundn<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: bigint): BigintValueSource<SOURCE, OPTIONAL_TYPE>
    minValue<VALUE extends IBigintValueSource<any, any>>(value: VALUE): BigintValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // minValue(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // minValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: bigint): BigintValueSource<SOURCE, OPTIONAL_TYPE>
    maxValue<VALUE extends IBigintValueSource<any, any>>(value: VALUE): BigintValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // maxValue(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // maxValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: bigint): BigintValueSource<SOURCE, OPTIONAL_TYPE>
    add<VALUE extends IBigintValueSource<any, any>>(value: VALUE): BigintValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // add(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // add<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: bigint): BigintValueSource<SOURCE, OPTIONAL_TYPE>
    substract<VALUE extends IBigintValueSource<any, any>>(value: VALUE): BigintValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // substract(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // substract<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // multiply(value: bigint): IntValueSource<SOURCE, OPTIONAL_TYPE>
    // multiply<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): IntValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // multiply(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // multiply<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // divide(value: bigint): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // divide<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // divide(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // divide<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: bigint): BigintValueSource<SOURCE, OPTIONAL_TYPE>
    modulo<VALUE extends IBigintValueSource<any, any>>(value: VALUE): BigintValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // modulo(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // modulo<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    // atan2(value: bigint): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // atan2<VALUE extends IIntValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // atan2(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // atan2<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: bigint): BigintValueSource<SOURCE, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, bigint, this[typeof typeName], any>>(value: VALUE): BigintValueSource<SOURCE | VALUE[typeof source], VALUE[typeof optionalType]>
    nullIfValue(value: bigint): BigintValueSource<SOURCE, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, bigint, this[typeof typeName], any>>(value: VALUE): BigintValueSource<SOURCE | VALUE[typeof source], 'optional'>
    asOptional(): BigintValueSource<SOURCE, 'optional'>
    asRequiredInOptionalObject(): BigintValueSource<SOURCE, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): BigintValueSource<SOURCE, 'optional'>
    ignoreWhenAsNull(when: boolean): BigintValueSource<SOURCE, 'optional'>
}

export interface ICustomIntValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [customIntValueSource]: 'CustomIntValueSource'
}

// some methods are commented because there is no double equivalent
export interface CustomIntValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<SOURCE,TYPE, TYPE_NAME, OPTIONAL_TYPE>, ICustomIntValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    abs(): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    ceil(): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    floor(): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    round(): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    // exp(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // ln(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // log10(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // sqrt(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // cbrt(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    sign(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    // Trigonometric Functions
    // acos(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // asin(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // atan(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // cos(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // cot(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // sin(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // tan(): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // SqlFunction1
    // power(value: TYPE): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // power<VALUE extends CustomIntValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // power(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // power<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // logn(value: TYPE): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // logn<VALUE extends CustomIntValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // logn(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // logn<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // roundn(value: TYPE): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // roundn<VALUE extends CustomIntValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: TYPE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    minValue<VALUE extends CustomIntValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // minValue(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // minValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: TYPE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    maxValue<VALUE extends CustomIntValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // maxValue(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // maxValue<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: TYPE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    add<VALUE extends CustomIntValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // add(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // add<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: TYPE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    substract<VALUE extends CustomIntValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // substract(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // substract<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: TYPE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    multiply<VALUE extends CustomIntValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // multiply(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // multiply<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // divide(value: TYPE): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // divide<VALUE extends CustomIntValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // divide(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // divide<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: TYPE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    modulo<VALUE extends CustomIntValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // modulo(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // modulo<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    // atan2(value: TYPE): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // atan2<VALUE extends CustomIntValueSource<TableOrViewRef<this[typeof database]>, TYPE, TYPE_NAME, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // atan2(value: double): DoubleValueSource<SOURCE, OPTIONAL_TYPE>
    // atan2<VALUE extends IDoubleValueSource<TableOrViewRef<this[typeof database]>, any>>(value: VALUE): DoubleValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: TYPE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    asOptional(): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): CustomIntValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
}

export interface ICustomDoubleValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [customDoubleValueSource]: 'CustomDoubleValueSource'
}

export interface CustomDoubleValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>, ICustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    // SqlFunction0
    // Number functions
    // asInt(): NumberValueSource<SOURCE, OPTIONAL_TYPE> // Maybe unsafe cast, we round it when it is necesary
    // asDouble(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    // asBigint(): BigintValueSource<SOURCE, OPTIONAL_TYPE> // Maybe unsafe cast, we round it when it is necesary
    abs(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    ceil(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    floor(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    round(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    exp(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    ln(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    log10(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sqrt(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    cbrt(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sign(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    // Trigonometric Functions
    acos(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    asin(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    atan(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    cos(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    cot(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    sin(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    tan(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    // SqlFunction1
    power(value: TYPE): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    power<VALUE extends CustomDoubleValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    logn(value: TYPE): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    logn<VALUE extends CustomDoubleValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    roundn(value: TYPE): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    roundn(value: number): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    roundn<VALUE extends CustomDoubleValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    roundn<VALUE extends NumberValueSource<any, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    minValue(value: TYPE): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    minValue<VALUE extends CustomDoubleValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    maxValue(value: TYPE): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    maxValue<VALUE extends CustomDoubleValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Number operators
    add(value: TYPE): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    add<VALUE extends CustomDoubleValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substract(value: TYPE): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    substract<VALUE extends CustomDoubleValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    multiply(value: TYPE): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    multiply<VALUE extends CustomDoubleValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    divide(value: TYPE): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    divide<VALUE extends CustomDoubleValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    modulo(value: TYPE): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    modulo<VALUE extends CustomDoubleValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Trigonometric Functions
    atan2(value: TYPE): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>
    atan2<VALUE extends CustomDoubleValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: TYPE): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomDoubleValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, 'optional'>
    asOptional(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): CustomDoubleValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
}

export interface IStringValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<SOURCE, string, 'StringValueSource', OPTIONAL_TYPE> {
    [stringValueSource]: 'StringValueSource'
}

export interface StringValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<SOURCE, string, 'StringValueSource', OPTIONAL_TYPE>, IStringValueSource<SOURCE, OPTIONAL_TYPE> {
    // SqlComparator 1
    equalsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    equalsInsensitive(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    equalsInsensitive<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEqualsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    notEqualsInsensitive(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    notEqualsInsensitive<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    likeIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    like(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    like<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notLikeIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    notLike(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    notLike<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    likeInsensitiveIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    likeInsensitive(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    likeInsensitive<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notLikeInsensitiveIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    notLikeInsensitive(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    notLikeInsensitive<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    startsWithIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    startsWith(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    startsWith<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notStartsWithIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    notStartsWith(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    notStartsWith<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    endsWithIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    endsWith(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    endsWith<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEndsWithIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    notEndsWith(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    notEndsWith<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    startsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    startsWithInsensitive(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    startsWithInsensitive<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notStartsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    notStartsWithInsensitive(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    notStartsWithInsensitive<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    endsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    endsWithInsensitive(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    endsWithInsensitive<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notEndsWithInsensitiveIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    notEndsWithInsensitive(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    notEndsWithInsensitive<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    containsIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    contains(value: string ): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    contains<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notContainsIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    notContains(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    notContains<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    containsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    containsInsensitive(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    containsInsensitive<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    notContainsInsensitiveIfValue(value: string | null | undefined): IfValueSource<SOURCE, OPTIONAL_TYPE>
    notContainsInsensitive(value: string): BooleanValueSource<SOURCE, OPTIONAL_TYPE>
    notContainsInsensitive<VALUE extends IStringValueSource<any, any>>(value: VALUE): BooleanValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // SqlFunction0
    toLowerCase(): StringValueSource<SOURCE, OPTIONAL_TYPE>
    toUpperCase(): StringValueSource<SOURCE, OPTIONAL_TYPE>
    length(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    trim(): StringValueSource<SOURCE, OPTIONAL_TYPE>
    trimLeft(): StringValueSource<SOURCE, OPTIONAL_TYPE>
    trimRight(): StringValueSource<SOURCE, OPTIONAL_TYPE>
    reverse(): StringValueSource<SOURCE, OPTIONAL_TYPE>
    // SqlFunction1
    concatIfValue(value: string | null | undefined): StringValueSource<SOURCE, OPTIONAL_TYPE>
    concat(value: string): StringValueSource<SOURCE, OPTIONAL_TYPE>
    concat<VALUE extends IStringValueSource<any, any>>(value: VALUE): StringValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substrToEnd(start: number): StringValueSource<SOURCE, OPTIONAL_TYPE>
    substrToEnd<VALUE extends INumberValueSource<any, any>>(start: VALUE): StringValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substringToEnd(start: number): StringValueSource<SOURCE, OPTIONAL_TYPE>
    substringToEnd<VALUE extends INumberValueSource<any, any>>(start: VALUE): StringValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    // SqlFunction2
    substr(start: number, count: number): StringValueSource<SOURCE, OPTIONAL_TYPE>
    substr<VALUE2 extends INumberValueSource<any, any>>(start: number, count: VALUE2): StringValueSource<SOURCE | VALUE2[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    substr<VALUE extends INumberValueSource<any, any>>(start: VALUE, count: number): StringValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substr<VALUE extends INumberValueSource<any, any>, VALUE2 extends INumberValueSource<any, any>>(start: VALUE, count: VALUE2): StringValueSource<SOURCE | VALUE[typeof source] | VALUE2[typeof source], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    substring(start: number, count: number): StringValueSource<SOURCE, OPTIONAL_TYPE>
    substring<VALUE2 extends INumberValueSource<any, any>>(start: number, end: VALUE2): StringValueSource<SOURCE | VALUE2[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    substring<VALUE extends INumberValueSource<any, any>>(start: VALUE, end: number): StringValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    substring<VALUE extends INumberValueSource<any, any>, VALUE2 extends INumberValueSource<any, any>>(start: VALUE, end: VALUE2): StringValueSource<SOURCE | VALUE[typeof source] | VALUE2[typeof source], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    replaceAllIfValue(findString: string | null | undefined, replaceWith: string | null | undefined): StringValueSource<SOURCE, OPTIONAL_TYPE>
    replaceAllIfValue<VALUE2 extends IStringValueSource<any, any>>(findString: string | null | undefined, replaceWith: VALUE2): StringValueSource<SOURCE | VALUE2[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    replaceAllIfValue<VALUE extends IStringValueSource<any, any>>(findString: VALUE, replaceWith: string | null | undefined): StringValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    replaceAll(findString: string, replaceWith: string): StringValueSource<SOURCE, OPTIONAL_TYPE>
    replaceAll<VALUE2 extends IStringValueSource<any, any>>(findString: string, replaceWith: VALUE2): StringValueSource<SOURCE | VALUE2[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE2[typeof optionalType]>>
    replaceAll<VALUE extends IStringValueSource<any, any>>(findString: VALUE, replaceWith: string): StringValueSource<SOURCE | VALUE[typeof source], MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>>
    replaceAll<VALUE extends IStringValueSource<any, any>, VALUE2 extends IStringValueSource<any, any>>(findString: VALUE, replaceWith: VALUE2): StringValueSource<SOURCE | VALUE[typeof source] | VALUE2[typeof source], MergeOptional<MergeOptional<OPTIONAL_TYPE, VALUE[typeof optionalType]>, VALUE2[typeof optionalType]>>
    // Redefined methods
    valueWhenNull(value: string): StringValueSource<SOURCE, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, string, this[typeof typeName], any>>(value: VALUE): StringValueSource<SOURCE | VALUE[typeof source], VALUE[typeof optionalType]>
    nullIfValue(value: string): StringValueSource<SOURCE, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, string, this[typeof typeName], any>>(value: VALUE): StringValueSource<SOURCE | VALUE[typeof source], 'optional'>
    asOptional(): StringValueSource<SOURCE, 'optional'>
    asRequiredInOptionalObject(): StringValueSource<SOURCE, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): StringValueSource<SOURCE, 'optional'>
    ignoreWhenAsNull(when: boolean): StringValueSource<SOURCE, 'optional'>
}

export interface IUuidValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<SOURCE, string, 'UuidValueSource', OPTIONAL_TYPE> {
    [uuidValueSource]: 'UuidValueSource'
}

export interface UuidValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<SOURCE, string, 'UuidValueSource', OPTIONAL_TYPE>, IUuidValueSource<SOURCE, OPTIONAL_TYPE> {
    asString(): StringValueSource<SOURCE, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: string): UuidValueSource<SOURCE, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, string, this[typeof typeName], any>>(value: VALUE): UuidValueSource<SOURCE | VALUE[typeof source], VALUE[typeof optionalType]>
    nullIfValue(value: string): UuidValueSource<SOURCE, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, string, this[typeof typeName], any>>(value: VALUE): UuidValueSource<SOURCE | VALUE[typeof source], 'optional'>
    asOptional(): UuidValueSource<SOURCE, 'optional'>
    asRequiredInOptionalObject(): UuidValueSource<SOURCE, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): UuidValueSource<SOURCE, 'optional'>
    ignoreWhenAsNull(when: boolean): UuidValueSource<SOURCE, 'optional'>
}

export interface ICustomUuidValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [customUuidValueSource]: 'CustomUuidValueSource'
}

export interface CustomUuidValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>, ICustomUuidValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    asString(): StringValueSource<SOURCE, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: TYPE): CustomUuidValueSource<SOURCE, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomUuidValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): CustomUuidValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomUuidValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, 'optional'>
    asOptional(): CustomUuidValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): CustomUuidValueSource<SOURCE, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): CustomUuidValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): CustomUuidValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
}

export interface ILocalDateValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<SOURCE, Date, 'DateValueSource', OPTIONAL_TYPE> {
    [localDateValueSource]: 'LocalDateValueSource'
}

export interface LocalDateValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<SOURCE, Date, 'DateValueSource', OPTIONAL_TYPE>, ILocalDateValueSource<SOURCE, OPTIONAL_TYPE> {
    /** Gets the year */
    getFullYear(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: Date): LocalDateValueSource<SOURCE, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, Date, this[typeof typeName], any>>(value: VALUE): LocalDateValueSource<SOURCE | VALUE[typeof source], VALUE[typeof optionalType]>
    nullIfValue(value: Date): LocalDateValueSource<SOURCE, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, Date, this[typeof typeName], any>>(value: VALUE): LocalDateValueSource<SOURCE | VALUE[typeof source], 'optional'>
    asOptional(): LocalDateValueSource<SOURCE, 'optional'>
    asRequiredInOptionalObject(): LocalDateValueSource<SOURCE, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): LocalDateValueSource<SOURCE, 'optional'>
    ignoreWhenAsNull(when: boolean): LocalDateValueSource<SOURCE, 'optional'>
}

export interface ILocalTimeValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<SOURCE, Date, 'TimeValueSource', OPTIONAL_TYPE> {
    [localTimeValueSource]: 'LocalTimeValueSource'
}

export interface LocalTimeValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<SOURCE, Date, 'TimeValueSource', OPTIONAL_TYPE>, ILocalTimeValueSource<SOURCE, OPTIONAL_TYPE> {
    /** Gets the hours */
    getHours(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the minutes */
    getMinutes(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the seconds */
    getSeconds(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the milliseconds */
    getMilliseconds(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: Date): LocalTimeValueSource<SOURCE, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, Date, this[typeof typeName], any>>(value: VALUE): LocalTimeValueSource<SOURCE | VALUE[typeof source], VALUE[typeof optionalType]>
    nullIfValue(value: Date): LocalTimeValueSource<SOURCE, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, Date, this[typeof typeName], any>>(value: VALUE): LocalTimeValueSource<SOURCE | VALUE[typeof source], 'optional'>
    asOptional(): LocalTimeValueSource<SOURCE, 'optional'>
    asRequiredInOptionalObject(): LocalTimeValueSource<SOURCE, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): LocalTimeValueSource<SOURCE, 'optional'>
    ignoreWhenAsNull(when: boolean): LocalTimeValueSource<SOURCE, 'optional'>
}

export interface ILocalDateTimeValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<SOURCE, Date, 'DateTimeValueSource', OPTIONAL_TYPE> {
    [localDateTimeValueSource]: 'LocalDateTimeValueSource'
}

export interface LocalDateTimeValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<SOURCE, Date, 'DateTimeValueSource', OPTIONAL_TYPE>, ILocalDateTimeValueSource<SOURCE, OPTIONAL_TYPE> {
    /** Gets the year */
    getFullYear(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the hours */
    getHours(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the minutes */
    getMinutes(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the seconds */
    getSeconds(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the milliseconds */
    getMilliseconds(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the time value in milliseconds */
    getTime(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: Date): LocalDateTimeValueSource<SOURCE, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, Date, this[typeof typeName], any>>(value: VALUE): LocalDateTimeValueSource<SOURCE | VALUE[typeof source], VALUE[typeof optionalType]>
    nullIfValue(value: Date): LocalDateTimeValueSource<SOURCE, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, Date, this[typeof typeName], any>>(value: VALUE): LocalDateTimeValueSource<SOURCE | VALUE[typeof source], 'optional'>
    asOptional(): LocalDateTimeValueSource<SOURCE, 'optional'>
    asRequiredInOptionalObject(): LocalDateTimeValueSource<SOURCE, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): LocalDateTimeValueSource<SOURCE, 'optional'>
    ignoreWhenAsNull(when: boolean): LocalDateTimeValueSource<SOURCE, 'optional'>
}

export interface ICustomLocalDateValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [customLocalDateValueSource]: 'CustomLocalDateValueSource'
}

export interface CustomLocalDateValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>, ICustomLocalDateValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    /** Gets the year */
    getFullYear(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    valueWhenNull(value: TYPE): CustomLocalDateValueSource<SOURCE, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomLocalDateValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): CustomLocalDateValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomLocalDateValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, 'optional'>
    asOptional(): CustomLocalDateValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): CustomLocalDateValueSource<SOURCE, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): CustomLocalDateValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): CustomLocalDateValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
}

export interface ICustomLocalTimeValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [customLocalTimeValueSource]: 'CustomLocalTimeValueSource'
}

export interface CustomLocalTimeValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>, ICustomLocalTimeValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    /** Gets the hours */
    getHours(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the minutes */
    getMinutes(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the seconds */
    getSeconds(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the milliseconds */
    getMilliseconds(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: TYPE): CustomLocalTimeValueSource<SOURCE, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomLocalTimeValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): CustomLocalTimeValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomLocalTimeValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, 'optional'>
    asOptional(): CustomLocalTimeValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): CustomLocalTimeValueSource<SOURCE, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): CustomLocalTimeValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): CustomLocalTimeValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
}

export interface ICustomLocalDateTimeValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IComparableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    [customLocalDateTimeValueSource]: 'CustomLocalDateTimeValueSource'
}

export interface CustomLocalDateTimeValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ TYPE_NAME, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ComparableValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE>, ICustomLocalDateTimeValueSource<SOURCE, TYPE, TYPE_NAME, OPTIONAL_TYPE> {
    /** Gets the year */
    getFullYear(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the month (value between 0 to 11)*/
    getMonth(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the day-of-the-month */
    getDate(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the day of the week (0 represents Sunday) */
    getDay(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the hours */
    getHours(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the minutes */
    getMinutes(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the seconds */
    getSeconds(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the milliseconds */
    getMilliseconds(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    /** Gets the time value in milliseconds */
    getTime(): NumberValueSource<SOURCE, OPTIONAL_TYPE>
    // Redefined methods
    valueWhenNull(value: TYPE): CustomLocalDateTimeValueSource<SOURCE, TYPE, TYPE_NAME, 'required'>
    valueWhenNull<VALUE extends IValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomLocalDateTimeValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, VALUE[typeof optionalType]>
    nullIfValue(value: TYPE): CustomLocalDateTimeValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    nullIfValue<VALUE extends IValueSource<any, TYPE, TYPE_NAME, any>>(value: VALUE): CustomLocalDateTimeValueSource<SOURCE | VALUE[typeof source], TYPE, TYPE_NAME, 'optional'>
    asOptional(): CustomLocalDateTimeValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    asRequiredInOptionalObject(): CustomLocalDateTimeValueSource<SOURCE, TYPE, TYPE_NAME, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): CustomLocalDateTimeValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
    ignoreWhenAsNull(when: boolean): CustomLocalDateTimeValueSource<SOURCE, TYPE, TYPE_NAME, 'optional'>
}

export interface IAggregatedArrayValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends IValueSource<SOURCE, TYPE, 'AggregatedArray', OPTIONAL_TYPE> {
    [aggregatedArrayValueSource]: 'AggregatedArrayValueSource'
}

export interface AggregatedArrayValueSource</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends ValueSource<SOURCE, TYPE, 'AggregatedArray', OPTIONAL_TYPE>, IAggregatedArrayValueSource<SOURCE, TYPE, OPTIONAL_TYPE> {
    useEmptyArrayForNoValue(): AggregatedArrayValueSource<SOURCE, TYPE, 'required'>
    asOptionalNonEmptyArray(): AggregatedArrayValueSource<SOURCE, TYPE, 'optional'>
    asRequiredInOptionalObject(): AggregatedArrayValueSource<SOURCE, TYPE, 'requiredInOptionalObject'>
    onlyWhenOrNull(when: boolean): AggregatedArrayValueSource<SOURCE, TYPE, 'optional'>
    ignoreWhenAsNull(when: boolean): AggregatedArrayValueSource<SOURCE, TYPE, 'optional'>
}

export interface AggregatedArrayValueSourceProjectableAsNullable</*in|out*/ SOURCE extends NSource, /*in|out*/ TYPE, /*in|out*/ STRICT_TYPE, /*in|out*/ OPTIONAL_TYPE extends OptionalType> extends AggregatedArrayValueSource<SOURCE, TYPE, OPTIONAL_TYPE> {
    projectingOptionalValuesAsNullable(): AggregatedArrayValueSource<SOURCE, STRICT_TYPE, OPTIONAL_TYPE>
}

export type RemapValueSourceType<SOURCE extends NSource, TYPE> =
    TYPE extends IValueSource<any, infer T, infer TYPE_NAME, infer OPTIONAL_TYPE> ? (
        TYPE extends IBooleanValueSource<any, any> ? BooleanValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends IBigintValueSource<any, any> ? BigintValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends INumberValueSource<any, any> ? NumberValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends IStringValueSource<any, any> ? StringValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends IUuidValueSource<any, any> ? UuidValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ILocalDateTimeValueSource<any, any> ? LocalDateTimeValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ILocalDateValueSource<any, any> ? LocalDateValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ILocalTimeValueSource<any, any> ? LocalTimeValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ICustomIntValueSource<any, any, any, any> ? CustomIntValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomDoubleValueSource<any, any, any, any> ? CustomDoubleValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomUuidValueSource<any, any, any, any> ? CustomUuidValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateTimeValueSource<any, any, any, any> ? CustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateValueSource<any, any, any, any> ? CustomLocalDateValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalTimeValueSource<any, any, any, any> ? CustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IComparableValueSource<any, any, any, any> ? ComparableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IEqualableValueSource<any, any,any, any> ? EqualableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends INullableValueSource<any, any, any, any> ? NullableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IAggregatedArrayValueSource<any, any, any> ? AggregatedArrayValueSource<SOURCE, T, OPTIONAL_TYPE> :
        ValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE>
    ): never


export type RemapValueSourceTypeWithOptionalType<SOURCE extends NSource, TYPE, OPTIONAL_TYPE extends OptionalType> =
    TYPE extends IValueSource<any, infer T, infer TYPE_NAME, any> ? (
        TYPE extends IBooleanValueSource<any, any> ? BooleanValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends IBigintValueSource<any, any> ? BigintValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends INumberValueSource<any, any> ? NumberValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends IStringValueSource<any, any> ? StringValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends IUuidValueSource<any, any> ? UuidValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ILocalDateTimeValueSource<any, any> ? LocalDateTimeValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ILocalDateValueSource<any, any> ? LocalDateValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ILocalTimeValueSource<any, any> ? LocalTimeValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ICustomIntValueSource<any, any, any, any> ? CustomIntValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomDoubleValueSource<any, any, any, any> ? CustomDoubleValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomUuidValueSource<any, any, any, any> ? CustomUuidValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateTimeValueSource<any, any, any, any> ? CustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateValueSource<any, any, any, any> ? CustomLocalDateValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalTimeValueSource<any, any, any, any> ? CustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IComparableValueSource<any, any,any, any> ? ComparableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IEqualableValueSource<any, any, any, any> ? EqualableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends INullableValueSource<any, any, any, any> ? NullableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IAggregatedArrayValueSource<any, any, any> ? AggregatedArrayValueSource<SOURCE, T, OPTIONAL_TYPE> :
        ValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE>
    ): never

export type RemapIValueSourceType<SOURCE extends NSource, TYPE> =
    TYPE extends IValueSource<any, infer T, infer TYPE_NAME, infer OPTIONAL_TYPE> ? (
        TYPE extends IBooleanValueSource<any, any> ? IBooleanValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends IBigintValueSource<any, any> ? IBigintValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends INumberValueSource<any, any> ? INumberValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends IStringValueSource<any, any> ? IStringValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends IUuidValueSource<any, any> ? IUuidValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ILocalDateTimeValueSource<any, any> ? ILocalDateTimeValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ILocalDateValueSource<any, any> ? ILocalDateValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ILocalTimeValueSource<any, any> ? ILocalTimeValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ICustomIntValueSource<any, any, any, any> ? ICustomIntValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomDoubleValueSource<any, any, any, any> ? ICustomDoubleValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomUuidValueSource<any, any, any, any> ? ICustomUuidValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateTimeValueSource<any, any, any, any> ? ICustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateValueSource<any, any, any, any> ? ICustomLocalDateValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalTimeValueSource<any, any, any, any> ? ICustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IComparableValueSource<any, any, any, any> ? IComparableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IEqualableValueSource<any, any,any, any> ? IEqualableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends INullableValueSource<any, any, any, any> ? INullableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IAggregatedArrayValueSource<any, any, any> ? IAggregatedArrayValueSource<SOURCE, T, OPTIONAL_TYPE> :
        IValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE>
    ): never

export type RemapIValueSourceTypeWithOptionalType<SOURCE extends NSource, TYPE, OPTIONAL_TYPE extends OptionalType> =
    TYPE extends IValueSource<any, infer T, infer TYPE_NAME, any> ? (
        TYPE extends IBooleanValueSource<any, any> ? IBooleanValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends IBigintValueSource<any, any> ? IBigintValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends INumberValueSource<any, any> ? INumberValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends IStringValueSource<any, any> ? IStringValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends IUuidValueSource<any, any> ? IUuidValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ILocalDateTimeValueSource<any, any> ? ILocalDateTimeValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ILocalDateValueSource<any, any> ? ILocalDateValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ILocalTimeValueSource<any, any> ? ILocalTimeValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends ICustomIntValueSource<any, any, any, any> ? ICustomIntValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomDoubleValueSource<any, any, any, any> ? ICustomDoubleValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomUuidValueSource<any, any, any, any> ? ICustomUuidValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateTimeValueSource<any, any, any, any> ? ICustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalDateValueSource<any, any, any, any> ? ICustomLocalDateValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends ICustomLocalTimeValueSource<any, any, any, any> ? ICustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IComparableValueSource<any, any,any, any> ? IComparableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IEqualableValueSource<any, any, any, any> ? IEqualableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends INullableValueSource<any, any, any, any> ? INullableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends IAggregatedArrayValueSource<any, any, any> ? IAggregatedArrayValueSource<SOURCE, T, OPTIONAL_TYPE> :
        IValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE>
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
    [typeName_]!: TYPE_NAME

    constructor (type: T, typeName: string, optionalType: OPTIONAL_TYPE, mode: MODE, adapter?: TypeAdapter) {
        this.type = type
        this.typeName = typeName
        this.optionalType = optionalType
        this.mode = mode
        this.adapter = adapter
    }
}

export type TypeOfArgument<ARG> = ARG extends Argument<any, infer OPTIONAL_TYPE, any, infer T> ? T | OptionalValueType<OPTIONAL_TYPE> : never

export type MapArgumentToValueSource<SOURCE extends NSource, ARG> =
    ARG extends Argument<infer TYPE, infer OPTIONAL_TYPE, any, infer T, infer TYPE_NAME> ? (
        TYPE extends 'boolean' ? BooleanValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'int' ? NumberValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'double' ? NumberValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'bigint' ? BigintValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'string' ? StringValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'uuid' ? UuidValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'localDateTime' ? LocalDateTimeValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'localDate' ? LocalDateValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'localTime' ? LocalTimeValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'customInt' ? CustomIntValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customDouble' ? CustomDoubleValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customUuid' ? CustomUuidValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customLocalDateTime' ? CustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customLocalDate' ? CustomLocalDateValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customLocalTime' ? CustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customComparable' ? ComparableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'enum' ? EqualableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'custom' ? EqualableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        never
    ): never

export type MapArgumentToIValueSource<SOURCE extends NSource, ARG> =
    ARG extends Argument<infer TYPE, infer OPTIONAL_TYPE, any, infer T, infer TYPE_NAME> ? (
        TYPE extends 'boolean' ? IBooleanValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'int' ? INumberValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'double' ? INumberValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'bigint' ? IBigintValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'string' ? IStringValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'uuid' ? IUuidValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'localDateTime' ? ILocalDateTimeValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'localDate' ? ILocalDateValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'localTime' ? ILocalTimeValueSource<SOURCE, OPTIONAL_TYPE> :
        TYPE extends 'customInt' ? CustomIntValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customDouble' ? ICustomDoubleValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customUuid' ? ICustomUuidValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customLocalDateTime' ? ICustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customLocalDate' ? ICustomLocalDateValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customLocalTime' ? ICustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'customComparable' ? IComparableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'enum' ? IEqualableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        TYPE extends 'custom' ? IEqualableValueSource<SOURCE, T, TYPE_NAME, OPTIONAL_TYPE> :
        never
    ): never

export type MapArgumentToIValueSourceAsAnyOptionalType<SOURCE extends NSource, ARG> =
    ARG extends Argument<infer TYPE, any, any, infer T, infer TYPE_NAME> ? (
        TYPE extends 'boolean' ? IBooleanValueSource<SOURCE, any> :
        TYPE extends 'int' ? INumberValueSource<SOURCE, any> :
        TYPE extends 'double' ? INumberValueSource<SOURCE, any> :
        TYPE extends 'bigint' ? IBigintValueSource<SOURCE, any> :
        TYPE extends 'string' ? IStringValueSource<SOURCE, any> :
        TYPE extends 'uuid' ? IUuidValueSource<SOURCE, any> :
        TYPE extends 'localDateTime' ? ILocalDateTimeValueSource<SOURCE, any> :
        TYPE extends 'localDate' ? ILocalDateValueSource<SOURCE, any> :
        TYPE extends 'localTime' ? ILocalTimeValueSource<SOURCE, any> :
        TYPE extends 'customInt' ? CustomIntValueSource<SOURCE, T, TYPE_NAME, any> :
        TYPE extends 'customDouble' ? ICustomDoubleValueSource<SOURCE, T, TYPE_NAME, any> :
        TYPE extends 'customUuid' ? ICustomUuidValueSource<SOURCE, T, TYPE_NAME, any> :
        TYPE extends 'customLocalDateTime' ? ICustomLocalDateTimeValueSource<SOURCE, T, TYPE_NAME, any> :
        TYPE extends 'customLocalDate' ? ICustomLocalDateValueSource<SOURCE, T, TYPE_NAME, any> :
        TYPE extends 'customLocalTime' ? ICustomLocalTimeValueSource<SOURCE, T, TYPE_NAME, any> :
        TYPE extends 'customComparable' ? IComparableValueSource<SOURCE, T, TYPE_NAME, any> :
        TYPE extends 'enum' ? IEqualableValueSource<SOURCE, T, TYPE_NAME, any> :
        TYPE extends 'custom' ? IEqualableValueSource<SOURCE, T, TYPE_NAME, any> :
        never
    ): never

export type ArgForFn<SOURCE extends NSource, ARG> =
    ARG extends Argument<any, infer OPTIONAL_TYPE, infer MODE, any> ? (
        MODE extends 'value' ? never : (
            'required' extends OPTIONAL_TYPE
            ? MapArgumentToIValueSource<SOURCE, ARG>
            : MapArgumentToIValueSourceAsAnyOptionalType<SOURCE, ARG>
        )
    ): never

export type ArgBaseTypeForFn<ARG> =
    ARG extends Argument<any, infer OPTIONAL_TYPE, infer MODE, any> ? (
        MODE extends 'value' ? never : (
            'required' extends OPTIONAL_TYPE
            ? MapArgumentToIValueSource<any, ARG>
            : MapArgumentToIValueSourceAsAnyOptionalType<any, ARG>
        )
    ): never

export type RequiredArgumentWhenValueMode<ARG> =
    ARG extends Argument<infer TYPE, any, infer MODE, infer T> ? (
        MODE extends 'value' ? Argument<TYPE, 'required', MODE, T> : ARG
    ): never

export type ArgForBuilderIfValue<SOURCE extends NSource, ARG> =
    MapArgumentToValueSource<SOURCE, RequiredArgumentWhenValueMode<ARG>>


export type RemapValueSourceTypeIfValue<SOURCE extends NSource, TYPE> =
    TYPE extends IIfValueSource<any, infer T> ? (
        IfValueSource<SOURCE, T>
    ) : RemapValueSourceType<SOURCE, TYPE>

export function asAlwaysIfValueSource<VS extends IAnyBooleanValueSource<any, any>>(valueSource: VS): AlwaysIfValueSource<VS[typeof source], VS[typeof optionalType]> {
    return valueSource as any
}
