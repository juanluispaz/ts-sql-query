// Shared connection definition for the mariadb dialect: used by every
// connector under test/db/mariadb/<version>/<connector>/. The only thing
// that changes between connectors is the QueryRunner injected into the
// constructor and the `compatibilityVersion` the test variant targets.

import { MariaDBConnection } from '../../../../src/connections/MariaDBConnection.js'
import type { QueryRunner } from '../../../../src/queryRunners/QueryRunner.js'
import { Table } from '../../../../src/Table.js'
import { View } from '../../../../src/View.js'
import { CustomBooleanTypeAdapter, type TypeAdapter, type TypeAdapterValueFromDBContext } from '../../../../src/TypeAdapter.js'
import { EnumType, withSqlDataType } from '../../../../src/exports/v2/index.js'
import { ComparableType, EqualableType, IntegersType, LocalDateTimesType, LocalDatesType, LocalTimesType, RealsType, UuidsType } from '../../../../src/exports/v2/index.js'

// The data types of the values of the user, each one a class of the family of its values
abstract class MoneyType extends RealsType<Money, 'Money'> { static override readonly type = 'Money' }
abstract class WorklogActivityType extends EnumType<WorklogActivity, 'WorklogActivity'> { static override readonly type = 'WorklogActivity' }
abstract class ReleaseChannelType extends EqualableType<ReleaseChannel, 'ReleaseChannel'> { static override readonly type = 'ReleaseChannel' }
abstract class SemverType extends ComparableType<string, 'Semver'> { static override readonly type = 'Semver' }
abstract class CentsType extends IntegersType<number, 'Cents'> { static override readonly type = 'Cents' }
abstract class SigningKeyType extends UuidsType<string, 'SigningKey'> { static override readonly type = 'SigningKey' }
abstract class ReleaseDayType extends LocalDatesType<Date, 'ReleaseDay'> { static override readonly type = 'ReleaseDay' }
abstract class CutoffClockType extends LocalTimesType<Date, 'CutoffClock'> { static override readonly type = 'CutoffClock' }
abstract class SignOffStampType extends LocalDateTimesType<Date, 'SignOffStamp'> { static override readonly type = 'SignOffStamp' }
abstract class MoneyRealsType extends RealsType<number, 'Money'> { static override readonly type = 'Money' }
abstract class ReleaseTagType extends IntegersType<ReleaseTag, 'ReleaseTag'> { static override readonly type = 'ReleaseTag' }
abstract class ReleaseTagIntegersType extends IntegersType<number, 'ReleaseTag'> { static override readonly type = 'ReleaseTag' }
abstract class PublishStampType extends LocalDateTimesType<Date, 'PublishStamp'> { static override readonly type = 'PublishStamp' }
abstract class WebhookEventEnumType extends EnumType<WebhookEventType, 'WebhookEventType'> { static override readonly type = 'WebhookEventType' }
abstract class ReleaseStageType extends EnumType<ReleaseStage, 'ReleaseStage'> { static override readonly type = 'ReleaseStage' }

const verifiedAdapter  = new CustomBooleanTypeAdapter('Y', 'N')
// A trailing TypeAdapter for virtualColumnFromFragment that brackets the read
// value so the adapter's effect is observable in the result.
const bracketAdapter: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return typeof v === 'string' ? '[' + v + ']' : v
    },
    transformValueToDB(value, context, next) {
        return next.transformValueToDB(value, context)
    },
}
// Observable per-column TypeAdapter for a NON-boolean int column: the DB stores
// the score as a fixed-point value scaled ×10; the app sees the unscaled number
// (read ÷10, write ×10).
const scaledTenthAdapter: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return typeof v === 'number' ? v / 10 : v
    },
    transformValueToDB(value, context, next) {
        return next.transformValueToDB(typeof value === 'number' ? value * 10 : value, context)
    },
}
// Numeric observable TypeAdapter: shifts a numeric value by a fixed offset so
// the adapter's effect is visible in a numeric result (read +1000, write -1000).
// Used by callEstimatedTotalOffset (executeFunction) and issueIdSeqOffset (sequence).
const plusOffsetAdapter: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return typeof v === 'number' ? v + 1000 : v
    },
    transformValueToDB(value, context, next) {
        return next.transformValueToDB(typeof value === 'number' ? value - 1000 : value, context)
    },
}
// Bigint observable TypeAdapter: read +1000n / write -1000n (the bigint sibling
// of plusOffsetAdapter, whose number-only guard would pass a bigint through
// unchanged). Used by the bigint + adapter Table column shiftedCount.
const plusThousandBigintAdapter: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return typeof v === 'bigint' ? v + 1000n : v
    },
    transformValueToDB(value, context, next) {
        return next.transformValueToDB(typeof value === 'bigint' ? value - 1000n : value, context)
    },
}
// Temporal observable TypeAdapter: shifts a Date +1 hour on read / -1 hour on
// write, so the adapter's effect is visible in a temporal result. Used by the
// LocalDateTimesType + adapter Table column shiftedStamp.
const shiftHourAdapter: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return v instanceof Date ? new Date(v.getTime() + 3600000) : v
    },
    transformValueToDB(value, context, next) {
        return next.transformValueToDB(value instanceof Date ? new Date(value.getTime() - 3600000) : value, context)
    },
}
// Observable trailing adapters for the executeFunction return-kind fan-out
// (exercised by exec.function-value-kinds.test.ts). Each
// transformValueFromDB does a visible transform on its kind's marshalled value
// so the trailing-adapter slot's effect is observable in the function result
// (shapes mirror select.connection-trailing-adapter.test.ts). transformValueToDB
// delegates to next (the function has no bound value to shift). String kinds
// reuse bracketAdapter and temporal kinds reuse shiftHourAdapter above.
const fnNumberTimesTen: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return typeof v === 'number' ? v * 10 : v
    },
    transformValueToDB(value, context, next) {
        return next.transformValueToDB(value, context)
    },
}
const fnBigintTimesTen: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return typeof v === 'bigint' ? v * 10n : v
    },
    transformValueToDB(value, context, next) {
        return next.transformValueToDB(value, context)
    },
}
const fnBoolNegate: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return typeof v === 'boolean' ? !v : v
    },
    transformValueToDB(value, context, next) {
        return next.transformValueToDB(value, context)
    },
}
// Lowercase-then-bracket a uuid string on read; lowercasing first keeps the
// assertion stable across engines that echo a uuid in a different case.
const fnUuidBracket: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return typeof v === 'string' ? '[' + v.toLowerCase() + ']' : v
    },
    transformValueToDB(value, context, next) {
        return next.transformValueToDB(value, context)
    },
}
const publishedAdapter = new CustomBooleanTypeAdapter('t', 'f')
// Nullable custom-boolean adapter — the optional sibling of verified/published.
const approvedAdapter  = new CustomBooleanTypeAdapter('A', 'R')
// Numeric-overload CustomBooleanTypeAdapter (true -> int 1, false -> int 0)
// for the `invoiced` flag — the integer counterpart of the string adapters.
const invoicedAdapter  = new CustomBooleanTypeAdapter(1, 0)

// Branded newtype for the RealsType executeFunction wrapper (G1).
export type Money = number & { readonly __brand: 'Money' }

// Branded newtype for the IntegersType sequence (G2).
export type ReleaseTag = number & { readonly __brand: 'ReleaseTag' }

// Every other TypeAdapter in this file switches on `typeof value`, so it cannot
// tell an `int` from a `Cents`. This one transforms ONLY when the original type NAME
// of the value is `Cents`, `Money` or `ReleaseTag` (write x100, read /100) and delegates
// every other type name untouched. An expression that keeps its data type of the user is therefore
// scaled and one that fell back to a plain `int` / `double` is not, so the bound
// placeholder and the value read back both record which data type the expression
// actually carried.
const scaledByTypeName: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        if ((context.originalType.type === 'Cents' || context.originalType.type === 'Money' || context.originalType.type === 'ReleaseTag') && typeof v === 'number') {
            return v / 100
        }
        return v
    },
    transformValueToDB(value, context, next) {
        if ((context.originalType.type === 'Cents' || context.originalType.type === 'Money' || context.originalType.type === 'ReleaseTag') && typeof value === 'number') {
            return next.transformValueToDB(value * 100, context)
        }
        return next.transformValueToDB(value, context)
    },
}

export class DBConnection extends MariaDBConnection<'DBConnection'> {
    constructor(queryRunner: QueryRunner, compatibilityVersion?: number) {
        super(queryRunner)
        if (compatibilityVersion !== undefined) {
            this.compatibilityVersion = compatibilityVersion
            // Before MariaDB 10.7 there is no UUID column type: the schema has a CHAR(36)
            if (compatibilityVersion < 10_007_000) {
                this.uuidStrategy = 'string'
            }
        }
    }

    // The `VIssueBilling` values view in `with-values.advanced.test.ts`
    // declares types of the user without a per-column `TypeAdapter`: `IssueId`
    // (IntegersType), `Money` (RealsType) and `BillingRef` (UuidsType).
    // The default adapter passes custom typeNames through unchanged; some
    // drivers hand an uncast VALUES placeholder back as a string, so a
    // `IntegersType` read from a VALUES tuple could surface as `"101"` rather
    // than `101`. Reading these typeNames as their base native type (the type
    // requested for the value read) keeps the round-trip typed correctly on
    // every dialect (a no-op where the driver already returns the native type);
    // they are sent as they are declared.
    private static baseTypeForCustom(type: string): 'double' | 'int' | 'localDate' | 'localDateTime' | 'localTime' | 'string' | 'uuid' | undefined {
        switch (type) {
            case 'IssueId':    return 'int'
            case 'Cents':      return 'int'
            case 'Money':      return 'double'
            case 'ReleaseTag':   return 'int'
            case 'BillingRef': return 'uuid'
            case 'ProjectId':    return 'int'
            case 'Meters':       return 'double'
            case 'Ratio':        return 'double'
            case 'ScoreCount':   return 'int'
            case 'Score':        return 'double'
            // Branded types of the user declared on tProjectRelease / vReleaseOverview.
            case 'Semver':       return 'string'
            case 'ReleaseChannel': return 'string'
            case 'SigningKey':   return 'uuid'
            case 'ReleaseDay':   return 'localDate'
            case 'CutoffClock':  return 'localTime'
            case 'SignOffStamp': return 'localDateTime'
            case 'PublishStamp': return 'localDateTime'
            default:           return undefined
        }
    }
    protected override transformValueFromDB(value: unknown, context: TypeAdapterValueFromDBContext): unknown {
        const baseType = DBConnection.baseTypeForCustom(context.requestedType.type)
        if (baseType) {
            context.setRequestedType(baseType)
        }
        return super.transformValueFromDB(value, context)
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
    // estimated_total returns a branded RealsType (Money). The function
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
        return this.executeFunction('estimated_total', [
            this.const(projectId, 'int'),
        ], MoneyType, 'required')
    }
    // A RealsType executeFunction wrapper with a trailing TypeAdapter:
    // plusOffsetAdapter shifts the numeric result so the adapter's effect is
    // observable. Reuses estimated_total.
    callEstimatedTotalOffset(projectId: number): Promise<Money> {
        return this.executeFunction('estimated_total', [
            this.const(projectId, 'int'),
        ], MoneyType, 'required', plusOffsetAdapter)
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
        return this.executeFunction('estimated_total', [
            this.const(projectId, 'int'),
        ], MoneyType, 'optional')
    }

