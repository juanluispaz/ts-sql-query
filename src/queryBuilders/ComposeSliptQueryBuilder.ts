import { AnyValueSource, isValueSource, __getValueSourcePrivate } from "../expressions/values"
import { getQueryColumn, QueryColumns, SqlBuilder } from "../sqlBuilders/SqlBuilder"
import { attachSource } from "../utils/attachSource"
import { Column } from "../utils/Column"
import { ITableOrView, IWithView, __getTableOrViewPrivate, __registerRequiredColumn } from "../utils/ITableOrView"

interface Compose {
    type: 'compose'
    config: {
        externalProperty: string,
        internalProperty: string,
        propertyName: string
    }
    deleteInternal: boolean,
    deleteExternal: boolean,
    cardinality?: 'noneOrOne' | 'one' | 'many' | 'optionalMany'
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

export class ComposeSplitQueryBuilder {
    __sqlBuilder: SqlBuilder

    __compositions: SplitCompose[] = []
    __lastComposition?: Compose
    __columns?: QueryColumns

    constructor(sqlBuilder: SqlBuilder) {
        this.__sqlBuilder = sqlBuilder
    }

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
    withOptionalMany(fn: (ids: any[]) => Promise<any[]>): any {
        const last = this.__lastComposition
        if (!last) {
            throw new Error('Illegal state')
        }
        this.__lastComposition = undefined
        last.fn = fn
        last.cardinality = 'optionalMany'
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
                } catch (e: any) {
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

        if (!this.__columns) {
            return dataResult
        }

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
            if (externalValue !== null || externalValue !== undefined) {
                ids.push(data[externalProperty])
            }
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

        if (ids.length <= 0) {
            return dataResult
        }
        return fn(ids).then((internalList) => {
            try {
                this.__processCompositionResult(internalList, dataList, dataMap, composition)
            } catch (e: any) {
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
        } else if (cardinality === 'many' || cardinality === 'optionalMany') {
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

        if (cardinality === 'optionalMany') {
            for(let i = 0, length = dataList.length; i < length; i++) {
                const data = dataList[i]
                if (data[resultProperty].lenght <= 0) {
                    delete data[resultProperty]
                }
            }
        }
    }

    __transformValueFromDB(valueSource: AnyValueSource, value: any, column?: string, index?: number, count?: boolean) {
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
        return this.__transformRootObject('', columns, row, index)
    }

    __transformRootObject(errorPrefix: string, columns: QueryColumns, row: any, index?: number): any {
        const result: any = {}
        for (let prop in columns) {
            const valueSource = columns[prop]!
            let value = row[prop]
            let transformed 
            if (isValueSource(valueSource)) {
                const valueSourcePrivate = __getValueSourcePrivate(valueSource)
                if (valueSourcePrivate.__aggregatedArrayColumns) {
                    transformed = this.__transformAggregatedArray(errorPrefix + prop, valueSource, value, index)
                } else {
                    transformed = this.__transformValueFromDB(valueSource, value, errorPrefix + prop, index)
                }
            } else {
                transformed = this.__transformProjectedObject(errorPrefix + prop + '.', prop + '.', valueSource, row, index)
            }
            if (transformed !== undefined && transformed !== null) {
                result[prop] = transformed
            }
        }
        return result
    }

    __transformAggregatedArray(errorPrefix: string, valueSource: AnyValueSource, value: any, index?: number): any {
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
                    const resultValue = this.__transformAggregatedArray(errorPrefix + '[' + i + ']', columns, json[i], index)
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
                const resultObject = this.__transformRootObject(errorPrefix + '[' + i + '].', columns, row, index)
                if (resultObject === null || resultObject === undefined) {
                    continue
                }
                result.push(resultObject)
            }
        } else {
            for (let i = 0, lenght = json.length; i < lenght; i++) {
                const row = json[i]
                const resultObject = this.__transformProjectedObject(errorPrefix + '[' + i + '].', '', columns, row, index)
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

    __transformProjectedObject(errorPrefix: string, pathPrefix: string, columns: QueryColumns, row: any, index?: number): any {
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
                    transformed = this.__transformAggregatedArray(propName, valueSource, value, index)
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
                    valueSourcePrivate.__registerTableOrView(firstRequiredTables)
                    alwaysSameRequiredTablesSize = true
                } else if (alwaysSameRequiredTablesSize) {
                    let valueSourceRequiredTables = new Set<ITableOrView<any>>()
                    valueSourcePrivate.__registerTableOrView(valueSourceRequiredTables)
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
                transformed = this.__transformProjectedObject(errorPrefix, propName + '.', valueSource, row, index)
            }
            if (transformed !== undefined && transformed !== null) {
                keepObject = true
                result[prop] = transformed
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
                const oldValues = __getValueSourcePrivate(column).__getOldValues()
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

    __registerTableOrViewOfColumns(columns: QueryColumns | undefined, requiredTablesOrViews: Set<ITableOrView<any>>) {
        for (const property in columns) {
            const column = columns[property]!
            if (isValueSource(column)) {
                __getValueSourcePrivate(column).__registerTableOrView(requiredTablesOrViews)
            } else {
                this.__registerTableOrViewOfColumns(column, requiredTablesOrViews)
            }
        }
    }

    __registerTableOrViewWithOfColumns(columns: QueryColumns | undefined, withs: IWithView<any>[]) {
        for (const property in columns) {
            const column = columns[property]!
            if (isValueSource(column)) {
                __getValueSourcePrivate(column).__addWiths(withs)
            } else {
                this.__registerTableOrViewWithOfColumns(column, withs)
            }
        }
    }

    __registerRequiredColumnOfColmns(columns: QueryColumns | undefined, requiredColumns: Set<Column>, newOnly: Set<ITableOrView<any>>) {
        for (const property in columns) {
            const column = columns[property]!
            if (isValueSource(column)) {
                __getValueSourcePrivate(column).__registerRequiredColumn(requiredColumns, newOnly)
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