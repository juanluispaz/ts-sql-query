# SQLite extensions built by the tests

The C sources of two loadable extensions of SQLite, copied unchanged from the SQLite source tree, version 3.53.0.
Their author placed them in the public domain (the blessing at the top of each file).

| File | Source | SHA-256 |
|---|---|---|
| `decimal.c` | <https://raw.githubusercontent.com/sqlite/sqlite/version-3.53.0/ext/misc/decimal.c> | `2fcc1bee4d26ff49ffad36e61d405fb3aab3d8e44ec87d3776f70329a052c464` |
| `uuid.c` | <https://raw.githubusercontent.com/sqlite/sqlite/version-3.53.0/ext/misc/uuid.c> | `8b90b44e4c3aebe75f9f9e1ab9f59b73e2590a621668636831f210690f9ae20c` |

[`../sqliteExtensions.ts`](../sqliteExtensions.ts) compiles them with the C compiler of the machine and the headers of a
full SQLite (`sqlite3ext.h`, version 3.53.0 or later) into `node_modules/.cache/ts-sql-query/sqlite-extensions/`, in a
folder named after a hash of the source, the platform, the architecture and the headers, never into the repository.
A build that fails is remembered there with its reason (`<name>.dylib.failed` or `<name>.so.failed`), and the tests
that need it are skipped saying why; delete that folder to try again, for example after installing a compiler.

[`prebuilt-review/`](prebuilt-review/README.md) keeps how the prebuilt npm package `sqlite-extensions`, which the documentation mentions, was reviewed, and how to repeat it on a new version.
