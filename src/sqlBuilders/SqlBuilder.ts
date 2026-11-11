import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import type { ITable, IWithView, HasIsValue, AnyTableOrView } from '../utils/ITableOrView.js'
import type { IExecutableSelectQuery, AnyValueSource, AlwaysIfValueSource, INumberValueSource, IAggregatedArrayValueSource, IExecutableInsertQuery, IExecutableUpdateQuery, IExecutableDeleteQuery, ValueType } from '../expressions/values.js'
import { isValueSource, __getValueSourcePrivate } from '../expressions/values.js'
import type { DefaultTypeAdapter, TypeAdapter } from '../TypeAdapter.js'
import type { OrderByMode, SelectCustomization } from '../expressions/select.js'
import type { DBColumn } from '../utils/Column.js'
import type { QueryRunner } from '../queryRunners/QueryRunner.js'
import type { ConnectionConfiguration } from '../queryRunners/QueryRunner.js'
import type { UpdateCustomization } from '../expressions/update.js'
import type { DeleteCustomization } from '../expressions/delete.js'
import type { InsertCustomization } from '../expressions/insert.js'
import { isSelectQueryObject, isTableOrViewObject, isValueSourceObject } from '../utils/symbols.js'
import type { RawFragment } from '../utils/RawFragment.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

export type QueryColumns = { [property: string]: AnyValueSource | QueryColumns }
export type FlatQueryColumns = { [property: string]: AnyValueSource }

export function getQueryColumn(columns: QueryColumns, prop: string): AnyValueSource | undefined {
    const propName = prop as string
    let valueSource = columns[propName]
    if (valueSource) {
        if (isValueSource(valueSource)) {
            return valueSource
        } else {
            return undefined
        }
    }

    const route = propName.split('.')
    valueSource = columns
    for (let i = 0, length = route.length; valueSource && i < length; i++) {
        if (isValueSource(valueSource)) {
            return undefined
        }
        const currentProp = route[i]!
        valueSource = valueSource[currentProp]
    }
    if (isValueSource(valueSource)) {
        return valueSource
    } else {
        return undefined
    }
}

export function flattenQueryColumns(columns: QueryColumns, target: FlatQueryColumns, prefix: string) {
    for (let prop in columns) {
        const column = columns[prop]!
        if (!isUsableValue(prop, column, columns)) {
            continue
        }
        if (isValueSource(column)) {
            const name = prefix + prop
            if (target[name]) {
                throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'repeated column', columnPath: name }, "The column '" + name + "' appears twice in the result of the query: a property whose name contains a dot is the same result column as the property it names inside a nested object (`{ 'a.b': ... }` and `{ a: { b: ... } }` are both 'a.b'); rename one of them")
            }
            target[name] = column
        } else {
            flattenQueryColumns(column, target, prefix + prop + '.')
        }
    }
}

export function isAllowedQueryColumns(columns: QueryColumns, sqlBuilder: HasIsValue) {
    for (let prop in columns) {
        const column = columns[prop]!
        if (!isUsableValue(prop, column, columns)) {
            continue
        }
        if (isValueSource(column)) {
            const result = __getValueSourcePrivate(column).__isAllowed(sqlBuilder)
            if (!result) {
                return false
            }
        } else {
            const result = isAllowedQueryColumns(column, sqlBuilder)
            if (!result) {
                return false
            }
        }
    }
    return true
}

export function hasAggregationQueryColumns(columns: QueryColumns, sqlBuilder: HasIsValue): boolean {
    for (let prop in columns) {
        const column = columns[prop]!
        if (!isUsableValue(prop, column, columns)) {
            continue
        }
        if (isValueSource(column)) {
            if (__getValueSourcePrivate(column).__hasAggregation(sqlBuilder)) {
                return true
            }
        } else {
            if (hasAggregationQueryColumns(column, sqlBuilder)) {
                return true
            }
        }
    }
    return false
}

export function isUsableValue(prop: string, value: any, _columns: QueryColumns) {
    if (prop.startsWith('__')) {
        return false
    }
    if (!value) {
        return false
    }
    if (typeof value !== 'object') {
        return false
    }
    if (value[isValueSourceObject]) {
        return true
    }
    if (value[isTableOrViewObject]) {
        return true
    }
    return value.constructor === Object // Plain object
}

export interface WithSelectData {
    __type: 'with'
    __name: string
    __as?: string | undefined
    __selectData: SelectData
    __recursive?: boolean | undefined
    // The view of the recursive query used inside its own recursive member
    __ignoreWith?: boolean | undefined
}