    // executeFunction return-kind fan-out: one required + one optional wrapper
    // per remaining return kind, each routing that kind's transformValueFromDB
    // marshaller and the required/optional null-gate. Plain kinds reuse the
    // constant functions (ret_flag / ret_uuid / ret_day / ret_clock /
    // ret_activity / ret_channel / ret_semver); double / IntegersType /
    // LocalDateTimesType reuse estimated_total / count_open_issues /
    // latest_issue_at. The types of the user thread the typeName generic.
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
        return this.executeFunction('ret_activity', [this.const(id, 'int')], WorklogActivityType, 'required')
    }
    callRetEnumOptional(id: number): Promise<WorklogActivity | null> {
        return this.executeFunction('ret_activity', [this.const(id, 'int')], WorklogActivityType, 'optional')
    }
    callRetCustom(id: number): Promise<ReleaseChannel> {
        return this.executeFunction('ret_channel', [this.const(id, 'int')], ReleaseChannelType, 'required')
    }
    callRetCustomOptional(id: number): Promise<ReleaseChannel | null> {
        return this.executeFunction('ret_channel', [this.const(id, 'int')], ReleaseChannelType, 'optional')
    }
    callRetCustomComparable(id: number): Promise<string> {
        return this.executeFunction('ret_semver', [this.const(id, 'int')], SemverType, 'required')
    }
    callRetCustomComparableOptional(id: number): Promise<string | null> {
        return this.executeFunction('ret_semver', [this.const(id, 'int')], SemverType, 'optional')
    }
    callRetCustomInt(id: number): Promise<number> {
        return this.executeFunction('count_open_issues', [this.const(id, 'int')], CentsType, 'required')
    }
    callRetCustomIntOptional(id: number): Promise<number | null> {
        return this.executeFunction('count_open_issues', [this.const(id, 'int')], CentsType, 'optional')
    }
    callRetCustomUuid(id: number): Promise<string> {
        return this.executeFunction('ret_uuid', [this.const(id, 'int')], SigningKeyType, 'required')
    }
    callRetCustomUuidOptional(id: number): Promise<string | null> {
        return this.executeFunction('ret_uuid', [this.const(id, 'int')], SigningKeyType, 'optional')
    }
    callRetCustomLocalDate(id: number): Promise<Date> {
        return this.executeFunction('ret_day', [this.const(id, 'int')], ReleaseDayType, 'required')
    }
    callRetCustomLocalDateOptional(id: number): Promise<Date | null> {
        return this.executeFunction('ret_day', [this.const(id, 'int')], ReleaseDayType, 'optional')
    }
    callRetCustomLocalTime(id: number): Promise<Date> {
        return this.executeFunction('ret_clock', [this.const(id, 'int')], CutoffClockType, 'required')
    }
    callRetCustomLocalTimeOptional(id: number): Promise<Date | null> {
        return this.executeFunction('ret_clock', [this.const(id, 'int')], CutoffClockType, 'optional')
    }
    callRetCustomLocalDateTime(id: number): Promise<Date> {
        return this.executeFunction('latest_issue_at', [this.const(id, 'int')], SignOffStampType, 'required')
    }
    callRetCustomLocalDateTimeOptional(id: number): Promise<Date | null> {
        return this.executeFunction('latest_issue_at', [this.const(id, 'int')], SignOffStampType, 'optional')
    }

    // executeFunction return-kind × {required, optional} × {no-adapter, trailing
    // adapter} fan-out, exercised by
    // `exec.function-value-kinds.test.ts`. Each kind reads its col_matrix row-1
    // value through a zero-arg `cm_<basekind>()` function (schema.sql). The four
    // wrappers per kind route the SAME DB value through: the base required /
    // optional null-gate, and the trailing-adapter slot (required / optional),
    // whose observable transformValueFromDB (numeric ×10, bigint ×10n, boolean
    // negate, uuid/string bracket, Date +1h) makes the adapter visible in the
    // result. Custom kinds thread the typeName generic and reuse the base
    // function; the plain-kind adapter rides the last positional slot, the
    // own-kind adapter the `adapter2` slot after the typeName.

    // int (cm_int)
    callCmInt(): Promise<number> {
        return this.executeFunction('cm_int', [], 'int', 'required')
    }
    callCmIntOpt(): Promise<number | null> {
        return this.executeFunction('cm_int', [], 'int', 'optional')
    }
    callCmIntAdapter(): Promise<number> {
        return this.executeFunction('cm_int', [], 'int', 'required', fnNumberTimesTen)
    }
    callCmIntOptAdapter(): Promise<number | null> {
        return this.executeFunction('cm_int', [], 'int', 'optional', fnNumberTimesTen)
    }

    // bigint (cm_bigint)
    callCmBigint(): Promise<bigint> {
        return this.executeFunction('cm_bigint', [], 'bigint', 'required')
    }
    callCmBigintOpt(): Promise<bigint | null> {
        return this.executeFunction('cm_bigint', [], 'bigint', 'optional')
    }
    callCmBigintAdapter(): Promise<bigint> {
        return this.executeFunction('cm_bigint', [], 'bigint', 'required', fnBigintTimesTen)
    }
    callCmBigintOptAdapter(): Promise<bigint | null> {
        return this.executeFunction('cm_bigint', [], 'bigint', 'optional', fnBigintTimesTen)
    }

    // double (cm_double)
    callCmDouble(): Promise<number> {
        return this.executeFunction('cm_double', [], 'double', 'required')
    }
    callCmDoubleOpt(): Promise<number | null> {
        return this.executeFunction('cm_double', [], 'double', 'optional')
    }
    callCmDoubleAdapter(): Promise<number> {
        return this.executeFunction('cm_double', [], 'double', 'required', fnNumberTimesTen)
    }
    callCmDoubleOptAdapter(): Promise<number | null> {
        return this.executeFunction('cm_double', [], 'double', 'optional', fnNumberTimesTen)
    }

    // boolean (cm_bool)
    callCmBoolean(): Promise<boolean> {
        return this.executeFunction('cm_bool', [], 'boolean', 'required')
    }
    callCmBooleanOpt(): Promise<boolean | null> {
        return this.executeFunction('cm_bool', [], 'boolean', 'optional')
    }
    callCmBooleanAdapter(): Promise<boolean> {
        return this.executeFunction('cm_bool', [], 'boolean', 'required', fnBoolNegate)
    }
    callCmBooleanOptAdapter(): Promise<boolean | null> {
        return this.executeFunction('cm_bool', [], 'boolean', 'optional', fnBoolNegate)
    }

    // uuid (cm_uuid)
    callCmUuid(): Promise<string> {
        return this.executeFunction('cm_uuid', [], 'uuid', 'required')
    }
    callCmUuidOpt(): Promise<string | null> {
        return this.executeFunction('cm_uuid', [], 'uuid', 'optional')
    }
    callCmUuidAdapter(): Promise<string> {
        return this.executeFunction('cm_uuid', [], 'uuid', 'required', fnUuidBracket)
    }
    callCmUuidOptAdapter(): Promise<string | null> {
        return this.executeFunction('cm_uuid', [], 'uuid', 'optional', fnUuidBracket)
    }

    // localDate (cm_date)
    callCmLocalDate(): Promise<Date> {
        return this.executeFunction('cm_date', [], 'localDate', 'required')
    }
    callCmLocalDateOpt(): Promise<Date | null> {
        return this.executeFunction('cm_date', [], 'localDate', 'optional')
    }
    callCmLocalDateAdapter(): Promise<Date> {
        return this.executeFunction('cm_date', [], 'localDate', 'required', shiftHourAdapter)
    }
    callCmLocalDateOptAdapter(): Promise<Date | null> {
        return this.executeFunction('cm_date', [], 'localDate', 'optional', shiftHourAdapter)
    }

    // localTime (cm_time)
    callCmLocalTime(): Promise<Date> {
        return this.executeFunction('cm_time', [], 'localTime', 'required')
    }
    callCmLocalTimeOpt(): Promise<Date | null> {
        return this.executeFunction('cm_time', [], 'localTime', 'optional')
    }
    callCmLocalTimeAdapter(): Promise<Date> {
        return this.executeFunction('cm_time', [], 'localTime', 'required', shiftHourAdapter)
    }
    callCmLocalTimeOptAdapter(): Promise<Date | null> {
        return this.executeFunction('cm_time', [], 'localTime', 'optional', shiftHourAdapter)
    }

    // localDateTime (cm_datetime)
    callCmLocalDateTime(): Promise<Date> {
        return this.executeFunction('cm_datetime', [], 'localDateTime', 'required')
    }
    callCmLocalDateTimeOpt(): Promise<Date | null> {
        return this.executeFunction('cm_datetime', [], 'localDateTime', 'optional')
    }
    callCmLocalDateTimeAdapter(): Promise<Date> {
        return this.executeFunction('cm_datetime', [], 'localDateTime', 'required', shiftHourAdapter)
    }
    callCmLocalDateTimeOptAdapter(): Promise<Date | null> {
        return this.executeFunction('cm_datetime', [], 'localDateTime', 'optional', shiftHourAdapter)
    }

    // string (cm_str)
    callCmString(): Promise<string> {
        return this.executeFunction('cm_str', [], 'string', 'required')
    }
    callCmStringOpt(): Promise<string | null> {
        return this.executeFunction('cm_str', [], 'string', 'optional')
    }
    callCmStringAdapter(): Promise<string> {
        return this.executeFunction('cm_str', [], 'string', 'required', bracketAdapter)
    }
    callCmStringOptAdapter(): Promise<string | null> {
        return this.executeFunction('cm_str', [], 'string', 'optional', bracketAdapter)
    }

    // enum (cm_str, WorklogActivity)
    callCmEnum(): Promise<WorklogActivity> {
        return this.executeFunction('cm_str', [], WorklogActivityType, 'required')
    }
    callCmEnumOpt(): Promise<WorklogActivity | null> {
        return this.executeFunction('cm_str', [], WorklogActivityType, 'optional')
    }
    callCmEnumAdapter(): Promise<WorklogActivity> {
        return this.executeFunction('cm_str', [], WorklogActivityType, 'required', bracketAdapter)
    }
    callCmEnumOptAdapter(): Promise<WorklogActivity | null> {
        return this.executeFunction('cm_str', [], WorklogActivityType, 'optional', bracketAdapter)
    }

    // custom (cm_str, ReleaseChannel)
    callCmCustom(): Promise<ReleaseChannel> {
        return this.executeFunction('cm_str', [], ReleaseChannelType, 'required')
    }
    callCmCustomOpt(): Promise<ReleaseChannel | null> {
        return this.executeFunction('cm_str', [], ReleaseChannelType, 'optional')
    }
    callCmCustomAdapter(): Promise<ReleaseChannel> {
        return this.executeFunction('cm_str', [], ReleaseChannelType, 'required', bracketAdapter)
    }
    callCmCustomOptAdapter(): Promise<ReleaseChannel | null> {
        return this.executeFunction('cm_str', [], ReleaseChannelType, 'optional', bracketAdapter)
    }

    // ComparableType (cm_str, Semver)
    callCmCustomComparable(): Promise<string> {
        return this.executeFunction('cm_str', [], SemverType, 'required')
    }
    callCmCustomComparableOpt(): Promise<string | null> {
        return this.executeFunction('cm_str', [], SemverType, 'optional')
    }
    callCmCustomComparableAdapter(): Promise<string> {
        return this.executeFunction('cm_str', [], SemverType, 'required', bracketAdapter)
    }
    callCmCustomComparableOptAdapter(): Promise<string | null> {
        return this.executeFunction('cm_str', [], SemverType, 'optional', bracketAdapter)
    }

    // IntegersType (cm_int, Cents)
    callCmCustomInt(): Promise<number> {
        return this.executeFunction('cm_int', [], CentsType, 'required')
    }
    callCmCustomIntOpt(): Promise<number | null> {
        return this.executeFunction('cm_int', [], CentsType, 'optional')
    }
    callCmCustomIntAdapter(): Promise<number> {
        return this.executeFunction('cm_int', [], CentsType, 'required', fnNumberTimesTen)
    }
    callCmCustomIntOptAdapter(): Promise<number | null> {
        return this.executeFunction('cm_int', [], CentsType, 'optional', fnNumberTimesTen)
    }

    // UuidsType (cm_uuid, SigningKey)
    callCmCustomUuid(): Promise<string> {
        return this.executeFunction('cm_uuid', [], SigningKeyType, 'required')
    }
    callCmCustomUuidOpt(): Promise<string | null> {
        return this.executeFunction('cm_uuid', [], SigningKeyType, 'optional')
    }
    callCmCustomUuidAdapter(): Promise<string> {
        return this.executeFunction('cm_uuid', [], SigningKeyType, 'required', fnUuidBracket)
    }
    callCmCustomUuidOptAdapter(): Promise<string | null> {
        return this.executeFunction('cm_uuid', [], SigningKeyType, 'optional', fnUuidBracket)
    }

    // RealsType (cm_double, Money)
    callCmCustomDouble(): Promise<number> {
        return this.executeFunction('cm_double', [], MoneyRealsType, 'required')
    }
    callCmCustomDoubleOpt(): Promise<number | null> {
        return this.executeFunction('cm_double', [], MoneyRealsType, 'optional')
    }
    callCmCustomDoubleAdapter(): Promise<number> {
        return this.executeFunction('cm_double', [], MoneyRealsType, 'required', fnNumberTimesTen)
    }
    callCmCustomDoubleOptAdapter(): Promise<number | null> {
        return this.executeFunction('cm_double', [], MoneyRealsType, 'optional', fnNumberTimesTen)
    }

    // LocalDatesType (cm_date, ReleaseDay)
    callCmCustomLocalDate(): Promise<Date> {
        return this.executeFunction('cm_date', [], ReleaseDayType, 'required')
    }
    callCmCustomLocalDateOpt(): Promise<Date | null> {
        return this.executeFunction('cm_date', [], ReleaseDayType, 'optional')
    }
    callCmCustomLocalDateAdapter(): Promise<Date> {
        return this.executeFunction('cm_date', [], ReleaseDayType, 'required', shiftHourAdapter)
    }
    callCmCustomLocalDateOptAdapter(): Promise<Date | null> {
        return this.executeFunction('cm_date', [], ReleaseDayType, 'optional', shiftHourAdapter)
    }

    // LocalTimesType (cm_time, CutoffClock)
    callCmCustomLocalTime(): Promise<Date> {
        return this.executeFunction('cm_time', [], CutoffClockType, 'required')
    }
    callCmCustomLocalTimeOpt(): Promise<Date | null> {
        return this.executeFunction('cm_time', [], CutoffClockType, 'optional')
    }
    callCmCustomLocalTimeAdapter(): Promise<Date> {
        return this.executeFunction('cm_time', [], CutoffClockType, 'required', shiftHourAdapter)
    }
    callCmCustomLocalTimeOptAdapter(): Promise<Date | null> {
        return this.executeFunction('cm_time', [], CutoffClockType, 'optional', shiftHourAdapter)
    }

    // LocalDateTimesType (cm_datetime, SignOffStamp)
    callCmCustomLocalDateTime(): Promise<Date> {
        return this.executeFunction('cm_datetime', [], SignOffStampType, 'required')
    }
    callCmCustomLocalDateTimeOpt(): Promise<Date | null> {
        return this.executeFunction('cm_datetime', [], SignOffStampType, 'optional')
    }
    callCmCustomLocalDateTimeAdapter(): Promise<Date> {
        return this.executeFunction('cm_datetime', [], SignOffStampType, 'required', shiftHourAdapter)
    }
    callCmCustomLocalDateTimeOptAdapter(): Promise<Date | null> {
        return this.executeFunction('cm_datetime', [], SignOffStampType, 'optional', shiftHourAdapter)
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
    ownComparableEq = this.buildFragmentWithArgsIfValue(
        this.arg(SemverType, 'optional'), this.valueArg(SemverType, 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    ownEq = this.buildFragmentWithArgsIfValue(
        this.arg(ReleaseChannelType, 'optional'), this.valueArg(ReleaseChannelType, 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    enumEq = this.buildFragmentWithArgsIfValue(
        this.arg(WorklogActivityType, 'optional'), this.valueArg(WorklogActivityType, 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    ownUuidEq = this.buildFragmentWithArgsIfValue(
        this.arg(SigningKeyType, 'optional'), this.valueArg(SigningKeyType, 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} = ${v}`)
    // boolean arm — combined in a LOGICAL (condition) context with `or` so the
    // library's boolean emulation renders each operand as a predicate
    // (`(billable = 1) or ...` on engines without a native boolean). A raw `=`
    // between two boolean operands would instead compare two predicates
    // (`(x = 1) = (y = 1)`), which SQL Server rejects.
    booleanOrFragment = this.buildFragmentWithArgsIfValue(
        this.arg('boolean', 'optional'), this.valueArg('boolean', 'optional')
    ).as((c, v) => this.fragmentWithType('boolean', 'required').sql`${c} or ${v}`)

    // arg / valueArg over the temporal and own-fractional keywords. Each is
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
    ownDoubleEq = this.buildFragmentWithArgsIfValue(
        this.arg(MoneyRealsType, 'optional'), this.valueArg(MoneyRealsType, 'optional')
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

    // Sequence references — exercised by sequence.next-current-value.test.ts.
    // Sequences are only typed on AbstractAdvancedConnection-derived
    // dialects (mariaDB ≥ 10.3, oracle, postgreSql, sqlServer); see
    // docs/api/connection.md. The matching DDL is not in the seed
    // because the tests run mock-only.
    issueIdSeq  = this.sequence('issue_id_seq', 'int')
    // A sequence reference carrying a trailing TypeAdapter (plusOffsetAdapter).
    // Reuses issue_id_seq; the emitted SQL is identical to issueIdSeq, only the
    // read value is shifted by the adapter (observable on nextValue/currentValue).
    issueIdSeqOffset = this.sequence('issue_id_seq', 'int', plusOffsetAdapter)
    auditTagSeq = this.sequence('audit_tag_seq', 'bigint')
    // A BIGINT sequence carrying a trailing bigint TypeAdapter
    // (plusThousandBigintAdapter, read +1000n), reusing audit_tag_seq.
    auditTagSeqOffset = this.sequence('audit_tag_seq', 'bigint', plusThousandBigintAdapter)

    // Double / RealsType sequence value-types: reuse the existing
    // int / bigint sequences but marshal the drawn value as the WIDER double /
    // RealsType kind. The emitted SQL is identical to issueIdSeq / auditTagSeq;
    // only the read marshalling changes. RealsType binds the 'Money' typeName
    // (marshalled to double via baseTypeForCustom); the value type is a plain
    // number, so nextValue()/currentValue() surface a `number` result.
    doubleSeq = this.sequence('issue_id_seq', 'double')
    ownDoubleSeq = this.sequence('audit_tag_seq', MoneyRealsType)

    // A sequence whose value type is a branded IntegersType (ReleaseTag)
    // rather than the plain int / bigint of issueIdSeq / auditTagSeq — the
    // value-type fan-out of sequence(...). The release_tag_seq DDL lives in
    // this dialect's domain/schema.sql.
    releaseTagSeq = this.sequence('release_tag_seq', ReleaseTagType)

    // A CUSTOM-kind (IntegersType / ReleaseTag) sequence carrying a trailing
    // TypeAdapter (plusOffsetAdapter, read +1000). Reuses release_tag_seq; the
    // emitted SQL is identical to releaseTagSeq, only the read value is shifted.
    releaseTagSeqOffset = this.sequence('release_tag_seq', ReleaseTagType, plusOffsetAdapter)

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
    // slot on the CUSTOM-kind arm of arg / valueArg. Each routes a bound IntegersType
    // ('Cents', marshalled to int) literal
    // through the adapter's write path (x10), so passing 1 binds the scaled 10.
    scaledCustomArgFragment = this.buildFragmentWithArgs(
        this.arg(CentsType, 'required', scaledTenthAdapter)
    ).as((v) => this.fragmentWithType('int', 'required').sql`${v}`)
    scaledCustomThresholdFragment = this.buildFragmentWithArgsIfValue(
        this.arg('int', 'required'),
        this.valueArg(CentsType, 'optional', scaledTenthAdapter)
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

    // The versions of a row valid at some moment between two instants.
    forSystemTimeBetween = this.createTableOrViewCustomization<Date, Date>((table, alias, fromDate, toDate) => {
        const from = this.const(fromDate, 'localDateTime')
        const to = this.const(toDate, 'localDateTime')
        return this.rawFragment`${table} for system_time between ${from} and ${to} ${alias}`
    })

    // A sequence whose drawn value carries a CUSTOM data type (IntegersType /
    // 'ReleaseTag') together with the `scaledByTypeName` adapter, so a derivation
    // applied to `nextValue()` / `currentValue()` records the data type the
    // sequence reference itself carries. Reuses release_tag_seq.
    derivedTagSeq = this.sequence('release_tag_seq', ReleaseTagIntegersType, scaledByTypeName)

    // Fragment-builder arguments declared with a CUSTOM data type. Each body
    // applies a DERIVED operation to the argument, so the argument's own data type
    // -- not just the type name its bound value is marshalled with -- decides how
    // the extra operand is marshalled, how the derivation is spelled, and (where
    // the derived value source is returned directly) how the result reads back.
    //
    // The `scaledByTypeName` ones pair the argument with a second argument of the
    // SAME data type of the user, bound to a column at the call site, so every
    // placeholder sits next to a typed operand and the emitted SQL stays portable.
    derivedArgCents = this.buildFragmentWithArgs(
        this.arg(CentsType, 'required', scaledByTypeName),
        this.arg(CentsType, 'required')
    ).as((v, col) => this.fragmentWithType('int', 'required').sql`${v.add(col).add(9)}`)
    derivedArgMoney = this.buildFragmentWithArgs(
        this.arg(MoneyRealsType, 'required', scaledByTypeName),
        this.arg(MoneyRealsType, 'required')
    ).as((v, col) => this.fragmentWithType('double', 'required').sql`${v.add(col).add(9)}`)
    // The same declarations, but the fragment returns the DERIVED value source
    // itself instead of wrapping it in a `fragmentWithType`, so the argument's data
    // type also governs how the result is read back.
    derivedArgCentsRead = this.buildFragmentWithArgs(
        this.arg(CentsType, 'required', scaledByTypeName),
        this.arg(CentsType, 'required')
    ).as((v, col) => v.add(col))
    derivedArgMoneyRead = this.buildFragmentWithArgs(
        this.arg(MoneyRealsType, 'required', scaledByTypeName),
        this.arg(MoneyRealsType, 'required')
    ).as((v, col) => v.add(col))
    // The maybe-optional counterpart.
    derivedMaybeOptionalArgCents = this.buildFragmentWithMaybeOptionalArgs(
        this.arg(CentsType, 'optional', scaledByTypeName),
        this.arg(CentsType, 'optional')
    ).as((v, col) => this.fragmentWithType('int', 'optional').sql`${v.add(col).add(9)}`)
    // Inside an if-value builder the fragment is a predicate, so the extra
    // operand's marshalling is what records the argument's data type.
    derivedArgCentsIfValue = this.buildFragmentWithArgsIfValue(
        this.arg(CentsType, 'required', scaledByTypeName),
        this.arg(CentsType, 'required'),
        this.valueArg(CentsType, 'optional')
    ).as((v, col, limit) => v.add(col).add(9).greaterThan(limit))
    derivedValueArgCentsIfValue = this.buildFragmentWithArgsIfValue(
        this.arg(CentsType, 'required'),
        this.valueArg(CentsType, 'optional', scaledByTypeName)
    ).as((col, v) => v.add(col).add(9).greaterThan(col.multiply(20)))
    // The aggregate fragment builders over the same declarations.
    derivedAggArgCents = this.buildAggregateFragmentWithArgs(
        this.arg(CentsType, 'required', scaledByTypeName),
        this.arg(CentsType, 'required')
    ).as((v, col) => this.aggregateFragmentWithType('int', 'required').sql`sum(${v.add(col).add(9)})`)
    derivedAggMaybeOptionalArgMoney = this.buildAggregateFragmentWithMaybeOptionalArgs(
        this.arg(MoneyRealsType, 'optional', scaledByTypeName),
        this.arg(MoneyRealsType, 'optional')
    ).as((v, col) => this.aggregateFragmentWithType('double', 'optional').sql`sum(${v.add(col).add(9)})`)
    derivedAggValueArgCentsIfValue = this.buildAggregateFragmentWithArgsIfValue(
        this.arg(CentsType, 'required'),
        this.valueArg(CentsType, 'optional', scaledByTypeName)
    ).as((col, v) => this.aggregateFragmentWithType('boolean', 'required').sql`sum(${v.add(col).add(9)}) > sum(${col}) * 20`)

    // Custom-typed arguments WITHOUT an adapter: what observes the argument's own
    // data type here is the SQL the dialect emits for the derivation -- a modulo
    // over a fractional receiver needs a different form from an integer one -- not
    // a value transform. Both operands of the modulo are placeholders the dialect
    // casts for itself, so the emitted SQL stays portable.
    derivedArgMoneyModulo = this.buildFragmentWithArgs(
        this.arg(MoneyRealsType, 'required')
    ).as((v) => v.modulo(2))
    derivedAggArgMoneyModulo = this.buildAggregateFragmentWithArgs(
        this.arg(MoneyRealsType, 'required')
    ).as((v) => this.aggregateFragmentWithType('double', 'required').sql`sum(${v.modulo(2)})`)
    derivedValueArgMoneyModuloIfValue = this.buildFragmentWithArgsIfValue(
        this.valueArg(MoneyRealsType, 'optional')
    ).as((v) => v.modulo(2).lessThan(10))
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
// the matching `'enum'` / `'custom'` / `'ComparableType'` kind and the
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

// A single microsecond-precision localDateTime column. Its seed instant carries
// sub-millisecond fractional seconds (999600 µs) that no const receiver can reach
// — a JS Date only holds milliseconds — so it drives the plain-column arm of the
// date-part getters' sub-second truncation (see the temporal_precision comment in
// schema.sql). Exercised by select.value-source.column-temporal-subsecond-getters.
export const tTemporalPrecision = new class TTemporalPrecision extends Table<DBConnection, 'TTemporalPrecision'> {
    id         = this.primaryKey('id', 'int')
    microStamp = this.column('micro_stamp', 'localDateTime')
    constructor() { super('temporal_precision') }
}()

// The same temporal_precision and col_matrix columns read as Temporal values without zone (plainDate, plainTime,
// plainDateTime), which keep every digit of the fraction of a second the database has
export const tTemporalPrecisionPlain = new class TTemporalPrecisionPlain extends Table<DBConnection, 'TTemporalPrecisionPlain'> {
    id         = this.primaryKey('id', 'int')
    microStamp = this.column('micro_stamp', 'plainDateTime')
    constructor() { super('temporal_precision') }
}()
export const tColMatrixPlain = new class TColMatrixPlain extends Table<DBConnection, 'TColMatrixPlain'> {
    id        = this.primaryKey('id', 'int')
    mDate     = this.column('m_date', 'plainDate')
    mTime     = this.column('m_time', 'plainTime')
    mDatetime = this.column('m_datetime', 'plainDateTime')
    constructor() { super('col_matrix') }
}()

// The releases of project_release with their dates and times as Temporal values, the table tRelease of the page Dates and
// times (docs/configuration/dates-and-times.md)
export const tRelease = new class TRelease extends Table<DBConnection, 'TRelease'> {
    id          = this.autogeneratedPrimaryKey('id', 'int')
    version     = this.column('version', 'string')
    releasedOn  = this.column('released_on', 'plainDate')
    cutoffTime  = this.column('cutoff_time', 'plainTime')
    publishedAt = this.column('published_at', 'plainDateTime')
    rolloutTime = this.optionalColumn('rollout_time', 'duration')
    deployedAt = this.optionalColumn('deployed_at', 'instant')
    constructor() { super('project_release') }
}()

// duration_value: durations (Temporal.Duration) in the interval of the database, or its ISO 8601 text where it has none
// (span, span_calendar, which has years and months), and as its ISO 8601 text (span_text, declared a text)
export const tDurationValue = new class TDurationValue extends Table<DBConnection, 'TDurationValue'> {
    id           = this.primaryKey('id', 'int')
    span         = this.column('span', 'duration')
    spanCalendar = this.optionalColumn('span_calendar', 'duration')
    spanText     = this.optionalColumn('span_text', 'duration', withSqlDataType({ family: 'character string', length: 64 }))
    constructor() { super('duration_value') }
}()

// calendar_value: a month of a year (month_of, a plainYearMonth) and a day of a month (day_of, a plainMonthDay), kept in
// the date of their reference, and the date they are taken from (born_on, a plainDate)
export const tCalendarValue = new class TCalendarValue extends Table<DBConnection, 'TCalendarValue'> {
    id      = this.primaryKey('id', 'int')
    monthOf = this.column('month_of', 'plainYearMonth')
    dayOf   = this.column('day_of', 'plainMonthDay')
    bornOn  = this.column('born_on', 'plainDate')
    constructor() { super('calendar_value') }
}()

// zoned_value: exact moments in a time zone (Temporal.ZonedDateTime), kept as their RFC 9557 text (zoned_at), a wall
// clock to take to a zone (wall_at) and the name of a zone (zone_name).
export const tZonedValue = new class TZonedValue extends Table<DBConnection, 'TZonedValue'> {
    id       = this.primaryKey('id', 'int')
    zonedAt  = this.column('zoned_at', 'zonedDateTime')
    wallAt   = this.optionalColumn('wall_at', 'plainDateTime')
    zoneName = this.optionalColumn('zone_name', 'string')
    constructor() { super('zoned_value') }
}()

// instant_value: exact moments (Temporal.Instant) in the column recommended for an instant (instant_at), in a column
// without zone (wall_at) and in one converted with the zone of the session where the database has it (session_at)
export const tInstantValue = new class TInstantValue extends Table<DBConnection, 'TInstantValue'> {
    id        = this.primaryKey('id', 'int')
    instantAt = this.column('instant_at', 'instant')
    wallAt    = this.optionalColumn('wall_at', 'instant')
    sessionAt = this.optionalColumn('session_at', 'instant')
    constructor() { super('instant_value') }
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
    // The amount billed for the worklog — a branded RealsType ('Money',
    // marshalled to double). invoiced is a boolean stored as int 1/0 via the
    // NUMERIC CustomBooleanTypeAdapter overload.
    billedAmount = this.columnWithDefaultValue('billed_amount', MoneyRealsType)
    invoiced     = this.columnWithDefaultValue('invoiced', 'boolean', invoicedAdapter)
    // The internal cost of the worklog in integer cents — a branded
    // IntegersType ('Cents', marshalled to int).
    costCents    = this.columnWithDefaultValue('cost_cents', CentsType)
    activity   = this.column('activity', WorklogActivityType)
    // optionalVirtualColumnFromFragment on a Table (the optional
    // sibling of the required virtual column; no DB column — computed inline).
    activityUpper  = this.optionalVirtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.activity})`)
    // virtualColumnFromFragment with an explicit trailing TypeAdapter.
    activityTagged = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.activity})`, bracketAdapter)
    // Custom-kind virtualColumnFromFragment columns (the `(type, typeName, fn,
    // adapter?)` form that produces a branded value source). Computed inline (no DB
    // column). `centsFromId` is a REQUIRED branded IntegersType ('Cents', marshalled to
    // int): worklog id * 100. `centsFromIdOptional` is its optional sibling.
    // `activityCustomKind` is a string-backed type of the user (enum 'WorklogActivity').
    // `centsFromIdTagged` carries a trailing TypeAdapter (plusOffsetAdapter, read +1000).
    centsFromId         = this.virtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.id} * 100`)
    centsFromIdOptional = this.optionalVirtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.id} * 100`)
    activityCustomKind  = this.virtualColumnFromFragment(WorklogActivityType, (fragment) => fragment.sql`lower(${this.activity})`)
    centsFromIdTagged   = this.virtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.id} * 100`, plusOffsetAdapter)
    // The optional × own-kind × trailing-adapter triple: an OPTIONAL branded
    // IntegersType ('Cents', marshalled to int) virtual column (`id * 100`) carrying a
    // trailing TypeAdapter (plusOffsetAdapter, read +1000) — the optional sibling of
    // centsFromIdTagged and the adapter-bearing sibling of centsFromIdOptional.
    centsFromIdOptionalTagged = this.optionalVirtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.id} * 100`, plusOffsetAdapter)
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
    // Per-kind virtualColumnFromFragment fan-out (required + optional)
    // on a Table: each observes the DISTINCT read-path leaf type of its kind. The
    // fragment references an existing same-table typed column so the emitted SQL
    // is portable (a bare column ref or a portable expression). No DB column —
    // computed inline at query time.
    booleanVirtual           = this.virtualColumnFromFragment('boolean', (fragment) => fragment.sql`${this.billable}`)
    booleanVirtualOptional   = this.optionalVirtualColumnFromFragment('boolean', (fragment) => fragment.sql`${this.billable}`)
    bigintVirtual            = this.virtualColumnFromFragment('bigint', (fragment) => fragment.sql`${this.id}`)
    bigintVirtualOptional    = this.optionalVirtualColumnFromFragment('bigint', (fragment) => fragment.sql`${this.durationMs}`)
    doubleVirtual            = this.virtualColumnFromFragment('double', (fragment) => fragment.sql`${this.billedAmount}`)
    doubleVirtualOptional    = this.optionalVirtualColumnFromFragment('double', (fragment) => fragment.sql`${this.durationMs}`)
    localDateVirtual         = this.virtualColumnFromFragment('localDate', (fragment) => fragment.sql`${this.workDate}`)
    localDateVirtualOptional = this.optionalVirtualColumnFromFragment('localDate', (fragment) => fragment.sql`${this.workDate}`)
    localTimeVirtual         = this.virtualColumnFromFragment('localTime', (fragment) => fragment.sql`${this.startedAt}`)
    localTimeVirtualOptional = this.optionalVirtualColumnFromFragment('localTime', (fragment) => fragment.sql`${this.startedAt}`)
    intVirtual               = this.virtualColumnFromFragment('int', (fragment) => fragment.sql`${this.id} + 1`)
    intVirtualOptional       = this.optionalVirtualColumnFromFragment('int', (fragment) => fragment.sql`${this.minutes}`)
    ownDoubleVirtual         = this.virtualColumnFromFragment(MoneyRealsType, (fragment) => fragment.sql`${this.billedAmount}`)
    ownDoubleVirtualOptional = this.optionalVirtualColumnFromFragment(MoneyRealsType, (fragment) => fragment.sql`${this.billedAmount}`)
    constructor() { super('issue_worklog') }
}()

// A published release of a project: branded `ComparableType` version,
// `EqualableType` (equality-only) channel, optional `UuidsType` signing key,
// custom date/time columns, a DB-computed `notes` column (excluded from
// the writable shape) and a `virtualColumnFromFragment` on a writable
// table (isolates the computed/virtual exclusion against a non-empty
// writable surface).
export const tProjectRelease = new class TProjectRelease extends Table<DBConnection, 'TProjectRelease'> {
    id          = this.autogeneratedPrimaryKey('id', 'int')
    projectId   = this.column('project_id', 'int')
    version     = this.column('version', SemverType)
    channel     = this.column('channel', ReleaseChannelType)
    signingKey  = this.optionalColumn('signing_key', SigningKeyType)
    releasedOn  = this.column('released_on', ReleaseDayType)
    cutoffTime  = this.column('cutoff_time', CutoffClockType)
    signedOffAt = this.optionalColumn('signed_off_at', SignOffStampType)
    notes       = this.computedColumn('notes', 'string')
    versionTag  = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`upper(${this.channel})`)
    // A REQUIRED-on-read LocalDateTimesType column (branded
    // 'PublishStamp'). signedOffAt above is the OPTIONAL LocalDateTimesType;
    // this is its required-on-read twin, so the required-own-localDateTime
    // read getter is observed directly (it projects `Date`, not `Date |
    // undefined`). Declared columnWithDefaultValue (DB DEFAULT CURRENT_TIMESTAMP)
    // so it stays optional on INSERT — existing tProjectRelease INSERT tests that
    // don't enumerate it keep working. Added last to keep existing snapshots stable.
    publishedAt = this.columnWithDefaultValue('published_at', PublishStampType)
    // Per-kind virtualColumnFromFragment fan-out on a writable Table
    // carrying own-typed columns: the custom string/uuid/temporal kinds (and
    // the plain uuid / localDateTime kinds this table can source) that the
    // worklog fixture can't. required + optional; each references an existing
    // same-table typed column so the fragment SQL is portable.
    ownComparableVirtual         = this.virtualColumnFromFragment(SemverType, (fragment) => fragment.sql`${this.version}`)
    ownComparableVirtualOptional = this.optionalVirtualColumnFromFragment(SemverType, (fragment) => fragment.sql`${this.version}`)
    ownVirtual                   = this.virtualColumnFromFragment(ReleaseChannelType, (fragment) => fragment.sql`${this.channel}`)
    ownVirtualOptional           = this.optionalVirtualColumnFromFragment(ReleaseChannelType, (fragment) => fragment.sql`${this.channel}`)
    ownUuidVirtual               = this.virtualColumnFromFragment(SigningKeyType, (fragment) => fragment.sql`${this.signingKey}`)
    ownUuidVirtualOptional       = this.optionalVirtualColumnFromFragment(SigningKeyType, (fragment) => fragment.sql`${this.signingKey}`)
    ownLocalDateVirtual          = this.virtualColumnFromFragment(ReleaseDayType, (fragment) => fragment.sql`${this.releasedOn}`)
    ownLocalDateVirtualOptional  = this.optionalVirtualColumnFromFragment(ReleaseDayType, (fragment) => fragment.sql`${this.releasedOn}`)
    ownLocalTimeVirtual          = this.virtualColumnFromFragment(CutoffClockType, (fragment) => fragment.sql`${this.cutoffTime}`)
    ownLocalTimeVirtualOptional  = this.optionalVirtualColumnFromFragment(CutoffClockType, (fragment) => fragment.sql`${this.cutoffTime}`)
    ownLocalDateTimeVirtual         = this.virtualColumnFromFragment(PublishStampType, (fragment) => fragment.sql`${this.publishedAt}`)
    ownLocalDateTimeVirtualOptional = this.optionalVirtualColumnFromFragment(SignOffStampType, (fragment) => fragment.sql`${this.signedOffAt}`)
    uuidVirtual                     = this.virtualColumnFromFragment('uuid', (fragment) => fragment.sql`${this.signingKey}`)
    uuidVirtualOptional             = this.optionalVirtualColumnFromFragment('uuid', (fragment) => fragment.sql`${this.signingKey}`)
    localDateTimeVirtual            = this.virtualColumnFromFragment('localDateTime', (fragment) => fragment.sql`${this.publishedAt}`)
    localDateTimeVirtualOptional    = this.optionalVirtualColumnFromFragment('localDateTime', (fragment) => fragment.sql`${this.signedOffAt}`)
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
// ValueSource dispatch (custom / own-date-time / optional / virtual)
// on a View source instead of a Table.
export const vReleaseOverview = new class VReleaseOverview extends View<DBConnection, 'VReleaseOverview'> {
    id           = this.column('id', 'int')
    projectId    = this.column('project_id', 'int')
    version      = this.column('version', SemverType)
    releasedOn   = this.column('released_on', ReleaseDayType)
    signedOffAt  = this.optionalColumn('signed_off_at', SignOffStampType)
    projectName  = this.column('project_name', 'string')
    // An adapter-bearing VIEW column — `versionBracketed` carries the
    // trailing TypeAdapter `bracketAdapter` (read wraps the value in [...]). No
    // other View column in any dialect carries an adapter, so the read of a
    // View column through its adapter is otherwise never observed.
    versionBracketed = this.column('version_bracketed', 'string', bracketAdapter)
    // A LocalTimesType VIEW column — the View side of the
    // LocalTimesType kind (Table side is tProjectRelease.cutoffTime). Maps the
    // release's cutoff_time through the view.
    cutoffClock  = this.column('cutoff_clock', CutoffClockType)
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
    // branded IntegersType ('Cents', marshalled to int), computed as release id * 10.
    centsFromId         = this.virtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.id} * 10`)
    centsFromIdOptional = this.optionalVirtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.id} * 10`)
    // Per-kind PLAIN read marshalling on a View: boolean/bigint/double are backed by
    // project_release base columns; uuid reuses signing_key; localDate/localTime reuse
    // released_on/cutoff_time (also mapped as their own-branded twins above); the
    // own-kind + trailing-adapter column maps id through plusOffsetAdapter (read +1000).
    isSigned        = this.optionalColumn('is_signed', 'boolean')
    downloadCount   = this.optionalColumn('download_count', 'bigint')
    avgRating       = this.optionalColumn('avg_rating', 'double')
    signingUuid     = this.optionalColumn('signing_uuid', 'uuid')
    releaseDayPlain = this.column('release_day_plain', 'localDate')
    cutoffPlain     = this.column('cutoff_plain', 'localTime')
    releaseOrdinal  = this.column('release_ordinal', ReleaseTagType, plusOffsetAdapter)
    // A nullable own-kind (IntegersType / ReleaseTag) VIEW column carrying a
    // trailing TypeAdapter (plusOffsetAdapter, read +1000). The view computes it
    // as the release id when download_count is present, else NULL.
    optionalReleaseOrdinal = this.optionalColumn('optional_release_ordinal', ReleaseTagType, plusOffsetAdapter)
    // A REQUIRED plain localDateTime View column and its REQUIRED
    // LocalDateTimesType ('PublishStamp') twin — both surface the release's
    // published_at through the view, so the required-on-read localDateTime getter
    // surface is observed on a View source (the optional archivedAt View getters
    // and the Table-side publishedAt are the other sides).
    publishStampPlain = this.column('published_stamp_plain', 'localDateTime')
    publishStamp      = this.column('published_stamp', PublishStampType)
    // Per-kind virtualColumnFromFragment fan-out on a View source
    // (required + optional). The View exposes typed columns of every kind, so
    // each virtual column references a same-view column of the matching kind and
    // observes the distinct read-path leaf type on a View instead of a Table.
    booleanVirtual           = this.virtualColumnFromFragment('boolean', (fragment) => fragment.sql`${this.isSigned}`)
    booleanVirtualOptional   = this.optionalVirtualColumnFromFragment('boolean', (fragment) => fragment.sql`${this.isSigned}`)
    bigintVirtual            = this.virtualColumnFromFragment('bigint', (fragment) => fragment.sql`${this.id}`)
    bigintVirtualOptional    = this.optionalVirtualColumnFromFragment('bigint', (fragment) => fragment.sql`${this.downloadCount}`)
    doubleVirtual            = this.virtualColumnFromFragment('double', (fragment) => fragment.sql`${this.avgRating}`)
    doubleVirtualOptional    = this.optionalVirtualColumnFromFragment('double', (fragment) => fragment.sql`${this.avgRating}`)
    uuidVirtual              = this.virtualColumnFromFragment('uuid', (fragment) => fragment.sql`${this.signingUuid}`)
    uuidVirtualOptional      = this.optionalVirtualColumnFromFragment('uuid', (fragment) => fragment.sql`${this.signingUuid}`)
    localDateVirtual         = this.virtualColumnFromFragment('localDate', (fragment) => fragment.sql`${this.releaseDayPlain}`)
    localDateVirtualOptional = this.optionalVirtualColumnFromFragment('localDate', (fragment) => fragment.sql`${this.releaseDayPlain}`)
    localTimeVirtual         = this.virtualColumnFromFragment('localTime', (fragment) => fragment.sql`${this.cutoffPlain}`)
    localTimeVirtualOptional = this.optionalVirtualColumnFromFragment('localTime', (fragment) => fragment.sql`${this.cutoffPlain}`)
    localDateTimeVirtual         = this.virtualColumnFromFragment('localDateTime', (fragment) => fragment.sql`${this.publishStampPlain}`)
    localDateTimeVirtualOptional = this.optionalVirtualColumnFromFragment('localDateTime', (fragment) => fragment.sql`${this.signedOffAt}`)
    intVirtual               = this.virtualColumnFromFragment('int', (fragment) => fragment.sql`${this.id} + 1`)
    intVirtualOptional       = this.optionalVirtualColumnFromFragment('int', (fragment) => fragment.sql`${this.id}`)
    ownComparableVirtual         = this.virtualColumnFromFragment(SemverType, (fragment) => fragment.sql`${this.version}`)
    ownComparableVirtualOptional = this.optionalVirtualColumnFromFragment(SemverType, (fragment) => fragment.sql`${this.version}`)
    ownUuidVirtual               = this.virtualColumnFromFragment(SigningKeyType, (fragment) => fragment.sql`${this.signingUuid}`)
    ownUuidVirtualOptional       = this.optionalVirtualColumnFromFragment(SigningKeyType, (fragment) => fragment.sql`${this.signingUuid}`)
    ownLocalDateVirtual          = this.virtualColumnFromFragment(ReleaseDayType, (fragment) => fragment.sql`${this.releaseDayPlain}`)
    ownLocalDateVirtualOptional  = this.optionalVirtualColumnFromFragment(ReleaseDayType, (fragment) => fragment.sql`${this.releaseDayPlain}`)
    ownLocalTimeVirtual          = this.virtualColumnFromFragment(CutoffClockType, (fragment) => fragment.sql`${this.cutoffPlain}`)
    ownLocalTimeVirtualOptional  = this.optionalVirtualColumnFromFragment(CutoffClockType, (fragment) => fragment.sql`${this.cutoffPlain}`)
    ownLocalDateTimeVirtual         = this.virtualColumnFromFragment(PublishStampType, (fragment) => fragment.sql`${this.publishStampPlain}`)
    ownLocalDateTimeVirtualOptional = this.optionalVirtualColumnFromFragment(SignOffStampType, (fragment) => fragment.sql`${this.signedOffAt}`)
    ownDoubleVirtual         = this.virtualColumnFromFragment(MoneyRealsType, (fragment) => fragment.sql`${this.avgRating}`)
    ownDoubleVirtualOptional = this.optionalVirtualColumnFromFragment(MoneyRealsType, (fragment) => fragment.sql`${this.avgRating}`)
    constructor() { super('release_overview') }
}()

