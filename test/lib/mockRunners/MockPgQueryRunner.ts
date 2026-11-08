// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/PgQueryRunner.ts` and `src/queryRunners/PgPoolQueryRunner.ts`.
// See ./README.md.
//
// pg can't send a parameter with its type: where the library asks for it
// (forceTypeCast) the runner writes a cast in the placeholder, `$1::int4`, as the
// generic `MockQueryRunner` does for postgreSql. A runner configured with
// `typesByName` writes the cast declared for the type name instead; the
// subclass sets `typesByName` to the map its cell's real runner gets.

import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'
import type { TypeCategory } from '../../../src/TypeAdapter.js'
import { postgreSqlPlaceholder } from '../../../src/utils/postgreSqlParamTypes.js'

export class MockPgQueryRunner extends MockQueryRunner {
    protected readonly typesByName: { readonly [typeName: string]: string } | undefined = undefined

    override addParam(params: any[], value: any, type: string, typeCategory: TypeCategory, forceTypeCast: boolean): string {
        const index = params.length
        super.addParam(params, value, type, typeCategory, forceTypeCast)
        return postgreSqlPlaceholder(index, value, type, typeCategory, forceTypeCast, this.typesByName)
    }
}