export interface WithValuesData {
    __type: 'values'
    __name: string
    __as?: string | undefined
    __values: any[]
    __getTableOrView(): AnyTableOrView
}

export type WithData = WithSelectData | WithValuesData

export function hasWithData(value: any): value is WithData {
    if (value && value.__name && (value.__selectData || value.__values)) {
        return true
    } else {
        return false
    }
}

export function getWithData(withView: IWithView<any>): WithData {
    return withView as any
}

export interface JoinData {
    __joinType: 'join' | 'innerJoin' | 'leftJoin' | 'leftOuterJoin'
    __tableOrView: AnyTableOrView
    __on?: AlwaysIfValueSource<any, any> | undefined
    __optional?: boolean | undefined
}

export interface WithQueryData {
    __withs: Array<IWithView<any>>
    __customization?: SelectCustomization<any, any> | undefined
    __subSelectUsing?: Array<AnyTableOrView> | undefined
}

export type OrderByEntry = {
    expression: string | AnyValueSource | RawFragment<any>
    order: OrderByMode | null | undefined
}

export type SelectData = PlainSelectData | CompoundSelectData

export interface PlainSelectData extends WithQueryData {
    [isSelectQueryObject]: true
    __type: 'plain'
    __distinct: boolean
    __columns: QueryColumns
    __oneColumn: boolean
    __tablesOrViews: Array<AnyTableOrView>
    __joins: Array<JoinData>
    __where?: AlwaysIfValueSource<any, any> | undefined
    __startWith?: AlwaysIfValueSource<any, any> | undefined // Oracle
    __connectBy?: AlwaysIfValueSource<any, any> | undefined // Oracle
    __connectByNoCycle?: boolean | undefined // Oracle
    __having?: AlwaysIfValueSource<any, any> | undefined
    __groupBy:  Array<AnyValueSource>
    /** The group by entries the user named by their select column name (`groupBy('alias')`) */
    __groupByColumnNames?: Set<AnyValueSource> | undefined
    // The columns of the select the having refers to (having(columns => ...))
    __havingColumnNames?: Set<AnyValueSource> | undefined
    __orderBy?: OrderByEntry[] | undefined
    __orderingSiblingsOnly?: boolean | undefined // Oracle
    __limit?: number | INumberValueSource<any, any> | undefined
    __offset?: number | INumberValueSource<any, any> | undefined
    __requiredTablesOrViews?: Set<AnyTableOrView> | undefined
    __asInlineAggregatedArrayValue?: boolean | undefined
}

export type CompoundOperator = 'union' | 'unionAll' | 'intersect' | 'intersectAll' | 'except' | 'exceptAll' | 'minus' | 'minusAll'

export interface CompoundSelectData extends WithQueryData {
    [isSelectQueryObject]: true
    __type: 'compound'
    __firstQuery: SelectData
    __compoundOperator: CompoundOperator
    __secondQuery: SelectData
    __columns: QueryColumns
    __oneColumn: boolean
    __orderBy?: OrderByEntry[] | undefined
    __orderingSiblingsOnly?: boolean | undefined // Oracle
    __limit?: number | INumberValueSource<any, any> | undefined
    __offset?: number | INumberValueSource<any, any> | undefined
    __asInlineAggregatedArrayValue?: boolean | undefined
}

export interface InsertData extends WithQueryData {
    __table: ITable<any>
    __shape?: { [property: string] : string } | undefined
    __sets: { [property: string]: any }
    __multiple?: { [property: string]: any }[] | undefined
    __idColumn?: DBColumn | undefined
    __from?: SelectData | undefined
    __customization?: InsertCustomization<any, any> | undefined
    __columns?: QueryColumns | undefined
    __onConflictOnConstraint?: RawFragment<any> | undefined
    __onConflictOnColumns?: AnyValueSource[] | undefined
    __onConflictOnColumnsWhere?: AlwaysIfValueSource<any, any> | undefined
    __onConflictDoNothing?: boolean | undefined
    __onConflictUpdateShape?: { [property: string] : string } | undefined
    __onConflictUpdateSets?: { [property: string]: any } | undefined
    __onConflictUpdateWhere?: AlwaysIfValueSource<any, any> | undefined
    // Pseudo-table tracking — twin of `UpdateData.__oldValues`. Holds the
    // `valuesForInsert()` pseudo-table (the `excluded` / `_new_` / `VALUES()`
    // row) when the `on conflict do update` set/where references it; populated by
    // `InsertQueryBuilder` walking those clauses through `__getValuesForInsert`.
    // Purpose: let the builder EXCLUDE this pseudo-table from any table listing it
    // derives from the query, exactly as `_extractAdditionalRequiredTablesForUpdate`
    // drops `__oldValues` from the emulated `update ... from`.
    //
    // WRITE-ONLY BY DESIGN (do not flag as dead): unlike UPDATE — whose
    // `update ... from` emulation has to list the real tables involved — no INSERT
    // build path derives such a listing yet, because the `excluded` / `_new_` /
    // `VALUES()` pseudo-tables are implicit in each dialect's `on conflict` syntax.
    // The reference SQL comes solely from the boolean flag on the table clone
    // (`TableOf.__valuesForInsert` → `AbstractSqlBuilder._appendRawColumnName`), not
    // from this field. It is kept populated for symmetry with `__oldValues` and so a
    // future insert-side table listing can filter it out without re-deriving it.
    __valuesForInsert?: AnyTableOrView | undefined
}

