import type { SqlBuildContext } from './SqlBuildContext.js'
import type { SqlBuilder, SqlOperationStatic0, SqlOperationStatic1, SqlOperation1, SqlOperation2, ToSql, HasOperation, SqlSequenceOperation, SqlFragmentOperation, AggregateFunctions0, AggregateFunctions1, AggregateFunctions1or2, SqlFunction0, SqlComparator0, SelectData, SqlBoolean0 } from '../sqlBuilders/SqlBuilder.js'
import { hasToSql } from '../sqlBuilders/SqlBuilder.js'
import type { TypedValueSource } from '../typeSystem/valueSource.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import { CustomBooleanTypeAdapter, OracleDateAsTimestampTypeAdapter } from '../TypeAdapter.js'
import type { AnyTableOrView, IQueryDataDiscovery, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getTableOrViewPrivate, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { valueType as valueType_, optionalType as optionalType_ , booleanValueSource, comparableValueSource, localDateTimeValueSource, localDateValueSource, equalableValueSource, nullableValueSource, numberValueSource, stringValueSource, localTimeValueSource, ifValueSource, bigintValueSource, typeName, anyBooleanValueSource, isValueSourceObject, aggregatedArrayValueSource, isSelectQueryObject, uuidValueSource, customIntValueSource, customBigintValueSource, customDoubleValueSource, customDecimalValueSource, customUuidValueSource, customLocalDateValueSource, customLocalTimeValueSource, customLocalDateTimeValueSource, source, logicalTypes, runtimeTypes } from '../utils/symbols.js'
import { __addWiths } from '../utils/ITableOrView.js'
import { proxyTypeAdapterFor } from './ProxyTypeAdapter.js'
import type { DBColumn, __ColumnPrivate } from '../utils/Column.js'
import type { FragmentQueryBuilder } from '../queryBuilders/FragmentQueryBuilder.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { __isDouble, __isExactDecimal, __isUuid } from '../typeSystem/dataTypes.js'
import type { CustomType, DataTypeClass } from '../TypeAdapter.js'
import type { AnyValueSource, OptionalType, __AggregatedArrayColumns, __AggregatedArrayMode, __ValueSourcePrivate } from '../typeSystem/valueSource.js'
import { __getValueSourcePrivate, isValueSource } from '../typeSystem/valueSource.js'

/**
 * How a value source is written and what it reaches in the tree, for one kind of node (a constant, a function of a
 * value source, a fragment, ...). One object for each kind, shared by its value sources, without state: it receives
 * the value source, which has the fields of its node
 */
export interface NodeStrategy<VS extends ValueSourceImpl> {
    __toSql(vs: VS, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string
    __toSqlForCondition(vs: VS, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string
    __addWiths(vs: VS, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void
    __registerTableOrView(vs: VS, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void
    __registerRequiredColumn(vs: VS, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void
    __getOldValues(vs: VS, sqlBuilder: HasIsValue): AnyTableOrView | undefined
    __getValuesForInsert(vs: VS, sqlBuilder: HasIsValue): AnyTableOrView | undefined
    __isAllowed(vs: VS, sqlBuilder: HasIsValue): boolean
    __hasAggregation(vs: VS, sqlBuilder: HasIsValue): boolean
    isConstValue(vs: VS): boolean
    getConstValue(vs: VS): any
    /** Only the neutral condition changes it: what `valueWhenNoValue` gives */
    valueWhenNoValue?(vs: VS, value: any): any
    /** Only a column changes it: what `asRequiredInOptionalObject` gives */
    asRequiredInOptionalObject?(vs: VS): any
}

/** What a node does when its strategy doesn't say otherwise: it reaches nothing */
export const valueSourceNode: Omit<NodeStrategy<ValueSourceImpl>, '__toSql'> = {
    __toSqlForCondition(vs, sqlBuilder, context, forceTypeCast) {
        return vs.__node.__toSql(vs, sqlBuilder, context, forceTypeCast)
    },
    __addWiths() {},
    __registerTableOrView() {},
    __registerRequiredColumn() {},
    __getOldValues() {
        return undefined
    },
    __getValuesForInsert() {
        return undefined
    },
    __isAllowed() {
        return true
    },
    __hasAggregation(vs) {
        return vs.__isAggregate ?? false
    },
    isConstValue() {
        return false
    },
    getConstValue() {
        throw new TsSqlProcessingError({ reason: 'EXPRESSION_IS_NOT_CONST' }, 'You are trying to access to the const value when the expression is not const')
    },
}

/** How a value source is created from the class of its data type, which extends ValueSourceImpl at run time */
export type ValueSourceConstructor = new (optionalType: OptionalType, typeAdapter: TypeAdapter | undefined, aggregatedArrayColumns?: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode?: __AggregatedArrayMode, uuidString?: boolean, aggregatedProjectingOptionalValuesAsNullable?: boolean) => ValueSourceImpl

/** The class of the data type of a value source */
export function __typeClassOf(valueSource: __ValueSourcePrivate): DataTypeClass {
    if (valueSource instanceof ValueSourceImpl) {
        return valueSource.constructor as unknown as DataTypeClass
    }
    throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'unexpected value' }, 'The value source has no class of a data type')
}

/**
 * The class of a built-in data type a method that still lives here gives (a comparison gives a boolean, `length` an
 * int): the class of the data type of the value source has it in a static, because the classes of the bases can't
 * import the data types that extend them
 */
function __builtInTypeOf(valueSource: ValueSourceImpl, name: 'boolean' | 'int' | 'double' | 'bigint' | 'string'): DataTypeClass {
    const typeClass = valueSource.constructor as any
    const result: DataTypeClass | undefined = name === 'boolean' ? typeClass[logicalTypes]?.boolean : typeClass[runtimeTypes]?.[name]
    if (!result) {
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'unexpected value' }, 'The data type ' + valueSource.__type + ' gives no ' + name)
    }
    return result
}

export class ValueSourceImpl implements TypedValueSource<any, any, any>, __ValueSourcePrivate, ToSql {
    [nullableValueSource]!: 'NullableValueSource'
    [equalableValueSource]!: 'EqualableValueSource'
    [comparableValueSource]!: 'ComparableValueSource'
    [booleanValueSource]!: 'BooleanValueSource'
    [ifValueSource]!: 'IfValueSource'
    [numberValueSource]!: 'NumberValueSource'
    [bigintValueSource]!: 'BigintValueSource'
    [customIntValueSource]!: 'CustomIntValueSource'
    [customBigintValueSource]!: 'CustomBigintValueSource'
    [customDoubleValueSource]!: 'CustomDoubleValueSource'
    [customDecimalValueSource]!: 'CustomDecimalValueSource'
    [stringValueSource]!: 'StringValueSource'
    [localDateValueSource]!: 'LocalDateValueSource'
    [localTimeValueSource]!: 'LocalTimeValueSource'
    [localDateTimeValueSource]!: 'LocalDateTimeValueSource'
    [customLocalDateValueSource]!: 'CustomLocalDateValueSource'
    [customLocalTimeValueSource]!: 'CustomLocalTimeValueSource'
    [customLocalDateTimeValueSource]!: 'CustomLocalDateTimeValueSource'
    [anyBooleanValueSource]!: 'AnyBooleanValueSource'
    [aggregatedArrayValueSource]!: 'AggregatedArrayValueSource'
    [uuidValueSource]!: 'UuidValueSource'
    [customUuidValueSource]!: 'CustomUuidValueSource'
    [typeName]: any
    [source]: any

    [valueType_]: any
    [optionalType_]: any

    [isValueSourceObject]: true = true
    __type: string
    __customType: CustomType | undefined
    __optionalType: OptionalType
    __typeAdapter?: TypeAdapter | undefined
    __isBooleanForCondition?: boolean | undefined
    __isAggregate?: boolean | undefined
    __aggregatedArrayColumns?: __AggregatedArrayColumns | AnyValueSource | undefined
    __aggregatedArrayMode?: __AggregatedArrayMode | undefined
    __aggreagtedProjectingOptionalValuesAsNullable?: boolean | undefined
    __uuidString?: boolean | undefined

    constructor(optionalType: OptionalType, typeAdapter: TypeAdapter | undefined, aggregatedArrayColumns?: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode?: __AggregatedArrayMode, uuidString?: boolean, aggregatedProjectingOptionalValuesAsNullable?: boolean) {
        // The class created is the one of the data type (src/typeSystem), which extends this one at run time
        const typeClass = new.target as unknown as DataTypeClass
        this.__type = typeClass.type
        this.__customType = typeClass.customType
        this.__optionalType = optionalType
        this.__typeAdapter = typeAdapter
        if (aggregatedArrayColumns) {
            this.__aggregatedArrayColumns = aggregatedArrayColumns
            this.__aggregatedArrayMode = aggregatedArrayMode
            this.__aggreagtedProjectingOptionalValuesAsNullable = aggregatedProjectingOptionalValuesAsNullable
        }
        if (uuidString) {
            this.__uuidString = uuidString
        }
    }
    /** How this value source is written and what it reaches: the strategy of its node, shared by every value source of that node */
    declare __node: NodeStrategy<any>
    __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        return this.__node.__toSql(this, sqlBuilder, context, forceTypeCast)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        return this.__node.__toSqlForCondition(this, sqlBuilder, context, forceTypeCast)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__node.__addWiths(this, sqlBuilder, withs)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        this.__node.__registerTableOrView(this, sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        this.__node.__registerRequiredColumn(this, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return this.__node.__getOldValues(this, sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return this.__node.__getValuesForInsert(this, sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__node.__isAllowed(this, sqlBuilder)
    }
    __hasAggregation(sqlBuilder: HasIsValue): boolean {
        return this.__node.__hasAggregation(this, sqlBuilder)
    }
    isConstValue(): boolean {
        return this.__node.isConstValue(this)
    }
    getConstValue(): any {
        return this.__node.getConstValue(this)
    }
    allowWhen(when: boolean, error: string | Error): any {
        let result
        if (typeof error === 'string') {
            result = __newAllowWhenValueSource(when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'allowWhen' }, error), this)
        } else {
            result = __newAllowWhenValueSource(when, error, this)
        }
        if (this.__uuidString) {
            result.__uuidString = this.__uuidString
        }
        return result
    }
    disallowWhen(when: boolean, error: string | Error): any {
        let result
        if (typeof error === 'string') {
            result = __newAllowWhenValueSource(!when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'disallowWhen' }, error), this)
        } else {
            result = __newAllowWhenValueSource(!when, error, this)
        }
        if (this.__uuidString) {
            result.__uuidString = this.__uuidString
        }
        return result
    }
    asOptional(): any {
        const result = __newNoopValueSource(this, __typeClassOf(this), 'optional', this.__typeAdapter)
        if (this.__uuidString) {
            result.__uuidString = this.__uuidString
        }
        return result
    }
    asRequiredInOptionalObject(): any {
        const nodeAsRequiredInOptionalObject = this.__node.asRequiredInOptionalObject
        if (nodeAsRequiredInOptionalObject) {
            return nodeAsRequiredInOptionalObject(this)
        }
        const result = __newNoopValueSource(this, __typeClassOf(this), 'requiredInOptionalObject', this.__typeAdapter)
        if (this.__aggregatedArrayColumns) {
            result.__aggregatedArrayColumns = this.__aggregatedArrayColumns
            result.__aggregatedArrayMode = this.__aggregatedArrayMode
            result.__aggreagtedProjectingOptionalValuesAsNullable = this.__aggreagtedProjectingOptionalValuesAsNullable
        }
        if (this.__uuidString) {
            result.__uuidString = this.__uuidString
        }
        return result
    }
    useEmptyArrayForNoValue(): any {
        const result = __newNoopValueSource(this, __typeClassOf(this), 'required', this.__typeAdapter)
        if (this.__aggregatedArrayColumns) {
            result.__aggregatedArrayColumns = this.__aggregatedArrayColumns
            result.__aggregatedArrayMode = this.__aggregatedArrayMode
            result.__aggreagtedProjectingOptionalValuesAsNullable = this.__aggreagtedProjectingOptionalValuesAsNullable
        }
        if (this.__uuidString) {
            result.__uuidString = this.__uuidString
        }
        return result
    }
    asOptionalNonEmptyArray(): any {
        const result = __newNoopValueSource(this, __typeClassOf(this), 'optional', this.__typeAdapter)
        if (this.__aggregatedArrayColumns) {
            result.__aggregatedArrayColumns = this.__aggregatedArrayColumns
            result.__aggregatedArrayMode = this.__aggregatedArrayMode
            result.__aggreagtedProjectingOptionalValuesAsNullable = this.__aggreagtedProjectingOptionalValuesAsNullable
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
        return condition(__newSqlOperationIsNullValueSource('_isNull', this, __builtInTypeOf(this, 'boolean'), 'required', this.__typeAdapter))
    }
    isNotNull(): any {
        return condition(__newSqlOperationIsNullValueSource('_isNotNull', this, __builtInTypeOf(this, 'boolean'), 'required', this.__typeAdapter))
    }
    // SqlComparator1
    equalsIfValue(value: any): any {
        return condition(__newSqlOperation1ValueSourceIfValueOrNoop('_equals', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    equals(value: any): any {
        return condition(__newSqlOperation1ValueSource('_equals', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEqualsIfValue(value: any): any {
        return condition(__newSqlOperation1ValueSourceIfValueOrNoop('_notEquals', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notEquals(value: any): any {
        return condition(__newSqlOperation1ValueSource('_notEquals', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    /* The `is`/`isNot` family is a TOTAL predicate: `IS [NOT] DISTINCT FROM` (and the per-dialect emulation of it)
     * answers true or false even when an operand is NULL — which is the reason to reach for it instead of `equals`.
     * So the result is ALWAYS `'required'`, whatever the receiver and the operand are. Merging them, the way an
     * ordinary comparison does (`getOptionalType2`), would report a NULL the operator cannot produce, and that
     * over-report reaches the SQL: the dialects with no native boolean in a projected position would emit the
     * 3-branch `case … else null end` with an unreachable branch. The `*IfValue` twins carry the same `'required'`
     * into the neutral they become when the operand has no value — a neutral inherits the optional type of the
     * expression it stands for, and for a total predicate that is `'required'`. */
    isIfValue(value: any): any {
        return condition(__newSqlOperation1ValueSourceIfValueOrNoop('_is', this, value, __builtInTypeOf(this, 'boolean'), 'required', getTypeAdapter2(this, value)))
    }
    is(value: any): any {
        return condition(__newSqlOperation1NotOptionalValueSource('_is', this, value, __builtInTypeOf(this, 'boolean'), 'required', getTypeAdapter2(this, value)))
    }
    isNotIfValue(value: any): any {
        return condition(__newSqlOperation1ValueSourceIfValueOrNoop('_isNot', this, value, __builtInTypeOf(this, 'boolean'), 'required', getTypeAdapter2(this, value)))
    }
    isNot(value: any): any {
        return condition(__newSqlOperation1NotOptionalValueSource('_isNot', this, value, __builtInTypeOf(this, 'boolean'), 'required', getTypeAdapter2(this, value)))
    }
    asString(): any {
        const result = __newSqlOperation0ValueSource('_asString', this, __builtInTypeOf(this, 'string'), this.__optionalType, this.__typeAdapter)
        result.__uuidString = __isUuid(this.__type, this.__customType)
        return result
    }
    onlyWhenOrNull(when: boolean): any {
        if (when) {
            return this
        } else {
            return __newNullValueSource(__typeClassOf(this), 'optional', this.__typeAdapter)
        }
    }
    ignoreWhenAsNull(when: boolean): any {
        if (when) {
            return __newNullValueSource(__typeClassOf(this), 'optional', this.__typeAdapter)
        } else {
            return this
        }
    }
    lessThanIfValue(value: any): any {
        return condition(__newSqlOperation1ValueSourceIfValueOrNoop('_lessThan', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    lessThan(value: any): any {
        return condition(__newSqlOperation1ValueSource('_lessThan', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    greaterThanIfValue(value: any): any {
        return condition(__newSqlOperation1ValueSourceIfValueOrNoop('_greaterThan', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    greaterThan(value: any): any {
        return condition(__newSqlOperation1ValueSource('_greaterThan', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    lessOrEqualIfValue(value: any): any {
        return condition(__newSqlOperation1ValueSourceIfValueOrNoop('_lessOrEqual', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    lessOrEqual(value: any): any {
        return condition(__newSqlOperation1ValueSource('_lessOrEqual', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    greaterOrEqualIfValue(value: any): any {
        return condition(__newSqlOperation1ValueSourceIfValueOrNoop('_greaterOrEqual', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    greaterOrEqual(value: any): any {
        return condition(__newSqlOperation1ValueSource('_greaterOrEqual', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    inIfValue(value: any): any {
        return condition(__newSqlOperationInValueSourceIfValueOrNoop('_in', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    in(value: any): any {
        return condition(__newSqlOperationInValueSource('_in', this, value, __builtInTypeOf(this, 'boolean'), getOptionalTypeOfIn(this, value), getTypeAdapter2(this, value)))
    }
    notInIfValue(value: any): any {
        return condition(__newSqlOperationInValueSourceIfValueOrNoop('_notIn', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    notIn(value: any): any {
        return condition(__newSqlOperationInValueSource('_notIn', this, value, __builtInTypeOf(this, 'boolean'), getOptionalTypeOfIn(this, value), getTypeAdapter2(this, value)))
    }
    inN(...value: any[]): any {
        return condition(__newSqlOperationInValueSource('_in', this, value, __builtInTypeOf(this, 'boolean'), getOptionalTypeN(this, value), getTypeAdapter2(this, value)))
    }
    notInN(...value: any[]): any {
        return condition(__newSqlOperationInValueSource('_notIn', this, value, __builtInTypeOf(this, 'boolean'), getOptionalTypeN(this, value), getTypeAdapter2(this, value)))
    }
    // SqlComparator2
    between(value: any, value2: any): any {
        return condition(__newSqlOperation2ValueSource('_between', this, value, value2, __builtInTypeOf(this, 'boolean'), getOptionalType3(this, value, value2), getTypeAdapter3(this, value, value2)))
    }
    notBetween(value: any, value2: any): any {
        return condition(__newSqlOperation2ValueSource('_notBetween', this, value, value2, __builtInTypeOf(this, 'boolean'), getOptionalType3(this, value, value2), getTypeAdapter3(this, value, value2)))
    }
    // SqlFunctionStatic: never used here
    // SqlFunction0
    // Boolean
    negate(): any {
        return condition(__newSqlOperation0ValueSource('_negate', this, __builtInTypeOf(this, 'boolean'), this.__optionalType, this.__typeAdapter))
    }
    onlyWhen(condition: boolean): any {
        if (condition) {
            return this
        } else {
            return __newSqlOperationValueSourceIfValueAlwaysNoop(__builtInTypeOf(this, 'boolean'), this.__optionalType)
        }
    }
    ignoreWhen(condition: boolean): any {
        if (condition) {
            return __newSqlOperationValueSourceIfValueAlwaysNoop(__builtInTypeOf(this, 'boolean'), this.__optionalType)
        } else {
            return this
        }
    }
    trueWhenNoValue(): any {
        const result = __newBooleanValueWhenNoValueValueSource('_true', this, __builtInTypeOf(this, 'boolean'), this.__optionalType, this.__typeAdapter)
        result.__isBooleanForCondition = this.__isBooleanForCondition
        return result
    }
    falseWhenNoValue(): any {
        const result = __newBooleanValueWhenNoValueValueSource('_false', this, __builtInTypeOf(this, 'boolean'), this.__optionalType, this.__typeAdapter)
        result.__isBooleanForCondition = this.__isBooleanForCondition
        return result
    }
    valueWhenNoValue(value: any): any {
        const nodeValueWhenNoValue = this.__node.valueWhenNoValue
        if (nodeValueWhenNoValue) {
            return nodeValueWhenNoValue(this, value)
        }
        if (value === true) {
            return this.trueWhenNoValue()
        }
        if (value === false) {
            return this.falseWhenNoValue()
        }

        const result = __newValueWhenNoValueValueSource(value, this, __builtInTypeOf(this, 'boolean'), mergeOptional(this.__optionalType, __getValueSourcePrivate(value).__optionalType), this.__typeAdapter)
        result.__isBooleanForCondition = this.__isBooleanForCondition
        return result
    }
    // String
    // Number functions
    asDouble(): any {
        return __newSqlOperation0ValueSource('_asDouble', this, __builtInTypeOf(this, 'double'), this.__optionalType, this.__typeAdapter)
    }
    asInt(): any { // test function
        if (this.__customType === undefined && this.__type === 'double') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return __newSqlOperation0ValueSource('_asInt', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
        }
        return __newNoopValueSource(this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
    }
    asBigint(): any {
        if (this.__customType === undefined && this.__type === 'double') {
            // Unsafe cast, it happens when TypeSafe is not in use, we round the value
            return __newSqlOperation0ValueSource('_asBigint', this, __builtInTypeOf(this, 'bigint'), this.__optionalType, this.__typeAdapter)
        }
        return __newNoopValueSource(this, __builtInTypeOf(this, 'bigint'), this.__optionalType, this.__typeAdapter)
    }
    abs(): any {
        return __newSqlOperation0ValueSource('_abs', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
    }
    ceil(): any {
        if (this.__customType === undefined && this.__type === 'bigint') {
            return __newSqlOperation0ValueSource('_ceil', this, __builtInTypeOf(this, 'bigint'), this.__optionalType, this.__typeAdapter)
        } else if (this.__customType === 'customInt' || this.__customType === 'customBigint' || this.__customType === 'customDouble' || __isExactDecimal(this.__type, this.__customType)) {
            return __newSqlOperation0ValueSource('_ceil', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_ceil', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
        }
    }
    floor(): any {
        if (this.__customType === undefined && this.__type === 'bigint') {
            return __newSqlOperation0ValueSource('_floor', this, __builtInTypeOf(this, 'bigint'), this.__optionalType, this.__typeAdapter)
        } else if (this.__customType === 'customInt' || this.__customType === 'customBigint' || this.__customType === 'customDouble' || __isExactDecimal(this.__type, this.__customType)) {
            return __newSqlOperation0ValueSource('_floor', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_floor', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
        }
    }
    round(): any {
        if (this.__customType === undefined && this.__type === 'bigint') {
            return __newSqlOperation0ValueSource('_round', this, __builtInTypeOf(this, 'bigint'), this.__optionalType, this.__typeAdapter)
        } else if (this.__customType === 'customInt' || this.__customType === 'customBigint' || this.__customType === 'customDouble' || __isExactDecimal(this.__type, this.__customType)) {
            return __newSqlOperation0ValueSource('_round', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_round', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
        }
    }
    exp(): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation0ValueSource('_exp', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_exp', this, __builtInTypeOf(this, 'double'), this.__optionalType, this.__typeAdapter)
        }
    }
    ln(): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation0ValueSource('_ln', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_ln', this, __builtInTypeOf(this, 'double'), this.__optionalType, this.__typeAdapter)
        }
    }
    log10(): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation0ValueSource('_log10', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_log10', this, __builtInTypeOf(this, 'double'), this.__optionalType, this.__typeAdapter)
        }
    }
    sqrt(): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation0ValueSource('_sqrt', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_sqrt', this, __builtInTypeOf(this, 'double'), this.__optionalType, this.__typeAdapter)
        }
    }
    cbrt(): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation0ValueSource('_cbrt', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_cbrt', this, __builtInTypeOf(this, 'double'), this.__optionalType, this.__typeAdapter)
        }
    }
    sign(): any {
        return __newSqlOperation0ValueSource('_sign', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
    }
    // Trigonometric Functions
    acos(): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation0ValueSource('_acos', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_acos', this, __builtInTypeOf(this, 'double'), this.__optionalType, this.__typeAdapter)
        }
    }
    asin(): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation0ValueSource('_asin', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_asin', this, __builtInTypeOf(this, 'double'), this.__optionalType, this.__typeAdapter)
        }
    }
    atan(): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation0ValueSource('_atan', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_atan', this, __builtInTypeOf(this, 'double'), this.__optionalType, this.__typeAdapter)
        }
    }
    cos(): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation0ValueSource('_cos', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_cos', this, __builtInTypeOf(this, 'double'), this.__optionalType, this.__typeAdapter)
        }
    }
    cot(): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation0ValueSource('_cot', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_cot', this, __builtInTypeOf(this, 'double'), this.__optionalType, this.__typeAdapter)
        }
    }
    sin(): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation0ValueSource('_sin', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_sin', this, __builtInTypeOf(this, 'double'), this.__optionalType, this.__typeAdapter)
        }
    }
    tan(): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation0ValueSource('_tan', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
        } else {
            return __newSqlOperation0ValueSource('_tan', this, __builtInTypeOf(this, 'double'), this.__optionalType, this.__typeAdapter)
        }
    }
    // Date & Time Functions
    getDate(): any {
        return __newSqlOperation0ValueSource('_getDate', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
    }
    getTime(): any {
        return __newSqlOperation0ValueSource('_getTime', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
    }
    getFullYear(): any {
        return __newSqlOperation0ValueSource('_getFullYear', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
    }
    getMonth(): any {
        return __newSqlOperation0ValueSource('_getMonth', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
    }
    getDay(): any {
        return __newSqlOperation0ValueSource('_getDay', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
    }
    getHours(): any {
        return __newSqlOperation0ValueSource('_getHours', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
    }
    getMinutes(): any {
        return __newSqlOperation0ValueSource('_getMinutes', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
    }
    getSeconds(): any {
        return __newSqlOperation0ValueSource('_getSeconds', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
    }
    getMilliseconds(): any {
        return __newSqlOperation0ValueSource('_getMilliseconds', this, __builtInTypeOf(this, 'int'), this.__optionalType, this.__typeAdapter)
    }
    // SqlFunction1
    valueWhenNull(value: any): any {
        let typeClass = __typeClassOf(this)
        // Promote the declared numeric type from the fallback operand, the same way the
        // overloaded-number operations do (createSqlOperation1ofOverloadedNumber): an `int`
        // receiver with a `double` fallback emits `coalesce(<int>, <double>)`, which the
        // engine resolves to the wider `double`, so a NULL int row legitimately returns the
        // double's fraction. Without this promotion the result is still declared `int` and
        // the marshaller's int arm rejects that valid value (INVALID_VALUE_RECEIVED_FROM_DATABASE).
        // Only a plain `int` receiver needs widening — a double/bigint/customInt/customBigint/customDouble
        // receiver already carries the wider-or-matching type, and the compile-time signature
        // only admits a same-`typeName` operand.
        //
        // A fractional NUMBER LITERAL widens for exactly the same reason. TypeScript cannot tell
        // `2` from `2.5` — both are `number`, there is no integer literal type — so this decision
        // belongs to the runtime half, which has the value in hand; `_getWidenedArgumentType` binds
        // the operand with the matching type, and the two have to agree or the fraction is rejected
        // on one of the two crossings.
        if (this.__customType === undefined && this.__type === 'int') {
            if (isValueSource(value)) {
                const operandPrivate = __getValueSourcePrivate(value)
                if (__isDouble(operandPrivate.__type, operandPrivate.__customType)) {
                    typeClass = __builtInTypeOf(this, 'double')
                }
            } else if (typeof value === 'number' && !Number.isInteger(value)) {
                typeClass = __builtInTypeOf(this, 'double')
            }
        }
        let typeAdapter = getTypeAdapter2(this, value)
        if (typeAdapter instanceof OracleDateAsTimestampTypeAdapter && !(this.__typeAdapter instanceof OracleDateAsTimestampTypeAdapter && isValueSource(value) && __getValueSourcePrivate(value).__typeAdapter instanceof OracleDateAsTimestampTypeAdapter)) {
            // Oracle's nvl has the type of its first operand: a DATE read as a timestamp with something else is
            // turned into a TIMESTAMP there, and any other first operand already decides the type. Two of them stay a
            // DATE, and the result keeps the adapter
            typeAdapter = undefined
        }
        return __newSqlOperationValueWhenNullValueSource(this, value, typeClass, getOptionalType2(this, value), typeAdapter)
    }
    nullIfValue(value: any): any {
        return __newSqlOperation1ValueSource('_nullIfValue', this, value, __typeClassOf(this), 'optional', getTypeAdapter2(this, value))
    }
    and(value: any): any {
        return condition(__newSqlOperation1ValueSource('_and', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    or(value: any): any {
        return condition(__newSqlOperation1ValueSource('_or', this, value, __builtInTypeOf(this, 'boolean'), getOptionalType2(this, value), getTypeAdapter2(this, value)))
    }
    // Trigonometric Functions
    atan2(value: any): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation1ValueSource('_atan2', this, value, __typeClassOf(this), getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return __newSqlOperation1ValueSource('_atan2', this, value, __builtInTypeOf(this, 'double'), getOptionalType2(this, value), getTypeAdapter2(this, value))
        }
    }
    // String Functions
    // Number
    power(value: any): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation1ValueSource('_power', this, value, __typeClassOf(this), getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return __newSqlOperation1ValueSource('_power', this, value, __builtInTypeOf(this, 'double'), getOptionalType2(this, value), getTypeAdapter2(this, value))
        }
    }
    logn(value: any): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation1ValueSource('_logn', this, value, __typeClassOf(this), getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return __newSqlOperation1ValueSource('_logn', this, value, __builtInTypeOf(this, 'double'), getOptionalType2(this, value), getTypeAdapter2(this, value))
        }
    }
    roundn(value: any): any {
        if (this.__customType === 'customDouble' || __isExactDecimal(this.__type, this.__customType)) {
            return __newSqlOperation1ValueSource('_roundn', this, value, __typeClassOf(this), getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return __newSqlOperation1ValueSource('_roundn', this, value, __builtInTypeOf(this, 'double'), getOptionalType2(this, value), getTypeAdapter2(this, value))
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
    subtract(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_subtract')
    }
    multiply(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_multiply')
    }
    divide(value: any): any {
        if (this.__customType === 'customDouble') {
            return __newSqlOperation1ValueSource('_divide', this, value, __typeClassOf(this), getOptionalType2(this, value), getTypeAdapter2(this, value))
        } else {
            return __newSqlOperation1ValueSource('_divide', this, value, __builtInTypeOf(this, 'double'), getOptionalType2(this, value), getTypeAdapter2(this, value))
        }
    }
    modulo(value: any): any {
        return createSqlOperation1ofOverloadedNumber(this, value, '_modulo')
    }
    // SqlFunction2
    // The marks of a column of a table, a view or values (a value source with the node of a column, DBColumnImpl.ts)
    __asColumn(this: __ColumnPrivate): any {
        this.__writable = true
        return this
    }
    __asOptionalColumn(this: __ColumnPrivate): any {
        this.__writable = true
        this.__optionalType = 'optional'
        return this
    }
    __asOptional(this: __ColumnPrivate): any {
        // View counterpart to `__asOptionalColumn`: marks the optional type without flipping `__writable`. Views are
        // read-only, so their columns must not be treated as writable internally (the `extras/utils` helpers also
        // filter by table type, but this keeps the column's runtime state coherent with its public type).
        this.__optionalType = 'optional'
        return this
    }
    __asColumnWithDefaultValue(this: __ColumnPrivate): any {
        this.__writable = true
        this.__hasDefault = true
        return this
    }
    __asOptionalColumnWithDefaultValue(this: __ColumnPrivate): any {
        this.__writable = true
        this.__optionalType = 'optional'
        this.__hasDefault = true
        return this
    }
    __asAutogeneratedPrimaryKey(this: __ColumnPrivate): any {
        this.__writable = true
        this.__hasDefault = true
        this.__isPrimaryKey = true
        this.__isAutogeneratedPrimaryKey = true
        return this
    }
    __asAutogeneratedPrimaryKeyBySequence(this: __ColumnPrivate, sequenceName: string): any {
        this.__writable = true
        this.__hasDefault = true
        this.__isPrimaryKey = true
        this.__isAutogeneratedPrimaryKey = true
        this.__sequenceName = sequenceName
        return this
    }
    __asPrimaryKey(this: __ColumnPrivate): any {
        this.__writable = true
        this.__isPrimaryKey = true
        return this
    }
    __asComputedColumn(this: __ColumnPrivate): any {
        this.__isComputed = true
        return this
    }
    __asOptionalComputedColumn(this: __ColumnPrivate): any {
        this.__isComputed = true
        this.__optionalType = 'optional'
        return this
    }
    // Oracle recursive
    __prior(): any {
        return __newSqlOperation0ValueSource('_prior', this, __typeClassOf(this), this.__optionalType, this.__typeAdapter)
    }
}

export interface SqlOperationStatic0ValueSource extends ValueSourceImpl, HasOperation {
    __operation: keyof SqlOperationStatic0
}

export const sqlOperationStatic0ValueSourceNode: NodeStrategy<SqlOperationStatic0ValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationStatic0ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context)
    },
}

export function __newSqlOperationStatic0ValueSource(operation: keyof SqlOperationStatic0, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperationStatic0ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperationStatic0ValueSource
    vs.__node = sqlOperationStatic0ValueSourceNode

    vs.__operation = operation
    return vs
}

export interface SqlOperationStaticBooleanValueSource extends ValueSourceImpl, HasOperation {
    __operation: keyof SqlOperationStatic0
}

export const sqlOperationStaticBooleanValueSourceNode: NodeStrategy<SqlOperationStaticBooleanValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationStaticBooleanValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context)
    },
    __toSqlForCondition(vs: SqlOperationStaticBooleanValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        if (vs.__operation === '_true') {
            return sqlBuilder._trueForCondition(context)
        } else {
            return sqlBuilder._falseForCondition(context)
        }
    },
}

export function __newSqlOperationStaticBooleanValueSource(operation: '_true' | '_false', typeClass: DataTypeClass): SqlOperationStaticBooleanValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)('required', undefined) as SqlOperationStaticBooleanValueSource
    vs.__node = sqlOperationStaticBooleanValueSourceNode

    vs.__operation = operation
    return vs
}

export interface BooleanValueWhenNoValueValueSource extends ValueSourceImpl, HasOperation {
    __valueSource: ValueSourceImpl
    __operation: '_true' | '_false'
}

export const booleanValueWhenNoValueValueSourceNode: NodeStrategy<BooleanValueWhenNoValueValueSource> = {
    ...valueSourceNode,
    __toSql(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        const sql = vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
        if (sql) {
            return sql
        }

        // No value
        return sqlBuilder[vs.__operation](context)
    },
    __toSqlForCondition(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        const sql = vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
        if (sql) {
            return sql
        }

        // No value
        if (vs.__operation === '_true') {
            return sqlBuilder._trueForCondition(context)
        } else {
            return sqlBuilder._falseForCondition(context)
        }
    },
    __addWiths(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: BooleanValueWhenNoValueValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder)
    },
}

export function __newBooleanValueWhenNoValueValueSource(operation: '_true' | '_false', valueSource: ValueSourceImpl, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): BooleanValueWhenNoValueValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as BooleanValueWhenNoValueValueSource
    vs.__node = booleanValueWhenNoValueValueSourceNode

    vs.__valueSource = valueSource
    vs.__operation = operation
    return vs
}

export interface ValueWhenNoValueValueSource extends ValueSourceImpl {
    __valueSource: ValueSourceImpl
    __valueWhenNoValue: __ValueSourcePrivate & ToSql
}

export const valueWhenNoValueValueSourceNode: NodeStrategy<ValueWhenNoValueValueSource> = {
    ...valueSourceNode,
    __toSql(vs: ValueWhenNoValueValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        const sql = vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
        if (sql) {
            return sql
        }

        // No value
        return vs.__valueWhenNoValue.__toSql(sqlBuilder, context, forceTypeCast)
    },
    __toSqlForCondition(vs: ValueWhenNoValueValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        const sql = vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
        if (sql) {
            return sql
        }

        // No value
        return vs.__valueWhenNoValue.__toSqlForCondition(sqlBuilder, context, forceTypeCast)
    },
    __addWiths(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        vs.__valueWhenNoValue.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        vs.__valueWhenNoValue.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        vs.__valueWhenNoValue.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder) || vs.__valueWhenNoValue.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder) || vs.__valueWhenNoValue.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder) && vs.__valueWhenNoValue.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: ValueWhenNoValueValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder) || vs.__valueWhenNoValue.__hasAggregation(sqlBuilder)
    },
}

export function __newValueWhenNoValueValueSource(valueWhenNoValue: __ValueSourcePrivate & ToSql, valueSource: ValueSourceImpl, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): ValueWhenNoValueValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as ValueWhenNoValueValueSource
    vs.__node = valueWhenNoValueValueSourceNode

    vs.__valueSource = valueSource
    vs.__valueWhenNoValue = valueWhenNoValue
    return vs
}

export interface SqlOperationStatic1ValueSource extends ValueSourceImpl, HasOperation {
    __operation: keyof SqlOperationStatic1
    __value: any
}

export const sqlOperationStatic1ValueSourceNode: NodeStrategy<SqlOperationStatic1ValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationStatic1ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, vs.__value, vs.__type, vs.__customType, vs.__typeAdapter, forceTypeCast)
    },
    __addWiths(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue): boolean {
        return __isAllowed(vs.__value, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperationStatic1ValueSource, sqlBuilder: HasIsValue): boolean {
        return __hasAggregation(vs.__value, sqlBuilder)
    },
}

export function __newSqlOperationStatic1ValueSource(operation: keyof SqlOperationStatic1, value: any, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperationStatic1ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperationStatic1ValueSource
    vs.__node = sqlOperationStatic1ValueSourceNode

    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperationConstValueSource extends ValueSourceImpl, HasOperation {
    __operation: keyof SqlOperationStatic1
    __value: any
    // Set on a copy (see SqlBuilder._typedOperand) when the const is an operand nothing else gives a type to
    __forceTypeCast?: boolean | undefined
}

export const sqlOperationConstValueSourceNode: NodeStrategy<SqlOperationConstValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationConstValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (vs.__forceTypeCast) {
            return sqlBuilder._typedConst(context, vs.__value, vs.__type, vs.__customType, vs.__typeAdapter)
        }
        return sqlBuilder._const(context, vs.__value, vs.__type, vs.__customType, vs.__typeAdapter, forceTypeCast)
    },
    __toSqlForCondition(vs: SqlOperationConstValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (vs.__forceTypeCast) {
            return sqlBuilder._typedConstForCondition(context, vs.__value, vs.__type, vs.__customType, vs.__typeAdapter)
        }
        return sqlBuilder._constForCondition(context, vs.__value, vs.__type, vs.__customType, vs.__typeAdapter, forceTypeCast)
    },
    isConstValue(_vs: SqlOperationConstValueSource): boolean {
        return true
    },
    getConstValue(vs: SqlOperationConstValueSource): any {
        return vs.__value
    },
    __addWiths(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue,withs: Array<IWithView<any>>): void {
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue): boolean {
        return __isAllowed(vs.__value, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperationConstValueSource, sqlBuilder: HasIsValue): boolean {
        return __hasAggregation(vs.__value, sqlBuilder)
    },
}

export function __newSqlOperationConstValueSource(value: any, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperationConstValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperationConstValueSource
    vs.__node = sqlOperationConstValueSourceNode

    vs.__operation = '_const'
    vs.__value = value
    return vs
}

export interface SqlOperation0ValueSource extends ValueSourceImpl, HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlFunction0 | keyof SqlBoolean0
}

export const sqlOperation0ValueSourceNode: NodeStrategy<SqlOperation0ValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperation0ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, vs.__valueSource)
    },
    __addWiths(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: SqlOperation0ValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder)
    },
}

export function __newSqlOperation0ValueSource(operation: keyof SqlFunction0 | keyof SqlBoolean0, valueSource: ValueSourceImpl, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperation0ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperation0ValueSource
    vs.__node = sqlOperation0ValueSourceNode

    vs.__valueSource = valueSource
    vs.__operation = operation
    return vs
}

export interface SqlOperationCollateValueSource extends ValueSourceImpl, HasOperation {
    __valueSource: ValueSourceImpl
    __operation: '_collate'
    __collation: string
}

export const sqlOperationCollateValueSourceNode: NodeStrategy<SqlOperationCollateValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationCollateValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._collate(context, vs.__valueSource, vs.__collation)
    },
    __addWiths(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: SqlOperationCollateValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder)
    },
}

export function __newSqlOperationCollateValueSource(valueSource: ValueSourceImpl, collation: string, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperationCollateValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperationCollateValueSource
    vs.__node = sqlOperationCollateValueSourceNode
    vs.__operation = '_collate'

    vs.__valueSource = valueSource
    vs.__collation = collation
    return vs
}

export interface SqlOperationIsNullValueSource extends ValueSourceImpl, HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlComparator0
}

export const sqlOperationIsNullValueSourceNode: NodeStrategy<SqlOperationIsNullValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationIsNullValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, vs.__valueSource)
    },
    __addWiths(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: SqlOperationIsNullValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder)
    },
}

export function __newSqlOperationIsNullValueSource(operation: keyof SqlComparator0, valueSource: ValueSourceImpl, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperationIsNullValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperationIsNullValueSource
    vs.__node = sqlOperationIsNullValueSourceNode

    vs.__valueSource = valueSource
    vs.__operation = operation
    return vs
}

export interface SqlOperation1ValueSource extends ValueSourceImpl, HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any
}

export const sqlOperation1ValueSourceNode: NodeStrategy<SqlOperation1ValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperation1ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value], vs.__operation), vs.__value, vs.__valueSource.__type, vs.__valueSource.__customType, vs.__valueSource.__typeAdapter)
    },
    __addWiths(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(vs.__value, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperation1ValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder) || __hasAggregation(vs.__value, sqlBuilder)
    },
}

export function __newSqlOperation1ValueSource(operation: keyof SqlOperation1, valueSource: ValueSourceImpl, value: any, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperation1ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperation1ValueSource
    vs.__node = sqlOperation1ValueSourceNode

    vs.__valueSource = valueSource
    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperationInValueSource extends ValueSourceImpl, HasOperation {
    __valueSource: ValueSourceImpl
    __operation: '_in' | '_notIn'
    __value: any
}

export const sqlOperationInValueSourceNode: NodeStrategy<SqlOperationInValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationInValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value], vs.__operation), vs.__value, vs.__valueSource.__type, vs.__valueSource.__customType, vs.__valueSource.__typeAdapter)
    },
    __addWiths(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        const values = vs.__value
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
    },
    __registerTableOrView(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerTableOrView(values[i], sqlBuilder, requiredTablesOrViews)
            }
        } else {
            __registerTableOrView(values, sqlBuilder, requiredTablesOrViews)
        }
    },
    __registerRequiredColumn(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerRequiredColumn(values[i], sqlBuilder, requiredColumns, onlyForTablesOrViews)
            }
        } else {
            __registerRequiredColumn(values, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        }
    },
    __getOldValues(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        let result = vs.__valueSource.__getOldValues(sqlBuilder)
        if (result) {
            return result
        }
        const values = vs.__value
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
    },
    __getValuesForInsert(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        let result = vs.__valueSource.__getValuesForInsert(sqlBuilder)
        if (result) {
            return result
        }
        const values = vs.__value
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
    },
    __isAllowed(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue): boolean {
        let result = vs.__valueSource.__isAllowed(sqlBuilder)
        if (!result) {
            return false
        }
        const values = vs.__value
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
    },
    __hasAggregation(vs: SqlOperationInValueSource, sqlBuilder: HasIsValue): boolean {
        if (vs.__valueSource.__hasAggregation(sqlBuilder)) {
            return true
        }
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                if (__hasAggregation(values[i], sqlBuilder)) {
                    return true
                }
            }
            return false
        }
        return __hasAggregation(values, sqlBuilder)
    },
}

export function __newSqlOperationInValueSource(operation: '_in' | '_notIn', valueSource: ValueSourceImpl, value: any, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperationInValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperationInValueSource
    vs.__node = sqlOperationInValueSourceNode

    vs.__valueSource = valueSource
    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperationValueWhenNullValueSource extends ValueSourceImpl, HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any
}

export const sqlOperationValueWhenNullValueSourceNode: NodeStrategy<SqlOperationValueWhenNullValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value], vs.__operation), vs.__value, vs.__valueSource.__type, vs.__valueSource.__customType, vs.__valueSource.__typeAdapter)
    },
    __addWiths(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(vs.__value, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperationValueWhenNullValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder) || __hasAggregation(vs.__value, sqlBuilder)
    },
}

