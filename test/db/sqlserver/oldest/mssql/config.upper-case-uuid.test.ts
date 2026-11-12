// Per-connection coverage of SqlServerConnection's `useUpperCaseUuid` flag.
// SQL Server gives a `uniqueidentifier`, and its text, in upper case. By default
// the library gives a uuid and the text of a uuid in lower case, as the other
// databases do: it lowers a uuid read, and writes `lower(...)` where the text of
// a uuid is transformed in the query. With the flag the upper case of SQL Server
// is kept and the SQL has no `lower(...)`. Each test runs the same query with the
// default connection and with the flag.
//
// Seed (issue): 1 external_ref '0a8f9c1e-1111-4222-8333-444455556666'.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { DBConnection, tIssue } from '../../domain/connection.js'
import { ctx } from './setup.js'

class UpperCaseUuidConnection extends DBConnection {
    protected override useUpperCaseUuid = true
}

const REF1 = '0a8f9c1e-1111-4222-8333-444455556666'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('upper-case-uuid: a uuid and its text are read in lower case by default', async () => {
        ctx.mockNext({ ref: REF1.toUpperCase(), text: REF1.toUpperCase() })
        const row = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ ref: tIssue.externalRef, text: tIssue.externalRef.asString() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select external_ref as ref, external_ref as text from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { ref?: string; text?: string }>>()
        expect(row).toEqual({ ref: REF1, text: REF1 })
    })

    test('upper-case-uuid: with the flag a uuid and its text are read in upper case', async () => {
        const conn = ctx.withConnection(UpperCaseUuidConnection)
        ctx.mockNext({ ref: REF1.toUpperCase(), text: REF1.toUpperCase() })
        const row = await conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .select({ ref: tIssue.externalRef, text: tIssue.externalRef.asString() })
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select external_ref as ref, external_ref as text from issue where id = @0"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            1,
          ]
        `)
        assertType<Exact<typeof row, { ref?: string; text?: string }>>()
        expect(row).toEqual({ ref: REF1.toUpperCase(), text: REF1.toUpperCase() })
    })

    test('upper-case-uuid: the text of a uuid concatenated is in lower case by default', async () => {
        ctx.mockNext(REF1 + '-x')
        const value = await ctx.conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString().concat('-x'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select lower(convert(nvarchar(36), external_ref)) + @0 as result from issue where id = @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "-x",
            1,
          ]
        `)
        assertType<Exact<typeof value, string | null>>()
        expect(value).toEqual(REF1 + '-x')
    })

    test('upper-case-uuid: with the flag the text of a uuid concatenated is in upper case', async () => {
        const conn = ctx.withConnection(UpperCaseUuidConnection)
        ctx.mockNext(REF1.toUpperCase() + '-x')
        const value = await conn.selectFrom(tIssue)
            .where(tIssue.id.equals(1))
            .selectOneColumn(tIssue.externalRef.asString().concat('-x'))
            .executeSelectOne()
        expect(ctx.lastSql).toMatchInlineSnapshot(`"select convert(nvarchar(36), external_ref) + @0 as result from issue where id = @1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "-x",
            1,
          ]
        `)
        assertType<Exact<typeof value, string | null>>()
        expect(value).toEqual(REF1.toUpperCase() + '-x')
    })
})