// A table whose primary key is drawn from a named DB sequence via
// autogeneratedPrimaryKeyBySequence (typed only on mariaDB / oracle /
// postgreSql / sqlServer) — distinct from the autogenerated IDENTITY/SERIAL
// PK the engine fills implicitly. Reuses the existing audit_tag_seq sequence.
export const tAuditEntry = new class TAuditEntry extends Table<DBConnection, 'TAuditEntry'> {
    // The autogeneratedPrimaryKeyBySequence trailing-TypeAdapter
    // overload — plusOffsetAdapter (read +1000) so the DB-generated id surfaces
    // offset. Typed only on mariaDB/oracle/postgreSql/sqlServer; mysql/sqlite
    // don't declare tAuditEntry (the method is not on their connection type).
    id     = this.autogeneratedPrimaryKeyBySequence('id', 'audit_tag_seq', 'int', plusOffsetAdapter)
    action = this.column('action', 'string')
    constructor() { super('audit_entry') }
}()

// The autogeneratedPrimaryKeyBySequence NO-ADAPTER overload — the DB-generated id
// surfaces RAW, in contrast to tAuditEntry above whose id carries plusOffsetAdapter
// (read +1000). Reuses the same audit_entry table + audit_tag_seq sequence. Typed
// only on mariaDB/oracle/postgreSql/sqlServer; mysql/sqlite don't declare it.
export const tAuditEntryNoAdapter = new class TAuditEntryNoAdapter extends Table<DBConnection, 'TAuditEntryNoAdapter'> {
    id     = this.autogeneratedPrimaryKeyBySequence('id', 'audit_tag_seq', 'int')
    action = this.column('action', 'string')
    constructor() { super('audit_entry') }
}()


