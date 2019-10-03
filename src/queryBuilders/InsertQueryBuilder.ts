import { SqlBuilder, InsertData } from "../sqlBuilders/SqlBuilder"
import { ITable } from "../utils/ITableOrView"
import { InsertExpression, ExecutableInsertExpression, ExecutableInsert, ExecutableInsertReturning } from "../expressions/insert"
import ChainedError from "chained-error"
import { __getColumnOfTable, Column, __getColumnPrivate } from "../utils/Column"
import { attachSource } from "../utils/attachSource"

export class InsertQueryBuilder extends InsertExpression<any, any> implements ExecutableInsertReturning<any, any>, ExecutableInsert<any, any>, ExecutableInsertExpression<any, any>, InsertData {
    __sqlBuilder: SqlBuilder

    __table: ITable<any>
    __sets: { [property: string]: any } = {}
    __idColumn?: Column

    // cache
    __query = ''
    __params: any[] = []

    constructor(sqlBuilder: SqlBuilder, table: ITable<any>) {
        super()
        this.__sqlBuilder = sqlBuilder
        this.__table = table
    }

    executeInsert(): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        try {
            const idColumn = this.__idColumn
            if (idColumn) {
                return this.__sqlBuilder._queryRunner.executeInsertReturningLastInsertedId(this.__query, this.__params).then((value) => {
                    if (value === undefined) {
                        value = null
                    }
                    const idColumnPrivate = __getColumnPrivate(idColumn)
                    const typeAdapter = idColumnPrivate.__typeAdapter
                    if (typeAdapter) {
                        return typeAdapter.transformValueFromDB(value, idColumnPrivate.__columnType, this.__sqlBuilder._defaultTypeAdapter)
                    } else {
                        return this.__sqlBuilder._defaultTypeAdapter.transformValueFromDB(value, idColumnPrivate.__columnType)
                    }
                }).catch((e) => {
                    throw attachSource(new ChainedError(e), source)
                })
            } else {
                return this.__sqlBuilder._queryRunner.executeInsert(this.__query, this.__params).catch((e) => {
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
            if (this.__sets === DEFAULT_VALUES) {
                this.__query = this.__sqlBuilder._buildInsertDefaultValues(this, this.__params)
                return this.__query
            }

            this.__query = this.__sqlBuilder._buildInsert(this, this.__params)
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
            const property = properties[i]
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
            const property = properties[i]
            const value = columns[property]
            if (value === null || value === undefined) {
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
            const property = properties[i]
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
            const property = properties[i]
            if (!(property in sets)) {
                continue
            }
            const value = columns[property]
            if (value === null || value === undefined) {
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
            const property = properties[i]
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
            const property = properties[i]
            if (property in sets) {
                continue
            }
            const value = columns[property]
            if (value === null || value === undefined) {
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
