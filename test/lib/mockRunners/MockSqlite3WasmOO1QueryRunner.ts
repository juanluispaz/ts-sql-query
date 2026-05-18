// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/Sqlite3WasmOO1QueryRunner.ts`. See ./README.md.

import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'

export class MockSqlite3WasmOO1QueryRunner extends MockQueryRunner {
    // Sqlite3WasmOO1QueryRunner.addParam coerces `boolean` to `1`/`0`
    // before pushing, because the WASM OO1 API only binds primitives
    // SQLite recognises natively.
    override addParam(params: any[], value: any): string {
        if (typeof value === 'boolean') {
            return super.addParam(params, Number(value))
        }
        return super.addParam(params, value)
    }
}