// Enum used by tWebhookEvent.eventType's columnWithDefaultValue.
export type WebhookEventType = 'created' | 'updated' | 'deleted'

// A Table whose autogeneratedPrimaryKey is a bigint (the other tables use an
// int IDENTITY/SERIAL PK).
export const tWebhookEvent = new class TWebhookEvent extends Table<DBConnection, 'TWebhookEvent'> {
    id        = this.autogeneratedPrimaryKey('id', 'bigint')
    issueId   = this.column('issue_id', 'int')
    // columnWithDefaultValue on an `enum` column (with a DB DEFAULT).
    eventType = this.columnWithDefaultValue('event_type', WebhookEventEnumType)
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
// the bare-base enum/custom/ComparableType leaves. The required siblings
// live on tIssueWorklog.activity / tProjectRelease.channel / tProjectRelease.version;
// here `stage` (enum), `channel` (custom, reusing ReleaseChannel) and `minVersion`
// (ComparableType, reusing the Semver typeName) are nullable, so a draft that has
// not decided them yet leaves them NULL — letting valueWhenNull / nullIfValue /
// isNull observe the real NULL branch. A caller-provided int PK (no identity) keeps
// the per-dialect reset trivial.
export type ReleaseStage = 'draft' | 'candidate' | 'final'
export const tReleaseDraft = new class TReleaseDraft extends Table<DBConnection, 'TReleaseDraft'> {
    id         = this.primaryKey('id', 'int')
    title      = this.column('title', 'string')
    stage      = this.optionalColumn('stage', ReleaseStageType)
    channel    = this.optionalColumn('channel', ReleaseChannelType)
    minVersion = this.optionalColumn('min_version', SemverType)
    // Optional own-kind columns (RealsType 'Money', LocalDatesType
    // 'ReleaseDay', LocalTimesType 'CutoffClock') so isNull / isNotNull reach a
    // realizable NULL branch on these kinds. Draft 2 leaves them NULL.
    budget     = this.optionalColumn('budget', MoneyRealsType)
    targetDay  = this.optionalColumn('target_day', ReleaseDayType)
    cutoff     = this.optionalColumn('cutoff', CutoffClockType)
    // Trailing-TypeAdapter ([a2] slot) on Table columns of each remaining kind —
    // no other Table column factory carries a own-kind trailing adapter. Each
    // is a columnWithDefaultValue reading its DB DEFAULT through the adapter, so
    // the adapter's read effect is observable: the numeric kinds scale/shift, the
    // string kinds bracket, the LocalDateTimesType shifts +1h.
    scaledCost      = this.columnWithDefaultValue('scaled_cost', CentsType, scaledTenthAdapter)
    shiftedAmount   = this.columnWithDefaultValue('shifted_amount', MoneyRealsType, plusOffsetAdapter)
    bracketVersion  = this.columnWithDefaultValue('bracket_version', SemverType, bracketAdapter)
    bracketChannel  = this.columnWithDefaultValue('bracket_channel', ReleaseChannelType, bracketAdapter)
    bracketActivity = this.columnWithDefaultValue('bracket_activity', WorklogActivityType, bracketAdapter)
    shiftedStamp    = this.columnWithDefaultValue('shifted_stamp', PublishStampType, shiftHourAdapter)
    shiftedCount    = this.columnWithDefaultValue('shifted_count', 'bigint', plusThousandBigintAdapter)
    shiftedRating   = this.columnWithDefaultValue('shifted_rating', 'double', plusOffsetAdapter)
    // UuidsType / LocalDatesType / LocalTimesType columns carrying a trailing
    // TypeAdapter, each reading its DB DEFAULT through the adapter (uuid bracketed;
    // date/time shifted +1h on read).
    bracketSigningKey = this.columnWithDefaultValue('bracket_signing_key', SigningKeyType, bracketAdapter)
    shiftedReleaseDay = this.columnWithDefaultValue('shifted_release_day', ReleaseDayType, shiftHourAdapter)
    shiftedCutoff     = this.columnWithDefaultValue('shifted_cutoff', CutoffClockType, shiftHourAdapter)
    constructor() { super('release_draft') }
}()

// Non-virtual column-factory fan-out per data type. `col_matrix`
// holds one plain, NOT NULL column per base data type; each tColMatrix* Table below
// reads those SAME columns through a DIFFERENT column factory, and vColMatrix
// does so through the View factories. The optionality / default / computed /
// primary-key distinction each factory encodes is TYPE-LEVEL only, so every
// factory reads each data type the same way on a
// single plain row — the read SQL/value coincides, the typed path does not.
// The data types of the user reuse the domain's registered typeNames (Cents / Money /
// SigningKey / Semver / ReleaseChannel / ReleaseDay / CutoffClock / SignOffStamp
// via baseTypeForCustom; enum WorklogActivity).

// `column(...)` (required) per kind.
export const tColMatrixColumn = new class TColMatrixColumn extends Table<DBConnection, 'TColMatrixColumn'> {
    id          = this.primaryKey('id', 'int')
    mInt        = this.column('m_int', 'int')
    mBigint     = this.column('m_bigint', 'bigint')
    mDouble     = this.column('m_double', 'double')
    mBool       = this.column('m_bool', 'boolean')
    mUuid       = this.column('m_uuid', 'uuid')
    mDate       = this.column('m_date', 'localDate')
    mTime       = this.column('m_time', 'localTime')
    mDatetime   = this.column('m_datetime', 'localDateTime')
    mStr        = this.column('m_str', 'string')
    cents       = this.column('m_int', CentsType)
    money       = this.column('m_double', MoneyRealsType)
    signingKey  = this.column('m_uuid', SigningKeyType)
    semver      = this.column('m_str', SemverType)
    channel     = this.column('m_str', ReleaseChannelType)
    releaseDay  = this.column('m_date', ReleaseDayType)
    cutoffClock = this.column('m_time', CutoffClockType)
    signOff     = this.column('m_datetime', SignOffStampType)
    activity    = this.column('m_str', WorklogActivityType)
    constructor() { super('col_matrix') }
}()

// `optionalColumn(...)` (optional) per kind. `id` stays a required primaryKey so
// the projected object keeps a required field (optional leaves read `?: T`).
export const tColMatrixOptional = new class TColMatrixOptional extends Table<DBConnection, 'TColMatrixOptional'> {
    id          = this.primaryKey('id', 'int')
    mInt        = this.optionalColumn('m_int', 'int')
    mBigint     = this.optionalColumn('m_bigint', 'bigint')
    mDouble     = this.optionalColumn('m_double', 'double')
    mBool       = this.optionalColumn('m_bool', 'boolean')
    mUuid       = this.optionalColumn('m_uuid', 'uuid')
    mDate       = this.optionalColumn('m_date', 'localDate')
    mTime       = this.optionalColumn('m_time', 'localTime')
    mDatetime   = this.optionalColumn('m_datetime', 'localDateTime')
    mStr        = this.optionalColumn('m_str', 'string')
    cents       = this.optionalColumn('m_int', CentsType)
    money       = this.optionalColumn('m_double', MoneyRealsType)
    signingKey  = this.optionalColumn('m_uuid', SigningKeyType)
    semver      = this.optionalColumn('m_str', SemverType)
    channel     = this.optionalColumn('m_str', ReleaseChannelType)
    releaseDay  = this.optionalColumn('m_date', ReleaseDayType)
    cutoffClock = this.optionalColumn('m_time', CutoffClockType)
    signOff     = this.optionalColumn('m_datetime', SignOffStampType)
    activity    = this.optionalColumn('m_str', WorklogActivityType)
    constructor() { super('col_matrix') }
}()

// `columnWithDefaultValue(...)` (required on read, omittable on insert) per kind.
export const tColMatrixDefault = new class TColMatrixDefault extends Table<DBConnection, 'TColMatrixDefault'> {
    id          = this.primaryKey('id', 'int')
    mInt        = this.columnWithDefaultValue('m_int', 'int')
    mBigint     = this.columnWithDefaultValue('m_bigint', 'bigint')
    mDouble     = this.columnWithDefaultValue('m_double', 'double')
    mBool       = this.columnWithDefaultValue('m_bool', 'boolean')
    mUuid       = this.columnWithDefaultValue('m_uuid', 'uuid')
    mDate       = this.columnWithDefaultValue('m_date', 'localDate')
    mTime       = this.columnWithDefaultValue('m_time', 'localTime')
    mDatetime   = this.columnWithDefaultValue('m_datetime', 'localDateTime')
    mStr        = this.columnWithDefaultValue('m_str', 'string')
    cents       = this.columnWithDefaultValue('m_int', CentsType)
    money       = this.columnWithDefaultValue('m_double', MoneyRealsType)
    signingKey  = this.columnWithDefaultValue('m_uuid', SigningKeyType)
    semver      = this.columnWithDefaultValue('m_str', SemverType)
    channel     = this.columnWithDefaultValue('m_str', ReleaseChannelType)
    releaseDay  = this.columnWithDefaultValue('m_date', ReleaseDayType)
    cutoffClock = this.columnWithDefaultValue('m_time', CutoffClockType)
    signOff     = this.columnWithDefaultValue('m_datetime', SignOffStampType)
    activity    = this.columnWithDefaultValue('m_str', WorklogActivityType)
    constructor() { super('col_matrix') }
}()

// `optionalColumnWithDefaultValue(...)` (optional on read, omittable on insert) per kind.
export const tColMatrixOptionalDefault = new class TColMatrixOptionalDefault extends Table<DBConnection, 'TColMatrixOptionalDefault'> {
    id          = this.primaryKey('id', 'int')
    mInt        = this.optionalColumnWithDefaultValue('m_int', 'int')
    mBigint     = this.optionalColumnWithDefaultValue('m_bigint', 'bigint')
    mDouble     = this.optionalColumnWithDefaultValue('m_double', 'double')
    mBool       = this.optionalColumnWithDefaultValue('m_bool', 'boolean')
    mUuid       = this.optionalColumnWithDefaultValue('m_uuid', 'uuid')
    mDate       = this.optionalColumnWithDefaultValue('m_date', 'localDate')
    mTime       = this.optionalColumnWithDefaultValue('m_time', 'localTime')
    mDatetime   = this.optionalColumnWithDefaultValue('m_datetime', 'localDateTime')
    mStr        = this.optionalColumnWithDefaultValue('m_str', 'string')
    cents       = this.optionalColumnWithDefaultValue('m_int', CentsType)
    money       = this.optionalColumnWithDefaultValue('m_double', MoneyRealsType)
    signingKey  = this.optionalColumnWithDefaultValue('m_uuid', SigningKeyType)
    semver      = this.optionalColumnWithDefaultValue('m_str', SemverType)
    channel     = this.optionalColumnWithDefaultValue('m_str', ReleaseChannelType)
    releaseDay  = this.optionalColumnWithDefaultValue('m_date', ReleaseDayType)
    cutoffClock = this.optionalColumnWithDefaultValue('m_time', CutoffClockType)
    signOff     = this.optionalColumnWithDefaultValue('m_datetime', SignOffStampType)
    activity    = this.optionalColumnWithDefaultValue('m_str', WorklogActivityType)
    constructor() { super('col_matrix') }
}()

// `computedColumn(...)` (required on read, excluded from the writable shape) per kind.
export const tColMatrixComputed = new class TColMatrixComputed extends Table<DBConnection, 'TColMatrixComputed'> {
    id          = this.primaryKey('id', 'int')
    mInt        = this.computedColumn('m_int', 'int')
    mBigint     = this.computedColumn('m_bigint', 'bigint')
    mDouble     = this.computedColumn('m_double', 'double')
    mBool       = this.computedColumn('m_bool', 'boolean')
    mUuid       = this.computedColumn('m_uuid', 'uuid')
    mDate       = this.computedColumn('m_date', 'localDate')
    mTime       = this.computedColumn('m_time', 'localTime')
    mDatetime   = this.computedColumn('m_datetime', 'localDateTime')
    mStr        = this.computedColumn('m_str', 'string')
    cents       = this.computedColumn('m_int', CentsType)
    money       = this.computedColumn('m_double', MoneyRealsType)
    signingKey  = this.computedColumn('m_uuid', SigningKeyType)
    semver      = this.computedColumn('m_str', SemverType)
    channel     = this.computedColumn('m_str', ReleaseChannelType)
    releaseDay  = this.computedColumn('m_date', ReleaseDayType)
    cutoffClock = this.computedColumn('m_time', CutoffClockType)
    signOff     = this.computedColumn('m_datetime', SignOffStampType)
    activity    = this.computedColumn('m_str', WorklogActivityType)
    constructor() { super('col_matrix') }
}()

// `optionalComputedColumn(...)` (optional on read, excluded from the writable shape) per kind.
export const tColMatrixOptionalComputed = new class TColMatrixOptionalComputed extends Table<DBConnection, 'TColMatrixOptionalComputed'> {
    id          = this.primaryKey('id', 'int')
    mInt        = this.optionalComputedColumn('m_int', 'int')
    mBigint     = this.optionalComputedColumn('m_bigint', 'bigint')
    mDouble     = this.optionalComputedColumn('m_double', 'double')
    mBool       = this.optionalComputedColumn('m_bool', 'boolean')
    mUuid       = this.optionalComputedColumn('m_uuid', 'uuid')
    mDate       = this.optionalComputedColumn('m_date', 'localDate')
    mTime       = this.optionalComputedColumn('m_time', 'localTime')
    mDatetime   = this.optionalComputedColumn('m_datetime', 'localDateTime')
    mStr        = this.optionalComputedColumn('m_str', 'string')
    cents       = this.optionalComputedColumn('m_int', CentsType)
    money       = this.optionalComputedColumn('m_double', MoneyRealsType)
    signingKey  = this.optionalComputedColumn('m_uuid', SigningKeyType)
    semver      = this.optionalComputedColumn('m_str', SemverType)
    channel     = this.optionalComputedColumn('m_str', ReleaseChannelType)
    releaseDay  = this.optionalComputedColumn('m_date', ReleaseDayType)
    cutoffClock = this.optionalComputedColumn('m_time', CutoffClockType)
    signOff     = this.optionalComputedColumn('m_datetime', SignOffStampType)
    activity    = this.optionalComputedColumn('m_str', WorklogActivityType)
    constructor() { super('col_matrix') }
}()

// `primaryKey(...)` per COMPARABLE kind (primaryKey needs a comparable kind — no
// boolean/temporal-custom arms here). A caller-provided composite PK across
// int/string/uuid/bigint columns; only the read path is observed.
export const tColMatrixPk = new class TColMatrixPk extends Table<DBConnection, 'TColMatrixPk'> {
    id       = this.primaryKey('m_int', 'int')
    strPk    = this.primaryKey('m_str', 'string')
    uuidPk   = this.primaryKey('m_uuid', 'uuid')
    bigintPk = this.primaryKey('m_bigint', 'bigint')
    constructor() { super('col_matrix') }
}()

// View side: the View `column(...)` (required, prefix-free names) and
// `optionalColumn(...)` (optional, `o`-prefixed names) factories per kind, over
// the col_matrix_view DB view.
export const vColMatrix = new class VColMatrix extends View<DBConnection, 'VColMatrix'> {
    id           = this.column('id', 'int')
    mInt         = this.column('m_int', 'int')
    mBigint      = this.column('m_bigint', 'bigint')
    mDouble      = this.column('m_double', 'double')
    mBool        = this.column('m_bool', 'boolean')
    mUuid        = this.column('m_uuid', 'uuid')
    mDate        = this.column('m_date', 'localDate')
    mTime        = this.column('m_time', 'localTime')
    mDatetime    = this.column('m_datetime', 'localDateTime')
    mStr         = this.column('m_str', 'string')
    cents        = this.column('m_int', CentsType)
    money        = this.column('m_double', MoneyRealsType)
    signingKey   = this.column('m_uuid', SigningKeyType)
    semver       = this.column('m_str', SemverType)
    channel      = this.column('m_str', ReleaseChannelType)
    releaseDay   = this.column('m_date', ReleaseDayType)
    cutoffClock  = this.column('m_time', CutoffClockType)
    signOff      = this.column('m_datetime', SignOffStampType)
    activity     = this.column('m_str', WorklogActivityType)
    oInt         = this.optionalColumn('m_int', 'int')
    oBigint      = this.optionalColumn('m_bigint', 'bigint')
    oDouble      = this.optionalColumn('m_double', 'double')
    oBool        = this.optionalColumn('m_bool', 'boolean')
    oUuid        = this.optionalColumn('m_uuid', 'uuid')
    oDate        = this.optionalColumn('m_date', 'localDate')
    oTime        = this.optionalColumn('m_time', 'localTime')
    oDatetime    = this.optionalColumn('m_datetime', 'localDateTime')
    oStr         = this.optionalColumn('m_str', 'string')
    oCents       = this.optionalColumn('m_int', CentsType)
    oMoney       = this.optionalColumn('m_double', MoneyRealsType)
    oSigningKey  = this.optionalColumn('m_uuid', SigningKeyType)
    oSemver      = this.optionalColumn('m_str', SemverType)
    oChannel     = this.optionalColumn('m_str', ReleaseChannelType)
    oReleaseDay  = this.optionalColumn('m_date', ReleaseDayType)
    oCutoffClock = this.optionalColumn('m_time', CutoffClockType)
    oSignOff     = this.optionalColumn('m_datetime', SignOffStampType)
    oActivity    = this.optionalColumn('m_str', WorklogActivityType)
    constructor() { super('col_matrix_view') }
}()

// The trailing-`adapter` overload of each
// non-virtual column factory is a DISTINCT typed path from the no-adapter form.
// Each tColMatrix*Adapter class reads the SAME col_matrix columns through the
// factory's trailing-TypeAdapter overload; the adapter's transformValueFromDB
// performs an OBSERVABLE read transform per kind (numeric ×10, bigint ×10n,
// boolean negate, uuid lowercase+bracket, string bracket, Date +1h), so the
// projected VALUE differs from the raw seed while the leaf TYPE is unchanged.
// `transformValueToDB` delegates to `next`, so writes/placeholders are untouched.
// The adapters are local to keep this block self-contained + verbatim per dialect.
const colMatrixNumberX10: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return typeof v === 'number' ? v * 10 : v
    },
    transformValueToDB(value, context, next) { return next.transformValueToDB(value, context) },
}
const colMatrixBigintX10: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return typeof v === 'bigint' ? v * 10n : v
    },
    transformValueToDB(value, context, next) { return next.transformValueToDB(value, context) },
}
const colMatrixBoolNegate: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return typeof v === 'boolean' ? !v : v
    },
    transformValueToDB(value, context, next) { return next.transformValueToDB(value, context) },
}
const colMatrixStringBracket: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return typeof v === 'string' ? '[' + v + ']' : v
    },
    transformValueToDB(value, context, next) { return next.transformValueToDB(value, context) },
}
// uuid reads are lowercased before bracketing so the assertion is stable on
// engines that may echo a uuid in a different case (e.g. SQL Server).
const colMatrixUuidBracket: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return typeof v === 'string' ? '[' + v.toLowerCase() + ']' : v
    },
    transformValueToDB(value, context, next) { return next.transformValueToDB(value, context) },
}
const colMatrixShiftHour: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        const v = next.transformValueFromDB(value, context)
        return v instanceof Date ? new Date(v.getTime() + 3600000) : v
    },
    transformValueToDB(value, context, next) { return next.transformValueToDB(value, context) },
}


