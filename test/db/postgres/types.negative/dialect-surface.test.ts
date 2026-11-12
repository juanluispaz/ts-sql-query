// Compile-time negative tests for the dialect surface of PostgreSQL: the
// members other databases offer that PostgreSqlConnection must not. These never
// execute any SQL — the value of the test is that `validate:tests` (tsc)
// rejects each `@ts-expect-error` line. If the library stops rejecting one of
// these (for instance because a database-specific member was moved to a
// shared class), the directive becomes "unused" and the build fails with
// `TS2578` — exactly the regression signal we want.
//
// Each rejected line sits next to a positive control that compiles: the same
// chain up to the rejected member, or a sibling member PostgreSQL offers.
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
    // ---- Connection subclass: protected members

    class _ConnectionSurface extends DBConnection {
        // Rule: declaring that the session computes the set with the row before the update is only of MariaDBConnection.
        // @ts-expect-error useSimultaneousAssignment is not declared on PostgreSqlConnection
        protected override useSimultaneousAssignment = true

        // Positive control: protected members every connection has.
        protected override compatibilityVersion = 1
        callProcedure = () => this.executeProcedure('refresh_stats', [])

        // Rule: PostgreSQL has a native uuid data type, so the uuid storage strategy is not
        // configurable on PostgreSqlConnection.
        // @ts-expect-error uuidStrategy is not declared on PostgreSqlConnection
        protected override uuidStrategy = 'string'

        // Rule: the concatenation function is not configurable on PostgreSqlConnection.
        // @ts-expect-error concatFunction is not declared on PostgreSqlConnection
        protected override concatFunction = 'concat_null'

        // Rule: the NULL-ignoring concatenation opt-out is not part of PostgreSqlConnection.
        // @ts-expect-error ignoreNullInConcat is not declared on PostgreSqlConnection
        protected override ignoreNullInConcat = true

        // Rule: the collation of replace is not configurable on PostgreSqlConnection.
        // @ts-expect-error replaceCollation is not declared on PostgreSqlConnection
        protected override replaceCollation = 'binary'

        // Rule: the collation of the insensitive replace is not configurable on PostgreSqlConnection.
        // @ts-expect-error replaceInsensitiveCollation is not declared on PostgreSqlConnection
        protected override replaceInsensitiveCollation = 'binary_ci'

        // Rule: the trailing-blanks rule of length is not configurable on PostgreSqlConnection.
        // @ts-expect-error excludeTrailingBlanksInLength is not declared on PostgreSqlConnection
        protected override excludeTrailingBlanksInLength = true

        // Rule: the insensitive replace function is not configurable on PostgreSqlConnection.
        // @ts-expect-error replaceAllInsensitiveFunction is not declared on PostgreSqlConnection
        protected override replaceAllInsensitiveFunction = 'ci_replace'

        // Rule: PostgreSQL stores date/time values in a date/time data type, so the integer
        // reading rule is not part of PostgreSqlConnection.
        // @ts-expect-error treatUnexpectedIntegerDateTimeAsJulian is not declared on PostgreSqlConnection
        protected override treatUnexpectedIntegerDateTimeAsJulian = true

        // Rule: PostgreSQL stores date/time values in a date/time data type, so the string
        // reading rule is not part of PostgreSqlConnection.
        // @ts-expect-error treatUnexpectedStringDateTimeAsUTC is not declared on PostgreSqlConnection
        protected override treatUnexpectedStringDateTimeAsUTC = true

        // Rule: PostgreSQL stores date/time values in a date/time data type, so the unix-time
        // reading rule is not part of PostgreSqlConnection.
        // @ts-expect-error unexpectedUnixDateTimeAreMilliseconds is not declared on PostgreSqlConnection
        protected override unexpectedUnixDateTimeAreMilliseconds = true

        // Rule: PostgreSQL stores date/time values in a date/time data type, so the storage
        // format hook is not part of PostgreSqlConnection.
        // @ts-expect-error getDateTimeFormat is not declared on PostgreSqlConnection
        protected override getDateTimeFormat() { return 'TEXT' as const }
    }
    void _ConnectionSurface

    // ---- Select builder

    const issuesSelect = connection.selectFrom(tIssue)

    // Positive control: the same select, filtered with where.
    void issuesSelect.where(tIssue.parentId.isNull())

    // Rule: START WITH / CONNECT BY hierarchical queries are not part of PostgreSQL.
    // @ts-expect-error startWith is not available on PostgreSQL
    void issuesSelect.startWith(tIssue.parentId.isNull())

    // Rule: START WITH / CONNECT BY hierarchical queries are not part of PostgreSQL.
    // @ts-expect-error connectBy is not available on PostgreSQL
    void issuesSelect.connectBy(() => tIssue.id.isNotNull())

    // Rule: START WITH / CONNECT BY hierarchical queries are not part of PostgreSQL.
    // @ts-expect-error connectByNoCycle is not available on PostgreSQL
    void issuesSelect.connectByNoCycle(() => tIssue.id.isNotNull())

    // ---- Insert builder

    const insertOrg = connection.insertInto(tOrganization).values({ name: 'Acme', plan: 'free' })

    // Positive control: a single-row insert returns its generated id.
    void insertOrg.returningLastInsertedId()

    // Rule: PostgreSQL's ON CONFLICT DO UPDATE needs a conflict target, so the
    // untargeted form is not offered; use onConflictOn(...).doUpdateSet(...).
    // @ts-expect-error onConflictDoUpdateSet needs a conflict target on PostgreSQL
    void insertOrg.onConflictDoUpdateSet({ plan: 'pro' })

    // Rule: PostgreSQL's ON CONFLICT DO UPDATE needs a conflict target, so the
    // untargeted form is not offered; use onConflictOn(...).doUpdateSetIfValue(...).
    // @ts-expect-error onConflictDoUpdateSetIfValue needs a conflict target on PostgreSQL
    void insertOrg.onConflictDoUpdateSetIfValue({ plan: 'pro' })

    // Rule: PostgreSQL's ON CONFLICT DO UPDATE needs a conflict target, so the
    // untargeted form is not offered; use onConflictOn(...).doUpdateDynamicSet().
    // @ts-expect-error onConflictDoUpdateDynamicSet needs a conflict target on PostgreSQL
    void insertOrg.onConflictDoUpdateDynamicSet()

    // ---- Update builder

    // Positive control: the extra table of an UPDATE goes in from(...).
    void connection.update(tProject).from(tOrganization)

    // Rule: PostgreSqlConnection takes the extra tables of an UPDATE in from(...), not in
    // a join.
    // @ts-expect-error join is not available on an UPDATE on PostgreSQL
    void connection.update(tProject).join(tOrganization)

    // Rule: PostgreSqlConnection takes the extra tables of an UPDATE in from(...), not in
    // a join.
    // @ts-expect-error innerJoin is not available on an UPDATE on PostgreSQL
    void connection.update(tProject).innerJoin(tOrganization)

    // Rule: PostgreSqlConnection takes the extra tables of an UPDATE in from(...), not in
    // a join.
    // @ts-expect-error leftJoin is not available on an UPDATE on PostgreSQL
    void connection.update(tProject).leftJoin(tOrganization.forUseInLeftJoin())

    // Rule: PostgreSqlConnection takes the extra tables of an UPDATE in from(...), not in
    // a join.
    // @ts-expect-error leftOuterJoin is not available on an UPDATE on PostgreSQL
    void connection.update(tProject).leftOuterJoin(tOrganization.forUseInLeftJoin())

    // Positive control: the same rule on an UPDATE allowed to have no WHERE.
    void connection.updateAllowingNoWhere(tProject).from(tOrganization)

    // Rule: PostgreSqlConnection takes the extra tables of an UPDATE in from(...), not in
    // a join, also when the UPDATE is allowed to have no WHERE.
    // @ts-expect-error join is not available on an UPDATE on PostgreSQL
    void connection.updateAllowingNoWhere(tProject).join(tOrganization)

    // ---- Delete builder

    // Positive control: the extra table of a DELETE goes in using(...).
    void connection.deleteFrom(tIssue).using(tProject)

    // Rule: PostgreSqlConnection takes the extra tables of a DELETE in using(...), not in
    // a join.
    // @ts-expect-error join is not available on a DELETE on PostgreSQL
    void connection.deleteFrom(tIssue).join(tProject)

    // Rule: PostgreSqlConnection does not join the extra tables of a DELETE.
    // @ts-expect-error innerJoin is not available on a DELETE on PostgreSQL
    void connection.deleteFrom(tIssue).innerJoin(tProject)

    // Rule: PostgreSqlConnection does not join the extra tables of a DELETE.
    // @ts-expect-error leftJoin is not available on a DELETE on PostgreSQL
    void connection.deleteFrom(tIssue).leftJoin(tProject.forUseInLeftJoin())

    // Rule: PostgreSqlConnection does not join the extra tables of a DELETE.
    // @ts-expect-error leftOuterJoin is not available on a DELETE on PostgreSQL
    void connection.deleteFrom(tIssue).leftOuterJoin(tProject.forUseInLeftJoin())

    // Rule: PostgreSqlConnection does not join the extra tables of a DELETE, also when the
    // DELETE is allowed to have no WHERE.
    // @ts-expect-error join is not available on a DELETE on PostgreSQL
    void connection.deleteAllowingNoWhereFrom(tIssue).join(tProject)
}

test('dialect-surface-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