export function __newSqlOperationValueWhenNullValueSource(valueSource: ValueSourceImpl, value: any, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperationValueWhenNullValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperationValueWhenNullValueSource
    vs.__node = sqlOperationValueWhenNullValueSourceNode

    vs.__valueSource = valueSource
    vs.__operation = '_valueWhenNull'
    vs.__value = value
    return vs
}

export interface SqlOperation1NotOptionalValueSource extends ValueSourceImpl, HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any
}

export const sqlOperation1NotOptionalValueSourceNode: NodeStrategy<SqlOperation1NotOptionalValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value], vs.__operation), vs.__value, vs.__valueSource.__type, vs.__valueSource.__customType, vs.__valueSource.__typeAdapter)
    },
    __addWiths(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(vs.__value, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperation1NotOptionalValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder) || __hasAggregation(vs.__value, sqlBuilder)
    },
}

export function __newSqlOperation1NotOptionalValueSource(operation: keyof SqlOperation1, valueSource: ValueSourceImpl, value: any, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperation1NotOptionalValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperation1NotOptionalValueSource
    vs.__node = sqlOperation1NotOptionalValueSourceNode

    vs.__valueSource = valueSource
    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperation1ValueSourceIfValueOrNoop extends ValueSourceImpl, HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any
}

