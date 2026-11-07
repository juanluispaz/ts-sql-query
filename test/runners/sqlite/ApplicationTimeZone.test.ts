// What the date functions of SQLite compute against what JavaScript says for the same value, with the process started
// in another zone. The suite pins UTC, and SQLite reads the zone from the C library when the process starts, so this
// needs a process of its own: see applicationTimeZone/probe.ts.

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from '../../lib/testRunner.js'

const probe = fileURLToPath(new URL('./applicationTimeZone/probe.ts', import.meta.url))
const runtimeArguments = typeof globalThis.Bun !== 'undefined' ? [probe] : ['--import', 'tsx', probe]

// Madrid and New York change their offset in summer, Kolkata has half hours, London kept +1 all through 1970, and
// between Pago Pago and Kiritimati the day is different from the UTC one at any time of the day
const zones = ['UTC', 'Europe/Madrid', 'America/New_York', 'Asia/Kolkata', 'Europe/London', 'Pacific/Pago_Pago', 'Pacific/Kiritimati']

function run(zone: string, mode: 'with-option' | 'without-option', compatibilityVersion = Number.POSITIVE_INFINITY, driver = 'native'): string[] {
    const result = spawnSync(process.execPath, [...runtimeArguments, mode, String(compatibilityVersion), driver], { encoding: 'utf8', env: { ...process.env, TZ: zone } })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    return JSON.parse(result.stdout)
}

describe('SQLite and the zone of the application', () => {
    for (const zone of zones) {
        test(`with sqliteRunsInApplicationTimeZone, the database and JavaScript agree in ${zone}`, () => {
            expect(run(zone, 'with-option')).toEqual([])
        }, 60_000)
    }

    for (const zone of ['Europe/Madrid', 'Asia/Kolkata']) {
        test(`with sqliteRunsInApplicationTimeZone and SQL for an older SQLite, they agree in ${zone}`, () => {
            expect(run(zone, 'with-option', 3_030_000)).toEqual([])
        }, 60_000)

        test(`with sqliteRunsInApplicationTimeZone on sqlite-wasm, they agree in ${zone}`, () => {
            expect(run(zone, 'with-option', Number.POSITIVE_INFINITY, 'wasm')).toEqual([])
        }, 60_000)
    }

    test('without the option, in UTC, the database and JavaScript agree', () => {
        expect(run('UTC', 'without-option')).toEqual([])
    }, 60_000)

    test('without the option, in another zone, the date functions work in UTC', () => {
        const mismatches = run('Europe/Madrid', 'without-option')
        expect(mismatches).toContain('localdate milliseconds as text 2024-01 getTime: 1705278615250 / 1705275015250')
        expect(mismatches).toContain('UTC milliseconds as text 2024-01 getHours: 23 / 0')
        expect(mismatches).toContain('Unix time milliseconds as integer 2024-01 getDate: 14 / 15')
    }, 60_000)
})
