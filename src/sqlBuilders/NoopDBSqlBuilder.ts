import type { TypeAdapter } from "../TypeAdapter"
import { AbstractSqlBuilder } from "./AbstractSqlBuilder"

export class NoopDBSqlBuilder extends AbstractSqlBuilder {
    noopDB: true = true

    _appendParam(value: any, params: any[], columnType: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return super._appendParam(value, params, columnType, typeAdapter, forceTypeCast) + ':' + columnType
    }
}
