import { __registerCustomDataTypeFamily, __registerDataType } from './dataTypeRegistry.js'
import { BooleanConditionType, BooleanType } from './logical.js'
import { BigintType, DoubleType, IntType } from './number.js'
import { StringDecimalType } from './decimals.js'
import { StringType } from './strings.js'
import { UuidType } from './uuids.js'
import { LocalDateTimeType, LocalDateType, LocalTimeType } from './localDates.js'
import { AggregatedArrayProjectableAsNullableType } from './aggregatedArrays.js'
import { CustomBigintType, CustomDoubleType, CustomIntType } from './customNumber.js'
import { CustomDecimalType } from './customDecimals.js'
import { CustomUuidType } from './customUuids.js'
import { CustomLocalDateTimeType, CustomLocalDateType, CustomLocalTimeType } from './customLocalDates.js'
import { EnumType } from './enum.js'
import { CustomEqualableType } from './customEqualable.js'
import { CustomComparableType } from './customComparable.js'

// THE ONLY MODULE OF THE LIBRARY WITH SIDE EFFECTS (declared in `sideEffects` of package.json): it registers the data
// types of the library in dataTypeRegistry.ts when it is loaded. The modules a user always starts from import it (the
// connection, Table, View and Values), so the registry is filled before any value source is created.

__registerDataType('boolean', BooleanType)
// The boolean of a condition (only for the run time): what the comparisons give
__registerDataType('condition', BooleanConditionType)
__registerDataType('int', IntType)
__registerDataType('bigint', BigintType)
__registerDataType('double', DoubleType)
__registerDataType('stringDecimal', StringDecimalType)
__registerDataType('string', StringType)
__registerDataType('uuid', UuidType)
__registerDataType('localDate', LocalDateType)
__registerDataType('localTime', LocalTimeType)
__registerDataType('localDateTime', LocalDateTimeType)
// The class that has projectingOptionalValuesAsNullable, which its types offer until it is called
__registerDataType('aggregatedArray', AggregatedArrayProjectableAsNullableType)

__registerCustomDataTypeFamily('customInt', CustomIntType)
__registerCustomDataTypeFamily('customBigint', CustomBigintType)
__registerCustomDataTypeFamily('customDouble', CustomDoubleType)
__registerCustomDataTypeFamily('customDecimal', CustomDecimalType)
__registerCustomDataTypeFamily('customUuid', CustomUuidType)
__registerCustomDataTypeFamily('customLocalDate', CustomLocalDateType)
__registerCustomDataTypeFamily('customLocalTime', CustomLocalTimeType)
__registerCustomDataTypeFamily('customLocalDateTime', CustomLocalDateTimeType)
__registerCustomDataTypeFamily('enum', EnumType)
__registerCustomDataTypeFamily('custom', CustomEqualableType)
__registerCustomDataTypeFamily('customComparable', CustomComparableType)
