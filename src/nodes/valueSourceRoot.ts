import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder } from '../sqlBuilders/SqlBuilder.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import type { AnyTableOrView, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getTableOrViewPrivate, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import type { isValueSourceObject } from '../utils/symbols.js'
import type { AnyType } from '../typeSystem/base.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import type { OptionalType } from '../typeSystem/valueSource.js'
import { type NodeStrategy, type NodeValueSource, __asNodeValueSource, __keepAggregatedArrayShape } from './NodeStrategy.js'
import { __newAllowWhenValueSource } from './allowWhen.js'
import { __newNullValueSource } from './constants.js'
import { __sameTypeClassOf, __typeClassOf } from './dataTypeClassOf.js'
import { __newNoopValueSource } from './operations.js'
import { typeAdapterOfClass, __adaptedTypeClassOf, __keptClassOf } from './adaptedTypeClass.js'

export class ValueSourceRoot implements NodeValueSource {
    /** The mark of a value source for TypeScript (AnyValueSource); nothing at run time */
    declare readonly [isValueSourceObject]: true
    __optionalType: OptionalType

    constructor(optionalType: OptionalType) {
        this.__optionalType = optionalType
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
export function __asRequiredInOptionalObjectOf(valueSource: AnyType): any {
    const vs = __asNodeValueSource(valueSource)
    const nodeAsRequiredInOptionalObject = vs.__node.asRequiredInOptionalObject
    if (nodeAsRequiredInOptionalObject) {
        return nodeAsRequiredInOptionalObject(vs)
    }
    const result = __newNoopValueSource(vs, __keptClassOf(vs, __sameTypeClassOf(vs)), 'requiredInOptionalObject')
    __keepAggregatedArrayShape(result, vs)
    return result
}

/** What `onlyWhenOrNull` gives, for every data type that has it (the nullable ones, the aggregated arrays) */
export function __onlyWhenOrNullOf(valueSource: AnyType, when: boolean): any {
    const vs = __asNodeValueSource(valueSource)
    if (when) {
        return vs
    } else {
        const nodeAsNull = vs.__node.asNull
        return nodeAsNull ? nodeAsNull(vs) : __newNullValueSource(__keptClassOf(vs, __typeClassOf(vs)), 'optional')
    }
}

/** What `ignoreWhenAsNull` gives, for every data type that has it (the nullable ones, the aggregated arrays) */
export function __ignoreWhenAsNullOf(valueSource: AnyType, when: boolean): any {
    const vs = __asNodeValueSource(valueSource)
    if (when) {
        const nodeAsNull = vs.__node.asNull
        return nodeAsNull ? nodeAsNull(vs) : __newNullValueSource(__keptClassOf(vs, __typeClassOf(vs)), 'optional')
    } else {
        return vs
    }
}
