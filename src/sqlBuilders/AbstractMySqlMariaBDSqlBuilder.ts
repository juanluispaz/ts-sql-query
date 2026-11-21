import type { SqlBuildContext } from '../internal/SqlBuildContext.js'
import { mySqlMariaDBOperationsThatNeedParenthesis } from '../utils/mySqlMariaDB/mySqlMariaDBOperationsThatNeedParenthesis.js'
import type { ToSql, SqlOperation, SelectData, InsertData, UpdateData, DeleteData, FlatQueryColumns, OrderByEntry, PlainSelectData } from './SqlBuilder.js'
import { getQueryColumn, flattenQueryColumns } from './SqlBuilder.js'
import type { DataTypeClass } from '../TypeAdapter.js'
import { AbstractSqlBuilder, ZonedTextInstantOperand, __withChangesOnlyWholeTime, __zonedTextInstantValue, type PlainTemporalDifferenceSql, type SelectColumnSql } from './AbstractSqlBuilder.js'
import type { DBColumn } from '../utils/Column.js'
import { __getColumnOfObject } from '../utils/Column.js'
import { __columnPathsOf } from '../utils/columnPaths.js'
import type { AnyTableOrView } from '../utils/ITableOrView.js'
import { __registerRequiredColumn } from '../utils/ITableOrView.js'
import { __isOperation1, __isOperation1IfValueOrIgnore, __isColumn, __asDBColumnValueSource, isValueSource } from '../typeSystem/valueSourceFactory.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import type { AnyValueSource, __AggregatedArrayColumns } from '../typeSystem/valueSource.js'
import type { ILogicalValueSource } from '../typeSystem/base.js'
import { __classOf } from '../nodes/adaptedTypeClass.js'
import { __registeredDataType } from '../typeSystem/dataTypeRegistry.js'
import { isZeroDuration } from '../utils/durationValues.js'
import { plainTemporalFieldsOf, type PlainTemporalFields } from '../utils/plainTemporalFields.js'
import { __valueOperandClassOf } from '../typeSystem/dataTypeClasses.js'
import { __asTableOrViewRoot } from '../internal/TableOrViewRoot.js'

/** One assignment of the set of an update: the property of the values, the column of the table and its value */
interface UpdateAssignment {
    readonly property: string
    readonly column: DBColumn
    readonly value: any
}

export class AbstractMySqlMariaDBSqlBuilder extends AbstractSqlBuilder {
    override _currentInstant(_context: SqlBuildContext): string {
        // The UTC date and time of now with its microseconds, whatever the zone of the session
        return 'utc_timestamp(6)'
    }
    override _buildSelectWithColumnsInfoForCompound(query: SelectData, context: SqlBuildContext, columnsForInsert: { [name: string]: DBColumn | undefined }, isOutermostQuery: boolean, needsGrouping: boolean): string {
        if (needsGrouping) {
            // MySQL 5.7 and MariaDB 10.3 don't accept a compound in parentheses as an operand of another one
            return 'select * from (' + this._buildSelectWithColumnsInfo(query, context, columnsForInsert, isOutermostQuery) + ') as _t_' + context.generateUnique() + '_'
        }
        return super._buildSelectWithColumnsInfoForCompound(query, context, columnsForInsert, isOutermostQuery, needsGrouping)
    }
    override _operationsThatNeedParenthesis = mySqlMariaDBOperationsThatNeedParenthesis
    /**
     * Compatibility version from which the engine accepts DOUBLE as a cast target
     * (MySQL 8.0.17, MariaDB 10.4.0). Below it, `_appendCastAsDouble` falls back to a
     * multiplication by an approximate literal.
     */
    _castAsDoubleMinCompatibilityVersion: number = Number.POSITIVE_INFINITY
    override _buildSelectGroupBy(query: PlainSelectData, context: SqlBuildContext, isOutermostQuery: boolean, selectColumnsSql?: Map<AnyValueSource, SelectColumnSql> | undefined): string {
        if (selectColumnsSql) {
            // In a having, MySQL and MariaDB resolve a name to a column of the group by written as a bare column
            // before the alias of the select: when they are different values, the alias would silently filter by
            // that column. The column of the select is marked to be written as its expression instead
            const groupBy = query.__groupBy
            for (let i = 0, length = groupBy.length; i < length; i++) {
                const entry = groupBy[i]!
                if (!__isColumn(entry)) {
                    continue
                }
                const nodeEntry = __asDBColumnValueSource(entry)
                const entryName = nodeEntry.__name.toLowerCase()
                selectColumnsSql.forEach((selectColumn, column) => {
                    if (selectColumn.name.toLowerCase() !== entryName) {
                        return
                    }
                    if (__isColumn(column)) {
                        const nodeColumn = __asDBColumnValueSource(column)
                        if (nodeColumn.__name === nodeEntry.__name && nodeColumn.__tableOrView === nodeEntry.__tableOrView) {
                            // The column of the select is that same column
                            return
                        }
                    }
                    selectColumn.shadowedByGroupByColumn = true
                })
            }
        }
        return super._buildSelectGroupBy(query, context, isOutermostQuery, selectColumnsSql)
    }
    override _appendHavingCondition(having: ILogicalValueSource<any, any>, context: SqlBuildContext): string {
        // In a having, MySQL and MariaDB resolve a bare name to an alias of the select before a column of the table
        // that isn't grouped: the columns of the tables are written with the table name, so they never take an alias
        const oldSafeTableOrView = context.safeTableOrView
        this._setSafeTableOrView(context, undefined)
        const result = super._appendHavingCondition(having, context)
        this._setSafeTableOrView(context, oldSafeTableOrView)
        return result
    }
    override _appendSelectColumnReference(column: AnyValueSource, context: SqlBuildContext): string {
        const selectColumn = context.selectColumnsSql?.get(column)
        if (!selectColumn) {
            // Written as the expression: the parenthesis _needParenthesis leaves out for the alias
            return this._appendSqlParenthesis(column, context, false)
        }
        if (selectColumn.shadowedByGroupByColumn) {
            // Its alias names a different column of the group by: written as the expression, which these databases
            // resolve against the columns of the group by
            return this._appendSqlParenthesis(column, context, false)
        }
        return this._appendSelectColumnReferenceSql(selectColumn, context)
    }
    override _needParenthesis(value: any): boolean {
        if (value && value.__selectColumnReference) {
            // A column of the select referred to in a having is written as its alias
            return false
        }
        return super._needParenthesis(value)
    }
    override _needParenthesisExcluding(value: any, excluding: keyof SqlOperation): boolean {
        if (value && value.__selectColumnReference) {
            // A column of the select referred to in a having is written as its alias
            return false
        }
        return super._needParenthesisExcluding(value, excluding)
    }
    override _appendSelectColumnReferenceSql(selectColumn: SelectColumnSql, context: SqlBuildContext): string {
        // In a having, a column outside an aggregate can only be referred to by its alias (written again, the
        // expression refers to columns that aren't grouped as they are: unknown column)
        return this._appendColumnAlias(selectColumn.name, context)
    }
    override _forceAsIdentifier(identifier: string): string {
        return '`' + identifier + '`'
    }
    // MySQL / MariaDB accept both `lower(col)` and `col collate <name>` as
    // ORDER BY terms of a compound query, so the insensitive ordering is
    // emitted inline and never needs the `select * from (...)` wrapper.
    override _supportFunctionInCompoundOrderBy(): boolean {
        return true
    }
    override _supportCollateInCompoundOrderBy(): boolean {
        return true
    }
    override _supportOrderByColumnAliasInExpression(): boolean {
        // Inside an expression of the order by, MySQL and MariaDB take a column of the from with the same name before
        // the alias
        return false
    }
    override _appendOrderBySelectColumnWithParams(_selectColumn: SelectColumnSql, entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string {
        // A parameter can't be repeated (each `?` is a new one): the expression is written again, with new parameters
        return this._appendOrderByColumnSourceAsInSelect(entry, query, context)
    }
    /**
     * Whether the ordering of the entry wraps the column in an expression: the null check that emulates `nulls first`
     * / `nulls last`, or the insensitive `lower(...)` / `collate`
     */
    _isOrderByColumnInExpression(entry: OrderByEntry, query: SelectData): boolean {
        switch (entry.order) {
            case 'asc nulls last':
            case 'desc nulls first':
            case 'asc nulls last insensitive':
            case 'desc nulls first insensitive':
                return true
            case 'insensitive':
            case 'asc insensitive':
            case 'desc insensitive':
            case 'asc nulls first insensitive':
            case 'desc nulls last insensitive':
                return this._connectionConfiguration.insensitiveCollation !== '' && this._isStringOrderByColumn(entry, query)
            default:
                return false
        }
    }
    override _buildSelectOrderBy(query: SelectData, context: SqlBuildContext): string {
        const orderBy = query.__orderBy
        if (!orderBy) {
            let orderByColumns = ''

            const customization = query.__customization
            if (customization && customization.beforeOrderByItems) {
                orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, context)
            }

            if (customization && customization.afterOrderByItems) {
                if (orderByColumns) {
                    orderByColumns += ', '
                }
                orderByColumns += this._appendRawFragment(customization.afterOrderByItems, context)
            }

            if (!orderByColumns) {
                return ''
            }
            return ' order by ' + orderByColumns
        }

        let orderByColumns = ''

        const customization = query.__customization
        if (customization && customization.beforeOrderByItems) {
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, context)
        }

