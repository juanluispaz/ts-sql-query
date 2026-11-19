import { type OptionalType, __mergeOptional } from '../typeSystem/valueSource.js'
import { isSelectQuery } from './inlineSelect.js'
import type { NodeValueSource } from './NodeStrategy.js'
import { __asNodeValueSource, isValueSource } from './NodeStrategy.js'
import { type AnyType } from '../typeSystem/base.js'

// The optionality of the result of an operation from those of its operands, at run time: the counterpart of
// CombinedOptionality and MergeRequired of typeSystem/valueSource.ts. A value given as a JavaScript value is never
// null, so only an operand that is a value source can make the result optional.

function mergeRequired(op1: OptionalType, op2: OptionalType): OptionalType {
    // The dual of `__mergeOptional`: keep the MORE strict option. See `MergeRequired` in
    // typeSystem/valueSource.ts for why an operation that reads NULL as the empty string merges
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

/** The optionality of an operation that reads a null operand as the empty string (concatIgnoringNull): the more strict of the two; a JavaScript value makes it required */
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

/** The optionality of an operation of the receiver with one operand */
export function getOptionalType2(a: AnyType | NodeValueSource, b: any): OptionalType {
    if (isValueSource(b)) {
        return __mergeOptional((a as NodeValueSource).__optionalType, __asNodeValueSource(b).__optionalType)
    }
    return (a as NodeValueSource).__optionalType
}

/** The optionality of `in` / `notIn`: the one of the receiver, merged with the one of the column of a select, or of a value source given */
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
            return __mergeOptional((a as NodeValueSource).__optionalType, __asNodeValueSource(column).__optionalType)
        }
    }
    return getOptionalType2(a, b)
}

/** The optionality of an operation of the receiver with a list of operands */
export function getOptionalTypeN(a: AnyType | NodeValueSource, values: any[]): OptionalType {
    // The varargs counterpart of `getOptionalType2`, for `inN` / `notInN`. Their operand is the
    // ARRAY the varargs collected, not a value source, so `getOptionalType2` would find no value
    // source in it and answer the receiver's optional type, ignoring the elements. An element that
    // is a value source can be NULL, and `<x> in (1, <null>)` is NULL — not false — when no element
    // matches (SQL's three-valued logic), so every element has to be merged in, exactly as the
    // declared type says (`CombinedOptionality<OPTIONAL_TYPE, VALUE[optionalType]>`). A constant of the
    // language is never NULL, so a list of plain values keeps the receiver's optional type.
    let result = (a as NodeValueSource).__optionalType
    for (let i = 0, length = values.length; i < length; i++) {
        const value = values[i]
        if (isValueSource(value)) {
            result = __mergeOptional(result, __asNodeValueSource(value).__optionalType)
        }
    }
    return result
}

/** The optionality of an operation of the receiver with two operands */
export function getOptionalType3(a: AnyType | NodeValueSource, b: any, c: any): OptionalType {
    let result = (a as NodeValueSource).__optionalType
    if (isValueSource(b)) {
        result = __mergeOptional(result, __asNodeValueSource(b).__optionalType)
    }
    if (isValueSource(c)) {
        result = __mergeOptional(result, __asNodeValueSource(c).__optionalType)
    }
    return result
}

