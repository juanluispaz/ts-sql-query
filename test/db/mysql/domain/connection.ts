// Shared connection definition for the mysql dialect: used by every
// connector under test/db/mysql/<version>/<connector>/. The only thing
// that changes between connectors is the QueryRunner injected into the
// constructor and the `compatibilityVersion` the test variant targets.

import { MySqlConnection } from '../../../../src/connections/MySqlConnection.js'
import type { QueryRunner } from '../../../../src/queryRunners/QueryRunner.js'
import { Table } from '../../../../src/Table.js'
import { View } from '../../../../src/View.js'
import { CustomBooleanTypeAdapter, type TypeAdapter } from '../../../../src/TypeAdapter.js'

const verifiedAdapter  = new CustomBooleanTypeAdapter('Y', 'N')
// A trailing TypeAdapter for virtualColumnFromFragment that brackets the read
// value so the adapter's effect is observable in the result.
const bracketAdapter: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'string' ? '[' + v + ']' : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(value, type)
    },
}
// Observable per-column TypeAdapter for a NON-boolean int column: the DB stores
// the score as a fixed-point value scaled ×10; the app sees the unscaled number
// (read ÷10, write ×10).
const scaledTenthAdapter: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'number' ? v / 10 : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(typeof value === 'number' ? value * 10 : value, type)
    },
}
// Numeric observable TypeAdapter: shifts a numeric value by a fixed offset so
// the adapter's effect is visible in a numeric result (read +1000, write -1000).
// Used by callEstimatedTotalOffset (executeFunction) and issueIdSeqOffset (sequence).
const plusOffsetAdapter: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'number' ? v + 1000 : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(typeof value === 'number' ? value - 1000 : value, type)
    },
}
// Bigint observable TypeAdapter: read +1000n / write -1000n (the bigint sibling
// of plusOffsetAdapter, whose number-only guard would pass a bigint through
// unchanged). Used by the bigint + adapter Table column shiftedCount.
const plusThousandBigintAdapter: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return typeof v === 'bigint' ? v + 1000n : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(typeof value === 'bigint' ? value - 1000n : value, type)
    },
}
// Temporal observable TypeAdapter: shifts a Date +1 hour on read / -1 hour on
// write, so the adapter's effect is visible in a temporal result. Used by the
// customLocalDateTime + adapter Table column shiftedStamp.
const shiftHourAdapter: TypeAdapter = {
    transformValueFromDB(value, type, next) {
        const v = next.transformValueFromDB(value, type)
        return v instanceof Date ? new Date(v.getTime() + 3600000) : v
    },
    transformValueToDB(value, type, next) {
        return next.transformValueToDB(value instanceof Date ? new Date(value.getTime() - 3600000) : value, type)
    },
}
const publishedAdapter = new CustomBooleanTypeAdapter('t', 'f')
// Nullable custom-boolean adapter — the optional sibling of verified/published.
const approvedAdapter  = new CustomBooleanTypeAdapter('A', 'R')
// Numeric-overload CustomBooleanTypeAdapter (true -> int 1, false -> int 0)
// for the `invoiced` flag — the integer counterpart of the string adapters.
const invoicedAdapter  = new CustomBooleanTypeAdapter(1, 0)

// Branded newtype for the customDouble executeFunction wrapper (G1).
export type Money = number & { readonly __brand: 'Money' }

// Branded newtype for the customInt View column carrying a trailing adapter (VALVIEW).
export type ReleaseTag = number & { readonly __brand: 'ReleaseTag' }

