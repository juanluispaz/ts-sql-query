import { describe, test } from '../../../../lib/testRunner.js'
// The data types of your own of the docs (advanced/data-types)
import { IntType, type CombinedOptionality, type DataTypeOf, type OperandOf, type OptionalityOf, type SourceOf, type ValueSource, type SqlDataType } from '../../../../../src/exports/v2/index.js'
void (null as unknown as [typeof IntType, CombinedOptionality<any, any>, DataTypeOf<any>, OperandOf<any>, OptionalityOf<any>, SourceOf<any>, ValueSource<any, any, any>, SqlDataType])
import { MockQueryRunner } from '../../../../../src/queryRunners/MockQueryRunner.js'
import { SqlServerConnection } from '../../../../../src/connections/SqlServerConnection.js'
import { DocCodeMockRunner } from '../../../../lib/mockRunners/DocCodeMockRunner.js'
import { Table } from '../../../../../src/Table.js'
import { CustomBooleanTypeAdapter, type DefaultTypeAdapter, type TypeAdapter, type TypeAdapterValueFromDBContext, type TypeAdapterValueToDBContext, type TypeAdapterPlaceholderContext, type TypeAdapterProjectionContext } from '../../../../../src/TypeAdapter.js'
import { View } from '../../../../../src/View.js'
import { Values } from '../../../../../src/Values.js'

import { MssqlPoolPromiseQueryRunner } from '../../../../../src/queryRunners/MssqlPoolPromiseQueryRunner.js'
import { MssqlPoolQueryRunner } from '../../../../../src/queryRunners/MssqlPoolQueryRunner.js'

import mssql from 'mssql'

import { 
    extractColumnsFrom,
    extractWritableColumnsFrom,
    extractWritableShapeFrom,
} from '../../../../../src/extras/utils.js'
import { type DynamicCondition, type DynamicConditionForModel, type DynamicDefinitionForModel } from '../../../../../src/dynamic/condition.js'
import type { FilterOf, StringType } from '../../../../../src/exports/v2/index.js'
import { IntegersType, LocalDatesType, exposeFilterOperations, filterOperation } from '../../../../../src/exports/v2/index.js'
// Used by the examples of the operations a data type exposes to a dynamic filter
void (null as unknown as [typeof IntegersType, typeof LocalDatesType, typeof exposeFilterOperations, typeof filterOperation])
import { dynamicPick, dynamicPickPaths, expandTypeFromDynamicPickPaths, type DynamicPickPaths, type PickValuesPath, type Pickable, type PickValuesPathProjectedAsNullable, type PickValuesPathWithAllPropertiesProjectedAsNullable, expandTypeProjectedAsNullableFromDynamicPickPaths, type PickValuesPathWithAllProperties } from '../../../../../src/dynamic/pick.js'
import {
    type OrderByForModel,
    type OrderByMode,
} from '../../../../../src/dynamic/orderBy.js'
import { deepPick, deepOmit, type DeepPick, type DeepOmit, type DeepPickPaths } from '../../../../../src/extras/deepUtilities.js'
import { getQueryContext, type QueryContext, type QueryParamContext } from '../../../../../src/QueryContext.js'
import { fromRef, type TableOrViewLeftJoinOf, type TableOrViewOf, type UpdatableValuesShapedAs } from '../../../../../src/extras/types.js'
import { AdditiveType, EnumType } from '../../../../../src/exports/v2/index.js'
import { ComparableType, DecimalsType } from '../../../../../src/exports/v2/index.js'

// The data types of the values of the user, each one a class of the family of its values
abstract class AmountType extends DecimalsType<string, 'Amount'> { static override readonly type = 'Amount' }
abstract class ZonedDateTimeType extends ComparableType<ZonedDateTime, 'ZonedDateTime'> { static override readonly type = 'ZonedDateTime' }

class DBConnection extends SqlServerConnection<'DBConnection'> { 
    // insensitiveCollation = 'acs'

    bitwiseShiftLeft = this.buildFragmentWithArgs(
        this.arg('int', 'required'),
        this.arg('int', 'required')
    ).as((left, right) => {
        // The fragment here is: ${left} << ${right}
        // Could be another fragment like a function call: myFunction(${left}, ${right})
        return this.fragmentWithType('int', 'required').sql`${left} << ${right}`
    })

