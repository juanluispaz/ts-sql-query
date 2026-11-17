import type { DynamicConditionExpression, DynamicFilter, Filterable } from '../expressions/dynamicConditionUsingFilters.js'
import { __createIfValueAlwaysNoop, __isIfValueAlwaysNoop, __asNodeValueSource, isValueSource } from '../typeSystem/valueSourceFactory.js'
import type { QueryColumns, SqlBuilder } from '../sqlBuilders/SqlBuilder.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { __isBooleanValueSource } from '../typeSystem/valueSource.js'
import type { ValueSource } from '../typeSystem/base.js'
import type { BooleanType } from '../typeSystem/logical.js'
import { __valueSourceTypeNameOf } from '../typeSystem/dataTypes.js'
import { __classOf } from '../nodes/adaptedTypeClass.js'
import { filterThrough } from '../utils/symbols.js'
import { filterOperation } from '../typeSystem/filterOperations.js'

// Joins an accumulated nested-filter path prefix with the next key using a dot
// separator, matching the `column + '.' + key` form used deeper in the builder.
// An empty prefix (the top level) yields the bare key, so single-level paths are
// unchanged.
function joinPath(prefix: string, key: string): string {
    return prefix ? prefix + '.' + key : key
}

export class DynamicConditionBuilder implements DynamicConditionExpression<any, any> {
    sqlBuilder: SqlBuilder
    definition: Filterable
    extension: any

    constructor(sqlBuilder: SqlBuilder, definition: Filterable, extension: any) {
        this.sqlBuilder = sqlBuilder
        this.definition = definition
        this.extension = extension
    }

    withValues(filter: DynamicFilter<any, any>): any {
        // The definition is walked as the columns it holds, nested objects included
        return this.processFilter(filter, this.definition as QueryColumns, this.extension, '')
    }

    processFilter(filter: DynamicFilter<any, any>, definitionColumns: QueryColumns, extension: any, prefix: string): ValueSource<any, BooleanType, any> {
        let result: ValueSource<any, BooleanType, any> = __createIfValueAlwaysNoop('required') as any
        
        if (filter === null || filter === undefined) {
            return result
        }
        if (typeof filter !== 'object' || filter instanceof Date) {
            throw new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_INVALID_FILTER', value: filter, path: prefix }, 'Invalid dynamic filter condition received; an object is expected. Received value: ' + filter)
        }

        for (const key in filter) {
            const value: any = filter[key]
            let condition: ValueSource<any, BooleanType, any>
            if (key === 'and') {
                if (value === null || value === undefined) {
                    continue
                }
                if (!Array.isArray(value)) {
                    throw new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_INVALID_FILTER', value: filter, path: prefix }, 'The and conjunction expect an array as value')
                }
                condition = this.processAndFilter(value, definitionColumns, extension, prefix)
            } else if (key === 'or') {
                if (value === null || value === undefined) {
                    continue
                }
                if (!Array.isArray(value)) {
                    throw new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_INVALID_FILTER', value: filter, path: prefix }, 'The or conjunction expect an array as value')
                }
                condition = this.processOrFilter(value, definitionColumns, extension, prefix)
            } else if (key === 'not') {
                if (value === null || value === undefined) {
                    continue
                }
                condition = this.processFilter(value, definitionColumns, extension, prefix).negate()
            } else if (extension && typeof extension[key] === 'function') {
                if (value === null || value === undefined) {
                    continue
                }
                const extensionResult = extension[key](value)
                if (!isValueSource(extensionResult)) {
                    const error = new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE', processedValue: value, returnedValue: value, path: joinPath(prefix, key), extensionName: key}, 'Invalid return type for the extension ' + joinPath(prefix, key) + '. Expected a boolean value source, but found ' + extensionResult + '. Processed value: ' +  value);
                    (error as any).key = joinPath(prefix, key);
                    (error as any).extensionResult = extensionResult;
                    (error as any).processedValue = value;
                    throw error
                }
                const nodeValueSource = __asNodeValueSource(extensionResult)
                if (!__isBooleanValueSource(nodeValueSource) && !__isIfValueAlwaysNoop(extensionResult)) {
                    const error = new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE', processedValue: value, returnedValue: value, returnedTypeName: __valueSourceTypeNameOf(nodeValueSource), path: joinPath(prefix, key), extensionName: key}, 'Invalid return type for the extension ' + joinPath(prefix, key) + '. Expected a boolean value source, but found a value source with type ' + __valueSourceTypeNameOf(nodeValueSource) + '. Processed value: ' +  value);
                    (error as any).key = joinPath(prefix, key);
                    (error as any).extensionResult = extensionResult;
                    (error as any).processedValue = value;
                    throw error
                }
                condition = extensionResult as any
            } else {
                const column = definitionColumns[key]
                if (!column) {
                    throw new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_UNKNOWN_COLUMN', path: joinPath(prefix, key) }, 'Unknown column with name "' + joinPath(prefix, key) + '" provided as dynamic filter condition')
                }
                if (value === null || value === undefined) {
                    continue
                }
                if (typeof value !== 'object' || value instanceof Date) {
                    throw new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_INVALID_FILTER', value, path: joinPath(prefix, key) }, 'Invalid dynamic filter condition received for the column "' + joinPath(prefix, key) + '"; an object is expected. Received value: ' + value)
                }
                if (isValueSource(column)) {
                    condition = this.processColumnFilter(value, column, extension, joinPath(prefix, key))
                } else {
                    condition = this.processFilter(value, column, extension ? extension[key] : undefined, joinPath(prefix, key))
                }
            }
            result = result.and(condition)
        }
        return result
    }

