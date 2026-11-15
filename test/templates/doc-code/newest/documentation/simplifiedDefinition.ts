import { describe, test } from '../../../../lib/testRunner.js'
import type { DynamicCondition, DynamicConditionForModel, DynamicDefinitionForModel } from "../../../../../src/dynamic/condition.js"
import type { OrderByForModel, OrderByMode } from "../../../../../src/dynamic/orderBy.js"
import type { ConnectionConfiguration } from '../../../../../src/queryRunners/QueryRunner.js'
// The configuration of a connection, which the API of the type adapters names
void function(_configuration: ConnectionConfiguration) {}

/******************** 
 * Generated code
 */

describe('simplifiedDefinition documentation', () => {

test('snippets registered', () => {})

// Generated code here

})

/******************** 
 * Noops to make the compiler happy
 */

type RESULT = any
type Default = any
type QueryRunner = any
type OuterJoinSource = any
type Argument<_T, _TYPE_NAME extends string> = any
// The class of a data type: a built-in one, like `StringType`, or one the `of` of a family made
type DataTypeClass = any
// The classes of the custom data types, made by the `of` of each family
type CustomIntType<_T, _TYPE_NAME extends string> = any
type CustomBigintType<_T, _TYPE_NAME extends string> = any
type CustomDoubleType<_T, _TYPE_NAME extends string> = any
type CustomDecimalType<_T, _TYPE_NAME extends string> = any
type CustomUuidType<_T, _TYPE_NAME extends string> = any
type CustomLocalDateType<_T, _TYPE_NAME extends string> = any
type CustomLocalTimeType<_T, _TYPE_NAME extends string> = any
type CustomLocalDateTimeType<_T, _TYPE_NAME extends string> = any
type EnumType<_T, _TYPE_NAME extends string> = any
type CustomEqualableType<_T, _TYPE_NAME extends string> = any
type CustomComparableType<_T, _TYPE_NAME extends string> = any
type DynamicFilter = any
type Filterable = any
type DynamicConditionExtension = any
type RawFragment = any
type CustomizedTableOrView = any
type AnyValueSource = ValueSource<any, any>
type TransactionIsolationLevel = any

void function (
    _c: Connection, 
    _v: Values,
    _r: RESULT,
    _d: Default,
    _qr: QueryRunner,
    _ojs: OuterJoinSource,
    _a: Argument<any, any>,
    _dtc: DataTypeClass,
    _customIntType: CustomIntType<any, any>,
    _customBigintType: CustomBigintType<any, any>,
    _customDoubleType: CustomDoubleType<any, any>,
    _customDecimalType: CustomDecimalType<any, any>,
    _customUuidType: CustomUuidType<any, any>,
    _customLocalDateType: CustomLocalDateType<any, any>,
    _customLocalTimeType: CustomLocalTimeType<any, any>,
    _customLocalDateTimeType: CustomLocalDateTimeType<any, any>,
    _enumType: EnumType<any, any>,
    _customEqualableType: CustomEqualableType<any, any>,
    _customComparableType: CustomComparableType<any, any>,
    _df: DynamicFilter,
    _f: Filterable,
    _dce: DynamicConditionExtension,
    _rf: RawFragment,
    _ctv: CustomizedTableOrView,
    _avs: AnyValueSource,
    _tis: TransactionIsolationLevel,
) { }
interface ValueSource<T, TYPE_NAME extends string> {
    makeCompilerHappy_type: T
    makeCompilerHappy_typeName: TYPE_NAME
}
interface Connection { }
interface Values { }
interface SelectExpression { }

/**
 * Here we use the Subquery type to indicate that you can use any select as subquery
 */
type Subquery = SelectExpression

/**
 * Here we use the CompoundablQuery type to indicate that you can use a select with a compound operator (union, intesect)
 */
type CompoundableSubquery = SelectExpression

void function(
    _s: Subquery,
    _cs: CompoundableSubquery,
    _dc: DynamicCondition<any>,
    _dcfm: DynamicConditionForModel<any>,
    _ddfm: DynamicDefinitionForModel<any>,
    _obfm: OrderByForModel<any>,
    _obm: OrderByMode
) {}

type MyEnumType = any
type MyCustomType = any
type MyCustomComparableType = any

void function(
    _met: MyEnumType,
    _mct: MyCustomType,
    _mcct: MyCustomComparableType
) {}

type DatabaseType = any
type PromiseProvider = any
type QueryRunnerName = any
void function(
    _dt: DatabaseType,
    _pp: PromiseProvider,
    _qrn: QueryRunnerName
) {}