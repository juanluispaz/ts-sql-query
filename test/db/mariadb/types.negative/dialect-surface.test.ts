// Compile-time negative tests for the dialect surface of MariaDB: the
// members other databases offer that MariaDBConnection must not. These never
// execute any SQL — the value of the test is that `validate:tests` (tsc)
// rejects each `@ts-expect-error` line. If the library stops rejecting one of
// these (for instance because a database-specific member was moved to a
// shared class), the directive becomes "unused" and the build fails with
// `TS2578` — exactly the regression signal we want.
//
// Each rejected line sits next to a positive control that compiles: the same
// chain up to the rejected member, or a sibling member MariaDB offers.
//
// Every `@ts-expect-error` MUST be accompanied by a comment naming the rule it
// enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import { DBConnection, tIssue, tOrganization, tProject } from '../domain/connection.js'

// `connection` is type-only — the function below is checked by tsc but
// never invoked at runtime.
declare const connection: DBConnection

// The body of `_typeNegatives` is checked by tsc but never executed at
// runtime.
function _typeNegatives() {
    // ---- Connection: aggregate functions and value builders

    // Positive control: a sibling single-value aggregate.
    void connection.min(tProject.id)

    // Rule: MariaDBConnection does not offer anyValue (MariaDB has no ANY_VALUE aggregate).
    // @ts-expect-error anyValue does not exist on MariaDBConnection
    void connection.anyValue(tProject.id)

    // ---- Connection subclass: protected members

    class _ConnectionSurface extends DBConnection {
        // Positive control: protected members every connection has.
        protected override compatibilityVersion = 1
        callProcedure = () => this.executeProcedure('refresh_stats', [])

        // Rule: the native NULL handling of minValue/maxValue is not configurable on MariaDBConnection.
        // @ts-expect-error ignoreNullInMinAndMaxValue is not declared on MariaDBConnection
        protected override ignoreNullInMinAndMaxValue = true

        // Rule: minValue cannot be routed to a user function on MariaDBConnection.
        // @ts-expect-error minValueFunction is not declared on MariaDBConnection
        protected override minValueFunction = 'min_value'

        // Rule: maxValue cannot be routed to a user function on MariaDBConnection.
        // @ts-expect-error maxValueFunction is not declared on MariaDBConnection
        protected override maxValueFunction = 'max_value'

        // Rule: the concatenation function is not configurable on MariaDBConnection.
        // @ts-expect-error concatFunction is not declared on MariaDBConnection
        protected override concatFunction = 'concat_null'

        // Rule: the NULL-ignoring concatenation opt-out is not part of MariaDBConnection.
        // @ts-expect-error ignoreNullInConcat is not declared on MariaDBConnection
        protected override ignoreNullInConcat = true

        // Rule: the collation of replace is not configurable on MariaDBConnection.
        // @ts-expect-error replaceCollation is not declared on MariaDBConnection
        protected override replaceCollation = 'binary'

        // Rule: the collation of the insensitive replace is not configurable on MariaDBConnection.
        // @ts-expect-error replaceInsensitiveCollation is not declared on MariaDBConnection
        protected override replaceInsensitiveCollation = 'binary_ci'

        // Rule: the trailing-blanks rule of length is not configurable on MariaDBConnection.
        // @ts-expect-error excludeTrailingBlanksInLength is not declared on MariaDBConnection
        protected override excludeTrailingBlanksInLength = true

        // Rule: the insensitive replace function is not configurable on MariaDBConnection.
        // @ts-expect-error replaceAllInsensitiveFunction is not declared on MariaDBConnection
        protected override replaceAllInsensitiveFunction = 'ci_replace'

        // Rule: MariaDB stores date/time values in a date/time data type, so the integer
        // reading rule is not part of MariaDBConnection.
        // @ts-expect-error treatUnexpectedIntegerDateTimeAsJulian is not declared on MariaDBConnection
        protected override treatUnexpectedIntegerDateTimeAsJulian = true

        // Rule: MariaDB stores date/time values in a date/time data type, so the string
        // reading rule is not part of MariaDBConnection.
        // @ts-expect-error treatUnexpectedStringDateTimeAsUTC is not declared on MariaDBConnection
        protected override treatUnexpectedStringDateTimeAsUTC = true

        // Rule: MariaDB stores date/time values in a date/time data type, so the unix-time
        // reading rule is not part of MariaDBConnection.
        // @ts-expect-error unexpectedUnixDateTimeAreMilliseconds is not declared on MariaDBConnection
        protected override unexpectedUnixDateTimeAreMilliseconds = true

        // Rule: MariaDB stores date/time values in a date/time data type, so the storage
        // format hook is not part of MariaDBConnection.
        // @ts-expect-error getDateTimeFormat is not declared on MariaDBConnection
        protected override getDateTimeFormat() { return 'TEXT' as const }
    }
    void _ConnectionSurface

    // ---- Select builder

    const issuesSelect = connection.selectFrom(tIssue)

    // Positive control: the same select, filtered with where.
    void issuesSelect.where(tIssue.parentId.isNull())

    // Rule: START WITH / CONNECT BY hierarchical queries are not part of MariaDB.
    // @ts-expect-error startWith is not available on MariaDB
    void issuesSelect.startWith(tIssue.parentId.isNull())

    // Rule: START WITH / CONNECT BY hierarchical queries are not part of MariaDB.
    // @ts-expect-error connectBy is not available on MariaDB
    void issuesSelect.connectBy(() => tIssue.id.isNotNull())

    // Rule: START WITH / CONNECT BY hierarchical queries are not part of MariaDB.
    // @ts-expect-error connectByNoCycle is not available on MariaDB
    void issuesSelect.connectByNoCycle(() => tIssue.id.isNotNull())

    // Positive control: an uncorrelated select used as a WITH view.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).forUseInQueryAs('issueIds')

    const issuesOfOuterProject = connection.subSelectUsing(tProject).from(tIssue).where(tIssue.projectId.equals(tProject.id)).select({ id: tIssue.id })

    // Rule: MariaDB cannot reference the outer query from inside a WITH, so a
    // correlated select is not offered as a WITH view.
    // @ts-expect-error forUseInQueryAs is not available on a correlated select on MariaDB
    void issuesOfOuterProject.forUseInQueryAs('projectIssueIds')

    // ---- Insert builder

    const insertOrg = connection.insertInto(tOrganization).values({ name: 'Acme', plan: 'free' })

    // Positive control: a single-row insert returns its generated id.
    void insertOrg.returningLastInsertedId()

    // Rule: MariaDB's ON DUPLICATE KEY UPDATE has no conflict target, so onConflictOn
    // is not offered.
    // @ts-expect-error onConflictOn is not available on MariaDB
    void insertOrg.onConflictOn(tOrganization.name)

    // Rule: MariaDB's ON DUPLICATE KEY UPDATE has no conflict target, so
    // onConflictOnConstraint is not offered.
    // @ts-expect-error onConflictOnConstraint is not available on MariaDB
    void insertOrg.onConflictOnConstraint(connection.rawFragment`organization_name_key`)

    // Positive control: the untargeted upsert, executed as is.
    void insertOrg.onConflictDoUpdateSet({ plan: 'pro' }).executeInsert()

    // Rule: MariaDB's ON DUPLICATE KEY UPDATE has no WHERE.
    // @ts-expect-error where is not available after onConflictDoUpdateSet on MariaDB
    void insertOrg.onConflictDoUpdateSet({ plan: 'pro' }).where(tOrganization.plan.notEquals('pro'))

    // Rule: MariaDB's ON DUPLICATE KEY UPDATE has no WHERE.
    // @ts-expect-error dynamicWhere is not available after onConflictDoUpdateSet on MariaDB
    void insertOrg.onConflictDoUpdateSet({ plan: 'pro' }).dynamicWhere()
}

test('dialect-surface-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
