import type { JoinData, QueryColumns, SqlBuilder, ToSql, UpdateData } from "../sqlBuilders/SqlBuilder"
import { HasAddWiths, HasIsValue, ITable, ITableOrView, IWithView, OuterJoinSource, __getTableOrViewPrivate } from "../utils/ITableOrView"
import { AlwaysIfValueSource, AnyValueSource, IBooleanValueSource, IIfValueSource, isValueSource } from "../expressions/values"
import type { UpdateExpression, ExecutableUpdate, ExecutableUpdateExpression, DynamicExecutableUpdateExpression, UpdateExpressionAllowingNoWhere, NotExecutableUpdateExpression, CustomizableExecutableUpdate, UpdateCustomization, ComposableExecutableUpdate, ComposeExpression, ComposeExpressionDeletingInternalProperty, ComposeExpressionDeletingExternalProperty, ComposableCustomizableExecutableUpdate, ReturnableExecutableUpdate, ExecutableUpdateReturning, UpdateColumns, UpdateSetExpression, UpdateSetExpressionAllowingNoWhere, UpdateSetJoinExpression, DynamicOnExpression, OnExpression, UpdateExpressionWithoutJoin, UpdateFromExpression, UpdateSetJoinExpressionAllowingNoWhere, DynamicOnExpressionAllowingNoWhere, OnExpressionAllowingNoWhere, UpdateExpressionWithoutJoinAllowingNoWhere, UpdateFromExpressionAllowingNoWhere } from "../expressions/update"
import type { int } from "ts-extended-types"
import ChainedError from "chained-error"
import { attachSource } from "../utils/attachSource"
import { database, resultType, tableOrView, type } from "../utils/symbols"
import { asAlwaysIfValueSource } from "../expressions/values"
import { __addWiths } from "../utils/ITableOrView"
import { __getValueSourcePrivate } from "../expressions/values"
import { ComposeSplitQueryBuilder } from "./ComposeSliptQueryBuilder"
import { Column } from "../utils/Column"

export class UpdateQueryBuilder extends ComposeSplitQueryBuilder implements HasAddWiths, ToSql, UpdateExpression<any, any>, UpdateExpressionAllowingNoWhere<any, any>, ExecutableUpdate<any>, CustomizableExecutableUpdate<any>, ExecutableUpdateExpression<any, any>, NotExecutableUpdateExpression<any, any>, DynamicExecutableUpdateExpression<any, any>, UpdateData, ComposableExecutableUpdate<any, any, any>, ComposeExpression<any, any, any, any, any, any>, ComposeExpressionDeletingInternalProperty<any, any, any, any, any, any>, ComposeExpressionDeletingExternalProperty<any, any, any, any, any, any>, ComposableCustomizableExecutableUpdate<any, any, any>, ReturnableExecutableUpdate<any, any>, ExecutableUpdateReturning<any, any, any>, UpdateSetExpression<any, any>, UpdateSetExpressionAllowingNoWhere<any, any>, UpdateSetJoinExpression<any, any>, DynamicOnExpression<any, any>, OnExpression<any, any>, UpdateExpressionWithoutJoin<any, any>, UpdateFromExpression<any, any>, UpdateSetJoinExpressionAllowingNoWhere<any, any>, DynamicOnExpressionAllowingNoWhere<any, any>, OnExpressionAllowingNoWhere<any, any>, UpdateExpressionWithoutJoinAllowingNoWhere<any, any>, UpdateFromExpressionAllowingNoWhere<any, any> {
    [type]: any
    [database]: any
    [tableOrView]: any
    [resultType]: any

    __table: ITable<any>
    __sets: { [property: string] : any} = {}
    __where?: AlwaysIfValueSource<any, any>
    __allowNoWhere: boolean
    __withs: Array<IWithView<any>> = []
    __customization?: UpdateCustomization<any>
    __columns?: QueryColumns
    __oldValues?: ITableOrView<any>
    __froms?: Array<ITableOrView<any>>
    __joins?: Array<JoinData>

    __oneColumn?: boolean
    __lastJoin?: JoinData

    // cache
    __params: any[] = []
    __query = ''

    constructor(sqlBuilder: SqlBuilder, table: ITable<any>, allowNoWhere: boolean) {
        super(sqlBuilder)
        this.__table = table
        __getTableOrViewPrivate(table).__addWiths(sqlBuilder, this.__withs)
        this.__allowNoWhere = allowNoWhere
    }

