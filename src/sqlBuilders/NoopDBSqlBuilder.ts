import { AbstractSqlBuilder } from "./AbstractSqlBuilder"

export class NoopDBSqlBuilder extends AbstractSqlBuilder {
    noopDB: true = true

    _appendParam(value: any, params: any[], columnType: string): string {
        return this._queryRunner.addParam(params, value) + ':' + columnType
    }
}
