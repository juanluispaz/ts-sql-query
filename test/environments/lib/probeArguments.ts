/**
 * The arguments that run a probe of TypeScript in a child process of the runtime of the tests: Bun runs it as it is;
 * Node with tsx, and with Temporal from the polyfill where it has none (see test/lib/setupTemporal.ts)
 */
export function probeArguments(probe: string): string[] {
    return typeof globalThis.Bun !== 'undefined' ? [probe] : ['--import', 'tsx', '--import', 'temporal-polyfill/global', probe]
}
