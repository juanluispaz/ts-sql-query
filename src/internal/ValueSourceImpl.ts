import { SqlBuilder, SqlOperationStatic0, SqlOperationStatic1, SqlOperation1, SqlOperation2, ToSql, HasOperation, SqlSequenceOperation, SqlFragmentOperation, AggregateFunctions0, AggregateFunctions1, AggregateFunctions1or2, SqlFunction0, SqlComparator0, SelectData, hasToSql } from "../sqlBuilders/SqlBuilder"
import { BooleanValueSource, IntValueSource, DoubleValueSource, NumberValueSource, StringValueSource, TypeSafeStringValueSource, IValueSource, NullableValueSource, LocalDateValueSource, LocalTimeValueSource, LocalDateTimeValueSource, DateValueSource, TimeValueSource, DateTimeValueSource, StringIntValueSource, StringDoubleValueSource, StringNumberValueSource, __ValueSourcePrivate, IfValueSource, BigintValueSource, TypeSafeBigintValueSource, isValueSource, AlwaysIfValueSource, IAnyBooleanValueSource, AnyValueSource, ValueSource, OptionalType, IAggregatedArrayValueSource, AggregatedArrayValueSource, __AggregatedArrayColumns, __AggregatedArrayMode, UuidValueSource, TypeSafeUuidValueSource, AggregatedArrayValueSourceProjectableAsNullable, ValueKind } from "../expressions/values"
import { CustomBooleanTypeAdapter, TypeAdapter } from "../TypeAdapter"
import { HasAddWiths, HasIsValue, ITableOrView, IWithView, __getOldValues, __getTableOrViewPrivate, __getValuesForInsert, __isAllowed, __registerRequiredColumn, __registerTableOrView } from "../utils/ITableOrView"
import { database, tableOrView, valueSourceType, valueType as valueType_, optionalType as optionalType_ , booleanValueSourceType, comparableValueSourceType, dateTimeValueSourceType, dateValueSourceType, doubleValueSourceType, equalableValueSourceType, intValueSourceType, localDateTimeValueSourceType, localDateValueSourceType, localTimeValueSourceType, nullableValueSourceType, numberValueSourceType, stringDoubleValueSourceType, stringIntValueSourceType, stringNumberValueSourceType, stringValueSourceType, timeValueSourceType, typeSafeStringValueSourceType, ifValueSourceType, bigintValueSourceType, typeSafeBigintValueSourceType, valueSourceTypeName, anyBooleanValueSourceType, isValueSourceObject, aggregatedArrayValueSourceType, isSelectQueryObject, uuidValueSourceType, typeSafeUuidValueSourceType } from "../utils/symbols"
import { __addWiths } from "../utils/ITableOrView"
import { __getValueSourcePrivate } from "../expressions/values"
import { ProxyTypeAdapter } from "./ProxyTypeAdapter"
import { Column } from "../utils/Column"
import type { FragmentQueryBuilder } from "../queryBuilders/FragmentQueryBuilder"

export abstract class ValueSourceImpl implements IValueSource<any, any, any, any>, NullableValueSource<any, any, any, any>, BooleanValueSource<any, any>, IntValueSource<any, any>, StringIntValueSource<any, any>, DoubleValueSource<any, any>, StringDoubleValueSource<any, any>, NumberValueSource<any, any>, StringNumberValueSource<any, any>, BigintValueSource<any, any>, TypeSafeBigintValueSource<any, any>, StringValueSource<any, any>, TypeSafeStringValueSource<any, any>, LocalDateValueSource<any, any>, LocalTimeValueSource<any, any>, LocalDateTimeValueSource<any, any>, DateValueSource<any, any>, TimeValueSource<any, any>, DateTimeValueSource<any, any>, IfValueSource<any, any>, AlwaysIfValueSource<any, any>, IAnyBooleanValueSource<any, any>, IAggregatedArrayValueSource<any, any, any>, AggregatedArrayValueSource<any, any, any>, AggregatedArrayValueSourceProjectableAsNullable<any, any, any, any>, UuidValueSource<any, any>, TypeSafeUuidValueSource<any, any>, ToSql, __ValueSourcePrivate {
    [valueSourceType]!: 'ValueSource'
    [nullableValueSourceType]!: 'NullableValueSource'
    [equalableValueSourceType]!: 'EqualableValueSource'
    [comparableValueSourceType]!: 'ComparableValueSource'
    [booleanValueSourceType]!: 'BooleanValueSource'
    [ifValueSourceType]!: 'IfValueSource'
    [numberValueSourceType]!: 'NumberValueSource'
    [stringNumberValueSourceType]!: 'StringNumberValueSource'
    [intValueSourceType]!: 'IntValueSource'
    [doubleValueSourceType]!: 'DoubleValueSource'
    [bigintValueSourceType]!: 'BigintValueSource'
    [typeSafeBigintValueSourceType]!: 'TypeSafeBigintValueSource'
    [stringIntValueSourceType]!: 'StringIntValueSource'
    [stringDoubleValueSourceType]!: 'StringDoubleValueSource'
    [stringValueSourceType]!: 'StringValueSource'
    [typeSafeStringValueSourceType]!: 'TypeSafeStringValueSource'
    [dateValueSourceType]!: 'DateValueSource'
    [timeValueSourceType]!: 'TimeValueSource'
    [dateTimeValueSourceType]!: 'DateTimeValueSource'
    [localDateValueSourceType]!: 'LocalDateValueSource'
    [localTimeValueSourceType]!: 'LocalTimeValueSource'
    [localDateTimeValueSourceType]!: 'LocalDateTimeValueSource'
    [anyBooleanValueSourceType]!: 'AnyBooleanValueSource'
    [aggregatedArrayValueSourceType]!: 'AggregatedArrayValueSource'
    [uuidValueSourceType]!: 'UuidValueSource'
    [typeSafeUuidValueSourceType]!: 'TypeSafeUuidValueSource'
    [valueSourceTypeName]!: any

    [database]: any
    [tableOrView]: any
    [valueType_]: any
    [optionalType_]: any

    [isValueSourceObject]: true = true
    __valueKind: ValueKind
    __valueType: string
    __optionalType: OptionalType
    __typeAdapter?: TypeAdapter
    __isBooleanForCondition?: boolean
    __aggregatedArrayColumns?: __AggregatedArrayColumns | AnyValueSource
    __aggregatedArrayMode?: __AggregatedArrayMode
    __uuidString?: boolean

