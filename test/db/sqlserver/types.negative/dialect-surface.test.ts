// Compile-time negative tests for the dialect surface of SQL Server: the
// members other databases offer that SqlServerConnection must not. These never
// execute any SQL — the value of the test is that `validate:tests` (tsc)
// rejects each `@ts-expect-error` line. If the library stops rejecting one of
// these (for instance because a database-specific member was moved to a
// shared class), the directive becomes "unused" and the build fails with
// `TS2578` — exactly the regression signal we want.
//
// Each rejected line sits next to a positive control that compiles: the same
// chain up to the rejected member, or a sibling member SQL Server offers.
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

    // Rule: SqlServerConnection does not offer the DISTINCT form of the array aggregate.
    // @ts-expect-error aggregateAsArrayDistinct does not exist on SqlServerConnection
    void connection.aggregateAsArrayDistinct({ id: tProject.id })

    // Rule: SqlServerConnection does not offer the DISTINCT form of the one-column array aggregate.
    // @ts-expect-error aggregateAsArrayOfOneColumnDistinct does not exist on SqlServerConnection
    void connection.aggregateAsArrayOfOneColumnDistinct(tProject.id)

    // Positive control: the string aggregate without DISTINCT.
    void connection.stringConcat(tProject.name)

    // Rule: SQL Server's string_agg takes no DISTINCT, so stringConcatDistinct is
    // not offered.
    // @ts-expect-error stringConcatDistinct does not exist on SqlServerConnection
    void connection.stringConcatDistinct(tProject.name)

    // Positive control: a sibling single-value aggregate.
    void connection.min(tProject.id)

    // Rule: SqlServerConnection does not offer anyValue (SQL Server has no ANY_VALUE aggregate).
    // @ts-expect-error anyValue does not exist on SqlServerConnection
    void connection.anyValue(tProject.id)

    // ---- Connection subclass: protected members

    class _ConnectionSurface extends DBConnection {
        // Positive control: protected members every connection has.
        protected override compatibilityVersion = 1
        callProcedure = () => this.executeProcedure('refresh_stats', [])

        // Positive control: the platform-dependent round opt-out (the scale of roundn) is declared here too.
        protected override usePlatformDependentRound = true

        // Rule: SQL Server has a native uuid data type, so the uuid storage strategy is not
        // configurable on SqlServerConnection.
        // @ts-expect-error uuidStrategy is not declared on SqlServerConnection
        protected override uuidStrategy = 'string'

        // Rule: the concatenation function is not configurable on SqlServerConnection.
        // @ts-expect-error concatFunction is not declared on SqlServerConnection
        protected override concatFunction = 'concat_null'

        // Rule: the NULL-ignoring concatenation opt-out is not part of SqlServerConnection.
        // @ts-expect-error ignoreNullInConcat is not declared on SqlServerConnection
        protected override ignoreNullInConcat = true

        // Rule: the collation of the insensitive replace is not configurable on SqlServerConnection.
        // @ts-expect-error replaceInsensitiveCollation is not declared on SqlServerConnection
        protected override replaceInsensitiveCollation = 'binary_ci'

        // Rule: the insensitive replace function is not configurable on SqlServerConnection.
        // @ts-expect-error replaceAllInsensitiveFunction is not declared on SqlServerConnection
        protected override replaceAllInsensitiveFunction = 'ci_replace'

        // Rule: SQL Server stores date/time values in a date/time data type, so the integer
        // reading rule is not part of SqlServerConnection.
        // @ts-expect-error treatUnexpectedIntegerDateTimeAsJulian is not declared on SqlServerConnection
        protected override treatUnexpectedIntegerDateTimeAsJulian = true

        // Rule: SQL Server stores date/time values in a date/time data type, so the string
        // reading rule is not part of SqlServerConnection.
        // @ts-expect-error treatUnexpectedStringDateTimeAsUTC is not declared on SqlServerConnection
        protected override treatUnexpectedStringDateTimeAsUTC = true

        // Rule: SQL Server stores date/time values in a date/time data type, so the unix-time
        // reading rule is not part of SqlServerConnection.
        // @ts-expect-error unexpectedUnixDateTimeAreMilliseconds is not declared on SqlServerConnection
        protected override unexpectedUnixDateTimeAreMilliseconds = true

        // Rule: SQL Server stores date/time values in a date/time data type, so the storage
        // format hook is not part of SqlServerConnection.
        // @ts-expect-error getDateTimeFormat is not declared on SqlServerConnection
        protected override getDateTimeFormat() { return 'TEXT' as const }
    }
    void _ConnectionSurface

    // ---- Table: database-specific members

    // Rule: SQL Server has no ON CONFLICT / ON DUPLICATE KEY upsert, so valuesForInsert()
    // (the inserted row inside the upsert) is not offered.
    // @ts-expect-error valuesForInsert is not available on SQL Server
    void tProject.valuesForInsert()

    // ---- Select builder

    const issuesOfProject1 = connection.selectFrom(tIssue).where(tIssue.projectId.equals(1)).select({ id: tIssue.id })
    const issuesOfProject2 = connection.selectFrom(tIssue).where(tIssue.projectId.equals(2)).select({ id: tIssue.id })

    // Positive control: the compound operators without ALL.
    void issuesOfProject1.intersect(issuesOfProject2)
    void issuesOfProject1.except(issuesOfProject2)
    void issuesOfProject1.minus(issuesOfProject2)

    // Rule: SQL Server has no INTERSECT ALL.
    // @ts-expect-error intersectAll is not available on SQL Server
    void issuesOfProject1.intersectAll(issuesOfProject2)

    // Rule: SQL Server has no EXCEPT ALL.
    // @ts-expect-error exceptAll is not available on SQL Server
    void issuesOfProject1.exceptAll(issuesOfProject2)

    // Rule: SQL Server has no EXCEPT ALL (minusAll is its alias).
    // @ts-expect-error minusAll is not available on SQL Server
    void issuesOfProject1.minusAll(issuesOfProject2)

    const issueTreeRoot = connection.selectFrom(tIssue).where(tIssue.parentId.isNull()).select({ id: tIssue.id, parentId: tIssue.parentId })

    // Positive control: the recursive CTE joined with UNION ALL.
    void issueTreeRoot.recursiveUnionAll((parent) => connection.selectFrom(tIssue).join(parent).on(tIssue.parentId.equals(parent.id)).select({ id: tIssue.id, parentId: tIssue.parentId }))
    void issueTreeRoot.recursiveUnionAllOn((child) => child.parentId.equals(tIssue.id))

    // Rule: SQL Server accepts only UNION ALL between the members of a recursive CTE,
    // so recursiveUnion is not offered.
    // @ts-expect-error recursiveUnion is not available on SQL Server
    void issueTreeRoot.recursiveUnion(() => connection.selectFrom(tIssue).select({ id: tIssue.id, parentId: tIssue.parentId }))

    // Rule: SQL Server accepts only UNION ALL between the members of a recursive CTE,
    // so recursiveUnionOn is not offered.
    // @ts-expect-error recursiveUnionOn is not available on SQL Server
    void issueTreeRoot.recursiveUnionOn(() => tIssue.id.isNotNull())

    const issuesSelect = connection.selectFrom(tIssue)

    // Positive control: the same select, filtered with where.
    void issuesSelect.where(tIssue.parentId.isNull())

    // Rule: START WITH / CONNECT BY hierarchical queries are not part of SQL Server.
    // @ts-expect-error startWith is not available on SQL Server
    void issuesSelect.startWith(tIssue.parentId.isNull())

    // Rule: START WITH / CONNECT BY hierarchical queries are not part of SQL Server.
    // @ts-expect-error connectBy is not available on SQL Server
    void issuesSelect.connectBy(() => tIssue.id.isNotNull())

    // Rule: START WITH / CONNECT BY hierarchical queries are not part of SQL Server.
    // @ts-expect-error connectByNoCycle is not available on SQL Server
    void issuesSelect.connectByNoCycle(() => tIssue.id.isNotNull())

    // Positive control: an uncorrelated select used as a WITH view.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).forUseInQueryAs('issueIds')

    const issuesOfOuterProject = connection.subSelectUsing(tProject).from(tIssue).where(tIssue.projectId.equals(tProject.id)).select({ id: tIssue.id })

    // Rule: SQL Server cannot reference the outer query from inside a WITH, so a
    // correlated select is not offered as a WITH view.
    // @ts-expect-error forUseInQueryAs is not available on a correlated select on SQL Server
    void issuesOfOuterProject.forUseInQueryAs('projectIssueIds')

    // ---- Insert builder

    const insertOrg = connection.insertInto(tOrganization).values({ name: 'Acme', plan: 'free' })

    // Positive control: a single-row insert returns its generated id.
    void insertOrg.returningLastInsertedId()

    // Rule: SQL Server has no ON CONFLICT DO NOTHING / INSERT IGNORE form.
    // @ts-expect-error onConflictDoNothing is not available on SQL Server
    void insertOrg.onConflictDoNothing()

    // Rule: SQL Server has no ON CONFLICT DO UPDATE / ON DUPLICATE KEY UPDATE form.
    // @ts-expect-error onConflictDoUpdateSet is not available on SQL Server
    void insertOrg.onConflictDoUpdateSet({ plan: 'pro' })

    // Rule: SQL Server has no ON CONFLICT DO UPDATE / ON DUPLICATE KEY UPDATE form.
    // @ts-expect-error onConflictDoUpdateSetIfValue is not available on SQL Server
    void insertOrg.onConflictDoUpdateSetIfValue({ plan: 'pro' })

    // Rule: SQL Server has no ON CONFLICT DO UPDATE / ON DUPLICATE KEY UPDATE form.
    // @ts-expect-error onConflictDoUpdateDynamicSet is not available on SQL Server
    void insertOrg.onConflictDoUpdateDynamicSet()

    // Rule: SQL Server has no ON CONFLICT clause, so onConflictOn is not offered.
    // @ts-expect-error onConflictOn is not available on SQL Server
    void insertOrg.onConflictOn(tOrganization.name)

    // Rule: SQL Server has no ON CONFLICT clause, so onConflictOnConstraint is not offered.
    // @ts-expect-error onConflictOnConstraint is not available on SQL Server
    void insertOrg.onConflictOnConstraint(connection.rawFragment`organization_name_key`)

    // ---- Update builder

    // Positive control: the extra table of an UPDATE goes in from(...).
    void connection.update(tProject).from(tOrganization)

    // Rule: SqlServerConnection takes the extra tables of an UPDATE in from(...), not in
    // a join.
    // @ts-expect-error join is not available on an UPDATE on SQL Server
    void connection.update(tProject).join(tOrganization)

    // Rule: SqlServerConnection takes the extra tables of an UPDATE in from(...), not in
    // a join.
    // @ts-expect-error innerJoin is not available on an UPDATE on SQL Server
    void connection.update(tProject).innerJoin(tOrganization)

    // Rule: SqlServerConnection takes the extra tables of an UPDATE in from(...), not in
    // a join.
    // @ts-expect-error leftJoin is not available on an UPDATE on SQL Server
    void connection.update(tProject).leftJoin(tOrganization.forUseInLeftJoin())

    // Rule: SqlServerConnection takes the extra tables of an UPDATE in from(...), not in
    // a join.
    // @ts-expect-error leftOuterJoin is not available on an UPDATE on SQL Server
    void connection.update(tProject).leftOuterJoin(tOrganization.forUseInLeftJoin())

    // Positive control: the same rule on an UPDATE allowed to have no WHERE.
    void connection.updateAllowingNoWhere(tProject).from(tOrganization)

    // Rule: SqlServerConnection takes the extra tables of an UPDATE in from(...), not in
    // a join, also when the UPDATE is allowed to have no WHERE.
    // @ts-expect-error join is not available on an UPDATE on SQL Server
    void connection.updateAllowingNoWhere(tProject).join(tOrganization)

    // ---- Delete builder

    // Positive control: the extra table of a DELETE goes in using(...).
    void connection.deleteFrom(tIssue).using(tProject)

    // Rule: SqlServerConnection takes the extra tables of a DELETE in using(...), not in
    // a join.
    // @ts-expect-error join is not available on a DELETE on SQL Server
    void connection.deleteFrom(tIssue).join(tProject)

    // Rule: SqlServerConnection does not join the extra tables of a DELETE.
    // @ts-expect-error innerJoin is not available on a DELETE on SQL Server
    void connection.deleteFrom(tIssue).innerJoin(tProject)

    // Rule: SqlServerConnection does not join the extra tables of a DELETE.
    // @ts-expect-error leftJoin is not available on a DELETE on SQL Server
    void connection.deleteFrom(tIssue).leftJoin(tProject.forUseInLeftJoin())

    // Rule: SqlServerConnection does not join the extra tables of a DELETE.
    // @ts-expect-error leftOuterJoin is not available on a DELETE on SQL Server
    void connection.deleteFrom(tIssue).leftOuterJoin(tProject.forUseInLeftJoin())

    // Rule: SqlServerConnection does not join the extra tables of a DELETE, also when the
    // DELETE is allowed to have no WHERE.
    // @ts-expect-error join is not available on a DELETE on SQL Server
    void connection.deleteAllowingNoWhereFrom(tIssue).join(tProject)
}

test('dialect-surface-negative-types', () => {
    expect(typeof _typeNegatives).toBe('function')
})
