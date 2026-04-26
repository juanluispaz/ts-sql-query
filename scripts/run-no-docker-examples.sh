#!/bin/bash

set -x #echo on

tsx ./src/examples/documentation/Sqlite-compatibility.ts || exit 1
tsx ./src/examples/documentation/Sqlite-modern.ts || exit 1
tsx ./src/examples/documentation/PostgreSql.ts || exit 1
tsx ./src/examples/documentation/MySql.ts || exit 1
tsx ./src/examples/documentation/MySql-compatibility.ts || exit 1
tsx ./src/examples/documentation/MariaDB.ts || exit 1
tsx ./src/examples/documentation/MariaDB-modern.ts || exit 1
tsx ./src/examples/documentation/SqlServer.ts || exit 1
tsx ./src/examples/documentation/Oracle.ts || exit 1

tsx ./src/examples/Sqlite3Example.ts || exit 1
tsx ./src/examples/BetterSqlite3Example.ts || exit 1
tsx ./src/examples/BetterSqlite3SynchronousExample.ts || exit 1
tsx ./src/examples/Sqlite3WasmOO1Example.ts || exit 1
tsx ./src/examples/Sqlite3WasmOO1SynchronousExample.ts || exit 1
tsx ./src/examples/PrismaSqliteExample.ts || exit 1

tsx ./src/examples/PgLiteExample.ts || exit 1

echo 'All no docker examples ok'
