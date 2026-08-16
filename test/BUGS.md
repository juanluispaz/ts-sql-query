# Test-suite-discovered bugs

Bugs the new `test/` suite has surfaced while running. Each entry is a
single, reproducible issue; once fixed in `src/`, remove the TODO[BUG]
comment in the corresponding test and delete the entry here.

Per project policy ([`CLAUDE.md`](../CLAUDE.md)), the agent does NOT
touch `src/` when finding bugs — only documents them and marks the
test so the suite stays green. Division of labor (test author vs
fixing agent) is detailed in
[`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src).

## Read this file in full — this section is the one to internalise

Whether you're **documenting** a new bug or **picking up an entry to
fix**, read every section of this file (every open entry below, the
"How to write an entry" recipe, the bug-shape presets at the bottom).
None is optional. This section in particular is the one prior sessions
skipped — internalise it before any `grep` or `Read` over `src/`:

1. **Read [`CODE_SEARCH.md`](./CODE_SEARCH.md) in full** once at session
   start (the doors, the sections, the presets, the cross-cutting reading
   conventions — all of it is operational). Pay special attention to
   [§ "This tool vs. textual search"](./CODE_SEARCH.md#this-tool-vs-textual-search):
   it defines when `tests:where-is` answers the question (symbol
   declarations, overload sites, type-arg blast radius, call-chain,
   neg-types, cell caveats) and when `grep` / the compiler still win
   (literal prose, byte-anchored edits, assignability decisions).
2. **Refresh the index**: `npm run tests:index:newest` (gitignored; the newest-cells
   index — low RAM. Use the full `npm run tests:index` only when chasing a
   version-specific bug in an older-tier cell).
3. **Treat the entry's `Where:` / `Reproduction:` lines as starting
   points, not ground truth.** The test author wrote them from what
   they saw; the searcher gives you every declaration site, every
   implementing class, every test that exercises the API, every
   first-class reason marker that names the symbol (`// TODO[BUG]`,
   `// TODO[LIMITATION]`, `// NOT-APPLICABLE`), and the wrap shape
   across cells — in one report.

   Recent miss: an entry on `virtualColumnFromFragment` named
   `View.ts` and `Values.ts`; the symbol also lives in `Table.ts`.
   A fix that grepped only the two listed files would have left
   `Table.ts` regressed. `--declared full` lists all three.

