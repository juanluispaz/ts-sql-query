import { SqlBuilder, InsertData, SelectData, ToSql, isAllowedQueryColumns } from "../sqlBuilders/SqlBuilder"
import{ HasAddWiths, HasIsValue, ITable, ITableOrView, IWithView, __getTableOrViewPrivate, __isAllowed } from "../utils/ITableOrView"
import type { InsertExpression, ExecutableInsertExpression, ExecutableInsert, ExecutableInsertReturning, CustomizableExecutableMultipleInsert, CustomizableExecutableInsertFromSelect,/*MissingKeysInsertExpression, ShapedMissingKeysInsertExpression, MissingKeysMultipleInsertExpression, ShapedMissingKeysMultipleInsertExpression*/ InsertCustomization, CustomizableExecutableInsertReturningLastInsertedId, CustomizableExecutableSimpleInsert, ComposableExecutableInsert, ComposeExpression, ComposeExpressionDeletingInternalProperty, ComposeExpressionDeletingExternalProperty, ComposableCustomizableExecutableInsert, ExecutableInsertReturningLastInsertedId, InsertColumns, CustomizableExecutableInsert, OnConflictDoMultipleInsert, InsertOnConflictSetsExpression, DynamicOnConflictWhereExpression, OnConflictOnColumnWhere, CustomizableExecutableInsertFromSelectOnConflict, CustomizableExecutableSimpleInsertOnConflict, OnConflictDoSimpleInsert, CustomizableExecutableMultipleInsertOnConfict, CustomizableExecutableInsertFromSelectOnConflictOptional, CustomizableExecutableSimpleInsertOnConflictOptional, CustomizableExecutableMultipleInsertOnConfictOptional, ExecutableMultipleInsertExpression, ShapedExecutableInsertExpression, ShapedExecutableMultipleInsertExpression, ShapedInsertExpression, ShapedInsertOnConflictSetsExpression, ComposableCustomizableExecutableInsertProjectableAsNullable, ComposableCustomizableExecutableInsertOptionalProjectableAsNullable } from "../expressions/insert"
import { Column, isColumn } from "../utils/Column"
import { __getColumnOfObject, __getColumnPrivate } from "../utils/Column"
import ChainedError from "chained-error"
import { attachSource } from "../utils/attachSource"
import { database, resultType, tableOrView, type } from "../utils/symbols"
import { AlwaysIfValueSource, AnyValueSource, asAlwaysIfValueSource, IBooleanValueSource, IExecutableSelectQuery, IIfValueSource, IStringValueSource, isValueSource, __getValueSourcePrivate } from "../expressions/values"
import { __addWiths } from "../utils/ITableOrView"
import { ComposeSplitQueryBuilder, __setQueryMetadata } from "./ComposeSliptQueryBuilder"
import { RawFragment } from "../utils/RawFragment"

// one implement ommited intentionally to don't confuse TypeScript

export class InsertQueryBuilder extends ComposeSplitQueryBuilder implements HasAddWiths, ToSql, InsertExpression<any>, ShapedInsertExpression<any, any, any>, ExecutableInsertReturningLastInsertedId<any, any>, ExecutableInsert<any>, ExecutableInsertExpression<any>, ShapedExecutableInsertExpression<any, any>, ExecutableMultipleInsertExpression<any>, ShapedExecutableMultipleInsertExpression<any, any>, CustomizableExecutableMultipleInsert<any, any>, CustomizableExecutableInsertFromSelect<any, any>, CustomizableExecutableInsertReturningLastInsertedId<any, any>, CustomizableExecutableSimpleInsert<any, any>, /*MissingKeysInsertExpression<any, any>, ShapedMissingKeysInsertExpression<any, any, any>, MissingKeysMultipleInsertExpression<any, any>, ShapedMissingKeysMultipleInsertExpression<any, any, any>,*/ InsertData, ComposableExecutableInsert<any, any, any>, ComposeExpression<any, any, any, any, any, any>, ComposeExpressionDeletingInternalProperty<any, any, any, any, any, any>, ComposeExpressionDeletingExternalProperty<any, any, any, any, any, any>, ComposableCustomizableExecutableInsert<any, any, any>, ExecutableInsertReturning<any, any, any>, ExecutableInsert<any>, CustomizableExecutableInsert<any>, OnConflictDoMultipleInsert<any, any>, InsertOnConflictSetsExpression<any, any, any>, ShapedInsertOnConflictSetsExpression<any, any, any, any>, DynamicOnConflictWhereExpression<any, any>, OnConflictOnColumnWhere<any, any>, CustomizableExecutableInsertFromSelectOnConflict<any>, CustomizableExecutableSimpleInsertOnConflict<any>, OnConflictDoSimpleInsert<any, any>, CustomizableExecutableMultipleInsertOnConfict<any>, CustomizableExecutableInsertFromSelectOnConflictOptional<any>, CustomizableExecutableSimpleInsertOnConflictOptional<any>, CustomizableExecutableMultipleInsertOnConfictOptional<any>, ComposableCustomizableExecutableInsertProjectableAsNullable<any, any>, ComposableCustomizableExecutableInsertOptionalProjectableAsNullable<any, any> {
    [type]: any
    [database]: any
    [tableOrView]: any
    [resultType]: any

