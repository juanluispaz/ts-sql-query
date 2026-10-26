// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/BunSqlSqliteQueryRunner.ts`. See ./README.md.
//
// `BunSqlSqliteQueryRunner.addParam` pushes the value as-is (Bun SQL binds JS
// booleans as 1/0 itself) with a numbered `?n` placeholder, the same as the
// generic `MockQueryRunner` does for sqlite.

import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'

export class MockBunSqlSqliteQueryRunner extends MockQueryRunner {
    override addParam(params: any[], value: any): string {
        params.push(value)
        return '?' + params.length
    }
}
