// Shared connection definition for the postgres dialect: used by every
// connector under test/db/postgres/<version>/<connector>/. The only thing
// that changes between connectors is the QueryRunner injected into the
// constructor and the `compatibilityVersion` the test variant targets.

import { PostgreSqlConnection } from '../../../../src/connections/PostgreSqlConnection.js'
import type { QueryRunner } from '../../../../src/queryRunners/QueryRunner.js'
import { Table } from '../../../../src/Table.js'
import { View } from '../../../../src/View.js'
import { CustomBooleanTypeAdapter } from '../../../../src/TypeAdapter.js'

const verifiedAdapter  = new CustomBooleanTypeAdapter('Y', 'N')
const publishedAdapter = new CustomBooleanTypeAdapter('t', 'f')

export class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    constructor(queryRunner: QueryRunner, compatibilityVersion?: number) {
        super(queryRunner)
        if (compatibilityVersion !== undefined) {
            this.compatibilityVersion = compatibilityVersion
        }
    }

    // Public wrappers around the `protected` `executeProcedure` /
    // `executeFunction` entry points on `AbstractConnection`. The
    // documented pattern is to expose one domain method per callable
    // procedure / function instead of letting tests reach into the
    // protected surface — the abstract method stays protected so each
    // app surfaces only what it actually calls.
    //
    // The DDL for each procedure / function lives in the dialect's
    // `domain/schema.sql` so both mock and real-DB cells exercise the
    // round-trip through `_buildCallProcedure` / `_buildCallFunction`
    // and the connector's `executeProcedure` / `executeFunction` path.
    callRefreshStats(): Promise<void> {
        return this.executeProcedure('refresh_stats', [])
    }
    callArchiveProject(id: number, reason: string): Promise<void> {
        return this.executeProcedure('archive_project', [
            this.const(id, 'int'),
            this.const(reason, 'string'),
        ])
    }
    callCountOpenIssues(projectId: number): Promise<number> {
        return this.executeFunction('count_open_issues', [
            this.const(projectId, 'int'),
        ], 'int', 'required')
    }
    callProjectName(id: number): Promise<string> {
        return this.executeFunction('project_name', [
            this.const(id, 'int'),
        ], 'string', 'required')
    }
    callProjectNameOrNull(id: number): Promise<string | null> {
        return this.executeFunction('project_name', [
            this.const(id, 'int'),
        ], 'string', 'optional')
    }

    // Reusable typed SQL fragments — exercised by
    // fragments.with-args.test.ts. One field per `buildFragmentWith*`
    // factory documented in docs/queries/sql-fragments.md.
    //
    // PostgreSQL rejects `$1 OP $2` when both operands are bare
    // placeholders (`operator is not unique: unknown OP unknown`,
    // code 42725). Each fragment below casts its operands to `int` so
    // the operator resolves against `int OP int`. The casts mirror
    // what `select const(1, 'int')` already emits at the top level.
    intLeftShift = this.buildFragmentWithArgs(
        this.arg('int', 'required'),
        this.arg('int', 'required')
    ).as((a, b) => this.fragmentWithType('int', 'required').sql`${a}::int << ${b}::int`)

    // `=` is well-overloaded in PostgreSQL, so PG resolves `$1 = $2`
    // even without casts (one operand reaches the call typed via the
    // `valueArg` declaration). No `::int` casts needed here.
    intEqualsIfValue = this.buildFragmentWithArgsIfValue(
        this.arg('int', 'required'),
        this.valueArg('int', 'optional')
    ).as((a, b) => this.fragmentWithType('boolean', 'required').sql`${a} = ${b}`)

    intPlus = this.buildFragmentWithMaybeOptionalArgs(
        this.arg('int', 'optional'),
        this.arg('int', 'optional')
    ).as((a, b) => this.fragmentWithType('int', 'optional').sql`${a}::int + ${b}::int`)

    // Sequence references — exercised by sequence.next-current-value.test.ts.
    // Sequences are only typed on AbstractAdvancedConnection-derived
    // dialects (mariaDB ≥ 10.3, oracle, postgreSql, sqlServer); see
    // docs/api/connection.md. The matching DDL is not in the seed
    // because the tests run mock-only.
    issueIdSeq  = this.sequence('issue_id_seq', 'int')
    auditTagSeq = this.sequence('audit_tag_seq', 'bigint')

    // Table/view customizations — `createTableOrViewCustomization`
    // produces a function that wraps a table reference with a
    // user-defined raw fragment in the FROM clause (docs:
    // https://ts-sql-query.readthedocs.io/en/stable/queries/sql-fragments/#table-or-view-customization).
    // Distinct API from the fragment builders above: this hooks the
    // FROM-clause rendering, not an inline expression.
    //
    // `withSqlHint` is exercised by select.table-customization.test.ts.
    // The template prepends a SQL comment so the snapshot can pin both
    // `_rawFragmentTableName` (`${table}`) and `_rawFragmentTableAlias`
    // (`${alias}`) in one place; the comment is valid SQL on every
    // dialect, so the customized table runs end-to-end against the real DB.
    withSqlHint = this.createTableOrViewCustomization(
        (table, alias) => this.rawFragment`/*+ hint */ ${table} ${alias}`,
    )
}

