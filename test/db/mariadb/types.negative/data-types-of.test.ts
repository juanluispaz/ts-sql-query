// Compile-time negative tests for the data types a family makes with `of` on the mariadb dialect: a type for a specific
// use, of its type name and what its family needs (the values of an enumeration, the scale of a scaled bigint); a data
// type (IntType, ScaledBigIntType of a scale) has no `of` of a family. These never execute any SQL: `validate:tests`
// (tsc) rejects each `@ts-expect-error` line.

import { test, expect } from '../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../lib/assertType.js'
import { Table } from '../../../../src/Table.js'
import { DBConnection } from '../domain/connection.js'
import { EnumType, IntegersType, IntType, ScaledBigIntsType, ScaledBigIntType, StringType, type ScaledBigInt } from '../../../../src/exports/v2/index.js'

type Activity = 'coding' | 'review' | 'meeting'
type Units = number & { readonly __units: unique symbol }
type Price = ScaledBigInt<2> & { readonly __price: unique symbol }

const tWorklog = new class TWorklog extends Table<DBConnection, 'TWorklog'> {
    id       = this.primaryKey('id', 'int')
    // Rule: the values of an enumeration give its type.
    activity = this.column('activity', EnumType.of('WorklogActivity', ['coding', 'review', 'meeting']))
    // Rule: null says, explicitly, that any value goes; the type is the one given.
    anyActivity = this.optionalColumn('activity', EnumType.of<Activity, 'AnyActivity'>('AnyActivity', null))
    minutes  = this.optionalColumn('minutes', IntegersType.of<Units, 'Units'>('Units'))
    price    = this.optionalColumn('billed_amount', ScaledBigIntsType.of<Price, 'Price'>('Price', 2))
    constructor() { super('issue_worklog') }
}()
const activityValue = tWorklog.activity.equals('review')
// @ts-expect-error a value that isn't one of the values of the enumeration
const otherActivity = tWorklog.activity.equals('sleeping')
const anyActivityValue = tWorklog.anyActivity.equals('meeting')
const unitsValue = tWorklog.minutes.equals(5 as Units)
// @ts-expect-error a plain number isn't a Units
const plainNumber = tWorklog.minutes.equals(5)

// Rule: the values of an enumeration are required: null for any value, never left out (functions never called).
// @ts-expect-error the values are left out
const withoutValues = () => EnumType.of<Activity, 'Activity'>('Activity')
// @ts-expect-error undefined isn't null: it doesn't say that any value goes
const undefinedValues = () => EnumType.of<Activity, 'Activity'>('Activity', undefined)
// @ts-expect-error a value of the list that isn't of the type given
const valueOutside = () => EnumType.of<Activity, 'Activity'>('Activity', ['coding', 'sleeping'])
// The values of the class made can be read
const valuesOfTheEnum = EnumType.of('WorklogActivity', ['coding', 'review', 'meeting']).values
assertType<Exact<typeof valuesOfTheEnum, readonly ('coding' | 'review' | 'meeting')[] | null>>()

// Rule: a family without options takes only its type name; a scaled bigint takes its scale (functions never called).
// @ts-expect-error an integer has no options
const integerWithOption = () => IntegersType.of<Units, 'Units'>('Units', 2)
// @ts-expect-error a scaled bigint of yours says its scale
const scaledWithoutScale = () => ScaledBigIntsType.of<Price, 'Price'>('Price')

// Rule: a data type has no of of a family (functions never called).
// @ts-expect-error IntType is a data type, not a family
const ofOfInt = () => IntType.of('Units')
// @ts-expect-error StringType is a data type, not a family
const ofOfString = () => StringType.of('Code')
// @ts-expect-error the of of the scaled bigint of a scale takes only its scale
const ofOfScaled = () => ScaledBigIntType.of('Price', 2)
const ofScale = ScaledBigIntType.of(2)

test('compile-time-only', () => {
    void [activityValue, otherActivity, anyActivityValue, unitsValue, plainNumber, withoutValues, undefinedValues, valueOutside, integerWithOption, scaledWithoutScale, ofOfInt, ofOfString, ofOfScaled, ofScale]
    expect(true).toBe(true)
})
