import { DynamicConditionExpression, DynamicFilter, Filterable } from "../expressions/dynamicConditionUsingFilters";
import { BooleanValueSource } from "../expressions/values";
import { SqlOperationValueSourceIfValueAlwaysNoop } from "../internal/ValueSourceImpl";

export class DynamicConditionBuilder implements DynamicConditionExpression<any> {
    definition: Filterable

    constructor(definition: Filterable) {
        this.definition = definition
    }

    withValues(filter: DynamicFilter<any>): BooleanValueSource<any, any> {
        const definition = this.definition
        let result: BooleanValueSource<any, any> = new SqlOperationValueSourceIfValueAlwaysNoop() as any
        for (const key in filter) {
            const value: any = filter[key]
            let condition: BooleanValueSource<any, any>
            if (key === 'and') {
                condition = this.processAndFilter(value)
            } else if (key === 'or') {
                condition = this.processOrFilter(value)
            } else if (key === 'not') {
                condition = this.withValues(value).negate()
            } else {
                const column = definition[key]
                condition = this.processColumnFilter(column, value)
            }
            result = result.and(condition)
        }
        return result
    }

    processColumnFilter(valueSource: any, filter: any) {
        let result: BooleanValueSource<any, any> = new SqlOperationValueSourceIfValueAlwaysNoop() as any
        for (const key in filter) {
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