import { DynamicConditionExpression, DynamicFilter, Filterable } from "../expressions/dynamicConditionUsingFilters";
import { BooleanValueSource, isValueSource, __getValueSourcePrivate, __isUuidValueSource, __isBooleanValueSource } from "../expressions/values";
import { SqlOperationValueSourceIfValueAlwaysNoop } from "../internal/ValueSourceImpl";
import { SqlBuilder } from "../sqlBuilders/SqlBuilder";

export class DynamicConditionBuilder implements DynamicConditionExpression<any, any> {
    sqlBuilder: SqlBuilder
    definition: Filterable
    extension: any

    constructor(sqlBuilder: SqlBuilder, definition: Filterable, extension: any) {
        this.sqlBuilder = sqlBuilder
        this.definition = definition
        this.extension = extension
    }

    withValues(filter: DynamicFilter<any>): BooleanValueSource<any, any> {
        return this.processFilter(filter, this.definition, this.extension, '')
    }

    processFilter(filter: DynamicFilter<any>, definition: Filterable, extension: any, prefix: string): BooleanValueSource<any, any> {
        let result: BooleanValueSource<any, any> = new SqlOperationValueSourceIfValueAlwaysNoop() as any
        
        if (filter === null || filter === undefined) {
            return result
        }
        if (typeof filter !== 'object' || filter instanceof Date) {
            throw new Error('Invalid dynamic filter condition received; an object is expected. Received value: ' + filter)
        }

        for (const key in filter) {
            const value: any = filter[key]
            let condition: BooleanValueSource<any, any>
            if (key === 'and') {
                if (value === null || value === undefined) {
                    continue
                }
                if (!Array.isArray(value)) {
                    throw new Error('The and conjunction expect an array as value')
                }
                condition = this.processAndFilter(value, definition, extension, prefix)
            } else if (key === 'or') {
                if (value === null || value === undefined) {
                    continue
                }
                if (!Array.isArray(value)) {
                    throw new Error('The or conjunction expect an array as value')
                }
                condition = this.processOrFilter(value, definition, extension, prefix)
            } else if (key === 'not') {
                if (value === null || value === undefined) {
                    continue
                }
                condition = this.processFilter(value, definition, extension, prefix).negate()
            } else if (extension && typeof extension[key] === 'function') {
                if (value === null || value === undefined) {
                    continue
                }
                const extensionResult = extension[key](value)
                if (!isValueSource(extensionResult)) {
                    const error = new Error('Invalid return type for the extension ' + prefix + key + '. Expected a boolean value source, but found ' + extensionResult + '. Processed value: ' +  value);
                    (error as any).key = prefix + key;
                    (error as any).extensionResult = extensionResult;
                    (error as any).processedValue = value;
                    throw error
                }
                const valueSourcePrivate = __getValueSourcePrivate(extensionResult)
                if (!__isBooleanValueSource(valueSourcePrivate)) {
                    const error = new Error('Invalid return type for the extension ' + prefix + key + '. Expected a boolean value source, but found a value source with type ' + valueSourcePrivate.__valueTypeName + '. Processed value: ' +  value);
                    (error as any).key = prefix + key;
                    (error as any).extensionResult = extensionResult;
                    (error as any).processedValue = value;
                    throw error
                }
                condition = extensionResult as any
            } else {
                const column = definition[key]
                if (!column) {
                    throw new Error('Unknown column with name "' + prefix + key + '" provided as dynamic filter condition')
                }
                if (value === null || value === undefined) {
                    continue
                }
                if (typeof value !== 'object' || value instanceof Date) {
                    throw new Error('Invalid dynamic filter condition received for the column "' + prefix + key + '"; an object is expected. Received value: ' + value)
                }
                if (isValueSource(column)) {
                    condition = this.processColumnFilter(value, column, extension, prefix + key)
                } else if (prefix) {
                    condition = this.processFilter(value, column, extension ? extension[key] : undefined, prefix + ' .' + key)
                } else {
                    condition = this.processFilter(value, column, extension ? extension[key] : undefined, key)
                }
            }
            result = result.and(condition)
        }
        return result
    }

