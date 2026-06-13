// The rule registry + severity table. See AUDIT.md § Severity model.
//
// Promoting a content rule from `warn` to `error` is a one-line edit here,
// recorded in the commit (and, per AUDIT.md § Maintenance contract, paired
// with the ANTIPATTERNS "Gate today" update + the sub-agent prompt drop).

import type { Severity } from './types.js'

// Content rules a `// tests-audit-disable-next-line <rule> -- <reason>` comment
// may target. A directive for an id NOT in this list reports `unknown-rule`.
export const CONTENT_RULES = ['mock-only', 'mirror-image', 'one-sided-guard', 'uuid-literal', 'as-any', 'any-type', 'as-unknown-as', 'meaningless-cast', 'meaningless-type', 'type-cast', 'non-public-api', 'commented-test-reason', 'focused-test', 'empty-snapshot', 'ts-ignore', 'ts-expect-error', 'eslint-disable-type', 'eslint-disable-other', 'skipped-test-reason', 'skip-real-db', 'misplaced-marker', 'tautology', 'no-assertion-runtime', 'empty-catch', 'weak-boolean', 'weak-matcher', 'close-to', 'no-op-expect', 'non-deterministic-input'] as const

export const RULE_SEVERITY: Record<string, Severity> = {
    // structural — whole-matrix cell parity. TEMPORARILY `warn` while the
    // cross-database backlog (files/tests not yet mirrored to every cell) is
    // worked down; promote back to `error` once the matrix is clean.
    'symmetry':               'warn',
    // anti-cheat content rules — start as `warn`, promote to `error`
    'mock-only':              'warn',   // most severe: never executes against the real engine — first to promote
    'mirror-image':           'warn',
    'one-sided-guard':        'warn',
    'uuid-literal':           'warn',   // a malformed-UUID literal mock accepts but a real engine rejects
    'as-any':                 'warn',   // a cast to `any` bypassing the public typed API (outside exception tests)
    'any-type':               'warn',   // an `any` type annotation (use a precise type or `unknown`)
    'as-unknown-as':          'warn',   // `x as unknown as T` — the double-assertion laundering that replaces `as any`
    'meaningless-cast':       'warn',   // a cast to `unknown` / `null` / `never` / `void` — a pointless type-checker bypass
    'meaningless-type':       'warn',   // the `unknown` / `null` / `never` / `void` type annotation (mirror of any-type)
    'type-cast':              'warn',   // any other `x as T` / `<T>x` assertion — may force the type or want `satisfies` (as const exempt)
    'non-public-api':         'warn',   // a relative import into non-public src or non-admitted test/lib
    'commented-test-reason':  'warn',   // a commented-out test with no TODO[BUG]/TODO[LIMITATION]/NOT-APPLICABLE reason
    'focused-test':           'warn',   // a committed `.only` — silently skips the rest of the suite (anchor 0; warn for now, an early promotion candidate)
    'empty-snapshot':         'warn',   // an un-baked `toMatchInlineSnapshot()` in live code — pins nothing (anchor 0 live; commented placeholders are AST-exempt)
    'ts-ignore':              'warn',   // `@ts-ignore` / `@ts-nocheck` — silences every error on the line; forbidden everywhere (anchor 0; promotion candidate)
    'ts-expect-error':        'warn',   // `@ts-expect-error` outside a types.negative cell — a type-error bypass
    'eslint-disable-type':    'warn',   // eslint-disable of a type-soundness lint (no-explicit-any / no-unsafe-* / ban-ts-comment) — the lint twin of as-any/any-type
    'eslint-disable-other':   'warn',   // eslint-disable of any other (non-type) lint — tracked separately, lowest priority
    'skipped-test-reason':    'warn',   // `test.skip` / `test.todo` with no TODO[BUG]/TODO[LIMITATION]/NOT-APPLICABLE reason — the .skip twin of commented-test-reason
    'skip-real-db':           'warn',   // `test.skipIf(realDbEnabled)` — a mock-only evasion at the registration level
    'misplaced-marker':       'warn',   // a TODO[BUG]/TODO[LIMITATION]/NOT-APPLICABLE marker not at a test (file scope, helper, floating)
    'tautology':              'warn',   // a provably-constant assertion (literal-self-compare, same-expression, `.length` ≥ 0)
    'no-assertion-runtime':   'warn',   // a test that runs a query (execute*) but asserts nothing — always green (anchor 0)
    'empty-catch':            'warn',   // an empty `catch { }` (no deliberate throw in the try) — swallows a real failure; 66 mock-only-style cases
    'weak-boolean':           'warn',   // `expect(x).toBeTruthy()` / `toBeFalsy()` — pins truthiness, not the value (anchor 0)
    'weak-matcher':           'warn',   // asymmetric matcher / `.toContain`/`.toMatch` on a value — approximate reserved for diagnostic + real-DB branch
    'close-to':               'warn',   // `toBeCloseTo` outside a real-DB branch — its own (lenient) rule, kept separate from the rigid weak-matcher
    'no-op-expect':           'warn',   // an `expect(...)` chain with no matcher invoked — a no-op that always passes (anchor 0)
    'non-deterministic-input': 'warn',  // `new Date()` / `Date.now()` / `Math.random()` as a query input (mock data is carved out) (anchor 0)
    // meta-rules guarding the suppression mechanism — `error` from day 1
    'disable-without-reason': 'error',
    'unknown-rule':           'error',
    'unused-ignore':          'warn',
}

