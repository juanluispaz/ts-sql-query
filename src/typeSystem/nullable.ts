import type { CustomType } from '../TypeAdapter.js'
import { __isAggregatedArray } from './dataTypes.js'
import type { AnyType, BooleanOf, IValueWithType, OptionalOf, SourceOf, TypeOf, ValueSource } from './base.js'
import { ValueSourceBaseType } from './valueSourceBase.js'
import type { ColumnMarkersOf } from './valueSource.js'
import type { numberTypes, operandTypeName } from '../utils/symbols.js'
import { __sameTypeClassOf, __builtInTypeOf, __newNoopValueSource, __newSqlOperation1ValueSource, __newSqlOperationIsNullValueSource, __newSqlOperationValueWhenNullValueSource, __typeClassOf, getOptionalType2, getTypeAdapter2, type ValueSourceImpl, __asRequiredInOptionalObjectOf, __ignoreWhenAsNullOf, __onlyWhenOrNullOf } from '../internal/ValueSourceImpl.js'
import { __getValueSourcePrivate, isValueSource } from './valueSource.js'
import { __isDouble } from './dataTypes.js'
import { OracleDateAsTimestampTypeAdapter } from '../TypeAdapter.js'

/** The data types of the group number (declared with `numberTypes` by NumberType) */
export interface NumberTypes {
    number: AnyType
    int: AnyType
    double: AnyType
}

/**
 * The data type of the value of a null replaced by a fallback: the data type of the value source, but a number widens
 * like in an operation (coalesce(<int>, <double>) is a double). OPERAND is the data type of the fallback, or
 * `'value'` for a value given as a JavaScript value (a number can be either an int or a double)
 */
export type CoalesceTypeOf<X, OPERAND> =
    TypeOf<X> extends { [numberTypes]: infer NUMBER extends NumberTypes } ? (
        TypeOf<X> extends NUMBER['double'] ? NUMBER['double'] :
        OPERAND extends NUMBER['double'] ? NUMBER['double'] :
        OPERAND extends NUMBER['int'] ? TypeOf<X> :
        NUMBER['number']
    ) : TypeOf<X>

/** A data type whose value can be null */
export abstract class NullableType</*in|out*/ VALUE_TYPE> extends ValueSourceBaseType<VALUE_TYPE> {
    /** Whether a type and a custom type are of a data type with a null value: every one but an aggregated array */
    protected static override __isOfGroup(type: string, customType: CustomType | undefined): boolean {
        return !__isAggregatedArray(type, customType)
    }

    isNull(): ValueSource<SourceOf<this>, BooleanOf<this>, 'required'>
    isNull(): any {
        const vs = this as unknown as ValueSourceImpl
        return __newSqlOperationIsNullValueSource('_isNull', vs, __builtInTypeOf(vs, 'condition'), 'required', vs.__typeAdapter)
    }
    isNotNull(): ValueSource<SourceOf<this>, BooleanOf<this>, 'required'>
    isNotNull(): any {
        const vs = this as unknown as ValueSourceImpl
        return __newSqlOperationIsNullValueSource('_isNotNull', vs, __builtInTypeOf(vs, 'condition'), 'required', vs.__typeAdapter)
    }
    valueWhenNull(value: VALUE_TYPE): ValueSource<SourceOf<this>, CoalesceTypeOf<this, 'value'>, 'required'>
    valueWhenNull<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, CoalesceTypeOf<this, TypeOf<VALUE>>, OptionalOf<VALUE>>
    valueWhenNull(value: any): any {
        const vs = this as unknown as ValueSourceImpl
        let typeClass = __typeClassOf(vs)
        // Promote the declared numeric type from the fallback operand, the same way the
        // overloaded-number operations do (createSqlOperation1ofOverloadedNumber): an `int`
        // receiver with a `double` fallback emits `coalesce(<int>, <double>)`, which the
        // engine resolves to the wider `double`, so a NULL int row legitimately returns the
        // double's fraction. Without vs promotion the result is still declared `int` and
        // the marshaller's int arm rejects that valid value (INVALID_VALUE_RECEIVED_FROM_DATABASE).
        // Only a plain `int` receiver needs widening — a double/bigint/customInt/customBigint/customDouble
        // receiver already carries the wider-or-matching type, and the compile-time signature
        // only admits a same-`typeName` operand.
        //
        // A fractional NUMBER LITERAL widens for exactly the same reason. TypeScript cannot tell
        // `2` from `2.5` — both are `number`, there is no integer literal type — so vs decision
        // belongs to the runtime half, which has the value in hand; `_getWidenedArgumentType` binds
        // the operand with the matching type, and the two have to agree or the fraction is rejected
        // on one of the two crossings.
        if (vs.__customType === undefined && vs.__type === 'int') {
            if (isValueSource(value)) {
                const operandPrivate = __getValueSourcePrivate(value)
                if (__isDouble(operandPrivate.__type, operandPrivate.__customType)) {
                    typeClass = __builtInTypeOf(vs, 'double')
                }
            } else if (typeof value === 'number' && !Number.isInteger(value)) {
                typeClass = __builtInTypeOf(vs, 'double')
            }
        }
        let typeAdapter = getTypeAdapter2(vs, value)
        if (typeAdapter instanceof OracleDateAsTimestampTypeAdapter && !(vs.__typeAdapter instanceof OracleDateAsTimestampTypeAdapter && isValueSource(value) && __getValueSourcePrivate(value).__typeAdapter instanceof OracleDateAsTimestampTypeAdapter)) {
            // Oracle's nvl has the type of its first operand: a DATE read as a timestamp with something else is
            // turned into a TIMESTAMP there, and any other first operand already decides the type. Two of them stay a
            // DATE, and the result keeps the adapter
            typeAdapter = undefined
        }
        return __newSqlOperationValueWhenNullValueSource(vs, value, typeClass, getOptionalType2(vs, value), typeAdapter)
    }
    nullIfValue(value: VALUE_TYPE): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    nullIfValue<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, TypeOf<this>, 'optional'>
    nullIfValue(value: any): any {
        const vs = this as unknown as ValueSourceImpl
        return __newSqlOperation1ValueSource('_nullIfValue', vs, value, __typeClassOf(vs), 'optional', getTypeAdapter2(vs, value))
    }
    asOptional(): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    asOptional(): any {
        const vs = this as unknown as ValueSourceImpl
        const result = __newNoopValueSource(vs, __sameTypeClassOf(vs), 'optional', vs.__typeAdapter)
        return result
    }
    asRequiredInOptionalObject(): ValueSource<SourceOf<this>, TypeOf<this>, 'requiredInOptionalObject'> & ColumnMarkersOf<this>
    asRequiredInOptionalObject(): any {
        return __asRequiredInOptionalObjectOf(this)
    }
    onlyWhenOrNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    onlyWhenOrNull(when: boolean): any {
        return __onlyWhenOrNullOf(this, when)
    }
    ignoreWhenAsNull(when: boolean): ValueSource<SourceOf<this>, TypeOf<this>, 'optional'>
    ignoreWhenAsNull(when: boolean): any {
        return __ignoreWhenAsNullOf(this, when)
    }
}
