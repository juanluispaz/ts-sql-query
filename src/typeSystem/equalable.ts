import type { IValueWithType, OptionalityOf, SourceOf, ValueSource } from './base.js'
import { NullableType } from './nullable.js'
import type { BooleanType, IfValueSource } from './logical.js'
import type { IExecutableSelectQuery, CombinedOptionality, CombinedOptionalityOfUnion, OptionalType } from './valueSource.js'
import type { NSource } from '../utils/sourceName.js'
import type { optionalType, source } from '../utils/symbols.js'
import type { operandTypeName, typeName } from '../utils/symbols.js'
import { exposeFilterOperations, filterOperation } from './filterOperations.js'
import { __newSqlOperation1ValueSourceIfValueOrNoop, __newSqlOperationInValueSourceIfValueOrNoop } from '../nodes/ifValue.js'
import { getOptionalType2, getOptionalTypeN, getOptionalTypeOfIn } from '../nodes/operands.js'
import { __newSqlOperation1ValueSource, __newSqlOperationInValueSource } from '../nodes/operations.js'
import { __internalDataType } from './dataTypeRegistry.js'

/**
 * A data type whose values can be compared for equality. A data type of the user extends it with its type name, as a
 * value that only the user knows (the library converts nothing and gives it no SQL data type):
 * `class StatusType extends EqualableType<Status, 'Status'> { static override readonly type = 'Status' }`
 */
export abstract class EqualableType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends NullableType<VALUE_TYPE> {
    declare [typeName]: `type:${TYPE_NAME}:`
    declare [operandTypeName]: `type:${TYPE_NAME}:`
    static override readonly [filterOperation] = exposeFilterOperations(this, NullableType, [
        'equalsIfValue', 'equals', 'notEqualsIfValue', 'notEquals', 'isIfValue', 'is', 'isNotIfValue', 'isNot',
        'inIfValue', 'in', 'notInIfValue', 'notIn',
    ])
    declare [filterOperation]: (typeof EqualableType)[typeof filterOperation]

    equalsIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    equalsIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_equals', this, value, __internalDataType('condition'), getOptionalType2(this, value))
    }
    equals(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    equals<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    equals(value: any): any {
        return __newSqlOperation1ValueSource('_equals', this, value, __internalDataType('condition'), getOptionalType2(this, value))
    }
    notEqualsIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notEqualsIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notEquals', this, value, __internalDataType('condition'), getOptionalType2(this, value))
    }
    notEquals(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    notEquals<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notEquals(value: any): any {
        return __newSqlOperation1ValueSource('_notEquals', this, value, __internalDataType('condition'), getOptionalType2(this, value))
    }
    isIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, 'required'>
    /* The `is`/`isNot` family is a TOTAL predicate: `IS [NOT] DISTINCT FROM` (and the per-dialect emulation of it)
     * answers true or false even when an operand is NULL — which is the reason to reach for it instead of `equals`.
     * So the result is ALWAYS `'required'`, whatever the receiver and the operand are. Merging them, the way an
     * ordinary comparison does (`getOptionalType2`), would report a NULL the operator cannot produce, and that
     * over-report reaches the SQL: the dialects with no native boolean in a projected position would emit the
     * 3-branch `case … else null end` with an unreachable branch. The `*IfValue` twins carry the same `'required'`
     * into the neutral they become when the operand has no value — a neutral inherits the optional type of the
     * expression it stands for, and for a total predicate that is `'required'`. */
    isIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_is', this, value, __internalDataType('condition'), 'required')
    }
    is(value: VALUE_TYPE | null | undefined): ValueSource<SourceOf<this>, BooleanType, 'required'>
    is<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, 'required'>
    is(value: any): any {
        return __newSqlOperation1ValueSource('_is', this, value, __internalDataType('condition'), 'required')
    }
    isNotIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, 'required'>
    isNotIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_isNot', this, value, __internalDataType('condition'), 'required')
    }
    isNot(value: VALUE_TYPE | null | undefined): ValueSource<SourceOf<this>, BooleanType, 'required'>
    isNot<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, 'required'>
    isNot(value: any): any {
        return __newSqlOperation1ValueSource('_isNot', this, value, __internalDataType('condition'), 'required')
    }

    inIfValue(values: readonly VALUE_TYPE[] | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    inIfValue(value: any): any {
        return __newSqlOperationInValueSourceIfValueOrNoop('_in', this, value, __internalDataType('condition'), getOptionalType2(this, value))
    }
    in(values: readonly VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    in<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    in<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IValueWithType<this[typeof operandTypeName]>, VALUE_TYPE>): ValueSource<SourceOf<this> | SOURCE2, BooleanType, OptionalityOf<this>>
    in<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IValueWithType<this[typeof operandTypeName]>, VALUE_TYPE | null | undefined>): ValueSource<SourceOf<this> | SOURCE2, BooleanType, 'optional'>
    in(value: any): any {
        return __newSqlOperationInValueSource('_in', this, value, __internalDataType('condition'), getOptionalTypeOfIn(this, value))
    }
    notInIfValue(values: readonly VALUE_TYPE[] | null | undefined): IfValueSource<SourceOf<this>, OptionalityOf<this>>
    notInIfValue(value: any): any {
        return __newSqlOperationInValueSourceIfValueOrNoop('_notIn', this, value, __internalDataType('condition'), getOptionalType2(this, value))
    }
    notIn(values: readonly VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    notIn<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    notIn<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IValueWithType<this[typeof operandTypeName]>, VALUE_TYPE>): ValueSource<SourceOf<this> | SOURCE2, BooleanType, OptionalityOf<this>>
    notIn<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IValueWithType<this[typeof operandTypeName]>, VALUE_TYPE | null | undefined>): ValueSource<SourceOf<this> | SOURCE2, BooleanType, 'optional'>
    notIn(value: any): any {
        return __newSqlOperationInValueSource('_notIn', this, value, __internalDataType('condition'), getOptionalTypeOfIn(this, value))
    }
    inN(...value: VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    inN<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(...value: Array<VALUE_TYPE | (IValueWithType<this[typeof operandTypeName]> & { [source]: SOURCE2, [optionalType]: OPTIONAL_TYPE2 })>): ValueSource<SourceOf<this> | SOURCE2, BooleanType, CombinedOptionality<OptionalityOf<this>, CombinedOptionalityOfUnion<OPTIONAL_TYPE2>>>
    inN(...value: any[]): any {
        return __newSqlOperationInValueSource('_in', this, value, __internalDataType('condition'), getOptionalTypeN(this, value))
    }
    notInN(...value: VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanType, OptionalityOf<this>>
    notInN<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(...value: Array<VALUE_TYPE | (IValueWithType<this[typeof operandTypeName]> & { [source]: SOURCE2, [optionalType]: OPTIONAL_TYPE2 })>): ValueSource<SourceOf<this> | SOURCE2, BooleanType, CombinedOptionality<OptionalityOf<this>, CombinedOptionalityOfUnion<OPTIONAL_TYPE2>>>
    notInN(...value: any[]): any {
        return __newSqlOperationInValueSource('_notIn', this, value, __internalDataType('condition'), getOptionalTypeN(this, value))
    }
}
