// Documentation snippets for the Collations page (docs/configuration/collations.md).

import { afterAll, beforeAll, beforeEach, describe, expect, test } from '../../../../lib/testRunner.js'
import { assertType, type Exact } from '../../../../lib/assertType.js'
import { tAppUser } from '../../domain/connection.js'
import { ctx } from './setup.js'

describe(ctx.label, () => {
    beforeAll(() => ctx.up(), ctx.timeoutMs)
    afterAll(() => ctx.down(), ctx.timeoutMs)
    beforeEach(() => { ctx.reset() })

    test('docs:collations/collate-a-value', async () => {
        ctx.mockNext([{ id: 1 }])
        const connection = ctx.conn

        // doc-start
        const users = await connection.selectFrom(tAppUser)
            .where(tAppUser.fullName.collate(ctx.exampleInsensitiveCollation).equals('Ada Lovelace'))
            .select({ id: tAppUser.id })
            .executeSelectMany()
        // doc-end

        expect(ctx.lastSql).toMatchInlineSnapshot(`"select id as id from app_user where (full_name collate NOCASE) = ?1"`)
        expect(ctx.lastParams).toMatchInlineSnapshot(`
          [
            "Ada Lovelace",
          ]
        `)
        assertType<Exact<typeof users, { id: number }[]>>()
        expect(users).toEqual([{ id: 1 }])
    })
})
