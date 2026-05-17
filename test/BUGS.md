# Test-suite-discovered bugs

Bugs the new `test/` suite has surfaced while running. Each entry is a
single, reproducible issue; once fixed in `src/`, remove the TODO[BUG]
comment in the corresponding test and delete the entry here.

Per project policy (CLAUDE.md), the agent does NOT touch `src/` when
finding bugs — only documents them and marks the test so the suite
stays green.

## SQLite: `ln(x)` emits `log(x)` which is base-10 in SQLite

- File: [src/sqlBuilders/SqliteSqlBuilder.ts](../src/sqlBuilders/SqliteSqlBuilder.ts) — `_ln` override (line ~281).
- Symptom: `INumberValueSource.ln()` on the sqlite connection emits
  `log(x)`. In SQLite, single-argument `log(x)` is the base-10
  logarithm, not the natural log — so `ln(exp(2))` returns ≈ `0.868`
  (i.e. `log10(e²)`) instead of `2`.
- Marked in test: `test/db/sqlite/*/select.numeric-ops.test.ts`,
  `test('exp-and-ln', ...)`. The test still asserts SQL / params /
  type so future SQL-emission regressions are caught; the real-DB
  data assertion is skipped on sqlite until the fix lands.
- Suggested fix: emit `ln(x)` (SQLite >= 3.35 ships a `ln()` extension)
  or `log(?, x)` with an explicit base (`log(2.718281828..., x)` is
  fragile; better to require the math extension and call `ln(x)`).
