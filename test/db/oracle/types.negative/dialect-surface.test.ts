// Compile-time negative tests for the dialect surface of Oracle: the
// members other databases offer that OracleConnection must not. These never
// execute any SQL — the value of the test is that `validate:tests` (tsc)
// rejects each `@ts-expect-error` line. If the library stops rejecting one of
// these (for instance because a database-specific member was moved to a
// shared class), the directive becomes "unused" and the build fails with
// `TS2578` — exactly the regression signal we want.
//
// Each rejected line sits next to a positive control that compiles: the same
// chain up to the rejected member, or a sibling member Oracle offers.
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

    // Positive control: the array aggregates without DISTINCT.
    void connection.aggregateAsArray({ id: tProject.id })
    void connection.aggregateAsArrayOfOneColumn(tProject.id)

    // Rule: OracleConnection does not offer the DISTINCT form of the array aggregate.
    // @ts-expect-error aggregateAsArrayDistinct does not exist on OracleConnection
    void connection.aggregateAsArrayDistinct({ id: tProject.id })

    // Rule: OracleConnection does not offer the DISTINCT form of the one-column array aggregate.
    // @ts-expect-error aggregateAsArrayOfOneColumnDistinct does not exist on OracleConnection
    void connection.aggregateAsArrayOfOneColumnDistinct(tProject.id)

    // ---- Connection subclass: protected members

    class _ConnectionSurface extends DBConnection {
        // Positive control: protected members every connection has.
        protected override compatibilityVersion = 1
        callProcedure = () => this.executeProcedure('refresh_stats', [])

        // Positive control: the platform-dependent round opt-out (the scale of roundn) is declared here too.
        protected override usePlatformDependentRound = true

        // Rule: the native NULL handling of minValue/maxValue is not configurable on OracleConnection.
        // @ts-expect-error ignoreNullInMinAndMaxValue is not declared on OracleConnection
        protected override ignoreNullInMinAndMaxValue = true

        // Rule: minValue cannot be routed to a user function on OracleConnection.
        // @ts-expect-error minValueFunction is not declared on OracleConnection
        protected override minValueFunction = 'min_value'

        // Rule: maxValue cannot be routed to a user function on OracleConnection.
        // @ts-expect-error maxValueFunction is not declared on OracleConnection
        protected override maxValueFunction = 'max_value'

        // Rule: the trailing-blanks rule of length is not configurable on OracleConnection.
        // @ts-expect-error excludeTrailingBlanksInLength is not declared on OracleConnection
        protected override excludeTrailingBlanksInLength = true

        // Rule: the insensitive replace function is not configurable on OracleConnection.
        // @ts-expect-error replaceAllInsensitiveFunction is not declared on OracleConnection
        protected override replaceAllInsensitiveFunction = 'ci_replace'

        // Rule: Oracle stores date/time values in a date/time data type, so the integer
        // reading rule is not part of OracleConnection.
        // @ts-expect-error treatUnexpectedIntegerDateTimeAsJulian is not declared on OracleConnection
        protected override treatUnexpectedIntegerDateTimeAsJulian = true

        // Rule: Oracle stores date/time values in a date/time data type, so the string
        // reading rule is not part of OracleConnection.
        // @ts-expect-error treatUnexpectedStringDateTimeAsUTC is not declared on OracleConnection
        protected override treatUnexpectedStringDateTimeAsUTC = true

        // Rule: Oracle stores date/time values in a date/time data type, so the unix-time
        // reading rule is not part of OracleConnection.
        // @ts-expect-error unexpectedUnixDateTimeAreMilliseconds is not declared on OracleConnection
        protected override unexpectedUnixDateTimeAreMilliseconds = true

        // Rule: Oracle stores date/time values in a date/time data type, so the storage
        // format hook is not part of OracleConnection.
        // @ts-expect-error getDateTimeFormat is not declared on OracleConnection
        protected override getDateTimeFormat() { return 'TEXT' as const }
    }
    void _ConnectionSurface

    // ---- Table: database-specific members

    // Positive control: a sibling member that derives a view of the table.
    void tProject.forUseInLeftJoin()

    // Rule: OracleConnection does not offer oldValues() (the row before the UPDATE, read in
    // RETURNING).
    // @ts-expect-error oldValues is not available on Oracle
    void tProject.oldValues()

    // Rule: Oracle has no ON CONFLICT / ON DUPLICATE KEY upsert, so valuesForInsert()
    // (the inserted row inside the upsert) is not offered.
    // @ts-expect-error valuesForInsert is not available on Oracle
    void tProject.valuesForInsert()

    // ---- Select builder

    const issueTreeRoot = connection.selectFrom(tIssue).where(tIssue.parentId.isNull()).select({ id: tIssue.id, parentId: tIssue.parentId })

    // Positive control: the recursive CTE joined with UNION ALL.
    void issueTreeRoot.recursiveUnionAll((parent) => connection.selectFrom(tIssue).join(parent).on(tIssue.parentId.equals(parent.id)).select({ id: tIssue.id, parentId: tIssue.parentId }))
    void issueTreeRoot.recursiveUnionAllOn((child) => child.parentId.equals(tIssue.id))

    // Rule: Oracle accepts only UNION ALL between the members of a recursive CTE,
    // so recursiveUnion is not offered.
    // @ts-expect-error recursiveUnion is not available on Oracle
    void issueTreeRoot.recursiveUnion(() => connection.selectFrom(tIssue).select({ id: tIssue.id, parentId: tIssue.parentId }))

    // Rule: Oracle accepts only UNION ALL between the members of a recursive CTE,
    // so recursiveUnionOn is not offered.
    // @ts-expect-error recursiveUnionOn is not available on Oracle
    void issueTreeRoot.recursiveUnionOn(() => tIssue.id.isNotNull())

    // Positive control: an uncorrelated select used as a WITH view.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).forUseInQueryAs('issueIds')

    const issuesOfOuterProject = connection.subSelectUsing(tProject).from(tIssue).where(tIssue.projectId.equals(tProject.id)).select({ id: tIssue.id })

    // Rule: Oracle cannot reference the outer query from inside a WITH, so a
    // correlated select is not offered as a WITH view.
    // @ts-expect-error forUseInQueryAs is not available on a correlated select on Oracle
    void issuesOfOuterProject.forUseInQueryAs('projectIssueIds')

    // ---- Insert builder

    const insertOrg = connection.insertInto(tOrganization).values({ name: 'Acme', plan: 'free' })

    // Positive control: a single-row insert returns its generated id.
    void insertOrg.returningLastInsertedId()

    // Rule: Oracle has no ON CONFLICT DO NOTHING / INSERT IGNORE form.
    // @ts-expect-error onConflictDoNothing is not available on Oracle
    void insertOrg.onConflictDoNothing()

    // Rule: Oracle has no ON CONFLICT DO UPDATE / ON DUPLICATE KEY UPDATE form.
    // @ts-expect-error onConflictDoUpdateSet is not available on Oracle
    void insertOrg.onConflictDoUpdateSet({ plan: 'pro' })

    // Rule: Oracle has no ON CONFLICT DO UPDATE / ON DUPLICATE KEY UPDATE form.
    // @ts-expect-error onConflictDoUpdateSetIfValue is not available on Oracle
    void insertOrg.onConflictDoUpdateSetIfValue({ plan: 'pro' })

    // Rule: Oracle has no ON CONFLICT DO UPDATE / ON DUPLICATE KEY UPDATE form.
    // @ts-expect-error onConflictDoUpdateDynamicSet is not available on Oracle
    void insertOrg.onConflictDoUpdateDynamicSet()

    // Rule: Oracle has no ON CONFLICT clause, so onConflictOn is not offered.
    // @ts-expect-error onConflictOn is not available on Oracle
    void insertOrg.onConflictOn(tOrganization.name)

    // Rule: Oracle has no ON CONFLICT clause, so onConflictOnConstraint is not offered.
    // @ts-expect-error onConflictOnConstraint is not available on Oracle
    void insertOrg.onConflictOnConstraint(connection.rawFragment`organization_name_key`)

    const insertOrgFromSelect = connection.insertInto(tOrganization).from(connection.selectFrom(tOrganization).select({ name: tOrganization.name, plan: tOrganization.plan }))

    // Positive control: the same INSERT ... SELECT, executed without RETURNING.
    void insertOrgFromSelect.executeInsert()

    // Rule: Oracle's RETURNING cannot be used with INSERT ... SELECT.
    // @ts-expect-error returning is not available on an INSERT ... SELECT on Oracle
    void insertOrgFromSelect.returning({ id: tOrganization.id })

    // Rule: Oracle's RETURNING cannot be used with INSERT ... SELECT.
    // @ts-expect-error returningOneColumn is not available on an INSERT ... SELECT on Oracle
    void insertOrgFromSelect.returningOneColumn(tOrganization.id)

    // Rule: Oracle's RETURNING cannot be used with INSERT ... SELECT, so the
    // generated ids cannot be reported.
    // @ts-expect-error returningLastInsertedId is not available on an INSERT ... SELECT on Oracle
    void insertOrgFromSelect.returningLastInsertedId()

    // ---- Update builder

    // Positive control: the extra table of an UPDATE goes in from(...).
    void connection.update(tProject).from(tOrganization)

    // Rule: OracleConnection takes the extra tables of an UPDATE in from(...), not in
    // a join.
    // @ts-expect-error join is not available on an UPDATE on Oracle
    void connection.update(tProject).join(tOrganization)

    // Rule: OracleConnection takes the extra tables of an UPDATE in from(...), not in
    // a join.
    // @ts-expect-error innerJoin is not available on an UPDATE on Oracle
    void connection.update(tProject).innerJoin(tOrganization)

    // Rule: OracleConnection takes the extra tables of an UPDATE in from(...), not in
    // a join.
    // @ts-expect-error leftJoin is not available on an UPDATE on Oracle
    void connection.update(tProject).leftJoin(tOrganization.forUseInLeftJoin())

    // Rule: OracleConnection takes the extra tables of an UPDATE in from(...), not in
    // a join.
    // @ts-expect-error leftOuterJoin is not available on an UPDATE on Oracle
    void connection.update(tProject).leftOuterJoin(tOrganization.forUseInLeftJoin())

    // Positive control: the same rule on an UPDATE allowed to have no WHERE.
    void connection.updateAllowingNoWhere(tProject).from(tOrganization)

    // Rule: OracleConnection takes the extra tables of an UPDATE in from(...), not in
    // a join, also when the UPDATE is allowed to have no WHERE.
    // @ts-expect-error join is not available on an UPDATE on Oracle
    void connection.updateAllowingNoWhere(tProject).join(tOrganization)

    // ---- Delete builder

    // Positive control: the extra table of a DELETE goes in using(...).
    void connection.deleteFrom(tIssue).using(tProject)

    // Rule: OracleConnection takes the extra tables of a DELETE in using(...), not in
    // a join.
    // @ts-expect-error join is not available on a DELETE on Oracle
    void connection.deleteFrom(tIssue).join(tProject)

    // Rule: OracleConnection does not join the extra tables of a DELETE.
    // @ts-expect-error innerJoin is not available on a DELETE on Oracle
    void connection.deleteFrom(tIssue).innerJoin(tProject)

    // Rule: OracleConnection does not join the extra tables of a DELETE.
    // @ts-expect-error leftJoin is not available on a DELETE on Oracle
    void connection.deleteFrom(tIssue).leftJoin(tProject.forUseInLeftJoin())

    // Rule: OracleConnection does not join the extra tables of a DELETE.
    // @ts-expect-error leftOuterJoin is not available on a DELETE on Oracle
    void connection.deleteFrom(tIssue).leftOuterJoin(tProject.forUseInLeftJoin())

    // Rule: OracleConnection does not join the extra tables of a DELETE, also when the
    // DELETE is allowed to have no WHERE.
    // @ts-expect-error join is not available on a DELETE on Oracle
    void connection.deleteAllowingNoWhereFrom(tIssue).join(tProject)
}

test('dialect-surface-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
