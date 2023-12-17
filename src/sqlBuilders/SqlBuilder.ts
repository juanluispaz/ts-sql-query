import type { ITableOrView, ITable, IWithView, HasIsValue } from "../utils/ITableOrView"
import { IExecutableSelectQuery, AnyValueSource, AlwaysIfValueSource, INumberValueSource, IIntValueSource, isValueSource, IAggregatedArrayValueSource, IExecutableInsertQuery, IExecutableUpdateQuery, IExecutableDeleteQuery, IStringValueSource, ITypeSafeStringValueSource, __getValueSourcePrivate, ValueType } from "../expressions/values"
import type { int } from "ts-extended-types"
import type { DefaultTypeAdapter, TypeAdapter } from "../TypeAdapter"
import type { OrderByMode, SelectCustomization } from "../expressions/select"
import type { Column } from "../utils/Column"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { ConnectionConfiguration } from "../utils/ConnectionConfiguration"
import type { UpdateCustomization } from "../expressions/update"
import type { DeleteCustomization } from "../expressions/delete"
import type { InsertCustomization } from "../expressions/insert"
import type { isSelectQueryObject } from "../utils/symbols"
import { RawFragment } from "../utils/RawFragment"

export type QueryColumns = { [property: string]: AnyValueSource | QueryColumns }
export type FlatQueryColumns = { [property: string]: AnyValueSource }

