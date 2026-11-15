import type { CustomType, DataTypeClass } from '../TypeAdapter.js'
import { TsSqlProcessingError } from '../TsSqlError.js'
import { BooleanType } from './logical.js'
import { BigintType, DoubleType, IntType } from './number.js'
import { StringDecimalType } from './decimals.js'
import { StringType } from './strings.js'
import { UuidType } from './uuids.js'
import { LocalDateTimeType, LocalDateType, LocalTimeType } from './localDates.js'
import { AggregatedArrayType } from './aggregatedArrays.js'
import { CustomBigintType, CustomDoubleType, CustomIntType } from './customNumber.js'
import { CustomDecimalType } from './customDecimals.js'
import { CustomUuidType } from './customUuids.js'
import { CustomLocalDateTimeType, CustomLocalDateType, CustomLocalTimeType } from './customLocalDates.js'
import { EnumType } from './enum.js'
import { CustomEqualableType } from './customEqualable.js'
import { CustomComparableType } from './customComparable.js'

// The class of the data type a value source is created from, by the names the library knows a data type by at run time:
// the type, and the custom type of a custom data type. Only the modules that create value sources from those names
// import it; a class of a data type never does.

/** The class of each built-in data type, by its name */
const builtInDataTypeClasses: { readonly [type: string]: DataTypeClass | undefined } = {
    boolean: BooleanType,
    int: IntType,
    bigint: BigintType,
    double: DoubleType,
    stringDecimal: StringDecimalType,
    string: StringType,
    uuid: UuidType,
    localDate: LocalDateType,
    localTime: LocalTimeType,
    localDateTime: LocalDateTimeType,
    aggregatedArray: AggregatedArrayType,
}

/** The family of each custom type, whose `of` gives the class of each type name */
const customDataTypeFamilies: { readonly [customType in CustomType]: { of(typeName: string): DataTypeClass } } = {
    customInt: CustomIntType,
    customBigint: CustomBigintType,
    customDouble: CustomDoubleType,
    customDecimal: CustomDecimalType,
    customUuid: CustomUuidType,
    customLocalDate: CustomLocalDateType,
    customLocalTime: CustomLocalTimeType,
    customLocalDateTime: CustomLocalDateTimeType,
    enum: EnumType,
    custom: CustomEqualableType,
    customComparable: CustomComparableType,
}

/** The class a method that takes a data type gets: the class itself, or the class of a built-in data type by its name */
export function __dataTypeClassFrom(type: string | DataTypeClass): DataTypeClass {
    return typeof type === 'string' ? __dataTypeClassOf(type, undefined) : type
}

/** The class of the data type of a type and a custom type */
export function __dataTypeClassOf(type: string, customType: CustomType | undefined): DataTypeClass {
    if (customType !== undefined) {
        const family = customDataTypeFamilies[customType]
        if (family) {
            return family.of(type)
        }
    } else {
        const result = builtInDataTypeClasses[type]
        if (result) {
            return result
        }
    }
    throw new TsSqlProcessingError({ reason: 'INTERNAL', internalErrorType: 'unexpected value' }, 'Unknown data type: ' + type + (customType === undefined ? '' : ' of ' + customType))
}
