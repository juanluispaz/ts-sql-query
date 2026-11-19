import type { SqlDataType } from '../TypeAdapter.js'
import { ComparableType } from './comparable.js'
import type { IntType } from './number.js'
import type { INumberValue, IValueWithType, OptionalityOf, SourceOf, DataTypeOf, ValueSource } from './base.js'
import type { CombinedOptionality } from './valueSource.js'
import type { additiveValueSource, operandTypeName } from '../utils/symbols.js'
import type { NSource } from '../utils/sourceName.js'
import type { TypedValueSource } from './valueSource.js'
import { __registeredDataType } from './dataTypeRegistry.js'
import { __typeClassOf } from '../nodes/dataTypeClassOf.js'
import { __operation0, __operation1 } from '../nodes/operations.js'
import { __keptClassOf, __computedClassOf } from '../nodes/adaptedTypeClass.js'
import { doubleSqlDataType, intSqlDataType } from './numericSqlDataTypes.js'

/*
 * The numbers, by what they can do: each level adds operations, and a data type works only with itself (outside the
 * group number of number.ts, which combines an int and a double): what it takes and what it gives is its data type.
 *
 * ArithmeticType
 * ├── NumberType (number.ts)        the numbers of JavaScript: int and double work together
 * └── AdditiveType                  added and subtracted (a sum of money)
 *     └── MultipliableType          multiplied
 *         ├── IntegersType          the integers: BigintType (bigint.ts)
 *         ├── DecimalsType          the exact decimals (decimals.ts): StringDecimalType
 *         └── DivisibleType         divided
 *             └── RealsType         the floating point numbers, with their functions
 *
 * A data type of the user extends the level of what it can do, with its type name; IntegersType, DecimalsType and
 * RealsType send and read it as an int, an exact decimal and a double, the others convert nothing.
 */

/** What a position that takes a value source of any number that works only with itself accepts (sum, average) */
export interface IAnyAdditiveValueSource</*in|out*/ SOURCE extends NSource> extends TypedValueSource<SOURCE, any, any> {
    [additiveValueSource]: 'AdditiveValueSource'
}

/** A number: the root of the numbers */
export abstract class ArithmeticType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ComparableType<VALUE_TYPE, TYPE_NAME> {
}

/**
 * A number that is added and subtracted with itself (a sum of money). A data type of the user extends it with its type
 * name, as a value only the user knows (the library converts nothing and gives it no SQL data type):
 * `class MoneyType extends AdditiveType<Money, 'Money'> { static override readonly type = 'Money' }`
 */
export abstract class AdditiveType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends ArithmeticType<VALUE_TYPE, TYPE_NAME> {
    declare [additiveValueSource]: 'AdditiveValueSource'