    constructor(valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined, aggregatedArrayColumns?: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode?: __AggregatedArrayMode, uuidString?: boolean) {
        this.__valueKind = valueKind
        this.__valueType = valueType
        this.__optionalType = optionalType
        this.__typeAdapter = typeAdapter
        if (aggregatedArrayColumns) {
            this.__aggregatedArrayColumns = aggregatedArrayColumns
            this.__aggregatedArrayMode = aggregatedArrayMode
        }
        if (uuidString) {
            this.__uuidString = uuidString
        }
    }
    abstract __toSql(sqlBuilder: SqlBuilder, params: any[]): string
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__toSql(sqlBuilder, params)
    }
    __addWiths(_sqlBuilder: HasIsValue, _withs: Array<IWithView<any>>): void {
        // Do nothing
    }
    __registerTableOrView(_sqlBuilder: HasIsValue, _requiredTablesOrViews: Set<ITableOrView<any>>): void {
        // Do nothing
    }
    __registerRequiredColumn(_sqlBuilder: HasIsValue, _requiredColumns: Set<Column>, _onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        // Do nothing
    }
    __getOldValues(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return undefined
    }
    __getValuesForInsert(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return undefined
    }
    __isAllowed(_sqlBuilder: HasIsValue): boolean {
        return true
    }
    isConstValue(): boolean {
        return false
    }
    getConstValue(): any {
        throw new Error('You are trying to access to the const value when the expression is not const')
    }
    allowWhen(when: boolean, error: string | Error): any {
        let result
        if (typeof error === 'string') {
            result = new AllowWhenValueSource(when, new Error(error), this)
        } else {
            result = new AllowWhenValueSource(when, error, this)
        }
        if (this.__uuidString) {
            result.__uuidString = this.__uuidString
        }
        return result
    }
    disallowWhen(when: boolean, error: string | Error): any {
        let result
        if (typeof error === 'string') {
            result = new AllowWhenValueSource(!when, new Error(error), this)
        } else {
            result = new AllowWhenValueSource(!when, error, this)
        }
        if (this.__uuidString) {
            result.__uuidString = this.__uuidString
        }
        return result
    }
    asOptional(): any {
        const result = new NoopValueSource(this, this.__valueKind, this.__valueType, 'optional', this.__typeAdapter)
        if (this.__uuidString) {
            result.__uuidString = this.__uuidString
        }
        return result
    }
    asRequiredInOptionalObject(): any {
        const result = new NoopValueSource(this, this.__valueKind, this.__valueType, 'requiredInOptionalObject', this.__typeAdapter)
        if (this.__aggregatedArrayColumns) {
            result.__aggregatedArrayColumns = this.__aggregatedArrayColumns
            result.__aggregatedArrayMode = this.__aggregatedArrayMode
        }
        if (this.__uuidString) {
            result.__uuidString = this.__uuidString
        }
        return result
    }
    useEmptyArrayForNoValue(): any {
        const result = new NoopValueSource(this, this.__valueKind, this.__valueType, 'required', this.__typeAdapter)
        if (this.__aggregatedArrayColumns) {
            result.__aggregatedArrayColumns = this.__aggregatedArrayColumns
            result.__aggregatedArrayMode = this.__aggregatedArrayMode
        }
        if (this.__uuidString) {
            result.__uuidString = this.__uuidString
        }
        return result
    }
    asOptionalNonEmptyArray(): any {
        const result = new NoopValueSource(this, this.__valueKind, this.__valueType, 'optional', this.__typeAdapter)
        if (this.__aggregatedArrayColumns) {
            result.__aggregatedArrayColumns = this.__aggregatedArrayColumns
            result.__aggregatedArrayMode = this.__aggregatedArrayMode
        }
        if (this.__uuidString) {
            result.__uuidString = this.__uuidString
        }
        return result
    }
    projectingOptionalValuesAsNullable(): any {
        return this
    }
    // SqlComparator0
    isNull(): any {
        return condition(new SqlOperationIsNullValueSource('_isNull', this, 'boolean', 'boolean', 'required', this.__typeAdapter))
    }
    isNotNull(): any {
        return condition(new SqlOperationIsNullValueSource('_isNotNull', this, 'boolean', 'boolean', 'required', this.__typeAdapter))
    }
    // SqlComparator1
    equalsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_equals', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    equals(value: any): any {
        return condition(new SqlOperation1ValueSource('_equals', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEqualsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notEquals', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEquals(value: any): any {
        return condition(new SqlOperation1ValueSource('_notEquals', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    isIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_is', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    is(value: any): any {
        return condition(new SqlOperation1NotOptionalValueSource('_is', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    isNotIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_isNot', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    isNot(value: any): any {
        return condition(new SqlOperation1NotOptionalValueSource('_isNot', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    asString(): any {
        const result = new SqlOperation0ValueSource('_asString', this, 'string', 'string', this.__optionalType, this.__typeAdapter)
        result.__uuidString = this.__valueKind === 'uuid'
        return result
    }
    onlyWhenOrNull(when: boolean): any {
        if (when) {
            return this
        } else {
            return new NullValueSource(this.__valueKind, this.__valueType, 'optional', this.__typeAdapter)
        }
    }
    ignoreWhenAsNull(when: boolean): any {
        if (when) {
            return new NullValueSource(this.__valueKind, this.__valueType, 'optional', this.__typeAdapter)
        } else {
            return this
        }
    }
    equalsInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_equalsInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    equalsInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_equalsInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEqualsInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notEqualsInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEqualsInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_notEqualsInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use lessThanIfValue method instead */
    smallerIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_lessThan', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use lessThan method instead */
    smaller(value: any): any {
        return condition(new SqlOperation1ValueSource('_lessThan', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use greaterThanIfValue method instead */
    largerIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_greaterThan', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use greaterThan method instead */
    larger(value: any): any {
        return condition(new SqlOperation1ValueSource('_greaterThan', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use lessOrEqualsIfValue method instead */
    smallAsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_lessOrEquals', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use lessOrEquals method instead */
    smallAs(value: any): any {
        return condition(new SqlOperation1ValueSource('_lessOrEquals', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use greaterOrEqualsIfValue method instead */
    largeAsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_greaterOrEquals', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /** @deprecated use greaterOrEquals method instead */
    largeAs(value: any): any {
        return condition(new SqlOperation1ValueSource('_greaterOrEquals', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    lessThanIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_lessThan', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    lessThan(value: any): any {
        return condition(new SqlOperation1ValueSource('_lessThan', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    greaterThanIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_greaterThan', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    greaterThan(value: any): any {
        return condition(new SqlOperation1ValueSource('_greaterThan', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    lessOrEqualsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_lessOrEquals', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    lessOrEquals(value: any): any {
        return condition(new SqlOperation1ValueSource('_lessOrEquals', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    greaterOrEqualsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_greaterOrEquals', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    greaterOrEquals(value: any): any {
        return condition(new SqlOperation1ValueSource('_greaterOrEquals', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    inIfValue(value: any): any {
        return condition(new SqlOperationInValueSourceIfValueOrNoop('_in', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    in(value: any): any {
        return condition(new SqlOperationInValueSource('_in', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notInIfValue(value: any): any {
        return condition(new SqlOperationInValueSourceIfValueOrNoop('_notIn', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notIn(value: any): any {
        return condition(new SqlOperationInValueSource('_notIn', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    inN(...value: any[]): any {
        return condition(new SqlOperationInValueSource('_in', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notInN(...value: any[]): any {
        return condition(new SqlOperationInValueSource('_notIn', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    likeIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_like', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    like(value: any): any {
        return condition(new SqlOperation1ValueSource('_like', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notLikeIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notLike', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notLike(value: any): any {
        return condition(new SqlOperation1ValueSource('_notLike', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    likeInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_likeInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    likeInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_likeInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notLikeInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notLikeInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notLikeInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_notLikeInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    startsWithIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_startsWith', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    startsWith(value: any): any {
        return condition(new SqlOperation1ValueSource('_startsWith', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notStartsWithIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notStartsWith', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notStartsWith(value: any): any {
        return condition(new SqlOperation1ValueSource('_notStartsWith', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    endsWithIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_endsWith', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    endsWith(value: any): any {
        return condition(new SqlOperation1ValueSource('_endsWith', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEndsWithIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notEndsWith', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEndsWith(value: any): any {
        return condition(new SqlOperation1ValueSource('_notEndsWith', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    startsWithInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_startsWithInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    startsWithInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_startsWithInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notStartsWithInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notStartsWithInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notStartsWithInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_notStartsWithInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    endsWithInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_endsWithInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    endsWithInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_endsWithInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEndsWithInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notEndsWithInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEndsWithInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_notEndsWithInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    containsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_contains', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    contains(value: any): any {
        return condition(new SqlOperation1ValueSource('_contains', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notContainsIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notContains', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notContains(value: any): any {
        return condition(new SqlOperation1ValueSource('_notContains', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    containsInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_containsInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    containsInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_containsInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notContainsInsensitiveIfValue(value: any): any {
        return condition(new SqlOperation1ValueSourceIfValueOrNoop('_notContainsInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notContainsInsensitive(value: any): any {
        return condition(new SqlOperation1ValueSource('_notContainsInsensitive', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    // SqlComparator2
    between(value: any, value2: any): any {
        return condition(new SqlOperation2ValueSource('_between', this, value, value2, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notBetween(value: any, value2: any): any {
        return condition(new SqlOperation2ValueSource('_notBetween', this, value, value2, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    // SqlFunctionStatic: never used here
    // SqlFunction0
    // Boolean
    negate(): any {
        return condition(new SqlOperation0ValueSource('_negate', this, 'boolean', 'boolean', this.__optionalType, this.__typeAdapter))
    }
    onlyWhen(condition: boolean): any {
        if (condition) {
            return this
        } else {
            return new SqlOperationValueSourceIfValueAlwaysNoop()
        }
    }
    ignoreWhen(condition: boolean): any {
        if (condition) {
            return new SqlOperationValueSourceIfValueAlwaysNoop()
        } else {
            return this
        }
    }
    trueWhenNoValue(): any {
        const result = new BooleanValueWhenNoValueValueSource('_true', this, 'boolean', 'boolean', this.__optionalType, this.__typeAdapter)
        result.__isBooleanForCondition = this.__isBooleanForCondition
        return result
    }
    falseWhenNoValue(): any {
        const result = new BooleanValueWhenNoValueValueSource('_false', this, 'boolean', 'boolean', this.__optionalType, this.__typeAdapter)
        result.__isBooleanForCondition = this.__isBooleanForCondition
        return result
    }
    valueWhenNoValue(value: any): any {
        if (value === true) {
            return this.trueWhenNoValue()
        }
        if (value === false) {
            return this.falseWhenNoValue()
        }
        
        const result = new ValueWhenNoValueValueSource(value, this, 'boolean', 'boolean', this.__optionalType, this.__typeAdapter)
        result.__isBooleanForCondition = this.__isBooleanForCondition
        return result
    }
    // String
    toLowerCase(): any {
        return new SqlOperation0ValueSource('_toLowerCase', this, this.__valueKind, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    /** @deprecated use toLowerCase method instead */
    lower(): any {
        return new SqlOperation0ValueSource('_toLowerCase', this, this.__valueKind, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    toUpperCase(): any {
        return new SqlOperation0ValueSource('_toUpperCase', this, this.__valueKind, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    /** @deprecated use toUpperCase method instead */
    upper(): any {
        return new SqlOperation0ValueSource('_toUpperCase', this, this.__valueKind, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    length(): any {
        return new SqlOperation0ValueSource('_length', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
    }
    trim(): any {
        return new SqlOperation0ValueSource('_trim', this, this.__valueKind, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    trimLeft(): any {
        return new SqlOperation0ValueSource('_trimLeft', this, this.__valueKind, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    /** @deprecated use trimLeft method instead */
    ltrim(): any {
        return new SqlOperation0ValueSource('_trimLeft', this, this.__valueKind, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    trimRight(): any {
        return new SqlOperation0ValueSource('_trimRight', this, this.__valueKind, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    /** @deprecated use trimRight method instead */
    rtrim(): any {
        return new SqlOperation0ValueSource('_trimRight', this, this.__valueKind, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    reverse(): any {
        return new SqlOperation0ValueSource('_reverse', this, this.__valueKind, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    // Number functions
    asDouble(): any {
        return new SqlOperation0ValueSource('_asDouble', this, 'double', 'double', this.__optionalType, this.__typeAdapter)
    }
    asStringDouble(): any {
        return new SqlOperation0ValueSource('_asDouble', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
    }
    asInt(): any { // test function
        if (this.__valueKind === 'double') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return new SqlOperation0ValueSource('_round', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return new SqlOperation0ValueSource('_round', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
        }
        return new NoopValueSource(this, 'int', 'int', this.__optionalType, this.__typeAdapter)
    }
    asStringInt(): any {
        if (this.__valueKind === 'double') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return new SqlOperation0ValueSource('_round', this, 'stringInt', 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return new SqlOperation0ValueSource('_round', this, 'stringInt', 'stringInt', this.__optionalType, this.__typeAdapter)
        }
        return new NoopValueSource(this, 'stringInt', 'stringInt', this.__optionalType, this.__typeAdapter)
    }
    asBigint(): any {
        if (this.__valueKind === 'double') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return new SqlOperation0ValueSource('_round', this, 'bigint', 'bigint', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return new SqlOperation0ValueSource('_round', this, 'bigint', 'bigint', this.__optionalType, this.__typeAdapter)
        }
        return new NoopValueSource(this, 'bigint', 'bigint', this.__optionalType, this.__typeAdapter)
    }
    abs(): any {
        return new SqlOperation0ValueSource('_abs', this, this.__valueKind, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
    ceil(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_ceil', this, 'stringInt', 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_ceil', this, 'stringInt', 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'bigint') {
            return new SqlOperation0ValueSource('_ceil', this, 'bigint', 'bigint', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_ceil', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
        }
    }
    floor(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_floor', this, 'stringInt', 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_floor', this, 'stringInt', 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'bigint') {
            return new SqlOperation0ValueSource('_floor', this, 'bigint', 'bigint', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_floor', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
        }
    }
    round(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_round', this, 'stringInt', 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_round', this, 'stringInt', 'stringInt', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'bigint') {
            return new SqlOperation0ValueSource('_round', this, 'bigint', 'bigint', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_round', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
        }
    }
    exp(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_exp', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_exp', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_exp', this, 'double', 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    ln(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_ln', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_ln', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_ln', this, 'double', 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    log10(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_log10', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_log10', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_log10', this, 'double', 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    sqrt(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_sqrt', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_sqrt', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_sqrt', this, 'double', 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    cbrt(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_cbrt', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_cbrt', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_cbrt', this, 'double', 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    sign(): any {
        return new SqlOperation0ValueSource('_sign', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
    }
    // Trigonometric Functions
    acos(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_acos', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_acos', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_acos', this, 'double', 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    asin(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_asin', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_asin', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_asin', this, 'double', 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    atan(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_atan', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_atan', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_atan', this, 'double', 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    cos(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_cos', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_cos', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_cos', this, 'double', 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    cot(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_cot', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_cot', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_cot', this, 'double', 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    sin(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_sin', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_sin', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_sin', this, 'double', 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    tan(): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation0ValueSource('_tan', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation0ValueSource('_tan', this, 'stringDouble', 'stringDouble', this.__optionalType, this.__typeAdapter)
        } else {
            return new SqlOperation0ValueSource('_tan', this, 'double', 'double', this.__optionalType, this.__typeAdapter)
        }
    }
    // Date & Time Functions
    getDate(): any {
        return new SqlOperation0ValueSource('_getDate', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
    }
    getTime(): any {
        return new SqlOperation0ValueSource('_getTime', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
    }
    getFullYear(): any {
        return new SqlOperation0ValueSource('_getFullYear', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
    }
    getMonth(): any {
        return new SqlOperation0ValueSource('_getMonth', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
    }
    getDay(): any {
        return new SqlOperation0ValueSource('_getDay', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
    }
    getHours(): any {
        return new SqlOperation0ValueSource('_getHours', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
    }
    getMinutes(): any {
        return new SqlOperation0ValueSource('_getMinutes', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
    }
    getSeconds(): any {
        return new SqlOperation0ValueSource('_getSeconds', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
    }
    getMilliseconds(): any {
        return new SqlOperation0ValueSource('_getMilliseconds', this, 'int', 'int', this.__optionalType, this.__typeAdapter)
    }
    // SqlFunction1
    valueWhenNull(value: any): any {
        return new SqlOperationValueWhenNullValueSource(this, value, this.__valueKind, this.__valueType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    nullIfValue(value: any): any {
        return new SqlOperation1ValueSource('_nullIfValue', this, value, this.__valueKind, this.__valueType, 'optional', getTypeAdapter2(this, value))
    }
    and(value: any): any {
        return condition(new SqlOperation1ValueSource('_and', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    or(value: any): any {
        return condition(new SqlOperation1ValueSource('_or', this, value, 'boolean', 'boolean', getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    // Trigonometric Functions
    atan2(value: any): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation1ValueSource('_atan2', this, value, 'stringDouble', 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation1ValueSource('_atan2', this, value, 'stringDouble', 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_atan2', this, value, 'double', 'double', getOptionalType2(this, value), getTypeAdapter2(this, value))
        }
    }
    // String Functions
    concat(value: any): any {
        return new SqlOperation1ValueSource('_concat', this, value, this.__valueKind, this.__valueType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    concatIfValue(value: any): any {
        return new SqlOperation1ValueSourceIfValueOrIgnore('_concat', this, value, this.__valueKind, this.__valueType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    substrToEnd(start: any): any {
        return new SqlOperation1ValueSource('_substrToEnd', this, start, this.__valueKind, this.__valueType, getOptionalType2(this, start), getTypeAdapter2(this, start))
    }
    substringToEnd(start: any): any {
        return new SqlOperation1ValueSource('_substringToEnd', this, start, this.__valueKind, this.__valueType, getOptionalType2(this, start), getTypeAdapter2(this, start))
    }
    // Number
    power(value: any): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation1ValueSource('_power', this, value, 'stringDouble', 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation1ValueSource('_power', this, value, 'stringDouble', 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_power', this, value, 'double', 'double', getOptionalType2(this, value), getTypeAdapter2(this, value))
        }
    }
    logn(value: any): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation1ValueSource('_logn', this, value, 'stringDouble', 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation1ValueSource('_logn', this, value, 'stringDouble', 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_logn', this, value, 'double', 'double', getOptionalType2(this, value), getTypeAdapter2(this, value))
        }
    }
    roundn(value: any): any {
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation1ValueSource('_roundn', this, value, 'stringDouble', 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation1ValueSource('_roundn', this, value, 'stringDouble', 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_roundn', this, value, 'double', 'double', getOptionalType2(this, value), getTypeAdapter2(this, value))
        }
    }
    /**
     * This function establish a minimum value for the current value, that means the biggest value must be returned
     */
    minValue(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_maximumBetweenTwoValues')
    }
    /**
     * This function establish a maximun value for the current value, that means the smallest value must be returned
     */
    maxValue(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_minimumBetweenTwoValues')
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
        if (this.__valueKind === 'stringInt') {
            return new SqlOperation1ValueSource('_divide', this, value, 'stringDouble', 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else if (this.__valueKind === 'stringDouble') {
            return new SqlOperation1ValueSource('_divide', this, value, 'stringDouble', 'stringDouble', getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return new SqlOperation1ValueSource('_divide', this, value, 'double', 'double', getOptionalType2(this, value), getTypeAdapter2(this, value))
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
        return new SqlOperation2ValueSource('_substr', this, start, count, this.__valueKind, this.__valueType, getOptionalType3(this, start, count), getTypeAdapter3(this, start, count))
    }
    substring(start: any, end: any): any {
        return new SqlOperation2ValueSource('_substring', this, start, end, this.__valueKind, this.__valueType, getOptionalType3(this, start, end), getTypeAdapter3(this, start, end))
    }
    /** @deprecated use replaceAllIfValue method instead */
    replaceIfValue(findString: any, replaceWith: any): any {
        return new SqlOperation2ValueSourceIfValueOrIgnore('_replaceAll', this, findString, replaceWith, this.__valueKind, this.__valueType, getOptionalType3(this, findString, replaceWith), getTypeAdapter3(this, findString, replaceWith))
    }
    /** @deprecated use replaceAll method instead */
    replace(findString: any, replaceWith: any): any {
        return new SqlOperation2ValueSource('_replaceAll', this, findString, replaceWith, this.__valueKind, this.__valueType, getOptionalType3(this, findString, replaceWith), getTypeAdapter3(this, findString, replaceWith))
    }
    replaceAllIfValue(findString: any, replaceWith: any): any {
        return new SqlOperation2ValueSourceIfValueOrIgnore('_replaceAll', this, findString, replaceWith, this.__valueKind, this.__valueType, getOptionalType3(this, findString, replaceWith), getTypeAdapter3(this, findString, replaceWith))
    }
    replaceAll(findString: any, replaceWith: any): any {
        return new SqlOperation2ValueSource('_replaceAll', this, findString, replaceWith, this.__valueKind, this.__valueType, getOptionalType3(this, findString, replaceWith), getTypeAdapter3(this, findString, replaceWith))
    }
    // Oracle recursive
    __prior(): any {
        return new SqlOperation0ValueSource('_prior', this, this.__valueKind, this.__valueType, this.__optionalType, this.__typeAdapter)
    }
}

export class SqlOperationStatic0ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof SqlOperationStatic0

    constructor(operation: keyof SqlOperationStatic0, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__operation = operation
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params)
    }
}

export class SqlOperationStaticBooleanValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof SqlOperationStatic0

    constructor(operation: '_true' | '_false') {
        super('boolean', 'boolean', 'required', undefined)
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

    constructor(operation: '_true' | '_false', valueSource: ValueSourceImpl, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
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
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues(sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getValuesForInsert(sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__valueSource.__isAllowed(sqlBuilder)
    }
}

export class ValueWhenNoValueValueSource extends ValueSourceImpl {
    __valueSource: ValueSourceImpl
    __valueWhenNoValue: __ValueSourcePrivate & ToSql

    constructor(valueWhenNoValue: __ValueSourcePrivate & ToSql, valueSource: ValueSourceImpl, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__valueWhenNoValue = valueWhenNoValue
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        const sql = this.__valueSource.__toSql(sqlBuilder, params)
        if (sql) {
            return sql
        }

        // No value
        return this.__valueWhenNoValue.__toSql(sqlBuilder, params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        const sql = this.__valueSource.__toSql(sqlBuilder, params)
        if (sql) {
            return sql
        }

        // No value
        return this.__valueWhenNoValue.__toSqlForCondition(sqlBuilder, params)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(sqlBuilder, withs)
        this.__valueWhenNoValue.__addWiths(sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        this.__valueWhenNoValue.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        this.__valueWhenNoValue.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues(sqlBuilder) || this.__valueWhenNoValue.__getOldValues(sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getValuesForInsert(sqlBuilder) || this.__valueWhenNoValue.__getValuesForInsert(sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__valueSource.__isAllowed(sqlBuilder) && this.__valueWhenNoValue.__isAllowed(sqlBuilder)
    }
}

export class SqlOperationStatic1ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof SqlOperationStatic1
    __value: any

    constructor(operation: keyof SqlOperationStatic1, value: any, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__value, this.__valueType, this.__typeAdapter)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        __addWiths(this.__value, sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        __registerTableOrView(this.__value, sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        __registerRequiredColumn(this.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return __getOldValues(this.__value, sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return __getValuesForInsert(this.__value, sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return __isAllowed(this.__value, sqlBuilder)
    }
}

export class SqlOperationConstValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof SqlOperationStatic1
    __value: any

    constructor(value: any, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
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
    __addWiths(sqlBuilder: HasIsValue,withs: Array<IWithView<any>>): void {
        __addWiths(this.__value, sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        __registerTableOrView(this.__value, sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        __registerRequiredColumn(this.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return __getOldValues(this.__value, sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return __getValuesForInsert(this.__value, sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return __isAllowed(this.__value, sqlBuilder)
    }
}

export class SqlOperation0ValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlFunction0

    constructor(operation: keyof SqlFunction0, valueSource: ValueSourceImpl, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues(sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getValuesForInsert(sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__valueSource.__isAllowed(sqlBuilder)
    }
}

export class SqlOperationIsNullValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlComparator0

    constructor(operation: keyof SqlComparator0, valueSource: ValueSourceImpl, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues(sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getValuesForInsert(sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__valueSource.__isAllowed(sqlBuilder)
    }
}

export class SqlOperation1ValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any

    constructor(operation: keyof SqlOperation1, valueSource: ValueSourceImpl, value: any, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(this.__value, sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(this.__value, sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(this.__value, sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(this.__value, sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(this.__value, sqlBuilder)
    }
}

export class SqlOperationInValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: '_in' | '_notIn'
    __value: any

    constructor(operation: '_in' | '_notIn', valueSource: ValueSourceImpl, value: any, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(sqlBuilder, withs)
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __addWiths(values[i], sqlBuilder, withs)
            }
        } else {
            if (isSelectQuery(values)) {
                __addInlineQueryWiths(sqlBuilder, withs, values)
            } else {
                __addWiths(values, sqlBuilder, withs)
            }
        }
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerTableOrView(values[i], sqlBuilder, requiredTablesOrViews)
            }
        } else {
            __registerTableOrView(values, sqlBuilder, requiredTablesOrViews)
        }
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerRequiredColumn(values[i], sqlBuilder, requiredColumns, onlyForTablesOrViews)
            }
        } else {
            __registerRequiredColumn(values, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        }
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        let result = this.__valueSource.__getOldValues(sqlBuilder)
        if (result) {
            return result
        }
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                result = __getOldValues(values[i], sqlBuilder)
                if (result) {
                    return result
                }
            }
        } else {
            return __getOldValues(values, sqlBuilder)
        }
        return undefined
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        let result = this.__valueSource.__getValuesForInsert(sqlBuilder)
        if (result) {
            return result
        }
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                result = __getValuesForInsert(values[i], sqlBuilder)
                if (result) {
                    return result
                }
            }
        } else {
            return __getValuesForInsert(values, sqlBuilder)
        }
        return undefined
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        let result = this.__valueSource.__isAllowed(sqlBuilder)
        if (!result) {
            return false
        }
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                result = __isAllowed(values[i], sqlBuilder)
                if (!result) {
                    return false
                }
            }
        } else {
            return __isAllowed(values, sqlBuilder)
        }
        return true
    }
}

export class SqlOperationValueWhenNullValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any

    constructor(valueSource: ValueSourceImpl, value: any, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = '_valueWhenNull'
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(this.__value, sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(this.__value, sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(this.__value, sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(this.__value, sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(this.__value, sqlBuilder)
    }
}

export class SqlOperation1NotOptionalValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any

    constructor(operation: keyof SqlOperation1, valueSource: ValueSourceImpl, value: any, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(this.__value, sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(this.__value, sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(this.__value, sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(this.__value, sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(this.__value, sqlBuilder)
    }
}

export class SqlOperation1ValueSourceIfValueOrNoop extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any

    constructor(operation: keyof SqlOperation1, valueSource: ValueSourceImpl, value: any, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
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
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        if (!sqlBuilder._isValue(this.__value)) {
            return
        }
        this.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(this.__value, sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        if (!sqlBuilder._isValue(this.__value)) {
            return
        }
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(this.__value, sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        if (!sqlBuilder._isValue(this.__value)) {
            return
        }
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        if (!sqlBuilder._isValue(this.__value)) {
            return undefined
        }
        return this.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(this.__value, sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        if (!sqlBuilder._isValue(this.__value)) {
            return undefined
        }
        return this.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(this.__value, sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        if (!sqlBuilder._isValue(this.__value)) {
            return true
        }
        return this.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(this.__value, sqlBuilder)
    }
}

export class SqlOperationInValueSourceIfValueOrNoop extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: '_in' | '_notIn'
    __value: any

    constructor(operation: '_in' | '_notIn', valueSource: ValueSourceImpl, value: any, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
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
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        if (!sqlBuilder._isValue(this.__value)) {
            return
        }
        this.__valueSource.__addWiths(sqlBuilder, withs)
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __addWiths(values[i], sqlBuilder, withs)
            }
        } else {
            __addWiths(values, sqlBuilder, withs)
        }
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        if (!sqlBuilder._isValue(this.__value)) {
            return
        }
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerTableOrView(values[i], sqlBuilder, requiredTablesOrViews)
            }
        } else {
            __registerTableOrView(values, sqlBuilder, requiredTablesOrViews)
        }
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        if (!sqlBuilder._isValue(this.__value)) {
            return
        }
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerRequiredColumn(values[i], sqlBuilder, requiredColumns, onlyForTablesOrViews)
            }
        } else {
            __registerRequiredColumn(values, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        }
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        if (!sqlBuilder._isValue(this.__value)) {
            return undefined
        }
        let result = this.__valueSource.__getOldValues(sqlBuilder)
        if (result) {
            return result
        }
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                result = __getOldValues(values[i], sqlBuilder)
                if (result) {
                    return result
                }
            }
        } else {
            return __getOldValues(values, sqlBuilder)
        }
        return undefined
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        if (!sqlBuilder._isValue(this.__value)) {
            return undefined
        }
        let result = this.__valueSource.__getValuesForInsert(sqlBuilder)
        if (result) {
            return result
        }
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                result = __getValuesForInsert(values[i], sqlBuilder)
                if (result) {
                    return result
                }
            }
        } else {
            return __getValuesForInsert(values, sqlBuilder)
        }
        return undefined
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        if (!sqlBuilder._isValue(this.__value)) {
            return true
        }
        let result = this.__valueSource.__isAllowed(sqlBuilder)
        if (!result) {
            return false
        }
        const values = this.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                result = __isAllowed(values[i], sqlBuilder)
                if (!result) {
                    return false
                }
            }
        } else {
            return __isAllowed(values, sqlBuilder)
        }
        return true
    }
}

export class SqlOperationValueSourceIfValueAlwaysNoop extends ValueSourceImpl {

    constructor() {
        super('', '', 'required', undefined)
    }
    __toSql(_sqlBuilder: SqlBuilder, _params: any[]): string {
        return ''
    }
}


export class SqlOperation1ValueSourceIfValueOrIgnore extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any

    constructor(operation: keyof SqlOperation1, valueSource: ValueSourceImpl, value: any, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
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
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(this.__value, sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(this.__value, sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(this.__value, sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(this.__value, sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(this.__value, sqlBuilder)
    }
}

export class SqlOperation2ValueSource extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation2
    __value: any
    __value2: any

    constructor(operation: keyof SqlOperation2, valueSource: ValueSourceImpl, value: any, value2: any, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter?: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
        this.__operation = operation
        this.__value = value
        this.__value2 = value2
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__valueSource, this.__value, this.__value2, this.__valueSource.__valueType, this.__valueSource.__typeAdapter)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(this.__value, sqlBuilder, withs)
        __addWiths(this.__value2, sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(this.__value, sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(this.__value2, sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value2, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(this.__value, sqlBuilder) || __getOldValues(this.__value2, sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(this.__value, sqlBuilder) || __getValuesForInsert(this.__value2, sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(this.__value, sqlBuilder) && __isAllowed(this.__value2, sqlBuilder)
    }
}

export class SqlOperation2ValueSourceIfValueOrIgnore extends ValueSourceImpl implements HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation2
    __value: any
    __value2: any

    constructor(operation: keyof SqlOperation2, valueSource: ValueSourceImpl, value: any, value2: any, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter?: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
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
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(this.__value, sqlBuilder, withs)
        __addWiths(this.__value2, sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(this.__value, sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(this.__value2, sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__value2, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(this.__value, sqlBuilder) || __getOldValues(this.__value2, sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(this.__value, sqlBuilder) || __getValuesForInsert(this.__value2, sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(this.__value, sqlBuilder) && __isAllowed(this.__value2, sqlBuilder)
    }
}

export class NoopValueSource extends ValueSourceImpl {
    __valueSource: ValueSourceImpl
    constructor(valueSource: ValueSourceImpl, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__valueSource = valueSource
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__valueSource.__toSql(sqlBuilder, params)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues(sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getValuesForInsert(sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__valueSource.__isAllowed(sqlBuilder)
    }
}

export class SequenceValueSource extends ValueSourceImpl {
    __operation: keyof SqlSequenceOperation
    __sequenceName: string
    constructor(operation: keyof SqlSequenceOperation, sequenceName: string, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
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

    constructor(sql: TemplateStringsArray, sqlParams: AnyValueSource[], valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__sql = sql
        this.__sqlParams = sqlParams
        if (valueType === 'boolean') {
            this.__isBooleanForCondition = true
        }
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._fragment(params, this.__sql, this.__sqlParams)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        const sqlParams = this.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            value.__addWiths(sqlBuilder, withs)
        }
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        const sqlParams = this.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            value.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        }
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        const sqlParams = this.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            value.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        }
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        const sqlParams = this.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            const result = value.__getOldValues(sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        const sqlParams = this.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            const result = value.__getValuesForInsert(sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        const sqlParams = this.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            const result = value.__getValuesForInsert(sqlBuilder)
            if (!result) {
                return false
            }
        }
        return true
    }
}

export class ValueSourceFromBuilder extends ValueSourceImpl {
    __builder: (fragmentBuilder: FragmentQueryBuilder) => AnyValueSource
    __fragmentBuilder: FragmentQueryBuilder
    __builderOutput?: AnyValueSource 

    constructor(builder: (fragmentBuilder: FragmentQueryBuilder) => AnyValueSource, fragmentBuilder: FragmentQueryBuilder, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__builder = builder
        this.__fragmentBuilder = fragmentBuilder
        if (valueType === 'boolean') {
            this.__isBooleanForCondition = true
        }
    }
    __getBuilderOutput(): AnyValueSource {
        if (!this.__builderOutput) {
            this.__builderOutput = this.__builder(this.__fragmentBuilder)
        }
        return this.__builderOutput
    }
    __getBuilderOutputPrivate(): __ValueSourcePrivate {
        return __getValueSourcePrivate(this.__getBuilderOutput())
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        const builderOutput = this.__getBuilderOutput()
        if (!hasToSql(builderOutput)) {
            throw new Error('The result of value from fragment functions is no a valid sql element')
        }
        return builderOutput.__toSql(sqlBuilder, params)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__getBuilderOutputPrivate().__addWiths(sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__getBuilderOutputPrivate().__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__getBuilderOutputPrivate().__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__getBuilderOutputPrivate().__getOldValues(sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__getBuilderOutputPrivate().__getValuesForInsert(sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__getBuilderOutputPrivate().__isAllowed(sqlBuilder)
    }
}

export class AllowWhenValueSource extends ValueSourceImpl {
    __valueSource: ValueSourceImpl
    __allowed: boolean
    __error: Error
    constructor(allowed: boolean, error: Error, valueSource: ValueSourceImpl) {
        super(valueSource.__valueKind, valueSource.__valueType, valueSource.__optionalType, valueSource.__typeAdapter)
        this.__valueSource = valueSource
        this.__error = error
        this.__allowed = allowed
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        if (!this.__allowed) {
            throw this.__error
        }
        return this.__valueSource.__toSql(sqlBuilder, params)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__valueSource.__addWiths(sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getOldValues(sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__valueSource.__getValuesForInsert(sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        if (!this.__allowed) {
            return false
        }
        return this.__valueSource.__isAllowed(sqlBuilder)
    }
}

export class AggregateFunctions0ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof AggregateFunctions0

    constructor(operation: keyof AggregateFunctions0, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__operation = operation
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params)
    }
}

export class NullValueSource extends ValueSourceImpl implements HasOperation {
    __operation = '_asNullValue' as const

    constructor(valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._asNullValue(params, this.__valueType, this.__typeAdapter)
    }
    __isAllowed(_sqlBuilder: HasIsValue): boolean {
        return false
    }
}

export class AggregateFunctions1ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof AggregateFunctions1
    __value: any

    constructor(operation: keyof AggregateFunctions1, value: any, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__operation = operation
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__value)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        __addWiths(this.__value, sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        __registerTableOrView(this.__value, sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        __registerRequiredColumn(this.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return __getOldValues(this.__value, sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return __getValuesForInsert(this.__value, sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return __isAllowed(this.__value, sqlBuilder)
    }
}

export class AggregateFunctions1or2ValueSource extends ValueSourceImpl implements HasOperation {
    __operation: keyof AggregateFunctions1or2
    __value: any
    __separator: string | undefined

    constructor(operation: keyof AggregateFunctions1or2, separator: string | undefined, value: any, valueKind: ValueKind, valueType: string, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined) {
        super(valueKind, valueType, optionalType, typeAdapter)
        this.__operation = operation
        this.__separator = separator
        this.__value = value
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__separator, this.__value)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        __addWiths(this.__value, sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        __registerTableOrView(this.__value, sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        __registerRequiredColumn(this.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return __getOldValues(this.__value, sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return __getValuesForInsert(this.__value, sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return __isAllowed(this.__value, sqlBuilder)
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
    if (isValueSource(b)) {
        return mergeOptional(a.__optionalType, __getValueSourcePrivate(b).__optionalType)
    }
    return a.__optionalType
}


function getOptionalType3(a: ValueSourceImpl, b: any, c: any): OptionalType {
    let result = a.__optionalType
    if (isValueSource(b)) {
        const bPrivate = __getValueSourcePrivate(b)
        if (bPrivate.__typeAdapter) {
            result = mergeOptional(result, bPrivate.__optionalType)
        }
    }
    if (isValueSource(c)) {
        result = mergeOptional(result, __getValueSourcePrivate(c).__optionalType)
    }
    return result
}

function getTypeAdapter2(a: ValueSourceImpl, b: any): TypeAdapter | undefined {
    if (a.__typeAdapter) {
        return a.__typeAdapter
    }
    if (isValueSource(b)) {
        return __getValueSourcePrivate(b).__typeAdapter
    }
    return undefined
}


function getTypeAdapter3(a: ValueSourceImpl, b: any, c: any): TypeAdapter | undefined {
    if (a.__typeAdapter) {
        return a.__typeAdapter
    }
    if (isValueSource(b)) {
        const bPrivate = __getValueSourcePrivate(b)
        if (bPrivate.__typeAdapter) {
            return bPrivate.__typeAdapter
        }
    }
    if (isValueSource(c)) {
        return __getValueSourcePrivate(c).__typeAdapter
    }
    return undefined
}

function createSqlOperation1ofOverloadedNumber(thiz: ValueSourceImpl, value: any, operation: keyof SqlOperation1) {
    if (thiz.__valueKind === 'double' || thiz.__valueKind === 'stringDouble' || thiz.__valueKind === 'bigint') {
        return new SqlOperation1ValueSource(operation, thiz, value, thiz.__valueKind, thiz.__valueType, getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
    }
    if (thiz.__valueKind === 'stringInt') {
        if (isValueSource(value)) {
            const valuePrivate = __getValueSourcePrivate(value)
            if (valuePrivate.__valueKind === 'int' || valuePrivate.__valueKind === 'stringInt') {
                return new SqlOperation1ValueSource(operation, thiz, value, 'stringInt', 'stringInt', getOptionalType2(thiz, value), thiz.__typeAdapter)
            } else {
                return new SqlOperation1ValueSource(operation, thiz, value, 'stringDouble', 'stringDouble', getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
            }
        }
        if (Number.isInteger(value)) {
            return new SqlOperation1ValueSource(operation, thiz, value, 'stringInt', 'stringInt', getOptionalType2(thiz, value), thiz.__typeAdapter)
        } else {
            return new SqlOperation1ValueSource(operation, thiz, value, 'stringDouble', 'stringDouble', getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
        }
    } else {
        if (isValueSource(value)) {
            const valuePrivate = __getValueSourcePrivate(value)
            if (valuePrivate.__valueKind === 'int') {
                return new SqlOperation1ValueSource(operation, thiz, value, 'int', 'int', getOptionalType2(thiz, value), thiz.__typeAdapter)
            } else if (valuePrivate.__valueKind === 'stringInt') {
                return new SqlOperation1ValueSource(operation, thiz, value, 'stringInt', 'stringInt', getOptionalType2(thiz, value), thiz.__typeAdapter)
            } else if (valuePrivate.__valueKind === 'stringDouble') {
                return new SqlOperation1ValueSource(operation, thiz, value, 'stringDouble', 'stringDouble', getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
            } else {
                return new SqlOperation1ValueSource(operation, thiz, value, 'double', 'double', getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
            }
        }
        if (Number.isInteger(value)) {
            return new SqlOperation1ValueSource(operation, thiz, value, 'int', 'int', getOptionalType2(thiz, value), thiz.__typeAdapter)
        } else {
            return new SqlOperation1ValueSource(operation, thiz, value, 'double', 'double', getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
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
    [valueSourceType]!: "ValueSource"
    [database]: any
    [valueSourceTypeName]: any

    [isValueSourceObject]: true = true
    __valueKind: ValueKind = ''
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
    allowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new AllowWhenTableOrViewRawFragmentValueSource(when, new Error(error), this.__tableOrView, this.__operation)
        } else {
            return new AllowWhenTableOrViewRawFragmentValueSource(when, error, this.__tableOrView, this.__operation)
        }
    }
    disallowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new AllowWhenTableOrViewRawFragmentValueSource(!when, new Error(error), this.__tableOrView, this.__operation)
        } else {
            return new AllowWhenTableOrViewRawFragmentValueSource(!when, error, this.__tableOrView, this.__operation)
        }
    }
    __addWiths(_sqlBuilder: HasIsValue, _withs: IWithView<any>[]): void {
        // Do nothing
    }
    __registerTableOrView(_sqlBuilder: HasIsValue, _requiredTablesOrViews: Set<ITableOrView<any>>): void {
        // Do nothing
    }
    __registerRequiredColumn(_sqlBuilder: HasIsValue, _requiredColumns: Set<Column>, _onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        // Do nothing
    }
    __getOldValues(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return undefined
    }
    __getValuesForInsert(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return undefined
    }
    __isAllowed(_sqlBuilder: HasIsValue): boolean {
        return true
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder[this.__operation](params, this.__tableOrView)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__toSql(sqlBuilder, params)
    }
}

export class AllowWhenTableOrViewRawFragmentValueSource extends TableOrViewRawFragmentValueSource {
    __allowed: boolean
    __error: Error
    constructor(allowed: boolean, error: Error, _tableOrView: ITableOrView<any>, operation: '_rawFragmentTableName' | '_rawFragmentTableAlias') {
        super(_tableOrView, operation)
        this.__error = error
        this.__allowed = allowed
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        if (!this.__allowed) {
            throw this.__error
        }
        return super.__toSql(sqlBuilder, params)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        if (!this.__allowed) {
            return false
        }
        return super.__isAllowed(sqlBuilder)
    }
}

export type InlineSelectData = SelectData & HasAddWiths

export class InlineSelectValueSource extends ValueSourceImpl implements HasOperation {
    __operation = '_inlineSelectAsValue' as const
    __selectData: InlineSelectData

    constructor(selectData: InlineSelectData, required: boolean) {
        super(...valueSourceInitializationForInlineSelect(selectData, required))
        this.__selectData = selectData
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._inlineSelectAsValue(this.__selectData, params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._inlineSelectAsValueForCondition(this.__selectData, params)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: IWithView<any>[]): void {
        __addInlineQueryWiths(sqlBuilder, withs, this.__selectData)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__selectData.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__selectData.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__selectData.__getOldValues(sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__selectData.__getValuesForInsert(sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__selectData.__isAllowed(sqlBuilder)
    }
}

export class AggregateSelectValueSource implements ValueSource<any, any, any, any>, IAggregatedArrayValueSource<any, any, any>, AggregatedArrayValueSource<any, any, any>, AggregatedArrayValueSourceProjectableAsNullable<any, any, any, any>, __ValueSourcePrivate, ToSql {
    [tableOrView]: any
    [valueType_]: any
    [optionalType_]: any
    [valueSourceType]!: "ValueSource"
    [database]: any
    [valueSourceTypeName]: any
    [aggregatedArrayValueSourceType]!: 'AggregatedArrayValueSource'

    [isValueSourceObject]: true = true
    __valueKind: ValueKind = 'aggregatedArray'
    __valueType: string = 'aggregatedArray'
    __optionalType: OptionalType
    __operation = '_inlineSelectAsValue' as const
    __selectData: InlineSelectData
    __aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource
    __aggregatedArrayMode: __AggregatedArrayMode
    __aggreagtedProjectingOptionalValuesAsNullable?: boolean

    constructor(selectData: InlineSelectData, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType) {
        this.__selectData = selectData
        this.__aggregatedArrayColumns = aggregatedArrayColumns
        this.__aggregatedArrayMode = aggregatedArrayMode
        this.__optionalType = _optionalType
    }

    isConstValue(): boolean {
        return false
    }
    getConstValue(): any {
        throw new Error('You are trying to access to the const value when the expression is not const')
    }
    allowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new AllowWhenAggregateSelectValueSource(when, new Error(error), this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        } else {
            return new AllowWhenAggregateSelectValueSource(when, error, this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        }
    }
    disallowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new AllowWhenAggregateSelectValueSource(!when, new Error(error), this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        } else {
            return new AllowWhenAggregateSelectValueSource(!when, error, this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        }
    }

    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._inlineSelectAsValue(this.__selectData, params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._inlineSelectAsValueForCondition(this.__selectData, params)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: IWithView<any>[]): void {
        __addInlineQueryWiths(sqlBuilder, withs, this.__selectData)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__selectData.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__selectData.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__selectData.__getOldValues(sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__selectData.__getValuesForInsert(sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__selectData.__isAllowed(sqlBuilder)
    }

    useEmptyArrayForNoValue(): any {
        return new AggregateSelectValueSource(this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'required')
    }
    asOptionalNonEmptyArray(): any {
        return new AggregateSelectValueSource(this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional')
    }
    asRequiredInOptionalObject(): any {
        return new AggregateSelectValueSource(this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'requiredInOptionalObject')
    }
    onlyWhenOrNull(when: boolean): any {
        if (when) {
            return this
        } else {
            return new NullAggregateSelectValueSource(this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional')
        }
    }
    ignoreWhenAsNull(when: boolean): any {
        if (when) {
            return new NullAggregateSelectValueSource(this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional')
        } else {
            return this
        }
    }
    projectingOptionalValuesAsNullable(): any {
        this.__aggreagtedProjectingOptionalValuesAsNullable = true
        return this
    }
}

export class AllowWhenAggregateSelectValueSource extends AggregateSelectValueSource {
    __allowed: boolean
    __error: Error
    constructor(allowed: boolean, error: Error, selectData: InlineSelectData, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType) {
        super(selectData, aggregatedArrayColumns, aggregatedArrayMode, _optionalType)
        this.__error = error
        this.__allowed = allowed
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        if (!this.__allowed) {
            throw this.__error
        }
        return super.__toSql(sqlBuilder, params)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        if (!this.__allowed) {
            return false
        }
        return super.__isAllowed(sqlBuilder)
    }
}

export class NullAggregateSelectValueSource implements ValueSource<any, any, any, any>, IAggregatedArrayValueSource<any, any, any>, AggregatedArrayValueSource<any, any, any>, AggregatedArrayValueSourceProjectableAsNullable<any, any, any, any>, __ValueSourcePrivate, ToSql {
    [tableOrView]: any
    [valueType_]: any
    [optionalType_]: any
    [valueSourceType]!: "ValueSource"
    [database]: any
    [valueSourceTypeName]: any
    [aggregatedArrayValueSourceType]!: 'AggregatedArrayValueSource'

    [isValueSourceObject]: true = true
    __valueKind: ValueKind = 'aggregatedArray'
    __valueType: string = 'aggregatedArray'
    __optionalType: OptionalType
    __operation = '_inlineSelectAsValue' as const
    __selectData: InlineSelectData
    __aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource
    __aggregatedArrayMode: __AggregatedArrayMode

    constructor(selectData: InlineSelectData, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType) {
        this.__selectData = selectData
        this.__aggregatedArrayColumns = aggregatedArrayColumns
        this.__aggregatedArrayMode = aggregatedArrayMode
        this.__optionalType = _optionalType
    }

    isConstValue(): boolean {
        return false
    }
    getConstValue(): any {
        throw new Error('You are trying to access to the const value when the expression is not const')
    }
    allowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new NullAllowWhenAggregateSelectValueSource(this.__selectData, when, new Error(error), this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        } else {
            return new NullAllowWhenAggregateSelectValueSource(this.__selectData, when, error, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        }
    }
    disallowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new NullAllowWhenAggregateSelectValueSource(this.__selectData, !when, new Error(error), this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        } else {
            return new NullAllowWhenAggregateSelectValueSource(this.__selectData, !when, error, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        }
    }

    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._asNullValue(params, this.__valueType, undefined)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__toSql(sqlBuilder, params)
    }
    __addWiths(_sqlBuilder: HasIsValue, _withs: IWithView<any>[]): void {
    }
    __registerTableOrView(_sqlBuilder: HasIsValue, _requiredTablesOrViews: Set<ITableOrView<any>>): void {
    }
    __registerRequiredColumn(_sqlBuilder: HasIsValue, _requiredColumns: Set<Column>, _onlyForTablesOrViews: Set<ITableOrView<any>>): void {
    }
    __getOldValues(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return undefined
    }
    __getValuesForInsert(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return undefined
    }
    __isAllowed(_sqlBuilder: HasIsValue): boolean {
        return false
    }

    useEmptyArrayForNoValue(): any {
        return new NullAggregateSelectValueSource(this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'required')
    }
    asOptionalNonEmptyArray(): any {
        return new NullAggregateSelectValueSource(this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional')
    }
    asRequiredInOptionalObject(): any {
        return new NullAggregateSelectValueSource(this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'requiredInOptionalObject')
    }
    onlyWhenOrNull(when: boolean): any {
        if (when) {
            return this
        } else {
            return new NullAggregateSelectValueSource(this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional')
        }
    }
    ignoreWhenAsNull(when: boolean): any {
        if (when) {
            return new NullAggregateSelectValueSource(this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional')
        } else {
            return this
        }
    }
    projectingOptionalValuesAsNullable(): any {
        return this
    }
}

export class NullAllowWhenAggregateSelectValueSource extends NullAggregateSelectValueSource {
    __allowed: boolean
    __error: Error
    constructor(selectData: InlineSelectData, allowed: boolean, error: Error, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType) {
        super(selectData, aggregatedArrayColumns, aggregatedArrayMode, _optionalType)
        this.__error = error
        this.__allowed = allowed
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        if (!this.__allowed) {
            throw this.__error
        }
        return super.__toSql(sqlBuilder, params)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        if (!this.__allowed) {
            return false
        }
        return super.__isAllowed(sqlBuilder)
    }
}

function __addInlineQueryWiths(sqlBuilder: HasIsValue, withs: IWithView<any>[], selectData: InlineSelectData): void {
    const withViews: IWithView<any>[] = []
    const subSelectUsing = selectData.__subSelectUsing || []
    selectData.__addWiths(sqlBuilder, withViews)
    for (let i = 0, length = withViews.length; i < length; i++) {
        const withView = withViews[i]!
        if (subSelectUsing.includes(withView)) {
            continue
        }
        if (withs.includes(withView)) {
            continue
        }
        const withViewPrivate = __getTableOrViewPrivate(withView)
        if (withViewPrivate.__hasExternalDependencies) {
            continue
        }
        withViewPrivate.__addWiths(sqlBuilder, withs)
    }
}

function isSelectQuery(value: any): value is InlineSelectData {
    if (value === undefined || value === null) {
        return false
    }
    if (typeof value === 'object') {
        return !!value[isSelectQueryObject]
    }
    return false
}

function valueSourceInitializationForInlineSelect(selectData: SelectData, required: boolean) {
    if (selectData.__asInlineAggregatedArrayValue) {
        throw new Error('Ilegal state: unexpected inline aggregated array vaule')
    } else if (selectData.__oneColumn) {
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
        return [valueSourcePrivate.__valueKind, valueSourcePrivate.__valueType, required ? 'required' : 'optional', typeAdapter, valueSourcePrivate.__aggregatedArrayColumns, valueSourcePrivate.__aggregatedArrayMode, valueSourcePrivate.__uuidString] as const
    } else {
        throw new Error('Illega state: unexpected inline select')
    }
}

export class AggregateValueAsArrayValueSource implements ValueSource<any, any, any, any>, IAggregatedArrayValueSource<any, any, any>, AggregatedArrayValueSource<any, any, any>, AggregatedArrayValueSourceProjectableAsNullable<any, any, any, any>, __ValueSourcePrivate, ToSql {
    [tableOrView]: any
    [valueType_]: any
    [optionalType_]: any
    [valueSourceType]!: "ValueSource"
    [database]: any
    [valueSourceTypeName]: any
    [aggregatedArrayValueSourceType]!: 'AggregatedArrayValueSource'

    [isValueSourceObject]: true = true
    __valueKind: ValueKind = 'aggregatedArray'
    __valueType: string = 'aggregatedArray'
    __optionalType: OptionalType
    __operation: '_aggregateValueAsArray' = '_aggregateValueAsArray'
    __aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource
    __aggregatedArrayMode: __AggregatedArrayMode
    __aggreagtedProjectingOptionalValuesAsNullable?: boolean

    constructor(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType) {
        this.__aggregatedArrayColumns = aggregatedArrayColumns
        this.__aggregatedArrayMode = aggregatedArrayMode
        this.__optionalType = _optionalType
    }

    isConstValue(): boolean {
        return false
    }
    getConstValue(): any {
        throw new Error('You are trying to access to the const value when the expression is not const')
    }
    allowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new AllowWhenAggregateValueAsArrayValueSource(when, new Error(error), this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        } else {
            return new AllowWhenAggregateValueAsArrayValueSource(when, error, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        }
    }
    disallowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new AllowWhenAggregateValueAsArrayValueSource(!when, new Error(error), this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        } else {
            return new AllowWhenAggregateValueAsArrayValueSource(!when, error, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        }
    }
    __addWiths(sqlBuilder: HasIsValue, withs: IWithView<any>[]): void {
        this.__addWithsOf(sqlBuilder, withs, this.__aggregatedArrayColumns)
    }
    __addWithsOf(sqlBuilder: HasIsValue, withs: IWithView<any>[], aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): void {
        if (!aggregatedArrayColumns) {
            return
        } else if (isValueSource(aggregatedArrayColumns)) {
            const valueSourcePrivate = __getValueSourcePrivate(aggregatedArrayColumns)
            valueSourcePrivate.__addWiths(sqlBuilder, withs)
        } else {
            for (let prop in aggregatedArrayColumns) {
                this.__addWithsOf(sqlBuilder, withs, aggregatedArrayColumns[prop])
            }
        }
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        this.__registerTableOrViewOf(sqlBuilder, requiredTablesOrViews, this.__aggregatedArrayColumns)
    }
    __registerTableOrViewOf(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): void {
        if (!aggregatedArrayColumns) {
            return
        } else if (isValueSource(aggregatedArrayColumns)) {
            const valueSourcePrivate = __getValueSourcePrivate(aggregatedArrayColumns)
            valueSourcePrivate.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        } else {
            for (let prop in aggregatedArrayColumns) {
                this.__registerTableOrViewOf(sqlBuilder, requiredTablesOrViews, aggregatedArrayColumns[prop])
            }
        }
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        this.__registerRequiredColumnOf(sqlBuilder, requiredColumns, onlyForTablesOrViews, this.__aggregatedArrayColumns)
    }
    __registerRequiredColumnOf(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): void {
        if (!aggregatedArrayColumns) {
            return
        } else if (isValueSource(aggregatedArrayColumns)) {
            const valueSourcePrivate = __getValueSourcePrivate(aggregatedArrayColumns)
            valueSourcePrivate.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        } else {
            for (let prop in aggregatedArrayColumns) {
                this.__registerRequiredColumnOf(sqlBuilder, requiredColumns, onlyForTablesOrViews, aggregatedArrayColumns[prop])
            }
        }
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__getOldValuesOf(sqlBuilder, this.__aggregatedArrayColumns)
    }
    __getOldValuesOf(sqlBuilder: HasIsValue, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): ITableOrView<any> | undefined {
        if (!aggregatedArrayColumns) {
            return undefined
        } else if (isValueSource(aggregatedArrayColumns)) {
            const valueSourcePrivate = __getValueSourcePrivate(aggregatedArrayColumns)
            return valueSourcePrivate.__getOldValues(sqlBuilder)
        } else {
            for (let prop in aggregatedArrayColumns) {
                const result = this.__getOldValuesOf(sqlBuilder, aggregatedArrayColumns[prop])
                if (result) {
                    return result
                }
            }
            return undefined
        }
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return this.__getValuesForInsertOf(sqlBuilder, this.__aggregatedArrayColumns)
    }
    __getValuesForInsertOf(sqlBuilder: HasIsValue, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): ITableOrView<any> | undefined {
        if (!aggregatedArrayColumns) {
            return undefined
        } else if (isValueSource(aggregatedArrayColumns)) {
            const valueSourcePrivate = __getValueSourcePrivate(aggregatedArrayColumns)
            return valueSourcePrivate.__getValuesForInsert(sqlBuilder)
        } else {
            for (let prop in aggregatedArrayColumns) {
                const result = this.__getValuesForInsertOf(sqlBuilder, aggregatedArrayColumns[prop])
                if (result) {
                    return result
                }
            }
            return undefined
        }
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__isAllowedOf(sqlBuilder, this.__aggregatedArrayColumns)
    }
    __isAllowedOf(sqlBuilder: HasIsValue, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): boolean {
        if (!aggregatedArrayColumns) {
            return true
        } else if (isValueSource(aggregatedArrayColumns)) {
            const valueSourcePrivate = __getValueSourcePrivate(aggregatedArrayColumns)
            return valueSourcePrivate.__isAllowed(sqlBuilder)
        } else {
            for (let prop in aggregatedArrayColumns) {
                const result = this.__isAllowedOf(sqlBuilder, aggregatedArrayColumns[prop])
                if (!result) {
                    return false
                }
            }
            return true
        }
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._aggregateValueAsArray(this, params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__toSql(sqlBuilder, params)
    }

    useEmptyArrayForNoValue(): any {
        return new AggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'required')
    }
    asOptionalNonEmptyArray(): any {
        return new AggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional')
    }
    asRequiredInOptionalObject(): any {
        return new AggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'requiredInOptionalObject')
    }
    onlyWhenOrNull(when: boolean): any {
        if (when) {
            return this
        } else {
            return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional')
        }
    }
    ignoreWhenAsNull(when: boolean): any {
        if (when) {
            return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional')
        } else {
            return this
        }
    }
    projectingOptionalValuesAsNullable(): any {
        this.__aggreagtedProjectingOptionalValuesAsNullable = true
        return this
    }
}

export class AllowWhenAggregateValueAsArrayValueSource extends AggregateValueAsArrayValueSource {
    __allowed: boolean
    __error: Error
    constructor(allowed: boolean, error: Error, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType) {
        super(aggregatedArrayColumns, aggregatedArrayMode, _optionalType)
        this.__error = error
        this.__allowed = allowed
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        if (!this.__allowed) {
            throw this.__error
        }
        return super.__toSql(sqlBuilder, params)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        if (!this.__allowed) {
            return false
        }
        return super.__isAllowed(sqlBuilder)
    }
}

export class NullAggregateValueAsArrayValueSource implements ValueSource<any, any, any, any>, IAggregatedArrayValueSource<any, any, any>, AggregatedArrayValueSource<any, any, any>, AggregatedArrayValueSourceProjectableAsNullable<any, any, any, any>, __ValueSourcePrivate, ToSql {
    [tableOrView]: any
    [valueType_]: any
    [optionalType_]: any
    [valueSourceType]!: "ValueSource"
    [database]: any
    [valueSourceTypeName]: any
    [aggregatedArrayValueSourceType]!: 'AggregatedArrayValueSource'

    [isValueSourceObject]: true = true
    __valueKind: ValueKind = 'aggregatedArray'
    __valueType: string = 'aggregatedArray'
    __optionalType: OptionalType
    __operation: '_aggregateValueAsArray' = '_aggregateValueAsArray'
    __aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource
    __aggregatedArrayMode: __AggregatedArrayMode

    constructor(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType) {
        this.__aggregatedArrayColumns = aggregatedArrayColumns
        this.__aggregatedArrayMode = aggregatedArrayMode
        this.__optionalType = _optionalType
    }

    isConstValue(): boolean {
        return false
    }
    getConstValue(): any {
        throw new Error('You are trying to access to the const value when the expression is not const')
    }
    allowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new NullAllowWhenAggregateValueAsArrayValueSource(when, new Error(error), this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        } else {
            return new NullAllowWhenAggregateValueAsArrayValueSource(when, error, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        }
    }
    disallowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new NullAllowWhenAggregateValueAsArrayValueSource(!when, new Error(error), this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        } else {
            return new NullAllowWhenAggregateValueAsArrayValueSource(!when, error, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        }
    }
    __addWiths(_sqlBuilder: HasIsValue, _withs: IWithView<any>[]): void {
    }
    __registerTableOrView(_sqlBuilder: HasIsValue, _requiredTablesOrViews: Set<ITableOrView<any>>): void {
    }
    __registerRequiredColumn(_sqlBuilder: HasIsValue, _requiredColumns: Set<Column>, _onlyForTablesOrViews: Set<ITableOrView<any>>): void {
    }
    __getOldValues(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return undefined
    }
    __getValuesForInsert(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return undefined
    }
    __isAllowed(_sqlBuilder: HasIsValue): boolean {
        return false
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        return sqlBuilder._asNullValue(params, this.__valueType, undefined)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__toSql(sqlBuilder, params)
    }

    useEmptyArrayForNoValue(): any {
        return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'required')
    }
    asOptionalNonEmptyArray(): any {
        return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional')
    }
    asRequiredInOptionalObject(): any {
        return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'requiredInOptionalObject')
    }
    onlyWhenOrNull(when: boolean): any {
        if (when) {
            return this
        } else {
            return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional')
        }
    }
    ignoreWhenAsNull(when: boolean): any {
        if (when) {
            return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional')
        } else {
            return this
        }
    }
    projectingOptionalValuesAsNullable(): any {
        return this
    }
}

export class NullAllowWhenAggregateValueAsArrayValueSource extends NullAggregateValueAsArrayValueSource {
    __allowed: boolean
    __error: Error
    constructor(allowed: boolean, error: Error, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType) {
        super(aggregatedArrayColumns, aggregatedArrayMode, _optionalType)
        this.__error = error
        this.__allowed = allowed
    }
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        if (!this.__allowed) {
            throw this.__error
        }
        return super.__toSql(sqlBuilder, params)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        if (!this.__allowed) {
            return false
        }
        return super.__isAllowed(sqlBuilder)
    }
}