// The parent side of the LocalTemporalValuesInAnyZone tests. The zone of a process is set when it starts and the suite
// pins UTC, so each runner runs in a child process started with TZ set (`<db>/localTemporalValuesInAnyZone/probe.ts`),
// which prints its results as JSON; here they become one test per case, under a describe that names the runner and the
// zone. See localTemporalValuesProbe.ts for the contract and the cases.

import { execFile } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, test } from '../../lib/testRunner.js'
import { caseNamesOf, PROBE_ENV, RESULT_MARKER, type TemporalCaseResult, type TemporalDialect } from './localTemporalValuesProbe.js'

// Madrid and New York change their offset in summer and are on each side of UTC, and Tokyo is ahead of UTC all year
export const TEMPORAL_ZONES = ['UTC', 'Europe/Madrid', 'America/New_York', 'Asia/Tokyo'] as const

const PROBE_TIMEOUT = 300_000

export interface ProbeConnection {
    readonly info: unknown
    release(): Promise<void>
}

interface ProbeRun {
    /** The runner the probe builds, and its options */
    readonly runner: string
    readonly options?: Record<string, unknown> | undefined
    readonly zone: string
    /** Variables of the environment of the child process; undefined removes the variable */
    readonly env?: Record<string, string | undefined> | undefined
}

function runProbe(probe: string, mode: 'cases' | 'create', run: ProbeRun, connection: unknown): Promise<unknown> {
    const runtimeArguments = typeof globalThis.Bun !== 'undefined' ? [probe] : ['--import', 'tsx', probe]
    const env: Record<string, string | undefined> = { ...process.env, TZ: run.zone, ORA_SDTZ: undefined, ...run.env }
    env[PROBE_ENV] = JSON.stringify({ mode, runner: run.runner, options: run.options ?? {}, connection })
    for (const key of Object.keys(env)) {
        if (env[key] === undefined) delete env[key]
    }
    return new Promise((resolve, reject) => {
        execFile(process.execPath, runtimeArguments, { encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024, timeout: PROBE_TIMEOUT - 10_000 }, (error, stdout, stderr) => {
            const marker = stdout.lastIndexOf(RESULT_MARKER)
            if (marker < 0) {
                reject(new Error(`The probe of ${run.runner} in ${run.zone} printed no result (${error?.message ?? 'exit 0'})\nstdout: ${stdout.slice(-4000)}\nstderr: ${stderr.slice(-4000)}`))
                return
            }
            resolve(JSON.parse(stdout.slice(marker + RESULT_MARKER.length)))
        })
    })
}

function connectionLifecycle(needed: boolean, acquire: () => Promise<ProbeConnection>) {
    let connection: ProbeConnection | undefined
    beforeAll(async () => {
        if (needed) connection = await acquire()
    }, PROBE_TIMEOUT)
    afterAll(async () => {
        await connection?.release()
    }, PROBE_TIMEOUT)
    return () => connection?.info
}

export interface TemporalRunner {
    /** The name of the runner, as the probe knows it */
    readonly runner: string
    /** The label of the describe, when the runner has options */
    readonly label?: string | undefined
    readonly options?: Record<string, unknown> | undefined
    readonly enabled: boolean
    /** Whether the probe needs the engine of the database (a docker container); PGlite doesn't */
    readonly needsConnection: boolean
    readonly zones?: readonly string[] | undefined
    /** Variables of the environment of the child process for a zone */
    readonly envFor?: ((zone: string) => Record<string, string | undefined>) | undefined
    /**
     * The cases that don't give the value of the contract in a zone, a limit accepted for this runner: the reason, or
     * undefined. The test of such a case checks that the limit still happens, so it fails when it goes away.
     */
    readonly limitOf?: ((zone: string, caseName: string) => string | undefined) | undefined
}

export interface TemporalValuesOptions {
    readonly database: string
    readonly dialect: TemporalDialect
    readonly probe: string
    readonly runners: readonly TemporalRunner[]
    acquire(): Promise<ProbeConnection>
}

export function describeLocalTemporalValuesInAnyZone(opts: TemporalValuesOptions): void {
    const names = caseNamesOf(opts.dialect)
    const enabled = opts.runners.filter(runner => runner.enabled)
    describe.skipIf(enabled.length === 0)(`${opts.database}: the local date and time values in any zone of the process`, () => {
        const connection = connectionLifecycle(enabled.some(runner => runner.needsConnection), opts.acquire)
        for (const runner of opts.runners) {
            for (const zone of runner.zones ?? TEMPORAL_ZONES) {
                describe.skipIf(!runner.enabled)(`${runner.label ?? runner.runner} in ${zone}`, () => {
                    let results: Map<string, TemporalCaseResult> | undefined
                    let failure: unknown
                    beforeAll(async () => {
                        try {
                            const printed = await runProbe(opts.probe, 'cases', { runner: runner.runner, options: runner.options, zone, env: runner.envFor?.(zone) }, connection()) as TemporalCaseResult[]
                            results = new Map(printed.map(result => [result.name, result]))
                        } catch (error) {
                            failure = error
                        }
                    }, PROBE_TIMEOUT)
                    for (const name of names) {
                        const limit = runner.limitOf?.(zone, name)
                        test(limit === undefined ? name : `${name} | expected limit: ${limit}`, () => {
                            if (failure) throw failure
                            const result = results?.get(name)
                            expect(result).toBeDefined()
                            if (limit === undefined) {
                                expect(result!.actual).toBe(result!.expected)
                            } else {
                                expect(result!.actual).not.toBe(result!.expected)
                            }
                        })
                    }
                })
            }
        }
    })
}

export interface RunnerRequirement {
    /** What the test checks */
    readonly title: string
    readonly runner: string
    readonly options?: Record<string, unknown> | undefined
    readonly zone: string
    readonly env?: Record<string, string | undefined> | undefined
    /**
     * `created` when the runner must accept the configuration. `rejected` when it must reject it when created with a
     * TsSqlProcessingError of reason INVALID_CONFIGURATION; `rejected when created or at its first query` for a runner
     * given a promise of the pool, which can only see the configuration when the promise resolves.
     */
    readonly expected: 'created' | 'rejected' | 'rejected when created or at its first query'
}

export interface RunnerRequirementsOptions {
    readonly title: string
    readonly probe: string
    readonly enabled: boolean
    readonly requirements: readonly RunnerRequirement[]
    acquire(): Promise<ProbeConnection>
}

const REJECTED = 'TsSqlProcessingError INVALID_CONFIGURATION'

export function describeRunnerRequirements(opts: RunnerRequirementsOptions): void {
    describe.skipIf(!opts.enabled)(opts.title, () => {
        const connection = connectionLifecycle(true, opts.acquire)
        for (const requirement of opts.requirements) {
            test(requirement.title, async () => {
                const outcome = await runProbe(opts.probe, 'create', requirement, connection())
                if (requirement.expected === 'created') {
                    expect(outcome).toBe('created')
                } else if (requirement.expected === 'rejected') {
                    expect(outcome).toBe('rejected when created: ' + REJECTED)
                } else {
                    expect([`rejected when created: ${REJECTED}`, `rejected at its first query: ${REJECTED}`]).toContain(outcome)
                }
            }, PROBE_TIMEOUT)
        }
    })
}
