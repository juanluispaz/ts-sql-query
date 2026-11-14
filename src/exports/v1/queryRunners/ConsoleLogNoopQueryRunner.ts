// ts-sql-query/queryRunners/ConsoleLogNoopQueryRunner: the path of version 1, kept so that code written for it keeps compiling. Version 2
// dropped these names: each one says what replaces it

import { ConsoleLogQueryRunner, NoopQueryRunner, type DatabaseType, type PromiseProvider } from '../../v2/index.js'

/** @deprecated Use `new ConsoleLogQueryRunner(new NoopQueryRunner(config))`, from 'ts-sql-query' */
export interface ConsoleLogNoopQueryRunnerConfig {
    database?: DatabaseType | undefined
    promise?: PromiseProvider | undefined
}

/** @deprecated Use `new ConsoleLogQueryRunner(new NoopQueryRunner(config))`, from 'ts-sql-query' */
export class ConsoleLogNoopQueryRunner extends ConsoleLogQueryRunner<NoopQueryRunner> {
    constructor(databaseOrConfig: DatabaseType | ConsoleLogNoopQueryRunnerConfig = {}) {
        super(new NoopQueryRunner(typeof databaseOrConfig === 'string' ? { database: databaseOrConfig } : databaseOrConfig))
    }
}
