// Each query the library builds goes with the configuration of its connection, read with
// getQueryConnectionConfiguration: the connection itself, so its values are read when used, and a subclass that sets
// them in its field initialisers, which run after the constructor of the base connection, is seen with its values.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { getQueryConnectionConfiguration, type ConnectionConfiguration } from '../../../../../src/queryRunners/QueryRunner.js'
import { DBConnection, tOrganization } from '../../domain/connection.js'
import { ctx } from './setup.js'

// One patch above the version of the cell: the same SQL, but a value only the field initialiser gives
const fieldVersion = (ctx.compatibilityVersion ?? 999_000_000) + 1

class ConnectionWithFieldSettings extends DBConnection {
    protected override compatibilityVersion = fieldVersion
}

function configurationOf(params: typeof ctx.lastParams): ConnectionConfiguration | undefined {
    return getQueryConnectionConfiguration('', params)
}

function plain(configuration: ConnectionConfiguration | undefined) {
    if (!configuration) {
        return configuration
    }
    return {
        compatibilityVersion: configuration.compatibilityVersion,
        uuidStrategy: configuration.uuidStrategy,
        dateTimeFormat: configuration.getDateTimeFormat?.('dateTime'),
        sqliteRunsInApplicationTimeZone: configuration.sqliteRunsInApplicationTimeZone,
        treatUnexpectedIntegerDateTimeAsJulian: configuration.treatUnexpectedIntegerDateTimeAsJulian,
        treatUnexpectedStringDateTimeAsUTC: configuration.treatUnexpectedStringDateTimeAsUTC,
        unexpectedUnixDateTimeAreMilliseconds: configuration.unexpectedUnixDateTimeAreMilliseconds,
    }
}

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('connection-configuration/of-the-connection', async () => {
        ctx.mockNext(['Acme Corp'])
        const names = await ctx.conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .selectOneColumn(tOrganization.name)
            .executeSelectMany()
        expect(plain(configurationOf(ctx.lastParams))).toMatchInlineSnapshot(`
          {
            "compatibilityVersion": 10003000,
            "dateTimeFormat": undefined,
            "sqliteRunsInApplicationTimeZone": undefined,
            "treatUnexpectedIntegerDateTimeAsJulian": undefined,
            "treatUnexpectedStringDateTimeAsUTC": undefined,
            "unexpectedUnixDateTimeAreMilliseconds": undefined,
            "uuidStrategy": "string",
          }
        `)
        expect(names).toEqual(['Acme Corp'])
    })

    test('connection-configuration/set-in-the-fields-of-a-subclass', async () => {
        const conn = ctx.withConnection(ConnectionWithFieldSettings)

        ctx.mockNext(['Acme Corp'])
        const names = await conn.selectFrom(tOrganization)
            .where(tOrganization.id.equals(1))
            .selectOneColumn(tOrganization.name)
            .executeSelectMany()
        const configuration = configurationOf(ctx.lastParams)
        expect(configuration?.compatibilityVersion).toBe(fieldVersion)
        // The connection itself
        expect(configuration).toBe(conn)
        expect(names).toEqual(['Acme Corp'])

        // The count of a page
        ctx.reset()
        ctx.mockNext([{ id: 1 }])
        ctx.mockNext(2)
        const page = await conn.selectFrom(tOrganization)
            .select({ id: tOrganization.id })
            .orderBy('id')
            .limit(1)
            .executeSelectPage()
        expect(ctx.history.map(entry => configurationOf(entry.params)?.compatibilityVersion)).toEqual([fieldVersion, fieldVersion])
        expect(page).toEqual({ data: [{ id: 1 }], count: 2 })

        // A transaction, whose params are its options
        ctx.mockNext(['Acme Corp'])
        await conn.transaction(async () => {
            await conn.selectFrom(tOrganization).where(tOrganization.id.equals(1)).selectOneColumn(tOrganization.name).executeSelectMany()
        })
        expect(configurationOf(ctx.lastTransactionOpts ?? [])?.compatibilityVersion).toBe(fieldVersion)

        // The same connection for every query, and another one for another connection
        expect(configurationOf(ctx.lastTransactionOpts ?? [])).toBe(conn)
        ctx.mockNext(['Acme Corp'])
        await ctx.conn.selectFrom(tOrganization).where(tOrganization.id.equals(1)).selectOneColumn(tOrganization.name).executeSelectMany()
        expect(configurationOf(ctx.lastParams)).toBe(ctx.conn)
    })

    test('connection-configuration/of-a-function', async () => {
        const conn = ctx.withConnection(ConnectionWithFieldSettings)
        ctx.mockNext(1)
        const open = await conn.callCountOpenIssues(1)
        expect(configurationOf(ctx.lastParams)?.compatibilityVersion).toBe(fieldVersion)
        expect(typeof open).toBe('number')
    })

    test('connection-configuration/none-for-a-query-the-library-did-not-build', () => {
        expect(configurationOf([1])).toBeUndefined()
    })
})
