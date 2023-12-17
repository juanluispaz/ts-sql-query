import type { TypeAdapter } from "../TypeAdapter"
import { AbstractSqlBuilder } from "./AbstractSqlBuilder"

export class NoopDBSqlBuilder extends AbstractSqlBuilder {
    noopDB: true = true

    _appendParam(value: any, params: any[], columnTypeName: string, typeAdapter: TypeAdapter | undefined, forceTypeCast: boolean): string {
        return super._appendParam(value, params, columnTypeName, typeAdapter, forceTypeCast) + ':' + columnTypeName
    }
}
