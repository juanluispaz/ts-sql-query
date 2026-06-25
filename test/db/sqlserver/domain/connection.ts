// Shared connection definition for the sqlserver dialect: used by every
// connector under test/db/sqlserver/<version>/<connector>/. The only thing
// that changes between connectors is the QueryRunner injected into the
// constructor and the `compatibilityVersion` the test variant targets.

import { SqlServerConnection } from '../../../../src/connections/SqlServerConnection.js'
import type { QueryRunner } from '../../../../src/queryRunners/QueryRunner.js'
import { Table } from '../../../../src/Table.js'
import { View } from '../../../../src/View.js'
import { CustomBooleanTypeAdapter } from '../../../../src/TypeAdapter.js'

const verifiedAdapter  = new CustomBooleanTypeAdapter('Y', 'N')
const publishedAdapter = new CustomBooleanTypeAdapter('t', 'f')

// Branded newtype for the customDouble executeFunction wrapper (G1).
export type Money = number & { readonly __brand: 'Money' }

// Branded newtype for the customInt sequence (G2).
export type ReleaseTag = number & { readonly __brand: 'ReleaseTag' }

export class DBConnection extends SqlServerConnection<'DBConnection'> {
    constructor(queryRunner: QueryRunner, compatibilityVersion?: number) {
        super(queryRunner)
        if (compatibilityVersion !== undefined) {
            this.compatibilityVersion = compatibilityVersion
        }
    }

    // The `VIssueBilling` values view in `with-values.advanced.test.ts`
    // declares custom types without a per-column `TypeAdapter`: `IssueId`
    // (customInt), `Money` (customDouble) and `BillingRef` (customUuid).
    // The default adapter passes custom typeNames through unchanged, and
    // SQL Server hands an uncast VALUES placeholder back as a string — so a
    // `customInt` read back from a VALUES tuple would surface as `"101"`
    // instead of `101`. Marshalling these typeNames through their base
    // native type on the connection keeps the round-trip typed correctly.
    private static baseTypeForCustom(type: string): string {
        switch (type) {
            case 'IssueId':    return 'int'
            case 'Money':      return 'double'
            case 'ReleaseTag':   return 'int'
            case 'BillingRef': return 'uuid'
            // Branded custom types declared on tProjectRelease / vReleaseOverview.
            case 'Semver':       return 'string'
            case 'ReleaseChannel': return 'string'
            case 'SigningKey':   return 'uuid'
            case 'ReleaseDay':   return 'localDate'
            case 'CutoffClock':  return 'localTime'
            case 'SignOffStamp': return 'localDateTime'
            default:           return type
        }
    }