export function getQueryColumn(columns: QueryColumns, prop: string| number | symbol): AnyValueSource | undefined {
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
        if (isValueSource(column)) {
            const name = prefix + prop
            if (target[name]) {
                throw new Error("You are trying to use the same column name '" + name + "' several times in the same query")
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

export interface WithSelectData {
    __type: 'with'
    __name: string
    __as?: string
    __selectData: SelectData
    __recursive?: boolean
}

export interface WithValuesData {
    __type: 'values'
    __name: string
    __as?: string
    __values: any[]
    __getTableOrView(): ITableOrView<any>
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
    __tableOrView: ITableOrView<any>
    __on?: AlwaysIfValueSource<any, any>
    __optional?: boolean
}

export interface WithQueryData {
    __withs: Array<IWithView<any>>
    __customization?: SelectCustomization<any>
    __subSelectUsing?: Array<ITableOrView<any>>
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
    __tablesOrViews: Array<ITableOrView<any>>
    __joins: Array<JoinData>
    __where?: AlwaysIfValueSource<any, any>
    __startWith?: AlwaysIfValueSource<any, any> // Oracle
    __connectBy?: AlwaysIfValueSource<any, any> // Oracle
    __connectByNoCycle?: boolean // Oracle
    __having?: AlwaysIfValueSource<any, any>
    __groupBy:  Array<AnyValueSource>
    __orderBy?: OrderByEntry[]
    __orderingSiblingsOnly?: boolean // Oracle
    __limit?: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>
    __offset?: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>
    __requiredTablesOrViews?: Set<ITableOrView<any>>
    __asInlineAggregatedArrayValue?: boolean
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
    __orderBy?: OrderByEntry[]
    __orderingSiblingsOnly?: boolean // Oracle
    __limit?: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>
    __offset?: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>
    __asInlineAggregatedArrayValue?: boolean
}

export interface InsertData extends WithQueryData {
    __table: ITable<any>
    __shape?: { [property: string] : string }
    __sets: { [property: string]: any }
    __multiple?: { [property: string]: any }[]
    __idColumn?: Column
    __from?: SelectData
    __customization?: InsertCustomization<any>
    __columns?: QueryColumns
    __onConflictOnConstraint?: string | IStringValueSource<any, any> | ITypeSafeStringValueSource<any, any> | RawFragment<any>
    __onConflictOnColumns?: AnyValueSource[]
    __onConflictOnColumnsWhere?: AlwaysIfValueSource<any, any>
    __onConflictDoNothing?: boolean
    __onConflictUpdateShape?: { [property: string] : string }
    __onConflictUpdateSets?: { [property: string]: any }
    __onConflictUpdateWhere?: AlwaysIfValueSource<any, any>
    __valuesForInsert?: ITableOrView<any>
}

export interface UpdateData extends WithQueryData {
    __table: ITable<any>
    __shape?: { [property: string] : Column | string }
    __sets: { [property: string] : any}
    __where?: AlwaysIfValueSource<any, any>
    __allowNoWhere: boolean
    __customization?: UpdateCustomization<any>
    __columns?: QueryColumns
    __oldValues?: ITableOrView<any>
    __froms?: Array<ITableOrView<any>>
    __joins?: Array<JoinData>
}

export interface DeleteData extends WithQueryData {
    __table: ITable<any>,
    __where?: AlwaysIfValueSource<any, any>
    __allowNoWhere: boolean
    __customization?: DeleteCustomization<any>
    __columns?: QueryColumns
    __using?: Array<ITableOrView<any>>
    __joins?: Array<JoinData>
}

export interface SqlBuilder extends SqlOperation {
    _defaultTypeAdapter: DefaultTypeAdapter
    _queryRunner: QueryRunner
    _connectionConfiguration: ConnectionConfiguration
    _isValue(value: any): boolean
    _isReservedKeyword(word: string): boolean
    _forceAsIdentifier(identifier: string): string
    _appendColumnName(column: Column, params: any[]): string
    _appendColumnNameForCondition(column: Column, params: any[]): string
    _buildSelect(query: SelectData, params: any[]): string
    _buildInlineSelect(query: SelectData, params: any[]): string
    _buildInsertDefaultValues(query: InsertData, params: any[]): string
    _buildInsert(query: InsertData, params: any[]): string
    _buildInsertFromSelect(query: InsertData, params: any[]): string
    _buildInsertMultiple(query: InsertData, params: any[]): string
    _buildUpdate(query: UpdateData, params: any[]): string
    _buildDelete(query: DeleteData, params: any[]): string
    _buildCallProcedure(params: any[], procedureName: string, procedureParams: AnyValueSource[]): string
    _buildCallFunction(params: any[], functionName: string, functionParams: AnyValueSource[]): string
    _generateUnique(): number
    _resetUnique(): void

    _rawFragment(params: any[], sql: TemplateStringsArray, sqlParams: Array<AnyValueSource | IExecutableSelectQuery<any, any, any, any> | IExecutableInsertQuery<any, any> | IExecutableUpdateQuery<any, any> | IExecutableDeleteQuery<any, any>>): string
    _rawFragmentTableName(params: any[], tableOrView: ITableOrView<any>): string
    _rawFragmentTableAlias(params: any[], tableOrView: ITableOrView<any>): string

    _inlineSelectAsValue(query: SelectData, params: any[]): string
    _inlineSelectAsValueForCondition(query: SelectData, params: any[]): string
    _aggregateValueAsArray(valueSource: IAggregatedArrayValueSource<any, any, any>, params: any[]): string
}

export interface ToSql {
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string
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
    _isNull(params: any[], valueSource: ToSql): string
    _isNotNull(params: any[], valueSource: ToSql): string
}

export interface SqlComparator1 {
    _equals(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notEquals(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _is(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _equalsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notEqualsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _lessThan(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _greaterThan(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _lessOrEquals(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _greaterOrEquals(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _in(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notIn(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _like(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notLike(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _likeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _startsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notStartsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _endsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notEndsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _contains(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
}

export interface SqlComparator2 {
    _between(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notBetween(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
}

export interface SqlFunctionStatic0 {
    _pi(params: any): string
    _random(params: any): string
    _currentDate(params: any): string
    _currentTime(params: any): string
    _currentTimestamp(params: any): string
    _default(params: any): string
    _true(params: any): string
    _false(params: any): string
    _trueForCondition(params: any): string
    _falseForCondition(params: any): string
}

export interface SqlFunctionStatic1 {
    _const(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _constForCondition(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _exists(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _notExists(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _escapeLikeWildcard(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
}

export interface SqlFunction0 {
    // Boolean
    _negate(params: any[], valueSource: ToSql): string
    // String
    _toLowerCase(params: any[], valueSource: ToSql): string
    _toUpperCase(params: any[], valueSource: ToSql): string
    _length(params: any[], valueSource: ToSql): string
    _trim(params: any[], valueSource: ToSql): string
    _trimLeft(params: any[], valueSource: ToSql): string
    _trimRight(params: any[], valueSource: ToSql): string
    _reverse(params: any[], valueSource: ToSql): string
    // Number functions
    _asDouble(params: any[], valueSource: ToSql): string
    _abs(params: any[], valueSource: ToSql): string
    _ceil(params: any[], valueSource: ToSql): string
    _floor(params: any[], valueSource: ToSql): string
    _round(params: any[], valueSource: ToSql): string
    _exp(params: any[], valueSource: ToSql): string
    _ln(params: any[], valueSource: ToSql): string
    _log10(params: any[], valueSource: ToSql): string
    _sqrt(params: any[], valueSource: ToSql): string
    _cbrt(params: any[], valueSource: ToSql): string
    _sign(params: any[], valueSource: ToSql): string
    // Trigonometric Functions
    _acos(params: any[], valueSource: ToSql): string
    _asin(params: any[], valueSource: ToSql): string
    _atan(params: any[], valueSource: ToSql): string
    _cos(params: any[], valueSource: ToSql): string
    _cot(params: any[], valueSource: ToSql): string
    _sin(params: any[], valueSource: ToSql): string
    _tan(params: any[], valueSource: ToSql): string
    // Date Functions
    _getDate(params: any[], valueSource: ToSql): string
    _getTime(params: any[], valueSource: ToSql): string
    _getFullYear(params: any[], valueSource: ToSql): string
    _getMonth(params: any[], valueSource: ToSql): string
    _getDay(params: any[], valueSource: ToSql): string
    _getHours(params: any[], valueSource: ToSql): string
    _getMinutes(params: any[], valueSource: ToSql): string
    _getSeconds(params: any[], valueSource: ToSql): string
    _getMilliseconds(params: any[], valueSource: ToSql): string
    // Uuid
    _asString(params: any[], valueSource: ToSql): string
    // Oracle recursive
    _prior(params: any[], valueSource: ToSql): string
}

export interface SqlFunction1 {
    _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _nullIfValue(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    // Boolean
    _and(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _or(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    // String
    _concat(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _substrToEnd(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _substringToEnd(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    // Number
    _power(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _logn(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _roundn(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _minimumBetweenTwoValues(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _maximumBetweenTwoValues(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    // Number operators
    _add(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _substract(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _multiply(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _divide(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _modulo(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string // %
    // Trigonometric Functions
    _atan2(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
}
// avg, count, max, median, min,
// greatest, least
// regexp_count, remainder
export interface SqlFunction2 {
    // String
    _substr(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _substring(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
    _replaceAll(params: any[], valueSource: ToSql, value: any, value2: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
}

export interface SqlSequenceOperation {
    _nextSequenceValue(params: any[], sequenceName: string): string
    _currentSequenceValue(params: any[], sequenceName: string): string
}

export interface SqlFragmentOperation {
    _fragment(params: any[], sql: TemplateStringsArray, sqlParams: AnyValueSource[]): string
}

export interface AggregateFunctions0 {
    _countAll(params: any[]): string
}

export interface AggregateFunctions1 {
    _count(params: any[], value: any): string
    _countDistinct(params: any[], value: any): string
    _max(params: any[], value: any): string
    _min(params: any[], value: any): string
    _sum(params: any[], value: any): string
    _sumDistinct(params: any[], value: any): string
    _average(params: any[], value: any): string
    _averageDistinct(params: any[], value: any): string
}

export interface AggregateFunctions1or2 {
    _stringConcat(params: any[], separator: string | undefined, value: any): string
    _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string
}

export interface SqlOperationStatic0 extends SqlFunctionStatic0 {
}

export interface SqlOperationStatic1 extends SqlFunctionStatic1 {
}

export interface SqlOperation0 extends SqlComparator0, SqlFunction0 {
}

export interface SqlOperation1 extends SqlComparator1, SqlFunction1 {
}

export interface SqlOperation2 extends SqlComparator2, SqlFunction2 {
}

export interface SqlOperation extends SqlOperationStatic0, SqlOperationStatic1, SqlOperation0, SqlOperation1, SqlOperation2, SqlSequenceOperation, SqlFragmentOperation, AggregateFunctions0, AggregateFunctions1, AggregateFunctions1or2 {
    _inlineSelectAsValue(query: SelectData, params: any[]): string
    _asNullValue(params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string
}
