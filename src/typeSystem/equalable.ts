import type { BooleanOf, IfValueSourceOf, IValueWithType, OptionalOf, SourceOf, ValueSource } from './base.js'
import { NullableType } from './nullable.js'
import type { IExecutableSelectQuery, MergeOptional, MergeOptionalUnion, OptionalType } from './valueSource.js'
import type { NSource } from '../utils/sourceName.js'
import type { optionalType, source } from '../utils/symbols.js'
import type { operandTypeName } from '../utils/symbols.js'

/** A data type whose values can be compared for equality */
export abstract class EqualableType</*in|out*/ VALUE_TYPE> extends NullableType<VALUE_TYPE> {
    abstract equalsIfValue(value: VALUE_TYPE | null | undefined): IfValueSourceOf<this, SourceOf<this>, OptionalOf<this>>
    abstract equals(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanOf<this>, OptionalOf<this>>
    abstract equals<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract notEqualsIfValue(value: VALUE_TYPE | null | undefined): IfValueSourceOf<this, SourceOf<this>, OptionalOf<this>>
    abstract notEquals(value: VALUE_TYPE): ValueSource<SourceOf<this>, BooleanOf<this>, OptionalOf<this>>
    abstract notEquals<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract isIfValue(value: VALUE_TYPE | null | undefined): IfValueSourceOf<this, SourceOf<this>, 'required'>
    abstract is(value: VALUE_TYPE | null | undefined): ValueSource<SourceOf<this>, BooleanOf<this>, 'required'>
    abstract is<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanOf<this>, 'required'>
    abstract isNotIfValue(value: VALUE_TYPE | null | undefined): IfValueSourceOf<this, SourceOf<this>, 'required'>
    abstract isNot(value: VALUE_TYPE | null | undefined): ValueSource<SourceOf<this>, BooleanOf<this>, 'required'>
    abstract isNot<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanOf<this>, 'required'>

    abstract inIfValue(values: VALUE_TYPE[] | null | undefined): IfValueSourceOf<this, SourceOf<this>, OptionalOf<this>>
    abstract in(values: VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanOf<this>, OptionalOf<this>>
    abstract in<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract in<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IValueWithType<this[typeof operandTypeName]>, VALUE_TYPE>): ValueSource<SourceOf<this> | SOURCE2, BooleanOf<this>, OptionalOf<this>>
    abstract in<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IValueWithType<this[typeof operandTypeName]>, VALUE_TYPE | null | undefined>): ValueSource<SourceOf<this> | SOURCE2, BooleanOf<this>, 'optional'>
    abstract notInIfValue(values: VALUE_TYPE[] | null | undefined): IfValueSourceOf<this, SourceOf<this>, OptionalOf<this>>
    abstract notIn(values: VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanOf<this>, OptionalOf<this>>
    abstract notIn<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, BooleanOf<this>, MergeOptional<OptionalOf<this>, OptionalOf<VALUE>>>
    abstract notIn<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IValueWithType<this[typeof operandTypeName]>, VALUE_TYPE>): ValueSource<SourceOf<this> | SOURCE2, BooleanOf<this>, OptionalOf<this>>
    abstract notIn<SOURCE2 extends NSource>(select: IExecutableSelectQuery<SOURCE2, IValueWithType<this[typeof operandTypeName]>, VALUE_TYPE | null | undefined>): ValueSource<SourceOf<this> | SOURCE2, BooleanOf<this>, 'optional'>
    abstract inN(...value: VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanOf<this>, OptionalOf<this>>
    abstract inN<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(...value: Array<VALUE_TYPE | (IValueWithType<this[typeof operandTypeName]> & { [source]: SOURCE2, [optionalType]: OPTIONAL_TYPE2 })>): ValueSource<SourceOf<this> | SOURCE2, BooleanOf<this>, MergeOptional<OptionalOf<this>, MergeOptionalUnion<OPTIONAL_TYPE2>>>
    abstract notInN(...value: VALUE_TYPE[]): ValueSource<SourceOf<this>, BooleanOf<this>, OptionalOf<this>>
    abstract notInN<SOURCE2 extends NSource, OPTIONAL_TYPE2 extends OptionalType>(...value: Array<VALUE_TYPE | (IValueWithType<this[typeof operandTypeName]> & { [source]: SOURCE2, [optionalType]: OPTIONAL_TYPE2 })>): ValueSource<SourceOf<this> | SOURCE2, BooleanOf<this>, MergeOptional<OptionalOf<this>, MergeOptionalUnion<OPTIONAL_TYPE2>>>
}