    // SQL Server stores uuids in `uniqueidentifier` columns, which hand the
    // value back uppercased. Lowercase it on read so a uuid round-trips to
    // the exact string it was inserted with — the pattern documented in
    // docs/configuration/supported-databases/sqlserver.md.
    protected override transformValueFromDB(value: unknown, type: string): unknown {
        const base = DBConnection.baseTypeForCustom(type)
        const result = super.transformValueFromDB(value, base)
        if (result && base === 'uuid') {
            return (result as string).toLowerCase()
        }
        return result
    }
    protected override transformValueToDB(value: unknown, type: string): unknown {
        return super.transformValueToDB(value, DBConnection.baseTypeForCustom(type))
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
    // SQL Server requires a scalar UDF invoked inside a `SELECT` to be
    // referenced by at least its two-part (schema-qualified) name —
    // `dbo.count_open_issues`, not the bare `count_open_issues`, which
    // the engine would treat as a built-in and reject with "is not a
    // recognized built-in function name". (Stored procedures called via
    // `EXEC` resolve unqualified, so the procedure wrappers above stay
    // bare.) `executeFunction` passes the name straight through, so the
    // `dbo.` prefix is just part of the name string.
    callCountOpenIssues(projectId: number): Promise<number> {
        return this.executeFunction('dbo.count_open_issues', [
            this.const(projectId, 'int'),
        ], 'int', 'required')
    }
    callProjectName(id: number): Promise<string> {
        return this.executeFunction('dbo.project_name', [
            this.const(id, 'int'),
        ], 'string', 'required')
    }
    callProjectNameOrNull(id: number): Promise<string | null> {
        return this.executeFunction('dbo.project_name', [
            this.const(id, 'int'),
        ], 'string', 'optional')
    }

    // G1: executeFunction return-type fan-out beyond the existing int /
    // string arms — total_view_count returns bigint, latest_issue_at returns
    // an optional localDateTime (null when the project has no issues), and
    // estimated_total returns a branded customDouble (Money). The function
    // bodies live in this dialect's domain/schema.sql.
    callTotalViewCount(projectId: number): Promise<bigint> {
        return this.executeFunction('dbo.total_view_count', [
            this.const(projectId, 'int'),
        ], 'bigint', 'required')
    }
    callLatestIssueAt(projectId: number): Promise<Date | null> {
        return this.executeFunction('dbo.latest_issue_at', [
            this.const(projectId, 'int'),
        ], 'localDateTime', 'optional')
    }
    callEstimatedTotal(projectId: number): Promise<Money> {
        return this.executeFunction<Money>('dbo.estimated_total', [
            this.const(projectId, 'int'),
        ], 'customDouble', 'Money', 'required')
    }

    // Reusable typed SQL fragments — exercised by
    // fragments.with-args.test.ts. One field per `buildFragmentWith*`
    // factory documented in docs/queries/sql-fragments.md.
    intLeftShift = this.buildFragmentWithArgs(
        this.arg('int', 'required'),
        this.arg('int', 'required')
    ).as((a, b) => this.fragmentWithType('int', 'required').sql`${a} << ${b}`)

    intEqualsIfValue = this.buildFragmentWithArgsIfValue(
        this.arg('int', 'required'),
        this.valueArg('int', 'optional')
    ).as((a, b) => this.fragmentWithType('boolean', 'required').sql`${a} = ${b}`)

    intPlus = this.buildFragmentWithMaybeOptionalArgs(
        this.arg('int', 'optional'),
        this.arg('int', 'optional')
    ).as((a, b) => this.fragmentWithType('int', 'optional').sql`${a} + ${b}`)

    // A 1-ary `buildFragmentWithArgs` over a `bigint` arg. abs(...) is portable.
    bigintAbs = this.buildFragmentWithArgs(
        this.arg('bigint', 'required')
    ).as((a) => this.fragmentWithType('bigint', 'required').sql`abs(${a})`)

    // A 1-ary `buildFragmentWithArgsIfValue` over a `valueArg`.
    intIsPositiveIfValue = this.buildFragmentWithArgsIfValue(
        this.valueArg('int', 'optional')
    ).as((a) => this.fragmentWithType('boolean', 'required').sql`${a} > 0`)

    // A 3-ary `buildFragmentWithMaybeOptionalArgs` over `string` args.
    coalesce3 = this.buildFragmentWithMaybeOptionalArgs(
        this.arg('string', 'optional'),
        this.arg('string', 'optional'),
        this.arg('string', 'optional')
    ).as((a, b, c) => this.fragmentWithType('string', 'optional').sql`coalesce(${a}, ${b}, ${c})`)

    // Sequence references — exercised by sequence.next-current-value.test.ts.
    // Sequences are only typed on AbstractAdvancedConnection-derived
    // dialects (mariaDB ≥ 10.3, oracle, postgreSql, sqlServer); see
    // docs/api/connection.md. The matching DDL is not in the seed
    // because the tests run mock-only.
    issueIdSeq  = this.sequence('issue_id_seq', 'int')
    auditTagSeq = this.sequence('audit_tag_seq', 'bigint')

    // G2: a sequence whose value type is a branded customInt (ReleaseTag)
    // rather than the plain int / bigint of issueIdSeq / auditTagSeq — the
    // value-type fan-out of sequence(...). The release_tag_seq DDL lives in
    // this dialect's domain/schema.sql.
    releaseTagSeq = this.sequence<ReleaseTag, 'ReleaseTag'>('release_tag_seq', 'customInt', 'ReleaseTag')

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
    // New-type columns added to exercise AbstractConnection value
    // marshalling (transformValueFromDB/ToDB) for bigint / double / uuid.
    viewCount      = this.columnWithDefaultValue('view_count', 'bigint')
    estimatedHours = this.optionalColumn('estimated_hours', 'double')
    externalRef    = this.optionalColumn('external_ref', 'uuid')
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

// Enum / branded custom value types declared on the worklog + release
// fixtures below. These are the app-side TS types; the column declares
// the matching `'enum'` / `'custom'` / `'customComparable'` kind and the
// connection's `baseTypeForCustom` maps the typeName to its native base.
export type WorklogActivity = 'coding' | 'review' | 'meeting'
export type ReleaseChannel  = 'stable' | 'beta' | 'canary'

// Caller-provided primary key (no autogeneration): `code` is a
// `primaryKey('code', 'string')`, so it is required on insert and appears
// in ProvidedIdColumnKeys (not AutogeneratedIdColumnKeys).
export const tCountry = new class TCountry extends Table<DBConnection, 'TCountry'> {
    code   = this.primaryKey('code', 'string')
    name   = this.column('name', 'string')
    region = this.column('region', 'string')
    constructor() { super('country') }
}()

// Time-tracking worklog: surfaces the date-only / time-only / nullable
// bigint / nullable plain-boolean / optional-with-default / plain-enum
// column kinds the original four tables don't expose.
export const tIssueWorklog = new class TIssueWorklog extends Table<DBConnection, 'TIssueWorklog'> {
    id         = this.autogeneratedPrimaryKey('id', 'int')
    issueId    = this.column('issue_id', 'int')
    workDate   = this.column('work_date', 'localDate')
    startedAt  = this.optionalColumn('started_at', 'localTime')
    minutes    = this.optionalColumnWithDefaultValue('minutes', 'int')
    durationMs = this.optionalColumn('duration_ms', 'bigint')
    billable   = this.optionalColumn('billable', 'boolean')
    activity   = this.column<WorklogActivity, 'WorklogActivity'>('activity', 'enum', 'WorklogActivity')
    constructor() { super('issue_worklog') }
}()

// A published release of a project: branded `customComparable` version,
// `custom` (equality-only) channel, optional `customUuid` signing key,
// custom date/time columns, a DB-computed `notes` column (excluded from
// the writable shape) and a `virtualColumnFromFragment` on a writable
// table (isolates the computed/virtual exclusion against a non-empty
// writable surface).
export const tProjectRelease = new class TProjectRelease extends Table<DBConnection, 'TProjectRelease'> {
    id          = this.autogeneratedPrimaryKey('id', 'int')
    projectId   = this.column('project_id', 'int')
    version     = this.column<string, 'Semver'>('version', 'customComparable', 'Semver')
    channel     = this.column<ReleaseChannel, 'ReleaseChannel'>('channel', 'custom', 'ReleaseChannel')
    signingKey  = this.optionalColumn<string, 'SigningKey'>('signing_key', 'customUuid', 'SigningKey')
    releasedOn  = this.column<Date, 'ReleaseDay'>('released_on', 'customLocalDate', 'ReleaseDay')
    cutoffTime  = this.column<Date, 'CutoffClock'>('cutoff_time', 'customLocalTime', 'CutoffClock')
    signedOffAt = this.optionalColumn<Date, 'SignOffStamp'>('signed_off_at', 'customLocalDateTime', 'SignOffStamp')
    notes       = this.computedColumn('notes', 'string')
    versionTag  = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.channel})`)
    constructor() { super('project_release') }
}()

// View side of the release columns — surfaces the same per-type
// ValueSource dispatch (custom / custom-date-time / optional / virtual)
// on a View source instead of a Table.
export const vReleaseOverview = new class VReleaseOverview extends View<DBConnection, 'VReleaseOverview'> {
    id           = this.column('id', 'int')
    projectId    = this.column('project_id', 'int')
    version      = this.column<string, 'Semver'>('version', 'customComparable', 'Semver')
    releasedOn   = this.column<Date, 'ReleaseDay'>('released_on', 'customLocalDate', 'ReleaseDay')
    signedOffAt  = this.optionalColumn<Date, 'SignOffStamp'>('signed_off_at', 'customLocalDateTime', 'SignOffStamp')
    projectName  = this.column('project_name', 'string')
    versionUpper = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.version})`)
    constructor() { super('release_overview') }
}()

// C3: a table whose primary key is drawn from a named DB sequence via
// autogeneratedPrimaryKeyBySequence (typed only on mariaDB / oracle /
// postgreSql / sqlServer) — distinct from the autogenerated IDENTITY/SERIAL
// PK the engine fills implicitly. Reuses the existing audit_tag_seq sequence.
export const tAuditEntry = new class TAuditEntry extends Table<DBConnection, 'TAuditEntry'> {
    id     = this.autogeneratedPrimaryKeyBySequence('id', 'audit_tag_seq', 'int')
    action = this.column('action', 'string')
    constructor() { super('audit_entry') }
}()