    abs(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    abs(): any {
        return __operation0(this, '_abs', __computedClassOf(this, __typeClassOf(this)))
    }
    sign(): ValueSource<SourceOf<this>, IntType, OptionalityOf<this>>
    sign(): any {
        return __operation0(this, '_sign', __registeredDataType('int'))
    }
    /** The value, but at least the one given: the greater of the two (and maxValue, at most: the smaller) */
    minValue(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    minValue<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    minValue(value: any): any {
        return __operation1(this, '_maximumBetweenTwoValues', value, __keptClassOf(this, __typeClassOf(this)))
    }
    maxValue(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    maxValue<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    maxValue(value: any): any {
        return __operation1(this, '_minimumBetweenTwoValues', value, __keptClassOf(this, __typeClassOf(this)))
    }
    add(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    add<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    add(value: any): any {
        return __operation1(this, '_add', value, __computedClassOf(this, __typeClassOf(this)))
    }
    subtract(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    subtract<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    subtract(value: any): any {
        return __operation1(this, '_subtract', value, __computedClassOf(this, __typeClassOf(this)))
    }
    modulo(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    modulo<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    modulo(value: any): any {
        return __operation1(this, '_modulo', value, __computedClassOf(this, __typeClassOf(this)))
    }
}

/** A number that is also multiplied by itself; a data type of the user extends it as AdditiveType */
export abstract class MultipliableType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends AdditiveType<VALUE_TYPE, TYPE_NAME> {
    multiply(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    multiply<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    multiply(value: any): any {
        return __operation1(this, '_multiply', value, __computedClassOf(this, __typeClassOf(this)))
    }
}

/**
 * An integer number that works only with itself (bigint, and a data type of the user). A data type of the user extends
 * it with its type name, sent and read as an int, a JavaScript number, unless its class says another SQL data type or
 * another conversion: `class QuantityType extends IntegersType<number, 'Quantity'> { static override readonly type = 'Quantity' }`
 */
export abstract class IntegersType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends MultipliableType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = intSqlDataType
}

/** A number that is also divided by itself; a data type of the user extends it as AdditiveType */
export abstract class DivisibleType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends MultipliableType<VALUE_TYPE, TYPE_NAME> {
    divide(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    divide<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    divide(value: any): any {
        return __operation1(this, '_divide', value, __computedClassOf(this, __typeClassOf(this)))
    }
}

/**
 * A floating point number that works only with itself: its floating point functions keep its data type. A data type of
 * the user extends it with its type name, sent and read as a double:
 * `class RatioType extends RealsType<number, 'Ratio'> { static override readonly type = 'Ratio' }`
 */
export abstract class RealsType</*in|out*/ VALUE_TYPE, /*in|out*/ TYPE_NAME extends string> extends DivisibleType<VALUE_TYPE, TYPE_NAME> {
    static override readonly sqlDataType: SqlDataType | undefined = doubleSqlDataType

    ceil(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    ceil(): any {
        return __operation0(this, '_ceil', __computedClassOf(this, __typeClassOf(this)))
    }
    floor(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    floor(): any {
        return __operation0(this, '_floor', __computedClassOf(this, __typeClassOf(this)))
    }
    round(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    round(): any {
        return __operation0(this, '_round', __computedClassOf(this, __typeClassOf(this)))
    }
    roundn(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    roundn(value: number): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    roundn<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    roundn<VALUE extends INumberValue>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    roundn(value: any): any {
        return __operation1(this, '_roundn', value, __computedClassOf(this, __typeClassOf(this)))
    }
    exp(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    exp(): any {
        return __operation0(this, '_exp', __typeClassOf(this))
    }
    ln(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    ln(): any {
        return __operation0(this, '_ln', __typeClassOf(this))
    }
    log10(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    log10(): any {
        return __operation0(this, '_log10', __typeClassOf(this))
    }
    sqrt(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    sqrt(): any {
        return __operation0(this, '_sqrt', __typeClassOf(this))
    }
    cbrt(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    cbrt(): any {
        return __operation0(this, '_cbrt', __typeClassOf(this))
    }
    acos(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    acos(): any {
        return __operation0(this, '_acos', __typeClassOf(this))
    }
    asin(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    asin(): any {
        return __operation0(this, '_asin', __typeClassOf(this))
    }
    atan(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    atan(): any {
        return __operation0(this, '_atan', __typeClassOf(this))
    }
    cos(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    cos(): any {
        return __operation0(this, '_cos', __typeClassOf(this))
    }
    cot(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    cot(): any {
        return __operation0(this, '_cot', __typeClassOf(this))
    }
    sin(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    sin(): any {
        return __operation0(this, '_sin', __typeClassOf(this))
    }
    tan(): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    tan(): any {
        return __operation0(this, '_tan', __typeClassOf(this))
    }
    power(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    power<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    power(value: any): any {
        return __operation1(this, '_power', value, __typeClassOf(this))
    }
    logn(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    logn<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    logn(value: any): any {
        return __operation1(this, '_logn', value, __typeClassOf(this))
    }
    atan2(value: VALUE_TYPE): ValueSource<SourceOf<this>, DataTypeOf<this>, OptionalityOf<this>>
    atan2<VALUE extends IValueWithType<this[typeof operandTypeName]>>(value: VALUE): ValueSource<SourceOf<this> | SourceOf<VALUE>, DataTypeOf<this>, CombinedOptionality<OptionalityOf<this>, OptionalityOf<VALUE>>>
    atan2(value: any): any {
        return __operation1(this, '_atan2', value, __typeClassOf(this))
    }
}