export const sqlOperation1ValueSourceIfValueOrNoopNode: NodeStrategy<SqlOperation1ValueSourceIfValueOrNoop> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperation1ValueSourceIfValueOrNoop, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        if (!sqlBuilder._isValue(vs.__value)) {
            return ''
        }
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value], vs.__operation), vs.__value, vs.__valueSource.__type, vs.__valueSource.__customType, vs.__valueSource.__typeAdapter)
    },
    __addWiths(vs: SqlOperation1ValueSourceIfValueOrNoop, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        if (!sqlBuilder._isValue(vs.__value)) {
            return
        }
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperation1ValueSourceIfValueOrNoop, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        if (!sqlBuilder._isValue(vs.__value)) {
            return
        }
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperation1ValueSourceIfValueOrNoop, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        if (!sqlBuilder._isValue(vs.__value)) {
            return
        }
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperation1ValueSourceIfValueOrNoop, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        if (!sqlBuilder._isValue(vs.__value)) {
            return undefined
        }
        return vs.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperation1ValueSourceIfValueOrNoop, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        if (!sqlBuilder._isValue(vs.__value)) {
            return undefined
        }
        return vs.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: SqlOperation1ValueSourceIfValueOrNoop, sqlBuilder: HasIsValue): boolean {
        if (!sqlBuilder._isValue(vs.__value)) {
            return true
        }
        return vs.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(vs.__value, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperation1ValueSourceIfValueOrNoop, sqlBuilder: HasIsValue): boolean {
        if (!sqlBuilder._isValue(vs.__value)) {
            return false
        }
        return vs.__valueSource.__hasAggregation(sqlBuilder) || __hasAggregation(vs.__value, sqlBuilder)
    },
}

