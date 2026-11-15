import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { SqlBuilder, SqlFragmentOperation } from '../sqlBuilders/SqlBuilder.js'
import { hasToSql } from '../sqlBuilders/SqlBuilder.js'
import type { AnyTableOrView, HasIsValue, IWithView } from '../utils/ITableOrView.js'
import { __getOldValues, __getTableOrViewPrivate, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { DBColumn } from '../utils/Column.js'
import type { FragmentQueryBuilder } from '../queryBuilders/FragmentQueryBuilder.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { __isDouble, __isExactDecimal, __isUuid } from '../typeSystem/dataTypes.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import type { AnyValueSource, OptionalType, __AggregatedArrayColumns, __AggregatedArrayMode, __ValueSourcePrivate } from '../typeSystem/valueSource.js'
import { __getValueSourcePrivate } from '../typeSystem/valueSource.js'
import { type NodeStrategy, valueSourceNode, type NodeValueSource } from './NodeStrategy.js'
import { type ValueSourceConstructor } from './dataTypeClassOf.js'
import { __adaptedTypeClassOf } from './adaptedTypeClass.js'

export interface FragmentValueSource extends NodeValueSource {
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

export function __newFragmentValueSource(sql: TemplateStringsArray, sqlParams: AnyValueSource[], typeClass: DataTypeClass, optionalType: OptionalType, isAggregate?: boolean): FragmentValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as FragmentValueSource
    vs.__node = fragmentValueSourceNode
    vs.__operation = '_fragment' // Needed to detect if parenthesis is required

    vs.__sql = sql
    vs.__sqlParams = sqlParams
    if (isAggregate) {
        vs.__isAggregate = true
    }
    return vs
}

/**
 * The call of a function of the database whose result `executeFunction` reads: it is selected as any other value of a
 * select, so the result is converted by its type as a column is (like the uuid of a database that stores it in binary)
 */
export interface FunctionCallValueSource extends NodeValueSource {
    __functionName: string
    __functionParams: AnyValueSource[]
}

export const functionCallValueSourceNode: NodeStrategy<FunctionCallValueSource> = {
    ...valueSourceNode,
    __toSql(vs: FunctionCallValueSource, sqlBuilder: SqlBuilder, context: SqlBuildContext, _forceTypeCast: boolean): string {
        return sqlBuilder._appendFunctionCall(context, vs.__functionName, vs.__functionParams)
    },
}

export function __newFunctionCallValueSource(functionName: string, functionParams: AnyValueSource[], typeClass: DataTypeClass, optionalType: OptionalType): FunctionCallValueSource {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as FunctionCallValueSource
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

export interface ValueSourceFromBuilder extends NodeValueSource {
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

export function __newValueSourceFromBuilder(builder: (fragmentBuilder: FragmentQueryBuilder) => AnyValueSource, fragmentBuilder: FragmentQueryBuilder, typeClass: DataTypeClass, optionalType: OptionalType): ValueSourceFromBuilder {
    const vs = new (typeClass as unknown as ValueSourceConstructor)(optionalType) as ValueSourceFromBuilder
    vs.__node = valueSourceFromBuilderNode
    vs.__builder = builder
    vs.__fragmentBuilder = fragmentBuilder
    return vs
}