    __table: ITable<any>
    __shape?: { [property: string] : string }
    __sets: { [property: string]: any } = {}
    __multiple?: { [property: string]: any }[]
    __multipleAlreadyCopied?: boolean
    __isMultiple: boolean = false
    __idColumn?: Column
    __from?: SelectData
    __withs: Array<IWithView<any>> = []
    __customization?: InsertCustomization<any>
    //__columns?: QueryColumns // declared at ComposeSplitQueryBuilder
    __onConflictOnConstraint?: string | IStringValueSource<any, any> | RawFragment<any>
    __onConflictOnColumns?: AnyValueSource[]
    __onConflictOnColumnsWhere?: AlwaysIfValueSource<any, any>
    __onConflictDoNothing?: boolean
    __onConflictUpdateShape?: { [property: string] : string }
    __onConflictUpdateSets?: { [property: string]: any }
    __onConflictUpdateWhere?: AlwaysIfValueSource<any, any>
    __valuesForInsert?: ITableOrView<any>

    __oneColumn?: boolean

    // cache
    __query = ''
    __params: any[] = []

    constructor(sqlBuilder: SqlBuilder, table: ITable<any>) {
        super(sqlBuilder)
        this.__table = table
        __getTableOrViewPrivate(table).__addWiths(this.__sqlBuilder, this.__withs)
    }