    bitwiseShiftLeft2 = this.buildFragmentWithMaybeOptionalArgs(
        this.arg('int', 'optional'),
        this.arg('int', 'optional')
    ).as((left, right) => {
        // The fragment here is: ${left} << ${right}
        // Could be another fragment like a function call: myFunction(${left}, ${right})
        return this.fragmentWithType('int', 'optional').sql`${left} << ${right}`
    })

    valuePlusOneEqualsIfValue = this.buildFragmentWithArgsIfValue(
        this.arg('int', 'required'),
        this.valueArg('int', 'optional')
    ).as((left, right) => {
        // The fragment here is: ${left} + 1 = ${right}
        // Could be another fragment like a function call: myFunction(${left}, ${right})
        return this.fragmentWithType('boolean', 'required').sql`${left} + 1 = ${right}`
    })

    forSystemTimeBetween = this.createTableOrViewCustomization<Date, Date>((table, alias, fromDate, toDate) => {
        const from = this.const(fromDate, 'localDateTime')
        const to = this.const(toDate, 'localDateTime')
        return this.rawFragment`${table} for system_time between ${from} and ${to} ${alias}`
    }) 

    myOwnProcedure(param1: number) {
        return this.executeProcedure('myOwnprocedure', [this.const(param1, 'int')]);
    }
     
    myOwnFunction(param1: number) {
        return this.executeFunction('myOwnFunction', [this.const(param1, 'int')], 'int', 'required');
    }
}

const tCompany = new class TCompany extends Table<DBConnection, 'TCompany'> {
    id = this.autogeneratedPrimaryKey('id', 'int')
    name = this.column('name', 'string')
    parentId = this.optionalColumn('parent_id', 'int')
    favouriteCustomerId = this.optionalColumn('favourite_customer_id', 'int')
    ubicationLatitude = this.optionalColumn('ubication_latitude', 'string')
    ubicationLongitude = this.optionalColumn('ubication_longitude', 'string')
    ubicationComment = this.optionalColumn('ubication_comment', 'string')
    constructor() {
        super('company'); // table name in the database
    }
}()

const tGroupedCompany = new class TGroupedCompany extends Table<DBConnection, 'TGroupedCompany'> {
    id = this.autogeneratedPrimaryKey('id', 'int');
    name = this.column('name', 'string');
    ubication = {
        latitude: this.optionalColumn('ubication_latitude', 'string').asRequiredInOptionalObject(),
        longitude: this.optionalColumn('ubication_longitude', 'string').asRequiredInOptionalObject(),
        comment: this.optionalColumn('ubication_comment', 'string'),
    };
    constructor() {
        super('company');
    }
}();
void tGroupedCompany;

const tCustomer = new class TCustomer extends Table<DBConnection, 'TCustomer'> {
    id = this.autogeneratedPrimaryKey('id', 'int')
    firstName = this.column('first_name', 'string')
    lastName = this.column('last_name', 'string')
    birthday = this.optionalColumn('birthday', 'localDate')
    companyId = this.column('company_id', 'int')
    name = this.firstName.concat(' ').concat(this.lastName)
    age = this.optionalVirtualColumnFromFragment('int', (fragment) => {
        return fragment.sql`calculateAge(${this.birthday})`
    })
    constructor() {
        super('customer'); // table name in the database
    }
}()

const vCustomerAndCompany = new class VCustomerAndCompany extends View<DBConnection, 'VCustomerAndCompany'> {
    companyId = this.column('company_id', 'int')
    companyName = this.column('company_name', 'string')
    customerId = this.column('customer_id', 'int')
    customerFirstName = this.column('customer_first_name', 'string')
    customerLastName = this.column('customer_last_name', 'string')
    customerBirthday = this.optionalColumn('customer_birthday', 'localDate')
    constructor() {
        super('customer_company')
    }
}()
vCustomerAndCompany.as('testView')

const tCustomCompany = new class TCustomCompany extends Table<DBConnection, 'TCustomCompany'> {
    id = this.autogeneratedPrimaryKey('id', 'int');
    name = this.column('name', 'string');
    isBig = this.column('is_big', 'boolean', new CustomBooleanTypeAdapter('Y', 'N'));
    constructor() {
        super('custom_company'); // table name in the database
    }
}()

