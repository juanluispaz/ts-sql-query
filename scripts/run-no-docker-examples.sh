#!/bin/bash

set -x #echo on

ts-node ./src/examples/documentation/Sqlite-compatibility.ts || exit 1
ts-node ./src/examples/documentation/Sqlite-modern.ts || exit 1
ts-node ./src/examples/documentation/PostgreSql.ts || exit 1
ts-node ./src/examples/documentation/MySql.ts || exit 1
ts-node ./src/examples/documentation/MySql-compatibility.ts || exit 1
ts-node ./src/examples/documentation/MariaDB.ts || exit 1
ts-node ./src/examples/documentation/MariaDB-modern.ts || exit 1
ts-node ./src/examples/documentation/SqlServer.ts || exit 1
ts-node ./src/examples/documentation/Oracle.ts || exit 1

ts-node ./src/examples/SqliteExample.ts || exit 1
ts-node ./src/examples/Sqlite3Example.ts || exit 1
ts-node ./src/examples/BetterSqlite3Example.ts || exit 1
ts-node ./src/examples/BetterSqlite3SynchronousExample.ts || exit 1
ts-node ./src/examples/Sqlite3WasmOO1Example.ts || exit 1
ts-node ./src/examples/Sqlite3WasmOO1SynchronousExample.ts || exit 1
#ts-node ./src/examples/PrismaSqliteExample.ts || exit 1

echo 'All no docker examples ok'