export interface UpdateData extends WithQueryData {
    __table: ITable<any>
    __shape?: { [property: string] : DBColumn | string } | undefined
    __sets: { [property: string] : any}
    __where?: AlwaysIfValueSource<any, any> | undefined
    __allowNoWhere: boolean
    __customization?: UpdateCustomization<any, any> | undefined
    __columns?: QueryColumns | undefined
    // Pseudo-table tracking — the CONSUMED twin of `InsertData.__valuesForInsert`.
    // Holds the `oldValues()` pseudo-table referenced by this update, so the builder
    // can EXCLUDE it from any table listing it derives from the query. Consumed by
    // `_extractAdditionalRequiredTablesForUpdate`, which collects the real tables the
    // set/columns reference to add to the emulated `update ... from` and then drops
    // both the target (`__table`) and this pseudo-table (`result.delete(query.__oldValues)`).
    __oldValues?: AnyTableOrView | undefined
    __froms?: Array<AnyTableOrView> | undefined
    __joins?: Array<JoinData> | undefined
}

export interface DeleteData extends WithQueryData {
    __table: ITable<any>,
    __where?: AlwaysIfValueSource<any, any> | undefined
    __allowNoWhere: boolean
    __customization?: DeleteCustomization<any, any> | undefined
    __columns?: QueryColumns | undefined
    __using?: Array<AnyTableOrView> | undefined
    __joins?: Array<JoinData> | undefined
}

/**
 * What the value sources, the fragments and the query builders can ask of the SQL builder of the connection: the SQL of
 * each operation (SqlOperation) and of each query, and what they need to build them. It isn't the full shape of
 * AbstractSqlBuilder: a method the SQL builder only calls on itself, or that a dialect overrides for itself, stays out;
 * a method goes here when an expression or a query builder has to call it.
 */
