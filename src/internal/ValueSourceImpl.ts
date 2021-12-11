import type { SqlBuilder, SqlOperationStatic0, SqlOperationStatic1, SqlOperation1, SqlOperation2, ToSql, HasOperation, SqlSequenceOperation, SqlFragmentOperation, AggregateFunctions0, AggregateFunctions1, AggregateFunctions1or2, SqlFunction0, SqlComparator0, SelectData } from "../sqlBuilders/SqlBuilder"
import { BooleanValueSource, IntValueSource, DoubleValueSource, NumberValueSource, StringValueSource, TypeSafeStringValueSource, IValueSource, NullableValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, StringIntValueSource, StringDoubleValueSource, StringNumberValueSource, __ValueSourcePrivate, IfValueSource, BigintValueSource, TypeSafeBigintValueSource, isValueSource, AlwaysIfValueSource, IAnyBooleanValueSource, AnyValueSource, ValueSource, OptionalType } from "../expressions/values"
import { CustomBooleanTypeAdapter, TypeAdapter } from "../TypeAdapter"
import { HasAddWiths, ITableOrView, IWithView, __getOldValues, __getTableOrViewPrivate, __registerRequiredColumn, __registerTableOrView } from "../utils/ITableOrView"
import { database, tableOrView, valueSourceType, valueType as valueType_, optionalType as optionalType_ , booleanValueSourceType, comparableValueSourceType, dateTimeValueSourceType, dateValueSourceType, doubleValueSourceType, equalableValueSourceType, intValueSourceType, localDateTimeValueSourceType, localDateValueSourceType, localTimeValueSourceType, nullableValueSourceType, numberValueSourceType, stringDoubleValueSourceType, stringIntValueSourceType, stringNumberValueSourceType, stringValueSourceType, timeValueSourceType, typeSafeStringValueSourceType, ifValueSourceType, bigintValueSourceType, typeSafeBigintValueSourceType, valueSourceTypeName, anyBooleanValueSourceType, optionalType, isValueSourceObject } from "../utils/symbols"
import { __addWiths } from "../utils/ITableOrView"
import { __getValueSourcePrivate } from "../expressions/values"
import { ProxyTypeAdapter } from "./ProxyTypeAdapter"
import { Column } from "../utils/Column"

export abstract class ValueSourceImpl implements IValueSource<any, any, any, any>, NullableValueSource<any, any, any, any>, BooleanValueSource<any, any>, IntValueSource<any, any>, StringIntValueSource<any, any>, DoubleValueSource<any, any>, StringDoubleValueSource<any, any>, NumberValueSource<any, any>, StringNumberValueSource<any, any>, BigintValueSource<any, any>, TypeSafeBigintValueSource<any, any>, StringValueSource<any, any>, TypeSafeStringValueSource<any, any>, LocalDateValueSource<any, any>, LocalTimeValueSource<any, any>, LocalDateTimeValueSource<any, any>, DateValueSource<any, any>, TimeValueSource<any, any>, DateTimeValueSource<any, any>, IfValueSource<any, any>, AlwaysIfValueSource<any, any>, IAnyBooleanValueSource<any, any>, ToSql, __ValueSourcePrivate {
    [valueSourceType]: 'ValueSource'
    [nullableValueSourceType]: 'NullableValueSource'
    [equalableValueSourceType]: 'EqualableValueSource'
    [comparableValueSourceType]: 'ComparableValueSource'
    [booleanValueSourceType]: 'BooleanValueSource'
    [ifValueSourceType]: 'IfValueSource'
    [numberValueSourceType]: 'NumberValueSource'
    [stringNumberValueSourceType]: 'StringNumberValueSource'
    [intValueSourceType]: 'IntValueSource'
    [doubleValueSourceType]: 'DoubleValueSource'
    [bigintValueSourceType]: 'BigintValueSource'
    [typeSafeBigintValueSourceType]: 'TypeSafeBigintValueSource'
    [stringIntValueSourceType]: 'StringIntValueSource'
    [stringDoubleValueSourceType]: 'StringDoubleValueSource'
    [stringValueSourceType]: 'StringValueSource'
    [typeSafeStringValueSourceType]: 'TypeSafeStringValueSource'
    [dateValueSourceType]: 'DateValueSource'
    [timeValueSourceType]: 'TimeValueSource'
    [dateTimeValueSourceType]: 'DateTimeValueSource'
    [localDateValueSourceType]: 'LocalDateValueSource'
    [localTimeValueSourceType]: 'LocalTimeValueSource'
    [localDateTimeValueSourceType]: 'LocalDateTimeValueSource'
    [anyBooleanValueSourceType]: 'AnyBooleanValueSource'
    [valueSourceTypeName]: any

    [database]: any
    [tableOrView]: any
    [valueType_]: any
    [optionalType_]: any

    [isValueSourceObject]: true = true
    __valueType: string
    __optionalType: OptionalType
    __typeAdapter?: TypeAdapter
    __isBooleanForCondition?: boolean

