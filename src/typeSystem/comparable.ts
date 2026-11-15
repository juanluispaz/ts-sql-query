import type { CustomType } from '../TypeAdapter.js'
import { __isAggregatedArray, __isBoolean } from './dataTypes.js'
import type { IValueWithType, OptionalOf, SourceOf, ValueSource } from './base.js'
import { EqualableType } from './equalable.js'
import type { IfType, IfValueSource } from './logical.js'
import type { MergeOptional } from './valueSource.js'
import { comparableValueSource, operandTypeName, logicalTypes } from '../utils/symbols.js'
import type { NSource } from '../utils/sourceName.js'
import type { TypedValueSource } from './valueSource.js'
import { BooleanConditionType, BooleanType } from './logical.js'
import { __newSqlOperation1ValueSourceIfValueOrNoop } from '../nodes/ifValue.js'
import { getOptionalType2, getOptionalType3, getTypeAdapter2, getTypeAdapter3 } from '../nodes/operands.js'
import { __newSqlOperation1ValueSource, __newSqlOperation2ValueSource } from '../nodes/operations.js'

/** What a position that takes a value source of any data type with an order accepts (max, min) */
export interface IAnyComparableValueSource</*in|out*/ SOURCE extends NSource> extends TypedValueSource<SOURCE, any, any> {
    [comparableValueSource]: 'ComparableValueSource'
}

/** A data type whose values have an order */
export abstract class ComparableType</*in|out*/ VALUE_TYPE> extends EqualableType<VALUE_TYPE> {
    /** The boolean and the condition the comparisons give (the classes of the bases can't import them) */
    static readonly [logicalTypes] = { boolean: BooleanType, condition: BooleanConditionType }
    /** Whether a type and a custom type are of a comparable data type: every one but a boolean, an enum, a custom and an aggregated array */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return !__isBoolean(type, customType) && !__isAggregatedArray(type, customType) && customType !== 'enum' && customType !== 'custom'
    }

    declare [comparableValueSource]: 'ComparableValueSource'
    declare [logicalTypes]: { boolean: BooleanType, if: IfType }
    lessThanIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    lessThanIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_lessThan', this, value, BooleanConditionType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    lessThan(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    lessThan<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    lessThan(value: any): any {
        return __newSqlOperation1ValueSource('_lessThan', this, value, BooleanConditionType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    greaterThanIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    greaterThanIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_greaterThan', this, value, BooleanConditionType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    greaterThan(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    greaterThan<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    greaterThan(value: any): any {
        return __newSqlOperation1ValueSource('_greaterThan', this, value, BooleanConditionType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    lessOrEqualIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    lessOrEqualIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_lessOrEqual', this, value, BooleanConditionType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    lessOrEqual(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    lessOrEqual<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    lessOrEqual(value: any): any {
        return __newSqlOperation1ValueSource('_lessOrEqual', this, value, BooleanConditionType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    greaterOrEqualIfValue(value: VALUE_TYPE | null | undefined): IfValueSource<SourceOf<this>, OptionalOf<this>>
    greaterOrEqualIfValue(value: any): any {
        return __newSqlOperation1ValueSourceIfValueOrNoop('_greaterOrEqual', this, value, BooleanConditionType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    greaterOrEqual(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    greaterOrEqual<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    greaterOrEqual(value: any): any {
        return __newSqlOperation1ValueSource('_greaterOrEqual', this, value, BooleanConditionType, getOptionalType2(this, value), getTypeAdapter2(this, value))
    }
    between(value: VALUE_TYPE, value2: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    between<VALUE2 extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE_TYPE, value2: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    between<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE, value2: VALUE_TYPE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    between<VALUE extends IValueWithType<this[typeof operandTypeName]>, VALUE2 extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE, value2: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, BooleanType, MergeOptional<MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>, OptionalOf<VALUE2>>>
    between(value: any, value2: any): any {
        return __newSqlOperation2ValueSource('_between', this, value, value2, BooleanConditionType, getOptionalType3(this, value, value2), getTypeAdapter3(this, value, value2))
    }
    notBetween(value: VALUE_TYPE, value2: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanType, OptionalOf<this>>
    notBetween<VALUE2 extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE_TYPE, value2: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE2>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE2>>>
    notBetween<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE, value2: VALUE_TYPE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanType, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    notBetween<VALUE extends IValueWithType<this[typeof operandTypeName]>, VALUE2 extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE, value2: VALUE2): ValueSource<SourceOf<this> | SourceOf<VALUE> | SourceOf<VALUE2>, BooleanType, MergeOptional<MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>, OptionalOf<VALUE2>>>
    notBetween(value: any, value2: any): any {
        return __newSqlOperation2ValueSource('_notBetween', this, value, value2, BooleanConditionType, getOptionalType3(this, value, value2), getTypeAdapter3(this, value, value2))
    }
}