    executeInsert(min?: number, max?: number): Promise<any> {
        this.query()
        const source = new Error('Query executed at')
        __setQueryMetadata(source, this.__params, this.__customization)
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
                        result = typeAdapter.transformValueFromDB(value, idColumnPrivate.__valueTypeName, this.__sqlBuilder._defaultTypeAdapter)
                    } else {
                        result = this.__sqlBuilder._defaultTypeAdapter.transformValueFromDB(value, idColumnPrivate.__valueTypeName)
                    }
                    if (!this.onConflictDoNothing && (result === null || result === undefined)) {
                        throw new Error('Expected a value as result of the insert returning last inserted id, but null or undefined value was found')
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
                    const columnTypeName = idColumnPrivate.__valueTypeName
                    const defaultTypeAdapter = this.__sqlBuilder._defaultTypeAdapter
                    if (typeAdapter) {
                        return rows.map((row, index) => {
                            const result = typeAdapter.transformValueFromDB(row, columnTypeName, defaultTypeAdapter)
                            if (result === null || result === undefined) {
                                throw new Error('Expected a value as result of the insert returning last inserted id, but null or undefined value was found at index ' + index)
                            }
                            return result
                        })
                    } else {
                        return rows.map((row, index) => {
                            const result = defaultTypeAdapter.transformValueFromDB(row, columnTypeName)
                            if (result === null || result === undefined) {
                                throw new Error('Expected a value as result of the insert returning last inserted id, but null or undefined value was found at index ' + index)
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
        __setQueryMetadata(source, this.__params, this.__customization)
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeInsertReturningOneColumnOneRow(this.__query, this.__params).then((value) => {
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
        __setQueryMetadata(source, this.__params, this.__customization)
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeInsertReturningOneColumnOneRow(this.__query, this.__params).then((value) => {
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
        __setQueryMetadata(source, this.__params, this.__customization)
        try {
            this.__sqlBuilder._resetUnique()
            let result
            if (this.__oneColumn) {
                result = this.__sqlBuilder._queryRunner.executeInsertReturningOneColumnManyRows(this.__query, this.__params).then((values) => {
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

    __toSql(_sqlBuilder: SqlBuilder, params: any[]): string {
        if (this.__from) {
            return this.__sqlBuilder._buildInsertFromSelect(this, params)
        } else if (this.__multiple) {
            return this.__sqlBuilder._buildInsertMultiple(this, params)
        } else if (this.__sets === DEFAULT_VALUES) {
            return this.__sqlBuilder._buildInsertDefaultValues(this, params)
        } else {
            return this.__sqlBuilder._buildInsert(this, params)
        }
    }
    __toSqlForCondition(sqlBuilder: SqlBuilder, params: any[]): string {
        return this.__toSql(sqlBuilder, params)
    }
    shapedAs(shape: any): any {
        this.__query = ''
        this.__shape = shape
        return this
    }
    extendShape(extendShape: any): this {
        this.__query = ''
        let shape
        if (this.__onConflictUpdateSets) {
            shape = this.__onConflictUpdateShape
        } else {
            shape = this.__shape
        }
        if (!shape) {
            if (this.__onConflictUpdateSets) {
                this.__onConflictUpdateShape = extendShape
            } else {
                this.__shape = extendShape
            }
            return this
        }
        const properties = Object.getOwnPropertyNames(extendShape)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            const value = extendShape[property]
            // It will review only the properties that can be used as shape, skiiping the other one to allow more complex usages
            if (typeof value === 'string' || isColumn(value)) {
                const currentShapeValue = shape[property]
                if (typeof currentShapeValue === 'string' || isColumn(value)) {
                    throw new Error('You cannot override the previously defined shape property with name ' + property)
                }
            }
        }
        shape = { ...shape, ...extendShape }
        if (this.__onConflictUpdateSets) {
            this.__onConflictUpdateShape = shape
        } else {
            this.__shape = shape
        }
        return this
    }
    dynamicSet(columns?: any): any {
        if (columns) {
            return this.set(columns)
        }
        this.__query = ''
        return this
    }
    __getSetsForMultipleInsert(): { [property: string]: any }[] {
        const multiple = this.__multiple
        if (!multiple) {
            const result : { [property: string]: any }[] = []
            this.__multiple = result
            this.__multipleAlreadyCopied = true
            return result
        }
        if (this.__multipleAlreadyCopied) {
            return multiple
        }

        const result : { [property: string]: any }[] = []
        for (let i = 0, length = multiple.length; i < length; i++) {
            result.push({...multiple[i]})
        }
        this.__multiple = result
        this.__multipleAlreadyCopied = true
        return result
    }
    set(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets
        let shape
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
            shape = this.__onConflictUpdateShape
            this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        } else {
            sets = this.__sets
            shape = this.__shape
        }
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
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

        let sets
        let shape
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
            shape = this.__onConflictUpdateShape
            this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        } else {
            sets = this.__sets
            shape = this.__shape
        }
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
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
    setIfSet(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets
        let shape
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
            shape = this.__onConflictUpdateShape
            this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        } else {
            sets = this.__sets
            shape = this.__shape
        }
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
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

        let sets
        let shape
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
            shape = this.__onConflictUpdateShape
            this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        } else {
            sets = this.__sets
            shape = this.__shape
        }
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
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

        let sets
        let shape
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
            shape = this.__onConflictUpdateShape
            this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        } else {
            sets = this.__sets
            shape = this.__shape
        }
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
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

        let sets
        let shape
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
            shape = this.__onConflictUpdateShape
            this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        } else {
            sets = this.__sets
            shape = this.__shape
        }
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
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
    ignoreIfSet(...columns: any[]): any {
        this.__query = ''

        let sets
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
        } else if (this.__multiple) {
            const multiple = this.__getSetsForMultipleInsert()
            for (let j = 0, length = multiple.length; j < length; j++) {
                const item = multiple[j]!
                for (let i = 0, length = columns.length; i < length; i++) {
                    let column = columns[i]
                    delete item[column]
                }
            }
            return this
        } else {
            sets = this.__sets
        }
        for (let i = 0, length = columns.length; i < length; i++) {
            let column = columns[i]
            delete sets[column]
        }
        return this
    }
    keepOnly(...columns: any[]): any {
        this.__query = ''
        let sets
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
        } else if (this.__multiple) {
            const multiple = this.__getSetsForMultipleInsert()
            const allow: any = {}
            for (let i = 0, length = columns.length; i < length; i++) {
                let column = columns[i]
                allow[column] = true
            }
            for (let j = 0, length = multiple.length; j < length; j++) {
                const item = multiple[j]!
                const properties = Object.getOwnPropertyNames(item)
                for (let i = 0, length = properties.length; i < length; i++) {
                    const property = properties[i]!
                    if (!allow[property]) {
                        delete item[property]
                    }
                }
            }
            return this
        } else {
            sets = this.__sets
        }
        const allow: any = {}
        for (let i = 0, length = columns.length; i < length; i++) {
            let column = columns[i]
            allow[column] = true
        }
        const properties = Object.getOwnPropertyNames(sets)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (!allow[property]) {
                delete sets[property]
            }
        }
        return this
    }

    setIfHasValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        let sets
        let shape
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
            shape = this.__onConflictUpdateShape
            this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        } else {
            sets = this.__sets
            shape = this.__shape
        }
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
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

        let sets
        let shape
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
            shape = this.__onConflictUpdateShape
            this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        } else {
            sets = this.__sets
            shape = this.__shape
        }
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
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

        let sets
        let shape
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
            shape = this.__onConflictUpdateShape
            this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        } else {
            sets = this.__sets
            shape = this.__shape
        }
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
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

        let sets
        let shape
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
            shape = this.__onConflictUpdateShape
            this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        } else {
            sets = this.__sets
            shape = this.__shape
        }
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
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

        let sets
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
        } else if (this.__multiple) {
            const multiple = this.__getSetsForMultipleInsert()
            for (let j = 0, length = multiple.length; j < length; j++) {
                const item = multiple[j]!
                for (let i = 0, length = columns.length; i < length; i++) {
                    let column = columns[i]
                    if (!this.__sqlBuilder._isValue(item[column])) {
                        continue
                    }
                    delete item[column]
                }
            }
            return this
        } else {
            sets = this.__sets
        }
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

