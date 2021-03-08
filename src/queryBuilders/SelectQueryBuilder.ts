import type { SqlBuilder, JoinData, ToSql, SelectData } from "../sqlBuilders/SqlBuilder"
import type { SelectExpression, SelectColumns, OrderByMode, SelectExpressionSubquery, ExecutableSelectExpressionWithoutWhere, DynamicWhereExecutableSelectExpression, GroupByOrderByExecutableSelectExpression, OffsetExecutableSelectExpression, ExecutableSelect, DynamicWhereExpressionWithoutSelect, SelectExpressionFromNoTable, SelectWhereJoinExpression, DynamicOnExpression, OnExpression, SelectExpressionWithoutJoin, SelectWhereExpression, OrderByExecutableSelectExpression, GroupByOrderByHavingExecutableSelectExpression, DynamicHavingExecutableSelectExpression, GroupByOrderHavingByExpressionWithoutSelect, DynamicHavingExpressionWithoutSelect, ExecutableSelectWithoutGroupBy, OffsetExecutableSelectExpressionWithoutGroupBy, OrderByExecutableSelectExpressionWithoutGroupBy } from "../expressions/select"
import type { HasAddWiths, ITableOrView, IWithView, OuterJoinSource } from "../utils/ITableOrView"
import type { BooleanValueSource, NumberValueSource, IntValueSource, ValueSource, IfValueSource, IIfValueSource, IBooleanValueSource, INumberValueSource, IIntValueSource } from "../expressions/values"
import type { int } from "ts-extended-types"
import type { WithView } from "../utils/tableOrViewUtils"
import { __addWiths, __getTableOrViewPrivate } from "../utils/ITableOrView"
import { __getValueSourcePrivate } from "../expressions/values"
import ChainedError from "chained-error"
import { AggregateFunctions0ValueSource } from "../internal/ValueSourceImpl"
import { attachSource } from "../utils/attachSource"
import { columnsType, database, requiredTableOrView, resultType, type } from "../utils/symbols"
import { asValueSource } from "../expressions/values"
import { WithViewImpl } from "../internal/WithViewImpl"

export class SelectQueryBuilder implements ToSql, HasAddWiths, SelectData, SelectExpression<any, any, any>, SelectExpressionFromNoTable<any>, ExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, DynamicWhereExecutableSelectExpression<any, any, any, any, any, any>, DynamicWhereExpressionWithoutSelect<any, any, any>, GroupByOrderByExecutableSelectExpression<any, any, any, any, any, any>, OffsetExecutableSelectExpression<any, any, any, any>, ExecutableSelect<any, any, any, any>, SelectWhereJoinExpression<any, any, any>, DynamicOnExpression<any, any, any>, OnExpression<any, any, any>, SelectExpressionWithoutJoin<any, any, any>, SelectExpressionSubquery<any, any>, SelectWhereExpression<any, any, any>, OrderByExecutableSelectExpression<any,any,any,any, any, any>, GroupByOrderByHavingExecutableSelectExpression<any, any, any, any, any, any>, DynamicHavingExecutableSelectExpression<any, any, any, any, any, any>, GroupByOrderHavingByExpressionWithoutSelect<any, any, any>, DynamicHavingExpressionWithoutSelect<any, any, any>, ExecutableSelectWithoutGroupBy<any, any, any, any>, OffsetExecutableSelectExpressionWithoutGroupBy<any, any, any, any>, OrderByExecutableSelectExpressionWithoutGroupBy<any, any, any, any, any, any> {
    [database]: any
    [requiredTableOrView]: any
    [type]: 'ExecutableSelect'
    [resultType]: any
    [columnsType]: any
    __sqlBuilder: SqlBuilder

    __distinct: boolean
    __columns: { [property: string]: ValueSource<any, any> } = {}
    __tables_or_views: Array<ITableOrView<any>>
    __joins: Array<JoinData> = []
    __where?: BooleanValueSource<any, any> | IfValueSource<any, any>
    __having?: BooleanValueSource<any, any> | IfValueSource<any, any>
    __groupBy:  Array<ValueSource<any, any>> = []
    __orderBy?: { [property: string]: OrderByMode | null | undefined }
    __limit?: int | number | NumberValueSource<any, any> | IntValueSource<any, any>
    __offset?: int | number | NumberValueSource<any, any> | IntValueSource<any, any>
    __withs: Array<IWithView<any>> = []

    __lastJoin?: JoinData
    __inHaving = false
    __oneColumn = false

    // cache
    __query = ''
    __params: any[] = []

