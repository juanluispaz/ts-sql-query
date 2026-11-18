// Documentation snippets for the Metadata of a query and its parameters page (docs/advanced/metadata.md): a type
// adapter marks each parameter of a column of personal data, and the query, and a logger hides the marked values.
// organization.name holds the personal data here; organization 1 is 'Acme Corp'.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { getQueryContext } from '../../../../../src/QueryContext.js'
import { Table } from '../../../../../src/Table.js'
import type { TypeAdapter } from '../../../../../src/TypeAdapter.js'
import { DBConnection } from '../../domain/connection.js'
import { ctx } from './setup.js'
import { sync } from '../../../../../src/extras/sync.js'

// The key of this adapter: a symbol of its own
const personalData = Symbol('personalData')

// Marks each parameter of the column, and the query
const personalDataAdapter: TypeAdapter = {
    transformValueFromDB(value, context, next) {
        return next.transformValueFromDB(value, context)
    },
    transformValueToDB(value, context, next) {
        context.setMetadata(personalData, true)
        context.setQueryMetadata(personalData, true)
        return next.transformValueToDB(value, context)
    },
}

// What the logger of the page writes of the last query: its params without the values marked as personal data, and a
// note
function logged() {
    const context = getQueryContext(ctx.lastSql, ctx.lastParams)
    const shown = ctx.lastParams.map((value, index) => context.getParam(index)?.getMetadata(personalData) ? '***' : value)
    const note = context.getMetadata(personalData) ? '(with personal data)' : ''
    return { shown, note }
}

const tOrganizationPersonal = new class TOrganizationPersonal extends Table<DBConnection, 'TOrganizationPersonal'> {
    id = this.primaryKey('id', 'int')
    name = this.column('name', 'string', personalDataAdapter)
    constructor() {
        super('organization')
    }
}()

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:metadata/personal-data-out-of-the-logs', async () => {
        ctx.mockNext([{ id: 1 }])
        const connection = ctx.conn
        // doc-start
        const organizations = sync(connection.selectFrom(tOrganizationPersonal)
            .where(tOrganizationPersonal.name.equals('Acme Corp'))
            .select({
                id: tOrganizationPersonal.id
            })
            .executeSelectMany())
        // doc-end
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where name = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Acme Corp",
          ]
        `)
        assertType<Exact<typeof organizations, { id: number }[]>>()
        expect(organizations).toEqual([{ id: 1 }])
        expect(logged()).toEqual({ shown: ['***'], note: '(with personal data)' })
    })

    test('docs:metadata/a-query-without-the-column-has-no-mark', async () => {
        ctx.mockNext([{ id: 1 }])
        const organizations = sync(ctx.conn.selectFrom(tOrganizationPersonal)
            .where(tOrganizationPersonal.id.equals(1))
            .select({
                id: tOrganizationPersonal.id
            })
            .executeSelectMany())
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from organization where id = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof organizations, { id: number }[]>>()
        expect(organizations).toEqual([{ id: 1 }])
        expect(logged()).toEqual({ shown: [1], note: '' })
    })
})
