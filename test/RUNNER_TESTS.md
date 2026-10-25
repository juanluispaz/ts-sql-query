# `test/runners/` — the query-runner tests

The cell matrix under [`db/`](./db/) tests the library through a connection:
the query runner underneath is whatever each cell connects with, and it is
reached only the way the connection drives it. The tests under
[`runners/`](./runners/) go one level lower — the level everything else is
built on — and call each **exported query runner** directly, through the
`QueryRunner` interface, with hand-written SQL. They are what
[`coverage:runners`](./CLI.md#coverage-of-the-query-runners) measures.

They sit outside the matrix: no version tiers, no symmetry rule, no
`tests:audit` (which walks `db/` only). Each runner is tested as a whole,
whatever class hierarchy implements it.

## Layout

| Path | What |
|---|---|
| `runners/lib/runnerContract.ts` | `describeRunnerContract(...)`: the behaviour every runner promises — the five select shapes and their shape errors, inserts / updates / deletes with and without RETURNING, ids, procedures and functions, transactions (levels, access modes, nesting, the state guards), concurrent use, the rest of the interface and error classification |
| `runners/lib/errorScenarios.ts` | the real errors provoked per database (`error.*` tests) and how a connection that fails on purpose is reported — see [The error scenarios](#the-error-scenarios) |
| `runners/lib/dialects.ts` | the hand-written SQL per database: the probe tables, function and procedure the contract creates, and the statement shapes the SqlBuilders emit there (RETURNING / OUTPUT / RETURNING INTO, `from dual`, …). What a database can't do is a missing entry, and the matching test is skipped |
| `runners/lib/queryRunnerCalls.ts` | every executing `QueryRunner` method with the shape of what it returns, for the database-less tests |
| `runners/<db>/<Runner>.test.ts` | one file per driver runner: a factory for the runner (and its variants: `SynchronousPromise`, `allowNestedTransactions`, the `*PoolPromise` twin) handed to the contract, plus what is particular to it |
| `runners/general/` | the runners and functions that need no database: `MockQueryRunner`, `NoopQueryRunner`, `ChainedQueryRunner` / `InterceptorQueryRunner`, `LoggingQueryRunner` / `ConsoleLog*QueryRunner`, the Bun SQL configuration checks and the functions `QueryRunner.ts` exports |

Particular cases live next to their runner: Oracle's commit outside a
transaction and its OUT binds (`oracle/OracleDBCommit.test.ts`,
`oracle/OracleDBOutBinds.test.ts`), SQL Server's isolation level on the
pooled connection and its parameter types
(`sqlserver/MssqlPoolQueryRunner.test.ts`, `sqlserver/MssqlParamTypes.test.ts`).

One fix relies on driver internals and has a test watching each side of it:
`MssqlPoolQueryRunner` flags the connection of a transaction the server
aborted (mssql's `_acquiredConnection` / `hasError`) so the pool doesn't lend
it out at the transaction's isolation level.
`the-mssql-internals-the-aborted-transaction-fix-relies-on` fails when an
mssql upgrade removes those internals, and
`does-not-outlive-a-transaction-the-server-aborted` fails when the fix stops
working for any reason.

## The engines

A docker-backed runner test gets its engine from the same lifecycle the cells
use: `acquireRunnerTestDatabase()` in each `db/<db>/runners.ts` acquires the
`newest` image's container and the worker database bootstrapped with the
domain schema, and returns how to connect; the test builds its own driver
from it and `release()`s it at the end. PGlite, sqlite-wasm and the native
SQLite drivers open their own in-memory database.

Whether a test runs is decided like a cell's: `isRealDbEnabled(<db>, <kind>,
'newest', <connector folder>)`, so `--docker` / `--wasm` / `--native` (and
their coords, e.g. `--docker postgres/newest/pg`) select them too; a runner
whose engine isn't selected is skipped.

The runtime is the one the script was launched with — `bun run` runs the
tests on Bun, `npm run` on Node — and each runtime runs what it can: on Node
the Bun runners are skipped. `--use-node` forces Node under `bun run`, and
`--use-bun` forces Bun under `npm run`; Bun runs every runner, so the
`coverage:runners*` scripts pass `--use-bun` to measure them all.

## The error scenarios

The `error.*` tests check the error mappers (`connectorErrorMappers/`,
`databaseErrorMappers/`) on real errors. Each scenario in
`lib/errorScenarios.ts` provokes one error on the engine — a duplicate key,
a missing table, a deadlock or a lock timeout between two sessions, a
statement cancelled from another session — and states the `errorReason` it
must be reported as, from what the error means, not from what the mapper
returns. Every runner of the database runs every scenario, so each one also
checks how that driver's error object is read (code, number, names).

- A scenario creates its own objects (`rt_err_*`) and drops them afterwards.
- `serverOnly` scenarios need a second session on the same database, or a
  condition an in-process engine doesn't survive; they skip on PGlite and
  SQLite. `onlyRunners` limits a scenario to the drivers the error depends
  on.
- A variant of a runner (nested transactions, `SynchronousPromise`) maps
  errors the same way and passes `errorScenarios: false`.

Besides them, each database server's runner is built with a wrong password,
a port nothing listens on and a database that doesn't exist —
`create(failure)`, from `acquireRunnerTestDatabase(failure)` — and every
runner runs a query on a connection it already closed
(`error.query-on-a-closed-connection`). Their coverage is
[`coverage:mappers`](./CLI.md#coverage-of-the-error-mappers).

## The params the SqlBuilders annotate

Some runners read more than the SQL and the values: what the SqlBuilder
recorded on the params array as non-enumerable properties — a parameter's
data type (SQL Server binds with it; Oracle declares a RETURNING OUT bind
with it), whether a mutation carries a returning clause, a forced
affected-row count, the query execution name and metadata. Those are set and
read through [`src/utils/queryParamsMetadata.ts`](../src/utils/queryParamsMetadata.ts),
and the runner tests use the same functions to build the params the library
would (`addTypedParam` in the contract, `setParamType`,
`setContainsMutationReturningClause`, `setForcedAffectedRowCount`).

## Running them

```bash
bun run tests:runners                 # all of them (docker runners skipped)
bun run tests:runners --docker --wasm # every runner against its engine (~7 s warm)
bun run tests runners/postgres --docker
bun run validate:tests runners        # type-check them (part of the full validate:tests)
```

`runners` is a coordinate root of the `tests` CLI; the full matrix
(`bun run tests` with no coord) includes them.

## Adding a runner

1. If its database is new, add a dialect to `lib/dialects.ts`.
2. Add `runners/<db>/<Runner>.test.ts`: build the runner in `create()` (from
   `acquireRunnerTestDatabase()` for a docker engine) and call
   `describeRunnerContract` with its dialect, its gate, `runnerClass` and the
   options that describe it (`pool`, `nestedTransactions`,
   `endWithoutTransaction`).
3. Add a test for anything particular to it, then check `coverage:runners`.
