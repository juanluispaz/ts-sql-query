# Review of the prebuilt package sqlite-extensions

The SQLite page of the documentation on extensions (`docs/configuration/supported-databases/sqlite-extensions.md`)
mentions the npm package [`sqlite-extensions`](https://www.npmjs.com/package/sqlite-extensions)
([repository](https://github.com/canislupaster/sqlite-extensions)) inside a caution box: prebuilt binaries of SQLite's
`ext/misc`, outside the control of ts-sql-query. This folder keeps how that package was reviewed, so the review can be
repeated on a new version. What was found was reported in
[sqlite-extensions#1](https://github.com/canislupaster/sqlite-extensions/issues/1), which the page links.

**Never run the package's binaries on the host outside a sandbox or a throwaway container.**

## Files

| File | What it is |
|---|---|
| `queries.ts` | The queries run against the uuid and decimal extensions, and how their results are printed |
| `probe.ts` | Loads the extensions through the package (`extensionPath`), inside a container |
| `local.ts` | Loads two extension files given by path: the package's binaries copied out of a container, run under `sandbox-exec`, or a `decimal.c` built from SQLite's source |
| `sandbox.sb` | The macOS sandbox profile: no network, no file writes |

## Review of version 1.0.0 (2026-11-08)

Version 1.0.0, published 2026-08-28: one maintainer, MIT, no install scripts (the binaries are inside the tarball).

1. **Provenance**, read inside a container: `npm audit signatures` verifies the registry signature and the SLSA
   attestation.
   - It was built by a GitHub-hosted runner from tag `1.0.0`, commit `4592cf9c`, with `.github/workflows/build.yml`.
   - That workflow and `build.py` at that commit check out `sqlite/sqlite` at `version-3.53.4` and compile
     `ext/misc/*.c`.
   - The attestation is at `https://registry.npmjs.org/-/npm/v1/attestations/sqlite-extensions@1.0.0`.
2. **Static read**, without running anything, of the files copied out of the container:
   - `nm -u` and `strings` of `uuid` and `decimal` for darwin-arm64, linux-arm64, linux-x64 and win32-x64: they import
     only libc string, assert and stack-guard symbols, and have no URL, network or exec strings;
   - none of the 51 darwin-arm64 extensions imports `socket`, `connect`, `getaddrinfo`, `exec*`, `system`, `popen`,
     `fork`, `posix_spawn` or `dlopen`;
   - `otool -L` shows `/usr/lib/libz.1.dylib` linked into every dylib, and the runner's absolute path as install name.
3. **A rebuild from the same source** on macOS arm64: `uuid.c` and `decimal.c` of `version-3.53.4` with
   `cc -dynamiclib -O2 -fPIC -I <Homebrew sqlite include>`. The exported and imported symbols are the same, and
   `__text` is 1228 vs 1280 bytes for uuid and 7496 vs 7424 for decimal.
4. **Runs:**
   - **Linux arm64**, in throwaway containers removed afterwards, with the network cut before running anything
     (`docker network disconnect`):
     - `node:24-slim`, Node 24.22.2: better-sqlite3 and node:sqlite, SQLite 3.53.4;
     - `oven/bun:1.3-slim`, Bun 1.3.14: bun:sqlite, SQLite 3.53.0, loading directly on Linux.
   - **macOS arm64**, under `sandbox-exec -f sandbox.sb`: better-sqlite3 3.53.4 and node:sqlite 3.53.0. The network
     and writes were blocked. `sandbox-exec` is deprecated but enforced the profile.
5. **Results**, the same everywhere:
   - `uuid()` gives 36 characters, the uuid round trip works, and the braces form is accepted;
   - `decimal_add('0.1','0.2')` = `0.3`, and 30-digit sums are exact;
   - `decimal_mul('1.50','2.00')` = `3.00`, and `decimal_mul('1.10','3')` = `3.3`;
   - `collate decimal` orders `-10 0.1 1.50 1.5 9 10.00`.
6. **Bugs of SQLite's released `decimal.c`**, present in the binaries:
   - `decimal_cmp('.5','2.5E-2')` = `-1`;
   - `decimal_add(null,'1')` fails with `out of memory`.

   SQLite fixed both on its development branch after 3.54.1 (16 October 2026) in commits `4e512bf1`, `a315fb49` and
   `42f8689b`; no release had them at the time. A `decimal.c` built at `42f8689b` gives `1` and `NULL`. ts-sql-query
   never sends a NULL or an exponent to these functions. `decimal_sum` of only nulls = `'0'` is SQLite's own
   behaviour.

Not checked: Windows, musl, macOS x64, and the Linux `NEEDED` entries.

## Repeating it on a new version

1. Read the state of [sqlite-extensions#1](https://github.com/canislupaster/sqlite-extensions/issues/1), and list the
   versions with `npm view sqlite-extensions versions time`.
2. In a container:
   ```sh
   docker run -d --name ext-review --memory 1g -v "$PWD":/review:ro node:24-slim sleep 900
   docker exec -w /root ext-review sh -c 'mkdir w && cd w && npm init -y >/dev/null \
       && npm install --ignore-scripts sqlite-extensions@<version> better-sqlite3 tsx && npm audit signatures'
   ```
   Read the attestation (repository, tag, commit, workflow), then the `build.yml` and `build.py` of that commit:
   which SQLite tag, which files come from later commits, the link flags.
3. Cut the network and run the probe:
   ```sh
   for n in $(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' ext-review); do docker network disconnect $n ext-review; done
   docker exec -w /root/w ext-review sh -c 'cp /review/queries.ts /review/probe.ts . && npx tsx probe.ts better-sqlite3 && npx tsx probe.ts node'
   ```
   Do the same in `oven/bun` with `bun probe.ts bun`.
4. Copy `node_modules/sqlite-extensions/lib` out of the container (`docker cp`): it's only data to the host. Read it
   with `nm -u`, `strings` and `otool -L` as in step 2 of the review above. Then run the macOS files with
   `sandbox-exec -f sandbox.sb bun local.ts better-sqlite3 <uuid.dylib> <decimal.dylib>`. Remove the container.
5. If the decimal bugs are gone, update the caution box of the documentation page, which says the binaries have
   them.
