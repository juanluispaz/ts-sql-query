# Environment tests

The tests in `test/environments/` check what depends on the environment the
library runs in, and need one of their own: the process in a zone other than
UTC (each case runs in a process started with its `TZ`, and for oracledb its
`ORA_SDTZ`), a database outside UTC, and each version of the engine. They are
apart from the cells (`test/db/`) and from the query-runner tests
(`test/runners/`, [`RUNNER_TESTS.md`](./RUNNER_TESTS.md)) because they start
many processes and engines of several versions: neither `bun run tests` nor
`tests:runners` runs them.

| Test | What it checks |
|---|---|
| `<db>/LocalTemporalValuesInAnyZone.test.ts` | A `localDate`, `localTime` and `localDateTime` sent, read and sent back through every runner of the database, with the process in UTC, Madrid, New York and Tokyo; and what each driver must be configured with in each zone (`describeRunnerRequirements`) |
| `postgres/DatabaseOutsideUtc.test.ts`, `oracle/DatabaseOutsideUtc.test.ts` | A database in Europe/Madrid declared with `databaseTimeZone`: what is stored, read and compared, and the sessions refused |
| `sqlite/ApplicationTimeZone.test.ts` | The date functions of SQLite against JavaScript with the process in other zones |
| `sqlite/ValuesGeneratedByTheDatabase.test.ts` | The expressions the SQLite page gives for a value SQLite writes on its own, in each zone |

The probes they start are in the folder next to each test (`localTemporalValuesInAnyZone/probe.ts`, …), and what they
share in `lib/` (`localTemporalValues.ts`, `localTemporalValuesProbe.ts`, `versions.ts`, `versionPasses.ts`).

## Running them

```bash
bun run tests:environments --docker --wasm           # every engine, newest version
bun run tests environments/oracle --docker           # one database
bun run tests:environments --docker --wasm --all-versions
npm run tests -- environments/sqlite                 # the SQLite ones on Node
```

Whether a test runs is decided like a cell's (`isRealDbEnabled`), so `--docker`, `--wasm` and `--native` select them;
without them they are skipped. They run on the engine's newest image. With `--all-versions`, `tests.sh` runs them once
per version of the engines mapped in [`test/lib/dockerImages.ts`](./lib/dockerImages.ts)
(`lib/versionPasses.ts`): each pass gives every engine one image (the version folders that share it), so no pass starts
two containers of the same engine, and each version runs with the `compatibilityVersion` of its cells, read from the
setup of the cell (`lib/versions.ts`). What doesn't depend on the version (the requirements of a driver, PGlite,
SQLite, the sessions Oracle refuses) runs once, in the pass of the newest versions.

The engines are the containers of the cells: the older versions are the ones `--docker-version closest` uses, and
`--docker-mode reuse` keeps them running between runs ([`ENGINE_LIFECYCLE.md`](./ENGINE_LIFECYCLE.md)).

## The limits of a version or a driver

A case that doesn't give the value of the contract, by a limit of the engine or the driver, is declared in its test with
`limitOf`, and the test checks that the limit still happens, so it fails when it goes away. Each one has its entry in
[`ENGINE_SUPPORT.md`](./ENGINE_SUPPORT.md):

- Oracle counts the dates before 1582-10-15 in the Julian calendar; oracledb moves a wall clock in the summer-time gap
  of the zone of the process.
- MariaDB before 10.5 has no `json_arrayagg` (`read aggregateAsArray`).
- MySQL 8.0 doesn't find a `TIME` in a prepared `in` list of several values, which `BunSqlMySqlQueryRunner` sends.

## In CI

The CI has no docker engines: the environment tests of PGlite run real in shard 1 with the other WASM tests, and the
rest in shard 4, where the native SQLite ones run real and the docker ones are skipped. Run the docker ones, with
`--all-versions`, before publishing.
