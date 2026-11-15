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
import type { CustomType } from '../TypeAdapter.js'
import type { OptionalType, __AggregatedArrayColumns, __AggregatedArrayMode, __ValueSourcePrivate } from '../typeSystem/valueSource.js'
import { __getValueSourcePrivate } from '../typeSystem/valueSource.js'

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
