import type { SqlBuilder, InsertData, SelectData } from "../sqlBuilders/SqlBuilder"
import{ ITable, IWithView, __getTableOrViewPrivate } from "../utils/ITableOrView"
import type { InsertExpression, ExecutableInsertExpression, ExecutableInsert, ExecutableInsertReturning, CustomizableExecutableMultipleInsert, CustomizableExecutableInsertFromSelect,/*, MissingKeysInsertExpression*/ InsertCustomization, CustomizableExecutableInsertReturning, CustomiableExecutableInsert, ComposableExecutableInsert, ComposeExpression, ComposeExpressionDeletingInternalProperty, ComposeExpressionDeletingExternalProperty, ComposableCustomizableExecutableInsert, ExecutableInsertReturningLastInsertedId, InsertColumns } from "../expressions/insert"
import type { Column } from "../utils/Column"
import { __getColumnOfTable, __getColumnPrivate } from "../utils/Column"
import ChainedError from "chained-error"
import { attachSource } from "../utils/attachSource"
import { database, tableOrView } from "../utils/symbols"
import { IExecutableSelectQuery, IValueSource, __getValueSourcePrivate } from "../expressions/values"
import { __addWiths } from "../utils/ITableOrView"
import { ComposeSplitQueryBuilder } from "./ComposeSliptQueryBuilder"

// one implement ommited intentionally to don't confuse TypeScript

export class InsertQueryBuilder extends ComposeSplitQueryBuilder implements InsertExpression<any>, ExecutableInsertReturningLastInsertedId<any, any>, ExecutableInsert<any>, ExecutableInsertExpression<any>, CustomizableExecutableMultipleInsert<any>, CustomizableExecutableInsertFromSelect<any>, CustomizableExecutableInsertReturning<any, any>, CustomiableExecutableInsert<any>, /*MissingKeysInsertExpression<any, any>,*/ InsertData, ComposableExecutableInsert<any, any, any>, ComposeExpression<any, any, any, any, any, any>, ComposeExpressionDeletingInternalProperty<any, any, any, any, any, any>, ComposeExpressionDeletingExternalProperty<any, any, any, any, any, any>, ComposableCustomizableExecutableInsert<any, any, any>, ExecutableInsertReturning<any, any, any> {
    [database]: any
    [tableOrView]: any

    __table: ITable<any>
    __sets: { [property: string]: any } = {}
    __multiple?: { [property: string]: any }[]
    __isMultiple: boolean = false
    __idColumn?: Column
    __from?: SelectData
    __withs: Array<IWithView<any>> = []
    __customization?: InsertCustomization<any>
    __columns?: { [property: string]: IValueSource<any, any> }

    __oneColumn?: boolean

    // cache
    __query = ''
    __params: any[] = []

    constructor(sqlBuilder: SqlBuilder, table: ITable<any>) {
        super(sqlBuilder)
        this.__table = table
        __getTableOrViewPrivate(table).__addWiths(this.__withs)
    }

