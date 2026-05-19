import type { ToSql, SelectData, InsertData, UpdateData, DeleteData, FlatQueryColumns, OrderByEntry } from './SqlBuilder.js'
import { getQueryColumn, flattenQueryColumns } from './SqlBuilder.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import type { AnyValueSource, __AggregatedArrayColumns, ValueType } from '../expressions/values.js'
import { isValueSource } from '../expressions/values.js'
import { AbstractSqlBuilder } from './AbstractSqlBuilder.js'
import { __getValueSourcePrivate } from '../expressions/values.js'
import type { DBColumn } from '../utils/Column.js'
import { isColumn, __getColumnOfObject, __getColumnPrivate } from '../utils/Column.js'
import type { AnyTableOrView } from '../utils/ITableOrView.js'
import { SqlOperation1ValueSource, SqlOperation1ValueSourceIfValueOrIgnore } from '../internal/ValueSourceImpl.js'
import { TsSqlProcessingError } from '../TsSqlError.js'

export class AbstractMySqlMariaDBSqlBuilder extends AbstractSqlBuilder {
    constructor() {
        super()
        this._operationsThatNeedParenthesis._concat = false
        this._operationsThatNeedParenthesis._is = true
        this._operationsThatNeedParenthesis._asDouble = true
        this._operationsThatNeedParenthesis._getDate = true
        this._operationsThatNeedParenthesis._getMonth = true
    }
    override _forceAsIdentifier(identifier: string): string {
        return '`' + identifier + '`'
    }
    override _buildSelectOrderBy(query: SelectData, params: any[]): string {
        const orderBy = query.__orderBy
        if (!orderBy) {
            let orderByColumns = ''

            const customization = query.__customization
            if (customization && customization.beforeOrderByItems) {
                orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, params)
            }

            if (customization && customization.afterOrderByItems) {
                if (orderByColumns) {
                    orderByColumns += ', '
                }
                orderByColumns += this._appendRawFragment(customization.afterOrderByItems, params)
            }

            if (!orderByColumns) {
                return ''
            }
            return ' order by ' + orderByColumns
        }

        let orderByColumns = ''