// `column(name, kind, adapter)` — the trailing-adapter overload (required).
export const tColMatrixColumnAdapter = new class TColMatrixColumnAdapter extends Table<DBConnection, 'TColMatrixColumnAdapter'> {
    id          = this.primaryKey('id', 'int')
    mInt        = this.column('m_int', 'int', colMatrixNumberX10)
    mBigint     = this.column('m_bigint', 'bigint', colMatrixBigintX10)
    mDouble     = this.column('m_double', 'double', colMatrixNumberX10)
    mBool       = this.column('m_bool', 'boolean', colMatrixBoolNegate)
    mUuid       = this.column('m_uuid', 'uuid', colMatrixUuidBracket)
    mDate       = this.column('m_date', 'localDate', colMatrixShiftHour)
    mTime       = this.column('m_time', 'localTime', colMatrixShiftHour)
    mDatetime   = this.column('m_datetime', 'localDateTime', colMatrixShiftHour)
    mStr        = this.column('m_str', 'string', colMatrixStringBracket)
    cents       = this.column('m_int', CentsType, colMatrixNumberX10)
    money       = this.column('m_double', MoneyRealsType, colMatrixNumberX10)
    signingKey  = this.column('m_uuid', SigningKeyType, colMatrixUuidBracket)
    semver      = this.column('m_str', SemverType, colMatrixStringBracket)
    channel     = this.column('m_str', ReleaseChannelType, colMatrixStringBracket)
    releaseDay  = this.column('m_date', ReleaseDayType, colMatrixShiftHour)
    cutoffClock = this.column('m_time', CutoffClockType, colMatrixShiftHour)
    signOff     = this.column('m_datetime', SignOffStampType, colMatrixShiftHour)
    activity    = this.column('m_str', WorklogActivityType, colMatrixStringBracket)
    constructor() { super('col_matrix') }
}()

