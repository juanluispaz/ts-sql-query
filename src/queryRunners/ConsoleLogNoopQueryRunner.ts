import type { PromiseProvider } from "../utils/PromiseProvider"
import { ConsoleLogQueryRunner } from "./ConsoleLogQueryRunner"
import { NoopQueryRunner } from "./NoopQueryRunner"
import type { DatabaseType } from "./QueryRunner"

export interface ConsoleLogNoopQueryRunnerConfig {
    database?: DatabaseType
    promise?: PromiseProvider
}

export class ConsoleLogNoopQueryRunner extends ConsoleLogQueryRunner<NoopQueryRunner> {

    constructor(databaseOrConfig: DatabaseType | ConsoleLogNoopQueryRunnerConfig = 'noopDB') {
        super(new NoopQueryRunner(databaseOrConfig))
    }
}