        const customization = query.__customization
        if (customization && customization.beforeOrderByItems) {
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, params)
        }

        for (const entry of orderBy) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const order = entry.order
            if (!order) {
                orderByColumns += this._appendOrderByColumnAlias(entry, query, params)
            } else switch (order) {
                case 'asc':
                case 'asc nulls first':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' asc'
                    break
                case 'desc':
                case 'desc nulls last':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' desc'
                    break
                case 'asc nulls last':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' is null, ' + this._appendOrderByColumnAlias(entry, query, params) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' is not null, ' + this._appendOrderByColumnAlias(entry, query, params) + ' desc'
                    break
                case 'insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, params)
                    break
                case 'asc insensitive':
                case 'asc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, params) + ' asc'
                    break
                case 'desc insensitive':
                case 'desc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, params) + ' desc'
                    break
                case 'asc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' is null, ' + this._appendOrderByColumnAlias(entry, query, params) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, params) + ' is not null, ' + this._appendOrderByColumnAlias(entry, query, params) + ' desc'
                    break
                default:
                    throw new TsSqlProcessingError({ reason: 'INVALID_ORDER_BY_ORDERING', column: this._appendOrderByColumnAlias(entry, query, params), ordering: order }, 'Invalid order by: ' + order)
            }
        }

        if (customization && customization.afterOrderByItems) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            orderByColumns += this._appendRawFragment(customization.afterOrderByItems, params)
        }

        if (!orderByColumns) {
            return ''
        }
        return ' order by ' + orderByColumns
    }
    _buildAggregateArrayOrderBy(query: SelectData, params: any[], addSpace: boolean): string {
        const orderBy = query.__orderBy
        if (!orderBy) {
            let orderByColumns = ''

            const customization = query.__customization
            if (customization && customization.beforeOrderByItems) {
                orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, params)
            }

            if (customization && customization.afterOrderByItems) {
                if (orderByColumns) {
                    orderByColumns += ', '
                }
                orderByColumns += this._appendRawFragment(customization.afterOrderByItems, params)
            }

            if (!orderByColumns) {
                return ''
            }
            return ' order by ' + orderByColumns
        }

        let orderByColumns = ''

        const customization = query.__customization
        if (customization && customization.beforeOrderByItems) {
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, params)
        }

        for (const entry of orderBy) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const order = entry.order
            if (!order) {
                orderByColumns += this._appendOrderByColumnExpression(entry, query, params)
            } else switch (order) {
                case 'asc':
                case 'asc nulls first':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, params) + ' asc'
                    break
                case 'desc':
                case 'desc nulls last':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, params) + ' desc'
                    break
                case 'asc nulls last':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, params) + ' is null, ' + this._appendOrderByColumnExpression(entry, query, params) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, params) + ' is not null, ' + this._appendOrderByColumnExpression(entry, query, params) + ' desc'
                    break
                case 'insensitive':
                    orderByColumns += this._appendOrderByColumnExpressionInsensitive(entry, query, params)
                    break
                case 'asc insensitive':
                case 'asc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnExpressionInsensitive(entry, query, params) + ' asc'
                    break
                case 'desc insensitive':
                case 'desc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnExpressionInsensitive(entry, query, params) + ' desc'
                    break
                case 'asc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, params) + ' is null, ' + this._appendOrderByColumnExpressionInsensitive(entry, query, params) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, params) + ' is not null, ' + this._appendOrderByColumnExpressionInsensitive(entry, query, params) + ' desc'
                    break
                default:
                    throw new TsSqlProcessingError({ reason: 'INVALID_ORDER_BY_ORDERING', column: this._appendOrderByColumnAlias(entry, query, params), ordering: order }, 'Invalid order by: ' + order)
            }
        }

        if (customization && customization.afterOrderByItems) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            orderByColumns += this._appendRawFragment(customization.afterOrderByItems, params)
        }

        if (!orderByColumns) {
            return ''
        }
        if (addSpace) {
            return ' order by ' + orderByColumns
        } else {
            return 'order by ' + orderByColumns
        }
    }
    _appendOrderByColumnExpressionInsensitive(entry: OrderByEntry, query: SelectData, params: any[]): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        const expression = entry.expression
        const stringColumn = this._isStringOrderByColumn(entry, query)
        if (stringColumn && collation) {
            if (typeof expression === 'string') {
                const column = getQueryColumn(query.__columns, expression)
                if (!column) {
                    throw new TsSqlProcessingError({ reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: expression }, 'Column ' + expression + ' included in the order by not found in the select clause')
                }
                return this._appendSqlParenthesis(column, params, false) + ' collate ' + collation
            } else if (isValueSource(expression)) {
                return this._appendSqlParenthesis(expression, params, false) + ' collate ' + collation
            }
        }
        return this._appendOrderByColumnExpression(entry, query, params)
    }
    _appendOrderByColumnExpression(entry: OrderByEntry, query: SelectData, params: any[]): string {
        const expression = entry.expression
        if (typeof expression === 'string') {
            const column = getQueryColumn(query.__columns, expression)
            if (!column) {
                throw new TsSqlProcessingError({ reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: expression }, 'Column ' + expression + ' included in the order by not found in the select clause')
            }
            return this._appendSql(column, params, false)
        } else if (isValueSource(expression)) {
            return this._appendSql(expression, params, false)
        } else {
            return this._appendRawFragment(expression, params)
        }
    }
    override _buildSelectLimitOffset(query: SelectData, params: any[]): string {
        let result = ''

        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' limit ' + this._appendValue(limit, params, 'int', 'int', undefined, false)
        }

        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            if (!result) {
                // MySql/MariaDB doesn't support an offset without a limit, let put the the max value of an int
                result += ' limit 2147483647'
            }
            result += ' offset ' + this._appendValue(offset, params, 'int', 'int', undefined, false)
        }

        if (!result && this._isAggregateArrayWrapped(params) && (query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems)) {
            result += ' limit 2147483647' // Workaround to force mysql/maraiadb to order the result (if not the order by is ignored), the number is the max value of an int
        }
        return result
    }
    override _buildInsertDefaultValues(query: InsertData, params: any[]): string {
        this._ensureRootQuery(query, params)
        const customization = query.__customization
        let insertQuery = ''
        if (customization && customization.beforeQuery) {
            insertQuery += this._appendRawFragment(customization.beforeQuery, params) + ' '
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, params) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, params)
        insertQuery += 'into ' + this._appendTableOrViewName(query.__table, params) + ' () values ()'
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, params)
        insertQuery += this._buildInsertReturning(query, params)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, params)
        }
        this._resetRootQuery(query, params)
        return insertQuery
    }
    override _buildInsertOutput(_query: InsertData, _params: any[]): string {
        return ''
    }
    override _buildInsertOnConflictBeforeInto(query: InsertData, _params: any[]): string {
        if (query.__onConflictDoNothing) {
            return 'ignore '
        }

        return ''
    }
    override _buildInsertOnConflictBeforeReturning(query: InsertData, params: any[]): string {
        let columns = ''
        const table = query.__table
        const sets = query.__onConflictUpdateSets
        if (sets) {
            const properties = Object.getOwnPropertyNames(sets)
            for (let i = 0, length = properties.length; i < length; i++) {
                const property = properties[i]!
                const column = __getColumnOfObject(table, property)
                if (!column) {
                    // Additional property provided in the value object
                    // Skipped because it is not part of the table
                    // This allows to have more complex objects used in the query
                    continue
                }

                if (columns) {
                    columns += ', '
                }
                const value = sets[property]
                columns += this._appendColumnNameForUpdate(column, params)
                columns += ' = '
                columns += this._appendValueForColumn(column, value, params, false)
            }
        }
        if (columns) {
            return ' on duplicate key update ' + columns
        } else {
            return ''
        }
    }
    override _appendRawColumnNameForValuesForInsert(column: DBColumn, _params: any[]): string {
        const columnPrivate = __getColumnPrivate(column)
        return 'values(' + this._escape(columnPrivate.__name, true) + ')'
    }
    override _appendColumnNameForUpdate(column: DBColumn, params: any[]) {
        return this._appendRawColumnName(column, params)
    }
    override _buildAfterUpdateTable(query: UpdateData, params: any[]): string {
        const result = this._buildFromJoins(query.__froms, query.__joins, undefined, params)
        if (!result) {
            return ''
        }
        if (query.__froms && query.__froms.length > 0) {
            return ', ' + result
        }
        return result
    }
    // MySQL/MariaDB use comma-separated joins after the target table (emitted via
    // `_buildAfterUpdateTable`), not the standard `FROM <joins>` clause; neither
    // engine supports the PostgreSQL-style `FROM (subquery)` trick used by the
    // abstract builder to capture old values. Return `false` so the abstract
    // skips the `_new_` aliasing of the target table (which only makes sense when
    // paired with that subquery) and the unused `requiredTables`/`requiredColumns`
    // computation. MariaDB 13.0.1+ uses the native `OLD_VALUE(col)` function for
    // old-value references instead, handled in `MariaDBSqlBuilder`.
    override _useUpdateOldValueInFrom(): boolean {
        return false
    }
    override _buildUpdateFrom(_query: UpdateData, _updatePrimaryKey: boolean, _requiredTables: Set<AnyTableOrView> | undefined, _requiredColumns: Set<DBColumn> | undefined, _params: any[]): string {
        return ''
    }
    override _buidDeleteUsing(query: DeleteData, params: any[]): string {
        const result = this._buildFromJoins(query.__using, query.__joins, undefined, params)
        if (result) {
            if (query.__using && query.__using.length > 0) {
                return ' using ' + this._appendTableOrViewName(query.__table, params) + ', ' + result
            }
            return ' using ' + this._appendTableOrViewName(query.__table, params) + result
        }
        return ''
    }
    override _is(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, params) + ' <=>' + this._appendRawColumnName(value, params)
        }
        return this._appendSqlParenthesis(valueSource, params, false) + ' <=> ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false)
    }
    override _isNot(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (isColumn(valueSource) && isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return 'not (' + this._appendRawColumnName(valueSource, params) + ' <=> ' + this._appendRawColumnName(value, params) + ')'
        }
        return 'not (' + this._appendSqlParenthesis(valueSource, params, false) + ' <=> ' + this._appendValueParenthesis(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    override _divide(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' / ' + this._appendValueParenthesis(value, params, this._getMathArgumentType(columnType, columnTypeName, value), this._getMathArgumentTypeName(columnType, columnTypeName, value), typeAdapter, false)
    }
    override _asDouble(params: any[], valueSource: ToSql): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' * 1.0'
    }
    override _valueWhenNull(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return 'ifnull(' + this._appendSql(valueSource, params, false) + ', ' + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    override _escapeLikeWildcard(params: any[], value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            value = value.replace(/\\/g, '\\\\\\\\')
            value = value.replace(/%/g, '\\%')
            value = value.replace(/_/g, '\\_')
            return this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast)
        } else {
            return "replace(replace(replace(" + this._appendValue(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ", '\\\\', '\\\\\\\\\\\\\\\\'), '%', '\\\\%'), '_', '\\\\_')"
        }
    }
    override _startsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' like concat(' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ", '%')"
    }
    override _notStartsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + ' not like concat(' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ", '%')"
    }
    override _endsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    override _notEndsWith(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " not like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
    }
    override _startsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' like concat(' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' like concat(' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') like concat(lower(' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + "), '%')"
        }
    }
    override _notStartsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not like concat(' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + ' not like concat(' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ') not like concat(lower(' +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + "), '%')"
        }
    }
    override _endsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") like concat('%', lower(" +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + '))'
        }
    }
    override _notEndsWithInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") not like concat('%', lower(" +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + '))'
        }
    }
    override _contains(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ", '%')"
    }
    override _notContains(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        return this._appendSqlParenthesis(valueSource, params, false) + " not like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ", '%')"
    }
    override _containsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") like concat('%', lower(" +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + "), '%')"
        }
    }
    override _notContainsInsensitive(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, params, false) + " not like concat('%', " +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, params, false) + ") not like concat('%', lower(" +  this._escapeLikeWildcard(params, value, columnType, columnTypeName, typeAdapter, false) + "), '%')"
        }
    }
    override _concat(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        let result = 'concat('
        if (isValueSource(valueSource)) {
            result += this._appendMaybeInnerConcat(valueSource, params)
        } else {
            result += this._appendSql(valueSource, params, false)
        }
        result += ', '
        if (isValueSource(value)) {
            result += this._appendMaybeInnerConcat(value, params)
        } else {
            result += this._appendValue(value, params, columnType, columnTypeName, typeAdapter, false)
        }
        result += ')'
        return result
    }
    _appendMaybeInnerConcat(valueSource: AnyValueSource, params: any[]): string {
        if (valueSource instanceof SqlOperation1ValueSource && valueSource.__operation === '_concat') {
            let result = this._appendMaybeInnerConcat(valueSource.__valueSource, params)
            const value = valueSource.__value
            result += ', '
            if (isValueSource(value)) {
                result += this._appendMaybeInnerConcat(value, params)
            } else {
                result += this._appendValue(value, params, valueSource.__valueType, valueSource.__valueTypeName, valueSource.__typeAdapter, false)
            }
            return result
        }
        if (valueSource instanceof SqlOperation1ValueSourceIfValueOrIgnore && valueSource.__operation === '_concat') {
            let result = this._appendMaybeInnerConcat(valueSource.__valueSource, params)
            const value = valueSource.__value
            if (this._isValue(value)) {
                result += ', '
                if (isValueSource(value)) {
                    result += this._appendMaybeInnerConcat(value, params)
                } else {
                    result += this._appendValue(value, params, valueSource.__valueType, valueSource.__valueTypeName, valueSource.__typeAdapter, false)
                }
            }
            return result
        }
        return this._appendSql(valueSource, params, false)
    }
    override _log10(params: any[], valueSource: ToSql): string {
        return 'log10(' +this._appendSql(valueSource, params, false) + ')'
    }
    override _getDate(params: any[], valueSource: ToSql): string {
        return 'dayofmonth(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getTime(params: any[], valueSource: ToSql): string {
        return 'round(unix_timestamp(' + this._appendSql(valueSource, params, false) + ') * 1000)'
    }
    override _getFullYear(params: any[], valueSource: ToSql): string {
        return 'year(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getMonth(params: any[], valueSource: ToSql): string {
        return 'month(' + this._appendSql(valueSource, params, false) + ') - 1'
    }
    override _getDay(params: any[], valueSource: ToSql): string {
        return 'dayofweek(' + this._appendSql(valueSource, params, false) + ') - 1'
    }
    override _getHours(params: any[], valueSource: ToSql): string {
        return 'hour(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getMinutes(params: any[], valueSource: ToSql): string {
        return 'minute(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getSeconds(params: any[], valueSource: ToSql): string {
        return 'second(' + this._appendSql(valueSource, params, false) + ')'
    }
    override _getMilliseconds(params: any[], valueSource: ToSql): string {
        return 'round(microsecond(' + this._appendSql(valueSource, params, false) + ') / 1000)'
    }
    override _stringConcat(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(' + this._appendSql(value, params, false) + ')'
        } else if (separator === '') {
            return 'group_concat(' + this._appendSql(value, params, false) + " separator '')"
        } else {
            return 'group_concat(' + this._appendSql(value, params, false) + ' separator ' + this._appendValue(separator, params, 'string', 'string', undefined, false) + ')'
        }
    }
    override _stringConcatDistinct(params: any[], separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(distinct ' + this._appendSql(value, params, false) + ')'
        } else if (separator === '') {
            return 'group_concat(distinct ' + this._appendSql(value, params, false) + " separator '')"
        } else {
            return 'group_concat(distinct ' + this._appendSql(value, params, false) + ' separator ' + this._appendValue(separator, params, 'string', 'string', undefined, false) + ')'
        }
    }
    override _in(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value) && value.length <= 0) {
            return this._falseValueForCondition
        }
        return super._in(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _notIn(params: any[], valueSource: ToSql, value: any, columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined): string {
        if (Array.isArray(value) && value.length <= 0) {
            return this._trueValueForCondition
        }
        return super._notIn(params, valueSource, value, columnType, columnTypeName, typeAdapter)
    }
    override _random(_params: any): string {
        return 'rand()'
    }
    override _appendAggragateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, params: any[], _query: SelectData | undefined): string {
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_arrayagg(' + distict + this._appendSql(aggregatedArrayColumns, params, false) + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendSql(columns[prop]!, params, false)
            }

            return 'json_arrayagg(' +  distict + 'json_object(' + result + '))'
        }
    }
    override _appendAggragateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, _params: any[], aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_arrayagg(a_' + aggregateId + '_.result)'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', a_" + aggregateId + "_." + this._escape(prop, true)
            }

            return 'json_arrayagg(json_object(' + result + '))'
        }
    }
}
