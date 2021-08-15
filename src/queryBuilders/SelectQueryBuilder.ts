import type { SqlBuilder, JoinData, ToSql, SelectData, CompoundOperator, CompoundSelectData, PlainSelectData } from "../sqlBuilders/SqlBuilder"
import type { SelectExpression, SelectColumns, OrderByMode, SelectExpressionSubquery, ExecutableSelectExpressionWithoutWhere, DynamicWhereExecutableSelectExpression, GroupByOrderByExecutableSelectExpression, OffsetExecutableSelectExpression, CustomizableExecutableSelect, DynamicWhereExpressionWithoutSelect, SelectExpressionFromNoTable, SelectWhereJoinExpression, DynamicOnExpression, OnExpression, SelectExpressionWithoutJoin, SelectWhereExpression, OrderByExecutableSelectExpression, GroupByOrderByHavingExecutableSelectExpression, DynamicHavingExecutableSelectExpression, GroupByOrderHavingByExpressionWithoutSelect, DynamicHavingExpressionWithoutSelect, ICompoundableSelect, CompoundableExecutableSelectExpression, CompoundedExecutableSelectExpression, ExecutableSelect, ComposeExpression, ComposeExpressionDeletingInternalProperty, ComposeExpressionDeletingExternalProperty, WithableExecutableSelect, SelectCustomization } from "../expressions/select"
import { HasAddWiths, ITableOrView, IWithView, OuterJoinSource, __registerTableOrView } from "../utils/ITableOrView"
import type { BooleanValueSource, NumberValueSource, IntValueSource, ValueSource, IfValueSource, IIfValueSource, IBooleanValueSource, INumberValueSource, IIntValueSource, IExecutableSelectQuery } from "../expressions/values"
import type { int } from "ts-extended-types"
import type { WithView } from "../utils/tableOrViewUtils"
import { __addWiths, __getTableOrViewPrivate } from "../utils/ITableOrView"
import { __getValueSourcePrivate } from "../expressions/values"
import ChainedError from "chained-error"
import { AggregateFunctions0ValueSource } from "../internal/ValueSourceImpl"
import { attachSource } from "../utils/attachSource"
import { columnsType, database, requiredTableOrView, resultType, compoundable, type, compoundableColumns } from "../utils/symbols"
import { asValueSource } from "../expressions/values"
import { WithViewImpl } from "../internal/WithViewImpl"
import { createColumnsFrom } from "../internal/ColumnImpl"
import { View } from "../View"

interface Compose {
    type: 'compose'
    config: {
        externalProperty: string,
        internalProperty: string,
        propertyName: string
    }
    deleteInternal: boolean,
    deleteExternal: boolean,
    cardinality?: 'noneOrOne' | 'one' | 'many'
    fn?: (ids: any[]) => Promise<any[]>
}

interface Split {
    type: 'split',
    optional: boolean,
    propertyName: string,
    mapping: { [key: string]: string }
}

interface GuidedSplit {
    type: 'guidedSplit',
    optional: boolean,
    propertyName: string,
    mapping: { [key: string]: string }
}

type SplitCompose = Compose | Split | GuidedSplit

abstract class AbstractSelect implements ToSql, HasAddWiths, IExecutableSelectQuery<any, any, any>, CompoundableExecutableSelectExpression<any, any, any, any, any, any>, CompoundedExecutableSelectExpression<any, any, any, any, any, any>, OrderByExecutableSelectExpression<any,any,any,any, any, any>, OffsetExecutableSelectExpression<any, any, any, any>, CustomizableExecutableSelect<any, any, any, any>, WithableExecutableSelect<any, any, any, any>, ExecutableSelect<any, any, any, any>, ComposeExpression<any, any, any, any, any, any, any>, ComposeExpressionDeletingInternalProperty<any, any, any, any, any, any, any>,  ComposeExpressionDeletingExternalProperty<any, any, any, any, any, any, any> {
    [database]: any
    [requiredTableOrView]: any
    [type]: any
    [compoundable]: any
    [compoundableColumns]: any

    [resultType]: any
    [columnsType]: any

    __sqlBuilder: SqlBuilder

