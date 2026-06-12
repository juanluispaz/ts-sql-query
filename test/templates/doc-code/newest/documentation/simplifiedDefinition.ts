import { describe, test } from '../../../../lib/testRunner.js'
import type { DynamicCondition, DynamicConditionForModel, DynamicDefinitionForModel } from "../../../../../src/dynamic/condition.js"
import type { OrderByForModel, OrderByMode } from "../../../../../src/dynamic/orderBy.js"

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
type Argument<_T, _TYPE_NAME> = any
type DynamicFilter = any
type Filterable = any
type DinamicConditionExtension = any
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
    _df: DynamicFilter,
    _f: Filterable,
    _dce: DinamicConditionExtension,
    _rf: RawFragment,
    _ctv: CustomizedTableOrView,
    _avs: AnyValueSource,
    _tis: TransactionIsolationLevel,
) { }
interface ValueSource<T, TYPE_NAME> {
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
void function(
    _dt: DatabaseType,
    _pp: PromiseProvider
) {}