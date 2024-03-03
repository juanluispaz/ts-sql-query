import { AnyValueSource, isValueSource, __getValueSourcePrivate } from "../expressions/values"
import { getQueryColumn, QueryColumns, SqlBuilder } from "../sqlBuilders/SqlBuilder"
import { Column } from "../utils/Column"
import { ITableOrView, IWithView, __getTableOrViewPrivate, __registerRequiredColumn } from "../utils/ITableOrView"

export class AbstractQueryBuilder {
    __sqlBuilder: SqlBuilder
    __columns?: QueryColumns
    __projectOptionalValuesAsNullable?: boolean

    constructor(sqlBuilder: SqlBuilder) {
        this.__sqlBuilder = sqlBuilder
    }

    __isValue<T>(value: T): value is NonNullable<T> {
        return this.__sqlBuilder._isValue(value)
    }

    __transformValueFromDB(valueSource: AnyValueSource, value: any, column?: string, index?: number, count?: boolean) {
        const valueSourcePrivate = __getValueSourcePrivate(valueSource)
        const typeAdapter = valueSourcePrivate.__typeAdapter
        let result
        if (typeAdapter) {
            result = typeAdapter.transformValueFromDB(value, valueSourcePrivate.__valueTypeName, this.__sqlBuilder._defaultTypeAdapter)
        } else {
            result = this.__sqlBuilder._defaultTypeAdapter.transformValueFromDB(value, valueSourcePrivate.__valueTypeName)
        }
        if (result !== null && result !== undefined) {
            return result
        }
        if (valueSourcePrivate.__optionalType === 'required') {
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
        const columns = this.__columns!
        return this.__transformRootObject(!!this.__projectOptionalValuesAsNullable, '', columns, row, index)
    }

    __transformRootObject(projectOptionalValuesAsNullable: boolean, errorPrefix: string, columns: QueryColumns, row: any, index?: number): any {
        const result: any = {}
        for (let prop in columns) {
            const valueSource = columns[prop]!
            let value = row[prop]
            let transformed 
            if (isValueSource(valueSource)) {
                const valueSourcePrivate = __getValueSourcePrivate(valueSource)
                if (valueSourcePrivate.__aggregatedArrayColumns) {
                    transformed = this.__transformAggregatedArray(!!valueSourcePrivate.__aggreagtedProjectingOptionalValuesAsNullable, errorPrefix + prop, valueSource, value, index)
                } else {
                    transformed = this.__transformValueFromDB(valueSource, value, errorPrefix + prop, index)
                }
            } else {
                transformed = this.__transformProjectedObject(projectOptionalValuesAsNullable, errorPrefix + prop + '.', prop + '.', valueSource, row, index)
            }
            if (transformed !== undefined && transformed !== null) {
                result[prop] = transformed
            } else if (projectOptionalValuesAsNullable) {
                result[prop] = null
            }
        }
        return result
    }

    __transformAggregatedArray(projectOptionalValuesAsNullable: boolean, errorPrefix: string, valueSource: AnyValueSource, value: any, index?: number): any {
        const valueSourcePrivate = __getValueSourcePrivate(valueSource)
        if (value === null || value === undefined) {
            if (valueSourcePrivate.__optionalType === 'required') {
                return []
            } else {
                return null
            }
        }

        let json = value
        if (typeof value === 'string') {
            try {
                json = JSON.parse(value)
            } catch (e) {
                let errorMessage = 'Invalid JSON string coming from the database for the column `' + errorPrefix + '`'
                if (index !== undefined) {
                    errorMessage += ' at index `' + index + '`'
                }
                errorMessage += '. ' + e + '. JSON: ' + value
                throw new Error(errorMessage)
            }
        }

        if (json === null || json === undefined) {
            if (valueSourcePrivate.__optionalType === 'required') {
                return []
            } else {
                return null
            }
        }
        if (!Array.isArray(json)) {
            let errorMessage = 'Invalid JSON string coming from the database for the column `' + errorPrefix + '`'
            if (index !== undefined) {
                errorMessage += ' at index `' + index + '`'
            }
            errorMessage += '. An array were expected'
            throw new Error(errorMessage)
        }

        const columns = valueSourcePrivate.__aggregatedArrayColumns!
        const result = []

        if (isValueSource(columns)) {
            const columnPrivate = __getValueSourcePrivate(columns)
            if (columnPrivate.__aggregatedArrayColumns) {
                for (let i = 0, lenght = json.length; i < lenght; i++) {
                    const resultValue = this.__transformAggregatedArray(!!columnPrivate.__aggreagtedProjectingOptionalValuesAsNullable, errorPrefix + '[' + i + ']', columns, json[i], index)
                    if (resultValue === null || resultValue === undefined) {
                        continue
                    }
                    result.push(resultValue)
                }
            } else {
                for (let i = 0, lenght = json.length; i < lenght; i++) {
                    const resultValue = this.__transformValueFromDB(columns, json[i], errorPrefix + '[' + i + ']', index)
                    if (resultValue === null || resultValue === undefined) {
                        continue
                    }
                    result.push(resultValue)
                }
            }
        } else if (valueSourcePrivate.__aggregatedArrayMode === 'ResultObject') {
            for (let i = 0, lenght = json.length; i < lenght; i++) {
                let row = json[i]
                const resultObject = this.__transformRootObject(!!valueSourcePrivate.__aggreagtedProjectingOptionalValuesAsNullable, errorPrefix + '[' + i + '].', columns, row, index)
                if (resultObject === null || resultObject === undefined) {
                    continue
                }
                result.push(resultObject)
            }
        } else {
            for (let i = 0, lenght = json.length; i < lenght; i++) {
                const row = json[i]
                const resultObject = this.__transformProjectedObject(projectOptionalValuesAsNullable, errorPrefix + '[' + i + '].', '', columns, row, index)
                if (resultObject === null || resultObject === undefined) {
                    continue
                }
                result.push(resultObject)
            }
        }

        if (result.length <= 0) {
            if (valueSourcePrivate.__optionalType === 'required') {
                return []
            } else {
                return null
            }
        }

        return result
    }

    __transformProjectedObject(projectOptionalValuesAsNullable: boolean, errorPrefix: string, pathPrefix: string, columns: QueryColumns, row: any, index?: number): any {
        const result: any = {}
        let keepObject = false
        // Rule 1
        let containsRequiredInOptionalObject = false
        let requiredInOptionalObjectHaveValue = true
        // Rule 2
        let firstRequiredTables = new Set<ITableOrView<any>>()
        let alwaysSameRequiredTablesSize : undefined | boolean = undefined
        let originallyRequiredHaveValue = true

        for (let prop in columns) {
            const valueSource = columns[prop]!
            const propName = pathPrefix + prop
            let value 
            if (propName in row) {
                value = row[propName]
            } else {
                value = row
                const parts = propName.split('.')
                for (let i = 0, length = parts.length; i < length; i++) {
                    if (value) {
                        value = value[parts[i]!]
                    }
                }
            }
            let transformed 
            if (isValueSource(valueSource)) {
                const valueSourcePrivate = __getValueSourcePrivate(valueSource)
                if (valueSourcePrivate.__aggregatedArrayColumns) {
                    transformed = this.__transformAggregatedArray(!!valueSourcePrivate.__aggreagtedProjectingOptionalValuesAsNullable, propName, valueSource, value, index)
                } else {
                    transformed = this.__transformValueFromDB(valueSource, value, errorPrefix + propName, index)
                }

                if (valueSourcePrivate.__optionalType === 'requiredInOptionalObject') {
                    // For rule 1
                    containsRequiredInOptionalObject = true
                    if (transformed === undefined || transformed === null) {
                        requiredInOptionalObjectHaveValue = false
                    }
                } else if (valueSourcePrivate.__optionalType === 'originallyRequired') {
                    // For rule 2
                    if (transformed === undefined || transformed === null) {
                        originallyRequiredHaveValue = false
                    }
                }

                // For rule 2
                if (alwaysSameRequiredTablesSize === undefined) {
                    valueSourcePrivate.__registerTableOrView(this.__sqlBuilder, firstRequiredTables)
                    alwaysSameRequiredTablesSize = true
                } else if (alwaysSameRequiredTablesSize) {
                    let valueSourceRequiredTables = new Set<ITableOrView<any>>()
                    valueSourcePrivate.__registerTableOrView(this.__sqlBuilder, valueSourceRequiredTables)
                    const initialSize = firstRequiredTables.size
                    if (initialSize !== valueSourceRequiredTables.size) {
                        alwaysSameRequiredTablesSize = false
                    } else {
                        valueSourceRequiredTables.forEach(table => {
                            firstRequiredTables.add(table)
                        })
                        if (initialSize !== firstRequiredTables.size) {
                            alwaysSameRequiredTablesSize = false
                        }
                    }
                }
            } else {
                transformed = this.__transformProjectedObject(projectOptionalValuesAsNullable, errorPrefix, propName + '.', valueSource, row, index)
            }
            if (transformed !== undefined && transformed !== null) {
                keepObject = true
                result[prop] = transformed
            } else if (projectOptionalValuesAsNullable) {
                result[prop] = null
            }
        }

        // General rule
        if (!keepObject) {
            return undefined
        }

        // Rule 1
        if (containsRequiredInOptionalObject && !requiredInOptionalObjectHaveValue) {
            return undefined
        }

        // Rule 2
        let onlyOuterJoin = true
        firstRequiredTables.forEach(table => {
            if (!__getTableOrViewPrivate(table).__forUseInLeftJoin) {
                onlyOuterJoin = false
            }
        })
        if (firstRequiredTables.size <= 0) {
            onlyOuterJoin = false
        }
        if (alwaysSameRequiredTablesSize && onlyOuterJoin && !originallyRequiredHaveValue) {
            return undefined
        }

        // No need to verify rule 3 due if there is no value an error is thrown
        // Rule 4 covered in the general rule

        return result
    }

    __getOldValueOfColumns(columns: QueryColumns | undefined): ITableOrView<any> | undefined {
        for (const property in columns) {
            const column = columns[property]!
            if (isValueSource(column)) {
                const oldValues = __getValueSourcePrivate(column).__getOldValues(this.__sqlBuilder)
                if (oldValues) {
                    return oldValues
                }
            } else {
                const oldValues = this.__getOldValueOfColumns(column)
                if (oldValues) {
                    return oldValues
                }
            }
        }
        return undefined
    }

    __getValuesForInsertOfColumns(columns: { [property: string]: any } | undefined): ITableOrView<any> | undefined {
        for (const property in columns) {
            const column = columns[property]!
            if (isValueSource(column)) {
                const oldValues = __getValueSourcePrivate(column).__getValuesForInsert(this.__sqlBuilder)
                if (oldValues) {
                    return oldValues
                }
            }
        }
        return undefined
    }

    __registerTableOrViewOfColumns(columns: QueryColumns | undefined, requiredTablesOrViews: Set<ITableOrView<any>>) {
        for (const property in columns) {
            const column = columns[property]!
            if (isValueSource(column)) {
                __getValueSourcePrivate(column).__registerTableOrView(this.__sqlBuilder, requiredTablesOrViews)
            } else {
                this.__registerTableOrViewOfColumns(column, requiredTablesOrViews)
            }
        }
    }

    __registerTableOrViewWithOfColumns(columns: QueryColumns | undefined, withs: IWithView<any>[]) {
        for (const property in columns) {
            const column = columns[property]!
            if (isValueSource(column)) {
                __getValueSourcePrivate(column).__addWiths(this.__sqlBuilder, withs)
            } else {
                this.__registerTableOrViewWithOfColumns(column, withs)
            }
        }
    }

    __registerRequiredColumnOfColmns(columns: QueryColumns | undefined, requiredColumns: Set<Column>, newOnly: Set<ITableOrView<any>>) {
        for (const property in columns) {
            const column = columns[property]!
            if (isValueSource(column)) {
                __getValueSourcePrivate(column).__registerRequiredColumn(this.__sqlBuilder, requiredColumns, newOnly)
            } else {
                this.__registerRequiredColumnOfColmns(column, requiredColumns, newOnly)
            }
        }
    }

    __getColumnFromColumnsObject(prop: string| number | symbol): AnyValueSource | undefined {
        return getQueryColumn(this.__columns!, prop)
    }

    __getColumnNameFromColumnsObjectLowerCase(prop: string| number | symbol): string | undefined {
        const columns = this.__columns!
        const propName = (prop as string).toLowerCase()

        let map: { [columnNameInLowerCase: string]: string | undefined } = {}
        for (const property in columns) {
            map[property.toLowerCase()] = property
        }

        let realProp = map[propName]
        if (realProp) {
            let valueSource = columns[realProp]
            if (isValueSource(valueSource)) {
                return realProp
            } else {
                return undefined
            }
        }

        const route = propName.split('.')
        let valueSource: QueryColumns | AnyValueSource | undefined = columns
        let path = ''
        for (let i = 0, length = route.length; valueSource && i < length; i++) {
            const currentProp = route[i]!
            realProp = map[currentProp]
            if (!realProp) {
                return undefined
            }
            valueSource = valueSource[realProp]
            if (path) {
                path = path + '.' + realProp
            } else {
                path = realProp
            }

            if (isValueSource(valueSource)) {
                if (i === length - 1) {
                    return path
                } else {
                    return undefined
                }
            }

            map = {}
            for (const property in valueSource) {
                map[property.toLowerCase()] = property
            }
        }
        return undefined
    }
}

export function  __setQueryMetadata(source: Error, params: any[], queryMetadata?: {queryExecutionName?: string,  queryExecutionMetadata?: any} | undefined, isSelectPageCountQuery?: boolean) {
    Object.defineProperty(params, '$source', {
        value: source,
        writable: true,
        enumerable: false,
        configurable: true
    })
    if (queryMetadata) {
        Object.defineProperty(params, '$metadata', {
            value: queryMetadata,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
    if (isSelectPageCountQuery) {
        Object.defineProperty(params, '$isSelectPageCountQuery', {
            value: true,
            writable: true,
            enumerable: false,
            configurable: true
        })
    }
}