    __columns: { [property: string]: ValueSource<any, any> } = {}
    __orderBy?: { [property: string]: OrderByMode | null | undefined }
    __limit?: int | number | NumberValueSource<any, any> | IntValueSource<any, any>
    __offset?: int | number | NumberValueSource<any, any> | IntValueSource<any, any>
    __withs: Array<IWithView<any>> = []
    __customization?: SelectCustomization<any>

    __oneColumn = false

    // cache
    __query = ''
    __params: any[] = []

    // composition
    __compositions: SplitCompose[] = []
    __lastComposition?: Compose

    __recursiveInternalView?: WithViewImpl<any, any>
    __recursiveView?: WithViewImpl<any, any>
    __recursiveSelect?: SelectData

    __subSelectUsing?: ITableOrView<any>[]

    constructor(sqlBuilder: SqlBuilder) {
        this.__sqlBuilder = sqlBuilder
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
                errorMessage += ' of the column `' + column + '`'
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
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeSelectOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns['result']!
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
            const countAll = new AggregateFunctions0ValueSource('_countAll', 'int', undefined)
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
    orderBy(column: any, mode?: OrderByMode): this {
        this.__finishJoinHaving()
        this.__query = ''
        if (!this.__orderBy) {
            this.__orderBy = {}
        }
        if (column in this.__orderBy) {
            throw new Error('Column ' + column + ' already used in the order by clause')
        }
        if (!(column in this.__columns)) {
            // this can happens because we the column is not included in required columns for a select that picks the columns
            // In this case, we just skip it
            return this
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
    intersect: never
    intersectAll: never
    except: never
    exceptAll: never
    minus: never
    minusAll: never

    __compoundableAsSelectData(select: ICompoundableSelect<any, any, any, any>): SelectData {
        return select as any
    }

    __addWiths(withs: Array<IWithView<any>>): void {
        this.__finishJoinHaving()
        const withViews = this.__withs
        for (let i = 0, length = withViews.length; i < length; i++) {
            const withView = withViews[i]!
            __getTableOrViewPrivate(withView).__addWiths(withs)
        }
    }
    __registerTableOrView(requiredTablesOrViews: Set<ITableOrView<any>>): void {
        const subSelectUsing = this.__subSelectUsing
        if (!subSelectUsing) {
            return
        }
        for (let i = 0, length = subSelectUsing.length; i < length; i++) {
            const tableOrView = subSelectUsing[i]!
            __getTableOrViewPrivate(tableOrView).__registerTableOrView(requiredTablesOrViews)
        }
    }

    abstract __asSelectData(): SelectData
    __toSql(sqlBuilder: SqlBuilder, params: any[]): string {
        this.__finishJoinHaving()
        return sqlBuilder._buildSelect(this.__asSelectData(), params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        this.__finishJoinHaving()
        return sqlBuilder._buildSelect(this.__asSelectData(), params)
    }

    forUseInQueryAs: never

    compose(config: any): any {
        this.__lastComposition = {
            type: 'compose',
            config: config,
            deleteExternal: false,
            deleteInternal: false
        }
        return this
    }
    composeDeletingInternalProperty(config: any): any {
        this.__lastComposition = {
            type: 'compose',
            config: config,
            deleteExternal: false,
            deleteInternal: true
        }
        return this
    }
    composeDeletingExternalProperty(config: any): any {
        this.__lastComposition = {
            type: 'compose',
            config: config,
            deleteExternal: true,
            deleteInternal: false
        }
        return this
    }
    withNoneOrOne(fn: (ids: any[]) => Promise<any[]>): any {
        const last = this.__lastComposition
        if (!last) {
            throw new Error('Illegal state')
        }
        this.__lastComposition = undefined
        last.fn = fn
        last.cardinality = 'noneOrOne'
        this.__compositions.push(last)
        return this
    }
    withOne(fn: (ids: any[]) => Promise<any[]>): any {
        const last = this.__lastComposition
        if (!last) {
            throw new Error('Illegal state')
        }
        this.__lastComposition = undefined
        last.fn = fn
        last.cardinality = 'one'
        this.__compositions.push(last)
        return this
    }
    withMany(fn: (ids: any[]) => Promise<any[]>): any {
        const last = this.__lastComposition
        if (!last) {
            throw new Error('Illegal state')
        }
        this.__lastComposition = undefined
        last.fn = fn
        last.cardinality = 'many'
        this.__compositions.push(last)
        return this
    }
    splitRequired(propertyName: string, mappig: any): any {
        const split: Split = {
            type: 'split',
            optional: false,
            propertyName: propertyName,
            mapping: mappig
        }
        this.__compositions.push(split)
        return this
    }
    splitOptional(propertyName: string, mappig: any): any {
        const split: Split = {
            type: 'split',
            optional: true,
            propertyName: propertyName,
            mapping: mappig
        }
        this.__compositions.push(split)
        return this
    }
    split(propertyName: string, mappig: any): any {
        const split: Split = {
            type: 'split',
            optional: true,
            propertyName: propertyName,
            mapping: mappig
        }
        this.__compositions.push(split)
        return this
    }

    guidedSplitRequired(propertyName: string, mappig: any): any {
        const split: GuidedSplit = {
            type: 'guidedSplit',
            optional: false,
            propertyName: propertyName,
            mapping: mappig
        }
        this.__compositions.push(split)
        return this
    }
    guidedSplitOptional(propertyName: string, mappig: any): any {
        const split: GuidedSplit = {
            type: 'guidedSplit',
            optional: true,
            propertyName: propertyName,
            mapping: mappig
        }
        this.__compositions.push(split)
        return this
    }

    __applyCompositions<R>(result: Promise<R>, source: Error): Promise<R> {
        const compositions = this.__compositions
        if (compositions.length <= 0) {
            return result
        }
        for(let i = 0, length = compositions.length; i < length; i++) {
            const composition = compositions[i]!
            result = result.then(dataResult => {
                try {
                    if (composition.type === 'split') {
                        return this.__applySplit(dataResult, composition)
                    } if (composition.type === 'compose') {
                        return this.__applyComposition(dataResult, composition, source)
                    } else {
                        return this.__applyGuidedSplit(dataResult, composition)
                    }
                } catch (e) {
                    throw attachSource(e, source)
                }
            })
        }
        return result
    }

    __applySplit<R>(dataResult: R, split: Split): R {
        let dataList: any[]
        if (!dataResult) {
            return dataResult
        } else if (Array.isArray(dataResult)) {
            dataList = dataResult
        } else {
            dataList = [dataResult]
        }

        const mapping = split.mapping
        const optional = split.optional
        const propertyName = split.propertyName

        for(let i = 0, length = dataList.length; i < length; i++) {
            const external = dataList[i]
            const result: any = {}
            let hasContent = false
            for (let prop in mapping) {
                const externalProp = mapping[prop]!
                const value = external[externalProp]
                if (value !== null && value !== undefined) {
                    result[prop] = value
                    hasContent = true
                }
                delete external[externalProp]
            }
            if (propertyName in external) {
                throw new Error('The property ' + propertyName + ' already exists in the result of the query')
            }
            if (optional) {
                if (hasContent) {
                    external[propertyName] = result
                }
            } else {
                external[propertyName] = result
            }
        }
        return dataResult
    }
    __applyComposition<R>(dataResult: R, composition: Compose, source: Error): Promise<R> | R {
        const config = composition.config
        const resultProperty = config.propertyName
        const externalProperty = config.externalProperty

        if (!(externalProperty in this.__columns)) {
            // this is the case of a select picking columns and the externalProperty was not picked
            return dataResult
        }

        let dataList: any[]
        if (!dataResult) {
            return dataResult
        } else if (Array.isArray(dataResult)) {
            dataList = dataResult
        } else {
            dataList = [dataResult]
        }

        const dataMap: any = {}
        const ids: any[] = []
        for(let i = 0, length = dataList.length; i < length; i++) {
            const data = dataList[i]
            const externalValue = data[externalProperty]
            dataMap[externalValue] = data
            ids.push(data[externalProperty])
            if (composition.deleteExternal) {
                delete data[externalProperty]
            }
            if (resultProperty in data) {
                throw new Error('The property ' + resultProperty + ' already exists in the result of the external query')
            }
        }

        const fn = composition.fn
        if (!fn) {
            throw new Error('Illegal state')
        }

        return fn(ids).then((internalList) => {
            try {
                this.__processCompositionResult(internalList, dataList, dataMap, composition)
            } catch (e) {
                throw attachSource(e, source)
            }
            return dataResult
        }) 
    }
    __applyGuidedSplit<R>(dataResult: R, split: GuidedSplit): R {
        let dataList: any[]
        if (!dataResult) {
            return dataResult
        } else if (Array.isArray(dataResult)) {
            dataList = dataResult
        } else {
            dataList = [dataResult]
        }

        const mapping = split.mapping
        const optional = split.optional
        const propertyName = split.propertyName

        for(let i = 0, length = dataList.length; i < length; i++) {
            const forcedAsMandatoryProperties = []
            const forcedAsMandatoryMapping = []
            const external = dataList[i]
            const result: any = {}
            let hasContent = false
            for (let prop in mapping) {
                let externalProp = mapping[prop]!
                if (externalProp.endsWith('!')) {
                    externalProp = externalProp.substring(0, externalProp.length - 1)
                    forcedAsMandatoryProperties.push(externalProp)
                    forcedAsMandatoryMapping.push(prop)
                } else if (externalProp.endsWith('?')) {
                    externalProp = externalProp.substring(0, externalProp.length - 1)
                }
                const value = external[externalProp]
                if (value !== null && value !== undefined) {
                    result[prop] = value
                    hasContent = true
                }
                delete external[externalProp]
            }
            if (propertyName in external) {
                throw new Error('The property ' + propertyName + ' already exists in the result of the query')
            }
            if (hasContent || !optional) {
                for(let j = 0, length2 = forcedAsMandatoryProperties.length; j < length2; j++) {
                    const externalProp = forcedAsMandatoryProperties[j]!
                    const prop = forcedAsMandatoryMapping[j]!
                    const value = result[prop]
                    if (value === null || value === undefined) {
                        let errorMessage = 'Expected a value as result of the column `' + externalProp + '` mapped as `' + prop + '` in a `'
                        if (optional) {
                            errorMessage += 'guidedSplitOptional'
                        } else {
                            errorMessage += 'guidedSplitRequired'
                        }
                        errorMessage += '` at index `' + i + '`, but null or undefined value was found'
                        throw new Error(errorMessage)
                    }
                }
            }
            if (optional) {
                if (hasContent) {
                    external[propertyName] = result
                }
            } else {
                external[propertyName] = result
            }
        }
        return dataResult
    }

    __processCompositionResult(internalList: any[], dataList: any[], dataMap: any, composition: Compose): void {
        const config = composition.config
        const resultProperty = config.propertyName
        const internalProperty = config.internalProperty
        
        const cardinality = composition.cardinality
        if (!cardinality) {
            throw new Error('Illegal state')
        }

        if (cardinality === 'one') {
            if (dataList.length !== internalList.length) {
                throw new Error('The internal query in a query composition returned ' + internalList.length + ' rows when ' + dataList.length + ' was expected')
            }
        } else if (cardinality === 'many') {
            for(let i = 0, length = dataList.length; i < length; i++) {
                const data = dataList[i]
                data[resultProperty] = []
            }
        }

        for(let i = 0, length = internalList.length; i < length; i++) {
            const internalData = internalList[i]
            const internalValue = internalData[internalProperty]

            if (composition.deleteInternal) {
                delete internalData[internalProperty]
            }

            const data = dataMap[internalValue]
            if (!data) {
                throw new Error('The internal query in a query composition returned an element identified with ' + internalValue + ' that is not pressent in the external query result')
            }

            if (cardinality === 'many') {
                const resultList = data[resultProperty] as any[]
                resultList.push(internalData)
            } else if (cardinality === 'noneOrOne' || cardinality === 'one') {
                const previous = data[resultProperty]
                if (previous) {
                    throw new Error('The internal query in a query composition retunrned multiple elements for an element identified with ' + internalValue)
                }
                data[resultProperty] = internalData
            } else {
                throw new Error('Illegal state')
            }
        }
    }

    __buildRecursive(fn: (view: any) => ICompoundableSelect<any, any, any, any>, unionAll: boolean): void {
        const sqlBuilder = this.__sqlBuilder
        const name = 'recursive_select_' + sqlBuilder._generateUnique()
        const recursiveInternalView = new WithViewImpl<any, any>(name, this as any, sqlBuilder)
        let recursiveInternalSelect 
        if (unionAll) {
            recursiveInternalSelect = this.unionAll(fn(recursiveInternalView))
        } else {
            recursiveInternalSelect = this.union(fn(recursiveInternalView))
        }
        const recursiveView = new WithViewImpl<any, any>(name, recursiveInternalSelect, sqlBuilder)
        recursiveView.__recursive = true

        const recursiveSelect = new SelectQueryBuilder(this.__sqlBuilder, [recursiveView], false)
        const columns = recursiveSelect.__columns
        const currentColumns = this.__columns
        for (let columnName in currentColumns) {
            columns[columnName] = (recursiveView as any)[columnName]
        }

        this.__recursiveInternalView = recursiveInternalView
        this.__recursiveView = recursiveView
        this.__recursiveSelect = recursiveSelect.__asSelectData() // __asSelectData is important here to detect the required tables
    }
    recursiveUnion(fn: (view: any) => ICompoundableSelect<any, any, any, any>): this {
        this.__buildRecursive(fn, false)
        return this
    }
    recursiveUnionAll(fn: (view: any) => ICompoundableSelect<any, any, any, any>): this {
        this.__buildRecursive(fn, true)
        return this
    }
    __buildRecursiveFn(fn: (view: any) => IBooleanValueSource<any, any>): (view: any) => ICompoundableSelect<any, any, any, any> {
        return (view: any) => {
            const current = this as any as PlainSelectData
            const result = new SelectQueryBuilder(this.__sqlBuilder, current.__tablesOrViews, false)
            result.__columns = { ...current.__columns }
            result.__withs = current.__withs.concat()
            result.__joins = current.__joins.concat()
            result.join(view).on(fn(view))
            return result as any
        }
    }
    recursiveUnionOn(fn: (view: any) => IBooleanValueSource<any, any>): this {
        this.__buildRecursive(this.__buildRecursiveFn(fn), false)
        return this
    }
    recursiveUnionAllOn(fn: (view: any) => IBooleanValueSource<any, any>): this {
        this.__buildRecursive(this.__buildRecursiveFn(fn), true)
        return this
    }

    customizeQuery(customization: SelectCustomization<any>): this {
        this.__customization = customization
        __addWiths(customization.afterSelectKeyword, this.__withs)
        __addWiths(customization.beforeColumns, this.__withs)
        __addWiths(customization.customWindow, this.__withs)
        __addWiths(customization.afterQuery, this.__withs)
        return this
    }
}

// Defined separated to don't have problems with the variable definition of this method
(AbstractSelect.prototype as any).forUseInQueryAs = function (as: string): WithView<any, any> {
    const thiz = this as SelectQueryBuilder
    const recursiveView = thiz.__recursiveView
    if (recursiveView) {
        recursiveView.__name = as
        this.__recursiveInternalView!.__name = as
        this.__recursiveView = undefined
        this.__recursiveInternalView = undefined
        this.__recursiveSelect = undefined
        return recursiveView as any
    }
    return new WithViewImpl<any, any>(as, thiz, thiz.__sqlBuilder) as any
};

(AbstractSelect.prototype as any).intersect = function(select: ICompoundableSelect<any, any, any, any>): any {
    const thiz = this as SelectQueryBuilder
    const result = new CompoundSelectQueryBuilder(thiz.__sqlBuilder, thiz.__asSelectData(), 'intersect', thiz.__compoundableAsSelectData(select))
    thiz.__combineSubSelectUsing(select, result)
    return result
};

(AbstractSelect.prototype as any).intersectAll = function(select: ICompoundableSelect<any, any, any, any>): any {
    const thiz = this as SelectQueryBuilder
    const result = new CompoundSelectQueryBuilder(thiz.__sqlBuilder, thiz.__asSelectData(), 'intersectAll', thiz.__compoundableAsSelectData(select))
    thiz.__combineSubSelectUsing(select, result)
    return result
};

(AbstractSelect.prototype as any).except = function(select: ICompoundableSelect<any, any, any, any>): any {
    const thiz = this as SelectQueryBuilder
    const result = new CompoundSelectQueryBuilder(thiz.__sqlBuilder, thiz.__asSelectData(), 'except', thiz.__compoundableAsSelectData(select))
    thiz.__combineSubSelectUsing(select, result)
    return result
};

(AbstractSelect.prototype as any).exceptAll = function(select: ICompoundableSelect<any, any, any, any>): any {
    const thiz = this as SelectQueryBuilder
    const result = new CompoundSelectQueryBuilder(thiz.__sqlBuilder, thiz.__asSelectData(), 'exceptAll', thiz.__compoundableAsSelectData(select))
    thiz.__combineSubSelectUsing(select, result)
    return result
};

(AbstractSelect.prototype as any).minus = function(select: ICompoundableSelect<any, any, any, any>): any {
    const thiz = this as SelectQueryBuilder
    const result = new CompoundSelectQueryBuilder(thiz.__sqlBuilder, thiz.__asSelectData(), 'minus', thiz.__compoundableAsSelectData(select))
    thiz.__combineSubSelectUsing(select, result)
    return result
};

(AbstractSelect.prototype as any).minusAll = function(select: ICompoundableSelect<any, any, any, any>): any {
    const thiz = this as SelectQueryBuilder
    const result = new CompoundSelectQueryBuilder(thiz.__sqlBuilder, thiz.__asSelectData(), 'minusAll', thiz.__compoundableAsSelectData(select))
    thiz.__combineSubSelectUsing(select, result)
    return result
};

export class SelectQueryBuilder extends AbstractSelect implements ToSql, PlainSelectData, SelectExpression<any, any, any>, SelectExpressionFromNoTable<any>, ExecutableSelectExpressionWithoutWhere<any, any, any, any, any, any>, DynamicWhereExecutableSelectExpression<any, any, any, any, any, any>, DynamicWhereExpressionWithoutSelect<any, any, any>, GroupByOrderByExecutableSelectExpression<any, any, any, any, any, any>, SelectWhereJoinExpression<any, any, any>, DynamicOnExpression<any, any, any>, OnExpression<any, any, any>, SelectExpressionWithoutJoin<any, any, any>, SelectExpressionSubquery<any, any>, SelectWhereExpression<any, any, any>, GroupByOrderByHavingExecutableSelectExpression<any, any, any, any, any, any>, DynamicHavingExecutableSelectExpression<any, any, any, any, any, any>, GroupByOrderHavingByExpressionWithoutSelect<any, any, any>, DynamicHavingExpressionWithoutSelect<any, any, any> {
    __type: 'plain' = 'plain'
    __distinct: boolean
    __tablesOrViews: Array<ITableOrView<any>>
    __joins: Array<JoinData> = []
    __where?: BooleanValueSource<any, any> | IfValueSource<any, any>
    __having?: BooleanValueSource<any, any> | IfValueSource<any, any>
    __groupBy:  Array<ValueSource<any, any>> = []
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
            __getTableOrViewPrivate(table).__addWiths(this.__withs)
        }
    }

    __buildSelectCount(countAll: AggregateFunctions0ValueSource, params: any[]): string {
        if (this.groupBy.length > 0) {
            const withView = new WithViewImpl<any, any>('result_for_count', this, this.__sqlBuilder)
            const withs: Array<IWithView<any>> = []
            withView.__addWiths(withs)
            
            const selectCountData: PlainSelectData = {
                __type: 'plain',
                __distinct: false,
                __columns: { '': countAll },
                __tablesOrViews: [withView],
                __joins: [],
                __where: undefined,
                __groupBy: [],
                __withs: withs
            }
            return this.__sqlBuilder._buildSelect(selectCountData, params)
        }

        const selectCountData: PlainSelectData = {
            __type: 'plain',
            __distinct: false,
            __columns: { '': countAll },
            __tablesOrViews: this.__tablesOrViews,
            __joins: this.__joins,
            __where: this.__where,
            __groupBy: [],
            __withs: this.__withs
        }
        return this.__sqlBuilder._buildSelect(selectCountData, params)
    }

    select(columns: SelectColumns<any, any>): any { // any to avoid deep errors
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
        this.__tablesOrViews.push(table)
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
            __tableOrView: table
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
            __tableOrView: table
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
            __tableOrView: source as any
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
            __tableOrView: source as any
        }
        __getTableOrViewPrivate(source).__addWiths(this.__withs)
        return this
    }
    optionalJoin(table: ITableOrView<any>): this {
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
        __getTableOrViewPrivate(table).__addWiths(this.__withs)
        return this
    }
    optionalInnerJoin(table: ITableOrView<any>): this {
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
        __getTableOrViewPrivate(table).__addWiths(this.__withs)
        return this
    }
    optionalLeftJoin(source: OuterJoinSource<any, any>): this {
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
        __getTableOrViewPrivate(source).__addWiths(this.__withs)
        return this
    }
    optionalLeftOuterJoin(source: OuterJoinSource<any, any>): this {
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
    __asSelectData(): SelectData {
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

        const columns = this.__columns
        for (const property in columns) {
            const column = columns[property]!
            __getValueSourcePrivate(column).__registerTableOrView(requiredTableOrView)
        }
        const where = this.__where
        if (where) {
            __getValueSourcePrivate(where).__registerTableOrView(requiredTableOrView)
        }
        const groupBy = this.__groupBy
        for (let i = 0, lenght = groupBy.length; i < lenght; i++) {
            const value = groupBy[i]!
            __getValueSourcePrivate(value).__registerTableOrView(requiredTableOrView)
        }
        const having = this.__having
        if (having) {
            __getValueSourcePrivate(having).__registerTableOrView(requiredTableOrView)
        }

        const joins = this.__joins
        for (let i = 0, lenght = groupBy.length; i < lenght; i++) {
            const join = joins[i]!
            const on = join.__on
            if (!join.__optional && on) {
                __getValueSourcePrivate(on).__registerTableOrView(requiredTableOrView)
            }
        }

        const customization = this.__customization
        if (customization) {
            __registerTableOrView(customization.afterSelectKeyword, requiredTableOrView)
            __registerTableOrView(customization.beforeColumns, requiredTableOrView)
            __registerTableOrView(customization.customWindow, requiredTableOrView)
            __registerTableOrView(customization.afterQuery, requiredTableOrView)
        }

        const registeredCount = requiredTableOrView.size
        let updatedCount = requiredTableOrView.size
        do {
            for (let i = 0, lenght = joins.length; i < lenght; i++) {
                const join = joins[i]!
                const on = join.__on
                if (join.__optional && on && requiredTableOrView.has(join.__tableOrView)) {
                    __getValueSourcePrivate(on).__registerTableOrView(requiredTableOrView)
                }
            }
            updatedCount = requiredTableOrView.size
        } while (registeredCount !== updatedCount)

        return requiredTableOrView
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

        createColumnsFrom(firstQuery.__columns, this.__columns, sqlBuilder, new View(''))
    }

    __buildSelectCount(countAll: AggregateFunctions0ValueSource, params: any[]): string {
        const withView = new WithViewImpl<any, any>('result_for_count', this, this.__sqlBuilder)
        const withs: Array<IWithView<any>> = []
        withView.__addWiths(withs)
        
        const selectCountData: PlainSelectData = {
            __type: 'plain',
            __distinct: false,
            __columns: { '': countAll },
            __tablesOrViews: [withView],
            __joins: [],
            __where: undefined,
            __groupBy: [],
            __withs: withs
        }
        return this.__sqlBuilder._buildSelect(selectCountData, params)
    }
    __finishJoinHaving(): void {
        // noop: do nothing here
    }
    __asSelectData(): SelectData {
        const recursiveSelect = this.__recursiveSelect
        if (recursiveSelect) {
            return recursiveSelect
        }
        return this
    }

}