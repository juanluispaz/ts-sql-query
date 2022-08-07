#!/bin/bash

set -x #echo on

ts-node ./src/examples/documentation/Sqlite-compatibility.ts || exit 1
ts-node ./src/examples/documentation/Sqlite-modern.ts || exit 1
ts-node ./src/examples/documentation/PostgreSql.ts || exit 1
ts-node ./src/examples/documentation/MySql.ts || exit 1
ts-node ./src/examples/documentation/MySql-compatibility.ts || exit 1
ts-node ./src/examples/documentation/MariaDB.ts || exit 1
ts-node ./src/examples/documentation/SqlServer.ts || exit 1
ts-node ./src/examples/documentation/Oracle.ts || exit 1

echo 'All no docker examples ok'
