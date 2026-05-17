#!/bin/bash
# Docker-free subset of the examples matrix (documentation + sqlite +
# pglite). Dispatches between `bun run` and `tsx` based on which
# runtime invoked the script (`npm_config_user_agent` prefix); direct
# invocation defaults to bun.

set -x #echo on

runtime="${npm_config_user_agent%%/*}"
if [ -z "$runtime" ]; then
    runtime="bun"
fi

if [ "$runtime" = "bun" ]; then
    RUN="bun run"
else
    RUN="tsx"
fi

$RUN ./src/examples/documentation/Sqlite-compatibility.ts || exit 1
$RUN ./src/examples/documentation/Sqlite-modern.ts || exit 1
$RUN ./src/examples/documentation/PostgreSql.ts || exit 1
$RUN ./src/examples/documentation/MySql.ts || exit 1
$RUN ./src/examples/documentation/MySql-compatibility.ts || exit 1
$RUN ./src/examples/documentation/MariaDB.ts || exit 1
$RUN ./src/examples/documentation/MariaDB-compatibility.ts || exit 1
$RUN ./src/examples/documentation/SqlServer.ts || exit 1
$RUN ./src/examples/documentation/SqlServer-compatibility.ts || exit 1
$RUN ./src/examples/documentation/Oracle.ts || exit 1
$RUN ./src/examples/documentation/Oracle-compatibility.ts || exit 1

$RUN ./src/examples/Sqlite3Example.ts || exit 1
if [ "$runtime" = "bun" ]; then
    $RUN ./src/examples/BunSqliteExample.ts || exit 1
    $RUN ./src/examples/BunSqliteSynchronousExample.ts || exit 1
    $RUN ./src/examples/BunSqlSqliteExample.ts || exit 1
else
    $RUN ./src/examples/BetterSqlite3Example.ts || exit 1
    $RUN ./src/examples/BetterSqlite3SynchronousExample.ts || exit 1
    NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
    if [ "$NODE_MAJOR" -ge 24 ]; then
        NODE_OPTIONS='--experimental-sqlite' $RUN ./src/examples/NodeSqliteExample.ts || exit 1
        NODE_OPTIONS='--experimental-sqlite' $RUN ./src/examples/NodeSqliteSynchronousExample.ts || exit 1
    else
        { set +x; } 2>/dev/null
        echo "Skipping NodeSqlite{,Synchronous}Example.ts: db.function API requires Node >= 24 (current: Node $NODE_MAJOR)"
        set -x
    fi
    $RUN ./src/examples/PrismaSqliteExample.ts || exit 1
fi
$RUN ./src/examples/Sqlite3WasmOO1Example.ts || exit 1
$RUN ./src/examples/Sqlite3WasmOO1SynchronousExample.ts || exit 1

$RUN ./src/examples/PgLiteExample.ts || exit 1

echo "All no-docker examples ok ($runtime)"