    processColumnFilter(filter: any, valueSource: any, extension: any, column: string) {
        let result: BooleanValueSource<any, any> = new SqlOperationValueSourceIfValueAlwaysNoop() as any
        const valueSourcePrivate = __getValueSourcePrivate(valueSource)
        for (const key in filter) {
            const value = filter[key]

            if (extension && typeof extension[key] === 'function') {
                if (value === null || value === undefined) {
                    continue
                }
                const extensionResult = extension[key](value)
                if (!isValueSource(extensionResult)) {
                    const error = new Error('Invalid return type for the rule ' + key + ' at ' + column + '. Expected a boolean value source, but found ' + extensionResult + '. Processed value: ' +  value);
                    (error as any).path = column;
                    (error as any).rule = key;
                    (error as any).extensionResult = extensionResult;
                    (error as any).processedValue = value;
                    throw error
                }
                const valueSourcePrivate = __getValueSourcePrivate(extensionResult)
                if (!__isBooleanValueSource(valueSourcePrivate)) {
                    const error = new Error('Invalid return type for the rule ' + key + ' at ' + column + '. Expected a boolean value source, but found a value source with type ' + valueSourcePrivate.__valueTypeName + '. Processed value: ' +  value);
                    (error as any).path = column;
                    (error as any).rule = key;
                    (error as any).extensionResult = extensionResult;
                    (error as any).processedValue = value;
                    throw error
                }
                
                let condition: BooleanValueSource<any, any>  = extensionResult as any
                result = result.and(condition)
                continue
            }

            if (extension && extension[key]) { // This allow to process additional inner properties in a value, allowing make the definition general (with no stop)
                if (value === null || value === undefined) {
                    continue
                }

                let condition = this.processAdditionalColumnFilter(filter, extension[key], column + '.' + key)
                result = result.and(condition)
                continue
            }

            if (allowedOpreations[key] !== true || valueSourcePrivate.__aggregatedArrayColumns) { // keep the strict true comparison to avoid false positives
                // aggregated arrays doesn't allows to use any operation
                throw new Error('Invalid operation with name "' + key + '" for the column "' + column + '" provided as dynamic filter condition')
            }

            if (!this.sqlBuilder._isValue(value)) {
                if (key !== 'is' && key !== 'isNot' && !key.endsWith('IfValue')) {
                    continue
                }
            }
            let condition: BooleanValueSource<any, any>
            if (key === 'isNull' || key === 'isNotNull') {
                condition = valueSource[key]()
                if (!value) {
                    condition = condition.negate()
                }
            } else {
                if (__isUuidValueSource(valueSourcePrivate) && useAsStringInUuid[key]) {
                    condition = valueSource.asString()[key](value)
                } else {
                    condition = valueSource[key](value)
                }
            }
            result = result.and(condition)
        }
        return result
    }

    processAndFilter(filter: DynamicFilter<any>[], definition: Filterable, extension: any, prefix: string) {
        let result: BooleanValueSource<any, any> = new SqlOperationValueSourceIfValueAlwaysNoop() as any
        for (let i = 0, length = filter.length; i < length; i++) {
            const condition = this.processFilter(filter[i]!, definition, extension, prefix)
            result = result.and(condition)
        }
        return result
    }

    processOrFilter(filter: DynamicFilter<any>[], definition: Filterable, extension: any, prefix: string) {
        let result: BooleanValueSource<any, any> = new SqlOperationValueSourceIfValueAlwaysNoop() as any
        for (let i = 0, length = filter.length; i < length; i++) {
            const condition = this.processFilter(filter[i]!, definition, extension, prefix)
            result = result.or(condition)
        }
        return result
    }

    processAdditionalColumnFilter(filter: any, extension: any, path: string) {
        let result: BooleanValueSource<any, any> = new SqlOperationValueSourceIfValueAlwaysNoop() as any
        for (const key in filter) {
            const value = filter[key]

            if (extension && typeof extension[key] === 'function') {
                if (value === null || value === undefined) {
                    continue
                }
                const extensionResult = extension[key](value)
                if (!isValueSource(extensionResult)) {
                    const error = new Error('Invalid return type for the rule ' + key + ' at ' + path + '. Expected a boolean value source, but found ' + extensionResult + '. Processed value: ' +  value);
                    (error as any).path = path;
                    (error as any).rule = key;
                    (error as any).extensionResult = extensionResult;
                    (error as any).processedValue = value;
                    throw error
                }
                const valueSourcePrivate = __getValueSourcePrivate(extensionResult)
                if (!__isBooleanValueSource(valueSourcePrivate)) {
                    const error = new Error('Invalid return type for the rule ' + key + ' at ' + path + '. Expected a boolean value source, but found a value source with type ' + valueSourcePrivate.__valueTypeName + '. Processed value: ' +  value);
                    (error as any).path = path;
                    (error as any).rule = key;
                    (error as any).extensionResult = extensionResult;
                    (error as any).processedValue = value;
                    throw error
                }
                
                let condition: BooleanValueSource<any, any>  = extensionResult as any
                result = result.and(condition)
                continue
            }

            if (extension && extension[key]) {
                if (value === null || value === undefined) {
                    continue
                }

                let condition = this.processAdditionalColumnFilter(filter, extension[key], path + '.' + key)
                result = result.and(condition)
                continue
            }
        }
        return result
    }
}

