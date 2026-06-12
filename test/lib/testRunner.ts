// Thin runtime adapter: re-exports the test API from `bun:test` when running
// under Bun, otherwise from `vitest`. Both runners expose the same hooks
// (describe/test/expect/beforeAll/afterAll/beforeEach/afterEach), which is the
// only surface this file uses across the suite.
//
// Why a shim and not `vitest` in both runtimes?
//   - You asked explicitly for `bun:test` under Bun and `vitest` under Node.
//   - It keeps the suite neutral to ecosystem churn (DESIGN §1.9).
//
// Why the `#test-runtime` indirection instead of dynamic `import()`?
//   - A previous version used `await import('bun:test')` / `await
//     import('vitest')` inside a top-level await, then re-exported each
//     binding. Under `bun test --parallel=N`, worker processes evaluate the
//     importing test files before this module's top-level await resolves,
//     producing `ReferenceError: Cannot access 'describe' before
//     initialization` on every test. Static re-exports gated by the
//     `imports` map in `package.json` resolve at parse time, so there is
//     no top-level await and no TDZ window.

export {
    describe,
    test,
    it,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
} from '#test-runtime'

// A user/application error sentinel for transaction-body tests. Defined at the
// mock level (testContext) so the MockQueryRunner's `isSqlError` can recognise
// it as NOT a SQL error; re-exported here because `*.test.ts` files may import
// only the admitted test/lib helpers.
export { ApplicationError } from './testContext.js'

declare global {
    // eslint-disable-next-line no-var
    var Bun: { version: string } | undefined
}

export const TEST_RUNTIME: 'bun' | 'vitest' =
    typeof globalThis.Bun !== 'undefined' ? 'bun' : 'vitest'