    constructor(sqlBuilder: SqlBuilder, tables: Array<ITableOrView<any>>, distinct: boolean) {
        this.__sqlBuilder = sqlBuilder
        this.__tables_or_views = tables
        this.__distinct = distinct
        for (let i = 0, length = tables.length; i < length; i++) {
            const table = tables[i]!
            __getTableOrViewPrivate(table).__addWiths(this.__withs)
        }
    }

    __transformValueFromDB(valueSource: ValueSource<any, any>, value: any, column?: string, index?: number, count?: boolean) {
        const valueSourcePrivate = __getValueSourcePrivate(valueSource)
        const typeAdapter = valueSourcePrivate.__typeAdapter
        let result
        if (typeAdapter) {
            result = typeAdapter.transformValueFromDB(value, valueSourcePrivate.__valueType, this.__sqlBuilder._defaultTypeAdapter)
        } else {
            result = this.__sqlBuilder._defaultTypeAdapter.transformValueFromDB(value, valueSourcePrivate.__valueType)
        }
        if (result !== null && result !== undefined) {
            return result
        }
        if (!valueSourcePrivate.__isResultOptional(this.__sqlBuilder)) {
            let errorMessage = 'Expected a value as result'
            if (column !== undefined) {
                errorMessage += ' of the column `' + column
            }
            if (index !== undefined) {
                errorMessage += ' at index `' + index + '`'
            }
            if (count) {
                errorMessage += ' of the count number of rows query'
            }
            errorMessage += ', but null or undefined value was found'
            throw new Error(errorMessage)
        }
        return result
    }

    __transformRow(row: any, index?: number): any {
        const columns = this.__columns
        const result: any = {}
        for (let prop in columns) {
            const valueSource = columns[prop]!
            let value = row[prop]
            const transformed = this.__transformValueFromDB(valueSource, value, prop, index)
            if (transformed !== undefined && transformed !== null) {
                result[prop] = transformed
            }
        }
        return result
    }