    processColumnFilter(filter: any, valueSource: any, extension: any, column: string) {
        let result: ValueSource<any, BooleanType, any> = __createIfValueAlwaysNoop('required') as any
        for (const key in filter) {
            const value = filter[key]

            if (extension && typeof extension[key] === 'function') {
                if (value === null || value === undefined) {
                    continue
                }
                const extensionResult = extension[key](value)
                if (!isValueSource(extensionResult)) {
                    const error = new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE', processedValue: value, returnedValue: value, path: column, extensionName: key}, 'Invalid return type for the rule ' + key + ' at ' + column + '. Expected a boolean value source, but found ' + extensionResult + '. Processed value: ' +  value);
                    (error as any).path = column;
                    (error as any).rule = key;
                    (error as any).extensionResult = extensionResult;
                    (error as any).processedValue = value;
                    throw error
                }
                const nodeValueSource = __asNodeValueSource(extensionResult)
                if (!__isBooleanValueSource(nodeValueSource) && !__isIfValueAlwaysNoop(extensionResult)) {
                    const error = new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE', processedValue: value, returnedValue: value, returnedTypeName: __valueSourceTypeNameOf(nodeValueSource), path: column, extensionName: key}, 'Invalid return type for the rule ' + key + ' at ' + column + '. Expected a boolean value source, but found a value source with type ' + __valueSourceTypeNameOf(nodeValueSource) + '. Processed value: ' +  value);
                    (error as any).path = column;
                    (error as any).rule = key;
                    (error as any).extensionResult = extensionResult;
                    (error as any).processedValue = value;
                    throw error
                }
                
                let condition: ValueSource<any, BooleanType, any>  = extensionResult as any
                result = result.and(condition)
                continue
            }

            if (extension && extension[key]) { // This allow to process additional inner properties in a value, allowing make the definition general (with no stop)
                if (value === null || value === undefined) {
                    continue
                }

                let condition = this.processAdditionalColumnFilter(value, extension[key], column + '.' + key)
                result = result.and(condition)
                continue
            }

            // The class of the data type of the column gives the method a name of a filter calls: one it exposes, or
            // the one an alias stands for, like a rule of version 1 that version 2 renamed
            const valueClass = __classOf(valueSource) as unknown as FilterOperationsClass
            let operation = filterMethodOf(valueClass, key)
            let through: FilterThrough | undefined
            if (operation === undefined) {
                // An operation the data type doesn't expose applies to the value it filters through (the text of a uuid)
                through = valueClass[filterThrough]
                operation = through === undefined ? undefined : filterMethodOf(through.dataType, key)
                if (operation === undefined) {
                    throw new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_UNKNOWN_OPERATION', path: column, name: key }, 'Unknown operation with name "' + key + '" for the column "' + column + '" provided as dynamic filter condition')
                }
            }

            if (!this.sqlBuilder._isValue(value)) {
                if (operation !== 'is' && operation !== 'isNot' && !operation.endsWith('IfValue')) {
                    continue
                }
            }
            const receiver = through === undefined ? valueSource : valueSource[through.method]()
            const method = operationFor(receiver, operation, column, key)
            let condition: ValueSource<any, BooleanType, any>
            if (method.length === 0) {
                // An operation without parameters: true applies it, false its negation
                condition = conditionOf(method.call(receiver), value, column, key)
                if (!value) {
                    condition = condition.negate()
                }
            } else {
                condition = conditionOf(method.call(receiver, value), value, column, key)
            }
            result = result.and(condition)
        }
        return result
    }

    processAndFilter(filter: DynamicFilter<any, any>[], definition: QueryColumns, extension: any, prefix: string) {
        let result: ValueSource<any, BooleanType, any> = __createIfValueAlwaysNoop('required') as any
        for (let i = 0, length = filter.length; i < length; i++) {
            const condition = this.processFilter(filter[i]!, definition, extension, prefix)
            result = result.and(condition)
        }
        return result
    }

    processOrFilter(filter: DynamicFilter<any, any>[], definition: QueryColumns, extension: any, prefix: string) {
        let result: ValueSource<any, BooleanType, any> = __createIfValueAlwaysNoop('required') as any
        for (let i = 0, length = filter.length; i < length; i++) {
            const condition = this.processFilter(filter[i]!, definition, extension, prefix)
            result = result.or(condition)
        }
        return result
    }

