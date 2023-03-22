import { SqlBuilder, JoinData, ToSql, SelectData, CompoundOperator, CompoundSelectData, PlainSelectData, QueryColumns, isAllowedQueryColumns } from "../sqlBuilders/SqlBuilder"
import type { SelectExpression, SelectColumns, OrderByMode, SelectExpressionSubquery, ExecutableSelectExpressionWithoutWhere, DynamicWhereExecutableSelectExpression, GroupByOrderByExecutableSelectExpression, OffsetExecutableSelectExpression, DynamicWhereExpressionWithoutSelect, SelectExpressionFromNoTable, SelectWhereJoinExpression, DynamicOnExpression, OnExpression, SelectExpressionWithoutJoin, SelectWhereExpression, OrderByExecutableSelectExpression, GroupByOrderByHavingExecutableSelectExpression, DynamicHavingExecutableSelectExpression, GroupByOrderHavingByExpressionWithoutSelect, DynamicHavingExpressionWithoutSelect, ICompoundableSelect, CompoundableCustomizableExecutableSelectExpression, CompoundedExecutableSelectExpression, ExecutableSelect, ComposeExpression, ComposeExpressionDeletingInternalProperty, ComposeExpressionDeletingExternalProperty, WithableExecutableSelect, SelectCustomization, WhereableExecutableSelectExpressionWithGroupBy, DynamicWhereExecutableSelectExpressionWithGroupBy, GroupByOrderByHavingExecutableSelectExpressionWithoutWhere, DynamicHavingExecutableSelectExpressionWithoutWhere, DynamicWhereSelectExpressionWithoutSelect, CompoundableExecutableSelectExpression, CompoundedOrderByExecutableSelectExpression, CompoundedOffsetExecutableSelectExpression, CompoundedCustomizableExecutableSelect, OrderByExecutableSelectExpressionWithoutWhere, OrderedExecutableSelectExpressionWithoutWhere, OffsetExecutableSelectExpressionWithoutWhere, CompoundableCustomizableExpressionWithoutWhere, DynamicWhereOffsetExecutableSelectExpression, DynamicWhereCompoundableCustomizableExecutableSelectExpression, ExecutableSelectWithWhere, ExecutableSelectWithoutWhere, WithableExecutableSelectWithoutWhere, CompoundableExecutableSelectExpressionWithoutWhere, CompoundableCustomizableExecutableSelectExpressionWitoutWhere, SplitedComposedExecutableSelectWithoutWhere, SplitedComposedDynamicWhereExecutableSelectExpression, WhereableCompoundableExecutableSelectExpressionWithoutWhere } from "../expressions/select"
import { HasAddWiths, HasIsValue, ITableOrView, IWithView, OuterJoinSource, __getOldValues, __getValuesForInsert, __isAllowed, __registerRequiredColumn, __registerTableOrView } from "../utils/ITableOrView"
import { IIfValueSource, IBooleanValueSource, INumberValueSource, IIntValueSource, IExecutableSelectQuery, AnyValueSource, AlwaysIfValueSource, isValueSource } from "../expressions/values"
import type { int } from "ts-extended-types"
import type { WithView } from "../utils/tableOrViewUtils"
import { __addWiths, __getTableOrViewPrivate } from "../utils/ITableOrView"
import { __getValueSourcePrivate } from "../expressions/values"
import ChainedError from "chained-error"
import { AggregateFunctions0ValueSource, AggregateSelectValueSource, InlineSelectValueSource } from "../internal/ValueSourceImpl"
import { attachSource } from "../utils/attachSource"
import { columnsType, database, requiredTableOrView, resultType, type, compoundableColumns, isSelectQueryObject } from "../utils/symbols"
import { asAlwaysIfValueSource } from "../expressions/values"
import { WithViewImpl } from "../internal/WithViewImpl"
import { createColumnsFrom } from "../internal/ColumnImpl"
import { View } from "../View"
import { ComposeSplitQueryBuilder } from "./ComposeSliptQueryBuilder"
import { Column } from "../utils/Column"

abstract class AbstractSelect extends ComposeSplitQueryBuilder implements ToSql, HasAddWiths, IExecutableSelectQuery<any, any, any, any>, CompoundableCustomizableExecutableSelectExpression<any, any, any, any, any, any>, CompoundedExecutableSelectExpression<any, any, any, any, any, any>, WithableExecutableSelect<any, any, any, any, any>, ExecutableSelect<any, any, any, any>, ComposeExpression<any, any, any, any, any, any, any>, ComposeExpressionDeletingInternalProperty<any, any, any, any, any, any, any>,  ComposeExpressionDeletingExternalProperty<any, any, any, any, any, any, any>, OrderByExecutableSelectExpression<any,any,any,any, any, any>, OffsetExecutableSelectExpression<any, any, any, any, any, any>, CompoundableCustomizableExecutableSelectExpression<any, any, any, any, any, any>, CompoundableExecutableSelectExpression<any, any, any, any, any, any>, CompoundedOrderByExecutableSelectExpression<any, any, any, any, any, any>, CompoundedOffsetExecutableSelectExpression<any, any, any, any, any>, CompoundedCustomizableExecutableSelect<any, any, any, any, any>, OrderByExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, ExecutableSelectWithWhere<any, any, any, any>, ExecutableSelectWithoutWhere<any, any, any, any, any>, WithableExecutableSelectWithoutWhere<any, any, any, any, any, any>, CompoundableExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, CompoundableCustomizableExecutableSelectExpressionWitoutWhere<any, any, any, any, any, any> {
    [database]: any
    [requiredTableOrView]: any
    [type]: any
    [compoundableColumns]: any

    [resultType]: any
    [columnsType]: any

    [isSelectQueryObject]: true = true

