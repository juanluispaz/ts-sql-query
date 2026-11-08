// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/PgLiteQueryRunner.ts`. See ./README.md.
//
// PGlite sends a parameter with its type (the `paramTypes` query option) where
// the library asks for it (forceTypeCast), so the placeholder is always the
// bare `$n`, without the cast the generic `MockQueryRunner` writes for
// postgreSql. The flag is still kept on the params, as the runner keeps it.

import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import { setQueryParamType } from '../../../src/queryRunners/QueryRunner.js'
import type { TypeCategory } from '../../../src/TypeAdapter.js'

export class MockPgLiteQueryRunner extends MockQueryRunner {
    override addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        setQueryParamType(params, params.length, type, typeCategory, forceTypeCast)
        params.push(value)
        return '$' + params.length
    }
}
