import type { SqlBuilder, InsertData, SelectData } from "../sqlBuilders/SqlBuilder"
import type{ ITable, IWithView } from "../utils/ITableOrView"
import type { InsertExpression, ExecutableInsertExpression, ExecutableInsert, ExecutableInsertReturning, ExecutableMultipleInsert, ExecutableInsertFromSelect/*, MissingKeysInsertExpression*/ } from "../expressions/insert"
import type { Column } from "../utils/Column"
import { __getColumnOfTable, __getColumnPrivate } from "../utils/Column"
import ChainedError from "chained-error"
import { attachSource } from "../utils/attachSource"
import { database, tableOrView } from "../utils/symbols"
import { IExecutableSelectQuery } from "../expressions/values"
import { __addWiths } from "../utils/ITableOrView"

// one implement ommited intentionally to don't confuse TypeScript

export class InsertQueryBuilder implements InsertExpression<any>, ExecutableInsertReturning<any, any>, ExecutableInsert<any>, ExecutableInsertExpression<any>, ExecutableMultipleInsert<any>, ExecutableInsertFromSelect<any>, /*MissingKeysInsertExpression<any, any>,*/ InsertData {
    [database]: any
    [tableOrView]: any
    __sqlBuilder: SqlBuilder

    __table: ITable<any>
    __sets: { [property: string]: any } = {}
    __multiple?: { [property: string]: any }[]
    __isMultiple: boolean = false
    __idColumn?: Column
    __from?: SelectData
    __withs: Array<IWithView<any>> = []

    // cache
    __query = ''
    __params: any[] = []

    constructor(sqlBuilder: SqlBuilder, table: ITable<any>) {
        this.__sqlBuilder = sqlBuilder
        this.__table = table
    }

    executeInsert(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            const idColumn = this.__idColumn
            const multiple = this.__multiple
            if (multiple && multiple.length <= 0) {
                if (idColumn) {
                    return this.__sqlBuilder._queryRunner.createResolvedPromise([])
                } else {
                    return this.__sqlBuilder._queryRunner.createResolvedPromise(0)
                }
            } else if (!idColumn) {
                return this.__sqlBuilder._queryRunner.executeInsert(this.__query, this.__params).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else if (!multiple) {
                return this.__sqlBuilder._queryRunner.executeInsertReturningLastInsertedId(this.__query, this.__params).then((value) => {
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
                return this.__sqlBuilder._queryRunner.executeInsertReturningMultipleLastInsertedId(this.__query, this.__params).then((rows) => {
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
    from(select: IExecutableSelectQuery<any, any, any>): this {
        this.__from = select as any as SelectData
        __addWiths(select, this.__withs)
        return this
    }
    defaultValues: never
    returningLastInsertedId: never
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

const DEFAULT_VALUES = {}
