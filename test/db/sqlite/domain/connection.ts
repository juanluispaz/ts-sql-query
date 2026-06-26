// Shared connection definition for the sqlite dialect: used by every
// connector under test/db/sqlite/<version>/<connector>/. The only thing
// that changes between connectors is the QueryRunner injected into the
// constructor.

import { SqliteConnection } from '../../../../src/connections/SqliteConnection.js'
import type { QueryRunner } from '../../../../src/queryRunners/QueryRunner.js'
import { Table } from '../../../../src/Table.js'
import { View } from '../../../../src/View.js'
import { CustomBooleanTypeAdapter } from '../../../../src/TypeAdapter.js'

// Two separate `CustomBooleanTypeAdapter` mappings live on the shared
// schema so tests can exercise the same / different remap branches of
// `_appendCustomBooleanRemapForColumnIfRequired`:
//   - `verified` (organization, app_user) stored as 'Y' / 'N'
//   - `published` (project)               stored as 't' / 'f'
const verifiedAdapter  = new CustomBooleanTypeAdapter('Y', 'N')
const publishedAdapter = new CustomBooleanTypeAdapter('t', 'f')
// Nullable custom-boolean adapter — the optional sibling of verified/published.
const approvedAdapter  = new CustomBooleanTypeAdapter('A', 'R')

export class DBConnection extends SqliteConnection<'DBConnection'> {
    constructor(queryRunner: QueryRunner, compatibilityVersion?: number) {
        super(queryRunner)
        if (compatibilityVersion !== undefined) {
            this.compatibilityVersion = compatibilityVersion
        }
    }

    // The shared test connection pins the `'string'` uuid strategy as its
    // default. The library default for `SqliteConnection` is
    // `'uuid-extension'`, which wraps every uuid value source in
    // `uuid_str(...)` / `uuid_blob(...)` — helpers that only some sqlite
    // connectors expose (better-sqlite3, node:sqlite and sqlite-wasm-OO1
    // register them in the test harness; `sqlite3` and bun:sqlite have no
    // user-defined-function API, so they can't). Using
    // the binary strategy as the ambient default forced those connectors to
    // deactivate every uuid-touching test. The `'string'` strategy emits
    // plain TEXT (no helper functions), so the uuid columns run end-to-end
    // on every sqlite connector. The binary `'uuid-extension'` emission is
    // still pinned explicitly — and mock-only — by
    // `config.uuid-strategy.test.ts` and `select.value-source.uuid-cast.test.ts`,
    // both of which opt in via `ctx.withUuidStrategy('uuid-extension')`.
    protected override uuidStrategy: 'string' | 'uuid-extension' = 'string'

    // The `VIssueBilling` values view in `with-values.advanced.test.ts`
    // declares custom types without a per-column `TypeAdapter`: `IssueId`
    // (customInt), `Money` (customDouble) and `BillingRef` (customUuid).
    // The default adapter passes custom typeNames through unchanged; some
    // drivers hand an uncast VALUES placeholder back as a string, so a
    // `customInt` read from a VALUES tuple could surface as `"101"` rather
    // than `101`. Marshalling these typeNames through their base native
    // type on the connection keeps the round-trip typed correctly on every
    // dialect (a no-op where the driver already returns the native type).
    private static baseTypeForCustom(type: string): string {
        switch (type) {
            case 'IssueId':      return 'int'
            case 'Money':        return 'double'
            case 'BillingRef':   return 'uuid'
            // Branded custom types declared on tProjectRelease / vReleaseOverview.
            case 'Semver':       return 'string'
            case 'ReleaseChannel': return 'string'
            case 'SigningKey':   return 'uuid'
            case 'ReleaseDay':   return 'localDate'
            case 'CutoffClock':  return 'localTime'
            case 'SignOffStamp': return 'localDateTime'
            default:             return type
        }
    }
    protected override transformValueFromDB(value: unknown, type: string): unknown {
        return super.transformValueFromDB(value, DBConnection.baseTypeForCustom(type))
    }
    protected override transformValueToDB(value: unknown, type: string): unknown {
        return super.transformValueToDB(value, DBConnection.baseTypeForCustom(type))
    }
    // No `callXxx` wrappers here. SQLite has no SQL-side stored
    // procedures / functions, so the parallel `exec.procedure-function`
    // test wave keeps every case commented out — see that file.

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

    // Fragment-builder helpers. All use column-typed args so the emitted SQL
    // stays portable across every dialect (no per-dialect placeholder casts).

    // Aggregate-fragment builders (the aggregate analogue of the
    // buildFragmentWith* family above).
    aggSumColumn = this.buildAggregateFragmentWithArgs(
        this.arg('int', 'required')
    ).as((col) => this.aggregateFragmentWithType('int', 'required').sql`sum(${col})`)
    aggMaxColumnOptional = this.buildAggregateFragmentWithMaybeOptionalArgs(
        this.arg('int', 'optional')
    ).as((col) => this.aggregateFragmentWithType('int', 'optional').sql`max(${col})`)
    aggSumAboveIfValue = this.buildAggregateFragmentWithArgsIfValue(
        this.arg('int', 'required'),
        this.valueArg('int', 'optional')
    ).as((col, min) => this.aggregateFragmentWithType('boolean', 'required').sql`sum(${col}) > ${min}`)

    // buildFragmentWith* at extra arities (0-ary and 4-ary Args, 1-ary
    // MaybeOptionalArgs).
    constFortyTwo = this.buildFragmentWithArgs(
    ).as(() => this.fragmentWithType('int', 'required').sql`42`)
    sumFourColumns = this.buildFragmentWithArgs(
        this.arg('int', 'required'), this.arg('int', 'required'),
        this.arg('int', 'required'), this.arg('int', 'required')
    ).as((a, b, c, d) => this.fragmentWithType('int', 'required').sql`${a} + ${b} + ${c} + ${d}`)
    negateMaybeOptional = this.buildFragmentWithMaybeOptionalArgs(
        this.arg('int', 'optional')
    ).as((a) => this.fragmentWithType('int', 'optional').sql`-${a}`)

    // arg / valueArg over uuid and string keywords.
    coalesceUuid = this.buildFragmentWithArgs(
        this.arg('uuid', 'optional'),
        this.arg('uuid', 'optional')
    ).as((a, b) => this.fragmentWithType('uuid', 'optional').sql`coalesce(${a}, ${b})`)
    equalsStringIfValue = this.buildFragmentWithArgsIfValue(
        this.arg('string', 'required'),
        this.valueArg('string', 'optional')
    ).as((col, val) => this.fragmentWithType('boolean', 'required').sql`${col} = ${val}`)

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
    approved   = this.optionalColumn('approved', 'boolean', approvedAdapter)
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