        let sets
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
        } else if (this.__multiple) {
            const multiple = this.__getSetsForMultipleInsert()
            for (let j = 0, length = multiple.length; j < length; j++) {
                const item = multiple[j]!
                for (let i = 0, length = columns.length; i < length; i++) {
                    let column = columns[i]
                    if (this.__sqlBuilder._isValue(item[column])) {
                        continue
                    }
                    delete item[column]
                }
            }
            return this
        } else {
            sets = this.__sets
        }
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

        let sets
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
        } else if (this.__multiple) {
            const multiple = this.__getSetsForMultipleInsert()
            for (let j = 0, length = multiple.length; j < length; j++) {
                const item = multiple[j]!
                const properties = Object.getOwnPropertyNames(item)
                for (let i = 0, length = properties.length; i < length; i++) {
                    const property = properties[i]!
                    if (this.__sqlBuilder._isValue(item[property])) {
                        continue
                    }
                    delete item[property]
                }
            }
            return this
        } else {
            sets = this.__sets
        }
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


    setForAll(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        const sets = this.__getSetsForMultipleInsert()
        const shape = this.__shape
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            for (let j = 0, length = sets.length; j < length; j++) {
                sets[j]![property] = value
            }
        }
        return this
    }
    setForAllIfValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        const sets = this.__getSetsForMultipleInsert()
        const shape = this.__shape
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            if (!this.__sqlBuilder._isValue(value)) {
                continue
            }
            for (let j = 0, length = sets.length; j < length; j++) {
                const item = sets[j]!
                item[property] = value
            }
        }
        return this
    }
    setForAllIfSet(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        const sets = this.__getSetsForMultipleInsert()
        const shape = this.__shape
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            for (let j = 0, length = sets.length; j < length; j++) {
                const item = sets[j]!
                if (!(property in item)) {
                    continue
                }
                item[property] = value
            }
        }
        return this
    }
    setForAllIfSetIfValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        const sets = this.__getSetsForMultipleInsert()
        const shape = this.__shape
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            if (!this.__sqlBuilder._isValue(value)) {
                continue
            }
            for (let j = 0, length = sets.length; j < length; j++) {
                const item = sets[j]!
                if (!(property in item)) {
                    continue
                }
                item[property] = value
            }
        }
        return this
    }
    setForAllIfNotSet(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        const sets = this.__getSetsForMultipleInsert()
        const shape = this.__shape
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            for (let j = 0, length = sets.length; j < length; j++) {
                const item = sets[j]!
                if (property in item) {
                    continue
                }
                item[property] = value
            }
        }
        return this
    }
    setForAllIfNotSetIfValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        const sets = this.__getSetsForMultipleInsert()
        const shape = this.__shape
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            if (!this.__sqlBuilder._isValue(value)) {
                continue
            }
            for (let j = 0, length = sets.length; j < length; j++) {
                const item = sets[j]!
                if (property in item) {
                    continue
                }
                item[property] = value
            }
        }
        return this
    }

    setForAllIfHasValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        const sets = this.__getSetsForMultipleInsert()
        const shape = this.__shape
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            for (let j = 0, length = sets.length; j < length; j++) {
                const item = sets[j]!
                if (!this.__sqlBuilder._isValue(item[property])) {
                    continue
                }
                item[property] = value
            }
        }
        return this
    }
    setForAllIfHasValueIfValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        const sets = this.__getSetsForMultipleInsert()
        const shape = this.__shape
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            if (!this.__sqlBuilder._isValue(value)) {
                continue
            }
            for (let j = 0, length = sets.length; j < length; j++) {
                const item = sets[j]!
                if (!this.__sqlBuilder._isValue(item[property])) {
                    continue
                }
                item[property] = value
            }
        }
        return this
    }
    setForAllIfHasNoValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        const sets = this.__getSetsForMultipleInsert()
        const shape = this.__shape
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            for (let j = 0, length = sets.length; j < length; j++) {
                const item = sets[j]!
                if (this.__sqlBuilder._isValue(item[property])) {
                    continue
                }
                item[property] = value
            }
        }
        return this
    }
    setForAllIfHasNoValueIfValue(columns: any): this {
        this.__query = ''
        if (!columns) {
            return this
        }

        const sets = this.__getSetsForMultipleInsert()
        const shape = this.__shape
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            if (!this.__sqlBuilder._isValue(value)) {
                continue
            }
            for (let j = 0, length = sets.length; j < length; j++) {
                const item = sets[j]!
                if (this.__sqlBuilder._isValue(item[property])) {
                    continue
                }
                item[property] = value
            }
        }
        return this
    }

    disallowIfSet(error: string | Error, ...columns: any[]): this {
        this.__query = ''

        let sets
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
        } else if (this.__multiple) {
            const multiple = this.__getSetsForMultipleInsert()
            for (let j = 0, length = multiple.length; j < length; j++) {
                const item = multiple[j]!
                for (let i = 0, length = columns.length; i < length; i++) {
                    let column = columns[i]
                    if (column in item) {
                        if (typeof error === 'string') {
                            error = new Error(error)
                        }
                        (error as any)['disallowedPropery'] = column;
                        (error as any)['disallowedIndex'] = j
                        throw error
                    }
                }
            }
            return this
        } else {
            sets = this.__sets
        }

        for (let i = 0, length = columns.length; i < length; i++) {
            let column = columns[i]
            if (column in sets) {
                if (typeof error === 'string') {
                    error = new Error(error)
                }
                (error as any)['disallowedPropery'] = column
                throw error
            }
        }
        return this
    }
    disallowIfNotSet(error: string | Error, ...columns: any[]): this {
        this.__query = ''

        let sets
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
        } else if (this.__multiple) {
            const multiple = this.__getSetsForMultipleInsert()
            for (let j = 0, length = multiple.length; j < length; j++) {
                const item = multiple[j]!
                for (let i = 0, length = columns.length; i < length; i++) {
                    let column = columns[i]
                    if (!(column in item)) {
                        if (typeof error === 'string') {
                            error = new Error(error)
                        }
                        (error as any)['disallowedPropery'] = column;
                        (error as any)['disallowedIndex'] = j
                        throw error
                    }
                }
            }
            return this
        } else {
            sets = this.__sets
        }

        for (let i = 0, length = columns.length; i < length; i++) {
            let column = columns[i]
            if (!(column in sets)) {
                if (typeof error === 'string') {
                    error = new Error(error)
                }
                (error as any)['disallowedPropery'] = column
                throw error
            }
        }
        return this
    }
    disallowIfValue(error: string | Error, ...columns: any[]): this {
        this.__query = ''

        let sets
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
        } else if (this.__multiple) {
            const multiple = this.__getSetsForMultipleInsert()
            for (let j = 0, length = multiple.length; j < length; j++) {
                const item = multiple[j]!
                for (let i = 0, length = columns.length; i < length; i++) {
                    let column = columns[i]
                    if (this.__sqlBuilder._isValue(item[column])) {
                        if (typeof error === 'string') {
                            error = new Error(error)
                        }
                        (error as any)['disallowedPropery'] = column;
                        (error as any)['disallowedIndex'] = j
                        throw error
                    }
                }
            }
            return this
        } else {
            sets = this.__sets
        }

        for (let i = 0, length = columns.length; i < length; i++) {
            let column = columns[i]
            if (this.__sqlBuilder._isValue(sets[column])) {
                if (typeof error === 'string') {
                    error = new Error(error)
                }
                (error as any)['disallowedPropery'] = column
                throw error
            }
        }
        return this
    }
    disallowIfNoValue(error: string | Error, ...columns: any[]): this {
        this.__query = ''

        let sets
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
        } else if (this.__multiple) {
            const multiple = this.__getSetsForMultipleInsert()
            for (let j = 0, length = multiple.length; j < length; j++) {
                const item = multiple[j]!
                for (let i = 0, length = columns.length; i < length; i++) {
                    let column = columns[i]
                    if (!this.__sqlBuilder._isValue(item[column])) {
                        if (typeof error === 'string') {
                            error = new Error(error)
                        }
                        (error as any)['disallowedPropery'] = column;
                        (error as any)['disallowedIndex'] = j
                        throw error
                    }
                }
            }
            return this
        } else {
            sets = this.__sets
        }

        for (let i = 0, length = columns.length; i < length; i++) {
            let column = columns[i]
            if (!this.__sqlBuilder._isValue(sets[column])) {
                if (typeof error === 'string') {
                    error = new Error(error)
                }
                (error as any)['disallowedPropery'] = column
                throw error
            }
        }
        return this
    }
    disallowAnyOtherSet(error: string | Error, ...columns: any[]): this {
        this.__query = ''
        const allowed: any = {}
        for (let i = 0, length = columns.length; i < length; i++) {
            let column = columns[i]
            allowed[column] = true
        }

        let shape: any
        let sets
        if (this.__onConflictUpdateSets) {
            sets = this.__onConflictUpdateSets
            shape = this.__onConflictUpdateShape || this.__table
        } else if (this.__multiple) {
            shape = this.__shape || this.__table
            const multiple = this.__getSetsForMultipleInsert()
            for (let j = 0, length = multiple.length; j < length; j++) {
                const item = multiple[j]!
                const properties = Object.getOwnPropertyNames(item)
                for (let i = 0, length = properties.length; i < length; i++) {
                    const property = properties[i]!
                    if (!(property in shape)) {
                        // This is not a property that will be included in the update
                        // Ingoring it allow more complex operations
                        continue
                    }
                    
                    if (!allowed[property]) {
                        if (typeof error === 'string') {
                            error = new Error(error)
                        }
                        (error as any)['disallowedPropery'] = property;
                        (error as any)['disallowedIndex'] = j
                        throw error
                    } else {
                        console.log('b')
                    }
                }
            }
            return this
        } else {
            shape = this.__shape || this.__table
            sets = this.__sets
        }

        const properties = Object.getOwnPropertyNames(sets)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (!(property in shape)) {
                // This is not a property that will be included in the update
                // Ingoring it allow more complex operations
                continue
            }

            if (!allowed[property]) {
                if (typeof error === 'string') {
                    error = new Error(error)
                }
                (error as any)['disallowedPropery'] = property
                throw error
            }
        }
        return this
    }



    setWhen(when: boolean, columns: any): this {
        if (when) {
            return this.set(columns)
        }
        return this
    }
    setIfValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setIfValue(columns)
        }
        return this
    }
    setIfSetWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setIfSet(columns)
        }
        return this
    }
    setIfSetIfValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setIfSetIfValue(columns)
        }
        return this
    }
    setIfNotSetWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setIfNotSet(columns)
        }
        return this
    }
    setIfNotSetIfValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setIfNotSetIfValue(columns)
        }
        return this
    }
    ignoreIfSetWhen(when: boolean, ...columns: any[]): this {
        if (when) {
            return this.ignoreIfSet(...columns)
        }
        return this
    }
    keepOnlyWhen(when: boolean, ...columns: any[]): this {
        if (when) {
            return this.keepOnly(...columns)
        }
        return this
    }

    setIfHasValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setIfHasValue(columns)
        }
        return this
    }
    setIfHasValueIfValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setIfHasValueIfValue(columns)
        }
        return this
    }
    setIfHasNoValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setIfHasNoValue(columns)
        }
        return this
    }
    setIfHasNoValueIfValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setIfHasNoValueIfValue(columns)
        }
        return this
    }
    ignoreIfHasValueWhen(when: boolean, ...columns: any[]): this {
        if (when) {
            return this.ignoreIfHasValue(...columns)
        }
        return this
    }
    ignoreIfHasNoValueWhen(when: boolean, ...columns: any[]): this {
        if (when) {
            return this.ignoreIfHasValue(...columns)
        }
        return this
    }
    ignoreAnySetWithNoValueWhen(when: boolean): this {
        if (when) {
            return this.ignoreAnySetWithNoValue()
        }
        return this
    }

    setForAllWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setForAll(columns)
        }
        return this
    }
    setForAllIfValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setForAllIfValue(columns)
        }
        return this
    }
    setForAllIfSetWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setForAllIfSet(columns)
        }
        return this
    }
    setForAllIfSetIfValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setForAllIfSetIfValue(columns)
        }
        return this
    }
    setForAllIfNotSetWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setForAllIfNotSet(columns)
        }
        return this
    }
    setForAllIfNotSetIfValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setForAllIfNotSetIfValue(columns)
        }
        return this
    }

    setForAllIfHasValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setForAllIfHasValue(columns)
        }
        return this
    }
    setForAllIfHasValueIfValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setForAllIfHasValueIfValue(columns)
        }
        return this
    }
    setForAllIfHasNoValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setForAllIfHasNoValue(columns)
        }
        return this
    }
    setForAllIfHasNoValueIfValueWhen(when: boolean, columns: any): this {
        if (when) {
            return this.setForAllIfHasNoValueIfValue(columns)
        }
        return this
    }

    disallowIfSetWhen(when: boolean, error: string | Error, ...columns: any[]): this {
        if (when) {
            return this.disallowIfSet(error, ...columns)
        }
        return this
    }
    disallowIfNotSetWhen(when: boolean, error: string | Error, ...columns: any[]): this {
        if (when) {
            return this.disallowIfNotSet(error, ...columns)
        }
        return this
    }
    disallowIfValueWhen(when: boolean, error: string | Error, ...columns: any[]): this {
        if (when) {
            return this.disallowIfValue(error, ...columns)
        }
        return this
    }
    disallowIfNoValueWhen(when: boolean, error: string | Error, ...columns: any[]): this {
        if (when) {
            return this.disallowIfNoValue(error, ...columns)
        }
        return this
    }
    disallowAnyOtherSetWhen(when: boolean, error: string | Error, ...columns: any[]): this {
        if (when) {
            return this.disallowAnyOtherSet(error, ...columns)
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
    dynamicValues(columns: any): this {
        return this.values(columns)
    }
    from(select: IExecutableSelectQuery<any, any, any, any>): this {
        this.__from = select as any as SelectData
        __addWiths(select, this.__sqlBuilder, this.__withs)
        return this
    }

    customizeQuery(customization: InsertCustomization<any>): this {
        this.__customization = customization
        __addWiths(customization.beforeQuery, this.__sqlBuilder, this.__withs)
        __addWiths(customization.afterInsertKeyword, this.__sqlBuilder, this.__withs)
        __addWiths(customization.afterQuery, this.__sqlBuilder, this.__withs)
        return this
    }

    defaultValues(): this {
        this.__query = ''
        this.__sets = DEFAULT_VALUES
        return this
    }

    returningLastInsertedId(): this {
        this.__query = ''
        const table = this.__table
        for (var columnName in table) {
            const column = __getColumnOfObject(table, columnName)
            if (!column) {
                continue
            }
            const columnPrivate = __getColumnPrivate(column)
            if (!columnPrivate.__isAutogeneratedPrimaryKey) {
                continue
            }
            if (this.__idColumn) {
                throw new Error('In order to call executeInsertReturningLastInsertedId method the table must have defined only one autogenerated primary key column')
            }
            this.__idColumn = column
        }
        if (!this.__idColumn) {
            throw new Error('In order to call executeInsertReturningLastInsertedId method the table must have defined one autogenerated primary key column')
        }
        return this
    }
    
    returning(columns: InsertColumns<any>): this {
        this.__query = ''
        this.__columns = columns
        this.__registerTableOrViewWithOfColumns(columns, this.__withs)
        return this
    }
    projectingOptionalValuesAsNullable(): any {
        this.__projectOptionalValuesAsNullable = true
        return this
    }
    
    returningOneColumn(column: AnyValueSource): this {
        this.__query = ''
        this.__oneColumn = true
        this.__columns = { 'result': column }
        __getValueSourcePrivate(column).__addWiths(this.__sqlBuilder, this.__withs)
        return this
    }

    onConflictDoNothing(): this {
        this.__query = ''
        this.__onConflictDoNothing = true
        return this
    }
    onConflictDoUpdateDynamicSet(columns?: any): any {
        if (columns) {
            this.onConflictDoUpdateSet(columns)
        }
        this.__query = ''
        if (this.__onConflictUpdateSets) {
            throw new Error('Illegal state')
        }
        this.__onConflictUpdateSets = {}
        if (this.__shape) {
            this.__onConflictUpdateShape = this.__shape
        }
        return this
    }
    onConflictDoUpdateSet(columns: any): any {
        this.__query = ''
        if (!columns) {
            return this
        }

        if (this.__onConflictUpdateSets) {
            throw new Error('Illegal state')
        }

        this.__onConflictUpdateSets = {}
        const shape = this.__shape
        if (shape) {
            this.__onConflictUpdateShape = shape
        }
        let sets = this.__onConflictUpdateSets!
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            sets[property] = value
        }
        this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        return this
    }
    onConflictDoUpdateSetIfValue(columns: any): any {
        this.__query = ''
        if (!columns) {
            return this
        }

        if (this.__onConflictUpdateSets) {
            throw new Error('Illegal state')
        }

        this.__onConflictUpdateSets = {}
        const shape = this.__shape
        if (shape) {
            this.__onConflictUpdateShape = shape
        }
        let sets = this.__onConflictUpdateSets!
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            if (!this.__sqlBuilder._isValue(value)) {
                continue
            }
            sets[property] = value
        }
        this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        return this
    }
    onConflictOn(...columns: AnyValueSource[]): this {
        this.__query = ''
        if (this.__onConflictOnColumns) {
            throw new Error('Illegal state')
        }
        this.__onConflictOnColumns = columns
        for (let i = 0, length = columns.length; i < length; i++) {
            __getValueSourcePrivate(columns[i]!).__addWiths(this.__sqlBuilder, this.__withs)
        }
        return this
    }
    onConflictOnConstraint(constraint: string | IStringValueSource<any, any> | RawFragment<any>): this {
        this.__query = ''
        if (this.__onConflictOnConstraint) {
            throw new Error('Illegal state')
        }
        this.__onConflictOnConstraint = constraint
        __addWiths(constraint, this.__sqlBuilder, this.__withs)
        return this
    }

    doNothing(): this {
        this.__query = ''
        this.__onConflictDoNothing = true
        return this
    }
    doUpdateDynamicSet(columns?: any): any {
        if (columns) {
            this.doUpdateSet(columns)
        }
        this.__query = ''
        if (this.__onConflictUpdateSets) {
            throw new Error('Illegal state')
        }
        this.__onConflictUpdateSets = {}
        if (this.__shape) {
            this.__onConflictUpdateShape = this.__shape
        }
        return this
    }
    doUpdateSet(columns: any): any {
        this.__query = ''
        if (!columns) {
            return this
        }

        if (this.__onConflictUpdateSets) {
            throw new Error('Illegal state')
        }

        this.__onConflictUpdateSets = {}
        const shape = this.__shape
        if (shape) {
            this.__onConflictUpdateShape = shape
        }
        let sets = this.__onConflictUpdateSets!
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            sets[property] = value
        }
        this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        return this
    }
    doUpdateSetIfValue(columns: any): any {
        this.__query = ''
        if (!columns) {
            return this
        }

        if (this.__onConflictUpdateSets) {
            throw new Error('Illegal state')
        }

        this.__onConflictUpdateSets = {}
        const shape = this.__shape
        if (shape) {
            this.__onConflictUpdateShape = shape
        }
        let sets = this.__onConflictUpdateSets!
        const properties = Object.getOwnPropertyNames(columns)
        for (let i = 0, length = properties.length; i < length; i++) {
            const property = properties[i]!
            if (shape && !(property in shape)) {
                // property not in the shape
                continue
            }
            const value = columns[property]
            if (!this.__sqlBuilder._isValue(value)) {
                continue
            }
            sets[property] = value
        }
        this.__valuesForInsert = this.__valuesForInsert || this.__getValuesForInsertOfColumns(columns)
        return this
    }


    dynamicWhere(): this {
        this.__query = ''
        return this
    }
    where(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
        this.__query = ''

        if (this.__onConflictUpdateSets) {
            if (this.__onConflictUpdateWhere) {
                throw new Error('Illegal state')
            }
            this.__onConflictUpdateWhere = asAlwaysIfValueSource(condition)
            const conditionPrivate = __getValueSourcePrivate(condition)
            conditionPrivate.__addWiths(this.__sqlBuilder, this.__withs)
            this.__valuesForInsert = this.__valuesForInsert || conditionPrivate.__getValuesForInsert(this.__sqlBuilder)
        } else if (this.__onConflictOnColumns) {
            if (this.__onConflictOnColumnsWhere) {
                throw new Error('Illegal state')
            }
            this.__onConflictOnColumnsWhere = asAlwaysIfValueSource(condition)
            __getValueSourcePrivate(condition).__addWiths(this.__sqlBuilder, this.__withs)
        } else {
            throw new Error('Illegal state')
        }
        return this
    }
    and(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
        this.__query = ''
        if (this.__onConflictUpdateSets) {
            if (!this.__onConflictUpdateWhere) {
                this.__onConflictUpdateWhere = asAlwaysIfValueSource(condition)
            } else {
                this.__onConflictUpdateWhere = this.__onConflictUpdateWhere.and(asAlwaysIfValueSource(condition))
            }
            const conditionPrivate = __getValueSourcePrivate(condition)
            conditionPrivate.__addWiths(this.__sqlBuilder, this.__withs)
            this.__valuesForInsert = this.__valuesForInsert || conditionPrivate.__getValuesForInsert(this.__sqlBuilder)
        } else if (this.__onConflictOnColumns) {
            if (!this.__onConflictOnColumnsWhere) {
                this.__onConflictOnColumnsWhere = asAlwaysIfValueSource(condition)
            } else {
                this.__onConflictOnColumnsWhere = this.__onConflictOnColumnsWhere.and(asAlwaysIfValueSource(condition))
            }
            __getValueSourcePrivate(condition).__addWiths(this.__sqlBuilder, this.__withs)
        } else {
            throw new Error('Illegal state')
        }
        return this
    }
    or(condition: IBooleanValueSource<any, any> | IIfValueSource<any, any>): this {
        this.__query = ''
        if (this.__onConflictUpdateSets) {
            if (!this.__onConflictUpdateWhere) {
                this.__onConflictUpdateWhere = asAlwaysIfValueSource(condition)
            } else {
                this.__onConflictUpdateWhere = this.__onConflictUpdateWhere.or(asAlwaysIfValueSource(condition))
            }
            const conditionPrivate = __getValueSourcePrivate(condition)
            conditionPrivate.__addWiths(this.__sqlBuilder, this.__withs)
            this.__valuesForInsert = this.__valuesForInsert || conditionPrivate.__getValuesForInsert(this.__sqlBuilder)
        } else if (this.__onConflictOnColumns) {
            if (!this.__onConflictOnColumnsWhere) {
                this.__onConflictOnColumnsWhere = asAlwaysIfValueSource(condition)
            } else {
                this.__onConflictOnColumnsWhere = this.__onConflictOnColumnsWhere.or(asAlwaysIfValueSource(condition))
            }
            __getValueSourcePrivate(condition).__addWiths(this.__sqlBuilder, this.__withs)
        } else {
            throw new Error('Illegal state')
        }
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
    __isAllowed(sqlBuilder: HasIsValue): boolean {
        let result = __getTableOrViewPrivate(this.__table).__isAllowed(sqlBuilder)
        if (!result) {
            return false
        }
        result = __isAllowed(this.__from, sqlBuilder)
        if (!result) {
            return false
        }
        const sets = this.__sets
        for (let prop in sets) {
            const set = sets[prop]!
            const result = __isAllowed(set, sqlBuilder)
            if (!result) {
                return false
            }
        }
        const multiple = this.__multiple
        if (multiple) {
            for (let i = 0, length = multiple.length; i < length; i++) {
                const sets = multiple[i]!
                for (let prop in sets) {
                    const set = sets[prop]!
                    const result = __isAllowed(set, sqlBuilder)
                    if (!result) {
                        return false
                    }
                }
            }
        }
        if (this.__columns) {
            result = isAllowedQueryColumns(this.__columns, sqlBuilder)
            if (!result) {
                return false
            }
        }
        result = __isAllowed(this.__onConflictOnConstraint, sqlBuilder)
        if (!result) {
            return false
        }
        result = __isAllowed(this.__onConflictOnColumns, sqlBuilder)
        if (!result) {
            return false
        }
        result = __isAllowed(this.__onConflictOnColumnsWhere, sqlBuilder)
        if (!result) {
            return false
        }
        const updateSets = this.__sets
        for (let prop in updateSets) {
            const set = updateSets[prop]!
            const result = __isAllowed(set, sqlBuilder)
            if (!result) {
                return false
            }
        }
        result = __isAllowed(this.__onConflictUpdateWhere, sqlBuilder)
        if (!result) {
            return false
        }
        if (this.__customization) {
            result = __isAllowed(this.__customization.beforeQuery, sqlBuilder)
            if (!result) {
                return false
            }
            result = __isAllowed(this.__customization.afterInsertKeyword, sqlBuilder)
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

const DEFAULT_VALUES = {}
