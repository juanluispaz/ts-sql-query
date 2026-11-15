import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder, ToSql } from '../sqlBuilders/SqlBuilder.js'
import type { TypedValueSource } from '../typeSystem/valueSource.js'
import type { TypeAdapter } from '../TypeAdapter.js'
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

export class ValueSourceRoot implements TypedValueSource<any, any, any>, __ValueSourcePrivate, ToSql {
    [typeName]: any
    [source]: any

    [valueType_]: any
    [optionalType_]: any

    [isValueSourceObject]: true = true
    __type: string
    __customType: CustomType | undefined
    __optionalType: OptionalType
    __typeAdapter?: TypeAdapter | undefined
    __isAggregate?: boolean | undefined
    __aggregatedArrayColumns?: __AggregatedArrayColumns | AnyValueSource | undefined
    __aggregatedArrayMode?: __AggregatedArrayMode | undefined
    __aggreagtedProjectingOptionalValuesAsNullable?: boolean | undefined

    constructor(optionalType: OptionalType, typeAdapter: TypeAdapter | undefined, aggregatedArrayColumns?: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayMode?: __AggregatedArrayMode, aggregatedProjectingOptionalValuesAsNullable?: boolean) {
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
            result = __newAllowWhenValueSource(when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'allowWhen' }, error), this)
        } else {
            result = __newAllowWhenValueSource(when, error, this)
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
            result = __newAllowWhenValueSource(!when, new TsSqlProcessingError({ reason: 'DISALLOWED', message: error, functionName: 'disallowWhen' }, error), this)
        } else {
            result = __newAllowWhenValueSource(!when, error, this)
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
    const result = __newNoopValueSource(vs, __sameTypeClassOf(vs), 'requiredInOptionalObject', vs.__typeAdapter)
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
        return nodeAsNull ? nodeAsNull(vs) : __newNullValueSource(__typeClassOf(vs), 'optional', vs.__typeAdapter)
    }
}

/** What `ignoreWhenAsNull` gives, for every data type that has it (the nullable ones, the aggregated arrays) */
export function __ignoreWhenAsNullOf(valueSource: DataTypeValueSource, when: boolean): any {
    const vs = valueSource as ValueSourceRoot
    if (when) {
        const nodeAsNull = vs.__node.asNull
        return nodeAsNull ? nodeAsNull(vs) : __newNullValueSource(__typeClassOf(vs), 'optional', vs.__typeAdapter)
    } else {
        return vs
    }
}
