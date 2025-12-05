import { ConsoleLogQueryRunner } from './ConsoleLogQueryRunner.js'
import { NoopQueryRunner } from './NoopQueryRunner.js'
import type { DatabaseType, PromiseProvider } from './QueryRunner.js'

export interface ConsoleLogNoopQueryRunnerConfig {
    database?: DatabaseType
    promise?: PromiseProvider
}

export class ConsoleLogNoopQueryRunner extends ConsoleLogQueryRunner<NoopQueryRunner> {

    constructor(databaseOrConfig: DatabaseType | ConsoleLogNoopQueryRunnerConfig = 'noopDB') {
        super(new NoopQueryRunner(databaseOrConfig))
    }
}