export class DBConnection extends MySqlConnection<'DBConnection'> {
    constructor(queryRunner: QueryRunner, compatibilityVersion?: number) {
        super(queryRunner)
        if (compatibilityVersion !== undefined) {
            this.compatibilityVersion = compatibilityVersion
        }
    }

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
            case 'IssueId':    return 'int'
            case 'ReleaseTag': return 'int'
            case 'Cents':      return 'int'
            case 'Money':      return 'double'
            case 'BillingRef': return 'uuid'
            // Branded custom types declared on tProjectRelease / vReleaseOverview.
            case 'Semver':       return 'string'
            case 'ReleaseChannel': return 'string'
            case 'SigningKey':   return 'uuid'
            case 'ReleaseDay':   return 'localDate'
            case 'CutoffClock':  return 'localTime'
            case 'SignOffStamp': return 'localDateTime'
            case 'PublishStamp': return 'localDateTime'
            default:           return type
        }
    }
    protected override transformValueFromDB(value: unknown, type: string): unknown {
        return super.transformValueFromDB(value, DBConnection.baseTypeForCustom(type))
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

    // A wrapper that passes a TypeAdapter OBJECT as the trailing executeFunction
    // arg (the plain-type overload's optional `adapter`). bracketAdapter wraps
    // the returned string in [...], so the adapter's effect is observable in the
    // value.
    callProjectNameBracketed(id: number): Promise<string> {
        return this.executeFunction('project_name', [
            this.const(id, 'int'),
        ], 'string', 'required', bracketAdapter)
    }

    // executeFunction return-type fan-out beyond the existing int /
    // string arms — total_view_count returns bigint, latest_issue_at returns
    // an optional localDateTime (null when the project has no issues), and
    // estimated_total returns a branded customDouble (Money). The function
    // bodies live in this dialect's domain/schema.sql.
    callTotalViewCount(projectId: number): Promise<bigint> {
        return this.executeFunction('total_view_count', [
            this.const(projectId, 'int'),
        ], 'bigint', 'required')
    }
    callLatestIssueAt(projectId: number): Promise<Date | null> {
        return this.executeFunction('latest_issue_at', [
            this.const(projectId, 'int'),
        ], 'localDateTime', 'optional')
    }
    callEstimatedTotal(projectId: number): Promise<Money> {
        return this.executeFunction<Money>('estimated_total', [
            this.const(projectId, 'int'),
        ], 'customDouble', 'Money', 'required')
    }
    // A customDouble executeFunction wrapper with a trailing TypeAdapter:
    // plusOffsetAdapter shifts the numeric result so the adapter's effect is
    // observable. Reuses estimated_total.
    callEstimatedTotalOffset(projectId: number): Promise<Money> {
        return this.executeFunction<Money>('estimated_total', [
            this.const(projectId, 'int'),
        ], 'customDouble', 'Money', 'required', plusOffsetAdapter)
    }

    // The req/opt counterparts of the return-type functions above — reuse the
    // SAME DB functions with the opposite optionality flag.
    callCountOpenIssuesOptional(projectId: number): Promise<number | null> {
        return this.executeFunction('count_open_issues', [
            this.const(projectId, 'int'),
        ], 'int', 'optional')
    }
    callTotalViewCountOptional(projectId: number): Promise<bigint | null> {
        return this.executeFunction('total_view_count', [
            this.const(projectId, 'int'),
        ], 'bigint', 'optional')
    }
    callLatestIssueAtRequired(projectId: number): Promise<Date> {
        return this.executeFunction('latest_issue_at', [
            this.const(projectId, 'int'),
        ], 'localDateTime', 'required')
    }
    callEstimatedTotalOptional(projectId: number): Promise<Money | null> {
        return this.executeFunction<Money>('estimated_total', [
            this.const(projectId, 'int'),
        ], 'customDouble', 'Money', 'optional')
    }

    // executeFunction return-kind fan-out: one required + one optional wrapper
    // per remaining return kind, each routing that kind's transformValueFromDB
    // marshaller and the required/optional null-gate. Plain kinds reuse the
    // constant functions (ret_flag / ret_uuid / ret_day / ret_clock /
    // ret_activity / ret_channel / ret_semver); double / customInt /
    // customLocalDateTime reuse estimated_total / count_open_issues /
    // latest_issue_at. The custom kinds thread the typeName generic.
    callRetBoolean(id: number): Promise<boolean> {
        return this.executeFunction('ret_flag', [this.const(id, 'int')], 'boolean', 'required')
    }
    callRetBooleanOptional(id: number): Promise<boolean | null> {
        return this.executeFunction('ret_flag', [this.const(id, 'int')], 'boolean', 'optional')
    }
    callRetDouble(id: number): Promise<number> {
        return this.executeFunction('estimated_total', [this.const(id, 'int')], 'double', 'required')
    }
    callRetDoubleOptional(id: number): Promise<number | null> {
        return this.executeFunction('estimated_total', [this.const(id, 'int')], 'double', 'optional')
    }
    callRetUuid(id: number): Promise<string> {
        return this.executeFunction('ret_uuid', [this.const(id, 'int')], 'uuid', 'required')
    }
    callRetUuidOptional(id: number): Promise<string | null> {
        return this.executeFunction('ret_uuid', [this.const(id, 'int')], 'uuid', 'optional')
    }
    callRetLocalDate(id: number): Promise<Date> {
        return this.executeFunction('ret_day', [this.const(id, 'int')], 'localDate', 'required')
    }
    callRetLocalDateOptional(id: number): Promise<Date | null> {
        return this.executeFunction('ret_day', [this.const(id, 'int')], 'localDate', 'optional')
    }
    callRetLocalTime(id: number): Promise<Date> {
        return this.executeFunction('ret_clock', [this.const(id, 'int')], 'localTime', 'required')
    }
    callRetLocalTimeOptional(id: number): Promise<Date | null> {
        return this.executeFunction('ret_clock', [this.const(id, 'int')], 'localTime', 'optional')
    }
    callRetEnum(id: number): Promise<WorklogActivity> {
        return this.executeFunction<WorklogActivity>('ret_activity', [this.const(id, 'int')], 'enum', 'WorklogActivity', 'required')
    }
    callRetEnumOptional(id: number): Promise<WorklogActivity | null> {
        return this.executeFunction<WorklogActivity>('ret_activity', [this.const(id, 'int')], 'enum', 'WorklogActivity', 'optional')
    }
    callRetCustom(id: number): Promise<ReleaseChannel> {
        return this.executeFunction<ReleaseChannel>('ret_channel', [this.const(id, 'int')], 'custom', 'ReleaseChannel', 'required')
    }
    callRetCustomOptional(id: number): Promise<ReleaseChannel | null> {
        return this.executeFunction<ReleaseChannel>('ret_channel', [this.const(id, 'int')], 'custom', 'ReleaseChannel', 'optional')
    }
    callRetCustomComparable(id: number): Promise<string> {
        return this.executeFunction<string>('ret_semver', [this.const(id, 'int')], 'customComparable', 'Semver', 'required')
    }
    callRetCustomComparableOptional(id: number): Promise<string | null> {
        return this.executeFunction<string>('ret_semver', [this.const(id, 'int')], 'customComparable', 'Semver', 'optional')
    }
    callRetCustomInt(id: number): Promise<number> {
        return this.executeFunction<number>('count_open_issues', [this.const(id, 'int')], 'customInt', 'Cents', 'required')
    }
    callRetCustomIntOptional(id: number): Promise<number | null> {
        return this.executeFunction<number>('count_open_issues', [this.const(id, 'int')], 'customInt', 'Cents', 'optional')
    }
    callRetCustomUuid(id: number): Promise<string> {
        return this.executeFunction<string>('ret_uuid', [this.const(id, 'int')], 'customUuid', 'SigningKey', 'required')
    }
    callRetCustomUuidOptional(id: number): Promise<string | null> {
        return this.executeFunction<string>('ret_uuid', [this.const(id, 'int')], 'customUuid', 'SigningKey', 'optional')
    }
    callRetCustomLocalDate(id: number): Promise<Date> {
        return this.executeFunction<Date>('ret_day', [this.const(id, 'int')], 'customLocalDate', 'ReleaseDay', 'required')
    }
    callRetCustomLocalDateOptional(id: number): Promise<Date | null> {
        return this.executeFunction<Date>('ret_day', [this.const(id, 'int')], 'customLocalDate', 'ReleaseDay', 'optional')
    }
    callRetCustomLocalTime(id: number): Promise<Date> {
        return this.executeFunction<Date>('ret_clock', [this.const(id, 'int')], 'customLocalTime', 'CutoffClock', 'required')
    }
    callRetCustomLocalTimeOptional(id: number): Promise<Date | null> {
        return this.executeFunction<Date>('ret_clock', [this.const(id, 'int')], 'customLocalTime', 'CutoffClock', 'optional')
    }
    callRetCustomLocalDateTime(id: number): Promise<Date> {
        return this.executeFunction<Date>('latest_issue_at', [this.const(id, 'int')], 'customLocalDateTime', 'SignOffStamp', 'required')
    }
    callRetCustomLocalDateTimeOptional(id: number): Promise<Date | null> {
        return this.executeFunction<Date>('latest_issue_at', [this.const(id, 'int')], 'customLocalDateTime', 'SignOffStamp', 'optional')
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

    // A 3-ary `buildFragmentWithMaybeOptionalArgs` over `int` args — the
    // null-propagating sibling of intPlus. Used by fragments.with-args.test.ts
    // to realise the merged-optional result's `undefined` inhabitant for the
    // `[value-source-required, plain, value-source-optional]` shape at runtime
    // (3 + 4 + NULL = NULL).
    sum3MaybeOptional = this.buildFragmentWithMaybeOptionalArgs(
        this.arg('int', 'optional'),
        this.arg('int', 'optional'),
        this.arg('int', 'optional')
    ).as((a, b, c) => this.fragmentWithType('int', 'optional').sql`${a} + ${b} + ${c}`)

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

    // Fragment builders at extra arities and over extra arg/valueArg types.
    // All bodies are portable (no per-dialect casts): aggregates run over
    // columns, non-aggregates use coalesce/string `=`, so the same field works
    // on every dialect and only the placeholder syntax differs per cell.

    // buildFragmentWithArgs at arities 3 and 5.
    frag3Args = this.buildFragmentWithArgs(
        this.arg('string', 'required'), this.arg('string', 'required'), this.arg('string', 'required')
    ).as((a, b, c) => this.fragmentWithType('string', 'required').sql`coalesce(${a}, ${b}, ${c})`)
    frag5Args = this.buildFragmentWithArgs(
        this.arg('string', 'required'), this.arg('string', 'required'), this.arg('string', 'required'),
        this.arg('string', 'required'), this.arg('string', 'required')
    ).as((a, b, c, d, e) => this.fragmentWithType('string', 'required').sql`coalesce(${a}, ${b}, ${c}, ${d}, ${e})`)

    // buildFragmentWithArgsIfValue at arities 0, 3, 4, 5.
    frag0IfValue = this.buildFragmentWithArgsIfValue(
    ).as(() => this.fragmentWithType('boolean', 'required').sql`1 = 1`)
    frag3IfValue = this.buildFragmentWithArgsIfValue(
        this.arg('string', 'required'), this.arg('string', 'required'), this.valueArg('string', 'optional')
    ).as((a, b, v) => this.fragmentWithType('boolean', 'required').sql`coalesce(${a}, ${b}) = ${v}`)
    frag4IfValue = this.buildFragmentWithArgsIfValue(
        this.arg('string', 'required'), this.arg('string', 'required'), this.arg('string', 'required'), this.valueArg('string', 'optional')
    ).as((a, b, c, v) => this.fragmentWithType('boolean', 'required').sql`coalesce(${a}, ${b}, ${c}) = ${v}`)
    frag5IfValue = this.buildFragmentWithArgsIfValue(
        this.arg('string', 'required'), this.arg('string', 'required'), this.arg('string', 'required'), this.arg('string', 'required'), this.valueArg('string', 'optional')
    ).as((a, b, c, d, v) => this.fragmentWithType('boolean', 'required').sql`coalesce(${a}, ${b}, ${c}, ${d}) = ${v}`)

    // buildFragmentWithMaybeOptionalArgs at arities 0, 4, 5.
    frag0MaybeOptional = this.buildFragmentWithMaybeOptionalArgs(
    ).as(() => this.fragmentWithType('int', 'required').sql`42`)
    frag4MaybeOptional = this.buildFragmentWithMaybeOptionalArgs(
        this.arg('string', 'optional'), this.arg('string', 'optional'), this.arg('string', 'optional'), this.arg('string', 'optional')
    ).as((a, b, c, d) => this.fragmentWithType('string', 'optional').sql`coalesce(${a}, ${b}, ${c}, ${d})`)
    frag5MaybeOptional = this.buildFragmentWithMaybeOptionalArgs(
        this.arg('string', 'optional'), this.arg('string', 'optional'), this.arg('string', 'optional'), this.arg('string', 'optional'), this.arg('string', 'optional')
    ).as((a, b, c, d, e) => this.fragmentWithType('string', 'optional').sql`coalesce(${a}, ${b}, ${c}, ${d}, ${e})`)

    // buildAggregateFragmentWithArgs at arities 0, 2, 3, 4, 5.
    agg0Count = this.buildAggregateFragmentWithArgs(
    ).as(() => this.aggregateFragmentWithType('int', 'required').sql`count(*)`)
    agg2Sum = this.buildAggregateFragmentWithArgs(
        this.arg('int', 'required'), this.arg('int', 'required')
    ).as((a, b) => this.aggregateFragmentWithType('int', 'required').sql`sum(${a} + ${b})`)
    agg3Sum = this.buildAggregateFragmentWithArgs(
        this.arg('int', 'required'), this.arg('int', 'required'), this.arg('int', 'required')
    ).as((a, b, c) => this.aggregateFragmentWithType('int', 'required').sql`sum(${a} + ${b} + ${c})`)
    agg4Sum = this.buildAggregateFragmentWithArgs(
        this.arg('int', 'required'), this.arg('int', 'required'), this.arg('int', 'required'), this.arg('int', 'required')
    ).as((a, b, c, d) => this.aggregateFragmentWithType('int', 'required').sql`sum(${a} + ${b} + ${c} + ${d})`)
    agg5Sum = this.buildAggregateFragmentWithArgs(
        this.arg('int', 'required'), this.arg('int', 'required'), this.arg('int', 'required'), this.arg('int', 'required'), this.arg('int', 'required')
    ).as((a, b, c, d, e) => this.aggregateFragmentWithType('int', 'required').sql`sum(${a} + ${b} + ${c} + ${d} + ${e})`)

    // buildAggregateFragmentWithMaybeOptionalArgs at arities 0, 2, 3, 4, 5.
    aggMO0Count = this.buildAggregateFragmentWithMaybeOptionalArgs(
    ).as(() => this.aggregateFragmentWithType('int', 'required').sql`count(*)`)
    aggMO2Max = this.buildAggregateFragmentWithMaybeOptionalArgs(
        this.arg('int', 'optional'), this.arg('int', 'optional')
    ).as((a, b) => this.aggregateFragmentWithType('int', 'optional').sql`max(${a} + ${b})`)
    aggMO3Max = this.buildAggregateFragmentWithMaybeOptionalArgs(
        this.arg('int', 'optional'), this.arg('int', 'optional'), this.arg('int', 'optional')
    ).as((a, b, c) => this.aggregateFragmentWithType('int', 'optional').sql`max(${a} + ${b} + ${c})`)
    aggMO4Max = this.buildAggregateFragmentWithMaybeOptionalArgs(
        this.arg('int', 'optional'), this.arg('int', 'optional'), this.arg('int', 'optional'), this.arg('int', 'optional')
    ).as((a, b, c, d) => this.aggregateFragmentWithType('int', 'optional').sql`max(${a} + ${b} + ${c} + ${d})`)
    aggMO5Max = this.buildAggregateFragmentWithMaybeOptionalArgs(
        this.arg('int', 'optional'), this.arg('int', 'optional'), this.arg('int', 'optional'), this.arg('int', 'optional'), this.arg('int', 'optional')
    ).as((a, b, c, d, e) => this.aggregateFragmentWithType('int', 'optional').sql`max(${a} + ${b} + ${c} + ${d} + ${e})`)

    // buildAggregateFragmentWithArgsIfValue at arities 0, 1, 3, 4, 5.
    aggIV0Predicate = this.buildAggregateFragmentWithArgsIfValue(
    ).as(() => this.aggregateFragmentWithType('boolean', 'required').sql`count(*) > 0`)
    aggIV1Count = this.buildAggregateFragmentWithArgsIfValue(
        this.valueArg('int', 'optional')
    ).as((v) => this.aggregateFragmentWithType('boolean', 'required').sql`count(*) > ${v}`)
    aggIV3Sum = this.buildAggregateFragmentWithArgsIfValue(
        this.arg('int', 'required'), this.arg('int', 'required'), this.valueArg('int', 'optional')
    ).as((a, b, v) => this.aggregateFragmentWithType('boolean', 'required').sql`sum(${a} + ${b}) > ${v}`)
    aggIV4Sum = this.buildAggregateFragmentWithArgsIfValue(
        this.arg('int', 'required'), this.arg('int', 'required'), this.arg('int', 'required'), this.valueArg('int', 'optional')
    ).as((a, b, c, v) => this.aggregateFragmentWithType('boolean', 'required').sql`sum(${a} + ${b} + ${c}) > ${v}`)
    aggIV5Sum = this.buildAggregateFragmentWithArgsIfValue(
        this.arg('int', 'required'), this.arg('int', 'required'), this.arg('int', 'required'), this.arg('int', 'required'), this.valueArg('int', 'optional')
    ).as((a, b, c, d, v) => this.aggregateFragmentWithType('boolean', 'required').sql`sum(${a} + ${b} + ${c} + ${d}) > ${v}`)

    // arg / valueArg keyword arms — one `${col} = ${value}` fragment per
    // still-uncovered argument type (column context keeps the SQL portable).
    // arg/valueArg int + string are covered by intEqualsIfValue / equalsStringIfValue.
    doubleEq = this.buildFragmentWithArgsIfValue(
        this.arg('double', 'optional'), this.valueArg('double', 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    customComparableEq = this.buildFragmentWithArgsIfValue(
        this.arg<string, 'Semver'>('customComparable', 'Semver', 'optional'), this.valueArg<string, 'Semver'>('customComparable', 'Semver', 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    customEq = this.buildFragmentWithArgsIfValue(
        this.arg<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', 'optional'), this.valueArg<ReleaseChannel, 'ReleaseChannel'>('custom', 'ReleaseChannel', 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    enumEq = this.buildFragmentWithArgsIfValue(
        this.arg<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', 'optional'), this.valueArg<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    customUuidEq = this.buildFragmentWithArgsIfValue(
        this.arg<string, 'SigningKey'>('customUuid', 'SigningKey', 'optional'), this.valueArg<string, 'SigningKey'>('customUuid', 'SigningKey', 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    // boolean arm — combined in a LOGICAL (condition) context with `or` so the
    // library's boolean emulation renders each operand as a predicate
    // (`(billable = 1) or ...` on engines without a native boolean). A raw `=`
    // between two boolean operands would instead compare two predicates
    // (`(x = 1) = (y = 1)`), which SQL Server rejects.
    booleanOrFragment = this.buildFragmentWithArgsIfValue(
        this.arg('boolean', 'optional'), this.valueArg('boolean', 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} or ${v}`)

    // arg / valueArg over the temporal and custom-fractional keywords. Each is
    // `${col} = ${value}` in a column context (the arg binds to a typed column at
    // the call site), so the SQL stays portable and the valueArg marshals a
    // distinct bound value per kind (e.g. a Date through valueArg('localTime')
    // binds 'HH:MM:SS').
    localDateEq = this.buildFragmentWithArgsIfValue(
        this.arg('localDate', 'optional'), this.valueArg('localDate', 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    localTimeEq = this.buildFragmentWithArgsIfValue(
        this.arg('localTime', 'optional'), this.valueArg('localTime', 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    localDateTimeEq = this.buildFragmentWithArgsIfValue(
        this.arg('localDateTime', 'optional'), this.valueArg('localDateTime', 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    customDoubleEq = this.buildFragmentWithArgsIfValue(
        this.arg<number, 'Money'>('customDouble', 'Money', 'optional'), this.valueArg<number, 'Money'>('customDouble', 'Money', 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    // bigint / uuid arg + valueArg arms — `${col} = ${value}` in a column
    // context (the arg binds a typed column at the call site, so the SQL stays
    // portable and only the placeholder syntax differs per cell). The valueArg
    // marshals a distinct bound value per kind: a bigint through
    // valueArg('bigint'), a uuid string through valueArg('uuid').
    bigintValueEq = this.buildFragmentWithArgsIfValue(
        this.arg('bigint', 'optional'), this.valueArg('bigint', 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    uuidValueEq = this.buildFragmentWithArgsIfValue(
        this.arg('uuid', 'optional'), this.valueArg('uuid', 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)

    // A fragment whose `valueArg` carries a value-scaling TypeAdapter
    // (scaledTenthAdapter, x10 on the write path), so the bound placeholder
    // shows the scaled value.
    scaledThresholdFragment = this.buildFragmentWithArgsIfValue(
        this.arg('int', 'required'),
        this.valueArg('int', 'optional', scaledTenthAdapter)
    ).as((col, v) => this.fragmentWithType('boolean', 'required').sql`${col} > ${v}`)

    // A fragment whose `arg` carries a TRAILING TypeAdapter
    // (scaledTenthAdapter), exercising the combined-mode (`adapter2`) branch of
    // `arg` — every other `this.arg(...)` omits the adapter. The arg routes a
    // bound literal through the adapter's WRITE path (x10), so passing the
    // threshold 1 binds the SCALED placeholder 10 (the mirror of
    // scaledThresholdFragment's valueArg adapter, but on `arg` instead).
    scaledArgThresholdFragment = this.buildFragmentWithArgs(
        this.arg('int', 'required', scaledTenthAdapter)
    ).as((v) => this.fragmentWithType('int', 'required').sql`${v}`)

    // CUSTOM-kind arg / valueArg carrying a trailing TypeAdapter
    // (scaledTenthAdapter, x10 on the write path) — the combined-mode (`adapter2`)
    // slot on the CUSTOM-kind arm of arg / valueArg. Each routes a bound customInt
    // ('Cents', marshalled to int) literal
    // through the adapter's write path (x10), so passing 1 binds the scaled 10.
    scaledCustomArgFragment = this.buildFragmentWithArgs(
        this.arg<number, 'Cents'>('customInt', 'Cents', 'required', scaledTenthAdapter)
    ).as((v) => this.fragmentWithType('int', 'required').sql`${v}`)
    scaledCustomThresholdFragment = this.buildFragmentWithArgsIfValue(
        this.arg('int', 'required'),
        this.valueArg<number, 'Cents'>('customInt', 'Cents', 'optional', scaledTenthAdapter)
    ).as((col, v) => this.fragmentWithType('boolean', 'required').sql`${col} > ${v}`)

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

    // A PARAMETERIZED table/view customization — the
    // `(table, alias, ...params) => rawFragment` overload threads a runtime
    // `minId` param into the raw fragment (distinct from `withSqlHint` above,
    // whose factory takes no extra params). The param rides as a real bound
    // placeholder in a derived-table predicate — wrapping the table as
    // `(select * from <table> where <minId> >= 0) <alias>`, a constant-true
    // filter that keeps every row. A derived table needs an alias, so the
    // customization is used WITH `.as(...)`; the SQL is portable and runs
    // end-to-end (the bound param is outside any comment, so comment-stripping
    // drivers still bind it correctly).
    withMinIdFilter = this.createTableOrViewCustomization<number>((table, alias, minId) => {
        const min = this.const(minId, 'int')
        return this.rawFragment`(select * from ${table} where ${min} >= 0) ${alias}`
    })

    // Higher-arity siblings of withMinIdFilter — the P2/P3/P4/P5 overloads of
    // createTableOrViewCustomization (withSqlHint is P0, withMinIdFilter is P1).
    // Each threads N runtime int params into the derived-table predicate as real
    // bound placeholders (`<pN> >= 0`, all constant-true so every row is kept),
    // so the extra params ride ahead of any outer WHERE param.
    withTwoParams = this.createTableOrViewCustomization<number, number>((table, alias, a, b) => {
        return this.rawFragment`(select * from ${table} where ${this.const(a, 'int')} >= 0 and ${this.const(b, 'int')} >= 0) ${alias}`
    })
    withThreeParams = this.createTableOrViewCustomization<number, number, number>((table, alias, a, b, c) => {
        return this.rawFragment`(select * from ${table} where ${this.const(a, 'int')} >= 0 and ${this.const(b, 'int')} >= 0 and ${this.const(c, 'int')} >= 0) ${alias}`
    })
    withFourParams = this.createTableOrViewCustomization<number, number, number, number>((table, alias, a, b, c, d) => {
        return this.rawFragment`(select * from ${table} where ${this.const(a, 'int')} >= 0 and ${this.const(b, 'int')} >= 0 and ${this.const(c, 'int')} >= 0 and ${this.const(d, 'int')} >= 0) ${alias}`
    })
    withFiveParams = this.createTableOrViewCustomization<number, number, number, number, number>((table, alias, a, b, c, d, e) => {
        return this.rawFragment`(select * from ${table} where ${this.const(a, 'int')} >= 0 and ${this.const(b, 'int')} >= 0 and ${this.const(c, 'int')} >= 0 and ${this.const(d, 'int')} >= 0 and ${this.const(e, 'int')} >= 0) ${alias}`
    })
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
    // The amount billed for the worklog — a branded customDouble ('Money',
    // marshalled to double). invoiced is a boolean stored as int 1/0 via the
    // NUMERIC CustomBooleanTypeAdapter overload.
    billedAmount = this.columnWithDefaultValue<number, 'Money'>('billed_amount', 'customDouble', 'Money')
    invoiced     = this.columnWithDefaultValue('invoiced', 'boolean', invoicedAdapter)
    // The internal cost of the worklog in integer cents — a branded
    // customInt ('Cents', marshalled to int).
    costCents    = this.columnWithDefaultValue<number, 'Cents'>('cost_cents', 'customInt', 'Cents')
    activity   = this.column<WorklogActivity, 'WorklogActivity'>('activity', 'enum', 'WorklogActivity')
    // optionalVirtualColumnFromFragment on a Table (the optional
    // sibling of the required virtual column; no DB column — computed inline).
    activityUpper  = this.optionalVirtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.activity})`)
    // virtualColumnFromFragment with an explicit trailing TypeAdapter.
    activityTagged = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.activity})`, bracketAdapter)
    // Custom-kind virtualColumnFromFragment columns (the `(type, typeName, fn,
    // adapter?)` form that produces a branded value source). Computed inline (no DB
    // column). `centsFromId` is a REQUIRED branded customInt ('Cents', marshalled to
    // int): worklog id * 100. `centsFromIdOptional` is its optional sibling.
    // `activityCustomKind` is a string-backed custom kind (enum 'WorklogActivity').
    // `centsFromIdTagged` carries a trailing TypeAdapter (plusOffsetAdapter, read +1000).
    centsFromId         = this.virtualColumnFromFragment<number, 'Cents'>('customInt', 'Cents', (fragment) => fragment.sql`${this.id} * 100`)
    centsFromIdOptional = this.optionalVirtualColumnFromFragment<number, 'Cents'>('customInt', 'Cents', (fragment) => fragment.sql`${this.id} * 100`)
    activityCustomKind  = this.virtualColumnFromFragment<WorklogActivity, 'WorklogActivity'>('enum', 'WorklogActivity', (fragment) => fragment.sql`lower(${this.activity})`)
    centsFromIdTagged   = this.virtualColumnFromFragment<number, 'Cents'>('customInt', 'Cents', (fragment) => fragment.sql`${this.id} * 100`, plusOffsetAdapter)
    // optionalComputedColumn — a NULLABLE DB-computed column,
    // excluded from the writable shape (the required sibling is
    // project_release.notes). The DB computes it from minutes + activity.
    activityLabel  = this.optionalComputedColumn('activity_label', 'string')
    // Computed columns carrying a trailing TypeAdapter — the
    // `computedColumn` / `optionalComputedColumn` adapter arm, otherwise
    // unexercised (every other computed column omits the adapter). Both are
    // DB-computed (GENERATED) and read through bracketAdapter (wraps in [...]);
    // `tagLabel` from UPPER(activity) (always present), `tagLabelOptional` from
    // the same nullable expression as activity_label.
    tagLabel         = this.computedColumn('tag_label', 'string', bracketAdapter)
    tagLabelOptional = this.optionalComputedColumn('tag_label_optional', 'string', bracketAdapter)
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
    // A REQUIRED-on-read customLocalDateTime column (branded
    // 'PublishStamp'). signedOffAt above is the OPTIONAL customLocalDateTime;
    // this is its required-on-read twin, so the required-custom-localDateTime
    // read getter is observed directly (it projects `Date`, not `Date |
    // undefined`). Declared columnWithDefaultValue (DB DEFAULT CURRENT_TIMESTAMP)
    // so it stays optional on INSERT — existing tProjectRelease INSERT tests that
    // don't enumerate it keep working. Added last to keep existing snapshots stable.
    publishedAt = this.columnWithDefaultValue<Date, 'PublishStamp'>('published_at', 'customLocalDateTime', 'PublishStamp')
    constructor() { super('project_release') }
}()

// Project review fixture (see project_review in schema.sql): a NON-boolean
// per-column TypeAdapter on `score` (int, fixed-point ×10 via scaledTenthAdapter)
// and `reviewerCode` (string, bracketed via bracketAdapter), an OPTIONAL plain
// `localDate` (reviewDate) and a REQUIRED plain `localTime` (reviewTime).
export const tProjectReview = new class TProjectReview extends Table<DBConnection, 'TProjectReview'> {
    id           = this.autogeneratedPrimaryKey('id', 'int')
    projectId    = this.column('project_id', 'int')
    reviewerCode = this.column('reviewer_code', 'string', bracketAdapter)
    score        = this.column('score', 'int', scaledTenthAdapter)
    reviewDate   = this.optionalColumn('review_date', 'localDate')
    reviewTime   = this.column('review_time', 'localTime')
    constructor() { super('project_review') }
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
    // An adapter-bearing VIEW column — `versionBracketed` carries the
    // trailing TypeAdapter `bracketAdapter` (read wraps the value in [...]). No
    // other View column in any dialect carries an adapter, so the bare
    // DBColumnImpl's adapter read path is otherwise never observed on a View.
    versionBracketed = this.column('version_bracketed', 'string', bracketAdapter)
    // A customLocalTime VIEW column — the View side of the
    // customLocalTime kind (Table side is tProjectRelease.cutoffTime). Maps the
    // release's cutoff_time through the view.
    cutoffClock  = this.column<Date, 'CutoffClock'>('cutoff_clock', 'customLocalTime', 'CutoffClock')
    versionUpper = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.version})`)
    // A View required virtualColumnFromFragment carrying a trailing
    // TypeAdapter (bracketAdapter, read wraps in [...]) — the View twin of the
    // Table's activityTagged; the View-side virtual-column adapter read arm.
    versionTagged = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.version})`, bracketAdapter)
    // optionalVirtualColumnFromFragment on a View.
    versionUpperOptional = this.optionalVirtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.version})`)
    // An adapter-bearing OPTIONAL VIEW column: `channelBracketed` maps the
    // view's nullable `channel_bracketed` expression through the trailing
    // bracketAdapter (read wraps a present value in [...]; a NULL reads back
    // absent).
    channelBracketed = this.optionalColumn('channel_bracketed', 'string', bracketAdapter)
    // optionalVirtualColumnFromFragment on a View carrying a trailing TypeAdapter
    // (bracketAdapter, read wraps in [...]).
    versionUpperTagged = this.optionalVirtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.version})`, bracketAdapter)
    // Custom-kind virtualColumnFromFragment / optional on a VIEW: required + optional
    // branded customInt ('Cents', marshalled to int), computed as release id * 10.
    centsFromId         = this.virtualColumnFromFragment<number, 'Cents'>('customInt', 'Cents', (fragment) => fragment.sql`${this.id} * 10`)
    centsFromIdOptional = this.optionalVirtualColumnFromFragment<number, 'Cents'>('customInt', 'Cents', (fragment) => fragment.sql`${this.id} * 10`)
    // Per-kind PLAIN read marshalling on a View: boolean/bigint/double are backed by
    // project_release base columns; uuid reuses signing_key; localDate/localTime reuse
    // released_on/cutoff_time (also mapped as their custom-branded twins above); the
    // custom-kind + trailing-adapter column maps id through plusOffsetAdapter (read +1000).
    isSigned        = this.optionalColumn('is_signed', 'boolean')
    downloadCount   = this.optionalColumn('download_count', 'bigint')
    avgRating       = this.optionalColumn('avg_rating', 'double')
    signingUuid     = this.optionalColumn('signing_uuid', 'uuid')
    releaseDayPlain = this.column('release_day_plain', 'localDate')
    cutoffPlain     = this.column('cutoff_plain', 'localTime')
    releaseOrdinal  = this.column<ReleaseTag, 'ReleaseTag'>('release_ordinal', 'customInt', 'ReleaseTag', plusOffsetAdapter)
    // A nullable custom-kind (customInt / ReleaseTag) VIEW column carrying a
    // trailing TypeAdapter (plusOffsetAdapter, read +1000). The view computes it
    // as the release id when download_count is present, else NULL.
    optionalReleaseOrdinal = this.optionalColumn<ReleaseTag, 'ReleaseTag'>('optional_release_ordinal', 'customInt', 'ReleaseTag', plusOffsetAdapter)
    // A REQUIRED plain localDateTime View column and its REQUIRED
    // customLocalDateTime ('PublishStamp') twin — both surface the release's
    // published_at through the view, so the required-on-read localDateTime getter
    // surface is observed on a View source (the optional archivedAt View getters
    // and the Table-side publishedAt are the other sides).
    publishStampPlain = this.column('published_stamp_plain', 'localDateTime')
    publishStamp      = this.column<Date, 'PublishStamp'>('published_stamp', 'customLocalDateTime', 'PublishStamp')
    constructor() { super('release_overview') }
}()