        for (let i = 0, length = orderBy.length; i < length; i++) {
            const entry = orderBy[i]!
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const order = entry.order
            if (!order) {
                orderByColumns += this._appendOrderByColumnAlias(entry, query, context)
            } else switch (order) {
                case 'asc':
                case 'asc nulls first':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, context) + ' asc'
                    break
                case 'desc':
                case 'desc nulls last':
                    orderByColumns += this._appendOrderByColumnAlias(entry, query, context) + ' desc'
                    break
                case 'asc nulls last':
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, context) + ' is null, ' + this._appendOrderByColumnAlias(entry, query, context) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, context) + ' is not null, ' + this._appendOrderByColumnAlias(entry, query, context) + ' desc'
                    break
                case 'insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, context)
                    break
                case 'asc insensitive':
                case 'asc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' asc'
                    break
                case 'desc insensitive':
                case 'desc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' desc'
                    break
                case 'asc nulls last insensitive':
                    // Only the sort term is folded: the `is null` operand is a boolean
                    // nulls-ordering emulation, so lowercasing it would be pointless work.
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, context) + ' is null, ' + this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnForExpression(entry, query, context) + ' is not null, ' + this._appendOrderByColumnAliasInsensitive(entry, query, context) + ' desc'
                    break
                default:
                    throw new TsSqlProcessingError({ reason: 'INVALID_ORDER_BY_ORDERING', column: this._appendOrderByColumnAlias(entry, query, context), ordering: order }, 'Invalid order by: ' + order)
            }
        }

        if (customization && customization.afterOrderByItems) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            orderByColumns += this._appendRawFragment(customization.afterOrderByItems, context)
        }

        if (!orderByColumns) {
            return ''
        }
        return ' order by ' + orderByColumns
    }
    _buildAggregateArrayOrderBy(query: SelectData, context: SqlBuildContext, addSpace: boolean): string {
        const orderBy = query.__orderBy
        if (!orderBy) {
            let orderByColumns = ''

            const customization = query.__customization
            if (customization && customization.beforeOrderByItems) {
                orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, context)
            }

            if (customization && customization.afterOrderByItems) {
                if (orderByColumns) {
                    orderByColumns += ', '
                }
                orderByColumns += this._appendRawFragment(customization.afterOrderByItems, context)
            }

            if (!orderByColumns) {
                return ''
            }
            return ' order by ' + orderByColumns
        }

        let orderByColumns = ''

        const customization = query.__customization
        if (customization && customization.beforeOrderByItems) {
            orderByColumns += this._appendRawFragment(customization.beforeOrderByItems, context)
        }

        for (let i = 0, length = orderBy.length; i < length; i++) {
            const entry = orderBy[i]!
            if (orderByColumns) {
                orderByColumns += ', '
            }
            const order = entry.order
            if (!order) {
                orderByColumns += this._appendOrderByColumnExpression(entry, query, context)
            } else switch (order) {
                case 'asc':
                case 'asc nulls first':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, context) + ' asc'
                    break
                case 'desc':
                case 'desc nulls last':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, context) + ' desc'
                    break
                case 'asc nulls last':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, context) + ' is null, ' + this._appendOrderByColumnExpression(entry, query, context) + ' asc'
                    break
                case 'desc nulls first':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, context) + ' is not null, ' + this._appendOrderByColumnExpression(entry, query, context) + ' desc'
                    break
                case 'insensitive':
                    orderByColumns += this._appendOrderByColumnExpressionInsensitive(entry, query, context)
                    break
                case 'asc insensitive':
                case 'asc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnExpressionInsensitive(entry, query, context) + ' asc'
                    break
                case 'desc insensitive':
                case 'desc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnExpressionInsensitive(entry, query, context) + ' desc'
                    break
                case 'asc nulls last insensitive':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, context) + ' is null, ' + this._appendOrderByColumnExpressionInsensitive(entry, query, context) + ' asc'
                    break
                case 'desc nulls first insensitive':
                    orderByColumns += this._appendOrderByColumnExpression(entry, query, context) + ' is not null, ' + this._appendOrderByColumnExpressionInsensitive(entry, query, context) + ' desc'
                    break
                default:
                    throw new TsSqlProcessingError({ reason: 'INVALID_ORDER_BY_ORDERING', column: this._appendOrderByColumnAlias(entry, query, context), ordering: order }, 'Invalid order by: ' + order)
            }
        }

        if (customization && customization.afterOrderByItems) {
            if (orderByColumns) {
                orderByColumns += ', '
            }
            orderByColumns += this._appendRawFragment(customization.afterOrderByItems, context)
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
    _appendOrderByColumnExpressionInsensitive(entry: OrderByEntry, query: SelectData, context: SqlBuildContext): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        const expression = entry.expression
        const stringColumn = this._isStringOrderByColumn(entry, query)
        if (stringColumn && collation) {
            if (typeof expression === 'string') {
                const column = getQueryColumn(query.__columns, expression)
                if (!column) {
                    throw new TsSqlProcessingError({ reason: 'ORDER_BY_COLUMN_NOT_IN_SELECT', column: expression }, 'Column ' + expression + ' included in the order by not found in the select clause')
                }
                return this._appendSqlParenthesis(column, context, false) + ' collate ' + collation
            } else if (isValueSource(expression)) {
                return this._appendSqlParenthesis(expression, context, false) + ' collate ' + collation
            }
        }
        return this._appendOrderByColumnExpression(entry, query, context)
    }
    override _buildSelectLimitOffset(query: SelectData, context: SqlBuildContext): string {
        let result = ''

        const limit = query.__limit
        if (limit !== null && limit !== undefined) {
            result += ' limit ' + this._appendValue(limit, context, __registeredDataType('int'), false)
        }

        const offset = query.__offset
        if (offset !== null && offset !== undefined) {
            if (!result) {
                // MySQL/MariaDB don't accept an offset without a limit, so put the max value of an int
                result += ' limit 2147483647'
            }
            result += ' offset ' + this._appendValue(offset, context, __registeredDataType('int'), false)
        }

        if (!result && context.aggregateArrayWrapped && (query.__orderBy || query.__customization?.beforeOrderByItems || query.__customization?.afterOrderByItems)) {
            // Without a limit MySQL/MariaDB ignore the order by of a derived table, so the aggregated
            // array comes out unordered (still the case on MySQL 26.10 and MariaDB 13.0); the number is
            // the max value of an int.
            result += ' limit 2147483647'
        }
        return result
    }
    override _buildInsertDefaultValues(query: InsertData, context: SqlBuildContext): string {
        this._ensureRootQuery(query, context)
        const customization = query.__customization
        let insertQuery = ''
        if (customization && customization.beforeQuery) {
            insertQuery += this._appendRawFragment(customization.beforeQuery, context) + ' '
        }
        insertQuery += 'insert '
        if (customization && customization.afterInsertKeyword) {
            insertQuery += this._appendRawFragment(customization.afterInsertKeyword, context) + ' '
        }
        insertQuery += this._buildInsertOnConflictBeforeInto(query, context)
        insertQuery += 'into ' + this._appendTableOrViewName(query.__table, context) + ' () values ()'
        insertQuery += this._buildInsertOnConflictBeforeReturning(query, context)
        insertQuery += this._buildInsertReturning(query, context)
        if (customization && customization.afterQuery) {
            insertQuery += ' ' + this._appendRawFragment(customization.afterQuery, context)
        }
        this._resetRootQuery(query, context)
        return insertQuery
    }
    override _buildInsertOutput(_query: InsertData, _context: SqlBuildContext): string {
        return ''
    }
    override _buildInsertOnConflictBeforeInto(query: InsertData, _context: SqlBuildContext): string {
        // `insert ignore` covers both an explicit `onConflictDoNothing()` and an
        // on-conflict `do update` whose assignment list resolved to no columns:
        // MariaDB/MySQL have no empty `on duplicate key update`, and `insert
        // ignore` is the same conflict-skipping no-op. The matching
        // `on duplicate key update` clause is then omitted (see
        // `_buildInsertOnConflictBeforeReturning` below, which returns '' when
        // the assignment list is empty).
        if (query.__onConflictDoNothing || this._isInsertOnConflictUpdateSetEmpty(query)) {
            return 'ignore '
        }

        return ''
    }
    override _buildInsertOnConflictBeforeReturning(query: InsertData, context: SqlBuildContext): string {
        // MariaDB/MySQL emit the same shape-aware assignment list as the base
        // `do update set`, just under a different keyword and with no conflict
        // target or `where` clause.
        const columns = this._buildInsertOnConflictUpdateSetColumns(query, context)
        if (columns) {
            return ' on duplicate key update ' + columns
        } else {
            return ''
        }
    }
    override _appendRawColumnNameForValuesForInsert(column: DBColumn, _context: SqlBuildContext): string {
        const nodeColumn = __asDBColumnValueSource(column)
        return 'values(' + this._escape(nodeColumn.__name, true) + ')'
    }
    override _buildAfterUpdateTable(query: UpdateData, context: SqlBuildContext): string {
        const result = this._buildFromJoins(query.__froms, query.__joins, undefined, context)
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
    /**
     * MySQL and MariaDB compute the assignments of the set of an update from left to right, and each one reads the value
     * an earlier assignment already wrote (with several tables, in no order MySQL promises); every other database reads
     * the row as it was before the update. So that the same update gives the same rows everywhere, when a value of the
     * set reads a column of the table that another assignment writes before it:
     * - with one table and no cycle, the assignments are reordered: one that reads a column goes before the one that
     *   writes it, and the SQL is otherwise the same;
     * - with a cycle (set a = b, b = a), or with several tables, those columns are read with their value before the
     *   update (_appendUpdateOldRowColumn), which needs the primary key of the table.
     * Nothing changes when the session already computes them with the row before the update
     * (useSimultaneousAssignment, MariaDB's SIMULTANEOUS_ASSIGNMENT).
     */
    override _updateSetPropertiesInOrder(query: UpdateData, context: SqlBuildContext): string[] | undefined {
        if (this._connectionConfiguration.useSimultaneousAssignment) {
            return undefined
        }
        const multipleTables = (!!query.__froms && query.__froms.length > 0) || (!!query.__joins && query.__joins.length > 0)
        const analysis = this._analyzeAssignments(query.__table, this._updateAssignmentsOf(query), multipleTables)
        if (!analysis) {
            return undefined
        }
        if (analysis.ordered) {
            return analysis.ordered.map((assignment) => assignment.property)
        }
        if (query.__columns) {
            // MariaDB answers an update with returning whose set reads the table through a derived table without the
            // rows of the returning (measured on 13.0.2)
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'MariaDB gives to a value of the set of an update the value an earlier assignment wrote, and the value before the update can only be read without returning: set useSimultaneousAssignment on the connection when the sql_mode of the session has SIMULTANEOUS_ASSIGNMENT')
        }
        context.updateOldRowColumns = analysis.oldRowColumns
        return undefined
    }
    /**
     * The on duplicate key update has the same order of the assignments as an update (see _analyzeAssignments): they
     * are reordered, or the columns involved are read with their value before the insert where the database can do it
     * (_supportOldRowReadInOnDuplicateKeyUpdate)
     */
    override _buildInsertOnConflictUpdateSetColumns(query: InsertData, context: SqlBuildContext): string {
        if (this._connectionConfiguration.useSimultaneousAssignment) {
            return super._buildInsertOnConflictUpdateSetColumns(query, context)
        }
        let assignments = this._resolveInsertOnConflictUpdateSetColumns(query)
        const analysis = this._analyzeAssignments(query.__table, assignments, false)
        const oldRowColumns = context.updateOldRowColumns
        if (analysis && analysis.ordered) {
            assignments = analysis.ordered
        } else if (analysis) {
            if (!this._supportOldRowReadInOnDuplicateKeyUpdate()) {
                throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'MySQL and MariaDB before 10.5 give to a value of the on duplicate key update the value an earlier assignment wrote, and they can\'t read there the value the row had: assignments that read each other can\'t be written so that they give the rows of the other databases')
            }
            context.updateOldRowColumns = analysis.oldRowColumns
        }
        let columns = ''
        for (let i = 0, length = assignments.length; i < length; i++) {
            const { property, column, value } = assignments[i]!
            if (columns) {
                columns += ', '
            }
            columns += this._appendColumnNameForUpdate(column, context)
            columns += ' = '
            columns += this._appendSetValue(property, undefined, column, value, context)
        }
        context.updateOldRowColumns = oldRowColumns
        return columns
    }
    /** The on duplicate key update can read a column of the row with a subquery over a derived table of its table */
    _supportOldRowReadInOnDuplicateKeyUpdate(): boolean {
        return false
    }
    /**
     * What the order of the assignments of a set needs on MySQL and MariaDB, where each one reads the value an earlier
     * one already wrote: undefined when no value reads a column that another assignment writes before it; the
     * assignments reordered when that is enough (one table, no cycle); otherwise the columns to read with the value
     * they had before (it needs the primary key of the table)
     */
    _analyzeAssignments(table: AnyTableOrView, assignments: UpdateAssignment[], multipleTables: boolean): { ordered?: UpdateAssignment[], oldRowColumns: Set<DBColumn> } | undefined {
        if (assignments.length < 2) {
            return undefined
        }
        const onlyTable = new Set<AnyTableOrView>([table])
        const reads = assignments.map((assignment) => {
            const result = new Set<DBColumn>()
            __registerRequiredColumn(assignment.value, this, result, onlyTable)
            return result
        })
        // The columns read by another assignment than the one that writes them
        const oldRowColumns = new Set<DBColumn>()
        let conflict = false
        for (let writer = 0; writer < assignments.length; writer++) {
            const column = assignments[writer]!.column
            for (let reader = 0; reader < assignments.length; reader++) {
                if (reader !== writer && reads[reader]!.has(column)) {
                    oldRowColumns.add(column)
                    if (reader > writer) {
                        conflict = true
                    }
                }
            }
        }
        if (!conflict) {
            return undefined
        }
        if (!multipleTables) {
            const ordered = this._orderUpdateAssignmentsReadingFirst(assignments, reads)
            if (ordered) {
                return { ordered, oldRowColumns }
            }
        }
        if (!this._hasPrimaryKey(table)) {
            throw new TsSqlProcessingError({ reason: 'UNSUPPORTED_QUERY' }, 'MySQL and MariaDB give to a value of the set the value an earlier assignment wrote: reading the value before the change needs the primary key of the table, and this table has none')
        }
        return { oldRowColumns }
    }
    /**
     * The assignments of the set of an update that are columns of the table, in the order given: the properties of
     * the shape that the set has, or the properties of the set
     */
    _updateAssignmentsOf(query: UpdateData): UpdateAssignment[] {
        const table = query.__table
        const sets = query.__sets
        const shape = query.__shape
        const result: UpdateAssignment[] = []
        for (const property of Object.getOwnPropertyNames(shape || sets)) {
            if (shape && !(property in sets)) {
                continue
            }
            const target = shape ? shape[property] : property
            const column = typeof target === 'string' ? __getColumnOfObject(table, target) : target
            if (!__isColumn(column)) {
                continue
            }
            result.push({ property, column, value: sets[property] })
        }
        return result
    }
    /**
     * The assignments in an order where each one that reads a column goes before the one that writes it, keeping the
     * given order where it can; undefined when there is no such order (a cycle)
     */
    _orderUpdateAssignmentsReadingFirst(assignments: UpdateAssignment[], reads: Set<DBColumn>[]): UpdateAssignment[] | undefined {
        const count = assignments.length
        // before[i]: the assignments that must be written before assignment i (they read the column i writes)
        const before: number[][] = assignments.map((assignment, writer) => {
            const result: number[] = []
            for (let reader = 0; reader < count; reader++) {
                if (reader !== writer && reads[reader]!.has(assignment.column)) {
                    result.push(reader)
                }
            }
            return result
        })
        const written = new Array<boolean>(count).fill(false)
        const result: UpdateAssignment[] = []
        while (result.length < count) {
            let next = -1
            for (let i = 0; i < count; i++) {
                if (!written[i] && before[i]!.every((reader) => written[reader])) {
                    next = i
                    break
                }
            }
            if (next < 0) {
                return undefined
            }
            written[next] = true
            result.push(assignments[next]!)
        }
        return result
    }
    /**
     * A column of the table being updated read with the value it had before the update, in the set
     * (context.updateOldRowColumns, _updateSetPropertiesInOrder): a subquery over a derived table of that table, which the database fills before it
     * changes any row, correlated with the row by its primary key
     */
    _appendUpdateOldRowColumn(column: DBColumn, context: SqlBuildContext): string {
        const nodeColumn = __asDBColumnValueSource(column)
        const tableOrView = nodeColumn.__tableOrView
        const tableRoot = __asTableOrViewRoot(tableOrView)
        const tableName = this._escape(this._tableOrViewName(tableRoot, context), false)
        const outer = tableRoot.__as ? this._escape(tableRoot.__as, true) : tableName
        const oldAlias = this._escape('_old_', true)
        const name = this._escape(nodeColumn.__name, true)
        let keys = ''
        let where = ''
        for (const property of __columnPathsOf(tableOrView)) {
            const key = __getColumnOfObject(tableOrView, property)
            if (!key || !__asDBColumnValueSource(key).__isPrimaryKey) {
                continue
            }
            const keyName = this._escape(__asDBColumnValueSource(key).__name, true)
            if (keyName === name) {
                continue
            }
            keys += keyName + ', '
            where += (where ? ' and ' : '') + oldAlias + '.' + keyName + ' = ' + outer + '.' + keyName
        }
        if (__asDBColumnValueSource(column).__isPrimaryKey) {
            where += (where ? ' and ' : '') + oldAlias + '.' + name + ' = ' + outer + '.' + name
        }
        return '(select ' + oldAlias + '.' + name + ' from (select ' + keys + name + ' from ' + tableName + ') ' + (this._supportTableAliasWithAs ? 'as ' : '') + oldAlias + ' where ' + where + ')'
    }
    override _appendColumnNameForUpdate(column: DBColumn, context: SqlBuildContext): string {
        // The column assigned is the one of the table, not its value before the update
        const oldRowColumns = context.updateOldRowColumns
        if (!oldRowColumns) {
            return this._appendRawColumnName(column, context)
        }
        context.updateOldRowColumns = undefined
        const result = this._appendRawColumnName(column, context)
        context.updateOldRowColumns = oldRowColumns
        return result
    }
    override _appendRawColumnName(column: DBColumn, context: SqlBuildContext): string {
        if (context.updateOldRowColumns && context.updateOldRowColumns.has(column)) {
            return this._appendUpdateOldRowColumn(column, context)
        }
        return super._appendRawColumnName(column, context)
    }
    _hasPrimaryKey(table: AnyTableOrView): boolean {
        for (const property of __columnPathsOf(table)) {
            const column = __getColumnOfObject(table, property)
            if (column && __asDBColumnValueSource(column).__isPrimaryKey) {
                return true
            }
        }
        return false
    }
    override _useUpdateOldValueInFrom(): boolean {
        return false
    }
    override _buildUpdateFrom(_query: UpdateData, _updatePrimaryKey: boolean, _requiredTables: Set<AnyTableOrView> | undefined, _requiredColumns: Set<DBColumn> | undefined, _context: SqlBuildContext): string {
        return ''
    }
    override _buidDeleteUsing(query: DeleteData, context: SqlBuildContext): string {
        const result = this._buildFromJoins(query.__using, query.__joins, undefined, context)
        if (result) {
            if (query.__using && query.__using.length > 0) {
                return ' using ' + this._appendTableOrViewName(query.__table, context) + ', ' + result
            }
            return ' using ' + this._appendTableOrViewName(query.__table, context) + result
        }
        return ''
    }
    override _is(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._is(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        if (__isColumn(valueSource) && __isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return this._appendRawColumnName(valueSource, context) + ' <=>' + this._appendRawColumnName(value, context)
        }
        return this._appendSqlParenthesis(valueSource, context, false) + ' <=> ' + this._appendValueParenthesis(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value))
    }
    override _isNot(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (this._isZonedTextComparison(typeClass)) {
            return this._isNot(context, new ZonedTextInstantOperand(valueSource), __zonedTextInstantValue(value), __registeredDataType('instant'))
        }
        if (__isColumn(valueSource) && __isColumn(value) && this._hasSameBooleanTypeAdapter(valueSource, value)) {
            return 'not (' + this._appendRawColumnName(valueSource, context) + ' <=> ' + this._appendRawColumnName(value, context) + ')'
        }
        return 'not (' + this._appendSqlParenthesis(valueSource, context, false) + ' <=> ' + this._appendValueParenthesis(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ')'
    }
    override _appendCastAsDouble(sql: string): string {
        if (this._connectionConfiguration.compatibilityVersion >= this._castAsDoubleMinCompatibilityVersion) {
            return 'cast(' + sql + ' as double)'
        }
        // Older engines have no DOUBLE cast target. Multiplying by an approximate literal
        // promotes the value to DOUBLE: the exponent marker is what makes the literal
        // approximate — written `* 1.0` it is an exact literal (DECIMAL) and the value
        // stays DECIMAL, truncated to div_precision_increment decimals on any later division.
        return '(' + sql + ' * 1.0e0)'
    }
    override _appendCastAsInteger(sql: string): string {
        // MySQL / MariaDB reject `cast(x as bigint)`; SIGNED is how they spell a
        // 64 bits signed integer in a cast.
        return 'cast(' + sql + ' as signed)'
    }
    /**
     * MySQL / MariaDB round exact-value numbers (DECIMAL) breaking ties away from zero —
     * the rule every dialect the library supports follows — but round approximate-value
     * numbers (DOUBLE) by deferring to the C library, which rounds half to even on the
     * usual platforms: `round(0.5e0)` is `0` and `round(2.5e0)` is `2`. Any operand
     * reaching here through `_divide` or `_asDouble` is a DOUBLE, so the operand is cast
     * back to an exact type to keep the tie-breaking rule portable and independent of what
     * came before it in the chain.
     */
    _appendRoundOperandAsExact(context: SqlBuildContext, valueSource: ToSql): string {
        const sql = this._appendSql(valueSource, context, false)
        if (this._connectionConfiguration.usePlatformDependentRound) {
            return sql
        }
        if (this._numericKindOf(valueSource) === 'exact') {
            // An exact operand already rounds away from zero, and an integer one has no tie
            // to break at all: casting it would only add noise to the query.
            return sql
        }
        return 'cast(' + sql + ' as decimal(65, 30))'
    }
    override _round(context: SqlBuildContext, valueSource: ToSql): string {
        return 'round(' + this._appendRoundOperandAsExact(context, valueSource) + ')'
    }
    override _roundn(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return 'round(' + this._appendRoundOperandAsExact(context, valueSource) + ', ' + this._appendRoundnScale(value, context, typeClass) + ')'
    }
    override _valueWhenNull(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return 'ifnull(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(value, context, __valueOperandClassOf(typeClass, value), this._operandNeedsTypeCast(typeClass, value)) + ')'
    }
    override _escapeLikeWildcard(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            value = value.replace(/\\/g, '\\\\')
            value = value.replace(/%/g, '\\%')
            value = value.replace(/_/g, '\\_')
            return this._appendValue(value, context, typeClass, forceTypeCast)
        } else {
            return "replace(replace(replace(" + this._appendValue(value, context, typeClass, forceTypeCast) + ", '\\\\', '\\\\\\\\'), '%', '\\\\%'), '_', '\\\\_')"
        }
    }
    override _escapeRegexpForReplace(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        if (typeof value === 'string') {
            return this._appendValue(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), context, typeClass, forceTypeCast)
        }
        // MySQL/MariaDB treat backslash as an escape inside string literals, so a single
        // backslash is written `'\\'` (two in the SQL text) — the same doubling
        // `_escapeLikeWildcard` does above. Escape the term's backslashes first, then prefix
        // every other regex metacharacter with one.
        let sql = this._appendValue(value, context, typeClass, forceTypeCast)
        sql = "replace(" + sql + ", '\\\\', '\\\\\\\\')"
        const metachars = '.*+?^${}()|[]'
        for (let i = 0, length = metachars.length; i < length; i++) {
            const ch = metachars[i]!
            sql = "replace(" + sql + ", '" + ch + "', '\\\\" + ch + "')"
        }
        return sql
    }
    override _escapeRegexpReplacement(value: any, context: SqlBuildContext, typeClass: DataTypeClass, forceTypeCast: boolean): string {
        // MariaDB (like PostgreSQL) treats only the backslash as a replacement metacharacter.
        // The JS-literal escape matches the base (the escaped term is bound as a param, so it
        // has no string-literal quirk); only the value-source path needs MySQL/MariaDB's
        // backslash doubling inside a string literal (see `_escapeRegexpForReplace`).
        if (typeof value === 'string') {
            return this._appendValue(value.replace(/\\/g, '\\\\'), context, typeClass, forceTypeCast)
        }
        return "replace(" + this._appendValue(value, context, typeClass, forceTypeCast) + ", '\\\\', '\\\\\\\\')"
    }
    override _replaceAllInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, typeClass: DataTypeClass): string {
        // MySQL/MariaDB `REPLACE` ignores collation, so fold case with `REGEXP_REPLACE`, whose
        // operands' collation governs the match (case + accent). The default collation is already
        // case-insensitive; when `insensitiveCollation` names one, force it on the source and the
        // (regex-escaped) search term. `REGEXP_REPLACE` needs MySQL 8.0+ / MariaDB 10.0.5+.
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return 'regexp_replace(' + this._appendSqlParenthesis(valueSource, context, false) + ' collate ' + collation + ', ' + this._escapeRegexpForReplace(value, context, typeClass, false) + ' collate ' + collation + ', ' + this._escapeRegexpReplacement(value2, context, typeClass, false) + ')'
        }
        return 'regexp_replace(' + this._appendSql(valueSource, context, false) + ', ' + this._escapeRegexpForReplace(value, context, typeClass, false) + ', ' + this._escapeRegexpReplacement(value2, context, typeClass, false) + ')'
    }
    // This dialect family has no `||` operator by default (`PIPES_AS_CONCAT` is not
    // assumed): concatenation is the n-ary `concat(...)` function. It stands alone, so the
    // pattern needs no wrapping parenthesis, and the insensitive arm folds the term inside
    // the call rather than folding the whole pattern.
    override _likePatternStartingWith(context: SqlBuildContext, value: any, typeClass: DataTypeClass, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, typeClass, false)
        return fold ? 'concat(lower(' + term + "), '%')" : 'concat(' + term + ", '%')"
    }
    override _likePatternEndingWith(context: SqlBuildContext, value: any, typeClass: DataTypeClass, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, typeClass, false)
        return fold ? "concat('%', lower(" + term + '))' : "concat('%', " + term + ')'
    }
    override _likePatternContaining(context: SqlBuildContext, value: any, typeClass: DataTypeClass, fold: boolean): string {
        const term = this._escapeLikeWildcard(value, context, typeClass, false)
        return fold ? "concat('%', lower(" + term + "), '%')" : "concat('%', " + term + ", '%')"
    }
    override _startsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like concat(' +  this._escapeLikeWildcard(value, context, typeClass, false) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' like concat(' +  this._escapeLikeWildcard(value, context, typeClass, false) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') like concat(lower(' +  this._escapeLikeWildcard(value, context, typeClass, false) + "), '%')"
        }
    }
    override _notStartsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like concat(' +  this._escapeLikeWildcard(value, context, typeClass, false) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + ' not like concat(' +  this._escapeLikeWildcard(value, context, typeClass, false) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ') not like concat(lower(' +  this._escapeLikeWildcard(value, context, typeClass, false) + "), '%')"
        }
    }
    override _endsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " like concat('%', " +  this._escapeLikeWildcard(value, context, typeClass, false) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + " like concat('%', " +  this._escapeLikeWildcard(value, context, typeClass, false) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ") like concat('%', lower(" +  this._escapeLikeWildcard(value, context, typeClass, false) + '))'
        }
    }
    override _notEndsWithInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " not like concat('%', " +  this._escapeLikeWildcard(value, context, typeClass, false) + ') collate ' + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + " not like concat('%', " +  this._escapeLikeWildcard(value, context, typeClass, false) + ')'
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ") not like concat('%', lower(" +  this._escapeLikeWildcard(value, context, typeClass, false) + '))'
        }
    }
    override _containsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " like concat('%', " +  this._escapeLikeWildcard(value, context, typeClass, false) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + " like concat('%', " +  this._escapeLikeWildcard(value, context, typeClass, false) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ") like concat('%', lower(" +  this._escapeLikeWildcard(value, context, typeClass, false) + "), '%')"
        }
    }
    override _notContainsInsensitive(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        const collation = this._connectionConfiguration.insensitiveCollation
        if (collation) {
            return this._appendSqlParenthesis(valueSource, context, false) + " not like concat('%', " +  this._escapeLikeWildcard(value, context, typeClass, false) + ", '%') collate " + collation
        } else if (collation === '') {
            return this._appendSqlParenthesis(valueSource, context, false) + " not like concat('%', " +  this._escapeLikeWildcard(value, context, typeClass, false) + ", '%')"
        } else {
            return 'lower(' + this._appendSql(valueSource, context, false) + ") not like concat('%', lower(" +  this._escapeLikeWildcard(value, context, typeClass, false) + "), '%')"
        }
    }
    // `substr()` with a negative start does not count from the end on this dialect, and where
    // it does the out-of-range case still diverges from JS. `right()` / `left()` are exactly
    // `String.prototype.substr`'s negative-start semantics, clamp included. Only the negative
    // arms are overridden; the rest of the family is the base's.
    override _substrToEnd(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        if (typeof value === 'number' && value < 0) {
            return 'right(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(-value, context, __registeredDataType('int'), false) + ')'
        }
        return super._substrToEnd(context, valueSource, value, typeClass)
    }
    override _substr(context: SqlBuildContext, valueSource: ToSql, value: any, value2: any, typeClass: DataTypeClass): string {
        value2 = this._clampSubstrCount(value2)
        if (typeof value === 'number' && value < 0) {
            return 'left(right(' + this._appendSql(valueSource, context, false) + ', ' + this._appendValue(-value, context, __registeredDataType('int'), false) + '), ' + this._appendValue(value2, context, __registeredDataType('int'), false) + ')'
        }
        return super._substr(context, valueSource, value, value2, typeClass)
    }
    override _length(context: SqlBuildContext, valueSource: ToSql): string {
        // On this dialect family `length()` counts BYTES, not characters: it answers 5 for
        // 'café' and 6 for '日本' under utf8mb4. `char_length()` is the character-counting
        // one, and `.length()` mirrors JS's `String.length`, so characters is the contract.
        // Do not "simplify" this override away — the base's `length()` is the byte one here.
        return 'char_length(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _concat(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        let result = 'concat('
        if (isValueSource(valueSource)) {
            result += this._appendMaybeInnerConcat(valueSource, context)
        } else {
            result += this._appendSql(valueSource, context, false)
        }
        result += ', '
        if (isValueSource(value)) {
            result += this._appendMaybeInnerConcat(value, context)
        } else {
            result += this._appendValue(value, context, typeClass, false)
        }
        result += ')'
        return result
    }
    _appendMaybeInnerConcat(valueSource: AnyValueSource, context: SqlBuildContext): string {
        if (__isOperation1(valueSource) && valueSource.__operation === '_concat') {
            let result = this._appendMaybeInnerConcat(valueSource.__valueSource, context)
            const value = valueSource.__value
            result += ', '
            if (isValueSource(value)) {
                result += this._appendMaybeInnerConcat(value, context)
            } else {
                result += this._appendValue(value, context, __classOf(valueSource), false)
            }
            return result
        }
        if (__isOperation1IfValueOrIgnore(valueSource) && valueSource.__operation === '_concat') {
            let result = this._appendMaybeInnerConcat(valueSource.__valueSource, context)
            const value = valueSource.__value
            if (this._isValue(value)) {
                result += ', '
                if (isValueSource(value)) {
                    result += this._appendMaybeInnerConcat(value, context)
                } else {
                    result += this._appendValue(value, context, __classOf(valueSource), false)
                }
            }
            return result
        }
        return this._appendSql(valueSource, context, false)
    }
    /**
     * `concat(...)` PROPAGATES NULL on this dialect family (`concat('a', null)` is NULL — the
     * opposite of PostgreSQL's), so it is what `_concat` emits and cannot serve here.
     * `concat_ws(<separator>, ...)` is the one that SKIPS a NULL argument, and with an empty
     * separator it needs nothing else: no operand is neutralised, and nesting one call inside
     * another is indistinguishable from one flat call precisely because the separator is empty.
     */
    override _appendConcatIgnoringNull(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass): string {
        return "concat_ws('', " + this._appendSqlParenthesisExcluding(valueSource, context, '_concatIgnoringNull', false) + ', ' + this._appendValueParenthesisExcluding(value, context, typeClass, '_concatIgnoringNull', false) + ')'
    }
    override _log10(context: SqlBuildContext, valueSource: ToSql): string {
        return 'log10(' +this._appendSql(valueSource, context, false) + ')'
    }
    override _day(context: SqlBuildContext, valueSource: ToSql): string {
        return 'dayofmonth(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _epochMilliseconds(context: SqlBuildContext, valueSource: ToSql): string {
        // `unix_timestamp()` is documented over 1970-01-01 onwards only: outside that range
        // it answers 0 on MySQL and NULL on MariaDB — silently, with no error — so a
        // pre-epoch or year-3002 instant came back wrong. `timestampdiff` has no such range.
        //
        // It is also independent of the session time zone, where `unix_timestamp()` resolved
        // its argument against it: the digits are counted as UTC, as the library reads a value
        // without zone, so `getTime()` agrees with the Date read in any zone of the process. A
        // TIMESTAMP column still depends on the session zone, which converts it on delivery
        // (see docs/configuration/time-zones.md).
        // The digits below a millisecond are dropped, as the Date read drops them (floor, also before 1970)
        return "floor(timestampdiff(microsecond, '1970-01-01 00:00:00', " + this._appendSql(valueSource, context, false) + ') / 1000)'
    }
    override _epochNanoseconds(context: SqlBuildContext, valueSource: ToSql): string {
        // The microseconds the database keeps, as a decimal: exact beyond the 64 bits of an integer too (after 2262)
        return "cast(timestampdiff(microsecond, '1970-01-01 00:00:00', " + this._appendSql(valueSource, context, false) + ') as decimal(30)) * 1000'
    }
    override _instantToPlainDateTime(context: SqlBuildContext, valueSource: ToSql): string {
        // An instant is kept as its wall clock in the zone of the database (a TIMESTAMP is converted with the session)
        return this._appendSql(valueSource, context, false)
    }
    override _year(context: SqlBuildContext, valueSource: ToSql): string {
        return 'year(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _month(context: SqlBuildContext, valueSource: ToSql): string {
        return 'month(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _daysInMonthOf(context: SqlBuildContext, valueSource: ToSql): string {
        return 'day(last_day(' + this._appendSql(valueSource, context, false) + '))'
    }
    override _monthCode(context: SqlBuildContext, valueSource: ToSql): string {
        return "date_format(" + this._appendSql(valueSource, context, false) + ", 'M%m')"
    }
    override _toPlainYearMonth(context: SqlBuildContext, valueSource: ToSql): string {
        // The text of its year and month on the reference day, a date (MariaDB and MySQL dates have 4 digits)
        return 'cast(date_format(' + this._appendSql(valueSource, context, false) + ", '%Y-%m-" + String(this._dayOfStoredYearMonths()).padStart(2, '0') + "') as date)"
    }
    override _toPlainMonthDay(context: SqlBuildContext, valueSource: ToSql): string {
        return 'cast(date_format(' + this._appendSql(valueSource, context, false) + ", '" + this._yearOfStoredMonthDays() + "-%m-%d') as date)"
    }
    override _daysInMonth(context: SqlBuildContext, year: string, month: string): string {
        return 'day(last_day(' + this._makeDate(context, year, month, '1') + '))'
    }
    /*
     * A zoned date and time is kept as its RFC 9557 text (see _zonedKeptAsText). MySQL before 8.0.19 and MariaDB take a
     * text with an offset as its wall clock, ignoring the offset, so the instant is computed here: the wall clock minus
     * the seconds of the offset
     */
    override _zonedKeptAsText(): boolean {
        return true
    }
    /** The date and time of the text before its zone, `2024-03-02T12:05:00+01:00` (with a `Z` instead of the offset too) */
    _mySqlZonedTextDateTime(context: SqlBuildContext, valueSource: ToSql): string {
        return "substring_index(" + this._appendSql(valueSource, context, false) + ", '[', 1)"
    }
    override _zonedTextWall(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._libraryFunctionsInstalled()) {
            return 'tsq_zoned_wall(' + this._appendSql(valueSource, context, false) + ')'
        }
        return "cast(replace(left(" + this._mySqlZonedTextDateTime(context, valueSource) + ', char_length(' + this._mySqlZonedTextDateTime(context, valueSource) + ') - if(' + this._mySqlZonedTextDateTime(context, valueSource) + " like '%Z', 1, 6)), 'T', ' ') as datetime(6))"
    }
    /** The seconds of the offset of the text of a zoned date and time, 0 for a `Z` */
    _mySqlZonedTextOffsetSeconds(context: SqlBuildContext, valueSource: ToSql): string {
        return 'if(' + this._mySqlZonedTextDateTime(context, valueSource) + " like '%Z', 0, if(substr(" + this._mySqlZonedTextDateTime(context, valueSource) + ", -6, 1) = '-', -1, 1) * (substr(" + this._mySqlZonedTextDateTime(context, valueSource) + ', -5, 2) * 3600 + substr(' + this._mySqlZonedTextDateTime(context, valueSource) + ', -2, 2) * 60))'
    }
    override _zonedTextUtc(context: SqlBuildContext, valueSource: ToSql): string {
        if (this._libraryFunctionsInstalled()) {
            return 'tsq_zoned_utc(' + this._appendSql(valueSource, context, false) + ')'
        }
        return '(' + this._zonedTextWall(context, valueSource) + ' - interval ' + this._mySqlZonedTextOffsetSeconds(context, valueSource) + ' second)'
    }
    override _zonedTextMinOrMax(kind: 'min' | 'max', context: SqlBuildContext, value: ToSql): string {
        // The instant in UTC with its 6 digits, 26 characters, orders as the instants do
        return 'substr(' + kind + "(concat(date_format(" + this._zonedTextUtc(context, value) + ", '%Y-%m-%d %H:%i:%s.%f'), " + this._appendSql(value, context, false) + ')), 27)'
    }
    override _zonedTextZone(context: SqlBuildContext, valueSource: ToSql): string {
        return "trim(trailing ']' from substring_index(" + this._appendSql(valueSource, context, false) + ", '[', -1))"
    }
    override _zonedTextOffset(context: SqlBuildContext, valueSource: ToSql): string {
        return 'if(' + this._mySqlZonedTextDateTime(context, valueSource) + " like '%Z', '+00:00', right(" + this._mySqlZonedTextDateTime(context, valueSource) + ', 6))'
    }
    override _zonedTextOffsetNanoseconds(context: SqlBuildContext, valueSource: ToSql): string {
        return '(' + this._mySqlZonedTextOffsetSeconds(context, valueSource) + ' * 1000000000)'
    }
    override _makeDate(_context: SqlBuildContext, year: string, month: string, day: string): string {
        // The first day of the year, plus the months, plus the days: in the order of the text, as the parameters
        return 'date_add(date_add(makedate(' + year + ', 1), interval ' + month + ' - 1 month), interval ' + day + ' - 1 day)'
    }
    override _dayOfWeek(context: SqlBuildContext, valueSource: ToSql): string {
        // `weekday`: 0 Monday to 6 Sunday
        return 'weekday(' + this._appendSql(valueSource, context, false) + ') + 1'
    }
    override _dayOfYear(context: SqlBuildContext, valueSource: ToSql): string {
        return 'dayofyear(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _microsecond(context: SqlBuildContext, valueSource: ToSql): string {
        // `microsecond` gives the microseconds of the second; Temporal's, the ones of the millisecond
        return 'microsecond(' + this._appendSql(valueSource, context, false) + ') % 1000'
    }
    override _toPlainDate(context: SqlBuildContext, valueSource: ToSql): string {
        return 'date(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _toPlainTime(context: SqlBuildContext, valueSource: ToSql): string {
        return 'time(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _toPlainDateTime(context: SqlBuildContext, valueSource: ToSql): string {
        return 'timestamp(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _toPlainDateTimeAt(context: SqlBuildContext, valueSource: ToSql, value: any, _typeClass: DataTypeClass): string {
        // `timestamp(date, time)`: the date at that time of the day
        return 'timestamp(' + this._appendSql(valueSource, context, false) + ', ' + this._appendPlainTimeOperand(context, value) + ')'
    }
    /** MariaDB and MySQL have no type for a duration: it is kept as its ISO 8601 text */
    override _supportNativeDurations(): boolean {
        return false
    }
    override _truncatedDivision(dividend: string, divisor: string): string {
        // `div` truncates toward zero
        return dividend + ' div ' + divisor
    }
    /**
     * `date_add` adds the months keeping the day in the month (Jan 31 plus a month is Feb 29), then the days and the
     * microseconds of the time, as Temporal does. A TIME doesn't go round at midnight: a time is the microseconds of the
     * day plus the ones of the duration, modulo a day
     */
    override _appendWithDuration(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass, sign: 1 | -1): string {
        const fields = this._temporalFieldsOfDurationOperation(typeClass)
        const constant = this._constantDurationParts(value, typeClass, fields, sign)
        if (constant && isZeroDuration(constant)) {
            return this._appendSql(valueSource, context, false)
        }
        if (fields === 'time') {
            // floor: MariaDB's time_to_sec keeps the fraction of the second, MySQL's drops it
            const time = 'floor(time_to_sec(' + this._appendSql(valueSource, context, false) + ')) * 1000000 + microsecond(' + this._appendSql(valueSource, context, false) + ')'
            const microseconds = this._durationPartsSql(context, value, typeClass, fields, sign, true)?.seconds ?? '0'
            const ofTheDay = constant
                // Less than a day, either way
                ? 'mod(' + time + ' + ' + microseconds + ' + 86400000000, 86400000000)'
                : 'mod(mod(' + time + ' + ' + microseconds + ', 86400000000) + 86400000000, 86400000000)'
            return 'sec_to_time(' + ofTheDay + ' * 0.000001)'
        }
        let result = this._appendSql(valueSource, context, false)
        const parts = this._durationPartsSql(context, value, typeClass, fields, sign, true)
        if (parts?.months !== undefined) {
            result = 'date_add(' + result + ', interval ' + parts.months + ' month)'
        }
        if (parts?.days !== undefined) {
            result = 'date_add(' + result + ', interval ' + parts.days + ' day)'
        }
        if (parts?.seconds !== undefined) {
            result = 'date_add(' + result + ', interval ' + parts.seconds + ' microsecond)'
        }
        return result
    }
    /**
     * The value with the fields given (see AbstractSqlBuilder._withFields). The parameters are positional: each part of
     * the value is written again, with its parameters, each time it appears, in the order of the text
     */
    override _appendWithFields(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass, reject: boolean, inYear?: number): string {
        const fields = this._temporalFieldsOfDurationOperation(typeClass)
        const given = plainTemporalFieldsOf(value, fields, reject, inYear)
        if (!given) {
            throw new TsSqlProcessingError({ reason: 'INVALID_VALUE_TO_SEND_TO_DATABASE', value, typeName: typeClass.type }, 'Invalid fields to put in a ' + typeClass.type + ': ' + JSON.stringify(value))
        }
        if (fields !== 'date' && __withChangesOnlyWholeTime(given)) {
            return this._withWholeTime(context, valueSource, given, fields)
        }
        if (fields === 'time') {
            return this._mySqlTimeWith(context, valueSource, given)
        }
        const mayNotFit = given.day === undefined ? given.year !== undefined || given.month !== undefined : given.day > 28
        // The first day of the month, then the days after it, up to the last day of the month; rejecting a day the month
        // hasn't with an error of the query (MariaDB and MySQL have no date that fails): a subquery of two rows
        let date = 'date_add(' + this._mySqlFirstOfMonthWith(context, valueSource, given) + ', interval '
        if (!mayNotFit) {
            date += this._mySqlDayWith(context, valueSource, given) + ' - 1 day)'
        } else if (reject) {
            date += 'case when ' + this._mySqlDayWith(context, valueSource, given) + ' > day(last_day(' + this._mySqlFirstOfMonthWith(context, valueSource, given) + ')) then (select 1 union all select 1) else ' + this._mySqlDayWith(context, valueSource, given) + ' end - 1 day)'
        } else {
            date += 'least(' + this._mySqlDayWith(context, valueSource, given) + ', day(last_day(' + this._mySqlFirstOfMonthWith(context, valueSource, given) + '))) - 1 day)'
        }
        if (fields === 'date') {
            return date
        }
        return 'timestamp(' + date + ', ' + this._mySqlTimeWith(context, valueSource, given) + ')'
    }
    /** The whole difference of two dates and times: their microseconds apart, as timestampdiff counts them */
    override _differenceTotal(context: SqlBuildContext, d: PlainTemporalDifferenceSql): string {
        if (d.fields !== 'timestamp') {
            return super._differenceTotal(context, d)
        }
        return 'timestampdiff(microsecond, ' + this._appendSql(d.one, context, false) + ', ' + this._appendSql(d.two, context, false) + ')'
    }
    /** Of dates and times, in decimals: the nanoseconds of more than 292 years overflow a bigint, an error */
    override _nanosecondsOfDifference(ticks: string, d: PlainTemporalDifferenceSql): string {
        return d.fields === 'timestamp' ? 'cast(' + ticks + ' as decimal(65)) * ' + d.tick : super._nanosecondsOfDifference(ticks, d)
    }
    override _withWholeTime(context: SqlBuildContext, valueSource: ToSql, given: PlainTemporalFields, fields: 'time' | 'timestamp'): string {
        // The value goes first, as its parameters in the text. addtime reads a text as a time, where date_add reads it
        // as a date and time (null for a time given as a value)
        const value = this._appendSql(valueSource, context, false)
        if (fields === 'time') {
            return 'addtime(' + value + ', sec_to_time(' + this._withSeconds(context, valueSource, given) + '))'
        }
        return 'date_add(' + value + ', interval ' + this._withSeconds(context, valueSource, given) + ' second)'
    }
    override _temporalOperand(operand: ToSql): ToSql {
        // The parameters are positional: a const is a parameter each time it is written
        return operand
    }
    override _textWithMinus(text: string): string {
        return "concat('-', " + text + ')'
    }
    override _integerPart(sql: string): string {
        // year(), month(), day() ... give an unsigned integer, which a subtraction can't take below zero
        return 'cast(' + sql + ' as signed)'
    }
    override _daysBetween(_context: SqlBuildContext, to: string, from: string): string {
        return 'datediff(' + to + ', ' + from + ')'
    }
    override _addDaysToDate(_context: SqlBuildContext, date: string, days: string): string {
        return 'date_add(' + date + ', interval ' + days + ' day)'
    }
    override _nanosecondsSinceMidnight(context: SqlBuildContext, valueSource: ToSql): string {
        // floor: MariaDB's time_to_sec keeps the fraction of the second, MySQL's drops it. time_to_sec takes the time
        // of a date and time; time() of a text parameter is 00:00:00 through Bun SQL on MySQL 8 (measured)
        return '(floor(time_to_sec(' + this._appendSql(valueSource, context, false) + ')) * 1000000 + microsecond(' + this._appendSql(valueSource, context, false) + ')) * 1000'
    }
    override _dateOfValue(context: SqlBuildContext, valueSource: ToSql): string {
        return 'date(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _timeOfNanoseconds(_context: SqlBuildContext, nanoseconds: string): string {
        return 'sec_to_time(mod(' + nanoseconds + ', 86400000000000) div 1000 * 0.000001)'
    }
    override _dateTimeOfNanoseconds(_context: SqlBuildContext, date: string, nanoseconds: string): string {
        return 'date_add(' + date + ', interval (' + nanoseconds + ') div 1000 microsecond)'
    }
    /** A time and a date and time keep microseconds */
    override _temporalTick(): bigint {
        return 1000n
    }
    override _ticksSinceMidnight(context: SqlBuildContext, valueSource: ToSql): string {
        return '(floor(time_to_sec(' + this._appendSql(valueSource, context, false) + ')) * 1000000 + microsecond(' + this._appendSql(valueSource, context, false) + '))'
    }
    override _timeOfDatabaseTicks(_context: SqlBuildContext, ticks: string): string {
        return 'sec_to_time(mod(' + ticks + ', 86400000000) * 0.000001)'
    }
    override _dateTimeOfDatabaseTicks(_context: SqlBuildContext, date: string, ticks: string): string {
        return 'date_add(' + date + ', interval ' + ticks + ' microsecond)'
    }
    /** The day of the value, or the one given */
    _mySqlDayWith(context: SqlBuildContext, valueSource: ToSql, given: PlainTemporalFields): string {
        return given.day === undefined ? 'day(' + this._appendSql(valueSource, context, false) + ')' : String(given.day)
    }
    /**
     * The value plus the duration, or an error of the query when the day of the value isn't in the month the months of
     * the duration reach (a subquery of two rows): each part written again where it appears, in the order of the text
     */
    override _valueOrErrorWhenDurationHasDays(context: SqlBuildContext, value: string, duration: ToSql): string {
        // No date fails: a subquery of two rows is the error; the condition after the value, as the parameters appear
        return 'date_add(' + value + ', interval case when ' + this._durationHasDaysSql(context, duration) + ' then (select 1 union all select 1) else 0 end day)'
    }
    override _bigintOfInteger(sql: string): string {
        // The arithmetic of integers is of 64 bits
        return sql
    }
    override _appendWithDurationRejecting(context: SqlBuildContext, valueSource: ToSql, value: any, typeClass: DataTypeClass, sign: 1 | -1): string {
        const fields = this._temporalFieldsOfDurationOperation(typeClass)
        if (fields === 'time' || !this._hasDurationMonths(value, typeClass, fields, sign)) {
            return this._appendWithDuration(context, valueSource, value, typeClass, sign)
        }
        let result = 'case when day(' + this._appendSql(valueSource, context, false) + ') > day(last_day(date_add(' + this._appendSql(valueSource, context, false)
        result += ', interval ' + this._durationMonthsSql(context, value, typeClass, fields, sign) + ' month))) then (select 1 union all select 1) else '
        return result + this._appendWithDuration(context, valueSource, value, typeClass, sign) + ' end'
    }
    /** The first day of the month of the value with the year and the month given */
    _mySqlFirstOfMonthWith(context: SqlBuildContext, valueSource: ToSql, given: PlainTemporalFields): string {
        const year = given.year === undefined ? 'year(' + this._appendSql(valueSource, context, false) + ')' : String(given.year)
        const month = given.month === undefined ? 'month(' + this._appendSql(valueSource, context, false) + ')' : String(given.month)
        return 'date_add(makedate(' + year + ', 1), interval ' + month + ' - 1 month)'
    }
    /** The time of the day of the value with the fields of a time given */
    _mySqlTimeWith(context: SqlBuildContext, valueSource: ToSql, given: PlainTemporalFields): string {
        const hour = given.hour === undefined ? 'hour(' + this._appendSql(valueSource, context, false) + ')' : String(given.hour)
        const minute = given.minute === undefined ? 'minute(' + this._appendSql(valueSource, context, false) + ')' : String(given.minute)
        const second = given.second === undefined ? 'second(' + this._appendSql(valueSource, context, false) + ')' : String(given.second)
        let microseconds: string
        if (given.millisecond === undefined && given.microsecond === undefined) {
            microseconds = 'microsecond(' + this._appendSql(valueSource, context, false) + ')'
        } else {
            const milliseconds = given.millisecond === undefined ? 'microsecond(' + this._appendSql(valueSource, context, false) + ') div 1000' : String(given.millisecond)
            const ofTheMillisecond = given.microsecond === undefined ? 'microsecond(' + this._appendSql(valueSource, context, false) + ') % 1000' : String(given.microsecond)
            microseconds = milliseconds + ' * 1000 + ' + ofTheMillisecond
        }
        // MariaDB and MySQL keep microseconds: the nanoseconds given are dropped
        return microseconds === '0 * 1000 + 0' ? 'maketime(' + hour + ', ' + minute + ', ' + second + ')' : 'maketime(' + hour + ', ' + minute + ', ' + second + ' + (' + microseconds + ') * 0.000001)'
    }
    override _monthFromZero(context: SqlBuildContext, valueSource: ToSql): string {
        return 'month(' + this._appendSql(valueSource, context, false) + ') - 1'
    }
    override _dayOfWeekFromSunday(context: SqlBuildContext, valueSource: ToSql): string {
        return 'dayofweek(' + this._appendSql(valueSource, context, false) + ') - 1'
    }
    override _hour(context: SqlBuildContext, valueSource: ToSql): string {
        return 'hour(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _minute(context: SqlBuildContext, valueSource: ToSql): string {
        return 'minute(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _second(context: SqlBuildContext, valueSource: ToSql): string {
        return 'second(' + this._appendSql(valueSource, context, false) + ')'
    }
    override _millisecond(context: SqlBuildContext, valueSource: ToSql): string {
        // `microsecond()` is an int, so `/ 1000` is an exact division and `round` breaks
        // its tie away from zero: 999600 µs reported 1000 ms, a value this method's
        // declared type (and the JavaScript accessor it mirrors) cannot hold, and 123500 µs
        // reported 124. The sub-millisecond part is truncated, not rounded, everywhere else.
        return 'floor(microsecond(' + this._appendSql(valueSource, context, false) + ') / 1000)'
    }
    /**
     * MySQL / MariaDB read a backslash inside a string literal as an escape character
     * (unless `NO_BACKSLASH_ESCAPES` is set), so besides doubling `'` the backslash is
     * doubled too; otherwise a value ending in `\` would escape the closing quote. With
     * `NO_BACKSLASH_ESCAPES` a backslash in the value comes out doubled, never unescaped.
     */
    override _appendUnsafeLiteralValue(value: string, _context: SqlBuildContext): string {
        return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "''") + "'"
    }
    // GROUP_CONCAT only accepts a literal as SEPARATOR: a placeholder there is refused by a
    // server-side prepared statement (it only worked when the driver interpolated the
    // values on the client). The separator comes from a runtime API argument, so it is
    // inlined through `_appendUnsafeLiteralValue`.
    override _stringConcat(context: SqlBuildContext, separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(' + this._appendSql(value, context, false) + ')'
        } else if (separator === '') {
            return 'group_concat(' + this._appendSql(value, context, false) + " separator '')"
        } else {
            return 'group_concat(' + this._appendSql(value, context, false) + ' separator ' + this._appendUnsafeLiteralValue(separator, context) + ')'
        }
    }
    override _stringConcatDistinct(context: SqlBuildContext, separator: string | undefined, value: any): string {
        if (separator === undefined || separator === null) {
            return 'group_concat(distinct ' + this._appendSql(value, context, false) + ')'
        } else if (separator === '') {
            return 'group_concat(distinct ' + this._appendSql(value, context, false) + " separator '')"
        } else {
            return 'group_concat(distinct ' + this._appendSql(value, context, false) + ' separator ' + this._appendUnsafeLiteralValue(separator, context) + ')'
        }
    }
    override _random(_context: SqlBuildContext): string {
        return 'rand()'
    }
    override _finalizeAggregatedArrayResult(sql: string): string {
        // mysql2 / mariadb decode a JSON column into a JS value, rounding every integer past
        // 2^53, before the library sees it. Casting the aggregate to `char` makes the driver
        // hand back the raw JSON string, which `parseJsonPreservingNumbers` decodes losslessly.
        return 'cast(' + sql + ' as char)'
    }
    override _appendAggregateArrayColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, aggregatedArrayDistinct: boolean, context: SqlBuildContext, _query: SelectData | undefined): string {
        const distict = aggregatedArrayDistinct ? 'distinct ' : ''
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_arrayagg(' + distict + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, this._appendSql(aggregatedArrayColumns, context, false), context) + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendAggregatedArrayValueProjection(columns[prop]!, this._appendSql(columns[prop]!, context, false), context)
            }

            return 'json_arrayagg(' +  distict + 'json_object(' + result + '))'
        }
    }
    override _appendAggregateArrayWrappedColumns(aggregatedArrayColumns: __AggregatedArrayColumns | AnyValueSource, context: SqlBuildContext, aggregateId: number): string {
        if (isValueSource(aggregatedArrayColumns)) {
            return 'json_arrayagg(' + this._appendAggregatedArrayValueProjection(aggregatedArrayColumns, 'a_' + aggregateId + '_.result', context) + ')'
        } else {
            const columns: FlatQueryColumns = {}
            flattenQueryColumns(aggregatedArrayColumns, columns, '')

            let result = ''
            for (let prop in columns) {
                if (result) {
                    result += ', '
                }
                result += "'" + prop + "', " + this._appendAggregatedArrayValueProjection(columns[prop]!, 'a_' + aggregateId + '_.' + this._escape(prop, true), context)
            }

            return 'json_arrayagg(json_object(' + result + '))'
        }
    }
}
