// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/PgLiteQueryRunner.ts`. See ./README.md.
//
// `PgLiteQueryRunner.addParam` serializes a `Date` to an ISO 8601 string
// before binding it (PGlite's in-process serializer rejects a JS `Date`
// for a text-inferred parameter — see test/EXTERNAL_CAVEATS.md). The
// generic `MockQueryRunner` doesn't transform, so without this override
// a `Date` param would be captured as a `Date` in mock mode and as the
// ISO string in real mode.

import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'

export class MockPgLiteQueryRunner extends MockQueryRunner {
    override addParam(params: any[], value: any): string {
        if (value instanceof Date) {
            return super.addParam(params, value.toISOString())
        }
        return super.addParam(params, value)
    }
}
