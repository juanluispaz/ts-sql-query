// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/Sqlite3WasmOO1QueryRunner.ts`. See ./README.md.

import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import type { TypeCategory } from '../../../src/TypeAdapter.js'

export class MockSqlite3WasmOO1QueryRunner extends MockQueryRunner {
    // Sqlite3WasmOO1QueryRunner.addParam coerces `boolean` to `1`/`0`
    // before pushing, because the WASM OO1 API only binds primitives
    // SQLite recognises natively.
    override addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        if (typeof value === 'boolean') {
            return super.addParam(params, Number(value), type, typeCategory, forceTypeCast)
        }
        // An integer number beyond the 64-bit range goes as its text converted to a real
        if (typeof value === 'number' && Number.isInteger(value) && (value >= 2 ** 63 || value < -(2 ** 63))) {
            return 'cast(' + super.addParam(params, String(value), type, typeCategory, forceTypeCast) + ' as real)'
        }
        return super.addParam(params, value, type, typeCategory, forceTypeCast)
    }
}