// `optionalColumn(name, kind, adapter)` — optional; `?: T` leaves.
export const tColMatrixOptionalAdapter = new class TColMatrixOptionalAdapter extends Table<DBConnection, 'TColMatrixOptionalAdapter'> {
    id          = this.primaryKey('id', 'int')
    mInt        = this.optionalColumn('m_int', 'int', colMatrixNumberX10)
    mBigint     = this.optionalColumn('m_bigint', 'bigint', colMatrixBigintX10)
    mDouble     = this.optionalColumn('m_double', 'double', colMatrixNumberX10)
    mBool       = this.optionalColumn('m_bool', 'boolean', colMatrixBoolNegate)
    mUuid       = this.optionalColumn('m_uuid', 'uuid', colMatrixUuidBracket)
    mDate       = this.optionalColumn('m_date', 'localDate', colMatrixShiftHour)
    mTime       = this.optionalColumn('m_time', 'localTime', colMatrixShiftHour)
    mDatetime   = this.optionalColumn('m_datetime', 'localDateTime', colMatrixShiftHour)
    mStr        = this.optionalColumn('m_str', 'string', colMatrixStringBracket)
    cents       = this.optionalColumn('m_int', CentsType, colMatrixNumberX10)
    money       = this.optionalColumn('m_double', MoneyRealsType, colMatrixNumberX10)
    signingKey  = this.optionalColumn('m_uuid', SigningKeyType, colMatrixUuidBracket)
    semver      = this.optionalColumn('m_str', SemverType, colMatrixStringBracket)
    channel     = this.optionalColumn('m_str', ReleaseChannelType, colMatrixStringBracket)
    releaseDay  = this.optionalColumn('m_date', ReleaseDayType, colMatrixShiftHour)
    cutoffClock = this.optionalColumn('m_time', CutoffClockType, colMatrixShiftHour)
    signOff     = this.optionalColumn('m_datetime', SignOffStampType, colMatrixShiftHour)
    activity    = this.optionalColumn('m_str', WorklogActivityType, colMatrixStringBracket)
    constructor() { super('col_matrix') }
}()

// `columnWithDefaultValue(name, kind, adapter)` — required on read.
// View `column`/`optionalColumn` WITH a trailing TypeAdapter per kind — the View
// analog of tColMatrixColumnAdapter / tColMatrixOptionalAdapter. Same read
// SQL/value as the no-adapter vColMatrix; the adapter runs on transformValueFromDB
// (numeric ×10, bigint ×10n, boolean negate, uuid lowercase+bracket, string
// bracket, Date +1h). Exercises the View column-factory trailing-adapter overload.
export const vColMatrixAdapter = new class VColMatrixAdapter extends View<DBConnection, 'VColMatrixAdapter'> {
    id           = this.column('id', 'int')
    mInt         = this.column('m_int', 'int', colMatrixNumberX10)
    mBigint      = this.column('m_bigint', 'bigint', colMatrixBigintX10)
    mDouble      = this.column('m_double', 'double', colMatrixNumberX10)
    mBool        = this.column('m_bool', 'boolean', colMatrixBoolNegate)
    mUuid        = this.column('m_uuid', 'uuid', colMatrixUuidBracket)
    mDate        = this.column('m_date', 'localDate', colMatrixShiftHour)
    mTime        = this.column('m_time', 'localTime', colMatrixShiftHour)
    mDatetime    = this.column('m_datetime', 'localDateTime', colMatrixShiftHour)
    mStr         = this.column('m_str', 'string', colMatrixStringBracket)
    cents        = this.column('m_int', CentsType, colMatrixNumberX10)
    money        = this.column('m_double', MoneyRealsType, colMatrixNumberX10)
    signingKey   = this.column('m_uuid', SigningKeyType, colMatrixUuidBracket)
    semver       = this.column('m_str', SemverType, colMatrixStringBracket)
    channel      = this.column('m_str', ReleaseChannelType, colMatrixStringBracket)
    releaseDay   = this.column('m_date', ReleaseDayType, colMatrixShiftHour)
    cutoffClock  = this.column('m_time', CutoffClockType, colMatrixShiftHour)
    signOff      = this.column('m_datetime', SignOffStampType, colMatrixShiftHour)
    activity     = this.column('m_str', WorklogActivityType, colMatrixStringBracket)
    oInt         = this.optionalColumn('m_int', 'int', colMatrixNumberX10)
    oBigint      = this.optionalColumn('m_bigint', 'bigint', colMatrixBigintX10)
    oDouble      = this.optionalColumn('m_double', 'double', colMatrixNumberX10)
    oBool        = this.optionalColumn('m_bool', 'boolean', colMatrixBoolNegate)
    oUuid        = this.optionalColumn('m_uuid', 'uuid', colMatrixUuidBracket)
    oDate        = this.optionalColumn('m_date', 'localDate', colMatrixShiftHour)
    oTime        = this.optionalColumn('m_time', 'localTime', colMatrixShiftHour)
    oDatetime    = this.optionalColumn('m_datetime', 'localDateTime', colMatrixShiftHour)
    oStr         = this.optionalColumn('m_str', 'string', colMatrixStringBracket)
    oCents       = this.optionalColumn('m_int', CentsType, colMatrixNumberX10)
    oMoney       = this.optionalColumn('m_double', MoneyRealsType, colMatrixNumberX10)
    oSigningKey  = this.optionalColumn('m_uuid', SigningKeyType, colMatrixUuidBracket)
    oSemver      = this.optionalColumn('m_str', SemverType, colMatrixStringBracket)
    oChannel     = this.optionalColumn('m_str', ReleaseChannelType, colMatrixStringBracket)
    oReleaseDay  = this.optionalColumn('m_date', ReleaseDayType, colMatrixShiftHour)
    oCutoffClock = this.optionalColumn('m_time', CutoffClockType, colMatrixShiftHour)
    oSignOff     = this.optionalColumn('m_datetime', SignOffStampType, colMatrixShiftHour)
    oActivity    = this.optionalColumn('m_str', WorklogActivityType, colMatrixStringBracket)
    constructor() { super('col_matrix_view') }
}()