    __columns: QueryColumns = {}
    __orderBy?: { [property: string]: OrderByMode | null | undefined }
    __limit?: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>
    __offset?: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>
    __withs: Array<IWithView<any>> = []
    __customization?: SelectCustomization<any>

    __oneColumn = false

    // cache
    __query = ''
    __params: any[] = []

    __recursiveInternalView?: WithViewImpl<any, any>
    __recursiveView?: WithViewImpl<any, any>
    __recursiveSelect?: SelectData & AbstractSelect

    __subSelectUsing?: ITableOrView<any>[]

    __asInlineAggregatedArrayValue?: boolean

    constructor(sqlBuilder: SqlBuilder) {
        super(sqlBuilder)
    }

    query(): string {
        this.__finishJoinHaving()
        if (this.__query) {
            return this.__query
        }
        try {
            this.__query = this.__sqlBuilder._buildSelect(this.__asSelectData(), this.__params)
        } catch (e) {
            throw new ChainedError(e)
        }
        return this.__query
    }
    params(): any[] {
        this.__finishJoinHaving()
        if (!this.__query) {
            this.query()
        }
        return this.__params
    }

    executeSelectNoneOrOne(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeSelectOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns['result']!
                    if (!isValueSource(valueSource)) {
                        throw new Error('The result column must be a ValueSource')
                    }
                    if (value === undefined) {
                        return null
                    }
                    return this.__transformValueFromDB(valueSource, value)
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                result = this.__sqlBuilder._queryRunner.executeSelectOneRow(this.__query, this.__params).then((row) => {
                    if (row) {
                        return this.__transformRow(row)
                    } else {
                        return null
                    }
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }
            return this.__applyCompositions(result, source)
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    executeSelectOne(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeSelectOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns['result']!
                    if (!isValueSource(valueSource)) {
                        throw new Error('The result column must be a ValueSource')
                    }
                    if (value === undefined) {
                        throw new Error('No result returned by the database')
                    }
                    return this.__transformValueFromDB(valueSource, value)
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                result = this.__sqlBuilder._queryRunner.executeSelectOneRow(this.__query, this.__params).then((row) => {
                    if (row) {
                        return this.__transformRow(row)
                    } else {
                        throw new Error('No result returned by the database')
                    }
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }
            return this.__applyCompositions(result, source)
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    __executeSelectMany(source: Error): Promise<any> {
        this.query()
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeSelectOneColumnManyRows(this.__query, this.__params).then((values) => {
                    const valueSource = this.__columns['result']!
                    if (!isValueSource(valueSource)) {
                        throw new Error('The result column must be a ValueSource')
                    }

                    return values.map((value) => {
                        if (value === undefined) {
                            value = null
                        }
                        return this.__transformValueFromDB(valueSource, value)
                    })
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                result = this.__sqlBuilder._queryRunner.executeSelectManyRows(this.__query, this.__params).then((rows) => {
                    return rows.map((row, index) => {
                        return this.__transformRow(row, index)
                    })
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }
            return this.__applyCompositions(result, source)
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    executeSelectMany(): Promise<any> {
        const source = new Error('Query executed at')
        return this.__executeSelectMany(source)
    }
    abstract __buildSelectCount(countAll: AggregateFunctions0ValueSource, params: any[]): string
    __executeSelectCount(source: Error): Promise<any> {
        try {
            this.__sqlBuilder._resetUnique()
            const countAll = new AggregateFunctions0ValueSource('_countAll', 'int', 'required', undefined)
            const params: any[] = []
            const query = this.__buildSelectCount(countAll, params)
            return this.__sqlBuilder._queryRunner.executeSelectOneColumnOneRow(query, params).then((value) => {
                return this.__transformValueFromDB(countAll, value, undefined, undefined, true)
            }).catch((e) => {
                throw attachSource(new ChainedError(e), source)
            })
        } catch (e) {
            throw attachSource(new ChainedError(e), source)
        }
    }
    executeSelectPage(extras?: any) {
        const source = new Error('Query executed at')

        if (extras && (extras.count !== undefined && extras.count !== null)) {
            if (extras.data) {
                return this.__sqlBuilder._queryRunner.createResolvedPromise({...extras, data: extras.data, count: extras.count})
            }
            return this.__executeSelectMany(source).then((data) => {
                return {...extras, data, count: extras.count}
            })
        }
        if (extras && extras.data) {
            return this.__executeSelectCount(source).then((count) => {
                return {...extras, data: extras.data, count}
            })
        }

        const getDataFn = () => {
            return this.__executeSelectMany(source)
        }

        const getCountFn = () => {
            return this.__executeSelectCount(source)
        }

        return this.__sqlBuilder._queryRunner.executeCombined(getDataFn, getCountFn).then(([data, count]) => {
            return {...extras, data, count}
        })
    }

    abstract __finishJoinHaving(): void
    orderBy(column: any, mode?: OrderByMode): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (!this.__getColumnFromColumnsObject(column)) {
            throw new Error('The column "' + column + '" is not part of the select clause')
        }
        this.__addOrderBy(column, mode)
        return this
    }
    __addOrderBy(column: string, mode?: OrderByMode) {
        if (!this.__orderBy) {
            this.__orderBy = {}
        }
        if (column in this.__orderBy) {
            throw new Error('Column ' + column + ' already used in the order by clause')
        }
        this.__orderBy[column] = mode || null
    }
    orderByFromString(orderBy: string): any {
        this.__finishJoinHaving()
        this.__query = ''

        const split = orderBy.trim().toLowerCase().replace(/\s+/g, ' ').split(/\s*,\s*/)
        for (let i = 0, length = split.length; i < length; i++) {
            const clause = split[i]!
            const separatorIndex = clause.indexOf(' ')
            let column
            let ordering
            if (separatorIndex < 0) {
                column = clause
                ordering = null
            } else {
                column = clause.substring(0, separatorIndex)
                ordering = clause.substring(separatorIndex + 1)
            }
            const realColumnName = this.__getColumnNameFromColumnsObjectLowerCase(column)
            if (!realColumnName) {
                throw new Error('The column "' + column + '" is not part of the select clause')
            }
            if (ordering === 'asc') {
                this.__addOrderBy(realColumnName, 'asc')
            } else if (ordering === 'desc') {
                this.__addOrderBy(realColumnName, 'desc')
            } else if (ordering === 'asc nulls first') {
                this.__addOrderBy(realColumnName, 'asc nulls first')
            } else if (ordering === 'desc nulls first') {
                this.__addOrderBy(realColumnName, 'desc nulls first')
            } else if (ordering === 'asc nulls last') {
                this.__addOrderBy(realColumnName, 'asc nulls last')
            } else if (ordering === 'desc nulls last') {
                this.__addOrderBy(realColumnName, 'desc nulls last')
            } else if (ordering === 'insensitive') {
                this.__addOrderBy(realColumnName, 'insensitive')
            } else if (ordering === 'asc insensitive') {
                this.__addOrderBy(realColumnName, 'asc insensitive')
            } else if (ordering === 'desc insensitive') {
                this.__addOrderBy(realColumnName, 'desc insensitive')
            } else if (ordering === 'asc nulls first insensitive') {
                this.__addOrderBy(realColumnName, 'asc nulls first insensitive')
            } else if (ordering === 'desc nulls first insensitive') {
                this.__addOrderBy(realColumnName, 'desc nulls first insensitive')
            } else if (ordering === 'asc nulls last insensitive') {
                this.__addOrderBy(realColumnName, 'asc nulls last insensitive')
            } else if (ordering === 'desc nulls last insensitive') {
                this.__addOrderBy(realColumnName, 'desc nulls last insensitive')
            } else if (!ordering) {
                this.__addOrderBy(realColumnName)
            } else {
                throw new Error('Unknow ordering clause "' + ordering + '" in the order by related to the column "' + column + '"')
            }
        }
        return this
    }
    orderByFromStringIfValue(orderBy: string | null | undefined): any {
        if (this.__isValue(orderBy)) {
            return this.orderByFromString(orderBy)
        } else {
            this.__finishJoinHaving()
            this.__query = ''
            return this
        }
    }
    limit(limit: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        this.__limit = limit
        __addWiths(limit, this.__sqlBuilder, this.__withs)
        return this
    }
    limitIfValue(limit: int | number | null | undefined): any {
        if (this.__isValue(limit)) {
            return this.limit(limit)
        } else {
            this.__finishJoinHaving()
            this.__query = ''
            return this
        }
    }
    offset(offset: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        this.__offset = offset
        __addWiths(offset, this.__sqlBuilder, this.__withs)
        return this
    }
    offsetIfValue(offset: int | number | null | undefined): any {
        if (this.__isValue(offset)) {
            return this.offset(offset)
        } else {
            this.__finishJoinHaving()
            this.__query = ''
            return this
        }
    }

    __combineSubSelectUsing(select: ICompoundableSelect<any, any, any, any>, result: CompoundSelectQueryBuilder) {
        const selectPrivate = select as any as AbstractSelect
        if (this.__subSelectUsing) {
            if (selectPrivate.__subSelectUsing) {
                result.__subSelectUsing = this.__subSelectUsing.concat(...selectPrivate.__subSelectUsing)
            } else {
                result.__subSelectUsing = this.__subSelectUsing.concat()
            }
        } else if (selectPrivate.__subSelectUsing) {
            result.__subSelectUsing = selectPrivate.__subSelectUsing.concat()
        }
    }

    union(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'union', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }
    unionAll(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'unionAll', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }
    intersect(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'intersect', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }    
    intersectAll(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'intersectAll', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }    
    except(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'except', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }
    exceptAll(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'exceptAll', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }
    minus(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'minus', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    }
    minusAll(select: ICompoundableSelect<any, any, any, any>): any {
        const result = new CompoundSelectQueryBuilder(this.__sqlBuilder, this.__asSelectData(), 'minusAll', this.__compoundableAsSelectData(select))
        this.__combineSubSelectUsing(select, result)
        return result
    };

    __compoundableAsSelectData(select: ICompoundableSelect<any, any, any, any>): SelectData {
        return (select as any as AbstractSelect).__asSelectData()
    }

    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        this.__finishJoinHaving()
        const withViews = this.__withs
        for (let i = 0, length = withViews.length; i < length; i++) {
            const withView = withViews[i]!
            __getTableOrViewPrivate(withView).__addWiths(sqlBuilder, withs)
        }
    }
    __registerTableOrView(sqlBuilder: HasIsValue, requiredTablesOrViews: Set<ITableOrView<any>>): void {
        const subSelectUsing = this.__subSelectUsing
        if (!subSelectUsing) {
            return
        }
        for (let i = 0, length = subSelectUsing.length; i < length; i++) {
            const tableOrView = subSelectUsing[i]!
            __getTableOrViewPrivate(tableOrView).__registerTableOrView(sqlBuilder, requiredTablesOrViews)
        }
    }
    __registerRequiredColumn(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        const subSelectUsing = this.__subSelectUsing
        if (!subSelectUsing) {
            return
        }
        const newOnly = new Set<ITableOrView<any>>()
        for (let i = 0, length = subSelectUsing.length; i < length; i++) {
            const tableOrView = subSelectUsing[i]!
            if (onlyForTablesOrViews.has(tableOrView)) {
                newOnly.add(tableOrView)
            }
        }
        if (newOnly.size <= 0) {
            return
        }

        this.__registerRequiredColumnOfColmns(this.__columns, requiredColumns, newOnly)
        __registerRequiredColumn(this.__orderBy, sqlBuilder, requiredColumns, newOnly)
        __registerRequiredColumn(this.__limit, sqlBuilder, requiredColumns, newOnly)
        __registerRequiredColumn(this.__offset, sqlBuilder, requiredColumns, newOnly)

        const customization = this.__customization
        if (customization) {
            __registerRequiredColumn(customization.afterSelectKeyword, sqlBuilder, requiredColumns, newOnly)
            __registerRequiredColumn(customization.beforeColumns, sqlBuilder, requiredColumns, newOnly)
            __registerRequiredColumn(customization.customWindow, sqlBuilder, requiredColumns, newOnly)
            __registerRequiredColumn(customization.afterQuery, sqlBuilder, requiredColumns, newOnly)
        }

        this.__registerRequiredColumnInSelect(sqlBuilder, requiredColumns, newOnly)
    }
    abstract __registerRequiredColumnInSelect(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        const subSelectUsing = this.__subSelectUsing
        if (!subSelectUsing) {
            return undefined
        }
        for (let i = 0, length = subSelectUsing.length; i < length; i++) {
            const tableOrView = subSelectUsing[i]!
            const result = __getTableOrViewPrivate(tableOrView).__getOldValues(sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        const subSelectUsing = this.__subSelectUsing
        if (!subSelectUsing) {
            return undefined
        }
        for (let i = 0, length = subSelectUsing.length; i < length; i++) {
            const tableOrView = subSelectUsing[i]!
            const result = __getTableOrViewPrivate(tableOrView).__getValuesForInsert(sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    }
    abstract __isAllowed(sqlBuilder: HasIsValue): boolean

    abstract __asSelectData(): SelectData & AbstractSelect
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        this.__finishJoinHaving()
        return sqlBuilder._buildInlineSelect(this.__asSelectData(), params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        this.__finishJoinHaving()
        return sqlBuilder._buildInlineSelect(this.__asSelectData(), params)
    }

    forUseInQueryAs(as: string): WithView<any, any> {
        const recursiveView = this.__recursiveView
        if (recursiveView) {
            recursiveView.__name = as
            this.__recursiveInternalView!.__name = as
            this.__recursiveView = undefined
            this.__recursiveInternalView = undefined
            this.__recursiveSelect = undefined
            return recursiveView as any
        }
        return new WithViewImpl<any, any>(this.__sqlBuilder, as, this.__asSelectData()) as any
    }

    forUseAsInlineQueryValue(): any {
        return new InlineSelectValueSource(this.__asSelectData() as any)
    }

    forUseAsInlineAggregatedArrayValue(): any {
        const selectData = this.__asSelectData()
        selectData.__asInlineAggregatedArrayValue = true
        let aggregatedArrayColumns
        if (this.__oneColumn) {
            aggregatedArrayColumns = this.__columns['result']!
        } else {
            aggregatedArrayColumns = this.__columns
        }
        return new AggregateSelectValueSource(selectData as any, aggregatedArrayColumns, 'ResultObject', 'required')
    }

    __buildRecursive(fn: (view: any) => ICompoundableSelect<any, any, any, any>, unionAll: boolean): void {
        const sqlBuilder = this.__sqlBuilder
        const name = 'recursive_select_' + sqlBuilder._generateUnique()
        const recursiveInternalView = new WithViewImpl<any, any>(this.__sqlBuilder, name, this as any)
        let recursiveInternalSelect 
        if (unionAll) {
            recursiveInternalSelect = this.unionAll(fn(recursiveInternalView))
        } else {
            recursiveInternalSelect = this.union(fn(recursiveInternalView))
        }
        const recursiveView = new WithViewImpl<any, any>(this.__sqlBuilder, name, recursiveInternalSelect)
        recursiveView.__recursive = true

        const recursiveSelect = new SelectQueryBuilder(this.__sqlBuilder, [recursiveView], false)
        const columns = recursiveSelect.__columns
        const currentColumns = this.__columns
        for (let columnName in currentColumns) {
            columns[columnName] = (recursiveView as any)[columnName]
        }
        recursiveSelect.__subSelectUsing = this.__subSelectUsing

        this.__recursiveInternalView = recursiveInternalView
        this.__recursiveView = recursiveView
        this.__recursiveSelect = recursiveSelect.__asSelectData() // __asSelectData is important here to detect the required tables
    }
    recursiveUnion(fn: (view: any) => ICompoundableSelect<any, any, any, any>): any {
        this.__buildRecursive(fn, false)
        return this
    }
    recursiveUnionAll(fn: (view: any) => ICompoundableSelect<any, any, any, any>): any {
        this.__buildRecursive(fn, true)
        return this
    }
    __buildRecursiveFn(fn: (view: any) => IBooleanValueSource<any, any>): (view: any) => ICompoundableSelect<any, any, any, any> {
        return (view: any) => {
            const current = this as any as PlainSelectData
            const result = new SelectQueryBuilder(this.__sqlBuilder, current.__tablesOrViews, false)
            result.__columns = current.__columns
            result.__withs = current.__withs.concat()
            result.__joins = current.__joins.concat()
            result.__subSelectUsing = this.__subSelectUsing
            result.join(view).on(fn(view)).__finishJoinHaving()
            return result as any
        }
    }
    recursiveUnionOn(fn: (view: any) => IBooleanValueSource<any, any>): any {
        this.__buildRecursive(this.__buildRecursiveFn(fn), false)
        return this
    }
    recursiveUnionAllOn(fn: (view: any) => IBooleanValueSource<any, any>): any {
        this.__buildRecursive(this.__buildRecursiveFn(fn), true)
        return this
    }

    customizeQuery(customization: SelectCustomization<any>): any {
        this.__customization = customization
        __addWiths(customization.afterSelectKeyword, this.__sqlBuilder, this.__withs)
        __addWiths(customization.beforeColumns, this.__sqlBuilder, this.__withs)
        __addWiths(customization.customWindow, this.__sqlBuilder, this.__withs)
        __addWiths(customization.beforeOrderByItems, this.__sqlBuilder, this.__withs)
        __addWiths(customization.afterOrderByItems, this.__sqlBuilder, this.__withs)
        __addWiths(customization.afterQuery, this.__sqlBuilder, this.__withs)
        return this
    }
}

export class SelectQueryBuilder extends AbstractSelect implements ToSql, PlainSelectData, SelectExpression<any, any, any, any>, SelectExpressionFromNoTable<any, any>, ExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, DynamicWhereExecutableSelectExpression<any, any, any, any, any, any>, DynamicWhereExpressionWithoutSelect<any, any, any, any>, GroupByOrderByExecutableSelectExpression<any, any, any, any, any, any>, SelectWhereJoinExpression<any, any, any, any>, DynamicOnExpression<any, any, any, any>, OnExpression<any, any, any, any>, SelectExpressionWithoutJoin<any, any, any, any>, SelectExpressionSubquery<any, any, any>, SelectWhereExpression<any, any, any, any>, GroupByOrderByHavingExecutableSelectExpression<any, any, any, any, any, any>, DynamicHavingExecutableSelectExpression<any, any, any, any, any, any>, GroupByOrderHavingByExpressionWithoutSelect<any, any, any, any>, DynamicHavingExpressionWithoutSelect<any, any, any, any>, WhereableExecutableSelectExpressionWithGroupBy<any, any, any, any, any, any>, DynamicWhereExecutableSelectExpressionWithGroupBy<any, any, any, any, any, any>, GroupByOrderByHavingExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, DynamicHavingExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, DynamicWhereSelectExpressionWithoutSelect<any, any, any, any>, OrderedExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, OffsetExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, CompoundableCustomizableExpressionWithoutWhere<any, any, any, any, any, any>, DynamicWhereOffsetExecutableSelectExpression<any, any, any, any, any, any>, DynamicWhereCompoundableCustomizableExecutableSelectExpression<any, any, any, any, any, any>, SplitedComposedExecutableSelectWithoutWhere<any, any, any, any, any>, SplitedComposedDynamicWhereExecutableSelectExpression<any, any, any, any, any>, WhereableCompoundableExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, DynamicWhereCompoundableCustomizableExecutableSelectExpression<any, any, any, any, any, any> {
    __type: 'plain' = 'plain'
    __distinct: boolean
    __tablesOrViews: Array<ITableOrView<any>>
    __joins: Array<JoinData> = []
    __where?: AlwaysIfValueSource<any, any>
    __having?: AlwaysIfValueSource<any, any>
    __groupBy:  Array<AnyValueSource> = []
    __requiredTablesOrViews?: Set<ITableOrView<any>>

    __lastJoin?: JoinData
    __inHaving = false
    __hasOptionalJoin = false

    constructor(sqlBuilder: SqlBuilder, tables: Array<ITableOrView<any>>, distinct: boolean) {
        super(sqlBuilder)
        this.__tablesOrViews = tables
        this.__distinct = distinct
        for (let i = 0, length = tables.length; i < length; i++) {
            const table = tables[i]!
            __getTableOrViewPrivate(table).__addWiths(sqlBuilder, this.__withs)
        }
    }

    __registerRequiredColumnInSelect(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        const tablesOrViews = this.__tablesOrViews
        for (let i = 0, length = tablesOrViews.length; i < length; i++) {
            __registerRequiredColumn(tablesOrViews[i], sqlBuilder, requiredColumns, onlyForTablesOrViews)
        }
        const joins = this.__joins
        for (let i = 0, length = joins.length; i < length; i++) {
            const join = joins[i]!
            __registerRequiredColumn(join.__tableOrView, sqlBuilder, requiredColumns, onlyForTablesOrViews)
            __registerRequiredColumn(join.__on, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        }
        __registerRequiredColumn(this.__where, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__having, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        
        const groupBy = this.__groupBy
        for (let i = 0, length = groupBy.length; i < length; i++) {
            __registerRequiredColumn(groupBy[i], sqlBuilder, requiredColumns, onlyForTablesOrViews)
        }
    }

    __buildSelectCount(countAll: AggregateFunctions0ValueSource, params: any[]): string {
        const recursiveSelect = this.__recursiveSelect
        if (recursiveSelect) {
            return recursiveSelect.__buildSelectCount(countAll, params)
        }

        if (this.__distinct || this.__groupBy.length > 0) {
            const data = {...this.__asSelectData()} // Ensure any missing initialization and create a copy of the data
            delete data.__limit
            delete data.__offset

            const withView = new WithViewImpl<any, any>(this.__sqlBuilder, 'result_for_count', data)
            const withs: Array<IWithView<any>> = []
            withView.__addWiths(this.__sqlBuilder, withs)
            
            const selectCountData: PlainSelectData = {
                [isSelectQueryObject]: true,
                __type: 'plain',
                __distinct: false,
                __columns: { '': countAll },
                __oneColumn: true,
                __tablesOrViews: [withView],
                __joins: [],
                __where: undefined,
                __groupBy: [],
                __withs: withs,
                __subSelectUsing: this.__subSelectUsing,
                __requiredTablesOrViews: this.__requiredTablesOrViews
            }
            return this.__sqlBuilder._buildSelect(selectCountData, params)
        }

        this.__asSelectData() // Ensure any missing initialization
        const selectCountData: PlainSelectData = {
            [isSelectQueryObject]: true,
            __type: 'plain',
            __distinct: false,
            __columns: { '': countAll },
            __oneColumn: true,
            __tablesOrViews: this.__tablesOrViews,
            __joins: this.__joins,
            __where: this.__where,
            __groupBy: [],
            __withs: this.__withs,
            __subSelectUsing: this.__subSelectUsing,
            __requiredTablesOrViews: this.__requiredTablesOrViews
        }
        return this.__sqlBuilder._buildSelect(selectCountData, params)
    }

    select(columns: SelectColumns<any, any>): any { // any to avoid deep errors
        this.__finishJoinHaving()
        this.__query = ''
        this.__columns = columns
        this.__registerTableOrViewWithOfColumns(columns, this.__withs)
        return this
    }
    selectOneColumn(column: AnyValueSource): any {
        this.__finishJoinHaving()
        this.__query = ''
        this.__oneColumn = true
        this.__columns = { 'result': column }
        __getValueSourcePrivate(column).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    from(table: ITableOrView<any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        this.__tablesOrViews.push(table)
        __getTableOrViewPrivate(table).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    join(table: ITableOrView<any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'join',
            __tableOrView: table
        }
        __getTableOrViewPrivate(table).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    innerJoin(table: ITableOrView<any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'innerJoin',
            __tableOrView: table
        }
        __getTableOrViewPrivate(table).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    leftJoin(source: OuterJoinSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'leftJoin',
            __tableOrView: source as any
        }
        __getTableOrViewPrivate(source).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    leftOuterJoin(source: OuterJoinSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'leftOuterJoin',
            __tableOrView: source as any
        }
        __getTableOrViewPrivate(source).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    optionalJoin(table: ITableOrView<any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'join',
            __tableOrView: table,
            __optional: true
        }
        this.__hasOptionalJoin = true
        __getTableOrViewPrivate(table).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    optionalInnerJoin(table: ITableOrView<any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'innerJoin',
            __tableOrView: table,
            __optional: true
        }
        this.__hasOptionalJoin = true
        __getTableOrViewPrivate(table).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    optionalLeftJoin(source: OuterJoinSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'leftJoin',
            __tableOrView: source as any,
            __optional: true
        }
        this.__hasOptionalJoin = true
        __getTableOrViewPrivate(source).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    optionalLeftOuterJoin(source: OuterJoinSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'leftOuterJoin',
            __tableOrView: source as any,
            __optional: true
        }
        this.__hasOptionalJoin = true
        __getTableOrViewPrivate(source).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    dynamicOn(): any {
        this.__query = ''
        return this
    }
    on(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): any {
        this.__query = ''
        if (!this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin.__on = asAlwaysIfValueSource(condition)
        __getValueSourcePrivate(condition).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    __finishJoinHaving() {
        if (this.__lastJoin) {
            this.__joins.push(this.__lastJoin)
            this.__lastJoin = undefined
        }
        this.__inHaving = false
    }
    dynamicWhere(): any {
        this.__finishJoinHaving()
        this.__query = ''
        return this
    }
    where(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__where) {
            throw new Error('Illegal state')
        }
        this.__where = asAlwaysIfValueSource(condition)
        __getValueSourcePrivate(condition).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    and(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): any {
        this.__query = ''
        __getValueSourcePrivate(condition).__addWiths(this.__sqlBuilder, this.__withs)
        if (this.__lastJoin) {
            if (this.__lastJoin.__on) {
                this.__lastJoin.__on = this.__lastJoin.__on.and(asAlwaysIfValueSource(condition))
            } else {
                this.__lastJoin.__on = asAlwaysIfValueSource(condition)
            }
            return this
        }
        if (this.__inHaving) {
            if (this.__having) {
                this.__having = this.__having.and(asAlwaysIfValueSource(condition))
            } else {
                this.__having = asAlwaysIfValueSource(condition)
            }
            return this
        }
        if (this.__where) {
            this.__where = this.__where.and(asAlwaysIfValueSource(condition))
        } else {
            this.__where = asAlwaysIfValueSource(condition)
        }
        return this
    }
    or(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): any {
        this.__query = ''
        __getValueSourcePrivate(condition).__addWiths(this.__sqlBuilder, this.__withs)
        if (this.__lastJoin) {
            if (this.__lastJoin.__on) {
                this.__lastJoin.__on = this.__lastJoin.__on.or(asAlwaysIfValueSource(condition))
            } else {
                this.__lastJoin.__on = asAlwaysIfValueSource(condition)
            }
            return this
        }
        if (this.__inHaving) {
            if (this.__having) {
                this.__having = this.__having.or(asAlwaysIfValueSource(condition))
            } else {
                this.__having = asAlwaysIfValueSource(condition)
            }
            return this
        }
        if (this.__where) {
            this.__where = this.__where.or(asAlwaysIfValueSource(condition))
        } else {
            this.__where = asAlwaysIfValueSource(condition)
        }
        return this
    }
    dynamicHaving(): any {
        this.__finishJoinHaving()
        this.__query = ''
        this.__inHaving = true
        return this
    }
    having(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): any {
        this.__finishJoinHaving()
        this.__query = ''
        this.__inHaving = true
        if (this.__having) {
            throw new Error('Illegal state')
        }
        this.__having = asAlwaysIfValueSource(condition)
        __getValueSourcePrivate(condition).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    groupBy(...columns: Array<string| number | symbol | AnyValueSource>): any {
        this.__finishJoinHaving()
        this.__query = ''
        for (let i = 0, length = columns.length; i < length; i++) {
            const column = columns[i]!
            if (isValueSource(column)) {
                this.__groupBy.push(column)
                __addWiths(column, this.__sqlBuilder, this.__withs)
            } else {
                const valueSource = this.__getColumnFromColumnsObject(column)
                if (!valueSource) {
                    throw new Error('The column "' + (column as string) + '" is not part of the select clause')
                }
                this.__groupBy.push(valueSource)
            }
        }
        return this
    }
    __asSelectData(): SelectData & AbstractSelect {
        const recursiveSelect = this.__recursiveSelect
        if (recursiveSelect) {
            return recursiveSelect
        }
        if (this.__hasOptionalJoin && !this.__requiredTablesOrViews) {
            this.__requiredTablesOrViews = this.__generateRequiredTableOrView()
        }
        return this
    }
    __generateRequiredTableOrView(): Set<ITableOrView<any>> {
        const requiredTableOrView = new Set<ITableOrView<any>>()

        this.__registerTableOrViewOfColumns(this.__columns, requiredTableOrView)
        const where = this.__where
        if (where) {
            __getValueSourcePrivate(where).__registerTableOrView(this.__sqlBuilder, requiredTableOrView)
        }
        const groupBy = this.__groupBy
        for (let i = 0, lenght = groupBy.length; i < lenght; i++) {
            const value = groupBy[i]!
            __getValueSourcePrivate(value).__registerTableOrView(this.__sqlBuilder, requiredTableOrView)
        }
        const having = this.__having
        if (having) {
            __getValueSourcePrivate(having).__registerTableOrView(this.__sqlBuilder, requiredTableOrView)
        }

        const joins = this.__joins
        for (let i = 0, lenght = groupBy.length; i < lenght; i++) {
            const join = joins[i]!
            const on = join.__on
            if (!join.__optional && on) {
                __getValueSourcePrivate(on).__registerTableOrView(this.__sqlBuilder, requiredTableOrView)
            }
        }

        const customization = this.__customization
        if (customization) {
            __registerTableOrView(customization.afterSelectKeyword, this.__sqlBuilder,requiredTableOrView)
            __registerTableOrView(customization.beforeColumns, this.__sqlBuilder, requiredTableOrView)
            __registerTableOrView(customization.customWindow, this.__sqlBuilder, requiredTableOrView)
            __registerTableOrView(customization.beforeOrderByItems, this.__sqlBuilder, requiredTableOrView)
            __registerTableOrView(customization.afterOrderByItems, this.__sqlBuilder, requiredTableOrView)
            __registerTableOrView(customization.afterQuery, this.__sqlBuilder, requiredTableOrView)
        }

        let registeredCount = requiredTableOrView.size
        let updatedCount = requiredTableOrView.size

        let whileItearionCount = 0
        do {
            if (whileItearionCount > 1000) {
                throw new Error('Unable to discover all optional joins')
            }
            registeredCount = updatedCount
            for (let i = 0, lenght = joins.length; i < lenght; i++) {
                const join = joins[i]!
                const on = join.__on
                if (join.__optional && on && requiredTableOrView.has(join.__tableOrView)) {
                    __getValueSourcePrivate(on).__registerTableOrView(this.__sqlBuilder, requiredTableOrView)
                }
            }
            updatedCount = requiredTableOrView.size
            whileItearionCount++
        } while (registeredCount !== updatedCount)

        return requiredTableOrView
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        let result = super.__getOldValues(this.__sqlBuilder)
        if (result) {
            return result
        }
        const tablesOrViews = this.__tablesOrViews
        for (let i = 0, length = tablesOrViews.length; i < length; i++) {
            const tableOrView = tablesOrViews[i]!
            result = __getTableOrViewPrivate(tableOrView).__getOldValues(sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        let result = super.__getValuesForInsert(sqlBuilder)
        if (result) {
            return result
        }
        const tablesOrViews = this.__tablesOrViews
        for (let i = 0, length = tablesOrViews.length; i < length; i++) {
            const tableOrView = tablesOrViews[i]!
            result = __getTableOrViewPrivate(tableOrView).__getValuesForInsert(sqlBuilder)
            if (result) {
                return result
            }
        }
        return undefined
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        let result: boolean
        const subSelectUsing = this.__subSelectUsing
        if (subSelectUsing) {
            for (let i = 0, length = subSelectUsing.length; i < length; i++) {
                result = __getTableOrViewPrivate(subSelectUsing[i]!).__isAllowed(sqlBuilder)
                if (!result) {
                    return false
                }
            }
        }
        const tablesOrViews = this.__tablesOrViews
        if (tablesOrViews) {
            for (let i = 0, length = tablesOrViews.length; i < length; i++) {
                result = __getTableOrViewPrivate(tablesOrViews[i]!).__isAllowed(sqlBuilder)
                if (!result) {
                    return false
                }
            }
        }
        const joins = this.__joins
        if (joins) {
            for (let i = 0, length = joins.length; i < length; i++) {
                const join = joins[i]!
                result = __getTableOrViewPrivate(join.__tableOrView).__isAllowed(sqlBuilder)
                if (!result) {
                    return false
                }
                if (join.__on) {
                    result = __getValueSourcePrivate(join.__on).__isAllowed(sqlBuilder)
                    if (!result) {
                        return false
                    }
                }
            }
        }
        if (this.__where) {
            result = __getValueSourcePrivate(this.__where).__isAllowed(sqlBuilder)
            if (!result) {
                return false
            }
        }
        if (this.__having) {
            result = __getValueSourcePrivate(this.__having).__isAllowed(sqlBuilder)
            if (!result) {
                return false
            }
        }
        const groupBy = this.__groupBy
        if (groupBy) {
            for (let i = 0, length = groupBy.length; i < length; i++) {
                result = __getValueSourcePrivate(groupBy[i]!).__isAllowed(sqlBuilder)
                if (!result) {
                    return false
                }
            }
        }
        if (this.__columns) {
            result = isAllowedQueryColumns(this.__columns, sqlBuilder)
            if (!result) {
                return false
            }
        }
        result = __isAllowed(this.__limit, sqlBuilder)
        if (!result) {
            return false
        }
        result = __isAllowed(this.__offset, sqlBuilder)
        if (!result) {
            return false
        }
        if (this.__customization) {
            result = __isAllowed(this.__customization.afterSelectKeyword, sqlBuilder)
            if (!result) {
                return false
            }
            result = __isAllowed(this.__customization.beforeColumns, sqlBuilder)
            if (!result) {
                return false
            }
            result = __isAllowed(this.__customization.customWindow, sqlBuilder)
            if (!result) {
                return false
            }
            result = __isAllowed(this.__customization.beforeOrderByItems, sqlBuilder)
            if (!result) {
                return false
            }
            result = __isAllowed(this.__customization.afterOrderByItems, sqlBuilder)
            if (!result) {
                return false
            }
            result = __isAllowed(this.__customization.afterQuery, sqlBuilder)
            if (!result) {
                return false
            }
        }

        return true
    }
}

export class CompoundSelectQueryBuilder extends AbstractSelect implements ToSql, CompoundSelectData {
    __type: 'compound' = 'compound'
    __firstQuery: SelectData
    __compoundOperator: CompoundOperator
    __secondQuery: SelectData

    constructor(sqlBuilder: SqlBuilder, firstQuery: SelectData, compoundOperator: CompoundOperator, secondQuery: SelectData) {
        super(sqlBuilder)
        this.__firstQuery = firstQuery
        this.__compoundOperator = compoundOperator
        this.__secondQuery = secondQuery
        this.__oneColumn = firstQuery.__oneColumn

        if (firstQuery.__subSelectUsing && secondQuery.__subSelectUsing) {
            const subSelectUsing: Array<ITableOrView<any>> = []
            firstQuery.__subSelectUsing.forEach(value => {
                if (!subSelectUsing.includes(value)) {
                    subSelectUsing.push(value)
                }
            })
            secondQuery.__subSelectUsing.forEach(value => {
                if (!subSelectUsing.includes(value)) {
                    subSelectUsing.push(value)
                }
            })
            this.__subSelectUsing = subSelectUsing
        } else {
            this.__subSelectUsing = firstQuery.__subSelectUsing || secondQuery.__subSelectUsing
            if (this.__subSelectUsing) {
                this.__subSelectUsing = this.__subSelectUsing.concat()
            }
        }

        createColumnsFrom(this.__sqlBuilder, firstQuery.__columns, this.__columns, new View(''))
    }

    __registerRequiredColumnInSelect(sqlBuilder: HasIsValue, requiredColumns: Set<Column>, onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        __registerRequiredColumn(this.__firstQuery, sqlBuilder, requiredColumns, onlyForTablesOrViews)
        __registerRequiredColumn(this.__secondQuery, sqlBuilder, requiredColumns, onlyForTablesOrViews)
    }

    __buildSelectCount(countAll: AggregateFunctions0ValueSource, params: any[]): string {
        const data = {...this.__asSelectData()} // Ensure any missing initialization and create a copy of the data
        delete data.__limit
        delete data.__offset

        const withView = new WithViewImpl<any, any>(this.__sqlBuilder, 'result_for_count', data)
        const withs: Array<IWithView<any>> = []
        withView.__addWiths(this.__sqlBuilder, withs)
        
        const selectCountData: PlainSelectData = {
            [isSelectQueryObject]: true,
            __type: 'plain',
            __distinct: false,
            __columns: { '': countAll },
            __oneColumn: true,
            __tablesOrViews: [withView],
            __joins: [],
            __where: undefined,
            __groupBy: [],
            __withs: withs,
            __subSelectUsing: this.__subSelectUsing
        }
        return this.__sqlBuilder._buildSelect(selectCountData, params)
    }
    __finishJoinHaving(): void {
        // noop: do nothing here
    }
    __asSelectData(): SelectData & AbstractSelect {
        const recursiveSelect = this.__recursiveSelect
        if (recursiveSelect) {
            return recursiveSelect
        }
        return this
    }
    __getOldValues(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return super.__getOldValues(sqlBuilder) || __getOldValues(this.__firstQuery, sqlBuilder) || __getOldValues(this.__secondQuery, sqlBuilder)
    }
    __getValuesForInsert(sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        return super.__getValuesForInsert(sqlBuilder) || __getValuesForInsert(this.__firstQuery, sqlBuilder) || __getValuesForInsert(this.__secondQuery, sqlBuilder)
    }
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        let result: boolean
        const subSelectUsing = this.__subSelectUsing
        if (subSelectUsing) {
            for (let i = 0, length = subSelectUsing.length; i < length; i++) {
                result = __getTableOrViewPrivate(subSelectUsing[i]!).__isAllowed(sqlBuilder)
                if (!result) {
                    return false
                }
            }
        }
        result = __isAllowed(this.__firstQuery, sqlBuilder)
        if (!result) {
            return false
        }
        result = __isAllowed(this.__secondQuery, sqlBuilder)
        if (!result) {
            return false
        }
        result = __isAllowed(this.__limit, sqlBuilder)
        if (!result) {
            return false
        }
        result = __isAllowed(this.__offset, sqlBuilder)
        if (!result) {
            return false
        }
        if (this.__customization) {
            result = __isAllowed(this.__customization.afterSelectKeyword, sqlBuilder)
            if (!result) {
                return false
            }
            result = __isAllowed(this.__customization.beforeColumns, sqlBuilder)
            if (!result) {
                return false
            }
            result = __isAllowed(this.__customization.customWindow, sqlBuilder)
            if (!result) {
                return false
            }
            result = __isAllowed(this.__customization.beforeOrderByItems, sqlBuilder)
            if (!result) {
                return false
            }
            result = __isAllowed(this.__customization.afterOrderByItems, sqlBuilder)
            if (!result) {
                return false
            }
            result = __isAllowed(this.__customization.afterQuery, sqlBuilder)
            if (!result) {
                return false
            }
        }

        return true
    }
}