import type { BooleanOf, IfValueSourceOf, IValueWithType, OptionalOf, SourceOf, ValueSource } from './base.js'
import { NullableType } from './nullable.js'
import type { IExecutableSelectQuery, MergeOptional, MergeOptionalUnion, OptionalType } from './valueSource.js'
import type { NSource } from '../utils/sourceName.js'
import type { optionalType, source } from '../utils/symbols.js'
import type { operandTypeName } from '../utils/symbols.js'
import { __newSqlOperation1ValueSourceIfValueOrNoop, __newSqlOperationInValueSourceIfValueOrNoop } from '../nodes/ifValue.js'
import { getOptionalType2, getOptionalTypeN, getOptionalTypeOfIn, getTypeAdapter2 } from '../nodes/operands.js'
import { __newSqlOperation1NotOptionalValueSource, __newSqlOperation1ValueSource, __newSqlOperationInValueSource } from '../nodes/operations.js'
import { type ValueSourceRoot } from '../nodes/valueSourceRoot.js'
import { __conditionTypeOf } from './valueSourceBase.js'

/** A data type whose values can be compared for equality */
export abstract class EqualableType</*in|out*/ VALUE_TYPE> extends NullableType<VALUE_TYPE> {
    equalsIfValue(value: VALUE_TYPE | null | undefined): IfValueSourceOf<this, SourceOf<this>, OptionalOf<this>>
    equalsIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_equals', vs, value, __conditionTypeOf(vs), getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    equals(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanOf<this>, OptionalOf<this>>
    equals<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    equals(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_equals', vs, value, __conditionTypeOf(vs), getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notEqualsIfValue(value: VALUE_TYPE | null | undefined): IfValueSourceOf<this, SourceOf<this>, OptionalOf<this>>
    notEqualsIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_notEquals', vs, value, __conditionTypeOf(vs), getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notEquals(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanOf<this>, OptionalOf<this>>
    notEquals<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notEquals(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSource('_notEquals', vs, value, __conditionTypeOf(vs), getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    isIfValue(value: VALUE_TYPE | null | undefined): IfValueSourceOf<this, SourceOf<this>, 'required'>
    /* The `is`/`isNot` family is a TOTAL predicate: `IS [NOT] DISTINCT FROM` (and the per-dialect emulation of it)
     * answers true or false even when an operand is NULL — which is the reason to reach for it instead of `equals`.
     * So the result is ALWAYS `'required'`, whatever the receiver and the operand are. Merging them, the way an
     * ordinary comparison does (`getOptionalType2`), would report a NULL the operator cannot produce, and that
     * over-report reaches the SQL: the dialects with no native boolean in a projected position would emit the
     * 3-branch `case … else null end` with an unreachable branch. The `*IfValue` twins carry the same `'required'`
     * into the neutral they become when the operand has no value — a neutral inherits the optional type of the
     * expression it stands for, and for a total predicate that is `'required'`. */
    isIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_is', vs, value, __conditionTypeOf(vs), 'required', getTypeAdapter2(vs, value))
    }
    is(value: VALUE_TYPE | null | undefined): ValueSource<SourceOf<this>, BooleanOf<this>, 'required'>
    is<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanOf<this>, 'required'>
    is(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1NotOptionalValueSource('_is', vs, value, __conditionTypeOf(vs), 'required', getTypeAdapter2(vs, value))
    }
    isNotIfValue(value: VALUE_TYPE | null | undefined): IfValueSourceOf<this, SourceOf<this>, 'required'>
    isNotIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1ValueSourceIfValueOrNoop('_isNot', vs, value, __conditionTypeOf(vs), 'required', getTypeAdapter2(vs, value))
    }
    isNot(value: VALUE_TYPE | null | undefined): ValueSource<SourceOf<this>, BooleanOf<this>, 'required'>
    isNot<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanOf<this>, 'required'>
    isNot(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperation1NotOptionalValueSource('_isNot', vs, value, __conditionTypeOf(vs), 'required', getTypeAdapter2(vs, value))
    }

    inIfValue(values: VALUE_TYPE[] | null | undefined): IfValueSourceOf<this, SourceOf<this>, OptionalOf<this>>
    inIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperationInValueSourceIfValueOrNoop('_in', vs, value, __conditionTypeOf(vs), getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    in(values: VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanOf<this>, OptionalOf<this>>
    in<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    in<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IValueWithType<this[typeof operandTypeName]>, VALUE_TYPE>): ValueSource<SourceOf<this> | SOURCE2, BooleanOf<this>, OptionalOf<this>>
    in<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IValueWithType<this[typeof operandTypeName]>, VALUE_TYPE | null | undefined>): ValueSource<SourceOf<this> | SOURCE2, BooleanOf<this>, 'optional'>
    in(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperationInValueSource('_in', vs, value, __conditionTypeOf(vs), getOptionalTypeOfIn(vs, value), getTypeAdapter2(vs, value))
    }
    notInIfValue(values: VALUE_TYPE[] | null | undefined): IfValueSourceOf<this, SourceOf<this>, OptionalOf<this>>
    notInIfValue(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperationInValueSourceIfValueOrNoop('_notIn', vs, value, __conditionTypeOf(vs), getOptionalType2(vs, value), getTypeAdapter2(vs, value))
    }
    notIn(values: VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanOf<this>, OptionalOf<this>>
    notIn<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notIn<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IValueWithType<this[typeof operandTypeName]>, VALUE_TYPE>): ValueSource<SourceOf<this> | SOURCE2, BooleanOf<this>, OptionalOf<this>>
    notIn<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IValueWithType<this[typeof operandTypeName]>, VALUE_TYPE | null | undefined>): ValueSource<SourceOf<this> | SOURCE2, BooleanOf<this>, 'optional'>
    notIn(value: any): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperationInValueSource('_notIn', vs, value, __conditionTypeOf(vs), getOptionalTypeOfIn(vs, value), getTypeAdapter2(vs, value))
    }
    inN(...value: VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanOf<this>, OptionalOf<this>>
    inN<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(...value: Array<VALUE_TYPE | (IValueWithType<this[typeof operandTypeName]> & { [source]: SOURCE2, [optionalType]: OPTIONAL_TYPE2 })>): ValueSource<SourceOf<this> | SOURCE2, BooleanOf<this>, MergeOptional<OptionalOf<this>, MergeOptionalUnion<OPTIONAL_TYPE2>>>
    inN(...value: any[]): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperationInValueSource('_in', vs, value, __conditionTypeOf(vs), getOptionalTypeN(vs, value), getTypeAdapter2(vs, value))
    }
    notInN(...value: VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanOf<this>, OptionalOf<this>>
    notInN<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(...value: Array<VALUE_TYPE | (IValueWithType<this[typeof operandTypeName]> & { [source]: SOURCE2, [optionalType]: OPTIONAL_TYPE2 })>): ValueSource<SourceOf<this> | SOURCE2, BooleanOf<this>, MergeOptional<OptionalOf<this>, MergeOptionalUnion<OPTIONAL_TYPE2>>>
    notInN(...value: any[]): any {
        const vs = this as unknown as ValueSourceRoot
        return __newSqlOperationInValueSource('_notIn', vs, value, __conditionTypeOf(vs), getOptionalTypeN(vs, value), getTypeAdapter2(vs, value))
    }
}
