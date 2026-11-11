---
search:
  boost: 0.5
---
<!-- doc-code-template: sqlite -->
# SQLite functions and extensions

Some settings of a [`SqliteConnection`](sqlite.md) make the library write SQL functions that SQLite doesn't have built in. A query that uses one the database doesn't have fails with `no such function`. This page says which functions each setting needs and the two ways to give them to SQLite:

- **`registerSqliteFunctions(db)`**, one call of the query runner that registers all of them, written in JavaScript. It is the usual way, and it needs nothing else installed.
- **SQLite's own extensions written in C** (`uuid.c` and `decimal.c`), compiled and loaded by you. They compute faster than functions written in JavaScript, and they take more work: a C compiler, the source of the extension, and a driver that can load an extension.

The math functions (`sqrt`, `power`, `ln`, `sin`…) need neither: see [Math functions](#math-functions).

## Which functions each setting needs

| Setting of the connection | Functions it writes | Where they come from |
|---|---|---|
| [`uuidStrategy`](sqlite.md#uuid-strategies) `'uuid-extension'` (the default) | `uuid()`, `uuid_str(x)`, `uuid_blob(x)` | SQLite's uuid extension (`ext/misc/uuid.c`); some builds of SQLite have it built in, like the one of macOS |
| [`decimalStrategy`](sqlite.md#exact-decimals-the-decimal-strategies) `'decimal-extension and tsq-functions'` and its canonical text variant (the default) | `decimal_add`, `decimal_sub`, `decimal_mul`, `decimal_cmp`, `decimal_sum`, and the library's `tsq_decimal_ceil`, `tsq_decimal_floor`, `tsq_decimal_round`, `tsq_decimal_mod` | the first five, SQLite's decimal extension (`ext/misc/decimal.c`); the `tsq_` ones, only the library |
| `decimalStrategy` `'decimal-functions'` and its canonical text variant | the same, and `tsq_decimal_key`, `tsq_decimal_abs`, `tsq_decimal_min`, `tsq_decimal_max` | the same |
| `decimalStrategy` `'text'` and `'canonical text'` | none | — |
| [`replaceAllInsensitiveFunction = 'ci_replace'`](../collations.md#sqlite-register-a-udf-or-accept-the-case-sensitive-fallback) | `ci_replace(text, from, to)` | only the library |

The functions of the library start with `tsq_`, so no function of SQLite or of one of its extensions has their name.

## Registering them with one call

On better-sqlite3, node:sqlite, bun:sqlite and sqlite-wasm, `registerSqliteFunctions` of the query runner registers every function of the table, written in JavaScript: see the page of [better-sqlite3](../query-runners/recommended/better-sqlite3.md#the-sql-functions-of-the-library), [bun:sqlite](../query-runners/recommended/bun_sqlite.md#the-sql-functions-of-the-library), [node:sqlite](../query-runners/recommended/node_sqlite.md#the-sql-functions-of-the-library) or [sqlite-wasm OO1](../query-runners/recommended/sqlite-wasm-OO1.md#the-sql-functions-of-the-library). It works together with the extensions written in C:

- A decimal function the database already has, with the same name and number of arguments, is left as it is. With SQLite's decimal extension loaded before the call, its functions, written in C, compute, and the call adds the library's `tsq_` ones.
- The uuid functions are registered even when the database has them, replacing them: the `uuid()` of SQLite's uuid extension generates version 4 UUIDs, which don't sort by time, and the library's generates version 7 ones. To keep the ones of the extension, name them in `skip`: `registerSqliteFunctions(db, { skip: ['uuid', 'uuid_str', 'uuid_blob'] })`.

!!! warning "Bun SQL for SQLite"

    Bun SQL for SQLite can neither register a function nor load an extension. With it, only the settings that write no function work: see [Bun SQL for SQLite](../query-runners/recommended/bun_sql_sqlite.md).

## Math functions

`sqrt`, `power`, `exp`, `ln`, `log10`, `sin`, `cos`, `pi` and the other [math functions of SQLite](https://sqlite.org/lang_mathfunc.html) are part of SQLite when it is compiled with `SQLITE_ENABLE_MATH_FUNCTIONS`. Every SQLite of the drivers the library supports has them; measured on macOS with `select sqrt(16), power(2, 10), ln(1), sin(0), log10(100), pi()`:

| Driver | SQLite it embeds |
|---|---|
| better-sqlite3 13.0 | 3.53.4 |
| node:sqlite (Node 26.1) | 3.53.0 |
| bun:sqlite (Bun 1.4.4) | 3.51.0, the one of macOS |
| Bun SQL for SQLite (Bun 1.4.4) | 3.51.0, the one of macOS |
| sqlite-wasm 3.54.1 | 3.54.1 |

There is nothing to load or register for them.

## Compiling an extension written in C

An extension of SQLite is a shared library: a `.dylib` on macOS, a `.so` on Linux, a `.dll` on Windows. You build it from the C source of the extension, with the headers of SQLite, and the driver loads the file. These steps build `decimal.c` and `uuid.c`; any other extension of `ext/misc` builds the same way.

### 1. Choose the version

Use the source of the version of SQLite the driver embeds, or of a later one. Ask the driver which one it has:

```sql
select sqlite_version()
```

The examples below use 3.53.0, whose number in the file names is `3530000`.

### 2. Get the source and the headers

Download, from SQLite, the C source of the extension at the tag of that version, and the amalgamation of the same version, which has the headers `sqlite3.h` and `sqlite3ext.h`:

```sh
curl -fsSLO https://sqlite.org/2026/sqlite-amalgamation-3530000.zip
unzip sqlite-amalgamation-3530000.zip
curl -fsSLo decimal.c https://raw.githubusercontent.com/sqlite/sqlite/version-3.53.0/ext/misc/decimal.c
curl -fsSLo uuid.c https://raw.githubusercontent.com/sqlite/sqlite/version-3.53.0/ext/misc/uuid.c
```

The amalgamation of each version is on SQLite's [download page](https://sqlite.org/download.html), the latest one, and in the folder of its year, like `https://sqlite.org/2026/`, the older ones. A full install of SQLite has the headers too, like the one of Homebrew in `/opt/homebrew/opt/sqlite/include`. The headers of the macOS SDK don't build an extension: the link fails with `symbol(s) not found for architecture arm64`.

### 3. Compile it

Keep the name of the file: SQLite finds the function that starts the extension (`sqlite3_decimal_init`) from it.

=== "macOS"

    ```sh
    cc -dynamiclib -O2 -fPIC -shared -I sqlite-amalgamation-3530000 -o decimal.dylib decimal.c
    cc -dynamiclib -O2 -fPIC -shared -I sqlite-amalgamation-3530000 -o uuid.dylib uuid.c
    ```

    `cc` is the compiler of the Xcode command line tools (`xcode-select --install`).

=== "Linux"

    ```sh
    cc -O2 -fPIC -shared -I sqlite-amalgamation-3530000 -o decimal.so decimal.c
    cc -O2 -fPIC -shared -I sqlite-amalgamation-3530000 -o uuid.so uuid.c
    ```

    `cc` is the C compiler of the system: `apt-get install gcc libc6-dev` on Debian or Ubuntu, `apk add gcc musl-dev` on Alpine.

=== "Windows"

    ```bat
    cl decimal.c -I sqlite-amalgamation-3530000 -link -dll -out:decimal.dll
    cl uuid.c -I sqlite-amalgamation-3530000 -link -dll -out:uuid.dll
    ```

    `cl` is the compiler of Microsoft Visual C++, from a developer command prompt. These are the commands of [SQLite's documentation](https://sqlite.org/loadext.html#compiling_a_loadable_extension), not measured.

The commands of macOS and Linux were run on arm64: on macOS 26 with Apple's `cc`, on Linux in Debian 12 (glibc) and Alpine 3.24 (musl) with `gcc`; the extensions built from 3.53.0 loaded in node:sqlite of Node 24.22, whose SQLite is 3.53.4, and gave `decimal_add('0.1', '0.2')` = `0.3` and a `uuid()` of 36 characters.

!!! note "Errors of the decimal extension fixed after 3.54.1"

    SQLite fixed errors of `decimal.c` after its version 3.54.1, so no released version has the fixes yet: `decimal_add(null, '1')` fails with `out of memory` ([4e512bf1](https://github.com/sqlite/sqlite/commit/4e512bf10d4f6a1bc613c4c0679b003d4570c0de)), and `decimal_cmp('.5', '2.5E-2')` gives `-1` ([a315fb49](https://github.com/sqlite/sqlite/commit/a315fb49a257cb372612da7f01838770e5adf406), completed by [42f8689b](https://github.com/sqlite/sqlite/commit/42f8689b2c65fa68f336e39888a864f6c1cc706a)). The queries of the library never hit them: it never passes a `null` to `decimal_add` or `decimal_sub`, and it never sends a number with an exponent. To build an extension with the fixes, take `decimal.c` from the commit `42f8689b` instead of the tag.

## Loading the extension

Load the extensions when you open the database, before `registerSqliteFunctions` and before the first query.

=== "better-sqlite3"

    ```ts
    import Database from "better-sqlite3";
    import { registerSqliteFunctions } from "ts-sql-query/sqlite/bun-sqlite";

    const db = new Database('foobar.db');
    db.loadExtension('/path/to/decimal.dylib');
    db.loadExtension('/path/to/uuid.dylib');
    registerSqliteFunctions(db, { skip: ['uuid', 'uuid_str', 'uuid_blob'] });
    ```

=== "node:sqlite"

    ```ts
    import { DatabaseSync } from "node:sqlite";
    import { registerSqliteFunctions } from "ts-sql-query/sqlite/bun-sqlite";

    const db = new DatabaseSync('foobar.db', { allowExtension: true });
    db.loadExtension('/path/to/decimal.dylib');
    db.loadExtension('/path/to/uuid.dylib');
    registerSqliteFunctions(db, { skip: ['uuid', 'uuid_str', 'uuid_blob'] });
    ```

    Without `allowExtension: true` when the database is opened, `loadExtension` fails with `extension loading is not allowed`, and it can't be enabled later.

=== "bun:sqlite"

    ```ts
    import { Database } from "bun:sqlite";
    import { registerSqliteFunctions } from "ts-sql-query/sqlite/bun-sqlite";

    // On macOS only, before the first Database of the process
    Database.setCustomSQLite('/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib');

    const db = new Database('foobar.db');
    db.loadExtension('/path/to/decimal.dylib');
    db.loadExtension('/path/to/uuid.dylib');
    registerSqliteFunctions(db, { skip: ['uuid', 'uuid_str', 'uuid_blob'] });
    ```

    On macOS, Bun uses the SQLite of the system, which can't load an extension: `loadExtension` fails with `This build of sqlite3 does not support dynamic extension loading`. `Database.setCustomSQLite` makes the process use another SQLite, like the one of Homebrew (`brew install sqlite`), and only works before the first `Database` is created. On Linux, Bun has its own SQLite, which loads extensions, and the call does nothing ([Bun's documentation](https://bun.com/docs/runtime/sqlite)).

The `skip` keeps the uuid functions of the extension; without it, the library's replace them (see [Registering them with one call](#registering-them-with-one-call)).

sqlite-wasm and Bun SQL for SQLite can't load an extension: sqlite-wasm is built without it, and Bun SQL has no call for it. With sqlite-wasm, `registerSqliteFunctions` gives all the functions.

## Prebuilt extensions

!!! danger "Binaries of a third party"

    The package [`sqlite-extensions`](https://www.npmjs.com/package/sqlite-extensions) of npm has the extensions of SQLite's `ext/misc` already compiled. They are binaries of a third party, outside the control and the responsibility of ts-sql-query: whether to trust them is your decision. Before using them, check the version of the package and of SQLite they come from, their provenance (`npm audit signatures`) and that it has a build for your platform. Compiling them from the source, as this page shows, stays the way the library recommends.

What was checked of `sqlite-extensions` 1.0.0:

- Its registry signature and its provenance verify with `npm audit signatures`: it was built by GitHub Actions from the tag `1.0.0` of its repository, from the sources of SQLite 3.53.4. It has builds for macOS, Linux (glibc and musl) and Windows, on x64 and arm64, and no install script.
- `uuid` and `decimal` loaded and gave the results of SQLite's extensions on Linux arm64 with better-sqlite3 and node:sqlite of Node 24.22 and with bun:sqlite of Bun 1.3.14, and on macOS arm64 with better-sqlite3 (SQLite 3.53.4) and node:sqlite (SQLite 3.53.0).
- It is built from 3.53.4, so it has the [errors of the decimal extension](#compiling-an-extension-written-in-c) fixed after 3.54.1.

Its function `extensionPath` gives the path of each file, to load it as above:

```typescriptreact
import { extensionPath, SQLITE_EXTENSIONS } from "sqlite-extensions";

db.loadExtension(extensionPath(SQLITE_EXTENSIONS.DECIMAL));
db.loadExtension(extensionPath(SQLITE_EXTENSIONS.UUID));
```

The issues found in that review (zlib linked into every extension, the build path in the macOS `install_name`, and the `decimal.c` fixes not yet in a SQLite release) are reported in [sqlite-extensions#1](https://github.com/canislupaster/sqlite-extensions/issues/1): check there whether they are resolved in the version you install.