// virtualColumnFromFragment / optionalVirtualColumnFromFragment WITH a trailing
// TypeAdapter, per kind — the Table virtual-column trailing-adapter overload
// (required `m*` + optional `o*`). Each virtual fragment renders a base col_matrix column
// object (`b*`, not projected) so the emitted read SQL/value coincides with the plain
// column+adapter cell; the typed virtual READ PATH is what differs. Same colMatrix
// adapters (numeric ×10, bigint ×10n, boolean negate, uuid lowercase+bracket, string
// bracket, Date +1h).
export const tColMatrixVirtualAdapter = new class TColMatrixVirtualAdapter extends Table<DBConnection, 'TColMatrixVirtualAdapter'> {
    id           = this.primaryKey('id', 'int')
    bInt         = this.column('m_int', 'int')
    bBigint      = this.column('m_bigint', 'bigint')
    bDouble      = this.column('m_double', 'double')
    bBool        = this.column('m_bool', 'boolean')
    bUuid        = this.column('m_uuid', 'uuid')
    bDate        = this.column('m_date', 'localDate')
    bTime        = this.column('m_time', 'localTime')
    bDatetime    = this.column('m_datetime', 'localDateTime')
    bStr         = this.column('m_str', 'string')
    mInt         = this.virtualColumnFromFragment('int', (fragment) => fragment.sql`${this.bInt}`, colMatrixNumberX10)
    mBigint      = this.virtualColumnFromFragment('bigint', (fragment) => fragment.sql`${this.bBigint}`, colMatrixBigintX10)
    mDouble      = this.virtualColumnFromFragment('double', (fragment) => fragment.sql`${this.bDouble}`, colMatrixNumberX10)
    mBool        = this.virtualColumnFromFragment('boolean', (fragment) => fragment.sql`${this.bBool}`, colMatrixBoolNegate)
    mUuid        = this.virtualColumnFromFragment('uuid', (fragment) => fragment.sql`${this.bUuid}`, colMatrixUuidBracket)
    mDate        = this.virtualColumnFromFragment('localDate', (fragment) => fragment.sql`${this.bDate}`, colMatrixShiftHour)
    mTime        = this.virtualColumnFromFragment('localTime', (fragment) => fragment.sql`${this.bTime}`, colMatrixShiftHour)
    mDatetime    = this.virtualColumnFromFragment('localDateTime', (fragment) => fragment.sql`${this.bDatetime}`, colMatrixShiftHour)
    mStr         = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    cents        = this.virtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.bInt}`, colMatrixNumberX10)
    money        = this.virtualColumnFromFragment(MoneyRealsType, (fragment) => fragment.sql`${this.bDouble}`, colMatrixNumberX10)
    signingKey   = this.virtualColumnFromFragment(SigningKeyType, (fragment) => fragment.sql`${this.bUuid}`, colMatrixUuidBracket)
    semver       = this.virtualColumnFromFragment(SemverType, (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    channel      = this.virtualColumnFromFragment(ReleaseChannelType, (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    releaseDay   = this.virtualColumnFromFragment(ReleaseDayType, (fragment) => fragment.sql`${this.bDate}`, colMatrixShiftHour)
    cutoffClock  = this.virtualColumnFromFragment(CutoffClockType, (fragment) => fragment.sql`${this.bTime}`, colMatrixShiftHour)
    signOff      = this.virtualColumnFromFragment(SignOffStampType, (fragment) => fragment.sql`${this.bDatetime}`, colMatrixShiftHour)
    activity     = this.virtualColumnFromFragment(WorklogActivityType, (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    oInt         = this.optionalVirtualColumnFromFragment('int', (fragment) => fragment.sql`${this.bInt}`, colMatrixNumberX10)
    oBigint      = this.optionalVirtualColumnFromFragment('bigint', (fragment) => fragment.sql`${this.bBigint}`, colMatrixBigintX10)
    oDouble      = this.optionalVirtualColumnFromFragment('double', (fragment) => fragment.sql`${this.bDouble}`, colMatrixNumberX10)
    oBool        = this.optionalVirtualColumnFromFragment('boolean', (fragment) => fragment.sql`${this.bBool}`, colMatrixBoolNegate)
    oUuid        = this.optionalVirtualColumnFromFragment('uuid', (fragment) => fragment.sql`${this.bUuid}`, colMatrixUuidBracket)
    oDate        = this.optionalVirtualColumnFromFragment('localDate', (fragment) => fragment.sql`${this.bDate}`, colMatrixShiftHour)
    oTime        = this.optionalVirtualColumnFromFragment('localTime', (fragment) => fragment.sql`${this.bTime}`, colMatrixShiftHour)
    oDatetime    = this.optionalVirtualColumnFromFragment('localDateTime', (fragment) => fragment.sql`${this.bDatetime}`, colMatrixShiftHour)
    oStr         = this.optionalVirtualColumnFromFragment('string', (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    oCents       = this.optionalVirtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.bInt}`, colMatrixNumberX10)
    oMoney       = this.optionalVirtualColumnFromFragment(MoneyRealsType, (fragment) => fragment.sql`${this.bDouble}`, colMatrixNumberX10)
    oSigningKey  = this.optionalVirtualColumnFromFragment(SigningKeyType, (fragment) => fragment.sql`${this.bUuid}`, colMatrixUuidBracket)
    oSemver      = this.optionalVirtualColumnFromFragment(SemverType, (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    oChannel     = this.optionalVirtualColumnFromFragment(ReleaseChannelType, (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    oReleaseDay  = this.optionalVirtualColumnFromFragment(ReleaseDayType, (fragment) => fragment.sql`${this.bDate}`, colMatrixShiftHour)
    oCutoffClock = this.optionalVirtualColumnFromFragment(CutoffClockType, (fragment) => fragment.sql`${this.bTime}`, colMatrixShiftHour)
    oSignOff     = this.optionalVirtualColumnFromFragment(SignOffStampType, (fragment) => fragment.sql`${this.bDatetime}`, colMatrixShiftHour)
    oActivity    = this.optionalVirtualColumnFromFragment(WorklogActivityType, (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    constructor() { super('col_matrix') }
}()

// virtualColumnFromFragment / optionalVirtualColumnFromFragment WITH a trailing
// TypeAdapter, per kind — the View virtual-column trailing-adapter overload
// (required `m*` + optional `o*`). Each virtual fragment renders a base col_matrix column
// object (`b*`, not projected) so the emitted read SQL/value coincides with the plain
// column+adapter cell; the typed virtual READ PATH is what differs. Same colMatrix
// adapters (numeric ×10, bigint ×10n, boolean negate, uuid lowercase+bracket, string
// bracket, Date +1h).
export const vColMatrixVirtualAdapter = new class VColMatrixVirtualAdapter extends View<DBConnection, 'VColMatrixVirtualAdapter'> {
    id           = this.column('id', 'int')
    bInt         = this.column('m_int', 'int')
    bBigint      = this.column('m_bigint', 'bigint')
    bDouble      = this.column('m_double', 'double')
    bBool        = this.column('m_bool', 'boolean')
    bUuid        = this.column('m_uuid', 'uuid')
    bDate        = this.column('m_date', 'localDate')
    bTime        = this.column('m_time', 'localTime')
    bDatetime    = this.column('m_datetime', 'localDateTime')
    bStr         = this.column('m_str', 'string')
    mInt         = this.virtualColumnFromFragment('int', (fragment) => fragment.sql`${this.bInt}`, colMatrixNumberX10)
    mBigint      = this.virtualColumnFromFragment('bigint', (fragment) => fragment.sql`${this.bBigint}`, colMatrixBigintX10)
    mDouble      = this.virtualColumnFromFragment('double', (fragment) => fragment.sql`${this.bDouble}`, colMatrixNumberX10)
    mBool        = this.virtualColumnFromFragment('boolean', (fragment) => fragment.sql`${this.bBool}`, colMatrixBoolNegate)
    mUuid        = this.virtualColumnFromFragment('uuid', (fragment) => fragment.sql`${this.bUuid}`, colMatrixUuidBracket)
    mDate        = this.virtualColumnFromFragment('localDate', (fragment) => fragment.sql`${this.bDate}`, colMatrixShiftHour)
    mTime        = this.virtualColumnFromFragment('localTime', (fragment) => fragment.sql`${this.bTime}`, colMatrixShiftHour)
    mDatetime    = this.virtualColumnFromFragment('localDateTime', (fragment) => fragment.sql`${this.bDatetime}`, colMatrixShiftHour)
    mStr         = this.virtualColumnFromFragment('string', (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    cents        = this.virtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.bInt}`, colMatrixNumberX10)
    money        = this.virtualColumnFromFragment(MoneyRealsType, (fragment) => fragment.sql`${this.bDouble}`, colMatrixNumberX10)
    signingKey   = this.virtualColumnFromFragment(SigningKeyType, (fragment) => fragment.sql`${this.bUuid}`, colMatrixUuidBracket)
    semver       = this.virtualColumnFromFragment(SemverType, (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    channel      = this.virtualColumnFromFragment(ReleaseChannelType, (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    releaseDay   = this.virtualColumnFromFragment(ReleaseDayType, (fragment) => fragment.sql`${this.bDate}`, colMatrixShiftHour)
    cutoffClock  = this.virtualColumnFromFragment(CutoffClockType, (fragment) => fragment.sql`${this.bTime}`, colMatrixShiftHour)
    signOff      = this.virtualColumnFromFragment(SignOffStampType, (fragment) => fragment.sql`${this.bDatetime}`, colMatrixShiftHour)
    activity     = this.virtualColumnFromFragment(WorklogActivityType, (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    oInt         = this.optionalVirtualColumnFromFragment('int', (fragment) => fragment.sql`${this.bInt}`, colMatrixNumberX10)
    oBigint      = this.optionalVirtualColumnFromFragment('bigint', (fragment) => fragment.sql`${this.bBigint}`, colMatrixBigintX10)
    oDouble      = this.optionalVirtualColumnFromFragment('double', (fragment) => fragment.sql`${this.bDouble}`, colMatrixNumberX10)
    oBool        = this.optionalVirtualColumnFromFragment('boolean', (fragment) => fragment.sql`${this.bBool}`, colMatrixBoolNegate)
    oUuid        = this.optionalVirtualColumnFromFragment('uuid', (fragment) => fragment.sql`${this.bUuid}`, colMatrixUuidBracket)
    oDate        = this.optionalVirtualColumnFromFragment('localDate', (fragment) => fragment.sql`${this.bDate}`, colMatrixShiftHour)
    oTime        = this.optionalVirtualColumnFromFragment('localTime', (fragment) => fragment.sql`${this.bTime}`, colMatrixShiftHour)
    oDatetime    = this.optionalVirtualColumnFromFragment('localDateTime', (fragment) => fragment.sql`${this.bDatetime}`, colMatrixShiftHour)
    oStr         = this.optionalVirtualColumnFromFragment('string', (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    oCents       = this.optionalVirtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.bInt}`, colMatrixNumberX10)
    oMoney       = this.optionalVirtualColumnFromFragment(MoneyRealsType, (fragment) => fragment.sql`${this.bDouble}`, colMatrixNumberX10)
    oSigningKey  = this.optionalVirtualColumnFromFragment(SigningKeyType, (fragment) => fragment.sql`${this.bUuid}`, colMatrixUuidBracket)
    oSemver      = this.optionalVirtualColumnFromFragment(SemverType, (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    oChannel     = this.optionalVirtualColumnFromFragment(ReleaseChannelType, (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    oReleaseDay  = this.optionalVirtualColumnFromFragment(ReleaseDayType, (fragment) => fragment.sql`${this.bDate}`, colMatrixShiftHour)
    oCutoffClock = this.optionalVirtualColumnFromFragment(CutoffClockType, (fragment) => fragment.sql`${this.bTime}`, colMatrixShiftHour)
    oSignOff     = this.optionalVirtualColumnFromFragment(SignOffStampType, (fragment) => fragment.sql`${this.bDatetime}`, colMatrixShiftHour)
    oActivity    = this.optionalVirtualColumnFromFragment(WorklogActivityType, (fragment) => fragment.sql`${this.bStr}`, colMatrixStringBracket)
    constructor() { super('col_matrix_view') }
}()

export const tColMatrixDefaultAdapter = new class TColMatrixDefaultAdapter extends Table<DBConnection, 'TColMatrixDefaultAdapter'> {
    id          = this.primaryKey('id', 'int')
    mInt        = this.columnWithDefaultValue('m_int', 'int', colMatrixNumberX10)
    mBigint     = this.columnWithDefaultValue('m_bigint', 'bigint', colMatrixBigintX10)
    mDouble     = this.columnWithDefaultValue('m_double', 'double', colMatrixNumberX10)
    mBool       = this.columnWithDefaultValue('m_bool', 'boolean', colMatrixBoolNegate)
    mUuid       = this.columnWithDefaultValue('m_uuid', 'uuid', colMatrixUuidBracket)
    mDate       = this.columnWithDefaultValue('m_date', 'localDate', colMatrixShiftHour)
    mTime       = this.columnWithDefaultValue('m_time', 'localTime', colMatrixShiftHour)
    mDatetime   = this.columnWithDefaultValue('m_datetime', 'localDateTime', colMatrixShiftHour)
    mStr        = this.columnWithDefaultValue('m_str', 'string', colMatrixStringBracket)
    cents       = this.columnWithDefaultValue('m_int', CentsType, colMatrixNumberX10)
    money       = this.columnWithDefaultValue('m_double', MoneyRealsType, colMatrixNumberX10)
    signingKey  = this.columnWithDefaultValue('m_uuid', SigningKeyType, colMatrixUuidBracket)
    semver      = this.columnWithDefaultValue('m_str', SemverType, colMatrixStringBracket)
    channel     = this.columnWithDefaultValue('m_str', ReleaseChannelType, colMatrixStringBracket)
    releaseDay  = this.columnWithDefaultValue('m_date', ReleaseDayType, colMatrixShiftHour)
    cutoffClock = this.columnWithDefaultValue('m_time', CutoffClockType, colMatrixShiftHour)
    signOff     = this.columnWithDefaultValue('m_datetime', SignOffStampType, colMatrixShiftHour)
    activity    = this.columnWithDefaultValue('m_str', WorklogActivityType, colMatrixStringBracket)
    constructor() { super('col_matrix') }
}()

// `optionalColumnWithDefaultValue(name, kind, adapter)` — optional.
export const tColMatrixOptionalDefaultAdapter = new class TColMatrixOptionalDefaultAdapter extends Table<DBConnection, 'TColMatrixOptionalDefaultAdapter'> {
    id          = this.primaryKey('id', 'int')
    mInt        = this.optionalColumnWithDefaultValue('m_int', 'int', colMatrixNumberX10)
    mBigint     = this.optionalColumnWithDefaultValue('m_bigint', 'bigint', colMatrixBigintX10)
    mDouble     = this.optionalColumnWithDefaultValue('m_double', 'double', colMatrixNumberX10)
    mBool       = this.optionalColumnWithDefaultValue('m_bool', 'boolean', colMatrixBoolNegate)
    mUuid       = this.optionalColumnWithDefaultValue('m_uuid', 'uuid', colMatrixUuidBracket)
    mDate       = this.optionalColumnWithDefaultValue('m_date', 'localDate', colMatrixShiftHour)
    mTime       = this.optionalColumnWithDefaultValue('m_time', 'localTime', colMatrixShiftHour)
    mDatetime   = this.optionalColumnWithDefaultValue('m_datetime', 'localDateTime', colMatrixShiftHour)
    mStr        = this.optionalColumnWithDefaultValue('m_str', 'string', colMatrixStringBracket)
    cents       = this.optionalColumnWithDefaultValue('m_int', CentsType, colMatrixNumberX10)
    money       = this.optionalColumnWithDefaultValue('m_double', MoneyRealsType, colMatrixNumberX10)
    signingKey  = this.optionalColumnWithDefaultValue('m_uuid', SigningKeyType, colMatrixUuidBracket)
    semver      = this.optionalColumnWithDefaultValue('m_str', SemverType, colMatrixStringBracket)
    channel     = this.optionalColumnWithDefaultValue('m_str', ReleaseChannelType, colMatrixStringBracket)
    releaseDay  = this.optionalColumnWithDefaultValue('m_date', ReleaseDayType, colMatrixShiftHour)
    cutoffClock = this.optionalColumnWithDefaultValue('m_time', CutoffClockType, colMatrixShiftHour)
    signOff     = this.optionalColumnWithDefaultValue('m_datetime', SignOffStampType, colMatrixShiftHour)
    activity    = this.optionalColumnWithDefaultValue('m_str', WorklogActivityType, colMatrixStringBracket)
    constructor() { super('col_matrix') }
}()

// `computedColumn(name, kind, adapter)` — required, non-writable.
export const tColMatrixComputedAdapter = new class TColMatrixComputedAdapter extends Table<DBConnection, 'TColMatrixComputedAdapter'> {
    id          = this.primaryKey('id', 'int')
    mInt        = this.computedColumn('m_int', 'int', colMatrixNumberX10)
    mBigint     = this.computedColumn('m_bigint', 'bigint', colMatrixBigintX10)
    mDouble     = this.computedColumn('m_double', 'double', colMatrixNumberX10)
    mBool       = this.computedColumn('m_bool', 'boolean', colMatrixBoolNegate)
    mUuid       = this.computedColumn('m_uuid', 'uuid', colMatrixUuidBracket)
    mDate       = this.computedColumn('m_date', 'localDate', colMatrixShiftHour)
    mTime       = this.computedColumn('m_time', 'localTime', colMatrixShiftHour)
    mDatetime   = this.computedColumn('m_datetime', 'localDateTime', colMatrixShiftHour)
    mStr        = this.computedColumn('m_str', 'string', colMatrixStringBracket)
    cents       = this.computedColumn('m_int', CentsType, colMatrixNumberX10)
    money       = this.computedColumn('m_double', MoneyRealsType, colMatrixNumberX10)
    signingKey  = this.computedColumn('m_uuid', SigningKeyType, colMatrixUuidBracket)
    semver      = this.computedColumn('m_str', SemverType, colMatrixStringBracket)
    channel     = this.computedColumn('m_str', ReleaseChannelType, colMatrixStringBracket)
    releaseDay  = this.computedColumn('m_date', ReleaseDayType, colMatrixShiftHour)
    cutoffClock = this.computedColumn('m_time', CutoffClockType, colMatrixShiftHour)
    signOff     = this.computedColumn('m_datetime', SignOffStampType, colMatrixShiftHour)
    activity    = this.computedColumn('m_str', WorklogActivityType, colMatrixStringBracket)
    constructor() { super('col_matrix') }
}()

// `optionalComputedColumn(name, kind, adapter)` — optional, non-writable.
export const tColMatrixOptionalComputedAdapter = new class TColMatrixOptionalComputedAdapter extends Table<DBConnection, 'TColMatrixOptionalComputedAdapter'> {
    id          = this.primaryKey('id', 'int')
    mInt        = this.optionalComputedColumn('m_int', 'int', colMatrixNumberX10)
    mBigint     = this.optionalComputedColumn('m_bigint', 'bigint', colMatrixBigintX10)
    mDouble     = this.optionalComputedColumn('m_double', 'double', colMatrixNumberX10)
    mBool       = this.optionalComputedColumn('m_bool', 'boolean', colMatrixBoolNegate)
    mUuid       = this.optionalComputedColumn('m_uuid', 'uuid', colMatrixUuidBracket)
    mDate       = this.optionalComputedColumn('m_date', 'localDate', colMatrixShiftHour)
    mTime       = this.optionalComputedColumn('m_time', 'localTime', colMatrixShiftHour)
    mDatetime   = this.optionalComputedColumn('m_datetime', 'localDateTime', colMatrixShiftHour)
    mStr        = this.optionalComputedColumn('m_str', 'string', colMatrixStringBracket)
    cents       = this.optionalComputedColumn('m_int', CentsType, colMatrixNumberX10)
    money       = this.optionalComputedColumn('m_double', MoneyRealsType, colMatrixNumberX10)
    signingKey  = this.optionalComputedColumn('m_uuid', SigningKeyType, colMatrixUuidBracket)
    semver      = this.optionalComputedColumn('m_str', SemverType, colMatrixStringBracket)
    channel     = this.optionalComputedColumn('m_str', ReleaseChannelType, colMatrixStringBracket)
    releaseDay  = this.optionalComputedColumn('m_date', ReleaseDayType, colMatrixShiftHour)
    cutoffClock = this.optionalComputedColumn('m_time', CutoffClockType, colMatrixShiftHour)
    signOff     = this.optionalComputedColumn('m_datetime', SignOffStampType, colMatrixShiftHour)
    activity    = this.optionalComputedColumn('m_str', WorklogActivityType, colMatrixStringBracket)
    constructor() { super('col_matrix') }
}()


// Column factories reading the SAME col_matrix row through a CUSTOM data type and
// the `scaledByTypeName` adapter. One class per factory, so a factory that loses
// the data type of the user is visible on its own: `cents` is an IntegersType ('Cents')
// over m_int (42) and `money` a RealsType ('Money') over m_double (3.5). The
// plain `int` / `double` twins over the same two columns are the controls — same
// SQL, no scaling. No DDL of its own: col_matrix and col_matrix_view already hold
// the one seeded row.

// `column(name, type, typeName, adapter)`.
export const tDerivedColumn = new class TDerivedColumn extends Table<DBConnection, 'TDerivedColumn'> {
    id          = this.primaryKey('id', 'int')
    plainInt    = this.column('m_int', 'int')
    plainDouble = this.column('m_double', 'double')
    cents       = this.column('m_int', CentsType, scaledByTypeName)
    money       = this.column('m_double', MoneyRealsType, scaledByTypeName)
    // The temporal and uuid data types of the user on the same factory. They carry no
    // adapter: what observes their data type is the dialect's own dispatch on it
    // (the date/time spelling and the uuid handling), not a value transform.
    signOff     = this.column('m_datetime', SignOffStampType)
    releaseDay  = this.column('m_date', ReleaseDayType)
    cutoffClock = this.column('m_time', CutoffClockType)
    signingKey  = this.column('m_uuid', SigningKeyType)
    // The adapter-free twins of `cents` / `money`, plus a `ReleaseTag` twin for the
    // sequence tests. They are the OPERANDS the derived-type tests pass to a
    // own-typed fragment argument or to a sequence derivation: the operand has
    // to share the receiver's data type, and it must not bring an adapter of its
    // own, so the receiver's is the one that runs.
    plainCents  = this.column('m_int', CentsType)
    plainMoney  = this.column('m_double', MoneyRealsType)
    releaseTag  = this.column('m_int', ReleaseTagIntegersType)
    constructor() { super('col_matrix') }
}()

// `optionalColumn(name, type, typeName, adapter)`.
export const tDerivedOptional = new class TDerivedOptional extends Table<DBConnection, 'TDerivedOptional'> {
    id          = this.primaryKey('id', 'int')
    plainInt    = this.optionalColumn('m_int', 'int')
    plainDouble = this.optionalColumn('m_double', 'double')
    cents       = this.optionalColumn('m_int', CentsType, scaledByTypeName)
    money       = this.optionalColumn('m_double', MoneyRealsType, scaledByTypeName)
    constructor() { super('col_matrix') }
}()

// `columnWithDefaultValue(name, type, typeName, adapter)`.
export const tDerivedDefault = new class TDerivedDefault extends Table<DBConnection, 'TDerivedDefault'> {
    id          = this.primaryKey('id', 'int')
    plainInt    = this.columnWithDefaultValue('m_int', 'int')
    plainDouble = this.columnWithDefaultValue('m_double', 'double')
    cents       = this.columnWithDefaultValue('m_int', CentsType, scaledByTypeName)
    money       = this.columnWithDefaultValue('m_double', MoneyRealsType, scaledByTypeName)
    constructor() { super('col_matrix') }
}()

// `optionalColumnWithDefaultValue(name, type, typeName, adapter)`.
export const tDerivedOptionalDefault = new class TDerivedOptionalDefault extends Table<DBConnection, 'TDerivedOptionalDefault'> {
    id          = this.primaryKey('id', 'int')
    plainInt    = this.optionalColumnWithDefaultValue('m_int', 'int')
    plainDouble = this.optionalColumnWithDefaultValue('m_double', 'double')
    cents       = this.optionalColumnWithDefaultValue('m_int', CentsType, scaledByTypeName)
    money       = this.optionalColumnWithDefaultValue('m_double', MoneyRealsType, scaledByTypeName)
    constructor() { super('col_matrix') }
}()

// `computedColumn(name, type, typeName, adapter)`.
export const tDerivedComputed = new class TDerivedComputed extends Table<DBConnection, 'TDerivedComputed'> {
    id          = this.primaryKey('id', 'int')
    plainInt    = this.computedColumn('m_int', 'int')
    plainDouble = this.computedColumn('m_double', 'double')
    cents       = this.computedColumn('m_int', CentsType, scaledByTypeName)
    money       = this.computedColumn('m_double', MoneyRealsType, scaledByTypeName)
    constructor() { super('col_matrix') }
}()

// `optionalComputedColumn(name, type, typeName, adapter)`.
export const tDerivedOptionalComputed = new class TDerivedOptionalComputed extends Table<DBConnection, 'TDerivedOptionalComputed'> {
    id          = this.primaryKey('id', 'int')
    plainInt    = this.optionalComputedColumn('m_int', 'int')
    plainDouble = this.optionalComputedColumn('m_double', 'double')
    cents       = this.optionalComputedColumn('m_int', CentsType, scaledByTypeName)
    money       = this.optionalComputedColumn('m_double', MoneyRealsType, scaledByTypeName)
    constructor() { super('col_matrix') }
}()

// `primaryKey(name, type, typeName, adapter)` — the caller-provided key itself
// carries the data type of the user.
export const tDerivedPk = new class TDerivedPk extends Table<DBConnection, 'TDerivedPk'> {
    centsPk     = this.primaryKey('m_int', CentsType, scaledByTypeName)
    plainInt    = this.column('m_int', 'int')
    plainDouble = this.column('m_double', 'double')
    constructor() { super('col_matrix') }
}()

// `autogeneratedPrimaryKey(name, type, typeName, adapter)`.
export const tDerivedAutogenPk = new class TDerivedAutogenPk extends Table<DBConnection, 'TDerivedAutogenPk'> {
    centsPk     = this.autogeneratedPrimaryKey('m_int', CentsType, scaledByTypeName)
    plainInt    = this.column('m_int', 'int')
    plainDouble = this.column('m_double', 'double')
    constructor() { super('col_matrix') }
}()

// `virtualColumnFromFragment` / `optionalVirtualColumnFromFragment` with a custom
// data type. Each fragment renders a base column OBJECT (`bInt` / `bDouble`), so
// the emitted read SQL matches the plain-column form and only the typed virtual
// read path differs.
export const tDerivedVirtual = new class TDerivedVirtual extends Table<DBConnection, 'TDerivedVirtual'> {
    id          = this.primaryKey('id', 'int')
    bInt        = this.column('m_int', 'int')
    bDouble     = this.column('m_double', 'double')
    cents       = this.virtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.bInt}`, scaledByTypeName)
    money       = this.virtualColumnFromFragment(MoneyRealsType, (fragment) => fragment.sql`${this.bDouble}`, scaledByTypeName)
    centsOptional = this.optionalVirtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.bInt}`, scaledByTypeName)
    moneyOptional = this.optionalVirtualColumnFromFragment(MoneyRealsType, (fragment) => fragment.sql`${this.bDouble}`, scaledByTypeName)
    constructor() { super('col_matrix') }
}()

// The View side: `column` / `optionalColumn` / `virtualColumnFromFragment` /
// `optionalVirtualColumnFromFragment` over col_matrix_view.
export const vDerivedColumn = new class VDerivedColumn extends View<DBConnection, 'VDerivedColumn'> {
    id            = this.column('id', 'int')
    bInt          = this.column('m_int', 'int')
    bDouble       = this.column('m_double', 'double')
    cents         = this.column('m_int', CentsType, scaledByTypeName)
    money         = this.column('m_double', MoneyRealsType, scaledByTypeName)
    centsOptional = this.optionalColumn('m_int', CentsType, scaledByTypeName)
    moneyOptional = this.optionalColumn('m_double', MoneyRealsType, scaledByTypeName)
    centsVirtual  = this.virtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.bInt}`, scaledByTypeName)
    moneyVirtual  = this.virtualColumnFromFragment(MoneyRealsType, (fragment) => fragment.sql`${this.bDouble}`, scaledByTypeName)
    centsVirtualOptional = this.optionalVirtualColumnFromFragment(CentsType, (fragment) => fragment.sql`${this.bInt}`, scaledByTypeName)
    moneyVirtualOptional = this.optionalVirtualColumnFromFragment(MoneyRealsType, (fragment) => fragment.sql`${this.bDouble}`, scaledByTypeName)
    constructor() { super('col_matrix_view') }
}()

// A plan of the service. Its versions are read through a table customization.
export const tServicePlan = new class TServicePlan extends Table<DBConnection, 'TServicePlan'> {
    id          = this.primaryKey('id', 'int')
    name        = this.column('name', 'string')
    description = this.optionalColumn('description', 'string')
    constructor() { super('service_plan') }
}()
