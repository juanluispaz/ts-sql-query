import type { QueryRunner } from "./QueryRunner"
import { LoggingQueryRunner, QueryType } from "./LoggingQueryRunner"

export class ConsoleLogQueryRunner<T extends QueryRunner> extends LoggingQueryRunner<T> {
    constructor(queryRunner: T) {
        super({onQuery: onQuery}, queryRunner)
    }
}

function onQuery(queryType: QueryType, query: string, params: any[]): void {
    console.log(queryType + ':', query, params)
}