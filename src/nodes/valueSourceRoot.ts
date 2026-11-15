import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder, ToSql } from '../sqlBuilders/SqlBuilder.js'
import type { TypedValueSource } from '../typeSystem/valueSource.js'
import type { DefaultTypeAdapter, TypeAdapter, TypeAdapterPlaceholderContext, TypeAdapterProjectionContext, TypeAdapterValueFromDBContext, TypeAdapterValueToDBContext } from '../TypeAdapter.js'
import type { AnyTableOrView, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getTableOrViewPrivate, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { valueType as valueType_, optionalType as optionalType_, typeName, isValueSourceObject, source } from '../utils/symbols.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { __isDouble, __isExactDecimal, __isUuid } from '../typeSystem/dataTypes.js'
import type { CustomType, DataTypeClass } from '../TypeAdapter.js'
import type { AnyValueSource, OptionalType, __AggregatedArrayColumns, __AggregatedArrayMode, __ValueSourcePrivate } from '../typeSystem/valueSource.js'
import { __getValueSourcePrivate } from '../typeSystem/valueSource.js'
import { type DataTypeValueSource, type NodeStrategy } from './NodeStrategy.js'
import { __newAllowWhenValueSource } from './allowWhen.js'
import { __newNullValueSource } from './constants.js'
import { __sameTypeClassOf, __typeClassOf } from './dataTypeClassOf.js'
import { __newNoopValueSource } from './operations.js'
import { typeAdapterOfClass, __adaptedTypeClassOf, __keptClassOf } from './adaptedTypeClass.js'

export class ValueSourceRoot implements TypedValueSource<any, any, any>, __ValueSourcePrivate, ToSql {
    [typeName]: any
    [source]: any

    [valueType_]: any
    [optionalType_]: any

    [isValueSourceObject]: true = true
    __type: string
    __customType: CustomType | undefined
    __optionalType: OptionalType
    __isAggregate?: boolean | undefined
    __aggregatedArrayColumns?: __AggregatedArrayColumns | AnyValueSource | undefined
    __aggregatedArrayMode?: __AggregatedArrayMode | undefined
    __aggreagtedProjectingOptionalValuesAsNullable?: boolean | undefined

    constructor(optionalType: OptionalType, aggregatedArrayColumns?: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode?: __AggregatedArrayMode, aggregatedProjectingOptionalValuesAsNullable?: boolean) {
        // The class created is the one of the data type (src/typeSystem), which extends this one at run time
        const typeClass = new.target as unknown as DataTypeClass
        this.__type = typeClass.type
        this.__customType = typeClass.customType
        this.__optionalType = optionalType
        if (aggregatedArrayColumns) {
            this.__aggregatedArrayColumns = aggregatedArrayColumns
            this.__aggregatedArrayMode = aggregatedArrayMode
            this.__aggreagtedProjectingOptionalValuesAsNullable = aggregatedProjectingOptionalValuesAsNullable
        }
    }
    // The conversions of the values of the data type (DataTypeClassConversions of adaptedTypeClass.ts): the ones of the
    // connection, which a class with a type adapter wraps with its adapter
    static __transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueFromDB(value, context)
    }
    static __transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        return next.transformValueToDB(value, context)
    }
    static __transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        return next.transformPlaceholder(placeholder, context)
    }
    static __transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        return next.transformProjection(sql, context)
    }
    /** The type adapter of this value source: the one of its class (see adaptedTypeClass.ts) */
    get __typeAdapter(): TypeAdapter | undefined {
        return (this.constructor as { [typeAdapterOfClass]?: TypeAdapter | undefined })[typeAdapterOfClass]
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
        const nodeAllowWhen = this.__node.allowWhen
        if (nodeAllowWhen) {
            return nodeAllowWhen(this, when, typeof error === 'string' ? new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'allowWhen' }, error) : error)
        }
        let result
        if (typeof error === 'string') {
            result = __newAllowWhenValueSource(when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'allowWhen' }, error), this, __keptClassOf(this, __sameTypeClassOf(this)))
        } else {
            result = __newAllowWhenValueSource(when, error, this, __keptClassOf(this, __sameTypeClassOf(this)))
        }
        return result
    }
    disallowWhen(when: boolean, error: string | Error): any {
        const nodeAllowWhen = this.__node.allowWhen
        if (nodeAllowWhen) {
            return nodeAllowWhen(this, !when, typeof error === 'string' ? new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'disallowWhen' }, error) : error)
        }
        let result
        if (typeof error === 'string') {
            result = __newAllowWhenValueSource(!when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'disallowWhen' }, error), this, __keptClassOf(this, __sameTypeClassOf(this)))
        } else {
            result = __newAllowWhenValueSource(!when, error, this, __keptClassOf(this, __sameTypeClassOf(this)))
        }
        return result
    }
    // SqlComparator0
    // SqlComparator1
    // SqlComparator2
    // SqlFunctionStatic: never used here
    // SqlFunction0
    // Boolean
    // String
    // Number functions
    // Trigonometric Functions
    // Date & Time Functions
    // SqlFunction1
    // Trigonometric Functions
    // String Functions
    // Number
    // Number operators
    // SqlFunction2
}

/** What `asRequiredInOptionalObject` gives, for every data type that has it (the nullable ones, the aggregated arrays) */
export function __asRequiredInOptionalObjectOf(valueSource: DataTypeValueSource): any {
    const vs = valueSource as ValueSourceRoot
    const nodeAsRequiredInOptionalObject = vs.__node.asRequiredInOptionalObject
    if (nodeAsRequiredInOptionalObject) {
        return nodeAsRequiredInOptionalObject(vs)
    }
    const result = __newNoopValueSource(vs, __keptClassOf(vs, __sameTypeClassOf(vs)), 'requiredInOptionalObject')
    if (vs.__aggregatedArrayColumns) {
        result.__aggregatedArrayColumns = vs.__aggregatedArrayColumns
        result.__aggregatedArrayMode = vs.__aggregatedArrayMode
        result.__aggreagtedProjectingOptionalValuesAsNullable = vs.__aggreagtedProjectingOptionalValuesAsNullable
    }
    return result
}

/** What `onlyWhenOrNull` gives, for every data type that has it (the nullable ones, the aggregated arrays) */
export function __onlyWhenOrNullOf(valueSource: DataTypeValueSource, when: boolean): any {
    const vs = valueSource as ValueSourceRoot
    if (when) {
        return vs
    } else {
        const nodeAsNull = vs.__node.asNull
        return nodeAsNull ? nodeAsNull(vs) : __newNullValueSource(__keptClassOf(vs, __typeClassOf(vs)), 'optional')
    }
}

/** What `ignoreWhenAsNull` gives, for every data type that has it (the nullable ones, the aggregated arrays) */
export function __ignoreWhenAsNullOf(valueSource: DataTypeValueSource, when: boolean): any {
    const vs = valueSource as ValueSourceRoot
    if (when) {
        const nodeAsNull = vs.__node.asNull
        return nodeAsNull ? nodeAsNull(vs) : __newNullValueSource(__keptClassOf(vs, __typeClassOf(vs)), 'optional')
    } else {
        return vs
    }
}
