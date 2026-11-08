// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/BunSqlPostgresQueryRunner.ts`. See ./README.md.
//
// `BunSqlPostgresQueryRunner.addParam` pushes values as-is (Bun.SQL binds a
// JS `Date` natively) and, as pg, writes the type of a parameter as a cast in
// the placeholder where the library asks for it, also the cast declared in
// `typesByName`: the same as `MockPgQueryRunner`.

import { MockPgQueryRunner } from './MockPgQueryRunner.js'

export class MockBunSqlPostgresQueryRunner extends MockPgQueryRunner {
}
