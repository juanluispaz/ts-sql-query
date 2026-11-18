import type { IValueWithType, OptionalityOf, SourceOf, DataTypeOf, ValueSource, TypeClass, AnyTypeClass, ValueTypeOf } from './base.js'
import type { TypeAdapter } from '../TypeAdapter.js'
import type { DataTypeName, DataTypeOfName, DataTypeValueOfName, DataTypeValueSources } from './dataTypeNames.js'
import type { DataTypeFragmentExpression } from './fragments.js'
import { FragmentQueryBuilder } from '../queryBuilders/FragmentQueryBuilder.js'
import { __createConst } from './valueSourceFactory.js'
import { __dataTypeClassFrom } from './dataTypeClasses.js'
import { ValueSourceBaseType } from './valueSourceBase.js'
import { __internalDataType, __registeredDataType } from './dataTypeRegistry.js'
import type { BooleanType } from './logical.js'
import type { DoubleType, IntType, NumberType } from './number.js'
import type { ColumnMarkersOf } from './valueSource.js'
import type { operandTypeName } from '../utils/symbols.js'
import { exposeFilterOperations, filterOperation } from './filterOperations.js'
import { __sameTypeClassOf, __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { getOptionalType2 } from '../nodes/operands.js'
import { __newNoopValueSource, __newSqlOperation1ValueSource, __newSqlOperationIsNullValueSource, __newSqlOperationValueWhenNullValueSource } from '../nodes/operations.js'
import { __asRequiredInOptionalObjectOf, __ignoreWhenAsNullOf, __onlyWhenOrNullOf } from '../nodes/valueSourceRoot.js'
import { OracleDateAsTimestampTypeAdapter } from '../TypeAdapter.js'
import { __adaptedTypeClassOf, __keptClassOf, __sqlDataTypeOf, __classOf, __computedClassOf } from '../nodes/adaptedTypeClass.js'
import { __asNodeValueSource, isValueSource } from '../nodes/NodeStrategy.js'

/**
 * The data type of the value of a null replaced by a fallback: the data type of the value source, but a number widens
 * like in an operation (coalesce(<int>, <double>) is a double). OPERAND is the data type of the fallback, or
 * `'value'` for a value given as a JavaScript value (a number can be either an int or a double)
 */
export type CoalesceTypeOf<X, OPERAND> =
    DataTypeOf<X> extends NumberType ? (
        DataTypeOf<X> extends DoubleType ? DoubleType :
        OPERAND extends DoubleType ? DoubleType :
        OPERAND extends IntType ? DataTypeOf<X> :
        NumberType
    ) : DataTypeOf<X>

/** A data type whose value can be null */
export abstract class NullableType</*in|out*/ VALUE_TYPE> extends ValueSourceBaseType<VALUE_TYPE> {
    static override readonly [filterOperation] = exposeFilterOperations(this, ValueSourceBaseType, ['isNull', 'isNotNull'])
    declare [filterOperation]: (typeof NullableType)[typeof filterOperation]

    /**
     * A fragment of SQL of a data type, for a method of a class of a data type of the user, as `fragmentWithType` of the
     * connection: `this.fragmentWithType('boolean', 'required').sql\`${this} > 0\``. Its source is the one of the value
     * sources given to it: without them it is a constant SQL, valid in any query
     */
    protected fragmentWithType<TYPE extends DataTypeName>(type: TYPE, required: 'required', adapter?: TypeAdapter): DataTypeFragmentExpression<this, DataTypeOfName<TYPE>, 'required'>
    protected fragmentWithType<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, required: 'required', adapter?: TypeAdapter): DataTypeFragmentExpression<this, TYPE, 'required'>
    protected fragmentWithType<TYPE extends DataTypeName>(type: TYPE, required: 'optional', adapter?: TypeAdapter): DataTypeFragmentExpression<this, DataTypeOfName<TYPE>, 'optional'>
    protected fragmentWithType<TYPE extends NullableType<any>>(type: TypeClass<TYPE>, required: 'optional', adapter?: TypeAdapter): DataTypeFragmentExpression<this, TYPE, 'optional'>
    protected fragmentWithType(type: string | AnyTypeClass, required: string, adapter?: TypeAdapter): any {
        return new FragmentQueryBuilder(__dataTypeClassFrom(type), required as any, adapter)
    }

    /**
     * A value of a data type, for a method of a class of a data type of the user, as `const` of the connection: a value
     * given to the method, used in a fragment (`this.fragmentWithType('boolean', 'required').sql\`${this} > ${this.const(n, 'int')}\``)
     */
    protected const<TYPE extends DataTypeName>(value: DataTypeValueOfName<TYPE>, type: TYPE, adapter?: TypeAdapter): DataTypeValueSources<never, 'required'>[TYPE]
    protected const<TYPE extends NullableType<any>>(value: ValueTypeOf<TYPE>, type: TypeClass<TYPE>, adapter?: TypeAdapter): ValueSource<never, TYPE, 'required'>
    protected const(value: any, type: string | AnyTypeClass, adapter?: TypeAdapter): any {
        return __createConst(value, __adaptedTypeClassOf(__dataTypeClassFrom(type), adapter), 'required')
    }

    /** A value of a data type that can be null, for a method of a class of a data type of the user, as `optionalConst` of the connection */
    protected optionalConst<TYPE extends DataTypeName>(value: DataTypeValueOfName<TYPE> | null | undefined, type: TYPE, adapter?: TypeAdapter): DataTypeValueSources<never, 'optional'>[TYPE]
    protected optionalConst<TYPE extends NullableType<any>>(value: ValueTypeOf<TYPE> | null | undefined, type: TypeClass<TYPE>, adapter?: TypeAdapter): ValueSource<never, TYPE, 'optional'>
    protected optionalConst(value: any, type: string | AnyTypeClass, adapter?: TypeAdapter): any {
        return __createConst(value, __adaptedTypeClassOf(__dataTypeClassFrom(type), adapter), 'optional')
    }

    isNull(): ValueSource<SourceOf<this>, BooleanType, 'required'>
    isNull(): any {
        const vs = __asNodeValueSource(this)
        return __newSqlOperationIsNullValueSource('_isNull', vs, __internalDataType('condition'), 'required')
    }
    isNotNull(): ValueSource<SourceOf<this>, BooleanType, 'required'>
    isNotNull(): any {
        const vs = __asNodeValueSource(this)
        return __newSqlOperationIsNullValueSource('_isNotNull', vs, __internalDataType('condition'), 'required')
    }
    valueWhenNull(value: VALUE_TYPE): ValueSource<SourceOf<this>, CoalesceTypeOf<this, 'value'>, 'required'>
    valueWhenNull<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, CoalesceTypeOf<this, DataTypeOf<VALUE>>, OptionalityOf<VALUE>>
    valueWhenNull(value: any): any {
        const vs = __asNodeValueSource(this)
        let typeClass = __typeClassOf(vs)
        // Promote the declared numeric type from the fallback operand, the same way the
        // operations of the group number do (promotedNumberOperation in number.ts): an `int`
        // receiver with a `double` fallback emits `coalesce(<int>, <double>)`, which the
        // engine resolves to the wider `double`, so a NULL int row legitimately returns the
        // double's fraction. Without vs promotion the result is still declared `int` and
        // the marshaller's int arm rejects that valid value (INVALID_VALUE_RECEIVED_FROM_DATABASE).
        // Only a plain `int` receiver needs widening — a double, a bigint or a number of the user
        // receiver already carries the wider-or-matching type, and the compile-time signature
        // only admits a same-`typeName` operand.
        //
        // A fractional NUMBER LITERAL widens for exactly the same reason. TypeScript cannot tell
        // `2` from `2.5` — both are `number`, there is no integer literal type — so vs decision
        // belongs to the runtime half, which has the value in hand; the int binds the operand with
        // the matching type, and the two have to agree or the fraction is rejected
        // on one of the two crossings.
        if (vs instanceof (__registeredDataType('int') as unknown as abstract new () => unknown)) {
            if (isValueSource(value)) {
                if (value instanceof (__registeredDataType('double') as unknown as abstract new () => unknown)) {
                    typeClass = __registeredDataType('double')
                }
            } else if (typeof value === 'number' && !Number.isInteger(value)) {
                typeClass = __registeredDataType('double')
            }
        }
        // The value is the one of the receiver or of the fallback: the receiver's type adapter, when the data type
        // stays the one of the receiver (an int that becomes a double has none)
        let resultClass = typeClass === __typeClassOf(vs) ? __keptClassOf(vs, typeClass) : typeClass
        if (isValueSource(value) && JSON.stringify(__sqlDataTypeOf(resultClass)) !== JSON.stringify(__sqlDataTypeOf(__classOf(value)))) {
            // The value can be the one of the fallback, of another SQL data type: it has the conversions of the receiver,
            // but not its SQL data type
            resultClass = __computedClassOf(vs, resultClass)
        }
        if (vs.__typeAdapter instanceof OracleDateAsTimestampTypeAdapter && !(isValueSource(value) && __asNodeValueSource(value).__typeAdapter instanceof OracleDateAsTimestampTypeAdapter)) {
            // Oracle's nvl has the type of its first operand: a DATE read as a timestamp with something else is
            // turned into a TIMESTAMP there. Two of them stay a DATE, and the result keeps the adapter
            resultClass = typeClass
        }
        return __newSqlOperationValueWhenNullValueSource(vs, value, resultClass, getOptionalType2(vs, value))
    }
    nullIfValue(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, 'optional'>
    nullIfValue<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, 'optional'>
    nullIfValue(value: any): any {
        return __newSqlOperation1ValueSource('_nullIfValue', this, value, __keptClassOf(this, __typeClassOf(this)), 'optional')
    }
    asOptional(): ValueSource<SourceOf<this>, DataTypeOf<this>, 'optional'>
    asOptional(): any {
        const vs = __asNodeValueSource(this)
        const result = __newNoopValueSource(vs, __keptClassOf(vs, __sameTypeClassOf(vs)), 'optional')
        return result
    }
    asRequiredInOptionalObject(): ValueSource<SourceOf<this>, DataTypeOf<this>, 'requiredInOptionalObject'> & ColumnMarkersOf<this>
    asRequiredInOptionalObject(): any {
        return __asRequiredInOptionalObjectOf(this)
    }
    onlyWhenOrNull(when: boolean): ValueSource<SourceOf<this>, DataTypeOf<this>, 'optional'>
    onlyWhenOrNull(when: boolean): any {
        return __onlyWhenOrNullOf(this, when)
    }
    ignoreWhenAsNull(when: boolean): ValueSource<SourceOf<this>, DataTypeOf<this>, 'optional'>
    ignoreWhenAsNull(when: boolean): any {
        return __ignoreWhenAsNullOf(this, when)
    }
}
