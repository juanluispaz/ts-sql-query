
import { IValueSource, __getValueSourcePrivate } from "../expressions/values"
import { SqlBuilder } from "../sqlBuilders/SqlBuilder"
import { attachSource } from "../utils/attachSource"

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

export class ComposeSplitQueryBuilder {
    __sqlBuilder: SqlBuilder

    __compositions: SplitCompose[] = []
    __lastComposition?: Compose
    __columns?: { [property: string]: IValueSource<any, any> }

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

    __transformValueFromDB(valueSource: IValueSource<any, any>, value: any, column?: string, index?: number, count?: boolean) {
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
}