// Enum used by tWebhookEvent.eventType's columnWithDefaultValue.
export type WebhookEventType = 'created' | 'updated' | 'deleted'

// A Table whose autogeneratedPrimaryKey is a bigint (the other tables use an
// int IDENTITY/SERIAL PK).
export const tWebhookEvent = new class TWebhookEvent extends Table<DBConnection, 'TWebhookEvent'> {
    id        = this.autogeneratedPrimaryKey('id', 'bigint')
    issueId   = this.column('issue_id', 'int')
    // columnWithDefaultValue on an `enum` column (with a DB DEFAULT).
    eventType = this.columnWithDefaultValue<WebhookEventType, 'WebhookEventType'>('event_type', 'enum', 'WebhookEventType')
    constructor() { super('webhook_event') }
}()

// A Table whose caller-provided primaryKey is an int (tCountry.code is the
// other provided PK, a string).
export const tCalendarYear = new class TCalendarYear extends Table<DBConnection, 'TCalendarYear'> {
    yearValue = this.primaryKey('year_value', 'int')
    label = this.column('year_label', 'string')
    constructor() { super('calendar_year') }
}()

// A table whose caller-provided int primary key carries a trailing TypeAdapter
// (scaledTenthAdapter): the value is stored x10 and read /10, so the
// PK-factory's adapter overload is observable on the write (insert / WHERE)
// and read paths. invoice_no carries the adapter; total is a plain int.
export const tInvoice = new class TInvoice extends Table<DBConnection, 'TInvoice'> {
    invoiceNo = this.primaryKey('invoice_no', 'int', scaledTenthAdapter)
    total     = this.column('total', 'int')
    constructor() { super('invoice') }
}()