const tRecord = new class TRecord extends Table<DBConnection, 'TRecord'> {
    id = this.primaryKey('id', 'uuid');
    title = this.column('title', 'string');
    constructor() {
        super('record'); // table name in the database
    }
}()

const docCodeMock = new DocCodeMockRunner()
const connection = new DBConnection(docCodeMock)

// A decimal number kept exact as its text (docs/configuration/data-types.md, Exact decimals)
const tExactAmount = new class TExactAmount extends Table<DBConnection, 'TExactAmount'> {
    id = this.primaryKey('id', 'int')
    amount = this.optionalColumn('amount', AmountType)
    price = this.optionalColumn('price', AmountType)
    constructor() {
        super('exact_amount')
    }
}()
void tExactAmount

// A date and time with its zone, read and written as text (docs/configuration/supported-databases/sqlserver.md)
type ZonedDateTime = string
class ZonedDateTimeTypeAdapter implements TypeAdapter {
    transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext, next: DefaultTypeAdapter): unknown {
        if (context.originalType.type === 'ZonedDateTime') {
            return value
        }
        return next.transformValueFromDB(value, context)
    }
    transformValueToDB(value: unknown, context: TypeAdapterValueToDBContext, next: DefaultTypeAdapter): unknown {
        if (context.originalType.type === 'ZonedDateTime') {
            return value
        }
        return next.transformValueToDB(value, context)
    }
    transformPlaceholder(placeholder: string, context: TypeAdapterPlaceholderContext, next: DefaultTypeAdapter): string {
        if (context.originalType.type === 'ZonedDateTime') {
            return 'cast(' + placeholder + ' as datetimeoffset)'
        }
        return next.transformPlaceholder(placeholder, context)
    }
    transformProjection(sql: string, context: TypeAdapterProjectionContext, next: DefaultTypeAdapter): string {
        if (context.originalType.type === 'ZonedDateTime') {
            context.comparison = 'none'
        }
        if (context.originalType.type === 'ZonedDateTime' && (context.output === 'resultColumn' || context.output === 'aggregatedArrayValue')) {
            return 'convert(nvarchar(40), ' + sql + ', 126)'
        }
        return next.transformProjection(sql, context)
    }
}
const tFlight = new class TFlight extends Table<DBConnection, 'TFlight'> {
    id = this.primaryKey('id', 'int')
    departsAt = this.column('departs_at', ZonedDateTimeType, new ZonedDateTimeTypeAdapter())
    constructor() {
        super('flight'); // table name in the database
    }
}()
void tFlight

/******************** 
 * Generated code
 */

describe('sqlserver documentation', () => {

test('snippets registered', () => {})

// Generated code here

})

/******************** 
 * Noops to make the compiler happy
 */

void tCompany
void tCustomer
void tCustomCompany
void tRecord
void connection
void mssql
void MssqlPoolPromiseQueryRunner
void MssqlPoolQueryRunner
void MockQueryRunner
void Values

void extractColumnsFrom
void extractWritableColumnsFrom
void extractWritableShapeFrom
void getQueryContext
void function(_qc: QueryContext, _qpc: QueryParamContext) {}
void expandTypeProjectedAsNullableFromDynamicPickPaths
void (null as unknown as [OrderByMode, FilterOf<StringType>, DynamicDefinitionForModel<{}>, Pickable, PickValuesPathProjectedAsNullable<{}, never>, PickValuesPathWithAllPropertiesProjectedAsNullable<{}, never>, PickValuesPathWithAllProperties<{}, never>])
void (null as unknown as UpdatableValuesShapedAs<any, any>)
void dynamicPick
void dynamicPickPaths
void expandTypeFromDynamicPickPaths
void deepPick
void deepOmit
void function(_dp: DeepPick<any, string>, _do: DeepOmit<any, string>, _dpp: DeepPickPaths<any>) {}
void function(_dcfm: DynamicConditionForModel<any>, _obfm: OrderByForModel<any>) {}
void fromRef

void EnumType
void AdditiveType
void function(
    _dpp: DynamicPickPaths<any>,
    _dc: DynamicCondition<any>,
    _tovljo: TableOrViewLeftJoinOf<any>,
    _tovo: TableOrViewOf<any>,
    _pvp: PickValuesPath<any, never>
) {}