    processAdditionalColumnFilter(filter: any, extension: any, path: string) {
        let result: ValueSource<any, BooleanType, any> = __createIfValueAlwaysNoop('required') as any
        for (const key in filter) {
            const value = filter[key]

            if (extension && typeof extension[key] === 'function') {
                if (value === null || value === undefined) {
                    continue
                }
                const extensionResult = extension[key](value)
                if (!isValueSource(extensionResult)) {
                    const error = new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE', processedValue: value, returnedValue: value, path, extensionName: key}, 'Invalid return type for the rule ' + key + ' at ' + path + '. Expected a boolean value source, but found ' + extensionResult + '. Processed value: ' +  value);
                    (error as any).path = path;
                    (error as any).rule = key;
                    (error as any).extensionResult = extensionResult;
                    (error as any).processedValue = value;
                    throw error
                }
                const nodeValueSource = __asNodeValueSource(extensionResult)
                if (!__isBooleanValueSource(nodeValueSource) && !__isIfValueAlwaysNoop(extensionResult)) {
                    const error = new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_INVALID_EXTENSION_RETURN_TYPE', processedValue: value, returnedValue: value, returnedTypeName: __valueSourceTypeNameOf(nodeValueSource), path, extensionName: key}, 'Invalid return type for the rule ' + key + ' at ' + path + '. Expected a boolean value source, but found a value source with type ' + __valueSourceTypeNameOf(nodeValueSource) + '. Processed value: ' +  value);
                    (error as any).path = path;
                    (error as any).rule = key;
                    (error as any).extensionResult = extensionResult;
                    (error as any).processedValue = value;
                    throw error
                }
                
                let condition: ValueSource<any, BooleanType, any>  = extensionResult as any
                result = result.and(condition)
                continue
            }

            if (extension && extension[key]) {
                if (value === null || value === undefined) {
                    continue
                }

                let condition = this.processAdditionalColumnFilter(value, extension[key], path + '.' + key)
                result = result.and(condition)
                continue
            }

            throw new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_UNKNOWN_OPERATION', path, name: key }, 'Unknown operation with name "' + key + '" for "' + path + '" provided as dynamic filter condition')
        }
        return result
    }
}

/**
 * The rules of a column filter of version 1 that version 2 renamed, with their name of version 2: they are still
 * applied, so a filter written for version 1, like one sent by another system, keeps working. The types don't declare
 * them: a filter written in code uses the names of version 2
 */
/** A class of a data type, as a dynamic filter asks it which operations it exposes (see exposeFilterOperations) */
interface FilterOperationsClass {
    [filterOperation]?: (operation: string) => string | undefined
    [filterThrough]?: FilterThrough
}

/** The value a data type filters through: the method that gives it, and its data type */
interface FilterThrough {
    method: string
    dataType: FilterOperationsClass
}

/** The method a name of a filter calls on a value of the class, or undefined when the class doesn't expose it */
function filterMethodOf(valueClass: FilterOperationsClass, name: string): string | undefined {
    const methodOf = valueClass[filterOperation]
    return methodOf === undefined ? undefined : methodOf(name)
}

/**
 * The condition an operation of a data type gives: the compiler checks that an exposed method gives one, but a method
 * typed `any`, or code without types, can give something else
 */
function conditionOf(result: unknown, value: unknown, column: string, key: string): ValueSource<any, BooleanType, any> {
    if (isValueSource(result)) {
        const nodeValueSource = __asNodeValueSource(result)
        if (__isBooleanValueSource(nodeValueSource) || __isIfValueAlwaysNoop(result)) {
            return result as ValueSource<any, BooleanType, any>
        }
        const returnedTypeName = __valueSourceTypeNameOf(nodeValueSource)
        throw new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_INVALID_OPERATION_RETURN_TYPE', processedValue: value, returnedTypeName, path: column, name: key }, 'Invalid return type for the operation ' + key + ' at ' + column + '. Expected a boolean value source, but found a value source with type ' + returnedTypeName + '. Processed value: ' + value)
    }
    throw new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_INVALID_OPERATION_RETURN_TYPE', processedValue: value, path: column, name: key }, 'Invalid return type for the operation ' + key + ' at ' + column + '. Expected a boolean value source, but found ' + result + '. Processed value: ' + value)
}

/**
 * The method of the operation of a filter, of the data type of the column: an operation the data type doesn't have is
 * rejected, also when a filter typed from a model offers it (a type of the user written as a plain type in the model)
 */
function operationFor(valueSource: any, operation: string, column: string, key: string): (value?: any) => any {
    const method = valueSource[operation]
    if (typeof method !== 'function') {
        throw new TsSqlProcessingError({ reason: 'DYNAMIC_CONDITION_UNKNOWN_OPERATION', path: column, name: key }, 'Unknown operation with name "' + key + '" for the column "' + column + '" provided as dynamic filter condition')
    }
    return method
}
