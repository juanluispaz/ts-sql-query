// Rule `manual-connection` — a hand-constructed connection in a test body.
//
// Threat (a real, shipped class of bugs): a test that needs a config-varied
// connection must build it through the sanctioned factory `ctx.withConnection(Sub)`
// (or a per-dialect `ctx.withXxx(...)` in `test/db/<db>/runners.ts`), because
// those thread the cell's `compatibilityVersion` — and the full base config —
// into the connection. Hand-constructing it instead, e.g.
// `new IgnoreNullConnection(ctx.conn.queryRunner)` or `new DBConnection(runner)`,
// DROPS the 2nd `compatibilityVersion` constructor arg, so the connection
// silently defaults to `Number.POSITIVE_INFINITY` (newest-tier SQL) even in an
// older version-tier cell — the emitted SQL is wrong and no assertion catches it
// under the mock. See the `withConnection` docstring in `test/lib/testContext.ts`.
//
// Anchor — the SHAPE of the `new` expression, no type checker: a `new` on an
// identifier ending in `Connection` (`new DBConnection(...)`,
// `new IgnoreNullConnection(...)`, `new PostgreSqlConnection(...)`), mirroring the
// `new\s+\w*Connection\s*\(` pattern. A `new ns.SomethingConnection(...)`
// (property-access callee) or a class whose name merely contains `Connection`
// mid-word (`new ConnectionPool(...)`) is not the anti-pattern and not flagged.
//
// Carve-out — an EXPLICIT `compatibilityVersion` (2nd arg): the bug is the
// SILENT drop of that arg. A test that genuinely needs a connection pinned to a
// specific compatibility version DIFFERENT from the cell's (which
// `ctx.withConnection`, threading the cell's own version, cannot express) passes
// it explicitly — `new DBConnection(ctx.conn.queryRunner, 16_000_000)`, as the
// `config.aggregate-as-array-json-fallback` cells do. That is a visible,
// deliberate choice, not the silent-Infinity defect, so a construction with the
// 2nd arg present (>= 2 args) is NOT flagged; one that drops it (0 or 1 args) is.
//
// Scope: the walked cell files already exclude the `documentation` connector +
// `*.generated.test.ts` (where `new DBConnection(...)` is legitimate public-API
// demonstration with `compatibilityVersion = Infinity`); the `/documentation/`
// guard below is a defensive backstop if the check is ever run over a wider set.

import ts from 'typescript'
import type { Finding } from '../types.js'
import { lineOf } from '../ast.js'

export function checkManualConnection(sf: ts.SourceFile, file: string): Finding[] {
    // Defensive backstop — walk.ts already excludes the documentation cells.
    if (file.includes('/documentation/')) return []

    const out: Finding[] = []
    const visit = (n: ts.Node): void => {
        if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && /Connection$/.test(n.expression.text)) {
            const argCount = n.arguments?.length ?? 0
            // >= 2 args means the compatibilityVersion was passed explicitly — a
            // deliberate, visible choice, not the silent drop this rule bans.
            if (argCount < 2) {
                out.push({
                    rule: 'manual-connection',
                    file,
                    line: lineOf(sf, n),
                    message: `\`new ${n.expression.text}(…)\` hand-constructs a connection in a test body and DROPS the 2nd \`compatibilityVersion\` constructor arg — the connection silently runs at \`Number.POSITIVE_INFINITY\` (newest-tier SQL) even in an older version-tier cell. Use ctx.withConnection(...) / ctx.withXxx(...) — never construct a connection in a test body; see test/lib/testContext.ts`,
                })
            }
        }
        ts.forEachChild(n, visit)
    }
    visit(sf)
    return out
}
