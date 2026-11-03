// Compile-time negative tests for how a SELECT is put together on the
// MySQL dialect: which clause may follow which, which tables a clause
// may reference, the arguments each clause takes, the shape of a compound
// query and the type of the rows each executor resolves to. These never
// execute any SQL — the value of the test is that `validate:tests` (tsc)
// rejects each `@ts-expect-error` line. If the library stops rejecting one
// of these, the directive becomes "unused" and the build fails with
// `TS2578` — exactly the regression signal we want.
//
// Each rule pairs the rejected line with a control that differs only in the
// thing under test and must keep compiling.
//
// Every `@ts-expect-error` MUST be accompanied by a comment naming the
// rule it enforces. DESIGN §6.

import { test, expect } from '../../../lib/testRunner.js'
import { MySqlConnection } from '../../../../src/connections/MySqlConnection.js'
import { Table } from '../../../../src/Table.js'
import type { DBConnection } from '../domain/connection.js'
import { tIssue, tOrganization, tProject } from '../domain/connection.js'

// `connection` is type-only — the function below is checked by tsc but
// never invoked at runtime.
declare const connection: DBConnection

// A second connection of the same database with its own table: its tables
// belong to another connection and cannot be mixed into a query of
// `connection`.
class OtherConnection extends MySqlConnection<'OtherConnection'> {}
const tOther = new class TOther extends Table<OtherConnection, 'TOther'> {
    id = this.column('id', 'int')
    constructor() { super('other') }
}()
declare const other: OtherConnection

