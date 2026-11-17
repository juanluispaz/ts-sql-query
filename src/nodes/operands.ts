import { __getOldValues, __getTableOrViewPrivate, __getValuesForInsert, __hasAggregation, __isAllowed, __registerRequiredColumn, __registerTableOrView } from '../utils/ITableOrView.js'
import { __addWiths } from '../utils/ITableOrView.js'
import type { OptionalType, __AggregatedArrayColumns, __AggregatedArrayMode } from '../typeSystem/valueSource.js'
import { isSelectQuery } from './inlineSelect.js'
import type { NodeValueSource } from './NodeStrategy.js'
import { __asNodeValueSource, isValueSource } from './NodeStrategy.js'
import { type AnyType } from '../typeSystem/base.js'

export function mergeOptional(op1: OptionalType, op2: OptionalType): OptionalType {
    if (op1 === 'required') {
        return op2
    } else if (op1 === 'requiredInOptionalObject') {
        if (op2 === 'required') {
            return 'requiredInOptionalObject'
        } else {
            return op2
        }
    } else if (op1 === 'originallyRequired') {
        if (op2 === 'required' || op2 === 'requiredInOptionalObject') {
            return 'originallyRequired'
        } else {
            return op2
        }
    } else {
        return 'optional'
    }
}

function mergeRequired(op1: OptionalType, op2: OptionalType): OptionalType {
    // The dual of `mergeOptional`: keep the MORE strict option. See `MergeRequired` in
    // expressions/values.ts for why an operation that reads NULL as the empty string merges
    // this way.
    if (op1 === 'required' || op2 === 'required') {
        return 'required'
    }
    if (op1 === 'requiredInOptionalObject' || op2 === 'requiredInOptionalObject') {
        return 'requiredInOptionalObject'
    }
    if (op1 === 'originallyRequired' || op2 === 'originallyRequired') {
        return 'originallyRequired'
    }
    return 'optional'
}

export function getRequiredType2(a: AnyType | NodeValueSource, b: any): OptionalType {
    if (isValueSource(b)) {
        return mergeRequired((a as NodeValueSource).__optionalType, __asNodeValueSource(b).__optionalType)
    }
    if (b === null || b === undefined) {
        return (a as NodeValueSource).__optionalType
    }
    // A constant of the language is never NULL, so it alone makes the result always present.
    return 'required'
}

export function getOptionalType2(a: AnyType | NodeValueSource, b: any): OptionalType {
    if (isValueSource(b)) {
        return mergeOptional((a as NodeValueSource).__optionalType, __asNodeValueSource(b).__optionalType)
    }
    return (a as NodeValueSource).__optionalType
}

export function getOptionalTypeOfIn(a: AnyType | NodeValueSource, b: any): OptionalType {
    // A subquery on an optional column can return a NULL, and `<x> in (1, NULL)` is NULL, not false, when no
    // element matches, as the declared type says.
    if (isSelectQuery(b)) {
        let select: any = b
        while (select.__type === 'compound') {
            select = select.__firstQuery
        }
        const column = select.__columns?.['result']
        if (isValueSource(column)) {
            return mergeOptional((a as NodeValueSource).__optionalType, __asNodeValueSource(column).__optionalType)
        }
    }
    return getOptionalType2(a, b)
}

export function getOptionalTypeN(a: AnyType | NodeValueSource, values: any[]): OptionalType {
    // The varargs counterpart of `getOptionalType2`, for `inN` / `notInN`. Their operand is the
    // ARRAY the varargs collected, not a value source, so `getOptionalType2` would find no value
    // source in it and answer the receiver's optional type, ignoring the elements. An element that
    // is a value source can be NULL, and `<x> in (1, <null>)` is NULL — not false — when no element
    // matches (SQL's three-valued logic), so every element has to be merged in, exactly as the
    // declared type says (`MergeOptional<OPTIONAL_TYPE, VALUE[optionalType]>`). A constant of the
    // language is never NULL, so a list of plain values keeps the receiver's optional type.
    let result = (a as NodeValueSource).__optionalType
    for (let i = 0, length = values.length; i < length; i++) {
        const value = values[i]
        if (isValueSource(value)) {
            result = mergeOptional(result, __asNodeValueSource(value).__optionalType)
        }
    }
    return result
}

export function getOptionalType3(a: AnyType | NodeValueSource, b: any, c: any): OptionalType {
    let result = (a as NodeValueSource).__optionalType
    if (isValueSource(b)) {
        result = mergeOptional(result, __asNodeValueSource(b).__optionalType)
    }
    if (isValueSource(c)) {
        result = mergeOptional(result, __asNodeValueSource(c).__optionalType)
    }
    return result
}