    constructor(valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        this.__valueType = valueType
        this.__optionalType = optionalType
        this.__typeAdapter = typeAdapter
    }
    abstract __toSql(sqlBuilder: SqlBuilder, params: any[]): string
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__toSql(sqlBuilder, params)
    }
    __addWiths(_withs: Array<IWithView<any>>): void {
        // Do nothing
    }
    __registerTableOrView(_requiredTablesOrViews: Set<ITableOrView<any>>): void {
        // Do nothing
    }
    __registerRequiredColumn(_requiredColumns: Set<Column>, _onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        // Do nothing
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return undefined
    }
    isConstValue(): boolean {
        return false
    }
    getConstValue(): any {
        throw new Error('You are trying to access to the const value when the expression is not const')
    }
    asOptional(): any {
        return new NoopValueSource(this, this.__valueType, 'optional', this.__typeAdapter)
    }
    asRequiredInOptionalObject(): any {
        return new NoopValueSource(this, this.__valueType, 'requiredInOptionalObject', this.__typeAdapter)
    }
    // SqlComparator0
    isNull(): any {
        return condition(new SqlOperationIsNullValueSource('_isNull', this, 'boolean', 'required', this.__typeAdapter))
    }
    isNotNull(): any {
        return condition(new SqlOperationIsNullValueSource('_isNotNull', this, 'boolean', 'required', this.__typeAdapter))
    }
    // SqlComparator1
    equalsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_equals', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    equals(value: any): any {
        return condition(new SqlOperation1ValueSource('_equals', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEqualsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notEquals', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEquals(value: any): any {
        return condition(new SqlOperation1ValueSource('_notEquals', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    isIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_is', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    is(value: any): any {
        return condition(new SqlOperation1NotOptionalValueSource('_is', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    isNotIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_isNot', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    isNot(value: any): any {
        return condition(new SqlOperation1NotOptionalValueSource('_isNot', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    asString(): any { // test function
        return this
    }
    equalsInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_equalsInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    equalsInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_equalsInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEqualsInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notEqualsInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEqualsInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_notEqualsInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use lessThanIfValue method instead */
    smallerIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_lessThan', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use lessThan method instead */
    smaller(value: any): any {
        return condition(new SqlOperation1ValueSource('_lessThan', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use greaterThanIfValue method instead */
    largerIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_greaterThan', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use greaterThan method instead */
    larger(value: any): any {
        return condition(new SqlOperation1ValueSource('_greaterThan', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use lessOrEqualsIfValue method instead */
    smallAsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_lessOrEquals', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use lessOrEquals method instead */
    smallAs(value: any): any {
        return condition(new SqlOperation1ValueSource('_lessOrEquals', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use greaterOrEqualsIfValue method instead */
    largeAsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_greaterOrEquals', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use greaterOrEquals method instead */
    largeAs(value: any): any {
        return condition(new SqlOperation1ValueSource('_greaterOrEquals', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    lessThanIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_lessThan', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    lessThan(value: any): any {
        return condition(new SqlOperation1ValueSource('_lessThan', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    greaterThanIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_greaterThan', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    greaterThan(value: any): any {
        return condition(new SqlOperation1ValueSource('_greaterThan', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    lessOrEqualsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_lessOrEquals', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    lessOrEquals(value: any): any {
        return condition(new SqlOperation1ValueSource('_lessOrEquals', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    greaterOrEqualsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_greaterOrEquals', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    greaterOrEquals(value: any): any {
        return condition(new SqlOperation1ValueSource('_greaterOrEquals', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    inIfValue(value: any): any {
        return condition(new SqlOperationInValueSourceIfValueOrNoop('_in', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    in(value: any): any {
        return condition(new SqlOperationInValueSource('_in', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notInIfValue(value: any): any {
        return condition(new SqlOperationInValueSourceIfValueOrNoop('_notIn', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notIn(value: any): any {
        return condition(new SqlOperationInValueSource('_notIn', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    inN(...value: any[]): any {
        return condition(new SqlOperationInValueSource('_in', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notInN(...value: any[]): any {
        return condition(new SqlOperationInValueSource('_notIn', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    likeIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_like', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    like(value: any): any {
        return condition(new SqlOperation1ValueSource('_like', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notLikeIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notLike', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notLike(value: any): any {
        return condition(new SqlOperation1ValueSource('_notLike', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    likeInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_likeInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    likeInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_likeInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notLikeInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notLikeInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notLikeInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_notLikeInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    startsWithIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_startsWith', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    startsWith(value: any): any {
        return condition(new SqlOperation1ValueSource('_startsWith', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notStartsWithIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notStartsWith', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notStartsWith(value: any): any {
        return condition(new SqlOperation1ValueSource('_notStartsWith', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    endsWithIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_endsWith', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    endsWith(value: any): any {
        return condition(new SqlOperation1ValueSource('_endsWith', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEndsWithIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notEndsWith', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEndsWith(value: any): any {
        return condition(new SqlOperation1ValueSource('_notEndsWith', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    startsWithInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_startsWithInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    startsWithInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_startsWithInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notStartsWithInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notStartsWithInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notStartsWithInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_notStartsWithInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    endsWithInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_endsWithInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    endsWithInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_endsWithInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEndsWithInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notEndsWithInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEndsWithInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_notEndsWithInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    containsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_contains', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    contains(value: any): any {
        return condition(new SqlOperation1ValueSource('_contains', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notContainsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notContains', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notContains(value: any): any {
        return condition(new SqlOperation1ValueSource('_notContains', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    containsInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_containsInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    containsInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_containsInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notContainsInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notContainsInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notContainsInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_notContainsInsensitive', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    // SqlComparator2
    between(value: any, value2: any): any {
        return condition(new SqlOperation2ValueSource('_between', this, value, value2, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notBetween(value: any, value2: any): any {
        return condition(new SqlOperation2ValueSource('_notBetween', this, value, value2, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    // SqlFunctionStatic: never used here
    // SqlFunction0
    // Boolean
    negate(): any {
        return condition(new SqlOperation0ValueSource('_negate', this, 'boolean', this.__optionalType, this.__typeAdapter))
    }
    trueWhenNoValue(): any {
        const result = new BooleanValueWhenNoValueValueSource('_true', this, 'boolean', this.__optionalType, this.__typeAdapter)
        result.__isBooleanForCondition = this.__isBooleanForCondition
        return result
    }
    falseWhenNoValue(): any {
        const result = new BooleanValueWhenNoValueValueSource('_false', this, 'boolean', this.__optionalType, this.__typeAdapter)
        result.__isBooleanForCondition = this.__isBooleanForCondition
        return result
    }
    // String
    toLowerCase(): any {
        return new SqlOperation0ValueSource('_toLowerCase', this, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    /** @deprecated use toLowerCase method instead */
    lower(): any {
        return new SqlOperation0ValueSource('_toLowerCase', this, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    toUpperCase(): any {
        return new SqlOperation0ValueSource('_toUpperCase', this, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    /** @deprecated use toUpperCase method instead */
    upper(): any {
        return new SqlOperation0ValueSource('_toUpperCase', this, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    length(): any {
        return new SqlOperation0ValueSource('_length', this, 'int', this.__optionalType, this.__typeAdapter)
    }
    trim(): any {
        return new SqlOperation0ValueSource('_trim', this, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    trimLeft(): any {
        return new SqlOperation0ValueSource('_trimLeft', this, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    /** @deprecated use trimLeft method instead */
    ltrim(): any {
        return new SqlOperation0ValueSource('_trimLeft', this, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    trimRight(): any {
        return new SqlOperation0ValueSource('_trimRight', this, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    /** @deprecated use trimRight method instead */
    rtrim(): any {
        return new SqlOperation0ValueSource('_trimRight', this, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    reverse(): any {
        return new SqlOperation0ValueSource('_reverse', this, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    // Number functions
    asDouble(): any {
        return new SqlOperation0ValueSource('_asDouble', this, 'double', this.__optionalType, this.__typeAdapter)
    }
    asStringDouble(): any {
        return new SqlOperation0ValueSource('_asDouble', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
    }
    asInt(): any { // test function
        if (this.__valueType === 'double') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return new SqlOperation0ValueSource('_round', this, 'int', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return new SqlOperation0ValueSource('_round', this, 'int', this.__optionalType, this.__typeAdapter)
        } 
        return new NoopValueSource(this, 'int', this.__optionalType, this.__typeAdapter)
    }
    asStringInt(): any {
        if (this.__valueType === 'double') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return new SqlOperation0ValueSource('_round', this, 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return new SqlOperation0ValueSource('_round', this, 'stringInt', this.__optionalType, this.__typeAdapter)
        } 
        return new NoopValueSource(this, 'stringInt', this.__optionalType, this.__typeAdapter)
    }
    asBigint(): any {
        if (this.__valueType === 'double') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return new SqlOperation0ValueSource('_round', this, 'bigint', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return new SqlOperation0ValueSource('_round', this, 'bigint', this.__optionalType, this.__typeAdapter)
        } 
        return new NoopValueSource(this, 'bigint', this.__optionalType, this.__typeAdapter)
    }
    abs(): any {
        return new SqlOperation0ValueSource('_abs', this, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    ceil(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_ceil', this, 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_ceil', this, 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'bigint') {
            return new SqlOperation0ValueSource('_ceil', this, 'bigint', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_ceil', this, 'int', this.__optionalType, this.__typeAdapter)
        }
    }
    floor(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_floor', this, 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_floor', this, 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'bigint') {
            return new SqlOperation0ValueSource('_floor', this, 'bigint', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_floor', this, 'int', this.__optionalType, this.__typeAdapter)
        }
    }
    round(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_round', this, 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_round', this, 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'bigint') {
            return new SqlOperation0ValueSource('_round', this, 'bigint', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_round', this, 'int', this.__optionalType, this.__typeAdapter)
        }
    }
    exp(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_exp', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_exp', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_exp', this, 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    ln(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_ln', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_ln', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_ln', this, 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    log10(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_log10', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_log10', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_log10', this, 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    sqrt(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_sqrt', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_sqrt', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_sqrt', this, 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    cbrt(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_cbrt', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_cbrt', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_cbrt', this, 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    sign(): any {
        return new SqlOperation0ValueSource('_sign', this, 'int', this.__optionalType, this.__typeAdapter)
    }
    // Trigonometric Functions
    acos(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_acos', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_acos', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_acos', this, 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    asin(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_asin', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_asin', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_asin', this, 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    atan(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_atan', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_atan', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_atan', this, 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    cos(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_cos', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_cos', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_cos', this, 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    cot(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_cot', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_cot', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_cot', this, 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    sin(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_sin', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_sin', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_sin', this, 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    tan(): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation0ValueSource('_tan', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation0ValueSource('_tan', this, 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_tan', this, 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    // Date & Time Functions
    getDate(): any {
        return new SqlOperation0ValueSource('_getDate', this, 'int', this.__optionalType, this.__typeAdapter)
    }
    getTime(): any {
        return new SqlOperation0ValueSource('_getTime', this, 'int', this.__optionalType, this.__typeAdapter)
    }
    getFullYear(): any {
        return new SqlOperation0ValueSource('_getFullYear', this, 'int', this.__optionalType, this.__typeAdapter)
    }
    getMonth(): any {
        return new SqlOperation0ValueSource('_getMonth', this, 'int', this.__optionalType, this.__typeAdapter)
    }
    getDay(): any {
        return new SqlOperation0ValueSource('_getDay', this, 'int', this.__optionalType, this.__typeAdapter)
    }
    getHours(): any {
        return new SqlOperation0ValueSource('_getHours', this, 'int', this.__optionalType, this.__typeAdapter)
    }
    getMinutes(): any {
        return new SqlOperation0ValueSource('_getMinutes', this, 'int', this.__optionalType, this.__typeAdapter)
    }
    getSeconds(): any {
        return new SqlOperation0ValueSource('_getSeconds', this, 'int', this.__optionalType, this.__typeAdapter)
    }
    getMilliseconds(): any {
        return new SqlOperation0ValueSource('_getMilliseconds', this, 'int', this.__optionalType, this.__typeAdapter)
    }
    // SqlFunction1
    valueWhenNull(value: any): any {
        return new SqlOperationValueWhenNullValueSource(this, value, this.__valueType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    and(value: any): any {
        return condition(new SqlOperation1ValueSource('_and', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    or(value: any): any {
        return condition(new SqlOperation1ValueSource('_or', this, value, 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    // Trigonometric Functions
    atan2(value: any): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation1ValueSource('_atan2', this, value, 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation1ValueSource('_atan2', this, value, 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_atan2', this, value, 'double', getOptionalType2(this, value), getTypeAdapter2(this, value))
        }
    }
    // String Functions
    concat(value: any): any {
        return new SqlOperation1ValueSource('_concat', this, value, this.__valueType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    concatIfValue(value: any): any {
        return new SqlOperation1ValueSourceIfValueOrIgnore('_concat', this, value, this.__valueType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    substrToEnd(start: any): any {
        return new SqlOperation1ValueSource('_substrToEnd', this, start, this.__valueType, getOptionalType2(this, start), getTypeAdapter2(this, start))
    }
    substringToEnd(start: any): any {
        return new SqlOperation1ValueSource('_substringToEnd', this, start, this.__valueType, getOptionalType2(this, start), getTypeAdapter2(this, start))
    }
    // Number
    power(value: any): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation1ValueSource('_power', this, value, 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation1ValueSource('_power', this, value, 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_power', this, value, 'double', getOptionalType2(this, value), getTypeAdapter2(this, value))
        }
    }
    logn(value: any): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation1ValueSource('_logn', this, value, 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation1ValueSource('_logn', this, value, 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_logn', this, value, 'double', getOptionalType2(this, value), getTypeAdapter2(this, value))
        }
    }
    roundn(value: any): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation1ValueSource('_roundn', this, value, 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation1ValueSource('_roundn', this, value, 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_roundn', this, value, 'double', getOptionalType2(this, value), getTypeAdapter2(this, value))
        }
    }
    minValue(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_minValue')
    }
    maxValue(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_maxValue')
    }
    // Number operators
    add(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_add')
    }
    substract(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_substract')
    }
    multiply(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_multiply')
    }
    divide(value: any): any {
        if (this.__valueType === 'stringInt') {
            return new SqlOperation1ValueSource('_divide', this, value, 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else if (this.__valueType === 'stringDouble') {
            return new SqlOperation1ValueSource('_divide', this, value, 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_divide', this, value, 'double', getOptionalType2(this, value), getTypeAdapter2(this, value))
        }
    }
    modulo(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_modulo')
    }
    /** @deprecated use modulo method instead */
    mod(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_modulo')
    }
    // SqlFunction2
    substr(start: any, count: any): any {
        return new SqlOperation2ValueSource('_substr', this, start, count, this.__valueType, getOptionalType3(this, start, count), getTypeAdapter3(this, start, count))
    }
    substring(start: any, end: any): any {
        return new SqlOperation2ValueSource('_substring', this, start, end, this.__valueType, getOptionalType3(this, start, end), getTypeAdapter3(this, start, end))
    }
    /** @deprecated use replaceAllIfValue method instead */
    replaceIfValue(findString: any, replaceWith: any): any {
        return new SqlOperation2ValueSourceIfValueOrIgnore('_replaceAll', this, findString, replaceWith, this.__valueType, getOptionalType3(this, findString, replaceWith), getTypeAdapter3(this, findString, replaceWith))
    }
    /** @deprecated use replaceAll method instead */
    replace(findString: any, replaceWith: any): any {
        return new SqlOperation2ValueSource('_replaceAll', this, findString, replaceWith, this.__valueType, getOptionalType3(this, findString, replaceWith), getTypeAdapter3(this, findString, replaceWith))
    }
    replaceAllIfValue(findString: any, replaceWith: any): any {
        return new SqlOperation2ValueSourceIfValueOrIgnore('_replaceAll', this, findString, replaceWith, this.__valueType, getOptionalType3(this, findString, replaceWith), getTypeAdapter3(this, findString, replaceWith))
    }
    replaceAll(findString: any, replaceWith: any): any {
        return new SqlOperation2ValueSource('_replaceAll', this, findString, replaceWith, this.__valueType, getOptionalType3(this, findString, replaceWith), getTypeAdapter3(this, findString, replaceWith))
    }
}

export class SqlOperationStatic0ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof SqlOperationStatic0

    constructor(operation: keyof SqlOperationStatic0, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__operation = operation
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params)
    }
}

export class SqlOperationStaticBooleanValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof SqlOperationStatic0

    constructor(operation: '_true' | '_false') {
        super('boolean', 'required', undefined)
        this.__operation = operation
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        if (this.__operation === '_true') {
            return sqlBuilder._trueForCondition(params)
        } else {
            return sqlBuilder._falseForCondition(params)
        }
    }
}

export class BooleanValueWhenNoValueValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: '_true' | '_false'

    constructor(operation: '_true' | '_false', valueSource: ValueSourceImpl, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        const sql = this.__valueSource.__toSql(sqlBuilder, params)
        if (sql) {
            return sql
        }

        // No value
        return sqlBuilder[this.__operation](params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        const sql = this.__valueSource.__toSql(sqlBuilder, params)
        if (sql) {
            return sql
        }

        // No value
        if (this.__operation === '_true') {
            return sqlBuilder._trueForCondition(params)
        } else {
            return sqlBuilder._falseForCondition(params)
        }
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues()
    }
}

export class SqlOperationStatic1ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof SqlOperationStatic1
    __value: any

    constructor(operation: keyof SqlOperationStatic1, value: any, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__value, this.__valueType, this.__typeAdapter)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        __addWiths(this.__value, withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        __registerTableOrView(this.__value, requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        __registerRequiredColumn(this.__value, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return __getOldValues(this.__value)
    }
}

export class SqlOperationConstValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof SqlOperationStatic1
    __value: any

    constructor(value: any, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__operation = '_const'
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._const(params, this.__value, this.__valueType, this.__typeAdapter)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._constForCondition(params, this.__value, this.__valueType, this.__typeAdapter)
    }
    isConstValue(): boolean {
        return true
    }
    getConstValue(): any {
        return this.__value
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        __addWiths(this.__value, withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        __registerTableOrView(this.__value, requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        __registerRequiredColumn(this.__value, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return __getOldValues(this.__value)
    }
}

export class SqlOperation0ValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlFunction0

    constructor(operation: keyof SqlFunction0, valueSource: ValueSourceImpl, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues()
    }
}

export class SqlOperationIsNullValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlComparator0

    constructor(operation: keyof SqlComparator0, valueSource: ValueSourceImpl, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues()
    }
}

export class SqlOperation1ValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any

    constructor(operation: keyof SqlOperation1, valueSource: ValueSourceImpl, value: any, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(withs)
        __addWiths(this.__value, withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(requiredTablesOrViews)
        __registerTableOrView(this.__value, requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues() || __getOldValues(this.__value)
    }
}

export class SqlOperationInValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: '_in' | '_notIn'
    __value: any

    constructor(operation: '_in' | '_notIn', valueSource: ValueSourceImpl, value: any, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(withs)
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __addWiths(values[i], withs)
            }
        } else {
            __addWiths(values, withs)
        }
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(requiredTablesOrViews)
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerTableOrView(values[i], requiredTablesOrViews)
            }
        } else {
            __registerTableOrView(values, requiredTablesOrViews)
        }
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerRequiredColumn(values[i], requiredColumns, onlyForTablesOrViews)
            }
        } else {
            __registerRequiredColumn(values, requiredColumns, onlyForTablesOrViews)
        }
    }
    __getOldValues(): ITableOrView<any> | undefined {
        let result = this.__valueSource.__getOldValues()
        if (result) {
            return result
        }
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                result = __getOldValues(values[i])
                if (result) {
                    return result
                }
            }
        } else {
            return __getOldValues(values)
        }
        return undefined
    }
}

export class SqlOperationValueWhenNullValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any

    constructor(valueSource: ValueSourceImpl, value: any, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = '_valueWhenNull'
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(withs)
        __addWiths(this.__value, withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(requiredTablesOrViews)
        __registerTableOrView(this.__value, requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues() || __getOldValues(this.__value)
    }
}

export class SqlOperation1NotOptionalValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any

    constructor(operation: keyof SqlOperation1, valueSource: ValueSourceImpl, value: any, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(withs)
        __addWiths(this.__value, withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(requiredTablesOrViews)
        __registerTableOrView(this.__value, requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues() || __getOldValues(this.__value)
    }
}

export class SqlOperation1ValueSourceIfValueOrNoop extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any

    constructor(operation: keyof SqlOperation1, valueSource: ValueSourceImpl, value: any, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        if (!sqlBuilder._isValue(this.__value)) {
            return ''
        }
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(withs)
        __addWiths(this.__value, withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(requiredTablesOrViews)
        __registerTableOrView(this.__value, requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues() || __getOldValues(this.__value)
    }
}

export class SqlOperationInValueSourceIfValueOrNoop extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: '_in' | '_notIn'
    __value: any

    constructor(operation: '_in' | '_notIn', valueSource: ValueSourceImpl, value: any, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        if (!sqlBuilder._isValue(this.__value)) {
            return ''
        }
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(withs)
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __addWiths(values[i], withs)
            }
        } else {
            __addWiths(values, withs)
        }
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(requiredTablesOrViews)
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerTableOrView(values[i], requiredTablesOrViews)
            }
        } else {
            __registerTableOrView(values, requiredTablesOrViews)
        }
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerRequiredColumn(values[i], requiredColumns, onlyForTablesOrViews)
            }
        } else {
            __registerRequiredColumn(values, requiredColumns, onlyForTablesOrViews)
        }
    }
    __getOldValues(): ITableOrView<any> | undefined {
        let result = this.__valueSource.__getOldValues()
        if (result) {
            return result
        }
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                result = __getOldValues(values[i])
                if (result) {
                    return result
                }
            }
        } else {
            return __getOldValues(values)
        }
        return undefined
    }
}

export class SqlOperationValueSourceIfValueAlwaysNoop extends ValueSourceImpl {
    
    constructor() {
        super('', 'required', undefined)
    }
    __toSql(_sqlBuilder: SqlBuilder, _params: any[]): string {
        return ''
    }
}


export class SqlOperation1ValueSourceIfValueOrIgnore extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any

    constructor(operation: keyof SqlOperation1, valueSource: ValueSourceImpl, value: any, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        if (!sqlBuilder._isValue(this.__value)) {
            return this.__valueSource.__toSql(sqlBuilder, params)
        }
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(withs)
        __addWiths(this.__value, withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(requiredTablesOrViews)
        __registerTableOrView(this.__value, requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues() || __getOldValues(this.__value)
    }
}

export class SqlOperation2ValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation2
    __value: any
    __value2: any

    constructor(operation: keyof SqlOperation2, valueSource: ValueSourceImpl, value: any, value2: any, valueType: string, optionalType: OptionalType, typeAdapter?: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
        this.__value2 = value2
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__value2, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(withs)
        __addWiths(this.__value, withs)
        __addWiths(this.__value2, withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(requiredTablesOrViews)
        __registerTableOrView(this.__value, requiredTablesOrViews)
        __registerTableOrView(this.__value2, requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value2, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues() || __getOldValues(this.__value) || __getOldValues(this.__value2)
    }
}

export class SqlOperation2ValueSourceIfValueOrIgnore extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation2
    __value: any
    __value2: any

    constructor(operation: keyof SqlOperation2, valueSource: ValueSourceImpl, value: any, value2: any, valueType: string, optionalType: OptionalType, typeAdapter?: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
        this.__value2 = value2
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        if (!sqlBuilder._isValue(this.__value)) {
            return this.__valueSource.__toSql(sqlBuilder, params)
        }
        if (!sqlBuilder._isValue(this.__value2)) {
            return this.__valueSource.__toSql(sqlBuilder, params)
        }
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__value2, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(withs)
        __addWiths(this.__value, withs)
        __addWiths(this.__value2, withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(requiredTablesOrViews)
        __registerTableOrView(this.__value, requiredTablesOrViews)
        __registerTableOrView(this.__value2, requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value2, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues() || __getOldValues(this.__value) || __getOldValues(this.__value2)
    }
}

export class NoopValueSource extends ValueSourceImpl {
    __valueSource: ValueSourceImpl
    constructor(valueSource: ValueSourceImpl, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__valueSource.__toSql(sqlBuilder, params)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues()
    }
}

export class SequenceValueSource extends ValueSourceImpl {
    __operation: keyof SqlSequenceOperation
    __sequenceName: string
    constructor(operation: keyof SqlSequenceOperation, sequenceName: string, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__operation = operation
        this.__sequenceName = sequenceName
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__sequenceName)
    }
}

export class FragmentValueSource extends ValueSourceImpl {
    __operation: keyof SqlFragmentOperation = '_fragment' // Needed to detect if parenthesis is required
    __sql: TemplateStringsArray
    __sqlParams: AnyValueSource[]

    constructor(sql: TemplateStringsArray, sqlParams: AnyValueSource[], valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__sql = sql
        this.__sqlParams = sqlParams
        if (valueType === 'boolean') {
            this.__isBooleanForCondition = true
        }
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._fragment(params, this.__sql, this.__sqlParams)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        const sqlParams = this.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            value.__addWiths(withs)
        }
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        const sqlParams = this.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            value.__registerTableOrView(requiredTablesOrViews)
        }
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        const sqlParams = this.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            value.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
        }
    }
    __getOldValues(): ITableOrView<any> | undefined {
        const sqlParams = this.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            const result = value.__getOldValues()
            if (result) {
                return result
            }
        }
        return undefined
    }
}

export class AggregateFunctions0ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof AggregateFunctions0

    constructor(operation: keyof AggregateFunctions0, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__operation = operation
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params)
    }
}

export class AggregateFunctions1ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof AggregateFunctions1
    __value: any

    constructor(operation: keyof AggregateFunctions1, value: any, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__value)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        __addWiths(this.__value, withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        __registerTableOrView(this.__value, requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        __registerRequiredColumn(this.__value, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return __getOldValues(this.__value)
    }
}

export class AggregateFunctions1or2ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof AggregateFunctions1or2
    __value: any
    __separator: string | undefined

    constructor(operation: keyof AggregateFunctions1or2, separator: string | undefined, value: any, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueType, optionalType, typeAdapter)
        this.__operation = operation
        this.__separator = separator
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__separator, this.__value)
    }
    __addWiths(withs: Array<IWithView<any>>): void {
        __addWiths(this.__value, withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        __registerTableOrView(this.__value, requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        __registerRequiredColumn(this.__value, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return __getOldValues(this.__value)
    }
}

function mergeOptional(op1: OptionalType, op2: OptionalType): OptionalType {
    if (op1 === 'required') {
        return op2
    } else if (op1 === 'requiredInOptionalObject') {
        if (op2 === 'required') {
            return 'requiredInOptionalObject'
        } else {
            return op2
        }
    } else if (op1 === 'originallyRequired') {
        if (op2 === 'required') {
            return 'originallyRequired'
        } else {
            return op2
        }
    } else {
        return 'optional'
    }
}

function getOptionalType2(a: ValueSourceImpl, b: any): OptionalType {
    if (b instanceof ValueSourceImpl) {
        return mergeOptional(a.__optionalType, b.__optionalType)
    }
    return a.__optionalType
}


function getOptionalType3(a: ValueSourceImpl, b: any, c: any): OptionalType {
    let result = a.__optionalType
    if (b instanceof ValueSourceImpl && b.__typeAdapter) {
        result = mergeOptional(result, b.__optionalType)
    }
    if (c instanceof ValueSourceImpl) {
        result = mergeOptional(result, c.__optionalType)
    }
    return result
}

function getTypeAdapter2(a: ValueSourceImpl, b: any): TypeAdapter | undefined {
    if (a.__typeAdapter) {
        return a.__typeAdapter
    }
    if (b instanceof ValueSourceImpl) {
        return b.__typeAdapter
    }
    return undefined
}


function getTypeAdapter3(a: ValueSourceImpl, b: any, c: any): TypeAdapter | undefined {
    if (a.__typeAdapter) {
        return a.__typeAdapter
    }
    if (b instanceof ValueSourceImpl && b.__typeAdapter) {
        return b.__typeAdapter
    }
    if (c instanceof ValueSourceImpl) {
        return c.__typeAdapter
    }
    return undefined
}

function createSqlOperation1ofOverloadedNumber(thiz: ValueSourceImpl, value: any, operation: keyof SqlOperation1) {
    if (thiz.__valueType === 'double' || thiz.__valueType === 'stringDouble' || thiz.__valueType === 'bigint') {
        return new SqlOperation1ValueSource(operation, thiz, value, thiz.__valueType, getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
    }
    if (thiz.__valueType === 'stringInt') {
        if (value instanceof ValueSourceImpl) {
            if (value.__valueType === 'int' || value.__valueType === 'stringInt') {
                return new SqlOperation1ValueSource(operation, thiz, value, 'stringInt', getOptionalType2(thiz, value), thiz.__typeAdapter)
            } else {
                return new SqlOperation1ValueSource(operation, thiz, value, 'stringDouble', getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
            }
        }
        if (Number.isInteger(value)) {
            return new SqlOperation1ValueSource(operation, thiz, value, 'stringInt', getOptionalType2(thiz, value), thiz.__typeAdapter)
        } else {
            return new SqlOperation1ValueSource(operation, thiz, value, 'stringDouble', getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
        }
    } else {
        if (value instanceof ValueSourceImpl) {
            if (value.__valueType === 'int') {
                return new SqlOperation1ValueSource(operation, thiz, value, 'int', getOptionalType2(thiz, value), thiz.__typeAdapter)
            } else if (value.__valueType === 'stringInt') {
                return new SqlOperation1ValueSource(operation, thiz, value, 'stringInt', getOptionalType2(thiz, value), thiz.__typeAdapter)
            } else if (value.__valueType === 'stringDouble') {
                return new SqlOperation1ValueSource(operation, thiz, value, 'stringDouble', getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
            } else {
                return new SqlOperation1ValueSource(operation, thiz, value, 'double', getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
            }
        }
        if (Number.isInteger(value)) {
            return new SqlOperation1ValueSource(operation, thiz, value, 'int', getOptionalType2(thiz, value), thiz.__typeAdapter)
        } else {
            return new SqlOperation1ValueSource(operation, thiz, value, 'double', getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
        }
    }
}

function condition(valueSource: ValueSourceImpl): ValueSourceImpl {
    valueSource.__isBooleanForCondition = true
    return valueSource
}

export class TableOrViewRawFragmentValueSource implements ValueSource<any, any, any, any>, __ValueSourcePrivate, ToSql {
    [tableOrView]: any
    [valueType_]: any
    [optionalType_]: any
    [optionalType]: any
    [valueSourceType]: "ValueSource"
    [database]: any
    [valueSourceTypeName]: any

    [isValueSourceObject]: true = true
    __valueType: string = ''
    __optionalType: OptionalType = 'required'
    __typeAdapter?: TypeAdapter | undefined
    __tableOrView: ITableOrView<any>
    __operation: '_rawFragmentTableName' | '_rawFragmentTableAlias'

    constructor(_tableOrView: ITableOrView<any>, operation: '_rawFragmentTableName' | '_rawFragmentTableAlias') {
        this.__tableOrView = _tableOrView
        this.__operation = operation
    }

    isConstValue(): boolean {
        return false
    }
    getConstValue(): any {
        throw new Error('You are trying to access to the const value when the expression is not const')
    }
    __isBooleanForCondition?: boolean | undefined
    __addWiths(_withs: IWithView<any>[]): void {
        // Do nothing
    }
    __registerTableOrView(_requiredTablesOrViews: Set<ITableOrView<any>>): void {
        // Do nothing
    }
    __registerRequiredColumn(_requiredColumns: Set<Column>, _onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        // Do nothing
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return undefined
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__tableOrView)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__toSql(sqlBuilder, params)
    }
}

export type InlineSelectData = SelectData & HasAddWiths

export class InlineSelectValueSource extends ValueSourceImpl implements HasOperation {
    __operation = '_inlineSelectAsValue' as const
    __selectData: InlineSelectData

    constructor(selectData: InlineSelectData) {
        super(...valueSourceInitializationForInlineSelect(selectData))
        this.__selectData = selectData
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._inlineSelectAsValue(this.__selectData, params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._inlineSelectAsValueForCondition(this.__selectData, params)
    }
    __addWiths(withs: IWithView<any>[]): void {
        this.__selectData.__addWiths(withs)
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__selectData.__registerTableOrView(requiredTablesOrViews)
    }
    __registerRequiredColumn(requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__selectData.__registerRequiredColumn(requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(): ITableOrView<any> | undefined {
        return this.__selectData.__getOldValues()
    }
}

function valueSourceInitializationForInlineSelect(selectData: SelectData) {
    const result = selectData.__columns['result']
    if (!isValueSource(result)) {
        throw new Error('Illegal state: result column for a select one column not found')
    }
    const valueSourcePrivate = __getValueSourcePrivate(result)
    let typeAdapter = valueSourcePrivate.__typeAdapter
    if (typeAdapter instanceof CustomBooleanTypeAdapter) {
        // Avoid treat the column as a custom boolean
        typeAdapter = new ProxyTypeAdapter(typeAdapter)
    }
    return [valueSourcePrivate.__valueType, valueSourcePrivate.__optionalType, typeAdapter] as const
}