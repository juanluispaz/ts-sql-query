// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/BunSqlPostgresQueryRunner.ts`. See ./README.md.
//
// `BunSqlPostgresQueryRunner.addParam` pushes values as-is (Bun.SQL binds a
// JS `Date` natively), matching the generic `MockQueryRunner`.

import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'

export class MockBunSqlPostgresQueryRunner extends MockQueryRunner {
}