export function __newSqlOperation1ValueSourceIfValueOrNoop(operation: keyof SqlOperation1, valueSource: ValueSourceImpl, value: any, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperation1ValueSourceIfValueOrNoop {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperation1ValueSourceIfValueOrNoop
    vs.__node = sqlOperation1ValueSourceIfValueOrNoopNode

    vs.__valueSource = valueSource
    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperationInValueSourceIfValueOrNoop extends ValueSourceImpl, HasOperation {
    __valueSource: ValueSourceImpl
    __operation: '_in' | '_notIn'
    __value: any
}

export const sqlOperationInValueSourceIfValueOrNoopNode: NodeStrategy<SqlOperationInValueSourceIfValueOrNoop> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperationInValueSourceIfValueOrNoop, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        if (!sqlBuilder._isValue(vs.__value)) {
            return ''
        }
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value], vs.__operation), vs.__value, vs.__valueSource.__type, vs.__valueSource.__customType, vs.__valueSource.__typeAdapter)
    },
    __addWiths(vs: SqlOperationInValueSourceIfValueOrNoop, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        if (!sqlBuilder._isValue(vs.__value)) {
            return
        }
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __addWiths(values[i], sqlBuilder, withs)
            }
        } else {
            __addWiths(values, sqlBuilder, withs)
        }
    },
    __registerTableOrView(vs: SqlOperationInValueSourceIfValueOrNoop, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        if (!sqlBuilder._isValue(vs.__value)) {
            return
        }
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerTableOrView(values[i], sqlBuilder, requiredTablesOrViews)
            }
        } else {
            __registerTableOrView(values, sqlBuilder, requiredTablesOrViews)
        }
    },
    __registerRequiredColumn(vs: SqlOperationInValueSourceIfValueOrNoop, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        if (!sqlBuilder._isValue(vs.__value)) {
            return
        }
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                __registerRequiredColumn(values[i], sqlBuilder, requiredColumns, onlyForTablesOrViews)
            }
        } else {
            __registerRequiredColumn(values, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        }
    },
    __getOldValues(vs: SqlOperationInValueSourceIfValueOrNoop, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        if (!sqlBuilder._isValue(vs.__value)) {
            return undefined
        }
        let result = vs.__valueSource.__getOldValues(sqlBuilder)
        if (result) {
            return result
        }
        const values = vs.__value
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
    },
    __getValuesForInsert(vs: SqlOperationInValueSourceIfValueOrNoop, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        if (!sqlBuilder._isValue(vs.__value)) {
            return undefined
        }
        let result = vs.__valueSource.__getValuesForInsert(sqlBuilder)
        if (result) {
            return result
        }
        const values = vs.__value
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
    },
    __isAllowed(vs: SqlOperationInValueSourceIfValueOrNoop, sqlBuilder: HasIsValue): boolean {
        if (!sqlBuilder._isValue(vs.__value)) {
            return true
        }
        let result = vs.__valueSource.__isAllowed(sqlBuilder)
        if (!result) {
            return false
        }
        const values = vs.__value
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
    },
    __hasAggregation(vs: SqlOperationInValueSourceIfValueOrNoop, sqlBuilder: HasIsValue): boolean {
        if (!sqlBuilder._isValue(vs.__value)) {
            return false
        }
        if (vs.__valueSource.__hasAggregation(sqlBuilder)) {
            return true
        }
        const values = vs.__value
        if (Array.isArray(values)) {
            for (let i = 0, length = values.length; i < length; i++) {
                if (__hasAggregation(values[i], sqlBuilder)) {
                    return true
                }
            }
            return false
        }
        return __hasAggregation(values, sqlBuilder)
    },
}