export const RULE_HINT: Record<string, string> = {
    'symmetry':
        'EVERY cell of the WHOLE matrix (all databases × versions × connectors) must declare the same `.test.ts` files with the same test names in the same order. A test that does not apply to a dialect is COMMENTED OUT (kept for symmetry) with a `// NOT-APPLICABLE: <reason>` marker (or a `// TODO[BUG]:` / `// TODO[LIMITATION]:`), never deleted. Exempt files: `config.*` (connection-config-specific), `*.generated.test.ts`, and any whose name embeds a database name as a `.`/`-`-delimited token (e.g. `select.postgres-const-force-type-cast.test.ts`) — those are inherently dialect-specific. (Currently `warn` — a migration backlog; will return to `error` once the matrix is mirrored.)',
    'mock-only':
        'The test must execute against the real engine — skipping it (`if (ctx.realDbEnabled) return`) or swallowing the real error (`catch { if (!ctx.realDbEnabled) throw e }`) lets a real failure pass as green. Drive the case on real: synthesise an off-shape input with `fragmentWithType` / `rawFragment` if the engine cannot produce it naturally; use `toBeCloseTo` for float precision. A genuinely-irreducible case (extremely rare) carries `// tests-audit-disable-next-line mock-only -- <reason>`.',
    'mirror-image':
        'Make `expect(result).toEqual(...)` unconditional (DESIGN §1) — give the real-DB branch the same value assertion (sort the unstable dimension in JS, or UPDATE-in-withRollback). If the value is genuinely non-deterministic, justify with `// tests-audit-disable-next-line mirror-image -- <reason>` citing EXTERNAL_CAVEATS § "Could test more if real DB were on".',
    'one-sided-guard':
        'The value must be validated in BOTH mock and real-DB modes. Assert it unconditionally — add an ORDER BY or sort the result in JS so the same `expect(...).toEqual(...)` passes in both modes. If one mode genuinely cannot validate the value (autogen id, sequence, engine-only error), justify with `// tests-audit-disable-next-line one-sided-guard -- <reason>`.',
    'uuid-literal':
        'This string looks like a UUID but is not valid 8-4-4-4-12 hex. The mock accepts any string for a `uuid` value, but a real engine rejects a malformed one — so a mock-only run leaves the test green and it fails under --docker. Replace it with a valid UUID (e.g. the shared test constant).',
    'as-any':
        'A cast to `any` bypasses the public typed API — usually because the query could not be built the supported way. The decision: (1) if the cast is feeding an invalid value to a runtime guard in a test whose assertions are all about the resulting exception, the rule already exempts it — so if it fired, restructure the test so its assertions are ONLY the exception (try/catch + reason, `toThrow`) and the exemption applies; (2) otherwise this is a REWRITE, not a suppression — build the query through the public typed surface (if the API genuinely cannot express it, that is a library gap to report, not a cast to keep). There is no `tests-audit-disable` for the general case.',
    'any-type':
        'An `any` type annotation defeats type-checking and usually hides a test that is not realistic. Use the precise type; for a caught error or an intentionally-opaque value use `unknown` (`let thrown: unknown`). This is the type annotation, not the `as any` cast (that is `as-any`).',
    'as-unknown-as':
        '`x as unknown as T` double-asserts through `unknown` to force an arbitrary type — it silences the checker exactly like `as any`, just spelled to slip past an `as any` ban. It always means the value was not produced with type `T` the supported way. Build it through the public typed API so it genuinely has type `T`. The only sanctioned use is an exception test feeding a runtime guard, or a `// TODO[BUG]:`-marked repro of a known type bug.',
    'meaningless-cast':
        'A cast to `unknown` / `null` / `never` / `void` (or a union of only those, `as unknown | null`) conveys nothing — a test has no reason to assert one of these. Build the value through the public typed API. The only sanctioned use is feeding an invalid value to a runtime guard in an exception test, or a `// TODO[BUG]:`-marked repro. (`as unknown as T` is the separate, more specific `as-unknown-as` rule.)',
    'meaningless-type':
        'The `unknown` / `null` / `never` / `void` type used as an annotation hides the real shape under test. Use the precise type. (The matching `as unknown` / `as null` / … cast is the separate `meaningless-cast` rule; `as unknown as T` is `as-unknown-as`.) `unknown`/`null` are allowed in the same contexts as `as any` and where a public API requires them (TypeAdapter, getQueryExecution*); exempt inside a `// TODO[BUG]:`-marked test.',
    'type-cast':
        'A type assertion (`x as T` / `<T>x`) forces the checker to accept a type it did not infer — review whether it is necessary. Prefer building the value so it genuinely has type `T`, or `satisfies T` (which checks the shape instead of overriding it). This is the catch-all for casts not covered by `as-any` / `as-unknown-as` / `meaningless-cast`. `as const` is exempt; an exception test / throw-helper / `fromDbValue` / `// TODO[BUG]:` repro is sanctioned (same as `meaningless-cast`).',
    'commented-test-reason':
        'A commented-out test must state why it is off with one of the three first-class markers: `// TODO[BUG]: <reason>` (a defect in src/ — re-enabled here once fixed; BUGS.md), `// TODO[LIMITATION]: <reason>` (the library does not cover it yet / the env can\'t — could re-enable here; LIMITATIONS.md), or `// NOT-APPLICABLE: <reason>` (a deliberate dialect boundary — this cell NEVER runs it; the test runs in the dialects that support it). Pick by future: a TODO means pending work that could re-enable it HERE; NOT-APPLICABLE is permanent. It still counts for symmetry, so do not delete it — comment it WITH a marker, or re-enable it.',
    'non-public-api':
        'A *.test.ts may import only the public library API (the package.json `exports`, never the __UNSUPPORTED__ escape hatch) and the admitted test/lib helpers (testRunner, assertType, isAllowed). This relative import reaches past that. Build through the public surface; if a real gap exists it belongs in the library, not behind a relative import into internals.',
    'focused-test':
        'Remove the `.only` — `test.only` / `it.only` / `describe.only` focuses the runner on that one test and silently skips every other test in the file, so the cell reports green while almost nothing ran. `.only` is a local-iteration convenience; it must never be committed. (Currently `warn`; an early promotion candidate since the anchor is 0.)',
    'empty-snapshot':
        'An empty `toMatchInlineSnapshot()` pins nothing — it auto-fills on the next run and the assertion always passes, so it validates nothing until baked. Bake the snapshot (`--update-snapshots`) so the SQL/params are actually asserted. (A snapshot inside a commented-out test is naturally exempt — it is not live code; it is governed by `commented-test-reason` instead.)',
    'ts-ignore':
        '`@ts-ignore` / `@ts-nocheck` silences EVERY type error on the next line — the bluntest checker bypass. It is forbidden everywhere in the tests, including the negative-type cells: a negative-type assertion uses the line-scoped, error-asserting `@ts-expect-error` inside a `types.negative/` cell, never the blanket ignore. Build the query through the public typed API.',
    'ts-expect-error':
        '`@ts-expect-error` outside a `types.negative/` cell asserts the line has a type error where it should compile cleanly — usually a type-limitation bypass ("the runtime accepts this SQL"). Build through the public typed API; a genuine negative-type assertion (proving the API rejects something) belongs in a `types.negative/` cell, where `@ts-expect-error` is the expected tool.',
    'eslint-disable-type':
        'An `eslint-disable` of a type-soundness lint (`no-explicit-any` / `no-unsafe-*` / `ban-ts-comment`, or a bare disable) is the lint twin of `as-any` / `any-type` — it silences the rule that flags an unrealistic, type-dodging test. Build through the public typed API instead of disabling the lint.',
    'eslint-disable-other':
        'An `eslint-disable` directive suppresses a lint rule. Tracked separately from the type-soundness bucket so suppressions stay visible. If the lint is right, fix the code rather than disabling it (e.g. express a deliberately-unused binding without a blanket disable).',
    'skipped-test-reason':
        'A `test.skip` / `it.skip` / `describe.skip` / `test.todo` disables a test — like a commented-out test (`commented-test-reason`), it must state why with one of the three markers within 3 lines above: `// TODO[BUG]: <reason>`, `// TODO[LIMITATION]: <reason>`, or `// NOT-APPLICABLE: <reason>` (a permanent dialect boundary, not a TODO — the test runs in the dialects that support it). Re-enable it, or mark WITH a marker so the reason is visible.',
    'skip-real-db':
        '`test.skipIf(ctx.realDbEnabled)` / `test.runIf(!ctx.realDbEnabled)` gates the whole test on the real-DB flag — a `mock-only` evasion at the registration level (the body-scoped `mock-only` rule cannot see it). The test never runs against the real engine. Assert the value unconditionally so it is validated in both modes instead of skipping a mode. A genuine dialect boundary carries `// NOT-APPLICABLE: <reason>`, a known bug `// TODO[BUG]: <reason>`.',
    'misplaced-marker':
        'A `// TODO[BUG]:` / `// TODO[LIMITATION]:` / `// NOT-APPLICABLE:` marker must sit AT a test — on the comment line(s) directly above a `test(...)` / `it(...)` / `describe(...)` (the test may itself be commented out), or inside a `test`/`it` body. A marker at file scope, inside a helper, or floating in prose explains no test and reads as a phantom marker. Move it next to the test it documents, or remove it.',
    'tautology':
        'This assertion is provably constant — it passes no matter what the code does, so it validates nothing. `expect(true).toBe(true)` / `expect(x).toBe(x)` pin no value; `expect(x.length).toBeGreaterThanOrEqual(0)` is vacuous because a `.length` is always ≥ 0. Assert the actual computed value (the exact length, the real contents). Only provably-constant shapes are flagged; weak-but-meaningful assertions are the quality-gate sub-agent\'s call.',
    'no-assertion-runtime':
        'This test runs a query (an `execute*` call) but contains no assertion (`expect` / `assertType` / `toThrow`) — it executes and validates nothing, so it is always green. Assert the SQL (`toMatchInlineSnapshot`), params, result type (`assertType`) and value (`toEqual`). A pure type-demonstration test with no `execute*` call is compiler-gated and not flagged.',
    'empty-catch':
        'An empty `catch { }` swallows the error unconditionally — if the guarded code fails (e.g. on the real DB) the test still passes. Swallowing an `execute*` failure to assert only the interceptor-captured SQL is a `mock-only` pattern: drive the case so it runs in both modes, or assert the caught error. A deliberate `throw` inside the try (the mechanism of the scenario — e.g. forcing a rollback to test `executeAfterNextRollback`) is exempt.',
    'weak-boolean':
        '`expect(x).toBeTruthy()` / `toBeFalsy()` pins only truthiness — a truthy/falsy check passes for many different results. Assert the exact value (`toBe(true)`, or the real computed result), the way the suite validates SQL/params/value.',
    'weak-matcher':
        'This assertion pins shape/membership, not the exact value. `expect.arrayContaining` / `objectContaining` / `any` / `anything` accept extras / any / a partial structure; `.toContain` / `.toMatch` check only membership/substring. Approximate matching is reserved for the two places exact pinning is impossible — a diagnostic blob (error message / stack trace) and a real-DB branch (`if (ctx.realDbEnabled)`, where the real engine produces a non-deterministic value pinned exactly in the mock branch). Elsewhere a test has no reason not to be precise: pin the value (`expect(rows.slice().sort()).toEqual([...])`); for SQL use the full `toMatchInlineSnapshot`.',
    'close-to':
        '`toBeCloseTo` is an approximate float comparison, warranted only against the real engine (inside a real-DB branch) where floating-point rounding can yield `1.999999…`. Outside a real-DB branch the value comes from the mock (exactly what `mockNext` set) — pin it with `toBe`. If a real float needs approximating, guard the assertion behind `if (ctx.realDbEnabled)`.',
    'no-op-expect':
        'This `expect(...)` invokes no matcher — `expect(x)` / `expect(x).not` / `await expect(p).rejects` as a statement builds a matcher object and does nothing, so it asserts nothing and always passes. Call a matcher (`toEqual`, `toThrow`, `rejects.toThrow`, …) or remove it. (It slips past `no-assertion-runtime`, which counts the `expect` call as an assertion.)',
    'non-deterministic-input':
        '`new Date()` (no argument) / `Date.now()` / `Math.random()` produce a different value every run; used as a query input they make the params (and the snapshot) non-deterministic. Use a fixed value (`new Date(\'2024-01-02T03:04:05Z\')`). The constructor is allowed only as MOCK data passed to `mockNext`, simulating the database\'s own `current_date` / `current_timestamp` / `random()`.',
    'disable-without-reason':
        'Write `// tests-audit-disable-next-line <rule> -- <reason>` (or `tests-audit-disable-line` as a trailing comment) — the `-- <reason>` is mandatory so the suppression is visible and justified in the diff.',
    'unknown-rule':
        `Known audit rules: ${CONTENT_RULES.join(', ')}.`,
    'unused-ignore':
        'This `tests-audit-disable-*` matches no finding on its target line — the code changed or the comment is misplaced. Remove it or move it directly above (next-line) or onto (line) the flagged code.',
}

export function isContentRule(id: string): boolean {
    return (CONTENT_RULES as readonly string[]).includes(id)
}
