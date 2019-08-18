import { AbstractSqlBuilder } from "./AbstractSqlBuilder"

export class NoopDBSqlBuilder extends AbstractSqlBuilder {
    noopDB: true = true

    _valuePlaceholder(index: number, columnType: string): string {
        return '$' + index + ':' + columnType
    }
}
