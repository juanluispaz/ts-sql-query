import { DynamicConditionExpression, DynamicFilter, Filterable } from "../expressions/dynamicConditionUsingFilters";
import { BooleanValueSource, isValueSource, __getValueSourcePrivate } from "../expressions/values";
import { SqlOperationValueSourceIfValueAlwaysNoop } from "../internal/ValueSourceImpl";
import { SqlBuilder } from "../sqlBuilders/SqlBuilder";

export class DynamicConditionBuilder implements DynamicConditionExpression<any> {
    sqlBuilder: SqlBuilder
    definition: Filterable

    constructor(sqlBuilder: SqlBuilder, definition: Filterable) {
        this.sqlBuilder = sqlBuilder
        this.definition = definition
    }

    withValues(filter: DynamicFilter<any>): BooleanValueSource<any, any> {
        return this.processFilter(filter, this.definition, '')
    }

    processFilter(filter: DynamicFilter<any>, definition: Filterable, prefix: string): BooleanValueSource<any, any> {
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
                condition = this.processAndFilter(value, definition, prefix)
            } else if (key === 'or') {
                if (value === null || value === undefined) {
                    continue
                }
                if (!Array.isArray(value)) {
                    throw new Error('The or conjunction expect an array as value')
                }
                condition = this.processOrFilter(value, definition, prefix)
            } else if (key === 'not') {
                if (value === null || value === undefined) {
                    continue
                }
                condition = this.processFilter(value, definition, prefix).negate()
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
                    condition = this.processColumnFilter(value, column, prefix + key)
                } else if (prefix) {
                    condition = this.processFilter(value, column, prefix + ' .' + key)
                } else {
                    condition = this.processFilter(value, column, key)
                }
            }
            result = result.and(condition)
        }
        return result
    }

    processColumnFilter(filter: any, valueSource: any, column: string) {
        let result: BooleanValueSource<any, any> = new SqlOperationValueSourceIfValueAlwaysNoop() as any
        const valueSourcePrivate = __getValueSourcePrivate(valueSource)
        for (const key in filter) {
            if (allowedOpreations[key] !== true || valueSourcePrivate.__aggregatedArrayColumns) { // keep the strict true comparison to avoid false positives
                // aggregated arrays doesn't allows to use any operation
                throw new Error('Invalid operation with name "' + key + '" for the column "' + column + '" provided as dynamic filter condition')
            }
            const value = filter[key]
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
                condition = valueSource[key](value)
            }
            result = result.and(condition)
        }
        return result
    }

    processAndFilter(filter: DynamicFilter<any>[], definition: Filterable, prefix: string) {
        let result: BooleanValueSource<any, any> = new SqlOperationValueSourceIfValueAlwaysNoop() as any
        for (let i = 0, length = filter.length; i < length; i++) {
            const condition = this.processFilter(filter[i]!, definition, prefix)
            result = result.and(condition)
        }
        return result
    }

    processOrFilter(filter: DynamicFilter<any>[], definition: Filterable, prefix: string) {
        let result: BooleanValueSource<any, any> = new SqlOperationValueSourceIfValueAlwaysNoop() as any
        for (let i = 0, length = filter.length; i < length; i++) {
            const condition = this.processFilter(filter[i]!, definition, prefix)
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