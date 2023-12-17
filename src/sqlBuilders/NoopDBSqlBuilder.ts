import type { TypeAdapter } from "../TypeAdapter"
import { ValueType } from "../expressions/values"
import { AbstractSqlBuilder } from "./AbstractSqlBuilder"

export class NoopDBSqlBuilder extends AbstractSqlBuilder {
    noopDB: true = true

    _appendParam(value: any, params: any[], columnType: ValueType, columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return super._appendParam(value, params, columnType, columnTypeName, typeAdapter, forceTypeCast) + ':' + columnTypeName
    }
}
