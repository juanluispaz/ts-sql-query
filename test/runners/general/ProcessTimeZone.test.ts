// Whether the process runs in UTC, as the query runners read it: by the name of the zone, never by its current
// offset, and again when process.env.TZ changes (Node and Bun change the zone of the process when it is assigned).

import { describe, expect, test } from '../../lib/testRunner.js'
import { isProcessInUtc, isUtcSessionTimeZone, isUtcTimeZoneName } from '../../../src/utils/processTimeZone.js'

describe('The zone of the process', () => {
    test('a-name-of-utc-is-utc-and-a-zone-at-zero-only-part-of-the-year-is-not', () => {
        for (const name of ['UTC', 'utc', 'Etc/UTC', 'GMT', 'Etc/GMT+0', 'Zulu', ':UTC', 'UTC0']) {
            expect(isUtcTimeZoneName(name)).toBe(true)
        }
        for (const name of ['Europe/London', 'Europe/Lisbon', 'Africa/Abidjan', 'Europe/Madrid', '+00:00']) {
            expect(isUtcTimeZoneName(name)).toBe(false)
        }
        // A zone given to a session may also be an offset of zero
        for (const zone of ['+00:00', '00:00', '-00:00', '+00', 'UTC']) {
            expect(isUtcSessionTimeZone(zone)).toBe(true)
        }
        for (const zone of ['+01:00', 'Europe/London', 'LOCAL', 'DBTIMEZONE']) {
            expect(isUtcSessionTimeZone(zone)).toBe(false)
        }
    })

    test('a-change-of-process-env-tz-while-running-is-seen', () => {
        const previous = process.env['TZ']
        try {
            process.env['TZ'] = 'UTC'
            expect(isProcessInUtc()).toBe(true)
            process.env['TZ'] = 'Europe/Madrid'
            expect(isProcessInUtc()).toBe(false)
            expect(new Date('2024-01-14T09:00:00Z').getHours()).toBe(10)
            process.env['TZ'] = 'Etc/UTC'
            expect(isProcessInUtc()).toBe(true)
        } finally {
            if (previous === undefined) {
                delete process.env['TZ']
            } else {
                process.env['TZ'] = previous
            }
        }
    })
})
