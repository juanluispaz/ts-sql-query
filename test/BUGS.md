# Test-suite-discovered bugs

Bugs the new `test/` suite has surfaced while running. Each entry is a
single, reproducible issue; once fixed in `src/`, remove the TODO[BUG]
comment in the corresponding test and delete the entry here.

Per project policy ([`CLAUDE.md`](../CLAUDE.md)), the agent does NOT
touch `src/` when finding bugs — only documents them and marks the
test so the suite stays green. Division of labor (test author vs
fixing agent) is detailed in
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

---

## `virtualColumnFromFragment` callback fails TS overload resolution when the fragment template has no `${…}` interpolation

**Where**: `src/expressions/fragment.ts:6-138` (the no-interpolation `sql(sql: TemplateStringsArray)` overload of every per-type `*FragmentExpression`) interacts with `src/View.ts:120-190` / `src/Values.ts:135-205` callback signatures.

**Reproduction**: declared on either a `View` or a `Values` subclass:
```ts
class V extends Values<DBConnection, 'name'> {
    id    = this.column('int')
    upper = this.virtualColumnFromFragment(
        'string',
        fragment => fragment.sql`upper('hello')`,   // bare literal, no `${…}`
    )
}
```
fails to compile with `error TS2769: No overload matches this call.` on every cell. The same call WORKS the moment any `${…}` interpolation is added — e.g. `fragment.sql\`upper(${this.id})\``. The existing `vProjectOverview.nameUpper` (postgres `domain/connection.ts:172`) works only because it interpolates `${this.name}`.

Concretely: the no-interpolation overload `sql(sql: TemplateStringsArray): StringValueSource<NO_SOURCE, OPTIONAL_TYPE>` leaves `NO_SOURCE` unconstrained, so TS can't unify the callback's return type (`IStringValueSource<SOURCE, 'required'>`) with the fragment's declared SOURCE. Each interpolated `${col}` constrains `NO_SOURCE` via `T1 extends NSource` and the unification succeeds.

The same shape blocks `virtualColumnFromFragment<T>('enum', typeName, fn)` / `optionalVirtualColumnFromFragment<T>('customUuid', typeName, fn)` when the fragment is a bare literal — TS rejects every overload candidate.

<!-- TODO: when this entry is closed, the language and posture should be
     re-aligned with the rest of the docs. The doc restructure (Nov 2026)
     introduced the `mock-validated` / `real-validated` vocabulary and the
     ANTIPATTERNS catalogue; the "idiom workaround" stance below predates
     both and is preserved verbatim because the fixing agent will pick
     this entry off shortly and the wrap will disappear. -->

**Current workaround in the suite**: tests live in `with-values.advanced.test.ts` (mirrored across all cells where `Values` is typed) and route around the bug by interpolating an addressable column in every fragment (`fragment.sql\`'open'::text /* keyed-by */ || (case when ${this.amount} is null then '' else '' end)\``-style scaffolding). No `// TODO[BUG]` markers added in test bodies — the tests use the workaround as a deliberate idiom rather than wrapping disabled snippets.

---

## Common bug shapes (for the fixing agent)

Reference for the agent picking up entries above. The test author
does NOT need to classify entries against these shapes when writing
them — pattern-matching the symptom to a shape is the fixing agent's
first move, not the detector's.

Before pattern-matching, gather the emission context:
`bun run tests:where-is --search <symbol> --for emission-bug` bundles
`emitted-sql full · implemented-by full (non-overriders) ·
version-gates · bugs full · limitation · chain none` — the SQL the
symbol emits across tests and docs, every implementing class, the
compatibility-version branches that gate the method, sibling
`// TODO[BUG]` markers and any declared `// TODO[LIMITATION]` that
names the symbol, in one report. (`chain` is off on purpose —
emission happens after the call-chain, so the chain never reaches
the emission site; use `--emits-keyword <sql-fragment>` to walk back
from the SQL token to the builder code instead.)

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
   `bun run tests:where-is --search <symbol> --for post-fix-sync` bundles
   `emitted-sql full · docs full · examples full · tests detail · bugs
   · chain none` — every asserted SQL across tests and docs, the doc
   pages that explain it, the legacy `src/examples/` occurrences,
   per-test references, and any remaining `// TODO[BUG]` markers that
   still mention the symbol (typically the entry you're closing here).
   Anything still naming the old behaviour needs refreshing.
4. Walk `grep -rn "TODO\[BUG\]" test/db/` and either uncomment the
   wrapped tests (if the fix re-enables the snippet) or rewrite the
   comment-out reason to its final form — e.g. "Not applicable on
   `<DB>`: <reason>; see `test/db/<db>/types.negative/<file>.ts` for
   the compile-time negative".
5. Push the changelog entry under
   [`docs/CHANGELOG.md`](../docs/CHANGELOG.md) describing the
   user-visible change.
