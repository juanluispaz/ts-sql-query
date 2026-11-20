import { __registerDataType, __registerInternalDataType } from './dataTypeRegistry.js'
import { BooleanConditionType, BooleanType } from './logical.js'
import { DoubleType, IntType } from './number.js'
import { BigintType } from './bigint.js'
import { StringDecimalType } from './decimals.js'
import { StringType } from './strings.js'
import { UuidType } from './uuids.js'
import { LocalDateTimeType, LocalDateType, LocalTimeType } from './localDates.js'
import { PlainDateTimeType, PlainDateType, PlainTimeType } from './plainDates.js'
import { DurationType } from './durations.js'
import { InstantType } from './instants.js'

// THE ONLY MODULE OF THE LIBRARY WITH SIDE EFFECTS (declared in `sideEffects` of package.json): it registers the data
// types of the library in dataTypeRegistry.ts when it is loaded, the same way the user registers its own ones. The
// modules a user always starts from import it (the connection, Table, View and Values), so the registry is filled
// before any value source is created.

__registerDataType('boolean', BooleanType)
// The boolean of a condition (only for the run time): what the comparisons give
__registerInternalDataType('condition', BooleanConditionType)
__registerDataType('int', IntType)
__registerDataType('bigint', BigintType)
__registerDataType('double', DoubleType)
__registerDataType('stringDecimal', StringDecimalType)
__registerDataType('string', StringType)
__registerDataType('uuid', UuidType)
__registerDataType('localDate', LocalDateType)
__registerDataType('localTime', LocalTimeType)
__registerDataType('localDateTime', LocalDateTimeType)
__registerDataType('plainDate', PlainDateType)
__registerDataType('plainTime', PlainTimeType)
__registerDataType('plainDateTime', PlainDateTimeType)
__registerDataType('duration', DurationType)
__registerDataType('instant', InstantType)