// A table whose column factories all carry the trailing-TypeAdapter
// overload — the no-adapter forms are fixtured elsewhere, but the adapter
// overload on these factories was previously unexercised. entry_no is an
// autogeneratedPrimaryKey carrying plusOffsetAdapter (read +1000, so the
// DB-generated id surfaces offset, and a WHERE operand is shifted -1000);
// amount is a columnWithDefaultValue and memo an optionalColumnWithDefaultValue,
// both carrying scaledTenthAdapter (stored x10, read /10) over a DB DEFAULT;
// tag is an optionalVirtualColumnFromFragment carrying bracketAdapter (read
// wrapped in [...]).
export const tLedgerEntry = new class TLedgerEntry extends Table<DBConnection, 'TLedgerEntry'> {
    entryNo = this.autogeneratedPrimaryKey('entry_no', 'int', plusOffsetAdapter)
    amount  = this.columnWithDefaultValue('amount', 'int', scaledTenthAdapter)
    memo    = this.optionalColumnWithDefaultValue('memo', 'int', scaledTenthAdapter)
    // A NULLABLE writable int column carrying a NON-boolean value-transform
    // adapter (scaledTenthAdapter, stored x10 / read /10).
    discount = this.optionalColumn('discount', 'int', scaledTenthAdapter)
    tag     = this.optionalVirtualColumnFromFragment('string', (fragment) => fragment.sql`upper('led')`, bracketAdapter)
    constructor() { super('ledger_entry') }
}()