export const tOrganization = new class TOrganization extends Table<DBConnection, 'TOrganization'> {
    id        = this.autogeneratedPrimaryKey('id', 'int')
    name      = this.column('name', 'string')
    plan      = this.column('plan', 'string')
    verified  = this.columnWithDefaultValue('verified', 'boolean', verifiedAdapter)
    createdAt = this.columnWithDefaultValue('created_at', 'localDateTime')
    constructor() { super('organization') }
}()

export const tAppUser = new class TAppUser extends Table<DBConnection, 'TAppUser'> {
    id        = this.autogeneratedPrimaryKey('id', 'int')
    email     = this.column('email', 'string')
    fullName  = this.column('full_name', 'string')
    verified  = this.columnWithDefaultValue('verified', 'boolean', verifiedAdapter)
    createdAt = this.columnWithDefaultValue('created_at', 'localDateTime')
    constructor() { super('app_user') }
}()

export const tProject = new class TProject extends Table<DBConnection, 'TProject'> {
    id             = this.autogeneratedPrimaryKey('id', 'int')
    organizationId = this.column('organization_id', 'int')
    name           = this.column('name', 'string')
    slug           = this.column('slug', 'string')
    published      = this.columnWithDefaultValue('published', 'boolean', publishedAdapter)
    archivedAt     = this.optionalColumn('archived_at', 'localDateTime')
    createdAt      = this.columnWithDefaultValue('created_at', 'localDateTime')
    constructor() { super('project') }
}()

export const tIssue = new class TIssue extends Table<DBConnection, 'TIssue'> {
    id         = this.autogeneratedPrimaryKey('id', 'int')
    projectId  = this.column('project_id', 'int')
    number     = this.column('number', 'int')
    title      = this.column('title', 'string')
    body       = this.optionalColumn('body', 'string')
    status     = this.column('status', 'string')
    priority   = this.column('priority', 'int')
    assigneeId = this.optionalColumn('assignee_id', 'int')
    parentId   = this.optionalColumn('parent_id', 'int')
    createdAt  = this.columnWithDefaultValue('created_at', 'localDateTime')
    updatedAt  = this.columnWithDefaultValue('updated_at', 'localDateTime')
    constructor() { super('issue') }
}()

// Class-based SQL view (maps the `project_overview` DDL view defined in
// schema.sql) — exercised by view.basic.test.ts. Mixes a required
// `column`, an `optionalColumn` (`archivedAt`) and a
// `virtualColumnFromFragment` (`nameUpper`) so the View mapping surface
// is covered end to end.
export const vProjectOverview = new class VProjectOverview extends View<DBConnection, 'VProjectOverview'> {
    id               = this.column('id', 'int')
    organizationId   = this.column('organization_id', 'int')
    name             = this.column('name', 'string')
    archivedAt       = this.optionalColumn('archived_at', 'localDateTime')
    organizationName = this.column('organization_name', 'string')
    organizationPlan = this.column('organization_plan', 'string')
    nameUpper        = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.name})`)
    constructor() { super('project_overview') }
}()