    executeUpdate(min?: number, max?: number): Promise<int> & Promise<number> {
        this.query()
        const source = new Error('Query executed at')
        try {
            if (Object.getOwnPropertyNames(this.__sets).length <= 0) {
                // Nothing to update, nothing to set
                return this.__sqlBuilder._queryRunner.createResolvedPromise(0) as Promise<int>
            }

            let result = this.__sqlBuilder._queryRunner.executeUpdate(this.__query, this.__params).catch((e) => {
                throw attachSource(new ChainedError(e), source)
            }) as Promise<int>
            
            if (min !== undefined) {
                result = result.then((count) => {
                    if (count < min) {
                        throw attachSource(new Error("The update operation didn't update the minimum of " + min + " row(s)"), source)
                    }
                    if (max !== undefined && count > max) {
                        throw attachSource(new Error("The update operation updated more that the maximum of " + max + " row(s)"), source)
                    }
                    return count
                })
            }
            return result
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    executeUpdateNoneOrOne(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            if (Object.getOwnPropertyNames(this.__sets).length <= 0) {
                // Nothing to update, nothing to set
                return this.__sqlBuilder._queryRunner.createResolvedPromise(null)
            }

            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeUpdateReturningOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns!['result']!
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
                result = this.__sqlBuilder._queryRunner.executeUpdateReturningOneRow(this.__query, this.__params).then((row) => {
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
    executeUpdateOne(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            if (Object.getOwnPropertyNames(this.__sets).length <= 0) {
                // Nothing to update, nothing to set
                return this.__sqlBuilder._queryRunner.createResolvedPromise(null).then(() => {
                    throw attachSource(new Error('No values to update due no sets'), source)
                })
            }
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeUpdateReturningOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns!['result']!
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
                result = this.__sqlBuilder._queryRunner.executeUpdateReturningOneRow(this.__query, this.__params).then((row) => {
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
    executeUpdateMany(min?: number, max?: number): Promise<any> {
        const source = new Error('Query executed at')
        this.query()
        try {
            if (Object.getOwnPropertyNames(this.__sets).length <= 0) {
                // Nothing to update, nothing to set
                return this.__sqlBuilder._queryRunner.createResolvedPromise([])
            }

            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeUpdateReturningOneColumnManyRows(this.__query, this.__params).then((values) => {
                    const valueSource = this.__columns!['result']!
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
                result = this.__sqlBuilder._queryRunner.executeUpdateReturningManyRows(this.__query, this.__params).then((rows) => {
                    return rows.map((row, index) => {
                        return this.__transformRow(row, index)
                    })
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }

            if (min !== undefined) {
                result = result.then((rows) => {
                    const count = rows.length
                    if (count < min) {
                        throw attachSource(new Error("The update operation didn't update the minimum of " + min + " row(s)"), source)
                    }
                    if (max !== undefined && count > max) {
                        throw attachSource(new Error("The update operation updated more that the maximum of " + max + " row(s)"), source)
                    }
                    return rows
                })
            }
            return this.__applyCompositions(result, source)
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    query(): string {
        if (this.__query) {
            return this.__query
        }
        try {
            this.__query = this.__sqlBuilder._buildUpdate(this, this.__params)
        } catch (e) {
            throw new ChainedError(e)
        }
        return this.__query
    }
    params(): any[] {
        if (!this.__query) {
            this.query()
        }
        return this.__params
    }

    __toSql(_sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__sqlBuilder._buildUpdate(this, params)
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__toSql(sqlBuilder, params)
    }

    dynamicSet(): this {
        this.__finishJoin()
        this.__query = ''
        return this
    }
    set(columns: any): this {
        this.__finishJoin()
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            const value = columns[property]
            sets[property] = value
            __addWiths(this.__sqlBuilder, value, this.__withs)
        }
        return this
    }
    setIfValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            const value = columns[property]
            if (!this.__sqlBuilder._isValue(value)) {
                continue
            }
            sets[property] = value
        }
        return this
    }
    setIfSet(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (!(property in sets)) {
                continue
            }
            const value = columns[property]
            sets[property] = value
            __addWiths(this.__sqlBuilder, value, this.__withs)
        }
        return this
    }
    setIfSetIfValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (!(property in sets)) {
                continue
            }
            const value = columns[property]
            if (!this.__sqlBuilder._isValue(value)) {
                continue
            }
            sets[property] = value
        }
        return this
    }
    setIfNotSet(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (property in sets) {
                continue
            }
            const value = columns[property]
            sets[property] = value
            __addWiths(this.__sqlBuilder, value, this.__withs)
        }
        return this
    }
    setIfNotSetIfValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (property in sets) {
                continue
            }
            const value = columns[property]
            if (!this.__sqlBuilder._isValue(value)) {
                continue
            }
            sets[property] = value
        }
        return this
    }
    ignoreIfSet(...columns: any[]): this {
        this.__query = ''
        let sets = this.__sets
        for (let i = 0, length = columns.length; i < length; i++) {
            let column = columns[i]
            delete sets[column]
        }
        return this
    }

    setIfHasValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (!this.__sqlBuilder._isValue(sets[property])) {
                continue
            }
            const value = columns[property]
            sets[property] = value
        }
        return this
    }
    setIfHasValueIfValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (!this.__sqlBuilder._isValue(sets[property])) {
                continue
            }
            const value = columns[property]
            if (!this.__sqlBuilder._isValue(value)) {
                continue
            }
            sets[property] = value
        }
        return this
    }
    setIfHasNoValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (this.__sqlBuilder._isValue(sets[property])) {
                continue
            }
            const value = columns[property]
            sets[property] = value
        }
        return this
    }
    setIfHasNoValueIfValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (this.__sqlBuilder._isValue(sets[property])) {
                continue
            }
            const value = columns[property]
            if (!this.__sqlBuilder._isValue(value)) {
                continue
            }
            sets[property] = value
        }
        return this
    }
    ignoreIfHasValue(...columns: any[]): this {
        this.__query = ''
        let sets = this.__sets
        for (let i = 0, length = columns.length; i < length; i++) {
            let column = columns[i]
            if (!this.__sqlBuilder._isValue(sets[column])) {
                continue
            }
            delete sets[column]
        }
        return this
    }
    ignoreIfHasNoValue(...columns: any[]): this {
        this.__query = ''
        let sets = this.__sets
        for (let i = 0, length = columns.length; i < length; i++) {
            let column = columns[i]
            if (this.__sqlBuilder._isValue(sets[column])) {
                continue
            }
            delete sets[column]
        }
        return this
    }
    ignoreAnySetWithNoValue(): this {
        this.__query = ''
        let sets = this.__sets
        const properties = Object.getOwnPropertyNames(sets)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (this.__sqlBuilder._isValue(sets[property])) {
                continue
            }
            delete sets[property]
        }
        return this
    }

    dynamicWhere(): this {
        this.__query = ''
        return this
    }
    where(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
        this.__query = ''
        if (this.__where) {
            throw new Error('Illegal state')
        }
        this.__where = asAlwaysIfValueSource(condition)
        __getValueSourcePrivate(condition).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    and(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
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
        if (this.__where) {
            this.__where = this.__where.and(asAlwaysIfValueSource(condition))
        } else {
            this.__where = asAlwaysIfValueSource(condition)
        }
        return this
    }
    or(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
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
        if (this.__where) {
            this.__where = this.__where.or(asAlwaysIfValueSource(condition))
        } else {
            this.__where = asAlwaysIfValueSource(condition)
        }
        return this
    }

    

    from(table: ITableOrView<any>): any {
        this.__finishJoin()
        this.__query = ''
        if (!this.__froms) {
            this.__froms = []
        }
        this.__froms.push(table)
        __getTableOrViewPrivate(table).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    join(table: ITableOrView<any>): any {
        this.__finishJoin()
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
        this.__finishJoin()
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
        this.__finishJoin()
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
        this.__finishJoin()
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
        if (!this.__joins) {
            this.__joins = []
        }
        this.__joins.push(this.__lastJoin)
        this.__lastJoin = undefined
        __getValueSourcePrivate(condition).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }
    __finishJoin() {
        if (this.__lastJoin) {
            if (!this.__joins) {
                this.__joins = []
            }
            this.__joins.push(this.__lastJoin)
            this.__lastJoin = undefined
        }
    }



    customizeQuery(customization: UpdateCustomization<any>): this {
        this.__customization = customization
        __addWiths(customization.afterUpdateKeyword, this.__sqlBuilder, this.__withs)
        __addWiths(customization.afterQuery, this.__sqlBuilder, this.__withs)
        return this
    }

    returning(columns: UpdateColumns<any, any>): this {
        this.__query = ''
        this.__columns = columns
        this.__registerTableOrViewWithOfColumns(columns, this.__withs)
        this.__oldValues = this.__getOldValueOfColumns(columns)
        return this
    }
    
    returningOneColumn(column: AnyValueSource): this {
        this.__query = ''
        this.__oneColumn = true
        this.__columns = { 'result': column }
        const columnPrivate = __getValueSourcePrivate(column)
        columnPrivate.__addWiths(this.__sqlBuilder, this.__withs)
        this.__oldValues = columnPrivate.__getOldValues(this.__sqlBuilder)
        return this
    }

    __addWiths(sqlBuilder: HasIsValue, withs: Array<IWithView<any>>): void {
        const withViews = this.__withs
        for (let i = 0, length = withViews.length; i < length; i++) {
            const withView = withViews[i]!
            __getTableOrViewPrivate(withView).__addWiths(sqlBuilder, withs)
        }
    }
    __registerTableOrView(_sqlBuilder: HasIsValue, _requiredTablesOrViews: Set<ITableOrView<any>>): void {
        // do nothing because it is not possible to add external dependency
    }
    __registerRequiredColumn(_sqlBuilder: HasIsValue, _requiredColumns: Set<Column>, _onlyForTablesOrViews: Set<ITableOrView<any>>): void {
        // do nothing because it is not possible to add external dependency
    }
    __getOldValues(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        // old values fake table is not possible to be used here
        return undefined
    }
    __getValuesForInsert(_sqlBuilder: HasIsValue): ITableOrView<any> | undefined {
        // values for insert fake table is not possible to be used here
        return undefined
    }
}