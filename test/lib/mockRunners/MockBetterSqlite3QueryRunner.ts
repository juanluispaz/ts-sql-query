// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/BetterSqlite3QueryRunner.ts`. See ./README.md.

import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import type { TypeCategory } from '../../../src/TypeAdapter.js'

export class MockBetterSqlite3QueryRunner extends MockQueryRunner {
    // BetterSqlite3QueryRunner.addParam coerces `boolean` to `1`/`0`
    // before pushing, because `better-sqlite3`'s bind API rejects JS
    // booleans.
    override addParam(params: any[], value: any, type: string, typeCategory: TypeCategory): string {
        if (typeof value === 'boolean') {
            return super.addParam(params, Number(value), type, typeCategory)
        }
        return super.addParam(params, value, type, typeCategory)
    }
}