The presets for the two main bug shapes live in
[§ "Common bug shapes"](#common-bug-shapes-for-the-fixing-agent) below
(read them, even if your bug is "obvious"); the searcher-first triage
flow for test authors lives in
[`WRITING_TESTS.md` § When a test surfaces a bug in `src/`](./WRITING_TESTS.md#when-a-test-surfaces-a-bug-in-src).

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

## Open Bugs

Most defects this suite surfaces are a **silently wrong value** rather than a
rejection, and are invisible to the matrix until a test reaches them — so each
entry says under *Current workaround in the suite* why the matrix can't see it.
A `none` there is not "nothing to do": it means no test would notice a
regression either.

## `arg(...)` / `valueArg(...)` swap the type name and the optionality of a custom-typed fragment argument

**Where**: `AbstractConnection.arg` (`src/connections/AbstractConnection.ts:833`)
and `AbstractConnection.valueArg` (`src/connections/AbstractConnection.ts:895`).
The custom overloads are declared `(type, typeName, required, adapter?)`, so in
the implementation body the parameter named `required` receives the TYPE NAME and
the parameter named `adapter` receives the optionality string. The body then
builds `new Argument(type, adapter, required, mode, adapter2)` — i.e. it hands the
`Argument` constructor the optionality where `typeName` goes and the type name
where `optionalType` goes.

**Reproduction**:

```ts
import { PostgreSqlConnection } from 'ts-sql-query/connections/PostgreSqlConnection'
import { MockQueryRunner } from 'ts-sql-query/queryRunners/MockQueryRunner'
import type { TypeAdapter } from 'ts-sql-query'

const seen: string[] = []
const recordTypeName: TypeAdapter = {
    transformValueFromDB(value, type, next) { seen.push('fromDB:' + type); return next.transformValueFromDB(value, type) },
    transformValueToDB(value, type, next) { seen.push('toDB:' + type); return next.transformValueToDB(value, type) },
}

class DBConnection extends PostgreSqlConnection<'DBConnection'> {
    centsArg = this.buildFragmentWithArgs(
        this.arg<number, 'Cents'>('customInt', 'Cents', 'required', recordTypeName)
    ).as((v) => this.fragmentWithType('int', 'required').sql`${v}`)
}

const conn = new DBConnection(new MockQueryRunner(() => [{ r: 1 }]))
await conn.selectFromNoTable().select({ r: conn.centsArg(5) }).executeSelectMany()
console.log(seen)                       // → [ 'toDB:required' ]   expected [ 'toDB:Cents' ]

const arg: any = (conn as any).arg('customInt', 'Cents', 'required', recordTypeName)
console.log(arg.type, arg.typeName, arg.optionalType)
//   → customInt required Cents        expected: customInt Cents required
const varg: any = (conn as any).valueArg('customInt', 'Cents', 'optional', recordTypeName)
console.log(varg.type, varg.typeName, varg.optionalType)
//   → customInt optional Cents        expected: customInt Cents optional
```

The same custom data type declared through `const(5, 'customInt', 'Cents', adapter)`
records `[ 'toDB:Cents', 'fromDB:Cents' ]`, so the reference behaviour is the
`Cents` one.

What a user observes: a `TypeAdapter` on a custom-typed fragment argument — and
the `transformValueToDB` / `transformValueFromDB` overrides on the connection,
which is the documented place to map a custom type name onto its native type — is
handed `'required'` / `'optional'` instead of the declared type name, so the
custom type's marshalling is silently skipped for that argument. Secondarily the
argument's `optionalType` holds the type name, so it is neither `'required'` nor
`'optional'` at runtime.

The swap also defeats the **read** marshalling of a derivation over such an
argument, not only the write. `transformValueFromDB` is handed `'required'` in
place of the declared type name, so a connection that maps its custom type names
onto a native type (the documented place to do it) never sees the name and the
value is returned raw. Verified against a real PostgreSQL 18: the SQL emitted for
`arg('double', 'required')`, `arg('customDouble', 'Money', 'required')` and
`const(v, 'customDouble', 'Money')` is byte-identical
(`select mod(($1)::numeric, ($2)::numeric) as result from col_matrix`) and the
driver hands the `numeric` back as the string `"1"` in all three; the plain
`double` argument and the `Money` **const** marshal it to the number `1`, the
`Money` **argument** leaves it the string `"1"`.

**Current workaround in the suite**: ten tests in
`select.custom-type-derivation-args.test.ts` (every cell) are block-commented with
this reason; their bodies are the ones that run once the arguments carry their
declared type name. `arg/custom-double-modulo-emits-the-form-the-argument-data-type-requires`
is block-commented with the same reason on the PostgreSQL cells, where the read
path above is observable (`numeric` arrives as text); it stays live on the
dialects whose driver returns a number, and its two siblings observe the
argument's `ValueType` through the emitted SQL, which the swap does not affect.

## PostgreSQL cannot type the bare `$n is null` the optional min/max null guard emits

**Where**: `AbstractSqlBuilder._minAndMaxValueBetweenTwoValuesPoisoningNull` —
when either operand of `minValue` / `maxValue` is optional it wraps the native
`least` / `greatest` in `case when <operand> is null then null else … end`. When
that operand is a value source that renders as a **bare parameter** (an
`optionalConst(...)`, an optional fragment argument) the guard is emitted as
`case when $n is null then null else …`, which carries no type information at
all. `PostgreSqlConnection.transformPlaceholder` already exists to solve exactly
this (it appends `::int4` / `::float8` / … when a const is the projected column,
via `PostgreSqlSqlBuilder._appendColumnValue`'s `forceTypeCast = true`), but the
nested guard position never reaches it.

**Reproduction** (real PostgreSQL 18, `pg` / `postgres.js` / `pglite`):

```
select case when $1 is null then null else least($2, billed_amount) end as "v" from issue_worklog where id = $3
parameters: [ 500, 500, 1 ]
-> ERROR 42P18  could not determine data type of parameter $1
                (routine pg_analyze_and_rewrite_varparams)
```

**Not custom-type-specific, and not limited to the receiver.** The same error
comes back for a plain `double` and a plain `int`, and whether the bare parameter
is the receiver or the argument:

```
optionalConst(5, 'double').maxValue(<double column>)            -> 42P18
optionalConst(5, 'int').maxValue(<int column>)                  -> 42P18
optionalConst(5, 'double').minValue(<double column>)            -> 42P18
<double column>.maxValue(optionalConst(5, 'double'))            -> 42P18
optionalConst<number,'Money'>(5,'customDouble','Money').maxValue(<double column>) -> 42P18
const(5, 'double').maxValue(<double column>)                    -> OK  (no guard emitted)
optionalConst(5, 'double').add(<double column>)                 -> OK  (no guard emitted)
<optional double column>.maxValue(5)                            -> OK  (guard on a typed column)
```

Casting the guard's placeholder makes the identical statement run:
`select case when $1::float8 is null then null else least($2, billed_amount) end …`
returns `200`. The two documented opt-outs also avoid it, at the cost of the
semantics the guard exists for: `ignoreNullInMinAndMaxValue` emits the bare
`least($1, billed_amount)` (NULL no longer poisons) and
`minValueFunction`/`maxValueFunction` emit `my_max($1, billed_amount)` (needs a
user-defined SQL function).

Driver-dependent within the dialect: `pg`, `postgres.js` and `pglite` send no
parameter type, so the server has to infer and fails; Bun's `bun:sql` infers OIDs
from the JS values and the same query runs there. SQL Server routes through the
same guard and is unaffected (its driver declares every parameter's type), and
the dialects that keep the native null-poisoning `least`/`greatest` (Oracle,
MySQL, MariaDB, SQLite) never emit the guard.

**Current workaround in the suite**:
`optional-const/custom-double-max-value-column-operand` in
`select.custom-type-derivation-ops.test.ts` is block-commented with this reason on
the `pg`, `postgres` and `pglite` cells of both PostgreSQL version tiers, and runs
live everywhere else. No other test covers the shape: every pre-existing
`minValue` / `maxValue` assertion in the matrix puts a **column** in the guarded
position, where PostgreSQL reads the type from the column, so nothing else would
notice a regression here.

## SQL Server emits `currentValue()` as an untyped `sql_variant`, so any operation on it is rejected

**Where**: `SqlServerSqlBuilder._currentSequenceValue` emits
`(select current_value from sys.sequences where name = '<seq>')`. SQL Server types
that catalog column as `sql_variant`, while the value source the library hands the
user is typed `int` / `bigint` / `customInt` — so anything that composes with it
emits SQL the engine refuses.

**Reproduction** (real `mcr.microsoft.com/mssql/server:2025-latest`):

```
select ((select current_value from sys.sequences where name = 'release_tag_seq') * @0) + m_int as [result] from col_matrix
-> Msg 257  Implicit conversion from data type sql_variant to int is not allowed.
            Use the CONVERT function to run this query.
```

**Not custom-type-specific.** A plain `int` sequence (`issue_id_seq`) and a plain
`bigint` sequence (`audit_tag_seq`) are rejected identically; the base type behind
the variant is reported as `int`
(`sql_variant_property(…, 'BaseType')`). Only the bare projection the library
emits today survives, because the driver converts on the wire:

```
select (select current_value from sys.sequences where name = 'release_tag_seq') as [result]          -> 1
select ((cast((select current_value …) as bigint)) * 0) + m_int as [result] from col_matrix          -> 42
select (next value for release_tag_seq * 0) + m_int as [result] from col_matrix                      -> 42
```

So `currentValue()` on SQL Server is usable only as a bare projected column; every
arithmetic, comparison or derivation over it fails, while the `nextValue()`
sibling (`next value for <seq>`, a typed expression) composes fine.

**Current workaround in the suite**:
`sequence/current-value-custom-int-add-column-reads-back-with-the-sequence-data-type`
in `select.custom-type-derivation-sequence.test.ts` is block-commented with this
reason on every SQL Server cell and runs live on the other dialects. The
`sequence.next-current-value.test.ts` tests only project `currentValue()` bare, so
they are unaffected — and nothing else in the matrix composes with it, which means
no test would notice a regression on that path.

## Coverage gaps carried over (not bugs — no entry to fix)

These are **not** defects and there is nothing in `src/` to change. They are the
places where a fix that landed has **no test holding it down**, so a regression
would be silent. Kept here because the loudest lesson of the round that fixed
them was that a defect survives exactly as long as no fixture can express it.

*(none)*

## Common bug shapes (for the fixing agent)

Reference for the agent picking up entries above. The test author
does NOT need to classify entries against these shapes when writing
them — pattern-matching the symptom to a shape is the fixing agent's
first move, not the detector's.

**First, locate every declaration site of the symbol** —
`npm run tests:where-is -- --search <symbol> --declared full` lists ALL
declaration sites. Trust the index over the entry: the files named in
the open entry are the ones known when it was filed, and they can be
**incomplete**. (Past miss: an entry on `virtualColumnFromFragment`
named `View.ts` and `Values.ts`; the symbol also lives in `Table.ts`
and a fix that grepped only the two listed files would have left
`Table.ts` regressed.)

Then gather the context appropriate to the bug's shape:

- **SQL-emission bug** (the lib emits SQL the engine rejects, or the
  emitted SQL is wrong) — `npm run tests:where-is -- --search <symbol> --for emission-bug`
  bundles `emitted-sql full · implemented-by full (non-overriders) ·
  version-gates · bugs full · limitation · not-applicable · chain
  none`: the SQL the symbol emits across tests and docs, every
  implementing class, the compatibility-version branches that gate
  the method, sibling `// TODO[BUG]` markers and any declared
  `// TODO[LIMITATION]` / `// NOT-APPLICABLE` that names the symbol.
  `chain` is off on purpose — emission happens after the call-chain,
  so the chain never reaches the emission site; use
  `--emits-keyword <sql-fragment>` to walk back from the SQL token
  to the builder code instead.
- **Type-system bug** (overload selection, variance, assignability —
  the symbol's typing rejects or accepts something it shouldn't) —
  `npm run tests:where-is -- --search <symbol> --for type-bug` bundles
  `declared full · signature full · ref-type-arg full · neg-types
  full · bugs summary · limitation summary · not-applicable summary ·
  chain none`: every declaration + signature, every place the type is
  **used as a type argument** (the blast radius of an alias), the
  existing `@ts-expect-error` locks and sibling markers. The route
  for a type
  bug is the signature, not the call-chain — `chain` is off for the
  same reason as `emission-bug`. Before inventing a new helper or
  type alias, run `--search-pattern-summary '<shared-token>'` to
  check whether the shape already exists under a different name
  (past near-miss: nearly re-introduced `AllowsNoTableOrViewRequired`
  by hand).

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
3. **Walk every place that reflected the old behaviour**:
   `npm run tests:where-is -- --search <symbol> --for post-fix-sync` bundles
   `emitted-sql full · docs full · examples full · tests detail · bugs
   · chain none` — every asserted SQL across tests and docs, the doc
   pages that explain it, the legacy `src/examples/` occurrences,
   per-test references, and any remaining `// TODO[BUG]` markers that
   still mention the symbol (typically the entry you're closing here).
   Anything still naming the old behaviour needs refreshing.
4. Walk `grep -rn "TODO\[BUG\]" test/db/` and either uncomment the
   wrapped tests (if the fix re-enables the snippet) or **switch the
   marker to its final category**. If the fix establishes that the
   feature simply doesn't exist on this dialect, the right marker is
   `// NOT-APPLICABLE: <reason>; see test/db/<db>/types.negative/<file>.ts
   for the compile-time negative` — a permanent dialect boundary, not
   pending work. If the bug exposed an unsolved library gap, use
   `// TODO[LIMITATION]: see LIMITATIONS.md — <one-line>` instead.
5. Push the changelog entry under
   [`docs/CHANGELOG.md`](../docs/CHANGELOG.md) describing the
   user-visible change.
