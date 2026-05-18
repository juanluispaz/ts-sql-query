// Test-only mock that mirrors the observable param-handling of
// `src/queryRunners/Sqlite3QueryRunner.ts`. See ./README.md.
//
// `Sqlite3QueryRunner.addParam` pushes the value as-is (the `sqlite3`
// npm driver accepts JS booleans natively), which matches what the
// generic `MockQueryRunner` already does. The subclass is kept on
// disk anyway so a future divergence is a one-file change rather than
// a refactor across the test infrastructure.

import { MockQueryRunner } from '../../../src/queryRunners/MockQueryRunner.js'

export class MockSqlite3QueryRunner extends MockQueryRunner {
}