export interface SqlBuilder extends SqlOperation {
    _defaultTypeAdapter: DefaultTypeAdapter
    _queryRunner: QueryRunner
    _connectionConfiguration: ConnectionConfiguration
    _checkConnectionConfiguration(): void
    _isValue(value: any): boolean
    _resultColumnKey(name: string): string
    _isReservedKeyword(word: string): boolean
    _forceAsIdentifier(identifier: string): string
    _isQuotedIdentifier(identifier: string): boolean
    _appendColumnName(column: DBColumn, context: SqlBuildContext): string
    _appendColumnNameForCondition(column: DBColumn, context: SqlBuildContext): string
    _buildSelect(query: SelectData, context: SqlBuildContext): string
    _buildInlineSelect(query: SelectData, context: SqlBuildContext): string
    _buildInsertDefaultValues(query: InsertData, context: SqlBuildContext): string
    _buildInsert(query: InsertData, context: SqlBuildContext): string
    _buildInsertFromSelect(query: InsertData, context: SqlBuildContext): string
    _buildInsertMultiple(query: InsertData, context: SqlBuildContext): string
    _isInsertOnConflictUpdateSetEmpty(query: InsertData): boolean
    _buildUpdate(query: UpdateData, context: SqlBuildContext): string
    _buildDelete(query: DeleteData, context: SqlBuildContext): string
    _typedOperand<T>(operand: T, otherOperands: any[], operation?: string): T
    _appendSelectColumnReference(column: AnyValueSource, context: SqlBuildContext): string
    _appendSelectColumnReferenceForCondition(column: AnyValueSource, context: SqlBuildContext): string
    _typedConst(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _typedConstForCondition(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _buildCallProcedure(context: SqlBuildContext, procedureName: string, procedureParams: AnyValueSource[]): string
    _buildCallFunction(context: SqlBuildContext, functionCall: AnyValueSource): string
    _appendFunctionCall(context: SqlBuildContext, functionName: string, functionParams: AnyValueSource[]): string

    _rawFragment(context: SqlBuildContext, sql: TemplateStringsArray, sqlParams: Array<AnyValueSource | IExecutableSelectQuery<any, any, any> | IExecutableInsertQuery<any, any> | IExecutableUpdateQuery<any, any> | IExecutableDeleteQuery<any, any>>): string
    _rawFragmentTableName(context: SqlBuildContext, tableOrView: AnyTableOrView): string
    _rawFragmentTableAlias(context: SqlBuildContext, tableOrView: AnyTableOrView): string

    _inlineSelectAsValue(query: SelectData, context: SqlBuildContext): string
    _inlineSelectAsValueForCondition(query: SelectData, context: SqlBuildContext): string
    _aggregateValueAsArray(valueSource: IAggregatedArrayValueSource<any, any, any>, context: SqlBuildContext): string
}

export interface ToSql {
    __toSql(sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string
    __toSqlForCondition(sqlBuilder: SqlBuilder, context: SqlBuildContext, forceTypeCast: boolean): string
}

export function hasToSql(value: any): value is ToSql {
    if (value === undefined || value === null) {
        return false
    }
    if (typeof value === 'object') {
        return typeof value.__toSql === 'function'
    }
    return false
}

export interface HasOperation {
    __operation: keyof SqlOperation
}

export function operationOf(value: any): keyof SqlOperation | null {
    if (value === undefined || value === null) {
        return null
    }
    if (typeof value.__operation === 'string') {
        return value.__operation as keyof SqlOperation
    }
    return null
}

export interface SqlComparator0 {
    _isNull(context: SqlBuildContext, valueSource: ToSql): string
    _isNotNull(context: SqlBuildContext, valueSource: ToSql): string
}

export interface SqlComparator1 {
    _equals(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notEquals(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _is(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _isNot(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _equalsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notEqualsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _lessThan(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _greaterThan(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _lessOrEqual(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _greaterOrEqual(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _in(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notIn(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _like(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notLike(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _likeInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notLikeInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _startsWith(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notStartsWith(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _endsWith(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notEndsWith(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _startsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notStartsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _endsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notEndsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _contains(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notContains(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _containsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notContainsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
}

export interface SqlComparator2 {
    _between(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notBetween(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
}

export interface SqlFunctionStatic0 {
    _pi(context: SqlBuildContext): string
    _random(context: SqlBuildContext): string
    _currentDate(context: SqlBuildContext): string
    _currentTime(context: SqlBuildContext): string
    _currentTimestamp(context: SqlBuildContext): string
    _default(context: SqlBuildContext): string
    _true(context: SqlBuildContext): string
    _false(context: SqlBuildContext): string
    _trueForCondition(context: SqlBuildContext): string
    _falseForCondition(context: SqlBuildContext): string
}

export interface SqlFunctionStatic1 {
    _const(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string
    _constForCondition(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string
    _exists(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string
    _notExists(context: SqlBuildContext, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string
}

export interface SqlBoolean0 {
    // Boolean
    _negate(context: SqlBuildContext, valueSource: ToSql): string
}

export interface SqlFunction0 {
    // String
    _toLowerCase(context: SqlBuildContext, valueSource: ToSql): string
    _toUpperCase(context: SqlBuildContext, valueSource: ToSql): string
    _length(context: SqlBuildContext, valueSource: ToSql): string
    _trim(context: SqlBuildContext, valueSource: ToSql): string
    _trimLeft(context: SqlBuildContext, valueSource: ToSql): string
    _trimRight(context: SqlBuildContext, valueSource: ToSql): string
    _reverse(context: SqlBuildContext, valueSource: ToSql): string
    // Number functions
    _asDouble(context: SqlBuildContext, valueSource: ToSql): string
    _asInt(context: SqlBuildContext, valueSource: ToSql): string
    _asBigint(context: SqlBuildContext, valueSource: ToSql): string
    _abs(context: SqlBuildContext, valueSource: ToSql): string
    _ceil(context: SqlBuildContext, valueSource: ToSql): string
    _floor(context: SqlBuildContext, valueSource: ToSql): string
    _round(context: SqlBuildContext, valueSource: ToSql): string
    _exp(context: SqlBuildContext, valueSource: ToSql): string
    _ln(context: SqlBuildContext, valueSource: ToSql): string
    _log10(context: SqlBuildContext, valueSource: ToSql): string
    _sqrt(context: SqlBuildContext, valueSource: ToSql): string
    _cbrt(context: SqlBuildContext, valueSource: ToSql): string
    _sign(context: SqlBuildContext, valueSource: ToSql): string
    // Trigonometric Functions
    _acos(context: SqlBuildContext, valueSource: ToSql): string
    _asin(context: SqlBuildContext, valueSource: ToSql): string
    _atan(context: SqlBuildContext, valueSource: ToSql): string
    _cos(context: SqlBuildContext, valueSource: ToSql): string
    _cot(context: SqlBuildContext, valueSource: ToSql): string
    _sin(context: SqlBuildContext, valueSource: ToSql): string
    _tan(context: SqlBuildContext, valueSource: ToSql): string
    // Date Functions
    _getDate(context: SqlBuildContext, valueSource: ToSql): string
    _getTime(context: SqlBuildContext, valueSource: ToSql): string
    _getFullYear(context: SqlBuildContext, valueSource: ToSql): string
    _getMonth(context: SqlBuildContext, valueSource: ToSql): string
    _getDay(context: SqlBuildContext, valueSource: ToSql): string
    _getHours(context: SqlBuildContext, valueSource: ToSql): string
    _getMinutes(context: SqlBuildContext, valueSource: ToSql): string
    _getSeconds(context: SqlBuildContext, valueSource: ToSql): string
    _getMilliseconds(context: SqlBuildContext, valueSource: ToSql): string
    // Uuid
    _asString(context: SqlBuildContext, valueSource: ToSql): string
    // Oracle recursive
    _prior(context: SqlBuildContext, valueSource: ToSql): string
}

export interface SqlBoolean1 {
    // Boolean
    _and(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _or(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
}

export interface SqlFunction1 {
    _valueWhenNull(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _nullIfValue(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    // String
    _concat(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _concatIgnoringNull(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _substrToEnd(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _substringToEnd(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    // Number
    _power(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _logn(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _roundn(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _minimumBetweenTwoValues(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _maximumBetweenTwoValues(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    // Number operators
    _add(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _subtract(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _multiply(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _divide(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _modulo(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string // %
    // Trigonometric Functions
    _atan2(context: SqlBuildContext, valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
}
// avg, count, max, median, min,
// greatest, least
// regexp_count, remainder
export interface SqlFunction2 {
    // String
    _substr(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _substring(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _replaceAll(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _replaceAllInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
}

export interface SqlSequenceOperation {
    _nextSequenceValue(context: SqlBuildContext, sequenceName: string, columnType: ValueType): string
    _currentSequenceValue(context: SqlBuildContext, sequenceName: string, columnType: ValueType): string
}

export interface SqlFragmentOperation {
    _fragment(context: SqlBuildContext, sql: TemplateStringsArray, sqlParams: AnyValueSource[]): string
}

export interface AggregateFunctions0 {
    _countAll(context: SqlBuildContext): string
}

export interface AggregateFunctions1 {
    _count(context: SqlBuildContext, value: any): string
    _countDistinct(context: SqlBuildContext, value: any): string
    _max(context: SqlBuildContext, value: any): string
    _min(context: SqlBuildContext, value: any): string
    _sum(context: SqlBuildContext, value: any): string
    _sumDistinct(context: SqlBuildContext, value: any): string
    _average(context: SqlBuildContext, value: any): string
    _averageDistinct(context: SqlBuildContext, value: any): string
    _anyValue(context: SqlBuildContext, value: any): string
}

export interface AggregateFunctions1or2 {
    _stringConcat(context: SqlBuildContext, separator: string | undefined, value: any): string
    _stringConcatDistinct(context: SqlBuildContext, separator: string | undefined, value: any): string
}

export interface SqlOperationStatic0 extends SqlFunctionStatic0 {
}

export interface SqlOperationStatic1 extends SqlFunctionStatic1 {
}

export interface SqlOperation0 extends SqlComparator0, SqlBoolean0, SqlFunction0 {
}

export interface SqlOperation1 extends SqlComparator1, SqlBoolean1, SqlFunction1 {
}

export interface SqlOperation2 extends SqlComparator2, SqlFunction2 {
}

export interface SqlOperation extends SqlOperationStatic0, SqlOperationStatic1, SqlOperation0, SqlOperation1, SqlOperation2, SqlSequenceOperation, SqlFragmentOperation, AggregateFunctions0, AggregateFunctions1, AggregateFunctions1or2 {
    _collate(context: SqlBuildContext, valueSource: ToSql, collation: string): string
    _inlineSelectAsValue(query: SelectData, context: SqlBuildContext): string
    _asNullValue(context: SqlBuildContext, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
}