export function __newSqlOperationInValueSourceIfValueOrNoop(operation: '_in' | '_notIn', valueSource: ValueSourceImpl, value: any, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperationInValueSourceIfValueOrNoop {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperationInValueSourceIfValueOrNoop
    vs.__node = sqlOperationInValueSourceIfValueOrNoopNode

    vs.__valueSource = valueSource
    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperationValueSourceIfValueAlwaysNoop extends ValueSourceImpl {
}

/**
 * The neutral condition (no condition): written as an empty SQL, which whoever composes conditions skips (`_and`, `_or`,
 * the where); it reaches nothing. See "The operations that disappear without a value" in src/typeSystem/README.md
 */
export const sqlOperationValueSourceIfValueAlwaysNoopNode: NodeStrategy<SqlOperationValueSourceIfValueAlwaysNoop> = {
    ...valueSourceNode,
    valueWhenNoValue(vs: SqlOperationValueSourceIfValueAlwaysNoop, value: any): any {
        // The neutral element of the four-valued dynamic-boolean system
        // (true / false / null / neutral): the "ignore" value produced by
        // `dynamicBooleanExpressionUsing(...)`, `onlyWhen(false)` and
        // `ignoreWhen(true)`. It carries no value of its own, so
        // `valueWhenNoValue(value)` — which substitutes a value wherever one is
        // missing — always resolves to `value`, the expression placed in its
        // stead. A bare `true` / `false` is not an expression, so it becomes
        // the constant true / false condition.
        if (value === true) return vs.trueWhenNoValue()
        if (value === false) return vs.falseWhenNoValue()
        return value
    },
    __toSql(_vs: SqlOperationValueSourceIfValueAlwaysNoop, _sqlBuilder: SqlBuilder, _context: SqlBuildContext, _forceTypeCast: boolean): string {
        return ''
    },
}

/**
 * The optional type is the one of the boolean expression that was neutralised; the neutral is one more
 * possibility added to that boolean (true / false / null / neutral), it doesn't replace it, then neutralising it
 * must not drop the null that boolean admitted. When there is no previous boolean expression (the neutral used as
 * the initial value of a dynamic boolean expression), no null is possible yet, and 'required' (the identity of the
 * optional type merge) is the one that steps aside as soon as a real expression joins the expression.
 *
 * It has no default on purpose: dropping the optional type of the neutralised expression is precisely the mistake
 * this parameter exists to prevent, and a default would let the next construction site make it again in silence.
 * Each site says which of the two cases it is.
 */
export function __newSqlOperationValueSourceIfValueAlwaysNoop(typeClass: DataTypeClass, optionalType: OptionalType): SqlOperationValueSourceIfValueAlwaysNoop {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, undefined) as SqlOperationValueSourceIfValueAlwaysNoop
    vs.__node = sqlOperationValueSourceIfValueAlwaysNoopNode
    return vs
}

export interface SqlOperation1ValueSourceIfValueOrIgnore extends ValueSourceImpl, HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation1
    __value: any
}

export const sqlOperation1ValueSourceIfValueOrIgnoreNode: NodeStrategy<SqlOperation1ValueSourceIfValueOrIgnore> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperation1ValueSourceIfValueOrIgnore, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (!sqlBuilder._isValue(vs.__value)) {
            return vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
        }
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value], vs.__operation), vs.__value, vs.__valueSource.__type, vs.__valueSource.__customType, vs.__valueSource.__typeAdapter)
    },
    __addWiths(vs: SqlOperation1ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperation1ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperation1ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperation1ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperation1ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: SqlOperation1ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(vs.__value, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperation1ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder) || __hasAggregation(vs.__value, sqlBuilder)
    },
}

export function __newSqlOperation1ValueSourceIfValueOrIgnore(operation: keyof SqlOperation1, valueSource: ValueSourceImpl, value: any, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SqlOperation1ValueSourceIfValueOrIgnore {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperation1ValueSourceIfValueOrIgnore
    vs.__node = sqlOperation1ValueSourceIfValueOrIgnoreNode

    vs.__valueSource = valueSource
    vs.__operation = operation
    vs.__value = value
    return vs
}

export interface SqlOperation2ValueSource extends ValueSourceImpl, HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation2
    __value: any
    __value2: any
}

export const sqlOperation2ValueSourceNode: NodeStrategy<SqlOperation2ValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperation2ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value, vs.__value2], vs.__operation), vs.__value, vs.__value2, vs.__valueSource.__type, vs.__valueSource.__customType, vs.__valueSource.__typeAdapter)
    },
    __addWiths(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(vs.__value, sqlBuilder, withs)
        __addWiths(vs.__value2, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value2, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value2, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(vs.__value, sqlBuilder) || __getOldValues(vs.__value2, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(vs.__value, sqlBuilder) || __getValuesForInsert(vs.__value2, sqlBuilder)
    },
    __isAllowed(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(vs.__value, sqlBuilder) && __isAllowed(vs.__value2, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperation2ValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder) || __hasAggregation(vs.__value, sqlBuilder) || __hasAggregation(vs.__value2, sqlBuilder)
    },
}

export function __newSqlOperation2ValueSource(operation: keyof SqlOperation2, valueSource: ValueSourceImpl, value: any, value2: any, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter?: TypeAdapter | undefined): SqlOperation2ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperation2ValueSource
    vs.__node = sqlOperation2ValueSourceNode

    vs.__valueSource = valueSource
    vs.__operation = operation
    vs.__value = value
    vs.__value2 = value2
    return vs
}

export interface SqlOperation2ValueSourceIfValueOrIgnore extends ValueSourceImpl, HasOperation {
    __valueSource: ValueSourceImpl
    __operation: keyof SqlOperation2
    __value: any
    __value2: any
}

export const sqlOperation2ValueSourceIfValueOrIgnoreNode: NodeStrategy<SqlOperation2ValueSourceIfValueOrIgnore> = {
    ...valueSourceNode,
    __toSql(vs: SqlOperation2ValueSourceIfValueOrIgnore, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (!sqlBuilder._isValue(vs.__value)) {
            return vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
        }
        if (!sqlBuilder._isValue(vs.__value2)) {
            return vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
        }
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__valueSource, [vs.__value, vs.__value2], vs.__operation), vs.__value, vs.__value2, vs.__valueSource.__type, vs.__valueSource.__customType, vs.__valueSource.__typeAdapter)
    },
    __addWiths(vs: SqlOperation2ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
        __addWiths(vs.__value, sqlBuilder, withs)
        __addWiths(vs.__value2, sqlBuilder, withs)
    },
    __registerTableOrView(vs: SqlOperation2ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
        __registerTableOrView(vs.__value2, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: SqlOperation2ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(vs.__value2, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: SqlOperation2ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder) || __getOldValues(vs.__value, sqlBuilder) || __getOldValues(vs.__value2, sqlBuilder)
    },
    __getValuesForInsert(vs: SqlOperation2ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(vs.__value, sqlBuilder) || __getValuesForInsert(vs.__value2, sqlBuilder)
    },
    __isAllowed(vs: SqlOperation2ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder) && __isAllowed(vs.__value, sqlBuilder) && __isAllowed(vs.__value2, sqlBuilder)
    },
    __hasAggregation(vs: SqlOperation2ValueSourceIfValueOrIgnore, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder) || __hasAggregation(vs.__value, sqlBuilder) || __hasAggregation(vs.__value2, sqlBuilder)
    },
}

export function __newSqlOperation2ValueSourceIfValueOrIgnore(operation: keyof SqlOperation2, valueSource: ValueSourceImpl, value: any, value2: any, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter?: TypeAdapter | undefined): SqlOperation2ValueSourceIfValueOrIgnore {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SqlOperation2ValueSourceIfValueOrIgnore
    vs.__node = sqlOperation2ValueSourceIfValueOrIgnoreNode

    vs.__valueSource = valueSource
    vs.__operation = operation
    vs.__value = value
    vs.__value2 = value2
    return vs
}

export interface NoopValueSource extends ValueSourceImpl {
    __valueSource: ValueSourceImpl
}

export const noopValueSourceNode: NodeStrategy<NoopValueSource> = {
    ...valueSourceNode,
    __toSql(vs: NoopValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        return vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
    },
    __addWiths(vs: NoopValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: NoopValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: NoopValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: NoopValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: NoopValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: NoopValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: NoopValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__valueSource.__hasAggregation(sqlBuilder)
    },
}

export function __newNoopValueSource(valueSource: ValueSourceImpl, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): NoopValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as NoopValueSource
    vs.__node = noopValueSourceNode

    vs.__valueSource = valueSource
    return vs
}

export interface SequenceValueSource extends ValueSourceImpl {
    __operation: keyof SqlSequenceOperation
    __sequenceName: string
}

export const sequenceValueSourceNode: NodeStrategy<SequenceValueSource> = {
    ...valueSourceNode,
    __toSql(vs: SequenceValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, vs.__sequenceName, vs.__type, vs.__customType)
    },
}

export function __newSequenceValueSource(operation: keyof SqlSequenceOperation, sequenceName: string, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): SequenceValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as SequenceValueSource
    vs.__node = sequenceValueSourceNode

    vs.__operation = operation
    vs.__sequenceName = sequenceName
    return vs
}

export interface FragmentValueSource extends ValueSourceImpl {
    __operation: keyof SqlFragmentOperation
    __sql: TemplateStringsArray
    __sqlParams: AnyValueSource[]
}

export const fragmentValueSourceNode: NodeStrategy<FragmentValueSource> = {
    ...valueSourceNode,
    __toSql(vs: FragmentValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._fragment(context, vs.__sql, vs.__sqlParams)
    },
    __addWiths(vs: FragmentValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        const sqlParams = vs.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            value.__addWiths(sqlBuilder, withs)
        }
    },
    __registerTableOrView(vs: FragmentValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        const sqlParams = vs.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            value.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        }
    },
    __registerRequiredColumn(vs: FragmentValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        const sqlParams = vs.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            value.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
        }
    },
    __getOldValues(vs: FragmentValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        const sqlParams = vs.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            const result = value.__getOldValues(sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    },
    __getValuesForInsert(vs: FragmentValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        const sqlParams = vs.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            const result = value.__getValuesForInsert(sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    },
    __isAllowed(vs: FragmentValueSource, sqlBuilder: HasIsValue): boolean {
        const sqlParams = vs.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            const result = value.__isAllowed(sqlBuilder)
            if (!result) {
                return false
            }
        }
        return true
    },
    __hasAggregation(vs: FragmentValueSource, sqlBuilder: HasIsValue): boolean {
        // A fragment can itself be an aggregate (built via the aggregate
        // fragment variants) on top of (possibly) aggregating its params.
        if (vs.__isAggregate) {
            return true
        }
        const sqlParams = vs.__sqlParams
        for (let i = 0, length = sqlParams.length; i < length; i++) {
            const value = __getValueSourcePrivate(sqlParams[i]!)
            if (value.__hasAggregation(sqlBuilder)) {
                return true
            }
        }
        return false
    },
}

export function __newFragmentValueSource(sql: TemplateStringsArray, sqlParams: AnyValueSource[], typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined, isAggregate?: boolean): FragmentValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as FragmentValueSource
    vs.__node = fragmentValueSourceNode
    vs.__operation = '_fragment' // Needed to detect if parenthesis is required

    vs.__sql = sql
    vs.__sqlParams = sqlParams
    if (typeClass.type === 'boolean') {
        vs.__isBooleanForCondition = true
    }
    if (isAggregate) {
        vs.__isAggregate = true
    }
    return vs
}

/**
 * The call of a function of the database whose result `executeFunction` reads: it is selected as any other value of a
 * select, so the result is converted by its type as a column is (like the uuid of a database that stores it in binary)
 */
export interface FunctionCallValueSource extends ValueSourceImpl {
    __functionName: string
    __functionParams: AnyValueSource[]
}

export const functionCallValueSourceNode: NodeStrategy<FunctionCallValueSource> = {
    ...valueSourceNode,
    __toSql(vs: FunctionCallValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._appendFunctionCall(context, vs.__functionName, vs.__functionParams)
    },
}

export function __newFunctionCallValueSource(functionName: string, functionParams: AnyValueSource[], typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): FunctionCallValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as FunctionCallValueSource
    vs.__node = functionCallValueSourceNode

    vs.__functionName = functionName
    vs.__functionParams = functionParams
    return vs
}

/** What the builder of a virtual column gives, built the first time it is asked */
function __builderOutputOf(vs: ValueSourceFromBuilder): AnyValueSource {
    if (!vs.__builderOutput) {
        vs.__builderOutput = vs.__builder(vs.__fragmentBuilder)
    }
    return vs.__builderOutput
}

