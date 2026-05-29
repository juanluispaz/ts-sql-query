# Test-suite-discovered bugs

Bugs the new `test/` suite has surfaced while running. Each entry is a
single, reproducible issue; once fixed in `src/`, remove the TODO[BUG]
comment in the corresponding test and delete the entry here.

Per project policy ([`CLAUDE.md`](../CLAUDE.md)), the agent does NOT
touch `src/` when finding bugs — only documents them and marks the
test so the suite stays green. Division of labor (test author vs
fixing agent) is detailed in
[`MAINTAINING.md` § If a new test surfaces a bug in `src/`](./MAINTAINING.md#if-a-new-test-surfaces-a-bug-in-src).

## How to write an entry (test author)

Keep it short — enough to reproduce, no deeper. The fixing agent
takes it from there. Recommended structure:

```markdown
## <One-line title naming the symptom>

**Where**: file + line, or class/method, or docs page reference.
**Reproduction**: the test that surfaces it, the SQL the lib emits
(if applicable), the runtime/type error observed.
**Current workaround in the suite**: which tests are wrapped /
marked, and with what reason line.
```

That's the contract. Do **not** spend time diagnosing the root cause,
choosing a category, or proposing a fix — the fixing agent owns all
of that. Two minutes of triage and one paragraph is the bar.

---

## `isolationLevel(accessMode)` single-arg form drops the access mode on PostgreSQL / MySQL / MariaDB

**Where**: `PostgreSqlConnection.isolationLevel` (src/connections/PostgreSqlConnection.ts:86), and the identical bodies in `MySqlConnection.ts` and `MariaDBConnection.ts`. The access-mode-only overload returns `[undefined, accessMode]`, but in that branch the value arrived as the first parameter (`level`); `accessMode` (the second parameter) is `undefined`, so the call returns `[undefined, undefined]` and the access mode is silently lost. `OracleConnection.isolationLevel` does the same branch correctly (`return [undefined, level]`).
**Reproduction**: `connection.isolationLevel('read only')` returns `[undefined, undefined]` on pg/mysql/mariadb (verified) instead of `[undefined, 'read only']`. Consequence: `connection.transaction(fn, connection.isolationLevel('read only'))` emits a plain `begin transaction` with no `read only` clause (the real-runner `getTransactionAccessMode` reads `opts[1]`, which is `undefined`).
**Current workaround in the suite**: `transaction.isolation-level.test.ts` in the pg / mysql / mariadb cells pins the buggy `[undefined, undefined]` opts with a `// TODO[BUG]` referencing this entry; the oracle cell pins the correct `[undefined, 'read only']`.

## `DelegatedSetTransactionQueryRunner.createSetTransactionQuery` emits a spurious comma when only the access mode is set

**Where**: `src/queryRunners/DelegatedSetTransactionQueryRunner.ts:87-97`. The unconditional `if (sql) sql += ', '` (line 92-94) runs whenever `accessMode` is set, even when no `isolation level` clause was appended first — producing `set transaction, read only` instead of `set transaction read only`. The identical logic in `SqlTransactionQueryRunner.createBeginTransactionQuery` (src/queryRunners/SqlTransactionQueryRunner.ts:92-105) has the same shape and would emit `begin transaction, read only` for the same input.
**Reproduction**: Only Oracle reaches this branch today because its `isolationLevel('read only')` correctly returns `[undefined, 'read only']`; pg/mysql/mariadb mask it via the access-mode-dropping bug above (they emit nothing because both opts entries are `undefined`). On real Oracle the comma triggers `ORA-00900: invalid SQL statement` at offset 15 — the comma position in `set transaction, read only`. Fixing the access-mode-dropping bug above will expose this one on pg/mysql/mariadb too.
**Current workaround in the suite**: the `isolation-access-mode-only-builds-access-mode-opts` test in `test/db/oracle/newest/oracledb/transaction.isolation-level.test.ts` short-circuits in real-DB mode with a documented reason; the opts assertion still runs (pure client-side) and pins the correct `[undefined, 'read only']`.

## `isValidEncryptedID(encryptedID, prefix)` doesn't strip the prefix before re-checksumming, so it rejects every valid prefixed output of `encrypt`

**Where**: `src/extras/IDEncrypter.ts:238-251`. `IDEncrypter.encrypt(id, prefix)` returns `prefix + result + checksumString(result, prefix)` — the public checksum at the tail is computed over `result` (base64 + private csHex) WITHOUT the prefix. `IDEncrypter.decrypt` honours that contract: it strips the prefix BEFORE recomputing `checksumString` (line 136 → 140). `isValidEncryptedID` does not — it leaves the prefix in the slice fed to `checksumString` (line 244-246), so the recomputed checksum always disagrees with the tail and the function returns `false` for every prefixed string `encrypt` produces. Unprefixed encrypt/validate works (no prefix to strip).
**Reproduction**: `isValidEncryptedID(new IDEncrypter('3zTvzr3p67VC61jm','60iP0h6vJoEaJo8c').encrypt(1n,'co'), 'co')` returns `false` instead of `true`. The unprefixed equivalent `isValidEncryptedID(enc.encrypt(1n))` correctly returns `true`.
**Current workaround in the suite**: the prefixed assertion is split into its own test in `docs.advanced.id-manipulation.test.ts` (`is-valid-encrypted-id-prefix-bug-returns-false`) that pins the current (buggy) `false` result with a `// TODO[BUG]` referencing this entry. The unprefixed path stays in the happy-path test.

---

## Common bug shapes (for the fixing agent)

Reference for the agent picking up entries above. The test author
does NOT need to classify entries against these shapes when writing
them — pattern-matching the symptom to a shape is the fixing agent's
first move, not the detector's.

Each entry above usually falls into one of these:

- **TS accepts something runtime rejects** — a method typed on a
  connection class whose dialect refuses the SQL it emits. Mock
  cells silently pass (the SQL is never executed); only the real-DB
  cell surfaces the rejection. Treat as a typing gap: the type
  should narrow. The fix is two-step: tighten the connection's typed
  surface in `src/connections/<DB>Connection.ts` (or wherever the
  method is exposed), then add a `@ts-expect-error` rule under
  `test/db/<db>/types.negative/` that locks the new narrower
  contract. Example shipped: commit `9b5ab1c` on
  `PostgreSqlConnection.onConflictDoUpdateSet`.
- **TS rejects something the docs page describes** — the docs show a
  call that doesn't typecheck on the connection that snippet is
  supposed to demonstrate. Either the docs page is stale or the lib
  types are too tight. The fix is either to widen the type or to
  update the docs page; check both before assuming one.
- **Two equivalent forms documented but only one is typed** — the
  docs describe two interchangeable forms per dialect (e.g.
  "MariaDB/MySQL use bare `.onConflictDoUpdateSet({...})`;
  PostgreSQL/SQLite use `.onConflictOn(col).doUpdateSet({...})`")
  and the lib types let you use the wrong form on a given dialect.
  The fix narrows the typed surface for the dialect that should not
  accept that form.
- **A snippet references a public symbol that no longer exists** in
  the current `exports` map of [`package.json`](../package.json) —
  the page is stale or the symbol was removed. The fix is to update
  the docs page or restore the export.

When the fix lands:

1. Patch `src/` and add the negative-type test (where applicable).
2. Remove the corresponding entry from the open list above.
3. Walk `grep -rn "TODO\[BUG\]" test/db/` and either uncomment the
   wrapped tests (if the fix re-enables the snippet) or rewrite the
   comment-out reason to its final form — e.g. "Not applicable on
   `<DB>`: <reason>; see `test/db/<db>/types.negative/<file>.ts` for
   the compile-time negative".
4. Push the changelog entry under
   [`docs/CHANGELOG.md`](../docs/CHANGELOG.md) describing the
   user-visible change.
