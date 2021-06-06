import type { ITableOrView, ITable, IWithView } from "../utils/ITableOrView"
import type { BooleanValueSource, NumberValueSource, IntValueSource, ValueSource, __OptionalRule, IfValueSource } from "../expressions/values"
import type { int } from "ts-extended-types"
import type { DefaultTypeAdapter, TypeAdapter } from "../TypeAdapter"
import type { OrderByMode } from "../expressions/select"
import type { Column } from "../utils/Column"
import type { QueryRunner } from "../queryRunners/QueryRunner"
import type { ConnectionConfiguration } from "../utils/ConnectionConfiguration"

export interface WithData {
    __name: string
    __as?: string
    __selectData: SelectData
    __optionalRule: __OptionalRule
    __recursive?: boolean
}

export function getWithData(withView: IWithView<any>): WithData {
    return withView as any
}

export interface JoinData {
    __joinType: 'join' | 'innerJoin' | 'leftJoin' | 'leftOuterJoin'
    __tableOrView: ITableOrView<any>
    __on?: BooleanValueSource<any, any> | IfValueSource<any, any>
    __optional?: boolean
}

export interface WithQueryData {
    __withs: Array<IWithView<any>>
}

export type SelectData = PlainSelectData | CompoundSelectData

export interface PlainSelectData extends WithQueryData {
    __type: 'plain'
    __distinct: boolean
    __columns: { [property: string]: ValueSource<any, any> }
    __tablesOrViews: Array<ITableOrView<any>>
    __joins: Array<JoinData>
    __where?: BooleanValueSource<any, any> | IfValueSource<any, any>
    __having?: BooleanValueSource<any, any> | IfValueSource<any, any>
    __groupBy:  Array<ValueSource<any, any>>
    __orderBy?: { [property: string]: OrderByMode | null | undefined }
    __limit?: int | number | NumberValueSource<any, any> | IntValueSource<any, any>
    __offset?: int | number | NumberValueSource<any, any> | IntValueSource<any, any>
    __requiredTablesOrViews?: Set<ITableOrView<any>>
}

export type CompoundOperator = 'union' | 'unionAll' | 'intersect' | 'intersectAll' | 'except' | 'exceptAll' | 'minus' | 'minusAll'

export interface CompoundSelectData extends WithQueryData {
    __type: 'compound'
    __firstQuery: SelectData
    __compoundOperator: CompoundOperator
    __secondQuery: SelectData
    __columns: { [property: string]: ValueSource<any, any> }
    __orderBy?: { [property: string]: OrderByMode | null | undefined }
    __limit?: int | number | NumberValueSource<any, any> | IntValueSource<any, any>
    __offset?: int | number | NumberValueSource<any, any> | IntValueSource<any, any>
}

export interface InsertData extends WithQueryData {
    __table: ITable<any>
    __sets: { [property: string]: any }
    __multiple?: { [property: string]: any }[]
    __idColumn?: Column
    __from?: SelectData
}

export interface UpdateData extends WithQueryData {
    __table: ITable<any>
    __sets: { [property: string] : any}
    __where?: BooleanValueSource<any, any> | IfValueSource<any, any>
    __allowNoWhere: boolean
}

export interface DeleteData extends WithQueryData {
    __table: ITable<any>,
    __where?: BooleanValueSource<any, any> | IfValueSource<any, any>
    __allowNoWhere: boolean
}

export interface SqlBuilder extends SqlOperation, __OptionalRule {
    _defaultTypeAdapter: DefaultTypeAdapter
    _queryRunner: QueryRunner
    _connectionConfiguration: ConnectionConfiguration
    _isValue(value: any): boolean
    _isReservedKeyword(word: string): boolean
    _forceAsIdentifier(identifier: string): string
    _appendColumnName(column: Column, params: any[]): string
    _appendColumnNameForCondition(column: Column, params: any[]): string
    _buildSelect(query: SelectData, params: any[]): string
    _buildInsertDefaultValues(query: InsertData, params: any[]): string
    _buildInsert(query: InsertData, params: any[]): string
    _buildInsertFromSelect(query: InsertData, params: any[]): string
    _buildInsertMultiple(query: InsertData, params: any[]): string
    _buildUpdate(query: UpdateData, params: any[]): string
    _buildDelete(query: DeleteData, params: any[]): string
    _buildCallProcedure(params: any[], procedureName: string, procedureParams: ValueSource<any, any>[]): string
    _buildCallFunction(params: any[], functionName: string, functionParams: ValueSource<any, any>[]): string
    _generateUnique(): number
    _resetUnique(): void
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
    _equals(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _notEquals(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _is(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _isNot(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _equalsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _notEqualsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _smaller(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _larger(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _smallAs(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _largeAs(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _in(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _notIn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _like(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _notLike(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _likeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _notLikeInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _startsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _notStartsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _endsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _notEndsWith(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _contains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _notContains(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
}

export interface SqlComparator2 {
    _between(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _notBetween(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
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
    _const(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _constForCondition(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _exists(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _notExists(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _escapeLikeWildcard(params: any[], value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
}

export interface SqlFunction0 {
    // Boolean
    _negate(params: any[], valueSource: ToSql): string
    // String
    _lower(params: any[], valueSource: ToSql): string
    _upper(params: any[], valueSource: ToSql): string
    _length(params: any[], valueSource: ToSql): string
    _trim(params: any[], valueSource: ToSql): string
    _ltrim(params: any[], valueSource: ToSql): string
    _rtrim(params: any[], valueSource: ToSql): string
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
}

export interface SqlFunction1 {
    _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    // Boolean
    _and(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _or(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    // String
    _concat(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _substringToEnd(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    // Number
    _power(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _logn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _roundn(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _minValue(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _maxValue(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    // Number operators
    _add(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _substract(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _multiply(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _divide(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _mod(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string // %
    // Trigonometric Functions
    _atan2(params: any[], valueSource: ToSql, value: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
}
// avg, count, max, median, min,
// greatest, least
// regexp_count, remainder
export interface SqlFunction2 {
    // String
    _substring(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
    _replace(params: any[], valueSource: ToSql, value: any, value2: any, columnType: string, typeAdapter: TypeAdapter | undefined): string
}

export interface SqlSequenceOperation {
    _nextSequenceValue(params: any[], sequenceName: string): string
    _currentSequenceValue(params: any[], sequenceName: string): string
}

export interface SqlFragmentOperation {
    _fragment(params: any[], sql: TemplateStringsArray, sqlParams: ValueSource<any, any>[]): string
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
}