// The body of `_typeNegatives` is checked by tsc but never executed at
// runtime; we keep it wrapped in an unreachable function so the throw
// paths inside ts-sql-query are not triggered by accident.
function _typeNegatives() {
    const pj = tProject.forUseInLeftJoin()

    // ---- FROM and JOIN ------------------------------------------------

    // Rule: selectFrom takes a table or view, not a table name.
    void connection.selectFrom(tIssue)
    // @ts-expect-error a string is not a table or view
    void connection.selectFrom('issue')

    // Rule: selectFrom takes a table or view, not one of its columns.
    // @ts-expect-error a column is not a table or view
    void connection.selectFrom(tIssue.id)

    // Rule: a table of another connection cannot be the FROM of a query.
    void other.selectFrom(tOther)
    // @ts-expect-error tOther belongs to another connection
    void connection.selectFrom(tOther)

    // Rule: a table of another connection cannot be joined.
    void connection.selectFrom(tIssue).join(tProject)
    // @ts-expect-error tOther belongs to another connection
    void connection.selectFrom(tIssue).join(tOther)

    // Rule: a select of another connection cannot be an arm of a compound.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).union(connection.selectFrom(tProject).select({ id: tProject.id }))
    // @ts-expect-error the union arm is a select of another connection
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).union(other.selectFrom(tOther).select({ id: tOther.id }))

    // Rule: a left join takes the `forUseInLeftJoin()` version of a table,
    // whose columns are optional; the plain table is refused.
    void connection.selectFrom(tIssue).leftJoin(pj)
    // @ts-expect-error leftJoin needs tProject.forUseInLeftJoin()
    void connection.selectFrom(tIssue).leftJoin(tProject)

    // Rule: an optional left join takes the `forUseInLeftJoin()` version of a
    // table as well.
    void connection.selectFrom(tIssue).optionalLeftJoin(pj)
    // @ts-expect-error optionalLeftJoin needs tProject.forUseInLeftJoin()
    void connection.selectFrom(tIssue).optionalLeftJoin(tProject)

    // Rule: the `forUseInLeftJoin()` version of a table is only for a left
    // join; an inner join takes the plain table.
    void connection.selectFrom(tIssue).join(tProject).on(tProject.id.equals(tIssue.projectId))
    // @ts-expect-error an inner join does not take a forUseInLeftJoin() table
    void connection.selectFrom(tIssue).join(pj).on(pj.id.equals(tIssue.projectId))

    // Rule: the `forUseInLeftJoin()` version of a table cannot be the FROM.
    // @ts-expect-error selectFrom does not take a forUseInLeftJoin() table
    void connection.selectFrom(pj)

    // Rule: once a table is left joined through `forUseInLeftJoin()`, the
    // query knows only that version; the plain table is not in the FROM.
    void connection.selectFrom(tIssue).leftJoin(pj).on(pj.id.equals(tIssue.projectId)).select({ name: pj.name })
    // @ts-expect-error tProject itself is not in the FROM, only its left-join version
    void connection.selectFrom(tIssue).leftJoin(pj).on(pj.id.equals(tIssue.projectId)).select({ name: tProject.name })

    // Rule: the ON of a left join cannot reference the plain table either.
    // @ts-expect-error tProject itself is not in the FROM, only its left-join version
    void connection.selectFrom(tIssue).leftJoin(pj).on(tIssue.projectId.equals(tProject.id))

    // Rule: the ON condition may only reference the tables joined so far.
    void connection.selectFrom(tIssue).join(tProject).on(tProject.id.equals(tIssue.projectId))
    // @ts-expect-error tOrganization is not in the FROM
    void connection.selectFrom(tIssue).join(tProject).on(tProject.organizationId.equals(tOrganization.id))

    // Rule: the ON condition must be a boolean expression.
    // @ts-expect-error a number column is not a condition
    void connection.selectFrom(tIssue).join(tProject).on(tIssue.projectId)

    // Rule: a join takes a single ON; further conditions go through and / or.
    void connection.selectFrom(tIssue).join(tProject).on(tProject.id.equals(tIssue.projectId)).and(tProject.id.equals(1))
    // @ts-expect-error a second on is not offered
    void connection.selectFrom(tIssue).join(tProject).on(tProject.id.equals(tIssue.projectId)).on(tProject.id.equals(1))

    // Rule: and / or extend a written ON; they are not offered on the join itself.
    // @ts-expect-error or needs the on first
    void connection.selectFrom(tIssue).join(tProject).or(tProject.id.equals(1))

    // Rule: joins come before the WHERE.
    void connection.selectFrom(tIssue).join(tProject).on(tProject.id.equals(tIssue.projectId)).where(tIssue.id.equals(1))
    // @ts-expect-error join is not offered after where
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1)).join(tProject).on(tProject.id.equals(tIssue.projectId))

    // Rule: joins come before the select clause.
    // @ts-expect-error join is not offered after select
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).join(tProject)

    // Rule: a query uses either a list of FROM tables or joins: after a join
    // `from` is not offered, and after `from` a join is not offered.
    void connection.selectFrom(tIssue).from(tProject).where(tProject.id.equals(tIssue.projectId))
    // @ts-expect-error from is not offered after a join
    void connection.selectFrom(tIssue).join(tProject).on(tProject.id.equals(tIssue.projectId)).from(tOrganization)
    // @ts-expect-error join is not offered after from
    void connection.selectFrom(tIssue).from(tProject).join(tOrganization)

    // Rule: a `subSelectUsing(...)` select names its own FROM before the select clause.
    void connection.subSelectUsing(tProject).from(tIssue).where(tIssue.projectId.equals(tProject.id)).select({ id: tIssue.id })
    // @ts-expect-error subSelectUsing needs from(...) before select
    void connection.subSelectUsing(tProject).select({ id: tProject.id })

    // ---- WHERE --------------------------------------------------------

    // Rule: the WHERE condition must be a boolean expression.
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1))
    // @ts-expect-error a number column is not a condition
    void connection.selectFrom(tIssue).where(tIssue.id)

    // Rule: the WHERE condition is a value source, not a plain boolean.
    // @ts-expect-error a plain boolean is not a condition
    void connection.selectFrom(tIssue).where(true)

    // Rule: the WHERE condition may only reference the tables in the FROM.
    // @ts-expect-error tProject is not in the FROM
    void connection.selectFrom(tIssue).where(tProject.id.equals(1))

    // Rule: a select distinct keeps the same FROM scope for the WHERE.
    void connection.selectDistinctFrom(tIssue).select({ id: tIssue.id }).where(tIssue.id.equals(1))
    // @ts-expect-error tProject is not in the FROM
    void connection.selectDistinctFrom(tIssue).select({ id: tIssue.id }).where(tProject.id.equals(1))

    // Rule: a query takes a single WHERE; further conditions go through and / or.
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1)).and(tIssue.id.equals(2))
    // @ts-expect-error a second where is not offered
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1)).where(tIssue.id.equals(2))

    // Rule: a dynamic WHERE is the WHERE of the query; a where cannot follow it.
    void connection.selectFrom(tIssue).dynamicWhere().and(tIssue.id.equals(1))
    // @ts-expect-error where is not offered after dynamicWhere
    void connection.selectFrom(tIssue).dynamicWhere().where(tIssue.id.equals(1))

    // Rule: and / or extend a written WHERE; they are not offered before it.
    // @ts-expect-error and needs the where first
    void connection.selectFrom(tIssue).and(tIssue.id.equals(1))

    // Rule: a WHERE written after the select clause may follow limit, but not offset.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).limit(1).where(tIssue.id.equals(2))
    // @ts-expect-error the where is already written, it is not offered again after limit
    void connection.selectFrom(tIssue).where(tIssue.id.equals(1)).select({ id: tIssue.id }).limit(1).where(tIssue.id.equals(2))

    // ---- select clause ------------------------------------------------

    // Rule: a query has a single select clause.
    void connection.selectFrom(tIssue).select({ id: tIssue.id, title: tIssue.title })
    // @ts-expect-error a second select is not offered
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).select({ title: tIssue.title })

    // Rule: a column of the select is a value source, not an array of them.
    // @ts-expect-error an array is not a column of the select
    void connection.selectFrom(tIssue).select({ ids: [tIssue.id] })

    // Rule: selectOneColumn takes one value source, not an object of columns.
    void connection.selectFrom(tIssue).selectOneColumn(tIssue.id)
    // @ts-expect-error selectOneColumn does not take an object
    void connection.selectFrom(tIssue).selectOneColumn({ id: tIssue.id })

    // Rule: selectOneColumn may only reference the tables in the FROM.
    // @ts-expect-error tProject is not in the FROM
    void connection.selectFrom(tIssue).selectOneColumn(tProject.id)

    // Rule: a select with no table may only project values that need no table.
    void connection.selectFromNoTable().select({ one: connection.const(1, 'int') })
    // @ts-expect-error tIssue is not in the FROM of a select with no table
    void connection.selectFromNoTable().select({ id: tIssue.id })

    // Rule: `projectingOptionalValuesAsNullable()` comes right after the select
    // clause, once.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).projectingOptionalValuesAsNullable().orderBy('id')
    // @ts-expect-error projectingOptionalValuesAsNullable is not offered twice
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).projectingOptionalValuesAsNullable().projectingOptionalValuesAsNullable()
    // @ts-expect-error projectingOptionalValuesAsNullable is not offered after orderBy
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).orderBy('id').projectingOptionalValuesAsNullable()

    // ---- GROUP BY and HAVING ------------------------------------------

    // Rule: GROUP BY may only reference the tables in the FROM.
    void connection.selectFrom(tIssue).groupBy(tIssue.projectId)
    // @ts-expect-error tProject is not in the FROM
    void connection.selectFrom(tIssue).groupBy(tProject.id)

    // Rule: GROUP BY by name must name a column of the select.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).groupBy('id')
    // @ts-expect-error 'unknown' is not a column of the select
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).groupBy('unknown')

    // Rule: GROUP BY by name names a column, not a nested object of the select.
    void connection.selectFrom(tProject).select({ id: tProject.id, meta: { archivedAt: tProject.archivedAt } }).groupBy('meta.archivedAt')
    // @ts-expect-error 'meta' is a nested object, not a column
    void connection.selectFrom(tProject).select({ id: tProject.id, meta: { archivedAt: tProject.archivedAt } }).groupBy('meta')

    // Rule: an aggregate cannot be grouped by; naming the aggregate column of
    // the select is the same as passing the aggregate.
    // TODO[BUG]: aggregate column named in GROUP BY — should not compile (emits `group by count(*)`)
    void connection.selectFrom(tIssue).select({ projectId: tIssue.projectId, n: connection.countAll() }).groupBy('n')

    // Rule: GROUP BY comes before ORDER BY.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).groupBy(tIssue.id).orderBy('id')
    // @ts-expect-error groupBy is not offered after orderBy
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).orderBy('id').groupBy(tIssue.id)

    // Rule: HAVING needs a GROUP BY before it.
    void connection.selectFrom(tIssue).groupBy(tIssue.projectId).having(connection.count(tIssue.id).greaterThan(1))
    // @ts-expect-error having needs groupBy first
    void connection.selectFrom(tIssue).having(connection.count(tIssue.id).greaterThan(1))
    // @ts-expect-error having needs groupBy first, also after the select clause
    void connection.selectFrom(tIssue).select({ issues: connection.countAll() }).having(connection.countAll().greaterThan(1))

    // Rule: HAVING may only reference the tables in the FROM.
    // @ts-expect-error tProject is not in the FROM
    void connection.selectFrom(tIssue).groupBy(tIssue.projectId).having(tProject.id.equals(1))

    // Rule: the HAVING condition must be a boolean expression.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).groupBy(tIssue.id).having(connection.countAll().greaterThan(1))
    // @ts-expect-error a number column is not a condition
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).groupBy(tIssue.id).having(tIssue.id)

    // Rule: `having(columns => …)` receives the columns of the select only.
    void connection.selectFrom(tIssue).select({ id: tIssue.id, n: connection.countAll() }).groupBy('id').having((columns) => columns.n.greaterThan(1))
    // @ts-expect-error 'unknown' is not a column of the select
    void connection.selectFrom(tIssue).select({ id: tIssue.id, n: connection.countAll() }).groupBy('id').having((columns) => columns.unknown.greaterThan(1))

    // Rule: a query takes a single HAVING; further conditions go through and / or.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).groupBy(tIssue.id).having(connection.countAll().greaterThan(1)).and(connection.countAll().lessThan(9))
    // @ts-expect-error a second having is not offered
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).groupBy(tIssue.id).having(connection.countAll().greaterThan(1)).having(connection.countAll().greaterThan(2))

    // Rule: GROUP BY comes before HAVING.
    // @ts-expect-error groupBy is not offered after having
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).groupBy(tIssue.id).having(connection.countAll().greaterThan(1)).groupBy(tIssue.title)

    // Rule: HAVING comes before ORDER BY.
    // @ts-expect-error having is not offered after orderBy
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).groupBy(tIssue.id).orderBy('id').having(connection.countAll().greaterThan(1))

    // Rule: an inline aggregated array of a select with an aggregate needs
    // every other column grouped.
    void connection.selectFrom(tIssue).select({ projectId: tIssue.projectId, n: connection.countAll() }).groupByNonAggregatedColumns().forUseAsInlineAggregatedArrayValue()
    // @ts-expect-error projectId is neither aggregated nor grouped
    void connection.selectFrom(tIssue).select({ projectId: tIssue.projectId, n: connection.countAll() }).forUseAsInlineAggregatedArrayValue()

    // ---- ORDER BY -----------------------------------------------------

    // Rule: the ordering mode is one of the listed modes.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).orderBy('id', 'asc nulls first')
    // @ts-expect-error 'up' is not an ordering mode
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).orderBy('id', 'up')
    // @ts-expect-error 'nulls first' needs a direction: 'asc nulls first' / 'desc nulls first'
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).orderBy('id', 'nulls first')

    // Rule: ORDER BY by name names a column, not a nested object of the select.
    void connection.selectFrom(tProject).select({ id: tProject.id, meta: { archivedAt: tProject.archivedAt } }).orderBy('meta.archivedAt')
    // @ts-expect-error 'meta' is a nested object, not a column
    void connection.selectFrom(tProject).select({ id: tProject.id, meta: { archivedAt: tProject.archivedAt } }).orderBy('meta')

    // Rule: the only column of a selectOneColumn select is named 'result'.
    void connection.selectFrom(tIssue).selectOneColumn(tIssue.id).orderBy('result')
    // @ts-expect-error the column of a selectOneColumn select is 'result', not the column name
    void connection.selectFrom(tIssue).selectOneColumn(tIssue.id).orderBy('id')

    // Rule: ORDER BY by value may only reference the tables in the FROM.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).orderBy(tIssue.title)
    // @ts-expect-error tProject is not in the FROM
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).orderBy(tProject.id)

    // Rule: orderByFromString* take strings.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).orderByFromString('id desc')
    // @ts-expect-error orderByFromString takes a string
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).orderByFromString(1)
    // @ts-expect-error orderByFromStringIfValue takes a string
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).orderByFromStringIfValue(1)
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).orderByFromStringArray(['id'])
    // @ts-expect-error orderByFromStringArray takes an array of strings
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).orderByFromStringArray('id')

    // ---- LIMIT and OFFSET ---------------------------------------------

    // Rule: limit takes a number; null is for limitIfValue.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).limitIfValue(null)
    // @ts-expect-error limit does not take null
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).limit(null)
    // @ts-expect-error limitIfValue takes a number
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).limitIfValue('a')

    // Rule: offsetIfValue takes a number.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).limit(1).offsetIfValue(null)
    // @ts-expect-error offsetIfValue takes a number
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).limit(1).offsetIfValue('x')

    // Rule: offset follows limit.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).limit(1).offset(1)
    // @ts-expect-error offset needs limit first
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).offset(1)

    // Rule: ORDER BY comes before LIMIT.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).orderBy('id').limit(1)
    // @ts-expect-error orderBy is not offered after limit
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).limit(1).orderBy('id')

    // Rule: a query has a single LIMIT and a single OFFSET.
    // @ts-expect-error a second limit is not offered
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).limit(1).limit(2)
    // @ts-expect-error a second offset is not offered
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).limit(1).offset(1).offset(2)
    // @ts-expect-error limit is not offered after offset
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).limit(1).offset(1).limit(1)

    // ---- compound queries ---------------------------------------------

    // Rule: the arms of a compound have the same column names.
    void connection.selectFrom(tIssue).select({ a: tIssue.title }).union(connection.selectFrom(tProject).select({ a: tProject.name }))
    // @ts-expect-error the arms have different column names
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).union(connection.selectFrom(tProject).select({ name: tProject.name }))

    // Rule: the arms of a compound have the same data type per column.
    // @ts-expect-error 'a' is int in one arm and string in the other
    void connection.selectFrom(tIssue).select({ a: tIssue.id }).union(connection.selectFrom(tProject).select({ a: tProject.name }))

    // Rule: the arms of a compound have the same number of columns.
    // @ts-expect-error the second arm has an extra column
    void connection.selectFrom(tIssue).select({ a: tIssue.id }).union(connection.selectFrom(tProject).select({ a: tProject.id, b: tProject.name }))
    // TODO[BUG]: an extra column in an arm over the same table — should not compile
    // (the emitted arms carry one and two columns, which the database rejects)
    void connection.selectFrom(tIssue).select({ a: tIssue.id }).union(connection.selectFrom(tIssue).select({ a: tIssue.id, b: tIssue.title }))

    // Rule: the arms of a compound have the same optionality per column.
    // @ts-expect-error 'a' is optional in one arm and required in the other
    void connection.selectFrom(tIssue).select({ a: tIssue.body }).union(connection.selectFrom(tProject).select({ a: tProject.name }))

    // Rule: a one-column select and an object select do not compound.
    // @ts-expect-error a selectOneColumn arm against an object arm
    void connection.selectFrom(tIssue).selectOneColumn(tIssue.title).union(connection.selectFrom(tProject).select({ a: tProject.name }))

    // Rule: ORDER BY by name on a compound names a column of the compound.
    void connection.selectFrom(tIssue).select({ a: tIssue.title }).union(connection.selectFrom(tProject).select({ a: tProject.name })).orderBy('a')
    // @ts-expect-error 'b' is not a column of the compound
    void connection.selectFrom(tIssue).select({ a: tIssue.title }).union(connection.selectFrom(tProject).select({ a: tProject.name })).orderBy('b')

    // Rule: a compound takes no WHERE nor GROUP BY of its own.
    // @ts-expect-error where is not offered on a compound
    void connection.selectFrom(tIssue).select({ a: tIssue.title }).union(connection.selectFrom(tProject).select({ a: tProject.name })).where(tIssue.id.equals(1))
    // @ts-expect-error groupBy is not offered on a compound
    void connection.selectFrom(tIssue).select({ a: tIssue.title }).union(connection.selectFrom(tProject).select({ a: tProject.name })).groupBy('a')

    // Rule: on a compound ORDER BY comes before LIMIT, offset follows limit,
    // and each is written once.
    void connection.selectFrom(tIssue).select({ a: tIssue.title }).union(connection.selectFrom(tProject).select({ a: tProject.name })).orderBy('a').limit(1).offset(1)
    // @ts-expect-error orderBy is not offered after limit on a compound
    void connection.selectFrom(tIssue).select({ a: tIssue.title }).union(connection.selectFrom(tProject).select({ a: tProject.name })).limit(1).orderBy('a')
    // @ts-expect-error offset needs limit first on a compound
    void connection.selectFrom(tIssue).select({ a: tIssue.title }).union(connection.selectFrom(tProject).select({ a: tProject.name })).offset(1)
    // @ts-expect-error a second offset is not offered on a compound
    void connection.selectFrom(tIssue).select({ a: tIssue.title }).union(connection.selectFrom(tProject).select({ a: tProject.name })).limit(1).offset(1).offset(1)

    // ---- customizeQuery -----------------------------------------------

    // Rule: customizeQuery takes only the listed hooks.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).customizeQuery({ afterQuery: connection.rawFragment`/* after */` })
    // @ts-expect-error 'foo' is not a customization hook
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).customizeQuery({ foo: connection.rawFragment`x` })

    // Rule: a customization fragment may only reference the tables in the FROM.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).customizeQuery({ afterQuery: connection.rawFragment`${tIssue.id}` })
    // @ts-expect-error tProject is not in the FROM
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).customizeQuery({ afterQuery: connection.rawFragment`${tProject.id}` })

    // Rule: queryExecutionName is a string.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).customizeQuery({ queryExecutionName: 'issues' })
    // @ts-expect-error queryExecutionName takes a string
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).customizeQuery({ queryExecutionName: 1 })

    // Rule: a query is customized once.
    // @ts-expect-error customizeQuery is not offered twice
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).customizeQuery({}).customizeQuery({})
    void connection.selectFrom(tIssue).select({ a: tIssue.title }).union(connection.selectFrom(tProject).select({ a: tProject.name })).customizeQuery({})
    // @ts-expect-error customizeQuery is not offered twice on a compound
    void connection.selectFrom(tIssue).select({ a: tIssue.title }).union(connection.selectFrom(tProject).select({ a: tProject.name })).customizeQuery({}).customizeQuery({})

    // ---- terminals and result types -----------------------------------

    // Rule: forUseInQueryAs builds a view from an object select; a one-column
    // select has no column names for it.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).forUseInQueryAs('ids')
    // @ts-expect-error forUseInQueryAs is never on a selectOneColumn select
    void connection.selectFrom(tIssue).selectOneColumn(tIssue.id).forUseInQueryAs('ids')

    // Rule: the alias of forUseInQueryAs is a string.
    // @ts-expect-error forUseInQueryAs takes a string alias
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).forUseInQueryAs(1)

    // Rule: the extras of executeSelectPage cannot redefine data or count with
    // another data type.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).executeSelectPage({ extra: 'x' })
    // @ts-expect-error count is a number
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).executeSelectPage({ count: 'x' })
    // @ts-expect-error data holds the rows of the select
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).executeSelectPage({ data: [1] })

    // Rule: the count of executeSelectPage is a number.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).executeSelectPage().then((page) => { const c: number = page.count; return c })
    // @ts-expect-error count is a number
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).executeSelectPage().then((page) => { const c: string = page.count; return c })

    // Rule: a row has only the columns of the select.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).executeSelectOne().then((row) => { const id: number = row.id; return id })
    // @ts-expect-error title is not a column of the select
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).executeSelectOne().then((row) => { const t: string = row.title; return t })

    // Rule: a column of the row has the data type of its value source.
    // @ts-expect-error id is a number
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).executeSelectOne().then((row) => { const id: string = row.id; return id })

    // Rule: an optional column is optional in the row.
    void connection.selectFrom(tIssue).select({ title: tIssue.title }).executeSelectOne().then((row) => { const t: string = row.title; return t })
    // @ts-expect-error body is optional
    void connection.selectFrom(tIssue).select({ body: tIssue.body }).executeSelectOne().then((row) => { const b: string = row.body; return b })

    // Rule: a required column of a left-joined table is optional in the row.
    void connection.selectFrom(tIssue).join(tProject).on(tProject.id.equals(tIssue.projectId)).select({ name: tProject.name }).executeSelectOne().then((row) => { const name: string = row.name; return name })
    // @ts-expect-error name comes from a left join, so it may be absent
    void connection.selectFrom(tIssue).leftJoin(pj).on(pj.id.equals(tIssue.projectId)).select({ name: pj.name }).executeSelectOne().then((row) => { const name: string = row.name; return name })

    // Rule: executeSelectNoneOrOne may resolve to null.
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).executeSelectNoneOrOne().then((row) => { const id: number | undefined = row?.id; return id })
    // @ts-expect-error row is possibly null
    void connection.selectFrom(tIssue).select({ id: tIssue.id }).executeSelectNoneOrOne().then((row) => { const id: number = row.id; return id })

    // Rule: a selectOneColumn select resolves to the values, not to objects.
    void connection.selectFrom(tIssue).selectOneColumn(tIssue.id).executeSelectMany().then((rows) => { const r: number[] = rows; return r })
    // @ts-expect-error the rows are numbers, not objects
    void connection.selectFrom(tIssue).selectOneColumn(tIssue.id).executeSelectMany().then((rows) => { const r: { id: number }[] = rows; return r })

    // Rule: an inline query value is optional unless the select always
    // returns a row (selectCountAll).
    void connection.selectFrom(tProject).select({ n: connection.selectFrom(tIssue).selectCountAll().forUseAsInlineQueryValue() }).executeSelectOne().then((row) => { const n: number = row.n; return n })
    // @ts-expect-error the inline value of a selectOneColumn select may be absent
    void connection.selectFrom(tProject).select({ n: connection.selectFrom(tIssue).selectOneColumn(tIssue.id).forUseAsInlineQueryValue() }).executeSelectOne().then((row) => { const n: number = row.n; return n })
}

test('mysql-negative-types-select-construction', () => {
    expect(typeof _typeNegatives).toBe('function')
})
