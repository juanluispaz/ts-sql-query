# Mock runners of the tests

Each cell imitates its real query runner through the public
[`MockQueryRunner`](../../../src/queryRunners/MockQueryRunner.ts): `test/db/<db>/runners.ts` passes the runner's name
in the `mockQueryRunner` option of `createTestContext` (and pg / Bun SQL on PostgreSQL their `mockTypesByName`), which
becomes `MockQueryRunnerConfig.queryRunner`. The mock then adds every parameter with the same function the real
runner's `addParam` calls (`src/utils/queryRunnerParams.ts`): the same placeholder, cast and value sent, so the SQL and
params `CaptureInterceptor` records are identical in mock and real modes. A new connector adds its runner to
`QueryRunnerName` and to `queryRunnerParamBindings`; nothing is copied here.

The one file left is a different kind of mock:
[`DocCodeMockRunner.ts`](./DocCodeMockRunner.ts), the `MockQueryRunner` subclass the **documentation SQL tests** build
their connection from. It records the emitted SQL (`lastSql` / `history`) and asserts it (`assertSql` /
`assertSqls`); it doesn't imitate a runner. See [`DOC_CODE_EXTRACTOR.md`](../../DOC_CODE_EXTRACTOR.md).
