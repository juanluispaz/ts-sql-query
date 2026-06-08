// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/BunSqlPostgresQueryRunner.ts`. See ./README.md.
//
// `BunSqlPostgresQueryRunner.addParam` serializes a `Date` to an ISO 8601
// string before binding it (Bun.SQL's PostgreSQL adapter otherwise sends
// `Date#toString()`, which PostgreSQL rejects — see
// test/EXTERNAL_CAVEATS.md). The generic `MockQueryRunner` doesn't
// transform, so without this override a `Date` param would be captured as
// a `Date` in mock mode and as the ISO string in real mode.

import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'

export class MockBunSqlPostgresQueryRunner extends MockQueryRunner {
    override addParam(params: any[], value: any): string {
        if (value instanceof Date) {
            return super.addParam(params, value.toISOString())
        }
        return super.addParam(params, value)
    }
}