function __builderOutputPrivateOf(vs: ValueSourceFromBuilder): __ValueSourcePrivate {
    return __getValueSourcePrivate(__builderOutputOf(vs))
}

export interface ValueSourceFromBuilder extends ValueSourceImpl {
    __builder: (fragmentBuilder: FragmentQueryBuilder) => AnyValueSource
    __fragmentBuilder: FragmentQueryBuilder
    __builderOutput?: AnyValueSource | undefined 
}

export const valueSourceFromBuilderNode: NodeStrategy<ValueSourceFromBuilder> = {
    ...valueSourceNode,
    __toSql(vs: ValueSourceFromBuilder, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        const builderOutput = __builderOutputOf(vs)
        if (!hasToSql(builderOutput)) {
            throw new TsSqlProcessingError({ reason: 'INVALID_SQL_FRAGMENT_RETURN_TYPE', typeName: vs.__type }, 'The result of value from fragment functions is no a valid sql element')
        }
        return builderOutput.__toSql(sqlBuilder, context, forceTypeCast)
    },
    __addWiths(vs: ValueSourceFromBuilder, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        __builderOutputPrivateOf(vs).__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: ValueSourceFromBuilder, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        __builderOutputPrivateOf(vs).__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: ValueSourceFromBuilder, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        __builderOutputPrivateOf(vs).__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: ValueSourceFromBuilder, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __builderOutputPrivateOf(vs).__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: ValueSourceFromBuilder, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __builderOutputPrivateOf(vs).__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: ValueSourceFromBuilder, sqlBuilder: HasIsValue): boolean {
        return __builderOutputPrivateOf(vs).__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: ValueSourceFromBuilder, sqlBuilder: HasIsValue): boolean {
        return __builderOutputPrivateOf(vs).__hasAggregation(sqlBuilder)
    },
}

export function __newValueSourceFromBuilder(builder: (fragmentBuilder: FragmentQueryBuilder) => AnyValueSource, fragmentBuilder: FragmentQueryBuilder, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): ValueSourceFromBuilder {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as ValueSourceFromBuilder
    vs.__node = valueSourceFromBuilderNode
    vs.__builder = builder
    vs.__fragmentBuilder = fragmentBuilder
    if (typeClass.type === 'boolean') {
        vs.__isBooleanForCondition = true
    }
    return vs
}

export interface AllowWhenValueSource extends ValueSourceImpl {
    __valueSource: ValueSourceImpl
    __allowed: boolean
    __error: Error
}

export const allowWhenValueSourceNode: NodeStrategy<AllowWhenValueSource> = {
    ...valueSourceNode,
    // `allowWhen` / `disallowWhen` runtime enforcement. This `__toSql`
    // is the active throw point today: the error fires during SQL
    // construction (`query()` / `executeXxx()`) and propagates through
    // every composite path because each composite (subquery-as-value
    // via `_inlineSelectAsValue`, fragment via `FragmentValueSource`,
    // aggregate via `AggregateSelectValueSource`, CTE via
    // `WithViewImpl` + `_buildSelect`, plain joins / where / having /
    // groupBy / orderBy) renders via its own `__toSql` that recurses
    // into ours. See `test/db/<dialect>/<v>/<connector>/select.allow-when.composition.test.ts`
    // for the path-by-path coverage and
    // `docs/queries/extreme-dynamic-queries.md` § Restrict access to
    // values for the public contract.
    //
    // The parallel `__isAllowed` web threaded through the query
    // builders, `ValueSourceImpl`, `Table`, `View`, `Values`,
    // `DBColumnImpl`, `RawFragmentImpl`, `WithViewImpl` and the
    // `ITableOrView` dispatcher (~48 methods, grep `__isAllowed` in
    // `src/`) is the scaffolding for a planned **query introspection
    // API** — non-destructive walkers paralleling `__toSql` that let a
    // consumer (e.g. an HTTP layer auto-generating OpenAPI) ask the
    // built query "is every gate open?" without triggering the throw.
    // The intended public surface (something like `query.isAllowed()`
    // alongside a future `query.resultSchema()` for OpenAPI-style
    // emission) is not yet exposed; no `execute*` / `query()` /
    // `_build*` calls `__isAllowed` today. The recursion is
    // structurally complete and **must be kept in sync with `__toSql`
    // when new value-source / table-or-view / query-builder shapes
    // are added** so that the feature lands working when the public
    // surface is wired up.
    __toSql(vs: AllowWhenValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (!vs.__allowed) {
            throw vs.__error
        }
        return vs.__valueSource.__toSql(sqlBuilder, context, forceTypeCast)
    },
    __toSqlForCondition(vs: AllowWhenValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (!vs.__allowed) {
            throw vs.__error
        }
        return vs.__valueSource.__toSqlForCondition(sqlBuilder, context, forceTypeCast)
    },
    __addWiths(vs: AllowWhenValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        vs.__valueSource.__addWiths(sqlBuilder, withs)
    },
    __registerTableOrView(vs: AllowWhenValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: AllowWhenValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__valueSource.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: AllowWhenValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: AllowWhenValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__valueSource.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: AllowWhenValueSource, sqlBuilder: HasIsValue): boolean {
        if (!vs.__allowed) {
            return false
        }
        return vs.__valueSource.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: AllowWhenValueSource, sqlBuilder: HasIsValue): boolean {
        // The `allowWhen`/`disallowWhen` gate is irrelevant to aggregation:
        // a disallowed expression still structurally contains its aggregate.
        return vs.__valueSource.__hasAggregation(sqlBuilder)
    },
}

export function __newAllowWhenValueSource(allowed: boolean, error: Error, valueSource: ValueSourceImpl): AllowWhenValueSource {
    // Carry the wrapped source's aggregated-array descriptor forward: the
    // result projector reads `__aggregatedArrayColumns` / `__aggregatedArrayMode`
    // / `__aggreagtedProjectingOptionalValuesAsNullable` directly off the value
    // source it finds in the query columns, so an aggregate wrapped by an
    // `allowWhen` / `disallowWhen` gate (e.g. `forUseAsInlineQueryValue()` over a
    // one-column aggregate, then `.allowWhen(...)`) must keep them or the array
    // is mishandled at read time.
    const vs = new (__typeClassOf(valueSource) as unknown as ValueSourceConstructor)(valueSource.__optionalType, valueSource.__typeAdapter, valueSource.__aggregatedArrayColumns, valueSource.__aggregatedArrayMode, valueSource.__uuidString, valueSource.__aggreagtedProjectingOptionalValuesAsNullable) as AllowWhenValueSource
    vs.__node = allowWhenValueSourceNode
    vs.__valueSource = valueSource
    vs.__error = error
    vs.__allowed = allowed
    // Mirror the wrapped source's "boolean-as-condition" flag so that
    // dialects without a native boolean (Oracle, SQL Server) emit the
    // condition directly under WHERE/HAVING/ON instead of wrapping it
    // with `= 1` (the path inside `_appendConditionSql` for boolean
    // value sources whose surface form is a number).
    if (valueSource.__isBooleanForCondition) {
        vs.__isBooleanForCondition = valueSource.__isBooleanForCondition
    }
    return vs
}

export interface AggregateFunctions0ValueSource extends ValueSourceImpl, HasOperation {
    __operation: keyof AggregateFunctions0
}

export const aggregateFunctions0ValueSourceNode: NodeStrategy<AggregateFunctions0ValueSource> = {
    ...valueSourceNode,
    __toSql(vs: AggregateFunctions0ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context)
    },
}

export function __newAggregateFunctions0ValueSource(operation: keyof AggregateFunctions0, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): AggregateFunctions0ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as AggregateFunctions0ValueSource
    vs.__node = aggregateFunctions0ValueSourceNode

    vs.__operation = operation
    vs.__isAggregate = true
    return vs
}

export interface NullValueSource extends ValueSourceImpl, HasOperation {
    __operation: '_asNullValue'
}

export const nullValueSourceNode: NodeStrategy<NullValueSource> = {
    ...valueSourceNode,
    __toSql(vs: NullValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._asNullValue(context, vs.__type, vs.__customType, vs.__typeAdapter)
    },
    __isAllowed(_vs: NullValueSource, _sqlBuilder: HasIsValue): boolean {
        return true
    },
}

export function __newNullValueSource(typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): NullValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as NullValueSource
    vs.__node = nullValueSourceNode
    vs.__operation = '_asNullValue'
    return vs
}

export interface AggregateFunctions1ValueSource extends ValueSourceImpl, HasOperation {
    __operation: keyof AggregateFunctions1
    __value: any
}

export const aggregateFunctions1ValueSourceNode: NodeStrategy<AggregateFunctions1ValueSource> = {
    ...valueSourceNode,
    __toSql(vs: AggregateFunctions1ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, sqlBuilder._typedOperand(vs.__value, [], vs.__operation))
    },
    __addWiths(vs: AggregateFunctions1ValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: AggregateFunctions1ValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: AggregateFunctions1ValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: AggregateFunctions1ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: AggregateFunctions1ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: AggregateFunctions1ValueSource, sqlBuilder: HasIsValue): boolean {
        return __isAllowed(vs.__value, sqlBuilder)
    },
}

export function __newAggregateFunctions1ValueSource(operation: keyof AggregateFunctions1, value: any, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): AggregateFunctions1ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as AggregateFunctions1ValueSource
    vs.__node = aggregateFunctions1ValueSourceNode

    vs.__operation = operation
    vs.__value = value
    vs.__isAggregate = true
    return vs
}

export interface AggregateFunctions1or2ValueSource extends ValueSourceImpl, HasOperation {
    __operation: keyof AggregateFunctions1or2
    __value: any
    __separator: string | undefined
}

export const aggregateFunctions1or2ValueSourceNode: NodeStrategy<AggregateFunctions1or2ValueSource> = {
    ...valueSourceNode,
    __toSql(vs: AggregateFunctions1or2ValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[vs.__operation](context, vs.__separator, vs.__value)
    },
    __addWiths(vs: AggregateFunctions1or2ValueSource, sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        __addWiths(vs.__value, sqlBuilder, withs)
    },
    __registerTableOrView(vs: AggregateFunctions1or2ValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        __registerTableOrView(vs.__value, sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: AggregateFunctions1or2ValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        __registerRequiredColumn(vs.__value, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: AggregateFunctions1or2ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getOldValues(vs.__value, sqlBuilder)
    },
    __getValuesForInsert(vs: AggregateFunctions1or2ValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return __getValuesForInsert(vs.__value, sqlBuilder)
    },
    __isAllowed(vs: AggregateFunctions1or2ValueSource, sqlBuilder: HasIsValue): boolean {
        return __isAllowed(vs.__value, sqlBuilder)
    },
}

export function __newAggregateFunctions1or2ValueSource(operation: keyof AggregateFunctions1or2, separator: string | undefined, value: any, typeClass: DataTypeClass, optionalType: OptionalType, typeAdapter: TypeAdapter | undefined): AggregateFunctions1or2ValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType, typeAdapter) as AggregateFunctions1or2ValueSource
    vs.__node = aggregateFunctions1or2ValueSourceNode

    vs.__operation = operation
    vs.__separator = separator
    vs.__value = value
    vs.__isAggregate = true
    return vs
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
        if (op2 === 'required' || op2 === 'requiredInOptionalObject') {
            return 'originallyRequired'
        } else {
            return op2
        }
    } else {
        return 'optional'
    }
}

function mergeRequired(op1: OptionalType, op2: OptionalType): OptionalType {
    // The dual of `mergeOptional`: keep the MORE strict option. See `MergeRequired` in
    // expressions/values.ts for why an operation that reads NULL as the empty string merges
    // this way.
    if (op1 === 'required' || op2 === 'required') {
        return 'required'
    }
    if (op1 === 'requiredInOptionalObject' || op2 === 'requiredInOptionalObject') {
        return 'requiredInOptionalObject'
    }
    if (op1 === 'originallyRequired' || op2 === 'originallyRequired') {
        return 'originallyRequired'
    }
    return 'optional'
}

export function getRequiredType2(a: ValueSourceImpl, b: any): OptionalType {
    if (isValueSource(b)) {
        return mergeRequired(a.__optionalType, __getValueSourcePrivate(b).__optionalType)
    }
    if (b === null || b === undefined) {
        return a.__optionalType
    }
    // A constant of the language is never NULL, so it alone makes the result always present.
    return 'required'
}

export function getOptionalType2(a: ValueSourceImpl, b: any): OptionalType {
    if (isValueSource(b)) {
        return mergeOptional(a.__optionalType, __getValueSourcePrivate(b).__optionalType)
    }
    return a.__optionalType
}

function getOptionalTypeOfIn(a: ValueSourceImpl, b: any): OptionalType {
    // A subquery on an optional column can return a NULL, and `<x> in (1, NULL)` is NULL, not false, when no
    // element matches, as the declared type says.
    if (isSelectQuery(b)) {
        let select: any = b
        while (select.__type === 'compound') {
            select = select.__firstQuery
        }
        const column = select.__columns?.['result']
        if (isValueSource(column)) {
            return mergeOptional(a.__optionalType, __getValueSourcePrivate(column).__optionalType)
        }
    }
    return getOptionalType2(a, b)
}

