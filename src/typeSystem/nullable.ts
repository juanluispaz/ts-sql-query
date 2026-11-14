import { BaseType, type IValueWithType, type OptionalOf, type SourceOf, type TypeOf, type ValueSource } from './base.js'
import type { BooleanType } from './booleans.js'
import type { ColumnMarkersOf } from './valueSource.js'
import type { operandTypeName } from '../utils/symbols.js'

/** A data type whose value can be null */
export abstract class NullableType</*in|out*/ VALUE_TYPE> extends BaseType<VALUE_TYPE> {
    abstract isConstValue(): boolean
    abstract getConstValue(): VALUE_TYPE
    abstract allowWhen(when: boolean, errorMessage: string): this
    abstract allowWhen(when: boolean, error: Error): this
    abstract disallowWhen(when: boolean, errorMessage: string): this
    abstract disallowWhen(when: boolean, error: Error): this

    abstract isNull(): ValueSource<SourceOf<this>, BooleanType, 'required'>
    abstract isNotNull(): ValueSource<SourceOf<this>, BooleanType, 'required'>
    abstract valueWhenNull(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, 'required'>
    abstract valueWhenNull<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, OptionalOf<VALUE>>
    abstract nullIfValue(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    abstract nullIfValue<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, 'optional'>
    abstract asOptional(): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    abstract asRequiredInOptionalObject(): ValueSource<SourceOf<this>, TypeOf<this>, 'requiredInOptionalObject'> & ColumnMarkersOf<this>
    abstract onlyWhenOrNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    abstract ignoreWhenAsNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
}
