// Thin runtime adapter: re-exports the test API from `bun:test` when running
// under Bun, otherwise from `vitest`. Both runners expose the same hooks
// (describe/test/expect/beforeAll/afterAll/beforeEach/afterEach), which is the
// only surface this file uses across the suite.
//
// Why a shim and not `vitest` in both runtimes?
//   - You asked explicitly for `bun:test` under Bun and `vitest` under Node.
//   - It keeps the suite neutral to ecosystem churn (DESIGN §1.9).
//
// Why top-level `await`?
//   - Both `bun:test` and `vitest` are ESM and resolve dynamically. A static
//     `import 'bun:test'` would fail under Node and vice-versa; dynamic
//     import keeps each runtime resolving only what it actually has.

import type * as VitestTypes from 'vitest'

declare global {
    // eslint-disable-next-line no-var
    var Bun: { version: string } | undefined
}

const isBun = typeof globalThis.Bun !== 'undefined'

// Both modules expose the same shape we care about; we type the result as
// vitest's API (a superset of what bun:test guarantees).
const runtime = isBun
    ? ((await import('bun:test')) as unknown as typeof VitestTypes)
    : await import('vitest')

export const describe = runtime.describe
export const test = runtime.test
export const it = runtime.it
export const expect = runtime.expect
export const beforeAll = runtime.beforeAll
export const afterAll = runtime.afterAll
export const beforeEach = runtime.beforeEach
export const afterEach = runtime.afterEach

export const TEST_RUNTIME: 'bun' | 'vitest' = isBun ? 'bun' : 'vitest'