// A dedicated table for the OPTIONAL-column NULL branch of the Nullable family on
// the bare-base enum/custom/customComparable leaves (§B-1). The required siblings
// live on tIssueWorklog.activity / tProjectRelease.channel / tProjectRelease.version;
// here `stage` (enum), `channel` (custom, reusing ReleaseChannel) and `minVersion`
// (customComparable, reusing the Semver typeName) are nullable, so a draft that has
// not decided them yet leaves them NULL — letting valueWhenNull / nullIfValue /
// isNull observe the real NULL branch. A caller-provided int PK (no identity) keeps
// the per-dialect reset trivial.
export type ReleaseStage = 'draft' | 'candidate' | 'final'
export const tReleaseDraft = new class TReleaseDraft extends Table<DBConnection, 'TReleaseDraft'> {
    id         = this.primaryKey('id', 'int')
    title      = this.column('title', 'string')
    stage      = this.optionalColumn<ReleaseStage, 'ReleaseStage'>('stage', 'enum', 'ReleaseStage')
    channel    = this.optionalColumn<ReleaseChannel, 'ReleaseChannel'>('channel', 'custom', 'ReleaseChannel')
    minVersion = this.optionalColumn<string, 'Semver'>('min_version', 'customComparable', 'Semver')
    // Optional custom-kind columns (customDouble 'Money', customLocalDate
    // 'ReleaseDay', customLocalTime 'CutoffClock') so isNull / isNotNull reach a
    // realizable NULL branch on these kinds. Draft 2 leaves them NULL.
    budget     = this.optionalColumn<number, 'Money'>('budget', 'customDouble', 'Money')
    targetDay  = this.optionalColumn<Date, 'ReleaseDay'>('target_day', 'customLocalDate', 'ReleaseDay')
    cutoff     = this.optionalColumn<Date, 'CutoffClock'>('cutoff', 'customLocalTime', 'CutoffClock')
    // Trailing-TypeAdapter ([a2] slot) on Table columns of each remaining kind —
    // no other Table column factory carries a custom-kind trailing adapter. Each
    // is a columnWithDefaultValue reading its DB DEFAULT through the adapter, so
    // the adapter's read effect is observable: the numeric kinds scale/shift, the
    // string kinds bracket, the customLocalDateTime shifts +1h.
    scaledCost      = this.columnWithDefaultValue<number, 'Cents'>('scaled_cost', 'customInt', 'Cents', scaledTenthAdapter)
    shiftedAmount   = this.columnWithDefaultValue<number, 'Money'>('shifted_amount', 'customDouble', 'Money', plusOffsetAdapter)
    bracketVersion  = this.columnWithDefaultValue<string, 'Semver'>('bracket_version', 'customComparable', 'Semver', bracketAdapter)
    bracketChannel  = this.columnWithDefaultValue<ReleaseChannel, 'ReleaseChannel'>('bracket_channel', 'custom', 'ReleaseChannel', bracketAdapter)
    bracketActivity = this.columnWithDefaultValue<WorklogActivity, 'WorklogActivity'>('bracket_activity', 'enum', 'WorklogActivity', bracketAdapter)
    shiftedStamp    = this.columnWithDefaultValue<Date, 'PublishStamp'>('shifted_stamp', 'customLocalDateTime', 'PublishStamp', shiftHourAdapter)
    shiftedCount    = this.columnWithDefaultValue('shifted_count', 'bigint', plusThousandBigintAdapter)
    shiftedRating   = this.columnWithDefaultValue('shifted_rating', 'double', plusOffsetAdapter)
    // customUuid / customLocalDate / customLocalTime columns carrying a trailing
    // TypeAdapter, each reading its DB DEFAULT through the adapter (uuid bracketed;
    // date/time shifted +1h on read).
    bracketSigningKey = this.columnWithDefaultValue<string, 'SigningKey'>('bracket_signing_key', 'customUuid', 'SigningKey', bracketAdapter)
    shiftedReleaseDay = this.columnWithDefaultValue<Date, 'ReleaseDay'>('shifted_release_day', 'customLocalDate', 'ReleaseDay', shiftHourAdapter)
    shiftedCutoff     = this.columnWithDefaultValue<Date, 'CutoffClock'>('shifted_cutoff', 'customLocalTime', 'CutoffClock', shiftHourAdapter)
    constructor() { super('release_draft') }
}()
