// Compile-time negative tests for the dialect surface of MySQL: the
// members other databases offer that MySqlConnection must not. These never
// execute any SQL — the value of the test is that `validate:tests` (tsc)
// rejects each `@ts-expect-error` line. If the library stops rejecting one of
// these (for instance because a database-specific member was moved to a
// shared class), the directive becomes "unused" and the build fails with
// `TS2578` — exactly the regression signal we want.
//
// Each rejected line sits next to a positive control that compiles: the same
// chain up to the rejected member, or a sibling member MySQL offers.
//
// Every `@ts-expect-error` MUST be accompanied by a comment naming the rule it
// enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import { Table } from '../../../../src/Table.js'
import { DBConnection, tIssue, tOrganization, tProject } from '../domain/connection.js'

// `connection` is type-only — the function below is checked by tsc but
// never invoked at runtime.
declare const connection: DBConnection

// The body of `_typeNegatives` is checked by tsc but never executed at
// runtime.
function _typeNegatives() {
    // ---- Connection: aggregate functions and value builders

    // Positive control: the array aggregates without DISTINCT.
    void connection.aggregateAsArray({ id: tProject.id })
    void connection.aggregateAsArrayOfOneColumn(tProject.id)

    // Rule: MySqlConnection does not offer the DISTINCT form of the array aggregate.
    // @ts-expect-error aggregateAsArrayDistinct does not exist on MySqlConnection
    void connection.aggregateAsArrayDistinct({ id: tProject.id })

    // Rule: MySqlConnection does not offer the DISTINCT form of the one-column array aggregate.
    // @ts-expect-error aggregateAsArrayOfOneColumnDistinct does not exist on MySqlConnection
    void connection.aggregateAsArrayOfOneColumnDistinct(tProject.id)

    // ---- Connection subclass: protected members

    class _ConnectionSurface extends DBConnection {
        // Rule: declaring that the session computes the set with the row before the update is only of MariaDBConnection.
        // @ts-expect-error useSimultaneousAssignment is not declared on MySqlConnection
        protected override useSimultaneousAssignment = true

        // Positive control: protected members every connection has.
        protected override compatibilityVersion = 1
        callProcedure = () => this.executeProcedure('refresh_stats', [])

        // Rule: MySQL has no sequences, so MySqlConnection has no sequence(...).
        // @ts-expect-error sequence does not exist on MySqlConnection
        issueIdSeq = this.sequence('issue_id_seq', 'int')

        // Rule: the native NULL handling of minValue/maxValue is not configurable on MySqlConnection.
        // @ts-expect-error ignoreNullInMinAndMaxValue is not declared on MySqlConnection
        protected override ignoreNullInMinAndMaxValue = true

        // Rule: minValue cannot be routed to a user function on MySqlConnection.
        // @ts-expect-error minValueFunction is not declared on MySqlConnection
        protected override minValueFunction = 'min_value'

        // Rule: maxValue cannot be routed to a user function on MySqlConnection.
        // @ts-expect-error maxValueFunction is not declared on MySqlConnection
        protected override maxValueFunction = 'max_value'

        // Rule: the concatenation function is not configurable on MySqlConnection.
        // @ts-expect-error concatFunction is not declared on MySqlConnection
        protected override concatFunction = 'concat_null'

        // Rule: the NULL-ignoring concatenation opt-out is not part of MySqlConnection.
        // @ts-expect-error ignoreNullInConcat is not declared on MySqlConnection
        protected override ignoreNullInConcat = true

        // Rule: the collation of replace is not configurable on MySqlConnection.
        // @ts-expect-error replaceCollation is not declared on MySqlConnection
        protected override replaceCollation = 'binary'

        // Rule: the collation of the insensitive replace is not configurable on MySqlConnection.
        // @ts-expect-error replaceInsensitiveCollation is not declared on MySqlConnection
        protected override replaceInsensitiveCollation = 'binary_ci'

        // Rule: the trailing-blanks rule of length is not configurable on MySqlConnection.
        // @ts-expect-error excludeTrailingBlanksInLength is not declared on MySqlConnection
        protected override excludeTrailingBlanksInLength = true

        // Rule: the insensitive replace function is not configurable on MySqlConnection.
        // @ts-expect-error replaceAllInsensitiveFunction is not declared on MySqlConnection
        protected override replaceAllInsensitiveFunction = 'ci_replace'

        // Rule: MySQL stores date/time values in a date/time data type, so the integer
        // reading rule is not part of MySqlConnection.
        // @ts-expect-error treatUnexpectedIntegerDateTimeAsJulian is not declared on MySqlConnection
        protected override treatUnexpectedIntegerDateTimeAsJulian = true

        // Rule: MySQL stores date/time values in a date/time data type, so the string
        // reading rule is not part of MySqlConnection.
        // @ts-expect-error treatUnexpectedStringDateTimeAsUTC is not declared on MySqlConnection
        protected override treatUnexpectedStringDateTimeAsUTC = true

        // Rule: MySQL stores date/time values in a date/time data type, so the unix-time
        // reading rule is not part of MySqlConnection.
        // @ts-expect-error unexpectedUnixDateTimeAreMilliseconds is not declared on MySqlConnection
        protected override unexpectedUnixDateTimeAreMilliseconds = true

        // Rule: MySQL stores date/time values in a date/time data type, so the storage
        // format hook is not part of MySqlConnection.
        // @ts-expect-error getDateTimeFormat is not declared on MySqlConnection
        protected override getDateTimeFormat() { return 'TEXT' as const }
    }
    void _ConnectionSurface

    // ---- Table subclass: protected members

    class _TableSurface extends Table<DBConnection, '_TableSurface'> {
        // Positive control: the autogenerated primary key without a sequence.
        code = this.autogeneratedPrimaryKey('code', 'int')

        // Rule: MySQL has no sequences, so a primary key cannot be generated by one.
        // @ts-expect-error autogeneratedPrimaryKeyBySequence is not available on MySQL
        id = this.autogeneratedPrimaryKeyBySequence('id', 'issue_id_seq', 'int')
        constructor() { super('table_surface') }
    }
    void _TableSurface

    // ---- Table: database-specific members

    // Positive control: a sibling member that derives a view of the table.
    void tProject.forUseInLeftJoin()

    // Rule: MySqlConnection does not offer oldValues() (the row before the UPDATE, read in
    // RETURNING).
    // @ts-expect-error oldValues is not available on MySQL
    void tProject.oldValues()

    // ---- Select builder

    const issuesSelect = connection.selectFrom(tIssue)

    // Positive control: the same select, filtered with where.
    void issuesSelect.where(tIssue.parentId.isNull())

    // Rule: START WITH / CONNECT BY hierarchical queries are not part of MySQL.
    // @ts-expect-error startWith is not available on MySQL
    void issuesSelect.startWith(tIssue.parentId.isNull())

    // Rule: START WITH / CONNECT BY hierarchical queries are not part of MySQL.
    // @ts-expect-error connectBy is not available on MySQL
    void issuesSelect.connectBy(() => tIssue.id.isNotNull())

    // Rule: START WITH / CONNECT BY hierarchical queries are not part of MySQL.
    // @ts-expect-error connectByNoCycle is not available on MySQL
    void issuesSelect.connectByNoCycle(() => tIssue.id.isNotNull())

    // ---- Insert builder

    const insertOrg = connection.insertInto(tOrganization).values({ name: 'Acme', plan: 'free' })

    // Positive control: a single-row insert returns its generated id.
    void insertOrg.returningLastInsertedId()

    // Positive control: the same insert, executed without RETURNING.
    void insertOrg.executeInsert()

    // Rule: MySQL's INSERT has no RETURNING.
    // @ts-expect-error returning is not available on MySQL
    void insertOrg.returning({ id: tOrganization.id })

    // Rule: MySQL's INSERT has no RETURNING.
    // @ts-expect-error returningOneColumn is not available on MySQL
    void insertOrg.returningOneColumn(tOrganization.id)

    // Rule: MySQL reports only the first generated id of a multi-row insert, so
    // returningLastInsertedId is not offered on it.
    // @ts-expect-error returningLastInsertedId is not available on a multi-row insert on MySQL
    void connection.insertInto(tOrganization).values([{ name: 'Acme', plan: 'free' }, { name: 'Initech', plan: 'pro' }]).returningLastInsertedId()

    // Rule: MySQL's ON DUPLICATE KEY UPDATE has no conflict target, so onConflictOn
    // is not offered.
    // @ts-expect-error onConflictOn is not available on MySQL
    void insertOrg.onConflictOn(tOrganization.name)

    // Rule: MySQL's ON DUPLICATE KEY UPDATE has no conflict target, so
    // onConflictOnConstraint is not offered.
    // @ts-expect-error onConflictOnConstraint is not available on MySQL
    void insertOrg.onConflictOnConstraint(connection.rawFragment`organization_name_key`)

    // Positive control: the untargeted upsert, executed as is.
    void insertOrg.onConflictDoUpdateSet({ plan: 'pro' }).executeInsert()

    // Rule: MySQL's ON DUPLICATE KEY UPDATE has no WHERE.
    // @ts-expect-error where is not available after onConflictDoUpdateSet on MySQL
    void insertOrg.onConflictDoUpdateSet({ plan: 'pro' }).where(tOrganization.plan.notEquals('pro'))

    // Rule: MySQL's ON DUPLICATE KEY UPDATE has no WHERE.
    // @ts-expect-error dynamicWhere is not available after onConflictDoUpdateSet on MySQL
    void insertOrg.onConflictDoUpdateSet({ plan: 'pro' }).dynamicWhere()

    // Positive control: the insert that ignores a conflict, executed as is.
    void insertOrg.onConflictDoNothing().executeInsert()

    // Rule: MySQL's INSERT has no RETURNING.
    // @ts-expect-error returning is not available after onConflictDoNothing on MySQL
    void insertOrg.onConflictDoNothing().returning({ id: tOrganization.id })

    // Rule: MySQL cannot report the generated id of an insert that may be
    // ignored or turned into an update by its conflict clause.
    // @ts-expect-error returningLastInsertedId is not available after onConflictDoNothing on MySQL
    void insertOrg.onConflictDoNothing().returningLastInsertedId()

    const insertOrgFromSelect = connection.insertInto(tOrganization).from(connection.selectFrom(tOrganization).select({ name: tOrganization.name, plan: tOrganization.plan }))

    // Positive control: the same INSERT ... SELECT, executed without RETURNING.
    void insertOrgFromSelect.executeInsert()

    // Rule: MySQL's INSERT has no RETURNING.
    // @ts-expect-error returning is not available on an INSERT ... SELECT on MySQL
    void insertOrgFromSelect.returning({ id: tOrganization.id })

    // Rule: MySQL's INSERT has no RETURNING.
    // @ts-expect-error returningOneColumn is not available on an INSERT ... SELECT on MySQL
    void insertOrgFromSelect.returningOneColumn(tOrganization.id)

    // Rule: MySQL cannot report the generated ids of an INSERT ... SELECT.
    // @ts-expect-error returningLastInsertedId is not available on an INSERT ... SELECT on MySQL
    void insertOrgFromSelect.returningLastInsertedId()

    // ---- Update builder

    const updateProject = connection.update(tProject).set({ name: 'x' }).where(tProject.id.equals(1))

    // Positive control: the same update, executed without RETURNING.
    void updateProject.executeUpdate()

    // Rule: MySQL's UPDATE has no RETURNING.
    // @ts-expect-error returning is not available on MySQL
    void updateProject.returning({ id: tProject.id })

    // Rule: MySQL's UPDATE has no RETURNING.
    // @ts-expect-error returningOneColumn is not available on MySQL
    void updateProject.returningOneColumn(tProject.id)

    // ---- Delete builder

    const deleteIssue = connection.deleteFrom(tIssue).where(tIssue.id.equals(1))

    // Positive control: the same delete, executed without RETURNING.
    void deleteIssue.executeDelete()

    // Rule: MySQL's DELETE has no RETURNING.
    // @ts-expect-error returning is not available on MySQL
    void deleteIssue.returning({ id: tIssue.id })

    // Rule: MySQL's DELETE has no RETURNING.
    // @ts-expect-error returningOneColumn is not available on MySQL
    void deleteIssue.returningOneColumn(tIssue.id)
}

test('dialect-surface-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