function getOptionalTypeN(a: ValueSourceImpl, values: any[]): OptionalType {
    // The varargs counterpart of `getOptionalType2`, for `inN` / `notInN`. Their operand is the
    // ARRAY the varargs collected, not a value source, so `getOptionalType2` would find no value
    // source in it and answer the receiver's optional type, ignoring the elements. An element that
    // is a value source can be NULL, and `<x> in (1, <null>)` is NULL — not false — when no element
    // matches (SQL's three-valued logic), so every element has to be merged in, exactly as the
    // declared type says (`MergeOptional<OPTIONAL_TYPE, VALUE[optionalType]>`). A constant of the
    // language is never NULL, so a list of plain values keeps the receiver's optional type.
    let result = a.__optionalType
    for (let i = 0, length = values.length; i < length; i++) {
        const value = values[i]
        if (isValueSource(value)) {
            result = mergeOptional(result, __getValueSourcePrivate(value).__optionalType)
        }
    }
    return result
}

export function getOptionalType3(a: ValueSourceImpl, b: any, c: any): OptionalType {
    let result = a.__optionalType
    if (isValueSource(b)) {
        result = mergeOptional(result, __getValueSourcePrivate(b).__optionalType)
    }
    if (isValueSource(c)) {
        result = mergeOptional(result, __getValueSourcePrivate(c).__optionalType)
    }
    return result
}

export function getTypeAdapter2(a: ValueSourceImpl, b: any): TypeAdapter | undefined {
    if (a.__typeAdapter) {
        return a.__typeAdapter
    }
    if (isValueSource(b)) {
        return __getValueSourcePrivate(b).__typeAdapter
    }
    return undefined
}

export function getTypeAdapter3(a: ValueSourceImpl, b: any, c: any): TypeAdapter | undefined {
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
    if ((thiz.__customType === undefined && thiz.__type === 'double') || (thiz.__customType === undefined && thiz.__type === 'bigint') || thiz.__customType === 'customInt' || thiz.__customType === 'customBigint' || thiz.__customType === 'customDouble' || __isExactDecimal(thiz.__type, thiz.__customType)) {
        return __newSqlOperation1ValueSource(operation, thiz, value, __typeClassOf(thiz), getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
    } else {
        if (isValueSource(value)) {
            const valuePrivate = __getValueSourcePrivate(value)
            if (valuePrivate.__customType === undefined && valuePrivate.__type === 'int') {
                return __newSqlOperation1ValueSource(operation, thiz, value, __builtInTypeOf(thiz, 'int'), getOptionalType2(thiz, value), thiz.__typeAdapter)
            } else {
                return __newSqlOperation1ValueSource(operation, thiz, value, __builtInTypeOf(thiz, 'double'), getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
            }
        }
        if (Number.isInteger(value)) {
            return __newSqlOperation1ValueSource(operation, thiz, value, __builtInTypeOf(thiz, 'int'), getOptionalType2(thiz, value), thiz.__typeAdapter)
        } else {
            return __newSqlOperation1ValueSource(operation, thiz, value, __builtInTypeOf(thiz, 'double'), getOptionalType2(thiz, value), getTypeAdapter2(thiz, value))
        }
    }
}

export function condition(valueSource: ValueSourceImpl): ValueSourceImpl {
    valueSource.__isBooleanForCondition = true
    return valueSource
}

export class TableOrViewRawFragmentValueSource implements TypedValueSource<any, any, any>, __ValueSourcePrivate, ToSql {
    [valueType_]: any
    [optionalType_]: any
    [source]: any
    [typeName]: any

    [isValueSourceObject]: true = true
    __type: string = ''
    __customType: CustomType | undefined = undefined
    __optionalType: OptionalType = 'required'
    __typeAdapter?: TypeAdapter | undefined
    __tableOrView: AnyTableOrView
    __operation: '_rawFragmentTableName' | '_rawFragmentTableAlias'

    constructor(_tableOrView: AnyTableOrView, operation: '_rawFragmentTableName' | '_rawFragmentTableAlias') {
        this.__tableOrView = _tableOrView
        this.__operation = operation
    }

    isConstValue(): boolean {
        return false
    }
    getConstValue(): any {
        throw new TsSqlProcessingError({ reason: 'EXPRESSION_IS_NOT_CONST' }, 'You are trying to access to the const value when the expression is not const')
    }
    allowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new AllowWhenTableOrViewRawFragmentValueSource(when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'allowWhen' }, error), this.__tableOrView, this.__operation)
        } else {
            return new AllowWhenTableOrViewRawFragmentValueSource(when, error, this.__tableOrView, this.__operation)
        }
    }
    disallowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new AllowWhenTableOrViewRawFragmentValueSource(!when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'disallowWhen' }, error), this.__tableOrView, this.__operation)
        } else {
            return new AllowWhenTableOrViewRawFragmentValueSource(!when, error, this.__tableOrView, this.__operation)
        }
    }
    __addWiths(_sqlBuilder: HasIsValue, _withs: IWithView<any>[]): void {
        // Do nothing
    }
    __registerTableOrView(_sqlBuilder: HasIsValue, _requiredTablesOrViews: Set<AnyTableOrView>): void {
        // Do nothing
    }
    __registerRequiredColumn(_sqlBuilder: HasIsValue, _requiredColumns: Set<DBColumn>, _onlyForTablesOrViews: Set<AnyTableOrView>): void {
        // Do nothing
    }
    __getOldValues(_sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return undefined
    }
    __getValuesForInsert(_sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return undefined
    }
    __isAllowed(_sqlBuilder: HasIsValue): boolean {
        return true
    }
    __hasAggregation(_sqlBuilder: HasIsValue): boolean {
        return false
    }
    __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder[this.__operation](context, this.__tableOrView)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        return this.__toSql(sqlBuilder, context, forceTypeCast)
    }
}

export class AllowWhenTableOrViewRawFragmentValueSource extends TableOrViewRawFragmentValueSource {
    __allowed: boolean
    __error: Error
    constructor(allowed: boolean, error: Error, _tableOrView: AnyTableOrView, operation: '_rawFragmentTableName' | '_rawFragmentTableAlias') {
        super(_tableOrView, operation)
        this.__error = error
        this.__allowed = allowed
    }
    override __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (!this.__allowed) {
            throw this.__error
        }
        return super.__toSql(sqlBuilder, context, forceTypeCast)
    }
    override __isAllowed(sqlBuilder: HasIsValue): boolean {
        if (!this.__allowed) {
            return false
        }
        return super.__isAllowed(sqlBuilder)
    }
}

export type InlineSelectData = SelectData & IQueryDataDiscovery

export interface InlineSelectValueSource extends ValueSourceImpl, HasOperation {
    __operation: '_inlineSelectAsValue'
    __selectData: InlineSelectData
}

export const inlineSelectValueSourceNode: NodeStrategy<InlineSelectValueSource> = {
    ...valueSourceNode,
    __toSql(vs: InlineSelectValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._inlineSelectAsValue(vs.__selectData, context)
    },
    __toSqlForCondition(vs: InlineSelectValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._inlineSelectAsValueForCondition(vs.__selectData, context)
    },
    __addWiths(vs: InlineSelectValueSource, sqlBuilder: HasIsValue, withs: IWithView<any>[]): void {
        __addInlineQueryWiths(sqlBuilder, withs, vs.__selectData)
    },
    __registerTableOrView(vs: InlineSelectValueSource, sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        vs.__selectData.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    },
    __registerRequiredColumn(vs: InlineSelectValueSource, sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        vs.__selectData.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    },
    __getOldValues(vs: InlineSelectValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__selectData.__getOldValues(sqlBuilder)
    },
    __getValuesForInsert(vs: InlineSelectValueSource, sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return vs.__selectData.__getValuesForInsert(sqlBuilder)
    },
    __isAllowed(vs: InlineSelectValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__selectData.__isAllowed(sqlBuilder)
    },
    __hasAggregation(vs: InlineSelectValueSource, sqlBuilder: HasIsValue): boolean {
        return vs.__selectData.__hasAggregation(sqlBuilder)
    },
}

export function __newInlineSelectValueSource(selectData: InlineSelectData, required: boolean, typeClass: DataTypeClass): InlineSelectValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(...valueSourceInitializationForInlineSelect(selectData, required)) as InlineSelectValueSource
    vs.__node = inlineSelectValueSourceNode
    vs.__operation = '_inlineSelectAsValue'

    vs.__selectData = selectData
    return vs
}

export class AggregateSelectValueSource implements TypedValueSource<any, any, any>, __ValueSourcePrivate, ToSql {
    [valueType_]: any
    [optionalType_]: any
    [source]: any
    [typeName]: any
    [aggregatedArrayValueSource]!: 'AggregatedArrayValueSource'

    [isValueSourceObject]: true = true
    __type: string = 'aggregatedArray'
    __customType: CustomType | undefined = undefined
    __optionalType: OptionalType
    __operation = '_inlineSelectAsValue' as const
    __selectData: InlineSelectData
    __aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource
    __aggregatedArrayMode: __AggregatedArrayMode
    __aggreagtedProjectingOptionalValuesAsNullable?: boolean | undefined
    __isAggregate = true

    constructor(selectData: InlineSelectData, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType, projectingOptionalValuesAsNullable?: boolean) {
        this.__selectData = selectData
        this.__aggregatedArrayColumns = aggregatedArrayColumns
        this.__aggregatedArrayMode = aggregatedArrayMode
        this.__optionalType = _optionalType
        this.__aggreagtedProjectingOptionalValuesAsNullable = projectingOptionalValuesAsNullable
    }