    executeInsert(min?: number, max?: number): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            const idColumn = this.__idColumn
            const multiple = this.__multiple
            let result
            let returningLastInsertedId = !idColumn
            if (multiple && multiple.length <= 0) {
                if (idColumn) {
                    return this.__sqlBuilder._queryRunner.createResolvedPromise([])
                } else {
                    return this.__sqlBuilder._queryRunner.createResolvedPromise(0)
                }
            } else if (!idColumn) {
                result = this.__sqlBuilder._queryRunner.executeInsert(this.__query, this.__params).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else if (!multiple && !this.__from) {
                result = this.__sqlBuilder._queryRunner.executeInsertReturningLastInsertedId(this.__query, this.__params).then((value) => {
                    if (value === undefined) {
                        value = null
                    }
                    const idColumnPrivate = __getColumnPrivate(idColumn)
                    const typeAdapter = idColumnPrivate.__typeAdapter
                    let result
                    if (typeAdapter) {
                        result = typeAdapter.transformValueFromDB(value, idColumnPrivate.__valueType, this.__sqlBuilder._defaultTypeAdapter)
                    } else {
                        result = this.__sqlBuilder._defaultTypeAdapter.transformValueFromDB(value, idColumnPrivate.__valueType)
                    }
                    if (result === null || result === undefined) {
                        if (!idColumnPrivate.__isResultOptional(this.__sqlBuilder)) {
                            throw new Error('Expected a value as result of the insert returning last inserted id, but null or undefined value was found')
                        }
                    }
                    if (this.__isMultiple) {
                        return [result]
                    } else {
                        return result
                    }
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                result = this.__sqlBuilder._queryRunner.executeInsertReturningMultipleLastInsertedId(this.__query, this.__params).then((rows) => {
                    const idColumnPrivate = __getColumnPrivate(idColumn)
                    const typeAdapter = idColumnPrivate.__typeAdapter
                    const columnType = idColumnPrivate.__valueType
                    const defaultTypeAdapter = this.__sqlBuilder._defaultTypeAdapter
                    if (typeAdapter) {
                        return rows.map((row, index) => {
                            const result = typeAdapter.transformValueFromDB(row, columnType, defaultTypeAdapter)
                            if (result === null || result === undefined) {
                                if (!idColumnPrivate.__isResultOptional(this.__sqlBuilder)) {
                                    throw new Error('Expected a value as result of the insert returning last inserted id, but null or undefined value was found at index ' + index)
                                }
                            }
                            return result
                        })
                    } else {
                        return rows.map((row, index) => {
                            const result = defaultTypeAdapter.transformValueFromDB(row, columnType)
                            if (result === null || result === undefined) {
                                if (!idColumnPrivate.__isResultOptional(this.__sqlBuilder)) {
                                    throw new Error('Expected a value as result of the insert returning last inserted id, but null or undefined value was found at index ' + index)
                                }
                            }
                            return result
                        })
                    }
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            }
            if (min !== undefined) {
                result = result.then((result: any) => {
                    let count: number
                    if (Array.isArray(result)) {
                        count = result.length
                    } else if (returningLastInsertedId) {
                        if (result === null || result === undefined) {
                            count = 0
                        } else {
                            count = 1
                        }
                    } else {
                        count = result
                    }
                    if (count < min) {
                        throw attachSource(new Error("The insert operation didn't insert the minimum of " + min + " row(s)"), source)
                    }
                    if (max !== undefined && count > max) {
                        throw attachSource(new Error("The insert operation insert more that the maximum of " + max + " row(s)"), source)
                    }
                    return result
                })
            }
            return result
        } catch (e) {
            throw new ChainedError(e)
        }
    }
    executeInsertNoneOrOne(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeInsertReturningOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns!['result']!
                    if (value === undefined) {
                        return null
                    }
                    return this.__transformValueFromDB(valueSource, value)
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                result = this.__sqlBuilder._queryRunner.executeInsertReturningOneRow(this.__query, this.__params).then((row) => {
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
    executeInsertOne(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeInsertReturningOneColumnOneRow(this.__query, this.__params).then((value) => {
                    const valueSource = this.__columns!['result']!
                    if (value === undefined) {
                        throw new Error('No result returned by the database')
                    }
                    return this.__transformValueFromDB(valueSource, value)
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                result = this.__sqlBuilder._queryRunner.executeInsertReturningOneRow(this.__query, this.__params).then((row) => {
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
    executeInsertMany(min?: number, max?: number): Promise<any> {
        const source = new Error('Query executed at')
        this.query()
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeInsertReturningOneColumnManyRows(this.__query, this.__params).then((values) => {
                    const valueSource = this.__columns!['result']!

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
                result = this.__sqlBuilder._queryRunner.executeInsertReturningManyRows(this.__query, this.__params).then((rows) => {
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
                        throw attachSource(new Error("The insert operation didn't insert the minimum of " + min + " row(s)"), source)
                    }
                    if (max !== undefined && count > max) {
                        throw attachSource(new Error("The insert operation insert more that the maximum of " + max + " row(s)"), source)
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
            if (this.__from) {
                this.__query = this.__sqlBuilder._buildInsertFromSelect(this, this.__params)
            } else if (this.__multiple) {
                this.__query = this.__sqlBuilder._buildInsertMultiple(this, this.__params)
            } else if (this.__sets === DEFAULT_VALUES) {
                this.__query = this.__sqlBuilder._buildInsertDefaultValues(this, this.__params)
            } else {
                this.__query = this.__sqlBuilder._buildInsert(this, this.__params)
            }
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

    dynamicSet(): any {
        this.__query = ''
        return this
    }
    set(columns: any): this {
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

    values(columns: any): this {
        if (Array.isArray(columns)) {
            this.__isMultiple = true
            if (columns.length == 1) {
                return this.set(columns[0])
            }
            this.__multiple = columns
            return this
        } else {
            return this.set(columns)
        }
    }
    from(select: IExecutableSelectQuery<any, any, any, any>): this {
        this.__from = select as any as SelectData
        __addWiths(select, this.__withs)
        return this
    }

    customizeQuery(customization: InsertCustomization<any>): this {
        this.__customization = customization
        __addWiths(customization.afterInsertKeyword, this.__withs)
        __addWiths(customization.afterQuery, this.__withs)
        return this
    }

    // @ts-ignore
    defaultValues: never
    // @ts-ignore
    returningLastInsertedId: never

    // @ts-ignore
    returning: any
    // @ts-ignore
    returningOneColumn: any
}

// Defined separated to don't have problems with the variable definition of this method
(InsertQueryBuilder.prototype as any).defaultValues = function () {
    const thiz = this as InsertQueryBuilder
    thiz.__query = ''
    thiz.__sets = DEFAULT_VALUES
    return thiz
};

(InsertQueryBuilder.prototype as any).returningLastInsertedId = function () {
    const thiz = this as InsertQueryBuilder
    thiz.__query = ''
    const table = thiz.__table
    for (var columnName in table) {
        const column = __getColumnOfTable(table, columnName)
        if (!column) {
            continue
        }
        const columnPrivate = __getColumnPrivate(column)
        if (!columnPrivate.__isAutogeneratedPrimaryKey) {
            continue
        }
        if (thiz.__idColumn) {
            throw new Error('In order to call executeInsertReturningLastInsertedId method the table must have defined only one autogenerated primary key column')
        }
        thiz.__idColumn = column
    }
    if (!thiz.__idColumn) {
        throw new Error('In order to call executeInsertReturningLastInsertedId method the table must have defined one autogenerated primary key column')
    }
    return thiz
};

(InsertQueryBuilder.prototype as any).returning = function (columns: InsertColumns<any>): any {
    const thiz = this as InsertQueryBuilder
    thiz.__query = ''
    thiz.__columns = columns

    const withs = thiz.__withs
    for (const property in columns) {
        const column = columns[property]!
        __getValueSourcePrivate(column).__addWiths(withs)
    }
    return thiz
};

(InsertQueryBuilder.prototype as any).returningOneColumn = function (column: IValueSource<any, any>): any {
    const thiz = this as InsertQueryBuilder
    thiz.__query = ''
    thiz.__oneColumn = true
    thiz.__columns = { 'result': column }
    __getValueSourcePrivate(column).__addWiths(thiz.__withs)
    return thiz
};

const DEFAULT_VALUES = {}