const allowedOpreations: { [operation: string]: true | undefined } = {
    isNull: true,
    isNotNull: true,
    equalsIfValue: true,
    equals: true,
    notEqualsIfValue: true,
    notEquals: true,
    isIfValue: true,
    is: true,
    isNotIfValue: true,
    isNot: true,
    inIfValue: true,
    in: true,
    notInIfValue: true,
    notIn: true,
    lessThanIfValue: true,
    lessThan: true,
    greaterThanIfValue: true,
    greaterThan: true,
    lessOrEqualsIfValue: true,
    lessOrEquals: true,
    greaterOrEqualsIfValue: true,
    greaterOrEquals: true,
    /** @deprecated use lessThanIfValue instead */
    smallerIfValue: true,
    /** @deprecated use lessThan instead */
    smaller: true,
    /** @deprecated use greaterThanIfValue instead */
    largerIfValue: true,
    /** @deprecated use greaterThan instead */
    larger: true,
    /** @deprecated use lessOrEqualsIfValue instead */
    smallAsIfValue: true,
    /** @deprecated use lessOrEquals instead */
    smallAs: true,
    /** @deprecated use greaterOrEqualsIfValue instead */
    largeAsIfValue: true,
    /** @deprecated use greaterOrEquals instead */
    largeAs: true,
    equalsInsensitiveIfValue: true,
    equalsInsensitive: true,
    notEqualsInsensitiveIfValue: true,
    likeIfValue: true,
    like: true,
    notLikeIfValue: true,
    notLike: true,
    likeInsensitiveIfValue: true,
    likeInsensitive: true,
    notLikeInsensitiveIfValue: true,
    notLikeInsensitive: true,
    startsWithIfValue: true,
    startsWith: true,
    notStartsWithIfValue: true,
    notStartsWith: true,
    endsWithIfValue: true,
    endsWith: true,
    notEndsWithIfValue: true,
    notEndsWith: true,
    startsWithInsensitiveIfValue: true,
    startsWithInsensitive: true,
    notStartsWithInsensitiveIfValue: true,
    notStartsWithInsensitive: true,
    endsWithInsensitiveIfValue: true,
    endsWithInsensitive: true,
    notEndsWithInsensitiveIfValue: true,
    notEndsWithInsensitive: true,
    containsIfValue: true,
    contains: true,
    notContainsIfValue: true,
    notContains: true,
    containsInsensitiveIfValue: true,
    containsInsensitive: true,
    notContainsInsensitiveIfValue: true,
    notContainsInsensitive: true
}

const useAsStringInUuid: { [operation: string]: true | undefined } = {
    equalsInsensitiveIfValue: true,
    equalsInsensitive: true,
    notEqualsInsensitiveIfValue: true,
    likeIfValue: true,
    like: true,
    notLikeIfValue: true,
    notLike: true,
    likeInsensitiveIfValue: true,
    likeInsensitive: true,
    notLikeInsensitiveIfValue: true,
    notLikeInsensitive: true,
    startsWithIfValue: true,
    startsWith: true,
    notStartsWithIfValue: true,
    notStartsWith: true,
    endsWithIfValue: true,
    endsWith: true,
    notEndsWithIfValue: true,
    notEndsWith: true,
    startsWithInsensitiveIfValue: true,
    startsWithInsensitive: true,
    notStartsWithInsensitiveIfValue: true,
    notStartsWithInsensitive: true,
    endsWithInsensitiveIfValue: true,
    endsWithInsensitive: true,
    notEndsWithInsensitiveIfValue: true,
    notEndsWithInsensitive: true,
    containsIfValue: true,
    contains: true,
    notContainsIfValue: true,
    notContains: true,
    containsInsensitiveIfValue: true,
    containsInsensitive: true,
    notContainsInsensitiveIfValue: true,
    notContainsInsensitive: true
}