    executeSelectNoneOrOne(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            if (this.__oneColumn) {
                return this.__sqlBuilder._queryRunner.executeSelectOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns['result']!
                    if (value === undefined) {
                        return null
                    }
                    return this.__transformValueFromDB(valueSource, value)
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                return this.__sqlBuilder._queryRunner.executeSelectOneRow(this.__query, this.__params).then((row) => {
                    if (row) {
                        return this.__transformRow(row)
                    } else {
                        return null
                    }
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    executeSelectOne(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            if (this.__oneColumn) {
                return this.__sqlBuilder._queryRunner.executeSelectOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns['result']!
                    if (value === undefined) {
                        throw new Error('No result returned by the database')
                    }
                    return this.__transformValueFromDB(valueSource, value)
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                return this.__sqlBuilder._queryRunner.executeSelectOneRow(this.__query, this.__params).then((row) => {
                    if (row) {
                        return this.__transformRow(row)
                    } else {
                        throw new Error('No result returned by the database')
                    }
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    executeSelectMany(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            if (this.__oneColumn) {
                return this.__sqlBuilder._queryRunner.executeSelectOneColumnManyRows(this.__query, this.__params).then((values) => {
                    const valueSource = this.__columns['result']!

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
                return this.__sqlBuilder._queryRunner.executeSelectManyRows(this.__query, this.__params).then((rows) => {
                    return rows.map((row, index) => {
                        return this.__transformRow(row, index)
                    })
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    __executeSelectCount(source: Error): Promise<any> {
        try {
            const countAll = new AggregateFunctions0ValueSource('_countAll', 'int', undefined)
            const selectCountData: SelectData = {
                __distinct: false,
                __columns: { '': countAll },
                __tables_or_views: this.__tables_or_views,
                __joins: this.__joins,
                __where: this.__where,
                __groupBy: [],
                __withs: this.__withs
            }
            const params: any[] = []
            const query = this.__sqlBuilder._buildSelect(selectCountData, params)

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
        let dataPromise
        if (extras && extras.data) {
            dataPromise = this.__sqlBuilder._queryRunner.createResolvedPromise(extras.data)
        } else {
            dataPromise = this.executeSelectMany()
        }
        const source = new Error('Query executed at')
        return dataPromise.then((data) => {
            if (extras && (extras.count !== undefined && extras.count !== null)) {
                return {...extras, data, count: extras.count}
            } else {
                return this.__executeSelectCount(source).then((count) => {
                    return {...extras, data, count}
                })
            }
        })
    }
    query(): string {
        this.__finishJoinHaving()
        if (this.__query) {
            return this.__query
        }
        try {
            this.__query = this.__sqlBuilder._buildSelect(this, this.__params)
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

    select(columns: SelectColumns<any, any>): this {
        this.__finishJoinHaving()
        this.__query = ''
        this.__columns = columns

        const withs = this.__withs
        for (const property in columns) {
            const column = columns[property]!
            __getValueSourcePrivate(column).__addWiths(withs)
        }
        return this
    }
    selectOneColumn(column: ValueSource<any, any>): this {
        this.__finishJoinHaving()
        this.__query = ''
        this.__oneColumn = true
        this.__columns = { 'result': column }
        __getValueSourcePrivate(column).__addWiths(this.__withs)
        return this
    }
    from(table: ITableOrView<any>): this {
        this.__finishJoinHaving()
        this.__query = ''
        this.__tables_or_views.push(table)
        __getTableOrViewPrivate(table).__addWiths(this.__withs)
        return this
    }
    join(table: ITableOrView<any>): this {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'join',
            __table_or_view: table
        }
        __getTableOrViewPrivate(table).__addWiths(this.__withs)
        return this
    }
    innerJoin(table: ITableOrView<any>): this {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'innerJoin',
            __table_or_view: table
        }
        __getTableOrViewPrivate(table).__addWiths(this.__withs)
        return this
    }
    leftJoin(source: OuterJoinSource<any, any>): this {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'leftJoin',
            __table_or_view: source as any
        }
        __getTableOrViewPrivate(source).__addWiths(this.__withs)
        return this
    }
    leftOuterJoin(source: OuterJoinSource<any, any>): this {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin = {
            __joinType: 'leftOuterJoin',
            __table_or_view: source as any
        }
        __getTableOrViewPrivate(source).__addWiths(this.__withs)
        return this
    }
    dynamicOn(): this {
        this.__query = ''
        return this
    }
    on(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
        this.__query = ''
        if (!this.__lastJoin) {
            throw new Error('Illegal state')
        }
        this.__lastJoin.__on = asValueSource(condition)
        this.__joins.push(this.__lastJoin)
        this.__lastJoin = undefined
        __getValueSourcePrivate(condition).__addWiths(this.__withs)
        return this
    }
    __finishJoinHaving() {
        if (this.__lastJoin) {
            this.__joins.push(this.__lastJoin)
            this.__lastJoin = undefined
        }
        this.__inHaving = false
    }
    dynamicWhere(): this {
        this.__finishJoinHaving()
        this.__query = ''
        return this
    }
    where(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
        this.__finishJoinHaving()
        this.__query = ''
        if (this.__where) {
            throw new Error('Illegal state')
        }
        this.__where = asValueSource(condition)
        __getValueSourcePrivate(condition).__addWiths(this.__withs)
        return this
    }
    and(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
        this.__query = ''
        __getValueSourcePrivate(condition).__addWiths(this.__withs)
        if (this.__lastJoin) {
            if (this.__lastJoin.__on) {
                this.__lastJoin.__on = this.__lastJoin.__on.and(condition)
            } else {
                this.__lastJoin.__on = asValueSource(condition)
            }
            return this
        }
        if (this.__inHaving) {
            if (this.__having) {
                this.__having = this.__having.and(condition)
            } else {
                this.__having = asValueSource(condition)
            }
            return this
        }
        this.__finishJoinHaving()
        if (this.__where) {
            this.__where = this.__where.and(condition)
        } else {
            this.__where = asValueSource(condition)
        }
        return this
    }
    or(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
        this.__query = ''
        __getValueSourcePrivate(condition).__addWiths(this.__withs)
        if (this.__lastJoin) {
            if (this.__lastJoin.__on) {
                this.__lastJoin.__on = this.__lastJoin.__on.or(condition)
            } else {
                this.__lastJoin.__on = asValueSource(condition)
            }
            return this
        }
        if (this.__inHaving) {
            if (this.__having) {
                this.__having = this.__having.or(condition)
            } else {
                this.__having = asValueSource(condition)
            }
            return this
        }
        if (this.__where) {
            this.__where = this.__where.or(condition)
        } else {
            this.__where = asValueSource(condition)
        }
        return this
    }
    dynamicHaving(): this {
        this.__finishJoinHaving()
        this.__query = ''
        this.__inHaving = true
        return this
    }
    having(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
        this.__finishJoinHaving()
        this.__query = ''
        this.__inHaving = true
        if (this.__having) {
            throw new Error('Illegal state')
        }
        this.__having = asValueSource(condition)
        __getValueSourcePrivate(condition).__addWiths(this.__withs)
        return this
    }
    groupBy(...columns: Array<string| number | symbol | ValueSource<any, any>>): this {
        this.__finishJoinHaving()
        this.__query = ''
        for (let i = 0, length = columns.length; i < length; i++) {
            const column = columns[i]
            if (!column || typeof column !== 'object') {
                const valueSource = this.__columns[column as string]
                if (!valueSource) {
                    throw new Error('The column "' + (column as string) + '" is not part of the select clause')
                }
                this.__groupBy.push(valueSource)
            } else {
                this.__groupBy.push(column)
                __addWiths(column, this.__withs)
            }
        }
        return this
    }
    orderBy(column: any, mode?: OrderByMode): this {
        this.__finishJoinHaving()
        this.__query = ''
        if (!this.__orderBy) {
            this.__orderBy = {}
        }
        if (column in this.__orderBy) {
            throw new Error('Column ' + column + ' already used in the order by clause')
        }
        this.__orderBy[column] = mode || null
        return this
    }
    orderByFromString(orderBy: string): this {
        this.__finishJoinHaving()
        this.__query = ''
        const columnsInQuery: { [columnNameInLowerCase: string]: string | undefined } = {}
        const columns = this.__columns
        for (const property in columns) {
            columnsInQuery[property.toLowerCase()] = property
        }

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
            const realColumnName = columnsInQuery[column]
            if (!realColumnName) {
                throw new Error('The column "' + column + '" is not part of the select clause')
            }
            if (ordering === 'asc') {
                this.orderBy(realColumnName, 'asc')
            } else if (ordering === 'desc') {
                this.orderBy(realColumnName, 'desc')
            } else if (ordering === 'asc nulls first') {
                this.orderBy(realColumnName, 'asc nulls first')
            } else if (ordering === 'desc nulls first') {
                this.orderBy(realColumnName, 'desc nulls first')
            } else if (ordering === 'asc nulls last') {
                this.orderBy(realColumnName, 'asc nulls last')
            } else if (ordering === 'desc nulls last') {
                this.orderBy(realColumnName, 'desc nulls last')
            } else if (ordering === 'insensitive') {
                this.orderBy(realColumnName, 'insensitive')
            } else if (ordering === 'asc insensitive') {
                this.orderBy(realColumnName, 'asc insensitive')
            } else if (ordering === 'desc insensitive') {
                this.orderBy(realColumnName, 'desc insensitive')
            } else if (ordering === 'asc nulls first insensitive') {
                this.orderBy(realColumnName, 'asc nulls first insensitive')
            } else if (ordering === 'desc nulls first insensitive') {
                this.orderBy(realColumnName, 'desc nulls first insensitive')
            } else if (ordering === 'asc nulls last insensitive') {
                this.orderBy(realColumnName, 'asc nulls last insensitive')
            } else if (ordering === 'desc nulls last insensitive') {
                this.orderBy(realColumnName, 'desc nulls last insensitive')
            } else if (!ordering) {
                this.orderBy(realColumnName)
            } else {
                throw new Error('Unknow ordering clause "' + ordering + '" in the order by related to the column "' + column + '"')
            }
        }
        return this
    }
    limit(limit: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>): this {
        this.__finishJoinHaving()
        this.__query = ''
        this.__limit = asValueSource(limit)
        __addWiths(limit, this.__withs)
        return this
    }
    offset(offset: int | number | INumberValueSource<any, any> | IIntValueSource<any, any>): this {
        this.__finishJoinHaving()
        this.__query = ''
        this.__offset = asValueSource(offset)
        __addWiths(offset, this.__withs)
        return this
    }

    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        this.__finishJoinHaving()
        return sqlBuilder._buildSelect(this, params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        this.__finishJoinHaving()
        return sqlBuilder._buildSelect(this, params)
    }

    __addWiths(withs: Array<IWithView<any>>): void {
        this.__finishJoinHaving()
        const withViews = this.__withs
        for (let i = 0, length = withViews.length; i < length; i++) {
            const withView = withViews[i]!
            __getTableOrViewPrivate(withView).__addWiths(withs)
        }
    }
    forUseInQueryAs: never
}

// Defined separated to don't have problems with the variable definition of this method
(SelectQueryBuilder.prototype as any).forUseInQueryAs = function (as: string):  WithView<any, any> {
    const thiz = this as SelectQueryBuilder
    return new WithViewImpl<any, any>(as, thiz, thiz.__sqlBuilder) as any
};