    isConstValue(): boolean {
        return false
    }
    getConstValue(): any {
        throw new TsSqlProcessingError({ reason: 'EXPRESSION_IS_NOT_CONST' }, 'You are trying to access to the const value when the expression is not const')
    }
    allowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new AllowWhenAggregateSelectValueSource(when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'allowWhen' }, error), this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType, this.__aggreagtedProjectingOptionalValuesAsNullable)
        } else {
            return new AllowWhenAggregateSelectValueSource(when, error, this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType, this.__aggreagtedProjectingOptionalValuesAsNullable)
        }
    }
    disallowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new AllowWhenAggregateSelectValueSource(!when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'disallowWhen' }, error), this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType, this.__aggreagtedProjectingOptionalValuesAsNullable)
        } else {
            return new AllowWhenAggregateSelectValueSource(!when, error, this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType, this.__aggreagtedProjectingOptionalValuesAsNullable)
        }
    }

    __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._inlineSelectAsValue(this.__selectData, context)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._inlineSelectAsValueForCondition(this.__selectData, context)
    }
    __addWiths(sqlBuilder: HasIsValue, withs: IWithView<any>[]): void {
        __addInlineQueryWiths(sqlBuilder, withs, this.__selectData)
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        this.__selectData.__registerTableOrView(sqlBuilder, requiredTablesOrViews)
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        this.__selectData.__registerRequiredColumn(sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }
    __getOldValues(sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return this.__selectData.__getOldValues(sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return this.__selectData.__getValuesForInsert(sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        return this.__selectData.__isAllowed(sqlBuilder)
    }
    __hasAggregation(_sqlBuilder: HasIsValue): boolean {
        return this.__isAggregate ?? false
    }

    useEmptyArrayForNoValue(): any {
        return new AggregateSelectValueSource(this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'required', this.__aggreagtedProjectingOptionalValuesAsNullable)
    }
    asOptionalNonEmptyArray(): any {
        return new AggregateSelectValueSource(this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional', this.__aggreagtedProjectingOptionalValuesAsNullable)
    }
    asRequiredInOptionalObject(): any {
        return new AggregateSelectValueSource(this.__selectData, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'requiredInOptionalObject', this.__aggreagtedProjectingOptionalValuesAsNullable)
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
    constructor(allowed: boolean, error: Error, selectData: InlineSelectData, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType, projectingOptionalValuesAsNullable?: boolean) {
        super(selectData, aggregatedArrayColumns, aggregatedArrayMode, _optionalType, projectingOptionalValuesAsNullable)
        this.__error = error
        this.__allowed = allowed
    }
    override __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (!this.__allowed) {
            throw this.__error
        }
        return super.__toSql(sqlBuilder, context, forceTypeCast)
    }
    override __isAllowed(sqlBuilder: HasIsValue): boolean {
        if (!this.__allowed) {
            return false
        }
        return super.__isAllowed(sqlBuilder)
    }
}

export class NullAggregateSelectValueSource implements TypedValueSource<any, any, any>, __ValueSourcePrivate, ToSql {
    [valueType_]: any
    [optionalType_]: any
    [source]: any
    [typeName]: any
    [aggregatedArrayValueSource]!: 'AggregatedArrayValueSource'

    [isValueSourceObject]: true = true
    // Replaced by null (onlyWhenOrNull / ignoreWhenAsNull): nothing is aggregated, as for any other value
    // replaced by null (NullValueSource); the other walkers ignore the replaced query too
    __isAggregate = false
    __type: string = 'aggregatedArray'
    __customType: CustomType | undefined = undefined
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
        throw new TsSqlProcessingError({ reason: 'EXPRESSION_IS_NOT_CONST' }, 'You are trying to access to the const value when the expression is not const')
    }
    allowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new NullAllowWhenAggregateSelectValueSource(this.__selectData, when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'allowWhen' }, error), this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        } else {
            return new NullAllowWhenAggregateSelectValueSource(this.__selectData, when, error, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        }
    }
    disallowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new NullAllowWhenAggregateSelectValueSource(this.__selectData, !when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'disallowWhen' }, error), this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        } else {
            return new NullAllowWhenAggregateSelectValueSource(this.__selectData, !when, error, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType)
        }
    }

    __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._asNullValue(context, this.__type, this.__customType, undefined)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        return this.__toSql(sqlBuilder, context, forceTypeCast)
    }
    __addWiths(_sqlBuilder: HasIsValue, _withs: IWithView<any>[]): void {
    }
    __registerTableOrView(_sqlBuilder: HasIsValue, _requiredTablesOrViews: Set<AnyTableOrView>): void {
    }
    __registerRequiredColumn(_sqlBuilder: HasIsValue, _requiredColumns: Set<DBColumn>, _onlyForTablesOrViews: Set<AnyTableOrView>): void {
    }
    __getOldValues(_sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return undefined
    }
    __getValuesForInsert(_sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return undefined
    }
    __isAllowed(_sqlBuilder: HasIsValue): boolean {
        return true
    }
    __hasAggregation(_sqlBuilder: HasIsValue): boolean {
        return this.__isAggregate ?? false
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
    override __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (!this.__allowed) {
            throw this.__error
        }
        return super.__toSql(sqlBuilder, context, forceTypeCast)
    }
    override __isAllowed(sqlBuilder: HasIsValue): boolean {
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
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'unexpected value' }, 'Unexpected inline aggregated array vaule')
    } else if (selectData.__oneColumn) {
        const result = selectData.__columns['result']
        if (!isValueSource(result)) {
            throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'invalid result column' }, 'Result column for a select one column not found')
        }
        const valueSourcePrivate = __getValueSourcePrivate(result)
        let typeAdapter = valueSourcePrivate.__typeAdapter
        if (typeAdapter instanceof CustomBooleanTypeAdapter) {
            // Avoid treat the column as a custom boolean
            typeAdapter = proxyTypeAdapterFor(typeAdapter)
        }
        return [required ? 'required' : 'optional', typeAdapter, valueSourcePrivate.__aggregatedArrayColumns, valueSourcePrivate.__aggregatedArrayMode, valueSourcePrivate.__uuidString, valueSourcePrivate.__aggreagtedProjectingOptionalValuesAsNullable] as const
    } else {
        throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'unexpected value' }, 'Unexpected inline select')
    }
}

export class AggregateValueAsArrayValueSource implements TypedValueSource<any, any, any>, __ValueSourcePrivate, ToSql {
    [valueType_]: any
    [optionalType_]: any
    [source]: any
    [typeName]: any
    [aggregatedArrayValueSource]!: 'AggregatedArrayValueSource'

    [isValueSourceObject]: true = true
    __isAggregate = true
    __type: string = 'aggregatedArray'
    __customType: CustomType | undefined = undefined
    __optionalType: OptionalType
    __operation: '_aggregateValueAsArray' = '_aggregateValueAsArray'
    __aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource
    __aggregatedArrayMode: __AggregatedArrayMode
    __aggreagtedProjectingOptionalValuesAsNullable?: boolean | undefined
    __aggregatedArrayDistinct: boolean

    constructor(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType, distict: boolean, projectingOptionalValuesAsNullable?: boolean) {
        this.__aggregatedArrayColumns = aggregatedArrayColumns
        this.__aggregatedArrayMode = aggregatedArrayMode
        this.__optionalType = _optionalType
        this.__aggregatedArrayDistinct = distict
        this.__aggreagtedProjectingOptionalValuesAsNullable = projectingOptionalValuesAsNullable
    }

    isConstValue(): boolean {
        return false
    }
    getConstValue(): any {
        throw new TsSqlProcessingError({ reason: 'EXPRESSION_IS_NOT_CONST' }, 'You are trying to access to the const value when the expression is not const')
    }
    allowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new AllowWhenAggregateValueAsArrayValueSource(when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'allowWhen' }, error), this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType, this.__aggregatedArrayDistinct, this.__aggreagtedProjectingOptionalValuesAsNullable)
        } else {
            return new AllowWhenAggregateValueAsArrayValueSource(when, error, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType, this.__aggregatedArrayDistinct, this.__aggreagtedProjectingOptionalValuesAsNullable)
        }
    }
    disallowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new AllowWhenAggregateValueAsArrayValueSource(!when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'disallowWhen' }, error), this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType, this.__aggregatedArrayDistinct, this.__aggreagtedProjectingOptionalValuesAsNullable)
        } else {
            return new AllowWhenAggregateValueAsArrayValueSource(!when, error, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType, this.__aggregatedArrayDistinct, this.__aggreagtedProjectingOptionalValuesAsNullable)
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
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>): void {
        this.__registerTableOrViewOf(sqlBuilder, requiredTablesOrViews, this.__aggregatedArrayColumns)
    }
    __registerTableOrViewOf(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<AnyTableOrView>, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): void {
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
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>): void {
        this.__registerRequiredColumnOf(sqlBuilder, requiredColumns, onlyForTablesOrViews, this.__aggregatedArrayColumns)
    }
    __registerRequiredColumnOf(sqlBuilder: HasIsValue, requiredColumns: Set<DBColumn>, onlyForTablesOrViews: Set<AnyTableOrView>, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): void {
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
    __getOldValues(sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return this.__getOldValuesOf(sqlBuilder, this.__aggregatedArrayColumns)
    }
    __getOldValuesOf(sqlBuilder: HasIsValue, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): AnyTableOrView | undefined {
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
    __getValuesForInsert(sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return this.__getValuesForInsertOf(sqlBuilder, this.__aggregatedArrayColumns)
    }
    __getValuesForInsertOf(sqlBuilder: HasIsValue, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource | null | undefined): AnyTableOrView | undefined {
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
    __hasAggregation(_sqlBuilder: HasIsValue): boolean {
        return this.__isAggregate ?? false
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
    __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._aggregateValueAsArray(this, context)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        return this.__toSql(sqlBuilder, context, forceTypeCast)
    }

    useEmptyArrayForNoValue(): any {
        return new AggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'required', this.__aggregatedArrayDistinct, this.__aggreagtedProjectingOptionalValuesAsNullable)
    }
    asOptionalNonEmptyArray(): any {
        return new AggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional', this.__aggregatedArrayDistinct, this.__aggreagtedProjectingOptionalValuesAsNullable)
    }
    asRequiredInOptionalObject(): any {
        return new AggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'requiredInOptionalObject', this.__aggregatedArrayDistinct, this.__aggreagtedProjectingOptionalValuesAsNullable)
    }
    onlyWhenOrNull(when: boolean): any {
        if (when) {
            return this
        } else {
            return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional', this.__aggregatedArrayDistinct)
        }
    }
    ignoreWhenAsNull(when: boolean): any {
        if (when) {
            return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional', this.__aggregatedArrayDistinct)
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
    constructor(allowed: boolean, error: Error, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType, distinct: boolean, projectingOptionalValuesAsNullable?: boolean) {
        super(aggregatedArrayColumns, aggregatedArrayMode, _optionalType, distinct, projectingOptionalValuesAsNullable)
        this.__error = error
        this.__allowed = allowed
    }
    override __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (!this.__allowed) {
            throw this.__error
        }
        return super.__toSql(sqlBuilder, context, forceTypeCast)
    }
    override __isAllowed(sqlBuilder: HasIsValue): boolean {
        if (!this.__allowed) {
            return false
        }
        return super.__isAllowed(sqlBuilder)
    }
}

export class NullAggregateValueAsArrayValueSource implements TypedValueSource<any, any, any>, __ValueSourcePrivate, ToSql {
    [valueType_]: any
    [optionalType_]: any
    [source]: any
    [typeName]: any
    [aggregatedArrayValueSource]!: 'AggregatedArrayValueSource'

    [isValueSourceObject]: true = true
    // Replaced by null (onlyWhenOrNull / ignoreWhenAsNull): nothing is aggregated, as for any other value
    // replaced by null (NullValueSource); the other walkers ignore the replaced query too
    __isAggregate = false
    __type: string = 'aggregatedArray'
    __customType: CustomType | undefined = undefined
    __optionalType: OptionalType
    __operation: '_aggregateValueAsArray' = '_aggregateValueAsArray'
    __aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource
    __aggregatedArrayMode: __AggregatedArrayMode
    __aggregatedArrayDistinct: boolean

    constructor(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType, distinct: boolean) {
        this.__aggregatedArrayColumns = aggregatedArrayColumns
        this.__aggregatedArrayMode = aggregatedArrayMode
        this.__optionalType = _optionalType
        this.__aggregatedArrayDistinct = distinct
    }

    isConstValue(): boolean {
        return false
    }
    getConstValue(): any {
        throw new TsSqlProcessingError({ reason: 'EXPRESSION_IS_NOT_CONST' }, 'You are trying to access to the const value when the expression is not const')
    }
    allowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new NullAllowWhenAggregateValueAsArrayValueSource(when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'allowWhen' }, error), this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType, this.__aggregatedArrayDistinct)
        } else {
            return new NullAllowWhenAggregateValueAsArrayValueSource(when, error, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType, this.__aggregatedArrayDistinct)
        }
    }
    disallowWhen(when: boolean, error: string | Error): any {
        if (typeof error === 'string') {
            return new NullAllowWhenAggregateValueAsArrayValueSource(!when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'disallowWhen' }, error), this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType, this.__aggregatedArrayDistinct)
        } else {
            return new NullAllowWhenAggregateValueAsArrayValueSource(!when, error, this.__aggregatedArrayColumns, this.__aggregatedArrayMode, this.__optionalType, this.__aggregatedArrayDistinct)
        }
    }
    __addWiths(_sqlBuilder: HasIsValue, _withs: IWithView<any>[]): void {
    }
    __registerTableOrView(_sqlBuilder: HasIsValue, _requiredTablesOrViews: Set<AnyTableOrView>): void {
    }
    __registerRequiredColumn(_sqlBuilder: HasIsValue, _requiredColumns: Set<DBColumn>, _onlyForTablesOrViews: Set<AnyTableOrView>): void {
    }
    __getOldValues(_sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return undefined
    }
    __getValuesForInsert(_sqlBuilder: HasIsValue): AnyTableOrView | undefined {
        return undefined
    }
    __isAllowed(_sqlBuilder: HasIsValue): boolean {
        return true
    }
    __hasAggregation(_sqlBuilder: HasIsValue): boolean {
        return this.__isAggregate ?? false
    }
    __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._asNullValue(context, this.__type, this.__customType, undefined)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        return this.__toSql(sqlBuilder, context, forceTypeCast)
    }

    useEmptyArrayForNoValue(): any {
        return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'required', this.__aggregatedArrayDistinct)
    }
    asOptionalNonEmptyArray(): any {
        return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional', this.__aggregatedArrayDistinct)
    }
    asRequiredInOptionalObject(): any {
        return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'requiredInOptionalObject', this.__aggregatedArrayDistinct)
    }
    onlyWhenOrNull(when: boolean): any {
        if (when) {
            return this
        } else {
            return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional', this.__aggregatedArrayDistinct)
        }
    }
    ignoreWhenAsNull(when: boolean): any {
        if (when) {
            return new NullAggregateValueAsArrayValueSource(this.__aggregatedArrayColumns, this.__aggregatedArrayMode, 'optional', this.__aggregatedArrayDistinct)
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
    constructor(allowed: boolean, error: Error, aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode: __AggregatedArrayMode, _optionalType: OptionalType, distinct: boolean) {
        super(aggregatedArrayColumns, aggregatedArrayMode, _optionalType, distinct)
        this.__error = error
        this.__allowed = allowed
    }
    override __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string {
        if (!this.__allowed) {
            throw this.__error
        }
        return super.__toSql(sqlBuilder, context, forceTypeCast)
    }
    override __isAllowed(sqlBuilder: HasIsValue): boolean {
        if (!this.__allowed) {
            return false
        }
        return super.__isAllowed(sqlBuilder)
    }
}
