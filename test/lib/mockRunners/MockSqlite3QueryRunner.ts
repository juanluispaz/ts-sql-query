// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/Sqlite3QueryRunner.ts`. See ./README.md.
//
// `Sqlite3QueryRunner.addParam` coerces `bigint` to `number` before
// pushing, because the deprecated `sqlite3` npm driver cannot bind a JS
// BigInt (it sends NULL). Booleans are pushed as-is (the `sqlite3` driver
// accepts JS booleans natively), matching the generic `MockQueryRunner`.

import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'

export class MockSqlite3QueryRunner extends MockQueryRunner {
    override addParam(params: any[], value: any): string {
        if (typeof value === 'bigint') {
            return super.addParam(params, Number(value))
        }
        return super.addParam(params, value)
    }
}
