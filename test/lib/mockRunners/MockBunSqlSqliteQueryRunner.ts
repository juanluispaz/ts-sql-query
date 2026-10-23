// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/BunSqlSqliteQueryRunner.ts`. See ./README.md.
//
// `BunSqlSqliteQueryRunner.addParam` emits numbered `$n` placeholders (not the
// `?` the generic `MockQueryRunner` uses for sqlite) and pushes the value
// as-is (Bun SQL binds JS booleans as 1/0 itself).

import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'

export class MockBunSqlSqliteQueryRunner extends MockQueryRunner {
    override addParam(params: any[], value: any): string {
        params.push(value)
        return '$' + params.length
    }
}
