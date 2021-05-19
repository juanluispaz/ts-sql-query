import { DynamicConditionExpression, DynamicFilter, Filterable } from "../expressions/dynamicConditionUsingFilters";
import { BooleanValueSource, isValueSource } from "../expressions/values";
import { SqlOperationValueSourceIfValueAlwaysNoop } from "../internal/ValueSourceImpl";

export class DynamicConditionBuilder implements DynamicConditionExpression<any> {
    definition: Filterable

    constructor(definition: Filterable) {
        this.definition = definition
    }

    withValues(filter: DynamicFilter<any>): BooleanValueSource<any, any> {
        const definition = this.definition
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
                condition = this.processAndFilter(value)
            } else if (key === 'or') {
                if (value === null || value === undefined) {
                    continue
                }
                if (!Array.isArray(value)) {
                    throw new Error('The or conjunction expect an array as value')
                }
                condition = this.processOrFilter(value)
            } else if (key === 'not') {
                if (value === null || value === undefined) {
                    continue
                }
                condition = this.withValues(value).negate()
            } else {
                const column = definition[key]
                if (!isValueSource(column)) {
                    throw new Error('Unknown column with name "' + key + '" provided as dynamic filter condition')
                }
                if (value === null || value === undefined) {
                    continue
                }
                if (typeof value !== 'object' || value instanceof Date) {
                    throw new Error('Invalid dynamic filter condition received for the column "' + key + '"; an object is expected. Received value: ' + value)
                }
                condition = this.processColumnFilter(column, value, key)
            }
            result = result.and(condition)
        }
        return result
    }

    processColumnFilter(valueSource: any, filter: any, column: string) {
        let result: BooleanValueSource<any, any> = new SqlOperationValueSourceIfValueAlwaysNoop() as any
        for (const key in filter) {
            if (allowedOpreations[key] !== true) { // keep the strict true comparison to avoid false positives
                throw new Error('Invalid operation with name "' + key + '" for the column "' + column + '" provided as dynamic filter condition')
            }
            const value = filter[key]
            let condition: BooleanValueSource<any, any>
            if (key === 'isNull' || key === 'isNotNull') {
                condition = valueSource[key]()
                if (!value) {
                    condition = condition.negate()
                }
            } else {
                condition = valueSource[key](value)
            }
            result = result.and(condition)
        }
        return result
    }

    processAndFilter(filter: DynamicFilter<any>[]) {
        let result: BooleanValueSource<any, any> = new SqlOperationValueSourceIfValueAlwaysNoop() as any
        for (let i = 0, length = filter.length; i < length; i++) {
            const condition = this.withValues(filter[i]!!)
            result = result.and(condition)
        }
        return result
    }

    processOrFilter(filter: DynamicFilter<any>[]) {
        let result: BooleanValueSource<any, any> = new SqlOperationValueSourceIfValueAlwaysNoop() as any
        for (let i = 0, length = filter.length; i < length; i++) {
            const condition = this.withValues(filter[i]!!)
            result = result.or(condition)
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
    smallerIfValue: true,
    smaller: true,
    largerIfValue: true,
    larger: true,
    smallAsIfValue: true,
    smallAs: true,
    largeAsIfValue: true,
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